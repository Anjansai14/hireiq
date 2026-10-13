/**
 * Live campaign operations: source pipeline (with RR-H06 enforcement), deals,
 * content approval (RR-H03 / RR-H04), posts & metrics, insights (A11 + A12),
 * next moves, plan versions, close-out (writes results back to the Creator
 * Bank, rate card and history), and Resolence attribution.
 */
const db = require('../db');
const settings = require('./settings');
const repo = require('./repo');
const stats = require('./stats');
const ai = require('./ai');
const { uid, inr, daysBetween, HttpError } = require('../utils/helpers');

async function listCampaigns(courseId) {
  const rows = await db.query('SELECT id FROM campaigns WHERE course_id = ? ORDER BY FIELD(status,"Live","Draft","Closed"), created_at DESC', [courseId]);
  const out = [];
  for (const { id } of rows) {
    const c = await repo.loadCampaign(id);
    const st = await repo.withStats(c);
    out.push({
      id: c.id, name: c.name, status: c.status, objective: c.objective, asset: c.asset, kpi: c.kpi, start_date: c.start_date, end_date: c.end_date,
      budget: c.budget, version: c.version, sources: c.ccs.length, enrols: st.enrols, clicks: st.clicks, spent: st.spent, committed: st.committed,
      target: c.target, verdict: c.diagnosis?.verdict || null, pred: c.pred_frozen, wizard_step: c.wizard?.step ?? null, created_at: c.created_at,
    });
  }
  return out;
}

async function getCampaign(id) {
  const c = await repo.loadCampaign(id);
  const st = await repo.withStats(c);
  const today = await settings.today();
  return { ...c, stats: st, series: c.status === 'Draft' ? null : stats.series(c, today), today };
}

async function log(ccId, text) {
  await db.insert('cc_log', { cc_id: ccId, date: await settings.today(), text });
}

async function addSource(campaignId, sourceId, narrativeId) {
  const c = await db.one('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
  if (!c || c.status !== 'Live') throw new HttpError(409, 'Sources can only be added to live campaigns');
  const s = await db.one('SELECT * FROM sources WHERE id = ?', [sourceId]);
  if (!s) throw new HttpError(404, 'Source not found');
  const dup = await db.one('SELECT id FROM campaign_sources WHERE campaign_id = ? AND source_id = ?', [campaignId, sourceId]);
  if (dup) throw new HttpError(409, `${s.name} is already on this campaign`);
  const id = uid('cc');
  await db.insert('campaign_sources', { id, campaign_id: campaignId, source_id: sourceId, narrative_id: narrativeId || null, channel: s.platform, status: 'Identified', tracking_tag: `hq-${campaignId}-${sourceId}`, rate: s.rate, posts: 1, deal_type: s.rate ? 'Paid' : 'Partnership' });
  await log(id, 'Added to campaign (Identified)');
  return id;
}

/** Pipeline transitions. Committed statuses need a deal; institutional sources need consent (RR-H06). */
async function setStatus(campaignId, ccId, status, reason) {
  const cfg = await settings.load();
  const { committed, institutional } = await settings.typeSets();
  if (!settings.codes(cfg.lookups, 'source_status').includes(status)) throw new HttpError(400, 'Unknown status');
  const x = await db.one('SELECT cs.*, s.type, s.consent, s.name FROM campaign_sources cs JOIN sources s ON s.id = cs.source_id WHERE cs.id = ? AND cs.campaign_id = ?', [ccId, campaignId]);
  if (!x) throw new HttpError(404, 'Source not on this campaign');
  if (committed.includes(status)) {
    if (institutional.includes(x.type) && x.consent !== 'Recorded') throw new HttpError(422, 'No consent record. This source cannot move to Confirmed until consent is recorded (RR-H06).', { rule: 'RR-H06' });
    if (x.rate == null || !x.posts) throw new HttpError(422, 'Record the deal (fee and posts) before confirming');
  }
  if (['Declined', 'Backed out'].includes(status) && !reason) throw new HttpError(400, 'A reason is required');
  await db.update('campaign_sources', { status, reason: reason || x.reason }, 'id = ?', [ccId]);
  await log(ccId, `Status → ${status}${reason ? ': ' + reason : ''}`);
  if (status === 'Confirmed') {
    await db.insert('rate_observations', { date: await settings.today(), source_id: x.source_id, course: (await db.one('SELECT k.title FROM courses k JOIN campaigns c ON c.course_id = k.id WHERE c.id = ?', [campaignId])).title, rate: x.rate, posts: x.posts, tier: institutional.includes(x.type) ? 'Institutional' : (await db.one('SELECT tier FROM sources WHERE id = ?', [x.source_id])).tier });
  }
}

async function updateDeal(campaignId, ccId, d) {
  const allowed = { deal_type: d.deal_type, rate: d.rate, posts: d.posts, deliverables: d.deliverables, deal_start: d.deal_start, deal_end: d.deal_end, terms: d.terms, hashtag: d.hashtag };
  Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);
  await db.update('campaign_sources', allowed, 'id = ? AND campaign_id = ?', [ccId, campaignId]);
  if (d.rate != null) await log(ccId, d.rate ? `Deal recorded: ${inr(d.rate)} × ${d.posts || ''} posts` : 'Partnership recorded at zero fee');
}

