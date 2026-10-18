const router = require('express').Router();
const multer = require('multer');
const config = require('../config');
const db = require('../db');
const repo = require('../services/repo');
const svc = require('../services/courseService');
const campaigns = require('../services/campaignService');
const alerts = require('../services/alerts');
const settings = require('../services/settings');
const fs = require('fs');
const path = require('path');
const { requireRole } = require('../middleware/auth');
const { ah, uid, HttpError } = require('../utils/helpers');

const upload = multer({ dest: config.uploadDir, limits: { fileSize: 25 * 1024 * 1024 } });

router.get('/', ah(async (req, res) => {
  const rows = await db.query('SELECT id FROM courses ORDER BY batch_start');
  const out = [];
  for (const { id } of rows) {
    const c = await repo.loadCourse(id);
    out.push({ id: c.id, title: c.title, batch: c.batch, batch_start: c.batch_start, provider: c.provider, readiness: c.readiness });
  }
  res.json(out);
}));

router.post('/', ah(async (req, res) => res.status(201).json(await svc.createCourse(req.body, req.user))));
router.get('/:id', ah(async (req, res) => res.json(await repo.loadCourse(req.params.id))));
router.patch('/:id/form', ah(async (req, res) => res.json(await svc.updateForm(req.params.id, req.body.values || {}, req.user))));
router.post('/:id/confirm', ah(async (req, res) => res.json(await svc.confirm(req.params.id, req.body.keys, req.user))));
router.patch('/:id/context', ah(async (req, res) => {
  await db.update('courses', { context: req.body.context || '' }, 'id = ?', [req.params.id]);
  res.json(await repo.loadCourse(req.params.id));
}));

/** Agent A1 — upload a brochure/syllabus, or {sample:true}, or {text}, or {url}. */
router.post('/:id/extract', upload.single('file'), ah(async (req, res) => {
  res.json(await svc.extract(req.params.id, { file: req.file, sample: req.body.sample === 'true' || req.body.sample === true, text: req.body.text, url: req.body.url, filename: req.body.filename }, req.user));
}));

/** Agent A2 — refresh programme reads. */
router.post('/:id/reads/run', ah(async (req, res) => res.json(await svc.runReads(req.params.id))));

/** RR-H03 — attach Observed evidence to a claim. */
router.post('/:id/claims/:cid/evidence', upload.single('file'), ah(async (req, res) => {
  const fid = uid('fl');
  await db.insert('files', { id: fid, course_id: req.params.id, name: req.file?.originalname || 'evidence', size_label: req.file ? `${Math.round(req.file.size / 1024)} KB` : null, lane: 'Brief material', date: await settings.today(), by_user: req.user.name, status: 'Stored', storage_path: req.file?.path || null });
  await db.update('course_claims', { status: 'Evidenced', evidence_file_id: fid }, 'id = ? AND course_id = ?', [req.params.cid, req.params.id]);
  const left = await db.one("SELECT COUNT(*) n FROM course_claims WHERE course_id = ? AND status = 'Awaiting evidence'", [req.params.id]);
  if (!left.n) await svc.setFlag(req.params.id, 'Outcome claims', 'Cleared', 'All outcome claims have Observed evidence attached.');
  res.json(await repo.loadCourse(req.params.id));
}));

/** Store a course document in the Files tab without running A1 extraction */
router.post('/:id/files', upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Attach a file to upload');
  const result = await svc.addFile(req.params.id, { file: req.file, lane: req.body.lane }, req.user);
  res.status(201).json(result);
}));

router.delete('/:id/files/:fid', ah(async (req, res) => {
  const file = await db.one('SELECT * FROM files WHERE id = ? AND course_id = ?', [req.params.fid, req.params.id]);
  if (!file) throw new HttpError(404, 'File not found for this course');

  // Verify file is not linked as evidence for any outcome claim
  const claim = await db.one('SELECT id, text FROM course_claims WHERE course_id = ? AND evidence_file_id = ?', [req.params.id, req.params.fid]);
  if (claim) {
    throw new HttpError(400, `Cannot delete file: referenced as evidence for outcome claim "${claim.text}"`);
  }

  await db.query('DELETE FROM files WHERE id = ? AND course_id = ?', [req.params.fid, req.params.id]);

  // Clean up physical file on disk if no other database record references it
  if (file.storage_path) {
    const other = await db.one('SELECT id FROM files WHERE storage_path = ? AND id != ?', [file.storage_path, req.params.fid]);
    if (!other && fs.existsSync(file.storage_path)) {
      try { fs.unlinkSync(file.storage_path); } catch { /* ignore disk cleanup failure */ }
    }
  }

  res.json(await repo.loadCourse(req.params.id));
}));

router.patch('/:id/flags/:fid', requireRole('Admin', 'Fairness reviewer'), ah(async (req, res) => {
  await db.update('governance_flags', { status: req.body.status, note: req.body.note }, 'id = ? AND course_id = ?', [req.params.fid, req.params.id]);
  res.json(await repo.loadCourse(req.params.id));
}));

router.get('/:id/alerts', ah(async (req, res) => res.json(await alerts.courseAlerts(req.params.id))));

/** Course dashboard: KPIs, funnel, campaigns at a glance, what the cohort is saying. */
router.get('/:id/dashboard', ah(async (req, res) => {
  const course = await repo.loadCourse(req.params.id);
  const list = await campaigns.listCampaigns(req.params.id);
  const live = list.filter((c) => c.status !== 'Draft');
  const totals = { clicks: 0, regs: 0, enrols: 0, spent: 0, committed: 0 };
  for (const c of live) {
    const full = await campaigns.getCampaign(c.id);
    totals.clicks += full.stats.clicks; totals.regs += full.stats.regs; totals.enrols += full.stats.enrols; totals.spent += full.stats.spent; totals.committed += full.stats.committed;
    c.summary = full.summary;
  }
  const target = course.target || Number(course.form?.target) || 0;
  res.json({
    course: { id: course.id, title: course.title, batch: course.batch, batch_start: course.batch_start, provider: course.provider, readiness: course.readiness, reads: course.reads, activity: course.activity, watch: course.watch },
    kpis: [
      { l: 'Screening enrolments', v: totals.enrols, sub: target ? `of ${target} target` : 'no target set', stamp: 'Observed' },
      { l: 'Registrations', v: totals.regs, sub: `${totals.clicks.toLocaleString('en-IN')} tracked clicks`, stamp: 'Observed' },
      { l: 'Cost per enrolment', v: totals.enrols ? Math.round(totals.spent / totals.enrols) : null, sub: course.ceiling ? `ceiling ₹${course.ceiling.toLocaleString('en-IN')}` : '', stamp: 'Observed' },
      { l: 'Committed spend', v: totals.committed, sub: course.form?.budget ? `of ₹${course.form.budget}` : '', stamp: 'Observed' },
    ],
    funnel: [
      { l: 'Tracked clicks', v: totals.clicks },
      { l: 'Registrations', v: totals.regs, rate: totals.clicks ? (totals.regs / totals.clicks) * 100 : 0 },
      { l: 'Screening enrolments', v: totals.enrols, rate: totals.regs ? (totals.enrols / totals.regs) * 100 : 0 },
    ],
    campaigns: list,
    talk: live.find((c) => c.summary)?.summary || null,
  });
}));

module.exports = router;
