/** Lookups, settings (connectors, rate card, config admin), files, metrics ingestion, copilot, agents. */
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const config = require('../config');
const db = require('../db');
const settings = require('../services/settings');
const ai = require('../services/ai');
const copilot = require('../services/copilotService');
const campaigns = require('../services/campaignService');
const { requireRole } = require('../middleware/auth');
const { ah, uid, encrypt, HttpError } = require('../utils/helpers');

const upload = multer({ dest: config.uploadDir, limits: { fileSize: 50 * 1024 * 1024 } });

// ---------------------------------------------------------------- lookups
const lookups = express.Router();
lookups.get('/', ah(async (req, res) => {
  const { lookups: lk, settings: st, priors, rules } = await settings.load();
  res.json({ lookups: lk, settings: st, channelPriors: priors, rules, today: await settings.today() });
}));
lookups.post('/:category', requireRole('Admin'), ah(async (req, res) => {
  const { code, label, meta, sort_order } = req.body;
  await db.insert('lookup_values', { category: req.params.category, code, label: label || code, meta: meta || null, sort_order: sort_order || 99 });
  settings.invalidate();
  res.status(201).json({ ok: true });
}));
lookups.delete('/:category/:code', requireRole('Admin'), ah(async (req, res) => {
  await db.update('lookup_values', { active: 0 }, 'category = ? AND code = ?', [req.params.category, req.params.code]);
  settings.invalidate();
  res.status(204).end();
}));
lookups.put('/settings/:key', requireRole('Admin'), ah(async (req, res) => {
  await db.update('app_settings', { setting_value: JSON.stringify(req.body.value) }, 'setting_key = ?', [req.params.key]);
  settings.invalidate();
  res.json({ ok: true });
}));

