const router = require('express').Router();
const db = require('../db');
const wiz = require('../services/wizardService');
const svc = require('../services/campaignService');
const { ah, HttpError } = require('../utils/helpers');

// ---- list / create / read / delete ------------------------------------
router.get('/', ah(async (req, res) => {
  if (!req.query.course) throw new HttpError(400, 'course query parameter is required');
  res.json(await svc.listCampaigns(req.query.course));
}));
router.post('/', ah(async (req, res) => res.status(201).json(await wiz.createDraft(req.body.course_id, req.body.name, req.user))));
router.get('/:id', ah(async (req, res) => res.json(await svc.getCampaign(req.params.id))));
router.delete('/:id', ah(async (req, res) => {
  const c = await db.one('SELECT status FROM campaigns WHERE id = ?', [req.params.id]);
  if (!c) throw new HttpError(404, 'Campaign not found');
  if (c.status !== 'Draft') throw new HttpError(409, 'Only drafts can be deleted');
  await db.query('DELETE FROM campaigns WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

// ---- wizard (draft) ----------------------------------------------------
router.get('/:id/wizard', ah(async (req, res) => res.json(await wiz.get(req.params.id))));
router.patch('/:id/wizard/objective', ah(async (req, res) => res.json(await wiz.saveObjective(req.params.id, req.body))));
router.post('/:id/wizard/cohort', ah(async (req, res) => res.json(await wiz.runCohort(req.params.id, req.user))));             // A4
router.post('/:id/wizard/narratives', ah(async (req, res) => res.json(await wiz.runNarratives(req.params.id, req.body.instruction)))); // A5
router.post('/:id/wizard/narratives/select', ah(async (req, res) => res.json(await wiz.selectNarrative(req.params.id, req.body.id))));
router.post('/:id/wizard/narratives/own', ah(async (req, res) => res.json(await wiz.addOwnNarrative(req.params.id, req.body))));
router.post('/:id/wizard/channels', ah(async (req, res) => res.json(await wiz.runChannels(req.params.id))));                  // A6
router.patch('/:id/wizard/channels', ah(async (req, res) => res.json(await wiz.updateChannels(req.params.id, req.body.channels || []))));
router.post('/:id/wizard/rank', ah(async (req, res) => res.json(await wiz.runRank(req.params.id))));                          // A7
router.post('/:id/wizard/portfolio', ah(async (req, res) => res.json(await wiz.buildPortfolio(req.params.id))));
router.post('/:id/wizard/shortlist', ah(async (req, res) => res.json(await wiz.upsertShortlist(req.params.id, req.body, req.user))));
router.post('/:id/wizard/content', ah(async (req, res) => res.json(await wiz.runContent(req.params.id, req.body))));          // A8
router.post('/:id/wizard/content/select', ah(async (req, res) => res.json(await wiz.selectContent(req.params.id, req.body.source_id, req.body.sel || []))));
router.post('/:id/wizard/review', ah(async (req, res) => res.json(await wiz.review(req.params.id))));                         // A9 + A10
router.post('/:id/wizard/create', ah(async (req, res) => res.json(await wiz.create(req.params.id, req.user))));

// ---- live operations -----------------------------------------------------
router.post('/:id/sources', ah(async (req, res) => {
  await svc.addSource(req.params.id, req.body.source_id, req.body.narrative_id);
  res.status(201).json(await svc.getCampaign(req.params.id));
}));
router.patch('/:id/sources/:ccId/status', ah(async (req, res) => {
  await svc.setStatus(req.params.id, req.params.ccId, req.body.status, req.body.reason);
  res.json(await svc.getCampaign(req.params.id));
}));
router.patch('/:id/sources/:ccId/deal', ah(async (req, res) => {
  await svc.updateDeal(req.params.id, req.params.ccId, req.body);
  res.json(await svc.getCampaign(req.params.id));
}));
router.patch('/:id/sources/:ccId/content/:ciId', ah(async (req, res) => {
  await svc.setContentStatus(req.params.ccId, req.params.ciId, req.body.status);
  res.json(await svc.getCampaign(req.params.id));
}));
router.post('/:id/sources/:ccId/posts', ah(async (req, res) => {
  await svc.addPost(req.params.id, req.params.ccId, req.body);
  res.status(201).json(await svc.getCampaign(req.params.id));
}));
router.post('/:id/comments', ah(async (req, res) => {
  for (const c of req.body.comments || []) await db.insert('comments', { campaign_id: req.params.id, source_id: c.source_id || null, text: c.text });
  res.status(201).json({ ok: true });
}));
router.post('/:id/insights/run', ah(async (req, res) => res.json(await svc.runInsights(req.params.id))));                  // A11 + A12
router.post('/:id/moves/:mid/:decision(accept|dismiss)', ah(async (req, res) => {
  await svc.decideMove(req.params.id, req.params.mid, req.params.decision, req.user);
  res.json(await svc.getCampaign(req.params.id));
}));
router.post('/:id/alerts/:aid/dismiss', ah(async (req, res) => {
  await db.update('campaign_alerts', { dismissed: 1 }, 'id = ? AND campaign_id = ?', [req.params.aid, req.params.id]);
  res.json({ ok: true });
}));
router.post('/:id/close', ah(async (req, res) => res.json(await svc.closeCampaign(req.params.id, req.body.lessons, req.user))));

/** Export the plan (frozen prediction, sources, deals, content) as JSON or CSV. */
router.get('/:id/export', ah(async (req, res) => {
  const c = await svc.getCampaign(req.params.id);
  if (req.query.format === 'csv') {
    const head = 'source,platform,status,deal_type,fee_per_post,posts,views,clicks,registrations,enrolments,tracking_tag';
    const lines = c.ccs.map((x) => [x.name, x.platform, x.status, x.deal_type, x.rate, x.deal_posts, x.stats.views, x.stats.clicks, x.stats.regs, x.stats.enrols, x.tracking_tag].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${c.id}-plan-v${c.version}.csv"`);
    return res.send([head, ...lines].join('\n'));
  }
  res.json({ id: c.id, name: c.name, version: c.version, prediction_frozen: c.pred_frozen, stats: c.stats, channels: c.channels, narratives: c.narratives, sources: c.ccs.map((x) => ({ name: x.name, status: x.status, deal: { type: x.deal_type, rate: x.rate, posts: x.deal_posts }, stats: x.stats, content: x.content })) });
}));

module.exports = router;
