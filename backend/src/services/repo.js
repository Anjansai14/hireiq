/**
 * Read models: load full course / campaign / source aggregates from MySQL and
 * map them into the DTO shapes the AI agents expect.
 */
const db = require('../db');
const settings = require('./settings');
const stats = require('./stats');
const { HttpError } = require('../utils/helpers');

// ----------------------------------------------------------------- sources
async function loadSources(ids = null) {
  const where = ids ? `WHERE id IN (${ids.map(() => '?').join(',') || "''"})` : '';
  const rows = await db.query(`SELECT * FROM sources ${where} ORDER BY name`, ids || []);
  if (!rows.length) return [];
  const sids = rows.map((r) => r.id);
  const ph = sids.map(() => '?').join(',');
  const [hist, recent] = await Promise.all([
    db.query(`SELECT * FROM source_history WHERE source_id IN (${ph}) ORDER BY date`, sids),
    db.query(`SELECT * FROM source_recent_posts WHERE source_id IN (${ph}) ORDER BY date DESC`, sids),
  ]);
  return rows.map((s) => ({
    ...s,
    history: hist.filter((h) => h.source_id === s.id),
    recent: recent.filter((r) => r.source_id === s.id),
  }));
}

async function loadSource(id) {
  const [s] = await loadSources([id]);
  if (!s) throw new HttpError(404, 'Source not found');
  const [snapshots, activity, bookings] = await Promise.all([
    db.query('SELECT month, followers FROM source_snapshots WHERE source_id = ?', [id]),
    db.query('SELECT date, text FROM source_activity WHERE source_id = ? ORDER BY date DESC', [id]),
    db.query(`SELECT cs.id, cs.status, cs.rate, cs.deal_posts, c.id AS campaign_id, c.name AS campaign, c.status AS campaign_status
              FROM (SELECT id, status, rate, posts AS deal_posts, campaign_id FROM campaign_sources WHERE source_id = ?) cs
              JOIN campaigns c ON c.id = cs.campaign_id`, [id]),
  ]);
  return { ...s, snapshots, activity, bookings };
}

// ----------------------------------------------------------------- courses
async function loadCourse(id) {
  const c = await db.one('SELECT * FROM courses WHERE id = ?', [id]);
  if (!c) throw new HttpError(404, 'Course not found');
  const [fields, claims, flags, reads, watch, activity, files] = await Promise.all([
    db.query('SELECT * FROM brief_fields WHERE course_id = ? ORDER BY sort_order', [id]),
    db.query('SELECT * FROM course_claims WHERE course_id = ?', [id]),
    db.query('SELECT * FROM governance_flags WHERE course_id = ?', [id]),
    db.query('SELECT * FROM course_reads WHERE course_id = ? ORDER BY FIELD(read_key, "public","audience","risk")', [id]),
    db.query('SELECT * FROM watch_handles WHERE course_id = ?', [id]),
    db.query('SELECT * FROM activity_log WHERE course_id = ? ORDER BY ts DESC LIMIT 30', [id]),
    db.query('SELECT * FROM files WHERE course_id = ? ORDER BY date DESC', [id]),
  ]);
  return { ...c, fields, claims, flags, reads, watch, activity, files, readiness: stats.readiness(fields, flags) };
}