/** Approve content: blocked if it asserts an unevidenced claim (RR-H03) or a paid item lacks #ad (RR-H04). */
async function setContentStatus(ccId, ciId, status) {
  const ci = await db.one('SELECT ci.*, cs.rate FROM content_items ci JOIN campaign_sources cs ON cs.id = ci.cc_id WHERE ci.id = ? AND ci.cc_id = ?', [ciId, ccId]);
  if (!ci) throw new HttpError(404, 'Content item not found');
  if (status === 'Approved') {
    if ((ci.rate || 0) > 0 && !/#ad\b/i.test(ci.caption || '')) throw new HttpError(422, 'Approval blocked: paid content must carry a disclosure tag (RR-H04)', { rule: 'RR-H04' });
    const scr = await fetch(`${require('../config').ai.url}/v1/governance/screen`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Service-Key': require('../config').ai.key }, body: JSON.stringify({ text: [ci.title, ci.hook, ci.caption].join(' ') }) }).then((r) => r.json()).catch(() => ({}));
    if (scr.claim) throw new HttpError(422, 'Approval blocked: placement or salary claim without Observed evidence (RR-H03)', { rule: 'RR-H03' });
  }
  await db.update('content_items', { status }, 'id = ?', [ciId]);
  await log(ccId, `Content "${ci.title}" → ${status}`);
  const pending = await db.one("SELECT COUNT(*) n FROM content_items WHERE cc_id = ? AND status <> 'Approved'", [ccId]);
  if (status === 'In review') await db.query("UPDATE campaign_sources SET status = 'Content in review' WHERE id = ? AND status = 'Confirmed'", [ccId]);
  return { pendingApproval: pending.n };
}

/** Add a live post (link + optional manual metrics). First post moves the source to Live. */
async function addPost(campaignId, ccId, p) {
  const x = await db.one('SELECT * FROM campaign_sources WHERE id = ? AND campaign_id = ?', [ccId, campaignId]);
  if (!x) throw new HttpError(404, 'Source not on this campaign');
  const id = uid('p');
  await db.insert('posts', {
    id, cc_id: ccId, title: p.title || 'Post', format: p.format || null, url: p.url || null, posted_on: p.posted_on || await settings.today(),
    views: p.views ?? null, likes: p.likes ?? null, comments: p.comments ?? null, shares: p.shares ?? null, clicks: p.clicks || 0,
    regs: p.regs || 0, enrols: p.enrols || 0, manual: p.manual ? 1 : 0, last_fetch: new Date(),
  });
  if (['Confirmed', 'Content in review'].includes(x.status)) {
    await db.update('campaign_sources', { status: 'Live', late: 0 }, 'id = ?', [ccId]);
    await log(ccId, 'First post live → status Live');
  }
  const n = await db.one('SELECT COUNT(*) n FROM posts WHERE cc_id = ?', [ccId]);
  if (x.posts && n.n >= x.posts) {
    await db.update('campaign_sources', { status: 'Delivered' }, 'id = ?', [ccId]);
    await log(ccId, 'All posts delivered → status Delivered');
  }
  return id;
}

/** Insights: A11 listening on comments, then A12 diagnosis + moves. */
async function runInsights(id) {
  const c = await repo.loadCampaign(id);
  if (c.status === 'Draft') throw new HttpError(409, 'Insights need a live campaign');
  const st = await repo.withStats(c);
  const cfg = await settings.load();
  const today = await settings.today();

  const lis = await ai.runAgent('a11', {
    comments: c.comments.map((m) => ({ id: m.id, text: m.text, lang: m.lang, translation: m.translation, sentiment: m.sentiment, theme: m.theme, intent: !!m.intent })),
    themes: settings.codes(cfg.lookups, 'comment_theme'), scepticism_threshold_pct: cfg.settings.scepticism_threshold_pct,
  }, { entityType: 'campaign', entityId: id });
  for (const m of lis.comments) {
    if (m.id) await db.update('comments', { lang: m.lang, translation: m.translation || null, sentiment: m.sentiment, theme: m.theme, intent: m.intent ? 1 : 0 }, 'id = ?', [m.id]);
  }
  const ser = stats.series(c, today);
  const rows = c.ccs.map((x) => ({
    name: x.name, type: x.type, platform: x.platform, status: x.status, late: !!x.late || (x.deal_end && x.deal_end < today && !x.posts.length),
    clicks: x.stats.clicks, regs: x.stats.regs, enrols: x.stats.enrols, fee: x.rate || 0, posts_done: x.posts.length, posts_deal: x.deal_posts || 0,
    cohort_share: (c.markets || []).reduce((a, m) => a + ((x.markets || {})[m] || 0), 0), pred_enrols: x.pred_enrols || [2, 5],
  }));
  const dg = await ai.runAgent('a12', {
    campaign: { ...repo.campaignDTO(c), pred: c.pred_frozen }, today, stats: st, sources: rows, listening: lis, series: ser.pts,
    settings: { enrol_rate_floor_pct: cfg.settings.enrol_rate_floor_pct, scepticism_threshold_pct: cfg.settings.scepticism_threshold_pct, checkpoints: cfg.settings.checkpoints },
  }, { entityType: 'campaign', entityId: id });

  await db.update('campaigns', {
    diagnosis: { verdict: dg.verdict, gap: dg.gap, when: today, causes: dg.causes, text: dg.text },
    band_now: dg.band_now, summary: lis.summary,
  }, 'id = ?', [id]);
  await db.query('DELETE FROM checkpoints WHERE campaign_id = ?', [id]);
  for (const cp of dg.checkpoints) await db.insert('checkpoints', { campaign_id: id, label: cp.label, date: cp.date, verdict: cp.verdict, note: cp.note });
  await db.query('DELETE FROM campaign_alerts WHERE campaign_id = ? AND dismissed = 0', [id]);
  for (const a of [...dg.alerts, ...lis.alerts.filter((x) => !dg.alerts.some((y) => y.kind === x.kind))]) {
    await db.insert('campaign_alerts', { campaign_id: id, kind: a.kind, rule_code: a.rule, text: a.text, level: a.level });
  }
  await db.query("DELETE FROM moves WHERE campaign_id = ? AND status = 'Open'", [id]);
  for (const m of dg.moves) await db.insert('moves', { id: uid('m'), campaign_id: id, type: m.type, title: m.title, impact: m.impact, cost: m.cost || 0, cost_label: m.cost_label, why: m.why, status: 'Open' });
  await db.insert('activity_log', { course_id: c.course_id, campaign_id: id, ts: new Date(), kind: 'alert', text: `Insights refreshed: ${c.name} is ${dg.verdict}` });
  return getCampaign(id);
}

/** Accept / dismiss a move. Accepting bumps the plan version; the frozen prediction is kept. */
async function decideMove(campaignId, moveId, decision, user) {
  const m = await db.one('SELECT * FROM moves WHERE id = ? AND campaign_id = ?', [moveId, campaignId]);
  if (!m) throw new HttpError(404, 'Move not found');
  if (m.status !== 'Open') throw new HttpError(409, `Move already ${m.status}`);
  await db.update('moves', { status: decision === 'accept' ? 'Accepted' : 'Dismissed' }, 'id = ?', [moveId]);
  if (decision === 'accept') {
    const c = await db.one('SELECT version FROM campaigns WHERE id = ?', [campaignId]);
    const v = (c.version || 1) + 1;
    await db.update('campaigns', { version: v }, 'id = ?', [campaignId]);
    await db.insert('plan_versions', { campaign_id: campaignId, v, date: await settings.today(), by_user: user.name, note: `Accepted move: ${m.title}` });
  }
}

/** Close: final verdict vs frozen range, write outcomes back to Creator Bank + rate card (RM-09 recalibration hook). */
async function closeCampaign(id, lessons, user) {
  const c = await repo.loadCampaign(id);
  if (c.status !== 'Live') throw new HttpError(409, 'Only live campaigns can be closed');
  const st = await repo.withStats(c);
  const course = await db.one('SELECT title FROM courses WHERE id = ?', [c.course_id]);
  const today = await settings.today();
  const pe = c.pred_frozen?.enrols || [0, 0];
  const verdict = st.enrols < pe[0] ? 'Behind' : st.enrols > pe[1] ? 'Ahead' : 'On track';
  for (const x of c.ccs) {
    if (['Live', 'Delivered', 'Backed out', 'Declined'].includes(x.status)) {
      await db.insert('source_history', { source_id: x.source_id, course: course.title, campaign: c.name, date: today, status: x.status === 'Live' ? 'Delivered' : x.status, fee: x.rate, views: x.stats.views || null, enrols: x.stats.enrols, rating: x.rating });
      if (x.stats.enrols) await db.query('UPDATE sources SET attributed = attributed + ? WHERE id = ?', [x.stats.enrols, x.source_id]);
    }
  }
  await db.update('campaigns', { status: 'Closed', lessons: lessons || [], diagnosis: { ...(c.diagnosis || {}), verdict, gap: `Final ${st.enrols} enrolments vs frozen range ${pe[0]}–${pe[1]}`, when: today } }, 'id = ?', [id]);
  await db.insert('plan_versions', { campaign_id: id, v: c.version, date: today, by_user: user.name, note: 'Campaign closed. Results written to Creator Bank, rate card and playbook.' });
  return getCampaign(id);
}

/**
 * Resolence attribution. Tags look like hq-{campaign}-{source}-{n}; counts per tag/day are summed
 * onto the n-th post of that source on that campaign. Tags with no post become "unattributed".
 */
async function applyAttribution() {
  const sums = await db.query('SELECT tracking_tag, SUM(clicks) clicks, SUM(regs) regs, SUM(enrols) enrols FROM enrolment_events GROUP BY tracking_tag');
  const unattributed = {};
  for (const s of sums) {
    const m = /^hq-([^-]+)-([^-]+)(?:-(\d+))?$/.exec(s.tracking_tag);
    if (!m) continue;
    const [, campId, srcId, nStr] = m;
    const cc = await db.one('SELECT id FROM campaign_sources WHERE campaign_id = ? AND source_id = ?', [campId, srcId]);
    const posts = cc ? await db.query('SELECT id FROM posts WHERE cc_id = ? ORDER BY posted_on', [cc.id]) : [];
    const post = posts[(Number(nStr) || 1) - 1];
    if (post) await db.update('posts', { clicks: s.clicks, regs: s.regs, enrols: s.enrols, last_fetch: new Date() }, 'id = ?', [post.id]);
    else unattributed[campId] = (unattributed[campId] || 0) + Number(s.enrols);
  }
  for (const [campId, n] of Object.entries(unattributed)) await db.update('campaigns', { unattributed: n }, 'id = ?', [campId]);
  return { tags: sums.length, unattributed };
}

async function ingestResolence(rows, sourceFile) {
  let n = 0;
  for (const r of rows) {
    if (!r.tracking_tag || !r.date) continue;
    await db.query(`INSERT INTO enrolment_events (tracking_tag, event_date, clicks, regs, enrols, source_file) VALUES (?,?,?,?,?,?)
                    ON DUPLICATE KEY UPDATE clicks = VALUES(clicks), regs = VALUES(regs), enrols = VALUES(enrols), source_file = VALUES(source_file)`,
    [r.tracking_tag, r.date, +r.clicks || 0, +r.regs || 0, +r.enrols || 0, sourceFile || null]);
    n++;
  }
  const res = await applyAttribution();
  await db.update('connectors', { last_sync: new Date() }, 'id = ?', ['res']);
  return { rows: n, ...res };
}

/** Daily: flag confirmed sources that are past their post date. */
async function markLate() {
  const today = await settings.today();
  await db.query(`UPDATE campaign_sources cs SET late = 1 WHERE cs.status IN ('Confirmed','Content in review') AND cs.deal_end < ?
                  AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.cc_id = cs.id)`, [today]);
}

async function checkpointsDueToday() {
  const today = await settings.today();
  return db.query("SELECT DISTINCT campaign_id FROM checkpoints cp JOIN campaigns c ON c.id = cp.campaign_id WHERE c.status = 'Live' AND cp.date = ?", [today]);
}

module.exports = { listCampaigns, getCampaign, addSource, setStatus, updateDeal, setContentStatus, addPost, runInsights, decideMove, closeCampaign, ingestResolence, applyAttribution, markLate, checkpointsDueToday, daysBetween };
