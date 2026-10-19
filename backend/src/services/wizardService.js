/**
 * Campaign wizard (6 steps), orchestrating the agents:
 *   0 Objective and cohort  → A4   1 Narrative → A5   2 Channels → A6
 *   3 Influencers → A7            4 Content   → A8   5 Review   → A9 + A10
 * Draft state lives in campaigns.wizard (JSON) and auto-saves on every call.
 * `create` re-runs A9/A10, refuses on any failing check, freezes the
 * prediction (v1) and materialises narratives, channels, sources and content.
 */
const db = require('../db');
const settings = require('./settings');
const repo = require('./repo');
const ai = require('./ai');
const { uid, addDays, HttpError } = require('../utils/helpers');

const STEPS = ['Objective and cohort', 'Narrative', 'Channels', 'Influencers', 'Content', 'Review and create'];

async function ctx(id) {
  const c = await db.one('SELECT * FROM campaigns WHERE id = ?', [id]);
  if (!c) throw new HttpError(404, 'Campaign not found');
  if (c.status !== 'Draft') throw new HttpError(409, 'Only draft campaigns can be edited in the wizard');
  c.wizard = c.wizard || { step: 0, done: [], needs: [], answers: {} };
  const course = await repo.loadCourse(c.course_id);
  const cfg = await settings.load();
  const types = await settings.typeSets();
  const today = await settings.today();
  return { c, w: c.wizard, course, cfg, types, today };
}

async function save(id, w, extra = {}) {
  await db.update('campaigns', { wizard: w, ...extra }, 'id = ?', [id]);
  return get(id);
}

const markDone = (w, step, next) => {
  if (!w.done.includes(step)) w.done.push(step);
  w.needs = (w.needs || []).filter((i) => i !== step && i !== next);
  w.step = next;
};

async function get(id) {
  const c = await db.one('SELECT * FROM campaigns WHERE id = ?', [id]);
  if (!c) throw new HttpError(404, 'Campaign not found');
  return { campaign: c, steps: STEPS, wizard: c.wizard || { step: 0, done: [], needs: [], answers: {} } };
}

async function createDraft(courseId, name, user) {
  const course = await repo.loadCourse(courseId);
  if (course.readiness.refused) throw new HttpError(409, 'Create campaign is blocked: a governance flag on the course brief is Refused.');
  const f = course.form || {};
  const id = uid('k');
  await db.insert('campaigns', {
    id, course_id: courseId, name: name || 'Untitled campaign', objective: 'Getting onboarded', kpi: 'Screening enrolments',
    markets: [], languages: f.langs || [], budget: 0, ceiling: course.ceiling, status: 'Draft', version: 0, owner: user.name,
    hashtags: [], created_at: await settings.today(), wizard: { step: 0, done: [], needs: [], answers: {} },
  });
  return get(id);
}

/** Step 0 fields. Changing them after later steps ran marks those steps Needs attention. */
async function saveObjective(id, body) {
  const { c, w } = await ctx(id);
  const allowed = ['name', 'objective', 'kpi', 'target', 'ceiling', 'budget', 'markets', 'languages', 'qual', 'skill_bg', 'age_band', 'exp_band', 'start_date', 'end_date', 'free_text', 'cohort', 'asset', 'hashtags'];
  const upd = {};
  for (const k of allowed) if (k in body) upd[k] = body[k];
  if (w.done.length) w.needs = [...new Set([...(w.needs || []), 1, 2, 3])];
  if (body.answers) w.answers = { ...w.answers, ...body.answers };
  await db.update('campaigns', { ...upd, wizard: w }, 'id = ?', [id]);
  return get(id);
}

