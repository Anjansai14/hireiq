/** "Needs attention" list for a course (bell menu + dashboard), each with a link target. */
const db = require('../db');
const settings = require('./settings');
const repo = require('./repo');
const { daysBetween, fmtDate } = require('../utils/helpers');

async function courseAlerts(courseId) {
  const course = await repo.loadCourse(courseId);
  const today = await settings.today();
  const { settings: cfg } = await settings.load();
  const out = [];
  const rd = course.readiness;
  if (rd.missing.length) out.push({ level: 'danger', title: `${course.title} brief is missing ${rd.missing.length} required field${rd.missing.length > 1 ? 's' : ''}`, sub: rd.missing.map((m) => m.label).join(', '), link: { page: 'brief', id: courseId } });
  course.flags.filter((f) => f.status === 'Refused').forEach((f) => out.push({ level: 'danger', title: `${f.type} flag is Refused`, sub: 'Create campaign is blocked until it is resolved', link: { page: 'brief', id: courseId, tab: 'governance' } }));

  const camps = await db.query("SELECT id FROM campaigns WHERE course_id = ? AND status = 'Live'", [courseId]);
  for (const { id } of camps) {
    const c = await repo.loadCampaign(id);
    const cp = c.checkpoints.filter((k) => k.verdict).slice(-1)[0];
    if (cp && cp.verdict === 'Behind') out.push({ level: 'danger', title: `${c.name} is Behind`, sub: `${cp.label} checkpoint · ${cp.note}`, link: { page: 'campaign', id, tab: 'insights' } });
    c.alerts.filter((a) => a.rule_code === 'RR-H05').forEach(() => out.push({ level: 'warning', title: 'Enrolment rate below floor', sub: `${c.name} · message and programme mismatch (RR-H05)`, link: { page: 'campaign', id, tab: 'insights' } }));
    c.ccs.filter((x) => (x.late || (x.deal_end && x.deal_end < today)) && !x.posts.length && ['Confirmed', 'Content in review'].includes(x.status))
      .forEach((x) => out.push({ level: 'warning', title: `${x.name} is past the post date`, sub: `${c.name} · due ${fmtDate(x.deal_end)}`, link: { page: 'influencer', campaignId: id, ccId: x.id } }));
  }
  const expDays = cfg.token_expiry_alert_days || 7;
  const conns = await db.query('SELECT * FROM connectors');
  conns.filter((c) => c.status === 'Expiring').forEach((c) => out.push({ level: 'warning', title: `${c.name} token is expiring`, sub: c.detail, link: { page: 'settings', tab: 'connectors' } }));
  const res = conns.find((c) => c.id === 'res');
  if (res && (res.status !== 'Connected' || daysBetween(String(res.last_sync).slice(0, 10), today) > 1)) out.push({ level: 'warning', title: 'Resolence feed is stale', sub: 'Registrations and enrolments may be out of date', link: { page: 'settings', tab: 'connectors' } });
  const [{ n }] = await db.query("SELECT COUNT(*) AS n FROM sources WHERE status IN ('Failed','Partial')");
  if (n) out.push({ level: 'warning', title: `${n} source profiles need a refresh`, sub: 'Failed or partial enrichment in the Creator Bank', link: { page: 'creators', filter: 'attention' } });
  return { alerts: out, expDays };
}

module.exports = { courseAlerts };
