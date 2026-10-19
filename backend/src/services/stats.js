/**
 * Campaign maths shared by API responses and agents (ported from the prototype).
 * All values here are Observed (sums of fetched / Resolence numbers).
 */
const { addDays, daysBetween } = require('../utils/helpers');

function sumPosts(ccs) {
  let v = 0, l = 0, c = 0, sh = 0, sv = 0, shA = false, pos = 0, neu = 0, neg = 0, cw = 0, intent = 0, posts = 0, clicks = 0, regs = 0, enrols = 0;
  for (const x of ccs) for (const p of x.posts || []) {
    v += p.views || 0; l += p.likes || 0; c += p.comments || 0;
    if (p.shares != null) { sh += p.shares; shA = true; }
    if (p.saves != null) sv += p.saves;
    if (p.sent_pos != null && p.comments) { pos += p.sent_pos * p.comments; neu += p.sent_neu * p.comments; neg += p.sent_neg * p.comments; cw += p.comments; }
    intent += p.intent || 0; clicks += p.clicks || 0; regs += p.regs || 0; enrols += p.enrols || 0; posts++;
  }
  return {
    views: v, reach: Math.round(v * 0.58), likes: l, comments: c, shares: sh, saves: sv, sharesAvail: shA, eng: l + c + sh,
    er: v ? ((l + c + sh) / v) * 100 : 0, pos: cw ? Math.round(pos / cw) : 0, neu: cw ? Math.round(neu / cw) : 0, neg: cw ? Math.round(neg / cw) : 0,
    intent, posts, clicks, regs, enrols, ctr: v ? (clicks / v) * 100 : 0, regRate: clicks ? (regs / clicks) * 100 : 0, enrolRate: regs ? (enrols / regs) * 100 : 0,
  };
}

// Convention: cc.posts = array of live posts, cc.deal_posts = posts agreed in the deal, cc.rate = fee per post.
const dealTotal = (x) => (x.rate || 0) * (x.deal_posts || 0);
const spentOf = (x, committed) => (committed.includes(x.status) ? (x.rate || 0) * Math.min((x.posts || []).length, x.deal_posts || 0) : 0);

function ccStats(x, committed) {
  const s = sumPosts([x]);
  s.total = dealTotal(x);
  s.spent = spentOf(x, committed);
  s.cpi = s.enrols ? s.spent / s.enrols : 0;
  return s;
}

function campStats(c, committed) {
  const s = sumPosts(c.ccs);
  let com = 0, spent = 0;
  for (const x of c.ccs) {
    if (committed.includes(x.status)) com += dealTotal(x);
    spent += spentOf(x, committed);
  }
  s.committed = com; s.spent = spent; s.remaining = (c.budget || 0) - com; s.unattributed = c.unattributed || 0;
  s.cpi = s.enrols ? spent / s.enrols : 0;
  s.live = c.ccs.filter((x) => x.status === 'Live' || x.status === 'Delivered').length;
  s.creators = c.ccs.length;
  return s;
}

/** Cumulative enrolment series + frozen prediction band, for the chart. */
function series(c, today) {
  const endRef = c.status === 'Closed' ? c.end_date : today;
  const total = Math.max(1, daysBetween(c.start_date, c.end_date));
  const days = Math.max(1, Math.min(daysBetween(c.start_date, endRef), total));
  const curve = (a) => (a < 0 ? 0 : 1 - Math.exp(-a / 3.5));
  const pts = [];
  for (let i = 0; i <= days; i++) {
    const day = addDays(c.start_date, i);
    let v = 0;
    for (const x of c.ccs) for (const p of x.posts || []) {
      const age = daysBetween(p.posted_on, day);
      const now = Math.max(0.5, daysBetween(p.posted_on, endRef));
      v += (p.enrols || 0) * Math.min(1, curve(age) / curve(now));
    }
    pts.push({ day, v: Math.round(v * 10) / 10 });
  }
  const pe = (c.pred_frozen && (c.pred_frozen.enrols || c.pred_frozen.views)) || [0, 0];
  const band = [];
  for (let i = 0; i <= total; i++) {
    const f = Math.pow(i / total, 0.8);
    band.push({ day: addDays(c.start_date, i), lo: Math.round(pe[0] * f), hi: Math.round(pe[1] * f) });
  }
  return { pts, band, total };
}

/** Course brief readiness: required fields confirmed, flags, registration link. */
function readiness(fields, flags) {
  const req = fields.filter((b) => b.tier === 'req');
  const ok = req.filter((b) => b.value && b.status === 'Confirmed');
  const strong = fields.filter((b) => b.tier === 'strong');
  const reg = fields.find((b) => b.field_key === 'regLink');
  return {
    req: req.length, total: req.length, ok: ok.length,
    missing: req.filter((b) => !b.value || b.status !== 'Confirmed').map((b) => ({ key: b.field_key, label: b.label })),
    strongOk: strong.filter((b) => b.value && b.status === 'Confirmed').length, strong: strong.length,
    pct: req.length ? Math.round((ok.length / req.length) * 100) : 0,
    refused: flags.some((x) => x.status === 'Refused'),
    noRegLink: !reg || !reg.value || reg.status !== 'Confirmed',
  };
}

module.exports = { sumPosts, campStats, ccStats, series, readiness, dealTotal };
