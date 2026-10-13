/**
 * Seed Hire IQ:  node scripts/seed.js
 *  1. Runs database/schema.sql (drops & recreates all tables)
 *  2. Loads configuration (lookups, channel priors, governance rules, settings)
 *  3. Loads the prototype data set (courses, Creator Bank, campaigns, posts ...)
 * Default password for every seeded user: Hireiq@123
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../src/config');

const ROOT = path.resolve(__dirname, '../../database');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed/config_seed.json'), 'utf8'));
const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed/prototype_seed.json'), 'utf8'));

let n = 0;
const id = (p) => `${p}${(++n).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const J = (v) => (v === undefined ? null : JSON.stringify(v));
const D = (s) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
const DT = (s) => (s ? s.replace('T', ' ').slice(0, 16) + ':00' : null);

async function main() {
  const conn = await mysql.createConnection({ ...config.db, database: undefined, multipleStatements: true });
  console.log('→ schema');
  await conn.query(fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8'));
  await conn.query(`USE \`${config.db.database}\``);
  const ins = async (table, obj) => {
    const k = Object.keys(obj);
    await conn.query(`INSERT INTO ${table} (${k.map((x) => '`' + x + '`').join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map((x) => obj[x]));
  };

  console.log('→ configuration');
  for (const [cat, items] of Object.entries(CFG.lookups)) {
    let i = 0;
    for (const it of items) {
      const o = typeof it === 'string' ? { code: it } : it;
      await ins('lookup_values', { category: cat, code: o.code, label: o.label || o.code, sort_order: i++, meta: J(o.meta || null) });
    }
  }
  for (const [obj, row] of Object.entries(CFG.channel_priors.priors)) {
    for (const [ch, prior] of Object.entries(row)) {
      const m = CFG.channel_priors.channels[ch];
      await ins('channel_priors', { objective: obj, channel: ch, prior, measurability: m.meas, meas_label: m.meas_label, role: m.role, formats: m.formats, iti_behaviour: m.iti });
    }
  }
  for (const r of CFG.governance_rules) await ins('governance_rules', r);
  for (const [k, v] of Object.entries(CFG.settings)) await ins('app_settings', { setting_key: k, setting_value: J(v.value), description: v.description });

  console.log('→ users');
  const hash = await bcrypt.hash('Hireiq@123', 10);
  let ui = 0;
  for (const t of P.team) await ins('users', { id: `u${++ui}`, name: t.name, email: t.email, password_hash: hash, role: t.role, title: t.title });

  console.log('→ courses');
  for (const f of P.courses) {
    const { src, ...form } = f.form;
    await ins('courses', { id: f.id, title: f.title, batch: f.batch, language: f.language, batch_start: D(f.release), provider: f.studio, target: f.target || null, ceiling: f.ceiling || null, form: J(form), form_src: J(src || {}), created_by: 'u1' });
    let so = 0;
    for (const b of f.brief) await ins('brief_fields', { course_id: f.id, field_key: b.key, label: b.label, tier: b.tier, value: b.value || null, source: b.source || null, status: b.status || 'Missing', updated_at: D(b.date), sort_order: so++ });
    for (const c of f.claims) await ins('course_claims', { id: id('cl'), course_id: f.id, text: c.text, source: c.src, status: c.status });
    for (const g of f.flags) await ins('governance_flags', { id: id('gf'), course_id: f.id, type: g.type, status: g.status, note: g.note });
    for (const r of f.reads) await ins('course_reads', { id: id('rd'), course_id: f.id, read_key: r.key, title: r.title, status: r.status, stale_note: r.staleNote || null, read_date: D(r.date), items: J(r.items) });
    for (const w of f.watch) await ins('watch_handles', { id: w.id + f.id, course_id: f.id, handle: w.handle, platform: w.platform, kind: w.kind, state: w.state });
    for (const a of f.activity) await ins('activity_log', { course_id: f.id, ts: DT(a.t), kind: a.kind, text: a.text });
  }

  console.log('→ Creator Bank');
  for (const c of P.creators) {
    await ins('sources', {
      id: c.id, name: c.name, handle: c.handle, platform: c.platform, type: c.type, tier: c.tier, followers: c.followers,
      median_views: c.mv, er: c.er, langs: J(c.langs), markets: J(c.markets), content_types: J(c.content), tone: c.tone,
      formats: J(c.formats), topics: J(c.topics), rate: c.rate, rate_src: c.rateSrc, verif: c.verif, acct: c.acct,
      status: c.status, status_note: c.partialNote || c.failNote || null, updated_on: D(c.updated), next_refresh: c.next,
      last_post: D(c.lastPost), data_source: c.source, connected: c.connected ? 1 : 0, affiliation: c.affiliation || null,
      consent: c.consent, consent_date: D(c.consentDate), consent_basis: c.consentBasis || null, catchment: c.catchment,
      district: c.district, cohort: c.cohort || null, skills: J(c.skills), attributed: c.attributed || 0, growth: c.growth,
      contact: J(c.contact),
    });
    for (const h of c.history) await ins('source_history', { source_id: c.id, course: h.film, campaign: h.campaign, date: h.date, status: h.status, fee: h.fee ?? null, rating: h.rating ?? null, views: h.views ?? null, enrols: h.enrols ?? null, note: h.note || null });
    for (const r of c.recent) await ins('source_recent_posts', { source_id: c.id, title: r.title, date: D(r.date), views: r.views, clicks: r.clicks, format: r.format, er: r.er });
    for (const s of c.snapshots) await ins('source_snapshots', { source_id: c.id, month: s.m, followers: s.f });
    for (const a of c.activity) await ins('source_activity', { source_id: c.id, date: D(a.date) || '2026-07-04', text: a.text });
  }

  console.log('→ campaigns');
  for (const k of P.campaigns) {
    const band = (k.band || '').split(' · ');
    const skill = Array.isArray(k.skillBg) ? k.skillBg : (k.skillBg || '').split(',').map((s) => s.trim()).filter(Boolean);
    await ins('campaigns', {
      id: k.id, course_id: k.filmId, name: k.name, asset: k.asset, cohort: k.cohort || null, qual: k.qual, skill_bg: J(skill),
      age_band: k.ageBand || band[0] || null, exp_band: k.expBand || band[1] || null, objective: k.objective, kpi: k.kpi,
      target: k.target, ceiling: k.ceiling, markets: J(k.markets), languages: J(k.languages), start_date: D(k.start), end_date: D(k.end),
      budget: k.budget, status: k.status, version: k.version, owner: k.owner, hashtags: J(k.hashtags || []), free_text: k.freeText || null,
      unattributed: k.unattributed || 0, cohort_size: k.status === 'Draft' ? null : 3200, pred_frozen: J(k.pred || null), band_now: J(k.bandNow || null),
      diagnosis: J(k.diagnosis || null), lessons: J(k.lessons || null), wizard: J(k.wiz || null), created_at: D(k.created),
    });
    for (const nr of k.narratives) await ins('campaign_narratives', { id: nr.id, campaign_id: k.id, cls: nr.cls, title: nr.title, who: nr.who, why: nr.why, risk: nr.risk, tone: nr.tone, hook: nr.hook, score: nr.score, role: nr.role, held: (nr.risk || '').startsWith('High') ? 1 : 0 });
    for (const ch of k.channels) await ins('campaign_channels', { campaign_id: k.id, name: ch.name, role: ch.role, share: ch.share, reason: ch.reason, meas: ch.meas });
    for (const x of k.ccs) {
      const d = x.deal || {};
      await ins('campaign_sources', {
        id: x.id, campaign_id: k.id, source_id: x.creatorId, narrative_id: x.narrative, channel: x.channel, status: x.status,
        deal_type: d.type || null, rate: d.rate ?? null, posts: d.posts ?? null, deliverables: d.del || null, deal_start: D(d.start), deal_end: D(d.end),
        terms: d.terms || null, hashtag: (k.hashtags || [])[0] || null, tracking_tag: `hq-${k.id}-${x.creatorId}`,
        pred_views: J(x.predViews), pred_enrols: J(x.predEnrols), late: x.late ? 1 : 0, reason: x.reason || null, rating: x.rating || null,
      });
      for (const l of x.log) await ins('cc_log', { cc_id: x.id, date: D(l.date), text: l.text });
      for (const ci of x.content) await ins('content_items', { id: ci.id, cc_id: x.id, title: ci.title, format: ci.format, lang: ci.lang, hook: ci.hook, beats: J(ci.beats), caption: ci.caption, tags: J(ci.tags), cta: ci.cta, link: ci.link, disclosure: ci.disclosure ? 1 : 0, status: ci.status, due: D(ci.due), checks: J(ci.checks) });
      for (const p of x.posts) {
        await ins('posts', {
          id: p.id, cc_id: x.id, title: p.title, format: p.format, url: p.url, posted_on: D(p.date), views: p.views, likes: p.likes, comments: p.comments,
          shares: p.shares, saves: p.saves, sent_pos: p.sent ? p.sent[0] : null, sent_neu: p.sent ? p.sent[1] : null, sent_neg: p.sent ? p.sent[2] : null,
          intent: p.intent || 0, clicks: p.clicks || 0, regs: p.regs || 0, enrols: p.enrols || 0, manual: p.manual ? 1 : 0, last_fetch: DT(p.lastFetch), fetch_status: p.fetch || 'OK',
        });
      }
    }
    for (const cm of k.comments) await ins('comments', { campaign_id: k.id, source_id: cm.cr, text: cm.text, lang: cm.lang, translation: cm.tr || null, sentiment: cm.sent, theme: cm.theme, intent: cm.intent ? 1 : 0 });
    for (const cp of k.checkpoints) await ins('checkpoints', { campaign_id: k.id, label: cp.label, date: cp.date, verdict: cp.verdict, note: cp.note || null });
    for (const a of k.alerts) await ins('campaign_alerts', { campaign_id: k.id, kind: a.kind, rule_code: a.rule, text: a.text, level: a.level });
    for (const m of k.moves) await ins('moves', { id: m.id, campaign_id: k.id, type: m.type, title: m.title, impact: m.impact, cost: m.cost, cost_label: m.costLabel, why: m.why, status: m.status });
    for (const v of k.versions) await ins('plan_versions', { campaign_id: k.id, v: v.v, date: v.date, by_user: v.by, note: v.note });
  }

  console.log('→ files, rate card, connectors, copilot');
  for (const f of P.files) await ins('files', { id: f.id, course_id: f.filmId, name: f.name, size_label: f.size, lane: f.lane, date: f.date, by_user: f.by, status: f.status, prompt: f.prompt || null });
  let ti = 0;
  for (const t of P.rateTiers) await ins('rate_tiers', { id: t.id, tier: t.tier, range_label: t.range, lo: t.lo, hi: t.hi, prov: t.prov, bookings: t.bookings, courses: t.films, sort_order: ti++ });
  for (const r of P.rateObs) await ins('rate_observations', { date: r.date, source_id: r.creator, course: r.film, rate: r.rate, posts: r.posts, tier: r.tier });
  for (const c of P.connectors) await ins('connectors', { id: c.id, name: c.name, kind: c.kind, status: c.status, detail: c.detail, last_sync: DT(c.last), quota: c.quota ?? null });
  for (const t of P.threads) {
    const camp = P.campaigns.find((k) => k.name === t.scope);
    await ins('copilot_threads', { id: t.id, course_id: 'f1', user_id: 'u1', title: t.title, scope: t.scope, scope_type: camp ? 'campaign' : 'course', scope_id: camp ? camp.id : 'f1', date: t.date });
    for (const m of t.messages) await ins('copilot_messages', { thread_id: t.id, role: m.role, text: m.text, sources: J(m.sources || null) });
  }
  await conn.end();
  console.log('✓ Seed complete. Sign in as anika.rao@peopletech.com / Hireiq@123');
}

main().catch((e) => { console.error(e); process.exit(1); });