/** A4 — normalise districts, size cohort, pick questions, screen RR-H01/H02. */
async function runCohort(id, user) {
  const { c, w, course, cfg } = await ctx(id);
  const past = await db.query(`SELECT c.name, SUM(p.enrols) enrols FROM campaigns c JOIN campaign_sources cs ON cs.campaign_id = c.id
                               JOIN posts p ON p.cc_id = cs.id WHERE c.course_id = ? AND c.status = 'Closed' GROUP BY c.id`, [c.course_id]);
  const r = await ai.runAgent('a4', {
    campaign: repo.campaignDTO(c), course: repo.courseDTO(course), past_campaigns: past,
    lookups: { district: cfg.lookups.district, state: cfg.lookups.state, qualification: cfg.lookups.qualification, age_band: cfg.lookups.age_band, exp_band: cfg.lookups.exp_band, cohort_question: cfg.lookups.cohort_question },
    settings: { min_cohort_size: cfg.settings.min_cohort_size },
  }, { entityType: 'campaign', entityId: id });
  if (r.refusal) {
    await db.insert('fairness_escalations', { rule_code: r.refusal.rule, user_id: user.id, context: 'wizard.cohort', request: `${c.name} · ${c.free_text || c.cohort || ''}` });
    throw new HttpError(422, r.refusal.text, { rule: r.refusal.rule });
  }
  w.cohort = { proposals: r.proposals, notes: r.notes, district_changes: r.district_changes, outside: r.outside_delivery, size: r.cohort_size, size_ok: r.size_ok, min: r.min_size };
  w.questions = r.questions;
  w.qsShown = true;
  const asset = c.asset || `${c.qual || 'Graduates'}, ${r.markets.join(' and ')}`;
  return save(id, w, { markets: r.markets, cohort_size: r.cohort_size.size, asset });
}

/** A5 — narratives. Requires step 0 complete (cohort sized, answers given). */
async function runNarratives(id, instruction) {
  const { c, w, course, cfg } = await ctx(id);
  if (!c.markets?.length || !c.budget || !c.start_date || !c.end_date) throw new HttpError(400, 'Complete objective, budget, districts and dates first');
  if (w.cohort && !w.cohort.size_ok) throw new HttpError(400, `Estimated cohort is below the minimum size of ${w.cohort.min}`);
  const objective = (cfg.lookups.objective || []).find((o) => o.code === c.objective);
  const themes = await db.query(`SELECT theme, COUNT(*) n FROM comments cm JOIN campaigns k ON k.id = cm.campaign_id WHERE k.course_id = ? GROUP BY theme ORDER BY n DESC`, [c.course_id]);
  const r = await ai.runAgent('a5', {
    campaign: repo.campaignDTO(c), course: repo.courseDTO(course), instruction,
    objective_narratives: objective?.meta?.narratives || [], narrative_classes: settings.codes(cfg.lookups, 'narrative_class'),
    evidence: { comment_themes: themes },
  }, { entityType: 'campaign', entityId: id });
  w.narrs = r.narratives;
  markDone(w, 0, 1);
  return save(id, w);
}

async function selectNarrative(id, narrId) {
  const { w } = await ctx(id);
  const n = (w.narrs || []).find((x) => x.id === narrId);
  if (!n) throw new HttpError(404, 'Narrative not found');
  if (n.held) throw new HttpError(422, 'This narrative asserts a claim without Observed evidence (RR-H03) and cannot be selected');
  w.narrs.forEach((x) => { x.role = x.id === narrId ? 'Primary' : x.role === 'Primary' ? 'Supporting' : x.role; });
  return save(id, w);
}

async function addOwnNarrative(id, { title, cls, hook }) {
  const { w } = await ctx(id);
  w.narrs = [{ id: uid('nx'), cls: cls || 'Career outcome', title, hook: hook || '', who: 'Manager-written', why: 'Added by you', risk: 'Low', tone: '', score: null, role: null, held: false }, ...(w.narrs || [])];
  return save(id, w);
}

/** A6 — channel plan. */
async function runChannels(id) {
  const { c, w, cfg } = await ctx(id);
  if (!(w.narrs || []).some((n) => n.role === 'Primary')) throw new HttpError(400, 'Select a narrative first');
  const r = await ai.runAgent('a6', { campaign: repo.campaignDTO(c), channel_priors: cfg.priors }, { entityType: 'campaign', entityId: id });
  w.channels = r.channels;
  markDone(w, 1, 2);
  return save(id, w);
}

async function updateChannels(id, channels) {
  const { w } = await ctx(id);
  w.channels = (w.channels || []).map((r) => {
    const u = channels.find((x) => x.name === r.name);
    return u && !r.locked ? { ...r, on: u.on ?? r.on, share: u.on === false ? 0 : u.share ?? r.share } : r;
  });
  return save(id, w);
}

