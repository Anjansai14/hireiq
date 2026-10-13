/**
 * DB-driven configuration: lookups, settings, channel priors, governance rules.
 * Cached for 30 s; every write through /api/settings invalidates the cache.
 */
const db = require('../db');

let cache = null;
let cachedAt = 0;

async function load() {
  if (cache && Date.now() - cachedAt < 30000) return cache;
  const [lk, st, pr, rules] = await Promise.all([
    db.query('SELECT category, code, label, meta FROM lookup_values WHERE active = 1 ORDER BY category, sort_order'),
    db.query('SELECT setting_key, setting_value FROM app_settings'),
    db.query('SELECT * FROM channel_priors'),
    db.query('SELECT * FROM governance_rules ORDER BY code'),
  ]);
  const lookups = {};
  for (const r of lk) (lookups[r.category] ||= []).push({ code: r.code, label: r.label, meta: r.meta });
  const settings = {};
  for (const r of st) settings[r.setting_key] = r.setting_value;
  const priors = { channels: {}, priors: {} };
  for (const r of pr) {
    priors.channels[r.channel] = { role: r.role, formats: r.formats, meas: Number(r.measurability), meas_label: r.meas_label, iti: Number(r.iti_behaviour) };
    (priors.priors[r.objective] ||= {})[r.channel] = Number(r.prior);
  }
  cache = { lookups, settings, priors, rules };
  cachedAt = Date.now();
  return cache;
}

const invalidate = () => { cache = null; };
const codes = (lookups, cat) => (lookups[cat] || []).map((x) => x.code);

async function today() {
  const { settings } = await load();
  return settings.demo_today || new Date().toISOString().slice(0, 10);
}

/** Helpers derived from lookup metadata (no hard-coded type lists in the app). */
async function typeSets() {
  const { lookups } = await load();
  const st = lookups.source_type || [];
  return {
    institutional: st.filter((t) => t.meta?.institutional).map((t) => t.code),
    anchors: st.filter((t) => t.meta?.anchor).map((t) => t.code),
    committed: (lookups.source_status || []).filter((s) => s.meta?.committed).map((s) => s.code),
    tierMedianEr: Object.fromEntries((lookups.tier || []).map((t) => [t.code, t.meta?.median_er])),
  };
}

module.exports = { load, invalidate, codes, today, typeSets };