// --------------------------------------------------------------- campaigns
async function loadCampaign(id) {
  const c = await db.one('SELECT * FROM campaigns WHERE id = ?', [id]);
  if (!c) throw new HttpError(404, 'Campaign not found');
  const [narratives, channels, ccRows, comments, checkpoints, alerts, moves, versions] = await Promise.all([
    db.query('SELECT * FROM campaign_narratives WHERE campaign_id = ? ORDER BY role = "Primary" DESC, score DESC', [id]),
    db.query('SELECT * FROM campaign_channels WHERE campaign_id = ? ORDER BY share DESC', [id]),
    db.query(`SELECT cs.*, s.name, s.handle, s.platform, s.type, s.tier, s.followers, s.markets, s.consent, s.langs
              FROM campaign_sources cs JOIN sources s ON s.id = cs.source_id WHERE cs.campaign_id = ?`, [id]),
    db.query('SELECT * FROM comments WHERE campaign_id = ?', [id]),
    db.query('SELECT * FROM checkpoints WHERE campaign_id = ? ORDER BY date', [id]),
    db.query('SELECT * FROM campaign_alerts WHERE campaign_id = ? AND dismissed = 0', [id]),
    db.query('SELECT * FROM moves WHERE campaign_id = ?', [id]),
    db.query('SELECT * FROM plan_versions WHERE campaign_id = ? ORDER BY id', [id]),
  ]);
  const ccIds = ccRows.map((x) => x.id);
  const ph = ccIds.map(() => '?').join(',') || "''";
  const [posts, content, logs] = ccIds.length ? await Promise.all([
    db.query(`SELECT * FROM posts WHERE cc_id IN (${ph}) ORDER BY posted_on`, ccIds),
    db.query(`SELECT * FROM content_items WHERE cc_id IN (${ph}) ORDER BY due`, ccIds),
    db.query(`SELECT * FROM cc_log WHERE cc_id IN (${ph}) ORDER BY id`, ccIds),
  ]) : [[], [], []];
  const ccs = ccRows.map(({ posts: dealPosts, ...x }) => ({
    ...x, deal_posts: dealPosts,
    posts: posts.filter((p) => p.cc_id === x.id),
    content: content.filter((p) => p.cc_id === x.id),
    log: logs.filter((p) => p.cc_id === x.id),
  }));
  return { ...c, narratives, channels, ccs, comments, checkpoints, alerts, moves, versions };
}

async function withStats(c) {
  const { committed } = await settings.typeSets();
  const st = stats.campStats(c, committed);
  c.ccs.forEach((x) => { x.stats = stats.ccStats(x, committed); });
  return st;
}

// ------------------------------------------------------------ agent DTOs
const sourceDTO = (s) => ({
  id: s.id, name: s.name, handle: s.handle, platform: s.platform, type: s.type, tier: s.tier, followers: s.followers,
  median_views: s.median_views, er: s.er, langs: s.langs, markets: s.markets, topics: s.topics, formats: s.formats,
  content_types: s.content_types, tone: s.tone, rate: s.rate, rate_src: s.rate_src, verif: s.verif, consent: s.consent,
  catchment: s.catchment, attributed: s.attributed, last_post: s.last_post, updated_on: s.updated_on,
  affiliation: s.affiliation, data_source: s.data_source,
  history: (s.history || []).map((h) => ({ status: h.status, enrols: h.enrols, course: h.course, date: h.date })),
  recent: (s.recent || []).map((r) => ({ title: r.title })),
});

const courseDTO = (c) => ({
  id: c.id, title: c.title, batch: c.batch, ceiling: c.ceiling, form: c.form,
  claims: c.claims.map((q) => ({ text: q.text, status: q.status })),
  flags: c.flags.map((f) => ({ type: f.type, status: f.status })), readiness: c.readiness,
});

const campaignDTO = (c) => ({
  id: c.id, name: c.name, objective: c.objective, kpi: c.kpi, target: c.target, ceiling: c.ceiling,
  markets: c.markets || [], languages: c.languages || [], budget: c.budget, qual: c.qual, skill_bg: c.skill_bg,
  age_band: c.age_band, exp_band: c.exp_band, start: c.start_date, end: c.end_date, status: c.status,
  cohort: c.cohort, cohort_size: c.cohort_size, free_text: c.free_text, hashtags: c.hashtags || [],
  answers: (c.wizard && c.wizard.answers) || {}, pred: c.pred_frozen,
});

module.exports = { loadSources, loadSource, loadCourse, loadCampaign, withStats, sourceDTO, courseDTO, campaignDTO };
