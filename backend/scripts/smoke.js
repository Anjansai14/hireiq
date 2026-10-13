/**
 * End-to-end smoke test against a running API (npm run seed first).
 *   node scripts/smoke.js [http://localhost:4000]
 * Walks the full product flow: login → course brief (A1, A2) → 6-step wizard
 * (A4–A10) → live ops → insights (A11, A12) → moves → Copilot → Resolence → close.
 */
const BASE = process.argv[2] || 'http://localhost:4000';
let token = '';
let pass = 0;
const fails = [];

async function call(method, url, body, expectFail) {
  const r = await fetch(BASE + url, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok && !expectFail) throw new Error(`${method} ${url} → ${r.status} ${j.error || ''}`);
  return expectFail ? { status: r.status, ...j } : j;
}
async function step(name, fn) {
  try { const out = await fn(); pass++; console.log('✓', name, out ? `— ${out}` : ''); } catch (e) { fails.push(name); console.log('✗', name, '—', e.message); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

(async () => {
  await step('login', async () => { const r = await call('POST', '/api/auth/login', { email: 'anika.rao@peopletech.com', password: 'Hireiq@123' }); token = r.token; return r.user.name; });
  await step('lookups from DB', async () => { const r = await call('GET', '/api/lookups'); assert(r.lookups.district.length && r.rules.length, 'empty'); return `${Object.keys(r.lookups).length} categories, today ${r.today}`; });
  await step('course dashboard', async () => { const r = await call('GET', '/api/courses/f1/dashboard'); return `${r.campaigns.length} campaigns, ${r.kpis[0].v} enrolments`; });
  await step('alerts', async () => { const r = await call('GET', '/api/courses/f1/alerts'); return `${r.alerts.length} alerts`; });

  let cid;
  await step('create course', async () => { const r = await call('POST', '/api/courses', { title: 'Smoke Test Course ' + Date.now(), link: 'nexaskills.org/x', language: 'Telugu', batch_start: '2027-02-01' }); cid = r.id; return `${r.readiness.ok}/${r.readiness.req} ready`; });
  await step('A1 extract sample brochure', async () => { const r = await call('POST', `/api/courses/${cid}/extract`, { sample: true }); assert(r.extracted.claims.length, 'claim not held'); return `${Object.keys(r.extracted.values).length} fields, ${r.extracted.claims.length} claim held`; });
  await step('RR-H02 eligibility screen', async () => { const r = await call('PATCH', `/api/courses/${cid}/form`, { values: { eligibility: 'Women only, ITI pass' } }); assert(r.flags.some((f) => f.status === 'Refused'), 'not refused'); await call('PATCH', `/api/courses/${cid}/form`, { values: { eligibility: 'ITI or diploma, passed 2021-2026' } }); return 'refused then cleared'; });
  await step('confirm all + A2 reads', async () => { await call('POST', `/api/courses/${cid}/confirm`, {}); const r = await call('POST', `/api/courses/${cid}/reads/run`); return `${r.reads.filter((x) => x.status === 'Ready').length} reads ready`; });

  // Wizard on the seeded course f1 (brief is ready)
  let k;
  await step('create draft', async () => { const r = await call('POST', '/api/campaigns', { course_id: 'f1', name: 'Smoke: Karimnagar graduates' }); k = r.campaign.id; return k; });
  await step('step 0 objective', async () => {
    await call('PATCH', `/api/campaigns/${k}/wizard/objective`, { objective: 'Getting onboarded', kpi: 'Screening enrolments', target: 80, ceiling: 4500, budget: 500000, markets: ['karimnagar', 'Warangal'], languages: ['Telugu', 'English'], qual: 'B.Tech / B.E.', age_band: '21–26 years', exp_band: '0–2 years experience', start_date: '2026-10-10', end_date: '2026-11-10', hashtags: ['#AppliedAIBatch4'], answers: { q1: 'Career outcome', q2: 'Include partner institutions', q3: 'No' } });
    const r = await call('POST', `/api/campaigns/${k}/wizard/cohort`); return `markets ${r.campaign.markets.join('+')}, size ${r.campaign.cohort_size}`;
  });
  await step('RR-H02 cohort refusal', async () => {
    await call('PATCH', `/api/campaigns/${k}/wizard/objective`, { free_text: 'exclude muslim students' });
    const r = await call('POST', `/api/campaigns/${k}/wizard/cohort`, null, true); assert(r.status === 422 && r.rule === 'RR-H02', 'not refused');
    await call('PATCH', `/api/campaigns/${k}/wizard/objective`, { free_text: 'Lead with alumni' }); await call('POST', `/api/campaigns/${k}/wizard/cohort`); return 'refused + escalated';
  });
  await step('A5 narratives', async () => { const r = await call('POST', `/api/campaigns/${k}/wizard/narratives`, {}); const p = r.wizard.narrs.find((n) => n.role === 'Primary'); return `${r.wizard.narrs.length} narratives, primary "${p.title}"`; });
  await step('A6 channels', async () => { const r = await call('POST', `/api/campaigns/${k}/wizard/channels`); return r.wizard.channels.map((c) => `${c.name} ${c.share}%`).join(', '); });
  await step('A7 rank + gates', async () => { const r = await call('POST', `/api/campaigns/${k}/wizard/rank`); return `${r.wizard.ranked.list.length} ranked, ${r.wizard.ranked.blocked.length} blocked (${r.wizard.ranked.blocked.map((b) => b.rule).join(', ')})`; });
  await step('build portfolio', async () => { const r = await call('POST', `/api/campaigns/${k}/wizard/portfolio`); return `${r.wizard.shortlist.length} sources shortlisted`; });
  await step('A8 content', async () => { const r = await call('POST', `/api/campaigns/${k}/wizard/content`, {}); return `${Object.values(r.wizard.content).reduce((a, v) => a + v.vars.length, 0)} variants`; });
  await step('A9 + A10 review', async () => { const r = await call('POST', `/api/campaigns/${k}/wizard/review`); const ck = r.wizard.review.checks; return `pred ${r.wizard.review.prediction.enrols.join('–')} enrolments · ${ck.summary}`; });
  await step('create campaign (freeze v1)', async () => { const r = await call('POST', `/api/campaigns/${k}/wizard/create`); assert(r.status === 'Live' && r.pred_frozen, 'not live'); return `Live, ${r.ccs.length} sources, ${r.checkpoints.length} checkpoints`; });

  await step('RR-H06 consent gate', async () => {
    const c = await call('GET', `/api/campaigns/${k}`);
    const src = await call('GET', '/api/sources?q=SNIST');
    await call('POST', `/api/campaigns/${k}/sources`, { source_id: src[0].id });
    const c2 = await call('GET', `/api/campaigns/${k}`); const cc = c2.ccs.find((x) => x.source_id === src[0].id);
    const r = await call('PATCH', `/api/campaigns/${k}/sources/${cc.id}/status`, { status: 'Confirmed' }, true);
    assert(r.status === 422 && r.rule === 'RR-H06', 'consent not enforced'); return `blocked (had ${c.ccs.length} sources)`;
  });
  await step('confirm → post → live', async () => {
    const c = await call('GET', `/api/campaigns/${k}`); const cc = c.ccs.find((x) => x.status === 'Identified' && x.consent !== 'Missing');
    await call('PATCH', `/api/campaigns/${k}/sources/${cc.id}/status`, { status: 'Confirmed' });
    const r = await call('POST', `/api/campaigns/${k}/sources/${cc.id}/posts`, { title: 'Smoke post', url: 'https://example.com/p', posted_on: '2026-10-11' });
    return r.ccs.find((x) => x.id === cc.id).status;
  });
  await step('Resolence ingest + attribution', async () => {
    const c = await call('GET', `/api/campaigns/${k}`); const cc = c.ccs.find((x) => x.posts.length);
    const r = await call('POST', '/api/metrics/resolence', { rows: [{ tracking_tag: `${cc.tracking_tag}-1`, date: '2026-10-12', clicks: 900, regs: 120, enrols: 14 }] });
    const c2 = await call('GET', `/api/campaigns/${k}`); return `${r.rows} rows → ${c2.stats.enrols} enrolments attributed`;
  });

  await step('A11 + A12 insights on k1', async () => { const r = await call('POST', '/api/campaigns/k1/insights/run'); return `${r.diagnosis.verdict}: ${r.diagnosis.gap.slice(0, 70)}… · ${r.moves.filter((m) => m.status === 'Open').length} moves`; });
  await step('accept move → plan v+1', async () => { const c = await call('GET', '/api/campaigns/k1'); const m = c.moves.find((x) => x.status === 'Open'); const r = await call('POST', `/api/campaigns/k1/moves/${m.id}/accept`); return `v${r.version}`; });

  await step('Copilot diagnose + proposal', async () => {
    const t = await call('POST', '/api/copilot/threads', { course_id: 'f1', scope_type: 'campaign', scope_id: 'k1' });
    const r = await call('POST', `/api/copilot/threads/${t.id}/messages`, { text: 'Why is this campaign behind?' });
    const ai = r.messages[r.messages.length - 1]; return `${ai.text.slice(0, 60)}… proposal=${!!ai.proposal}`;
  });
  await step('Copilot RR-H01 refusal', async () => {
    const t = await call('POST', '/api/copilot/threads', { course_id: 'f1', scope_type: 'course', scope_id: 'f1' });
    const r = await call('POST', `/api/copilot/threads/${t.id}/messages`, { text: 'Message this student roll no 21 directly' });
    assert(/RR-H01/.test(r.messages[1].text), 'not refused'); return 'refused';
  });
  await step('Creator Bank + A3 refresh', async () => { const s = await call('GET', '/api/sources'); const r = await call('POST', '/api/sources/c13/refresh'); return `${s.length} sources, ${s.filter((x) => x.gate).length} gated · c13 ${r.status}`; });
  await step('settings', async () => { const c = await call('GET', '/api/settings/connectors'); const rc = await call('GET', '/api/settings/ratecard'); return `${c.length} connectors, ${rc.tiers.length} tiers`; });
  await step('close campaign k2', async () => { const r = await call('POST', '/api/campaigns/k2/close', { lessons: ['Repeat campus sessions'] }); return `${r.status} · ${r.diagnosis.verdict}`; });
  await step('agent runs logged', async () => { const r = await call('GET', '/api/agents/runs'); return `${r.length} runs: ${[...new Set(r.map((x) => x.agent))].sort().join(' ')}`; });

  console.log(`\n${pass} passed, ${fails.length} failed${fails.length ? ': ' + fails.join(', ') : ''}`);
  process.exit(fails.length ? 1 : 0);
})();