/** A7 — rank sources on the chosen channels, with gates. */
async function runRank(id) {
  const { c, w, cfg, types, today, course } = await ctx(id);
  const total = (w.channels || []).filter((r) => r.on).reduce((a, r) => a + r.share, 0);
  if (total !== 100) throw new HttpError(400, `Channel shares must total 100% (currently ${total}%)`);
  const sources = await repo.loadSources();
  const platforms = settings.codes(cfg.lookups, 'platform');
  const chosen = (w.channels || []).filter((r) => r.on && platforms.includes(r.name)).map((r) => r.name);
  const objective = (cfg.lookups.objective || []).find((o) => o.code === c.objective);
  const primary = (w.narrs || []).find((n) => n.role === 'Primary');
  const dom = (course.form?.domain || '');
  const topics = [dom, 'Career guidance', 'Placements', ...(primary?.cls === 'Speed to employment' ? ['Interview prep'] : [])].filter(Boolean);
  const r = await ai.runAgent('a7', {
    campaign: repo.campaignDTO(c), sources: sources.map(repo.sourceDTO), today, channels: chosen,
    gates: cfg.settings.gates, weights: objective?.meta?.rank_weights, institutional_types: types.institutional,
    anchor_types: types.anchors, tier_median_er: types.tierMedianEr, topics,
    ...(w.answers?.q2 === 'Creators and alumni only' ? { channels: chosen } : {}),
  }, { entityType: 'campaign', entityId: id });
  if (w.answers?.q2 === 'Creators and alumni only') {
    r.ranked = r.ranked.filter((x) => !types.institutional.includes(x.type));
  }
  w.ranked = { list: r.ranked, blocked: r.blocked, portfolio: r.portfolio, stages: r.stages };
  w.shortlist = w.shortlist || [];
  markDone(w, 2, 3);
  return save(id, w);
}

async function buildPortfolio(id) {
  const { w } = await ctx(id);
  if (!w.ranked) throw new HttpError(400, 'Rank sources first');
  const primary = (w.narrs || []).find((n) => n.role === 'Primary');
  w.shortlist = w.ranked.portfolio.map((p) => ({ source_id: p.source_id, posts: p.posts, fee: p.fee, narrative_id: primary?.id, deal_type: p.fee ? 'Paid' : 'Partnership' }));
  return save(id, w);
}

/** Add / update / remove a shortlisted source. Institutional sources need consent (RR-H06). */
async function upsertShortlist(id, entry, user) {
  const { w, types } = await ctx(id);
  const src = await db.one('SELECT * FROM sources WHERE id = ?', [entry.source_id]);
  if (!src) throw new HttpError(404, 'Source not found');
  const blocked = (w.ranked?.blocked || []).find((b) => b.id === src.id);
  if (blocked && blocked.rule !== 'RR-H06') throw new HttpError(422, `${src.name} is not eligible: ${blocked.reason} (${blocked.rule})`);
  if (entry.remove) {
    w.shortlist = (w.shortlist || []).filter((x) => x.source_id !== src.id);
    return save(id, w);
  }
  if (types.institutional.includes(src.type) && entry.consent_basis && entry.consent_date) {
    await db.update('sources', { consent: 'Recorded', consent_basis: entry.consent_basis, consent_date: entry.consent_date }, 'id = ?', [src.id]);
    await db.insert('source_activity', { source_id: src.id, date: await settings.today(), text: `Institution consent recorded by ${user.name}: ${entry.consent_basis}` });
    entry.consent_ok = true;
  }
  const cur = (w.shortlist || []).find((x) => x.source_id === src.id);
  const primary = (w.narrs || []).find((n) => n.role === 'Primary');
  const next = { posts: 1, fee: src.rate, narrative_id: primary?.id, deal_type: src.rate ? 'Paid' : 'Partnership', ...cur, ...entry };
  delete next.remove;
  w.shortlist = cur ? w.shortlist.map((x) => (x.source_id === src.id ? next : x)) : [...(w.shortlist || []), next];
  return save(id, w);
}

