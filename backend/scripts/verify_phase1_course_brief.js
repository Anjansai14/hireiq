/**
 * Verification Script for HireIQ Course Brief — Phase 1:
 * Backend Integration, Dynamic Functionality and Persistence.
 */
const mysql = require('mysql2/promise');
const config = require('../src/config');

const BASE = 'http://localhost:4000/api';
let pass = 0;
let fail = 0;

async function assert(condition, message) {
  if (!condition) {
    fail++;
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(message);
  } else {
    pass++;
    console.log(`  ✓ PASS: ${message}`);
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('HIREIQ COURSE BRIEF — PHASE 1 VERIFICATION CHECKS');
  console.log('======================================================\n');

  // Check 1: Load course list from running backend
  console.log('Test 1: GET /api/courses (Load course list)');
  const resCourses = await fetch(`${BASE}/courses`);
  await assert(resCourses.status === 200, 'HTTP status is 200');
  const courses = await resCourses.json();
  await assert(Array.isArray(courses) && courses.length >= 2, `Retrieved ${courses.length} courses from DB`);
  await assert(courses.some(c => c.id === 'f1'), 'Seeded course f1 exists in course list');
  await assert(courses.some(c => c.id === 'f2'), 'Seeded course f2 exists in course list');

  // Check 2: Open existing course and confirm fields reflect API response
  console.log('\nTest 2: GET /api/courses/f1 & f2 (Confirm fields reflect backend)');
  const resF1 = await fetch(`${BASE}/courses/f1`);
  await assert(resF1.status === 200, 'HTTP status 200 for course f1');
  const f1 = await resF1.json();
  await assert(f1.form?.title === 'Applied AI & ML Programme', `f1 title is "${f1.form?.title}"`);
  await assert(f1.form?.domain === 'AI/ML', `f1 domain is "${f1.form?.domain}"`);
  await assert(f1.form?.mode === 'Hybrid', `f1 mode is "${f1.form?.mode}"`);
  await assert(f1.readiness?.ok === 9, 'f1 readiness ok is 9/9');

  const resF2 = await fetch(`${BASE}/courses/f2`);
  const f2 = await resF2.json();
  await assert(f2.form?.title === 'Advanced Manufacturing Technician', `f2 title is "${f2.form?.title}"`);
  await assert(f2.form?.domain === 'Manufacturing', `f2 domain is "${f2.form?.domain}"`);

  // Check 3: Create course and confirm backend returns persisted ID
  console.log('\nTest 3: POST /api/courses (Create course dynamically)');
  const newCourseTitle = 'Cloud Architecture & DevOps ' + Date.now();
  const createRes = await fetch(`${BASE}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: newCourseTitle,
      link: 'nexaskills.org/cloud-devops',
      language: 'Telugu',
      batch_start: '2027-03-01'
    })
  });
  await assert(createRes.status === 201, 'HTTP status 201 for course creation');
  const createdCourse = await createRes.json();
  const createdId = createdCourse.id;
  await assert(createdId && createdId.startsWith('f'), `Course created with real persisted ID: ${createdId}`);
  await assert(createdCourse.title === newCourseTitle, 'Course title matches request');

  // Check 4: Verify created course can be retrieved from API
  console.log('\nTest 4: GET /api/courses/:id (Retrieve created course)');
  const getCreatedRes = await fetch(`${BASE}/courses/${createdId}`);
  await assert(getCreatedRes.status === 200, 'HTTP status 200 when retrieving created course');
  const retrievedCourse = await getCreatedRes.json();
  await assert(retrievedCourse.id === createdId, 'Retrieved course ID matches created ID');
  await assert(retrievedCourse.form?.link === 'nexaskills.org/cloud-devops', 'Course link persisted correctly');

  // Check 5: Edit fields and verify update API succeeds
  console.log('\nTest 5: PATCH /api/courses/:id/form (Edit Course Brief fields)');
  const updateRes = await fetch(`${BASE}/courses/${createdId}/form`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      values: {
        domain: 'Cloud',
        level: 'Intermediate',
        duration: '14 weeks',
        mode: 'Hybrid',
        stipend: '₹5,000/month',
        fee: 'Zero tuition fee',
        eligibility: 'B.Tech/MCA graduates, 2023-2026'
      }
    })
  });
  await assert(updateRes.status === 200, 'HTTP status 200 for form update');
  const updatedCourse = await updateRes.json();
  await assert(updatedCourse.form?.domain === 'Cloud', 'Form domain updated to "Cloud"');
  await assert(updatedCourse.form?.stipend === '₹5,000/month', 'Form stipend updated to "₹5,000/month"');

  // Check 6: Retrieve course again and verify saved values
  console.log('\nTest 6: GET /api/courses/:id (Verify persistence on subsequent read)');
  const getAfterUpdate = await fetch(`${BASE}/courses/${createdId}`).then(r => r.json());
  await assert(getAfterUpdate.form?.level === 'Intermediate', 'Level persisted as "Intermediate"');
  await assert(getAfterUpdate.form?.duration === '14 weeks', 'Duration persisted as "14 weeks"');
  await assert(getAfterUpdate.form?.mode === 'Hybrid', 'Mode persisted as "Hybrid"');

  // Check 7: Direct MySQL DB query to verify cold storage persistence
  console.log('\nTest 7: Direct MySQL DB inspection (Persistence survives restart)');
  const conn = await mysql.createConnection(config.db);
  const [rows] = await conn.query('SELECT id, title, form FROM courses WHERE id = ?', [createdId]);
  await assert(rows.length === 1, 'Row exists directly in MySQL `courses` table');
  const dbForm = typeof rows[0].form === 'string' ? JSON.parse(rows[0].form) : rows[0].form;
  await assert(dbForm.domain === 'Cloud', 'MySQL `form` JSON column contains domain="Cloud"');
  await assert(dbForm.stipend === '₹5,000/month', 'MySQL `form` JSON column contains stipend="₹5,000/month"');
  await conn.end();

  // Check 8: Verify separate courses remain independent
  console.log('\nTest 8: Data isolation between courses');
  const f1Data = await fetch(`${BASE}/courses/f1`).then(r => r.json());
  const f2Data = await fetch(`${BASE}/courses/f2`).then(r => r.json());
  await assert(f1Data.form?.domain !== f2Data.form?.domain, `f1 (${f1Data.form?.domain}) and f2 (${f2Data.form?.domain}) do not mix data`);
  await assert(f1Data.id !== f2Data.id, 'IDs are distinct');

  // Check 9: Test failed and invalid API requests
  console.log('\nTest 9: Error handling on invalid requests');
  const emptyTitleRes = await fetch(`${BASE}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '' })
  });
  await assert(emptyTitleRes.status === 400, 'POST empty title returns 400 Bad Request');
  const emptyErr = await emptyTitleRes.json();
  await assert(emptyErr.error === 'Course name is required', `Correct error message: "${emptyErr.error}"`);

  const duplicateTitleRes = await fetch(`${BASE}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: newCourseTitle })
  });
  await assert(duplicateTitleRes.status === 409, 'POST duplicate title returns 409 Conflict');
  const dupErr = await duplicateTitleRes.json();
  await assert(dupErr.error === 'A course with this name already exists', `Correct conflict error: "${dupErr.error}"`);

  console.log('\n======================================================');
  console.log(`PHASE 1 VERIFICATION SUMMARY: ${pass} passed, ${fail} failed`);
  console.log('======================================================\n');

  if (fail > 0) process.exit(1);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
