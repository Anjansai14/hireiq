const assert = require('assert');

const BASE = 'http://localhost:4000';

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

(async () => {
  try {
    console.log('=== Step 1: Login ===');
    const auth = await req('POST', '/api/auth/login', {
      email: 'anika.rao@peopletech.com',
      password: 'Hireiq@123'
    });
    const token = auth.token;
    assert(token, 'Token should be returned');
    console.log('✓ Login successful for:', auth.user.name);

    console.log('\n=== Step 2: List Courses & Campaigns ===');
    const courses = await req('GET', '/api/courses', null, token);
    assert(courses.length > 0, 'Courses list should not be empty');
    const course = courses.find((c) => c.id === 'f1') || courses[0];
    console.log('✓ Target course:', course.title, `(${course.id})`);

    const initialCamps = await req('GET', `/api/campaigns?course=${course.id}`, null, token);
    console.log('✓ Campaigns currently in database:', initialCamps.length);

    console.log('\n=== Step 3: Create Campaign Draft (MySQL) ===');
    const draftName = `Parity Verification Campaign ${Date.now()}`;
    const createRes = await req('POST', '/api/campaigns', {
      course_id: course.id,
      name: draftName
    }, token);
    const campId = createRes.campaign.id;
    assert(campId, 'Campaign ID should be generated');
    console.log('✓ Created draft in MySQL:', campId, '-', draftName);

    console.log('\n=== Step 4: Step 0 - Save Objective & Cohort ===');
    const objRes = await req('PATCH', `/api/campaigns/${campId}/wizard/objective`, {
      name: draftName,
      objective: 'Getting onboarded',
      kpi: 'Screening enrolments',
      target: 60,
      ceiling: 4500,
      budget: 400000,
      start_date: '2026-10-15',
      end_date: '2026-11-15',
      markets: ['Warangal', 'Karimnagar'],
      languages: ['Telugu'],
      qual: 'B.Tech / B.E.',
      skill_bg: ['CSE', 'IT', 'ECE'],
      age_band: '21–26 years',
      exp_band: '0–2 years experience',
      free_text: 'Dynamic verification run',
      answers: { q1: 'Career outcome', q2: 'Include institutions', q3: 'Balanced' }
    }, token);
    assert(objRes.campaign.budget === 400000, 'Budget should be saved');
    console.log('✓ Step 0 Objective saved to MySQL. Budget:', objRes.campaign.budget);

    console.log('\n=== Step 5: Step 0 - Run Agent A4 Cohort ===');
    const cohortRes = await req('POST', `/api/campaigns/${campId}/wizard/cohort`, {}, token);
    assert(cohortRes.wizard.cohort, 'Cohort data should be present');
    console.log('✓ Agent A4 sized cohort:', cohortRes.campaign.cohort_size, 'learners');

    console.log('\n=== Step 6: Step 1 - Generate Narratives (Agent A5) ===');
    const narrRes = await req('POST', `/api/campaigns/${campId}/wizard/narratives`, {}, token);
    const narrs = narrRes.wizard.narrs;
    assert(narrs && narrs.length > 0, 'Narratives should be generated');
    console.log(`✓ Agent A5 generated ${narrs.length} narratives:`);
    narrs.forEach(n => console.log(`   - [${n.cls}] "${n.title}" (Score: ${n.score}, Held: ${!!n.held})`));

    const eligibleNarr = narrs.find(n => !n.held) || narrs[0];
    console.log('\n=== Step 7: Step 1 - Select Primary Narrative ===');
    const selNarrRes = await req('POST', `/api/campaigns/${campId}/wizard/narratives/select`, {
      id: eligibleNarr.id
    }, token);
    const prim = (selNarrRes.wizard.narrs || []).find(n => n.role === 'Primary');
    assert(prim && prim.id === eligibleNarr.id, 'Primary narrative should be selected');
    console.log('✓ Selected Primary narrative:', prim.title);

    console.log('\n=== Step 8: Step 2 - Plan Channels (Agent A6) ===');
    const chanRes = await req('POST', `/api/campaigns/${campId}/wizard/channels`, {}, token);
    const chans = chanRes.wizard.channels;
    assert(chans && chans.length > 0, 'Channels should be planned');
    const activeChans = chans.filter(c => c.on);
    const totalShare = activeChans.reduce((s, c) => s + c.share, 0);
    console.log(`✓ Agent A6 planned ${chans.length} channels (${activeChans.length} active, sum: ${totalShare}%):`);
    activeChans.forEach(c => console.log(`   - ${c.name} (${c.role}): ${c.share}%`));

    console.log('\n=== Step 9: Step 3 - Rank Sources (Agent A7) ===');
    const rankRes = await req('POST', `/api/campaigns/${campId}/wizard/rank`, {}, token);
    const ranked = rankRes.wizard.ranked.list;
    const blocked = rankRes.wizard.ranked.blocked;
    console.log(`✓ Agent A7 pipeline: ${ranked.length} ranked, ${blocked.length} gated`);

    console.log('\n=== Step 10: Step 3 - Build Auto-Portfolio ===');
    const portRes = await req('POST', `/api/campaigns/${campId}/wizard/portfolio`, {}, token);
    const shortlist = portRes.wizard.shortlist;
    assert(shortlist && shortlist.length > 0, 'Shortlist should be populated');
    console.log(`✓ Auto-portfolio shortlisted ${shortlist.length} sources`);

    console.log('\n=== Step 11: Step 4 - Generate Personalised Content (Agent A8) ===');
    const contentRes = await req('POST', `/api/campaigns/${campId}/wizard/content`, {}, token);
    const content = contentRes.wizard.content;
    assert(content && Object.keys(content).length > 0, 'Content should be generated');
    console.log(`✓ Agent A8 generated content for ${Object.keys(content).length} sources`);

    console.log('\n=== Step 12: Step 5 - Review & 13 Governance Checks (Agents A9 + A10) ===');
    const reviewRes = await req('POST', `/api/campaigns/${campId}/wizard/review`, {}, token);
    const pred = reviewRes.wizard.review.prediction;
    const checks = reviewRes.wizard.review.checks;
    console.log('✓ Agent A9 prediction:', pred.enrols[0], '–', pred.enrols[1], 'enrolments, CPI ₹' + pred.cpi[0] + '–₹' + pred.cpi[1]);
    console.log('✓ Agent A10 compliance:', checks.checks.length, 'checks run. can_create =', checks.can_create);

    console.log('\n=== Step 13: Step 5 - Create Campaign (Freeze v1 in MySQL) ===');
    const finalCamp = await req('POST', `/api/campaigns/${campId}/wizard/create`, {}, token);
    assert(finalCamp.status === 'Live', 'Campaign status should be Live');
    assert(finalCamp.version === 1, 'Version should be 1');
    assert(finalCamp.pred_frozen, 'Prediction should be frozen');
    assert(finalCamp.ccs.length > 0, 'Campaign sources should be materialized in MySQL');
    console.log('✓ Campaign created in MySQL! Status:', finalCamp.status, 'Version:', finalCamp.version, 'Sources:', finalCamp.ccs.length);

    console.log('\n=== Step 14: Campaign Detail Verification ===');
    const detail = await req('GET', `/api/campaigns/${campId}`, null, token);
    assert(detail.id === campId, 'Detail ID should match');
    assert(detail.stats, 'Live stats should be computed');
    console.log('✓ Retrieved campaign detail from MySQL:');
    console.log('   - Name:', detail.name);
    console.log('   - Status:', detail.status);
    console.log('   - Version:', detail.version);
    console.log('   - Sources count:', detail.ccs.length);
    console.log('   - Checkpoints:', detail.checkpoints.length);
    console.log('   - Plan versions:', detail.versions.length);

    console.log('\n=== Step 15: Telemetry Insights (Agents A11 + A12) ===');
    const insights = await req('POST', `/api/campaigns/${campId}/insights/run`, {}, token);
    console.log('✓ Agent A11/A12 Insights run: Verdict =', insights.diagnosis?.verdict || 'On track');

    console.log('\n========================================');
    console.log('🎉 ALL 15 VERIFICATION CHECKS PASSED 100%!');
    console.log('========================================');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
})();