/** A8 — content per shortlisted source (or one source with an instruction = rewrite). */
async function runContent(id, { source_id, instruction } = {}) {
  const { c, w, course } = await ctx(id);
  if (!(w.shortlist || []).length) throw new HttpError(400, 'Shortlist at least one source first');
  const reg = course.fields.find((f) => f.field_key === 'regLink')?.value;
  const targets = w.shortlist.filter((s) => !source_id || s.source_id === source_id);
  const srcs = await repo.loadSources(targets.map((t) => t.source_id));
  w.content = w.content || {};
  for (const sl of targets) {
    const s = srcs.find((x) => x.id === sl.source_id);
    const narr = (w.narrs || []).find((n) => n.id === sl.narrative_id) || (w.narrs || []).find((n) => n.role === 'Primary') || {};
    const r = await ai.runAgent('a8', {
      campaign: repo.campaignDTO(c), course: repo.courseDTO(course), source: repo.sourceDTO(s), narrative: narr,
      reg_link: reg, fee: sl.fee, posts: sl.posts, instruction,
    }, { entityType: 'campaign', entityId: id });
    w.content[sl.source_id] = { vars: r.variants, sel: r.variants.filter((v) => v.checks.claims !== 'Fail').slice(0, sl.posts).map((v) => v.id) };
  }
  markDone(w, 3, 4);
  return save(id, w);
}

async function selectContent(id, sourceId, sel) {
  const { w } = await ctx(id);
  const cur = w.content?.[sourceId];
  if (!cur) throw new HttpError(404, 'No content for that source yet');
  const posts = (w.shortlist.find((x) => x.source_id === sourceId) || {}).posts || 1;
  if (sel.length > posts) throw new HttpError(400, `Deal has ${posts} post${posts > 1 ? 's' : ''}; select up to that many`);
  cur.sel = sel;
  return save(id, w);
}

/** A9 + A10 — prediction and the 13 compliance & fairness checks. */
async function computeReview(id) {
  const { c, w, course, cfg, types } = await ctx(id);
  const srcs = await repo.loadSources((w.shortlist || []).map((s) => s.source_id));
  const shortlist = (w.shortlist || []).map((s) => ({ source_id: s.source_id, posts: Number(s.posts) || 1, fee: s.fee != null ? Number(s.fee) : null, consent_ok: s.consent_ok }));
  const pr = await ai.runAgent('a9', { campaign: repo.campaignDTO(c), shortlist, sources: srcs.map(repo.sourceDTO), funnel: cfg.settings.funnel_defaults, institutional_types: types.institutional, anchor_types: types.anchors }, { entityType: 'campaign', entityId: id });
  const selected = {};
  for (const [sid, v] of Object.entries(w.content || {})) selected[sid] = v.vars.filter((x) => v.sel.includes(x.id));
  const [{ used }] = await db.query("SELECT COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(hashtags,'$[0]'))) used FROM campaigns WHERE status = 'Live'");
  const ck = await ai.runAgent('a10', {
    campaign: { ...repo.campaignDTO(c), answers: w.answers }, course: repo.courseDTO(course), prediction: pr.prediction, shortlist,
    sources: srcs.map(repo.sourceDTO), channels: w.channels || [], content_selected: selected, narratives: w.narrs || [],
    institutional_types: types.institutional, min_cohort_size: cfg.settings.min_cohort_size, hashtag_budget: cfg.settings.hashtag_budget, hashtags_used_week: Number(used) || 0,
  }, { entityType: 'campaign', entityId: id });
  return { w, c, prediction: pr.prediction, rows: pr.rows, checks: ck };
}

async function review(id) {
  const r = await computeReview(id);
  r.w.review = { prediction: r.prediction, rows: r.rows, checks: r.checks };
  markDone(r.w, 4, 5);
  return save(id, r.w);
}

