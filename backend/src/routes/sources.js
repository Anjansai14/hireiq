/** Creator Bank: influence sources (creators, college networks, placement cells, alumni, trainers, community leaders). */
const router = require('express').Router();
const multer = require('multer');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const config = require('../config');
const db = require('../db');
const repo = require('../services/repo');
const settings = require('../services/settings');
const ai = require('../services/ai');
const { ah, uid, HttpError } = require('../utils/helpers');

const upload = multer({ dest: config.uploadDir });

router.get('/', ah(async (req, res) => {
  const { q, platform, type, status, filter } = req.query;
  let rows = await repo.loadSources();
  const types = await settings.typeSets();
  const cfg = await settings.load();
  const today = await settings.today();
  if (q) rows = rows.filter((s) => (s.name + ' ' + s.handle).toLowerCase().includes(String(q).toLowerCase()));
  if (platform) rows = rows.filter((s) => s.platform === platform);
  if (type) rows = rows.filter((s) => s.type === type);
  if (status) rows = rows.filter((s) => s.status === status);
  if (filter === 'attention') rows = rows.filter((s) => ['Failed', 'Partial'].includes(s.status) || (types.institutional.includes(s.type) && s.consent !== 'Recorded'));
  // Gate preview (same rules as Agent A7) so the bank shows why a source is not bookable
  const r = await ai.runAgent('a7', { campaign: { markets: [], languages: [], budget: 0 }, sources: rows.map(repo.sourceDTO), today, gates: cfg.settings.gates, institutional_types: types.institutional, anchor_types: types.anchors, tier_median_er: types.tierMedianEr }, { log: false }).catch(() => ({ blocked: [] }));
  const gates = Object.fromEntries((r.blocked || []).map((b) => [b.id, { rule: b.rule, reason: b.reason }]));
  res.json(rows.map((s) => ({ ...s, gate: gates[s.id] || null, institutional: types.institutional.includes(s.type) })));
}));

router.get('/:id', ah(async (req, res) => res.json(await repo.loadSource(req.params.id))));

router.post('/', ah(async (req, res) => {
  const b = req.body;
  if (!b.name || !b.handle || !b.platform || !b.type) throw new HttpError(400, 'name, handle, platform and type are required');
  const id = uid('c');
  const types = await settings.typeSets();
  await db.insert('sources', {
    id, name: b.name, handle: b.handle, platform: b.platform, type: b.type, tier: b.tier || 'Micro', followers: +b.followers || 0,
    median_views: b.median_views || null, er: b.er || null, langs: b.langs || {}, markets: b.markets || {}, content_types: b.content_types || [],
    formats: b.formats || [], topics: b.topics || {}, rate: +b.rate || 0, rate_src: 'Illustrative', status: 'Queued', data_source: b.data_source || 'Uploaded',
    consent: types.institutional.includes(b.type) ? 'Missing' : 'Not required', affiliation: b.affiliation || null, catchment: b.catchment || null, contact: b.contact || {},
  });
  await db.insert('source_activity', { source_id: id, date: await settings.today(), text: `Added by ${req.user.name}` });
  res.status(201).json(await repo.loadSource(id));
}));

router.patch('/:id', ah(async (req, res) => {
  const allowed = ['name', 'handle', 'type', 'tier', 'rate', 'tone', 'affiliation', 'collab', 'account_type', 'cohort', 'contact', 'district'];
  const upd = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  await db.update('sources', upd, 'id = ?', [req.params.id]);
  res.json(await repo.loadSource(req.params.id));
}));

/** RR-H06 — record institutional consent. */
router.post('/:id/consent', ah(async (req, res) => {
  const { basis, date } = req.body;
  if (!basis || !date) throw new HttpError(400, 'Consent basis and date are required');
  await db.update('sources', { consent: 'Recorded', consent_basis: basis, consent_date: date }, 'id = ?', [req.params.id]);
  await db.insert('source_activity', { source_id: req.params.id, date: await settings.today(), text: `Institution consent recorded by ${req.user.name}: ${basis}` });
  res.json(await repo.loadSource(req.params.id));
}));

/** Agent A3 — refresh one source from official APIs. */
async function refresh(id) {
  const [s] = await repo.loadSources([id]);
  if (!s) throw new HttpError(404, 'Source not found');
  const cfg = await settings.load();
  const types = await settings.typeSets();
  const today = await settings.today();
  const r = await ai.runAgent('a3', { source: repo.sourceDTO(s), tiers: cfg.lookups.tier, institutional_types: types.institutional, today }, { entityType: 'source', entityId: id });
  const upd = { status: r.status, status_note: r.note || null, updated_on: today };
  if (r.updates.followers != null) upd.followers = r.updates.followers;
  if (r.updates.tier) upd.tier = r.updates.tier;
  if (r.updates.tone) upd.tone = r.updates.tone;
  if (r.updates.content_types) upd.content_types = r.updates.content_types;
  await db.update('sources', upd, 'id = ?', [id]);
  await db.insert('source_activity', { source_id: id, date: today, text: r.activity });
  return r;
}
router.post('/:id/refresh', ah(async (req, res) => { await refresh(req.params.id); res.json(await repo.loadSource(req.params.id)); }));
router.post('/refresh-failed', ah(async (req, res) => {
  const ids = (await db.query("SELECT id FROM sources WHERE status IN ('Failed','Partial')")).map((r) => r.id);
  const results = [];
  for (const id of ids) results.push({ id, ...(await refresh(id)) });
  res.json({ refreshed: results.length, results });
}));

/**
 * CSV import. Columns: name,handle,platform,type,followers,median_views,er,rate,district,language,affiliation,catchment
 * Matches existing sources by handle (merge) — otherwise creates new ones queued for enrichment.
 */
router.post('/import', upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Attach a CSV file');
  const rows = parse(fs.readFileSync(req.file.path, 'utf8'), { columns: true, skip_empty_lines: true, trim: true });
  const types = await settings.typeSets();
  const today = await settings.today();
  let created = 0, merged = 0;
  const errors = [];
  for (const [i, r] of rows.entries()) {
    if (!r.name || !r.handle || !r.platform || !r.type) { errors.push({ row: i + 2, error: 'name, handle, platform, type required' }); continue; }
    const ex = await db.one('SELECT id FROM sources WHERE handle = ?', [r.handle]);
    const vals = { followers: +r.followers || 0, median_views: +r.median_views || null, er: +r.er || null, rate: +r.rate || 0, catchment: +r.catchment || null };
    if (ex) { await db.update('sources', vals, 'id = ?', [ex.id]); merged++; continue; }
    const id = uid('c');
    await db.insert('sources', {
      id, name: r.name, handle: r.handle, platform: r.platform, type: r.type, tier: 'Micro', ...vals,
      langs: r.language ? { [r.language]: 100 } : {}, markets: r.district ? { [r.district]: 100 } : {}, content_types: [], formats: [], topics: {},
      status: 'Queued', data_source: 'Uploaded', affiliation: r.affiliation || null, district: r.district || null,
      consent: types.institutional.includes(r.type) ? 'Missing' : 'Not required', updated_on: today,
    });
    await db.insert('source_activity', { source_id: id, date: today, text: `Imported from ${req.file.originalname} by ${req.user.name}` });
    created++;
  }
  res.json({ created, merged, errors });
}));

module.exports = router;
module.exports.refresh = refresh;