// --------------------------------------------------------------- settings
const set = express.Router();
set.get('/connectors', ah(async (req, res) => res.json(await db.query('SELECT id,name,kind,status,detail,last_sync,quota FROM connectors'))));
set.post('/connectors/:id/connect', requireRole('Admin', 'Manager'), ah(async (req, res) => {
  const upd = { status: 'Connected', last_sync: new Date() };
  if (req.body.token) upd.secret_enc = encrypt(req.body.token); // encrypted at rest
  await db.update('connectors', upd, 'id = ?', [req.params.id]);
  res.json({ ok: true });
}));
set.post('/connectors/:id/disconnect', requireRole('Admin'), ah(async (req, res) => {
  await db.update('connectors', { status: 'Disconnected', secret_enc: null }, 'id = ?', [req.params.id]);
  res.json({ ok: true });
}));
set.post('/connectors/:id/test', ah(async (req, res) => {
  const c = await db.one('SELECT * FROM connectors WHERE id = ?', [req.params.id]);
  res.json({ ok: c && ['Connected', 'Expiring'].includes(c.status), status: c?.status });
}));
set.get('/ratecard', ah(async (req, res) => {
  const tiers = await db.query('SELECT * FROM rate_tiers ORDER BY sort_order');
  const obs = await db.query('SELECT ro.*, s.name source FROM rate_observations ro LEFT JOIN sources s ON s.id = ro.source_id ORDER BY date DESC LIMIT 50');
  res.json({ tiers, observations: obs, rule: (await settings.load()).settings.observed_tier_rule });
}));
set.patch('/ratecard/:id', requireRole('Admin', 'Manager'), ah(async (req, res) => {
  const t = await db.one('SELECT prov FROM rate_tiers WHERE id = ?', [req.params.id]);
  if (t?.prov === 'Observed') throw new HttpError(409, 'Observed tiers learn from real deals and cannot be edited');
  await db.update('rate_tiers', { lo: req.body.lo, hi: req.body.hi }, 'id = ?', [req.params.id]);
  res.json({ ok: true });
}));
set.get('/team', ah(async (req, res) => res.json(await db.query('SELECT id,name,email,role,title FROM users'))));
set.get('/escalations', requireRole('Admin', 'Fairness reviewer'), ah(async (req, res) => res.json(await db.query('SELECT * FROM fairness_escalations ORDER BY created_at DESC'))));
set.patch('/escalations/:id', requireRole('Admin', 'Fairness reviewer'), ah(async (req, res) => {
  await db.update('fairness_escalations', { status: req.body.status, reviewer: req.user.name }, 'id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ files
const files = express.Router();
files.get('/', ah(async (req, res) => res.json(await db.query('SELECT * FROM files WHERE course_id = ? ORDER BY date DESC', [req.query.course]))));
files.post('/', upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Attach a file');
  const id = uid('fl');
  await db.insert('files', { id, course_id: req.body.course_id, name: req.file.originalname, size_label: `${Math.max(1, Math.round(req.file.size / 1024))} KB`, lane: req.body.lane || 'Brand assets', date: await settings.today(), by_user: req.user.name, status: 'Stored', storage_path: req.file.path });
  res.status(201).json(await db.one('SELECT * FROM files WHERE id = ?', [id]));
}));
files.get('/:id/download', ah(async (req, res) => {
  const f = await db.one('SELECT * FROM files WHERE id = ?', [req.params.id]);
  if (!f?.storage_path || !fs.existsSync(f.storage_path)) throw new HttpError(404, 'File content not stored (seeded or generated record)');
  res.download(path.resolve(f.storage_path), f.name);
}));
files.delete('/:id', ah(async (req, res) => { await db.query('DELETE FROM files WHERE id = ?', [req.params.id]); res.status(204).end(); }));

// ---------------------------------------------------------------- metrics
const metrics = express.Router();
/** Resolence counts per tracking tag. JSON {rows:[{tracking_tag,date,clicks,regs,enrols}]} or CSV upload (same columns). */
metrics.post('/resolence', upload.single('file'), ah(async (req, res) => {
  let rows = req.body.rows;
  let name = 'api';
  if (req.file) {
    rows = parse(fs.readFileSync(req.file.path, 'utf8'), { columns: true, skip_empty_lines: true, trim: true });
    name = req.file.originalname;
    await db.insert('files', { id: uid('fl'), course_id: req.body.course_id || null, name, size_label: `${Math.round(req.file.size / 1024)} KB`, lane: 'Metrics exports', date: await settings.today(), by_user: req.user.name, status: 'Imported', storage_path: req.file.path });
  }
  if (!Array.isArray(rows)) throw new HttpError(400, 'Provide rows or a CSV file');
  res.json(await campaigns.ingestResolence(rows, name));
}));

// ---------------------------------------------------------------- copilot
const cop = express.Router();
cop.get('/threads', ah(async (req, res) => res.json(await copilot.listThreads(req.query.course))));
cop.post('/threads', ah(async (req, res) => res.status(201).json(await copilot.createThread(req.body, req.user))));
cop.get('/threads/:id', ah(async (req, res) => res.json(await copilot.getThread(req.params.id))));
cop.post('/threads/:id/messages', ah(async (req, res) => {
  if (!req.body.text) throw new HttpError(400, 'Message text is required');
  res.json(await copilot.send(req.params.id, req.body.text, req.user));
}));
cop.post('/messages/:mid/:decision(accept|discard)', ah(async (req, res) => res.json(await copilot.decideProposal(req.params.mid, req.params.decision, req.user))));

// ----------------------------------------------------------------- agents
const agents = express.Router();
agents.get('/', ah(async (req, res) => {
  const h = await ai.health();
  const list = await fetch(`${config.ai.url}/v1/agents`, { headers: { 'X-Service-Key': config.ai.key } }).then((r) => r.json()).catch(() => []);
  res.json({ health: h, agents: list });
}));
agents.get('/runs', ah(async (req, res) => res.json(await db.query('SELECT id, agent, entity_type, entity_id, status, duration_ms, llm_used, created_at FROM agent_runs ORDER BY id DESC LIMIT 100'))));

module.exports = { lookups, settings: set, files, metrics, copilot: cop, agents };