/** Create: freeze prediction v1 and materialise everything. */
async function create(id, user) {
  const r = await computeReview(id);
  if (!r.checks.can_create) throw new HttpError(422, 'Resolve failing checks to create', { checks: r.checks.checks });
  const { w, c } = r;
  const cfg = await settings.load();
  const today = await settings.today();
  const srcs = await repo.loadSources(w.shortlist.map((s) => s.source_id));
  const narrMap = {};
  await db.tx(async (q) => {
    for (const n of (w.narrs || []).filter((x) => x.role)) {
      const nid = uid('n');
      narrMap[n.id] = nid;
      await q('INSERT INTO campaign_narratives (id,campaign_id,cls,title,who,why,risk,tone,hook,score,role,held) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [nid, id, n.cls, n.title, n.who, n.why, n.risk, n.tone, n.hook, n.score, n.role, n.held ? 1 : 0]);
    }
    for (const ch of (w.channels || []).filter((x) => x.on)) {
      await q('INSERT INTO campaign_channels (campaign_id,name,role,share,reason,meas) VALUES (?,?,?,?,?,?)', [id, ch.name, ch.role, ch.share, ch.reason, ch.meas]);
    }
    for (const sl of w.shortlist) {
      const s = srcs.find((x) => x.id === sl.source_id);
      const row = r.rows.find((x) => x.source_id === s.id) || {};
      const ccId = uid('cc');
      const tag = `hq-${id}-${s.id}`;
      await q(`INSERT INTO campaign_sources (id,campaign_id,source_id,narrative_id,channel,status,deal_type,rate,posts,deliverables,deal_start,deal_end,terms,hashtag,tracking_tag,pred_views,pred_enrols)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [ccId, id, s.id, narrMap[sl.narrative_id] || Object.values(narrMap)[0] || null, s.platform, 'Identified', sl.deal_type || (sl.fee ? 'Paid' : 'Partnership'),
        sl.fee ?? s.rate, sl.posts, sl.deliverables || `${sl.posts} posts`, c.start_date, addDays(c.start_date, 7),
        [sl.payment, sl.notes].filter(Boolean).join(' · ') || null, sl.hashtag || (c.hashtags || [])[0] || null, tag,
        JSON.stringify(row.views || null), JSON.stringify(row.enrols || null)]);
      await q('INSERT INTO cc_log (cc_id,date,text) VALUES (?,?,?)', [ccId, today, 'Added to campaign (Identified)']);
      const sel = (w.content?.[s.id]?.vars || []).filter((v) => (w.content[s.id].sel || []).includes(v.id));
      let i = 0;
      for (const v of sel) {
        await q(`INSERT INTO content_items (id,cc_id,title,format,lang,hook,beats,caption,tags,cta,link,disclosure,status,due,checks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [uid('ci'), ccId, v.title, v.format, v.lang, v.hook, JSON.stringify(v.beats), v.caption, JSON.stringify(v.tags), v.cta, v.link, v.disclosure ? 1 : 0, 'Draft', addDays(c.start_date, 2 + i++ * 4), JSON.stringify(v.checks)]);
      }
    }
    for (const cp of cfg.settings.checkpoints || []) {
      await q('INSERT INTO checkpoints (campaign_id,label,date,verdict) VALUES (?,?,?,NULL)', [id, cp.label, cp.days == null ? c.end_date : addDays(c.start_date, cp.days)]);
    }
    await q('INSERT INTO plan_versions (campaign_id,v,date,by_user,note) VALUES (?,?,?,?,?)', [id, 1, today, user.name, 'Campaign created. Prediction frozen (v1).']);
    const pred = { ...r.prediction };
    w.step = 'created';
    await q("UPDATE campaigns SET status = 'Live', version = 1, pred_frozen = ?, wizard = ?, created_at = ? WHERE id = ?", [JSON.stringify(pred), JSON.stringify(w), today, id]);
    await q('INSERT INTO activity_log (course_id,campaign_id,ts,kind,text) VALUES (?,?,NOW(),?,?)', [c.course_id, id, 'deal', `${c.name} created by ${user.name}; prediction frozen at ${pred.enrols[0]}–${pred.enrols[1]} enrolments`]);
  });
  return repo.loadCampaign(id);
}

module.exports = { STEPS, get, createDraft, saveObjective, runCohort, runNarratives, selectNarrative, addOwnNarrative, runChannels, updateChannels, runRank, buildPortfolio, upsertShortlist, runContent, selectContent, review, create };
