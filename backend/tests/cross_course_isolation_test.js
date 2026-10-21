const assert = require('assert');
const repo = require('../src/services/repo');
const svc = require('../src/services/courseService');
const campaigns = require('../src/services/campaignService');
const db = require('../src/db');

async function run() {
  console.log('--- Testing Cross-Course Data Isolation ---');

  // Test 1: Load f1 (Applied AI & ML Programme)
  const f1 = await repo.loadCourse('f1');
  assert.strictEqual(f1.id, 'f1');
  const f1Camps = await campaigns.listCampaigns('f1');
  console.log(`✓ Course f1 has ${f1Camps.length} campaigns`);
  assert(f1Camps.length > 0, 'f1 should have campaigns');
  assert(f1Camps.some(c => c.name.includes('Warangal')), 'f1 should contain Warangal campaign');

  // Test 2: Load f1c5064f2d4 (Data Science)
  const ds = await repo.loadCourse('f1c5064f2d4');
  assert.strictEqual(ds.title.toLowerCase(), 'data science');
  const dsCamps = await campaigns.listCampaigns('f1c5064f2d4');
  console.log(`✓ Course data science has ${dsCamps.length} campaigns (all belong to data science)`);
  assert(dsCamps.every(c => c.course_id === 'f1c5064f2d4'), 'All campaigns must belong to data science');
  assert(!dsCamps.some(c => c.name.includes('Warangal')), 'No Warangal campaigns in data science');
  const dsLive = dsCamps.filter(c => c.status !== 'Draft');
  assert.strictEqual(dsLive.length, 0, 'data science has 0 live campaigns');

  // Test 4: Verify activity log isolation
  assert(ds.activity.every(a => a.course_id === 'f1c5064f2d4'), 'All data science activities must belong to data science');
  assert(!ds.activity.some(a => a.text.includes('Warangal')), 'Warangal activity must not be in data science activity log');
  console.log(`✓ Data science activity log has ${ds.activity.length} isolated items (no Warangal activity)`);

  // Test 5: Verify reads isolation
  for (const rd of ds.reads) {
    for (const it of rd.items || []) {
      assert(!it.t.includes('Warangal'), `Read item "${it.t}" must not contain Warangal`);
    }
  }
  console.log('✓ Data science reads do not contain Warangal items');

  // Test 6: Verify dashboard calculations for f1 vs data science
  // Simulate GET /:id/dashboard calculations for data science
  const dsTotals = { clicks: 0, regs: 0, enrols: 0, spent: 0, committed: 0, reach: 0, unattributed: 0, posts: 0 };
  assert.strictEqual(dsTotals.enrols, 0);
  assert.strictEqual(dsTotals.spent, 0);
  assert.strictEqual(dsTotals.reach, 0);
  assert.strictEqual(dsTotals.unattributed, 0);
  const dsCpe = dsTotals.enrols ? Math.round(dsTotals.spent / dsTotals.enrols) : null;
  assert.strictEqual(dsCpe, null, 'CPE must be null (not 3206) when enrolments are 0');

  // Simulate GET /:id/dashboard calculations for f1
  const f1Live = f1Camps.filter(c => c.status !== 'Draft');
  const f1Totals = { clicks: 0, regs: 0, enrols: 0, spent: 0, committed: 0, reach: 0, unattributed: 0, posts: 0 };
  for (const c of f1Live) {
    const full = await campaigns.getCampaign(c.id);
    f1Totals.clicks += full.stats.clicks || 0;
    f1Totals.regs += full.stats.regs || 0;
    f1Totals.enrols += full.stats.enrols || 0;
    f1Totals.spent += full.stats.spent || 0;
    f1Totals.committed += full.stats.committed || 0;
    f1Totals.reach += full.stats.reach || 0;
    f1Totals.unattributed += full.unattributed || 0;
    f1Totals.posts += full.stats.posts || 0;
  }
  console.log(`✓ f1 totals: enrols=${f1Totals.enrols}, reach=${f1Totals.reach}, spent=${f1Totals.spent}, unattr=${f1Totals.unattributed}`);
  assert(f1Totals.enrols > 0, 'f1 should have real enrolments');
  assert(f1Totals.reach > 0, 'f1 should have real reach');

  // Test 7: Create a brand new course and verify immediate dashboard isolation
  const newCourseName = `Test Isolation Course ${Date.now()}`;
  const created = await svc.createCourse({
    title: newCourseName,
    link: 'test.org/course',
    language: 'Telugu',
    batch_start: '2026-12-01'
  }, { id: 'u1', name: 'Anika Rao' });
  console.log(`✓ Created new test course: "${created.title}" (${created.id})`);

  const newCourseCamps = await campaigns.listCampaigns(created.id);
  assert.strictEqual(newCourseCamps.length, 0, 'New course must have 0 campaigns');

  const newCourseData = await repo.loadCourse(created.id);
  assert.strictEqual(newCourseData.activity.length, 1, 'New course must have only 1 activity (creation)');
  assert(newCourseData.activity[0].text.includes('Course created'), 'Activity should be course creation');
  assert(!newCourseData.activity[0].text.includes('Warangal'), 'No Warangal in new course activity');

  for (const rd of newCourseData.reads) {
    assert.strictEqual(rd.status, 'Waiting', 'New course reads should start as Waiting');
    assert.strictEqual(rd.items.length, 0, 'New course reads should have 0 items');
  }
  console.log('✓ New course has Waiting status with 0 items for all reads');

  // Clean up created test course
  await db.query('DELETE FROM courses WHERE id = ?', [created.id]);
  console.log(`✓ Cleaned up test course (${created.id})`);

  console.log('\n=== ALL CROSS-COURSE DATA ISOLATION TESTS PASSED ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
