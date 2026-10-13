/**
 * Copilot: threads scoped to a course or a campaign. Builds a grounded context
 * pack from the DB, calls the Copilot agent, stores messages, logs RR-H01/H02
 * refusals as fairness escalations, and executes proposals only when the user
 * clicks Accept.
 */
const db = require('../db');
const settings = require('./settings');
const repo = require('./repo');
const ai = require('./ai');
const campaigns = require('./campaignService');
const { uid, HttpError } = require('../utils/helpers');

async function buildContext(thread) {
  const ctx = {};
  if (thread.scope_type === 'campaign' && thread.scope_id) {
    const c = await campaigns.getCampaign(thread.scope_id);
    ctx.campaign = { id: c.id, name: c.name, status: c.status, objective: c.objective, markets: c.markets, budget: c.budget, pred: c.pred_frozen };
    ctx.stats = c.stats;
    ctx.diagnosis = c.diagnosis;
    ctx.moves = c.moves.filter((m) => m.status === 'Open').map((m) => ({ id: m.id, title: m.title, impact: m.impact, cost_label: m.cost_label, status: m.status }));
    ctx.sources_on_campaign = c.ccs.map((x) => ({ name: x.name, platform: x.platform, status: x.status, enrols: x.stats.enrols, clicks: x.stats.clicks }));
    ctx.alerts = c.alerts.map((a) => a.text);
    ctx.summary = c.summary;
  }
  const courseId = thread.course_id;
  if (courseId) {
    const course = await repo.loadCourse(courseId);
    ctx.course = { id: course.id, title: course.title, batch: course.batch, form: course.form, claims: course.claims.map((q) => ({ text: q.text, status: q.status })), readiness: course.readiness };
  }
  // Eligible sources (names only from the Creator Bank — Copilot never invents handles)
  if (ctx.campaign && ctx.campaign.status === 'Live') {
    const cfg = await settings.load();
    const types = await settings.typeSets();
    const all = await repo.loadSources();
    const onCamp = new Set((await db.query('SELECT source_id FROM campaign_sources WHERE campaign_id = ?', [ctx.campaign.id])).map((r) => r.source_id));
    const r = await ai.runAgent('a7', {
      campaign: { markets: ctx.campaign.markets, languages: ['Telugu', 'English'], budget: ctx.campaign.budget },
      sources: all.filter((s) => !onCamp.has(s.id)).map(repo.sourceDTO), today: await settings.today(), gates: cfg.settings.gates,
      institutional_types: types.institutional, anchor_types: types.anchors, tier_median_er: types.tierMedianEr,
    }, { log: false });
    ctx.sources = r.ranked.slice(0, 5).map((s) => ({ id: s.id, name: s.name, platform: s.platform, trust_pct: s.trust_pct, why: s.why }));
  }
  return ctx;
}

async function listThreads(courseId) {
  return db.query('SELECT * FROM copilot_threads WHERE course_id = ? ORDER BY date DESC, id DESC', [courseId]);
}

async function getThread(id) {
  const t = await db.one('SELECT * FROM copilot_threads WHERE id = ?', [id]);
  if (!t) throw new HttpError(404, 'Thread not found');
  t.messages = await db.query('SELECT * FROM copilot_messages WHERE thread_id = ? ORDER BY id', [id]);
  return t;
}

async function createThread({ course_id, scope_type, scope_id, title }, user) {
  let scope = '';
  if (scope_type === 'campaign') scope = (await db.one('SELECT name FROM campaigns WHERE id = ?', [scope_id]))?.name;
  else scope = (await db.one('SELECT title FROM courses WHERE id = ?', [course_id]))?.title;
  if (!scope) throw new HttpError(404, 'Scope not found');
  const id = uid('th');
  await db.insert('copilot_threads', { id, course_id, user_id: user.id, title: title || 'New chat', scope, scope_type: scope_type || 'course', scope_id: scope_id || course_id, date: await settings.today() });
  return getThread(id);
}

async function send(threadId, text, user) {
  const t = await getThread(threadId);
  await db.insert('copilot_messages', { thread_id: threadId, role: 'user', text });
  if (t.messages.length === 0) await db.update('copilot_threads', { title: text.slice(0, 120) }, 'id = ?', [threadId]);
  const context = await buildContext(t);
  const r = await ai.runAgent('cop', {
    message: text, scope: t.scope, context, history: t.messages.map((m) => ({ role: m.role, text: m.text })),
  }, { entityType: 'thread', entityId: threadId });
  if (r.refused) await db.insert('fairness_escalations', { rule_code: r.rule, user_id: user.id, context: 'copilot', request: text });
  const proposal = r.proposal ? { ...r.proposal, status: 'Pending' } : null;
  await db.insert('copilot_messages', { thread_id: threadId, role: 'ai', text: r.text, sources: r.sources || [], proposal: proposal ? { ...proposal, concept: r.concept || null } : r.concept ? { concept: r.concept } : null });
  return getThread(threadId);
}

/** Execute an accepted proposal. Only whitelisted actions; everything is re-validated server-side. */
async function decideProposal(messageId, decision, user) {
  const m = await db.one('SELECT * FROM copilot_messages WHERE id = ?', [messageId]);
  if (!m?.proposal?.action) throw new HttpError(404, 'No proposal on this message');
  if (m.proposal.status !== 'Pending') throw new HttpError(409, `Proposal already ${m.proposal.status}`);
  const a = m.proposal.action;
  if (decision === 'accept') {
    if (a.type === 'accept_move') await campaigns.decideMove(a.campaign_id, a.move_id, 'accept', user);
    else if (a.type === 'add_source') await campaigns.addSource(a.campaign_id, a.source_id);
    else if (a.type === 'save_artifact') {
      const t = await db.one('SELECT course_id FROM copilot_threads WHERE id = ?', [m.thread_id]);
      await db.insert('files', { id: uid('fl'), course_id: t.course_id, name: a.name || 'concept.png', lane: 'Brand assets', date: await settings.today(), by_user: 'Copilot', status: 'Generated', prompt: m.text.slice(0, 500) });
    } else throw new HttpError(400, `Unsupported action ${a.type}`);
  }
  await db.update('copilot_messages', { proposal: { ...m.proposal, status: decision === 'accept' ? 'Accepted' : 'Discarded' } }, 'id = ?', [messageId]);
  return getThread(m.thread_id);
}

module.exports = { listThreads, getThread, createThread, send, decideProposal };
