/**
 * Comprehensive Verification Script for HireIQ Course Brief — Phase 2:
 * Fully dynamic Course Brief, Prototype parity (5e3ae21b.html), zero hardcoded data,
 * MySQL persistence, Governance flags, Claims evidence, Context, File operations, and Error Handling.
 */
const mysql = require('mysql2/promise');
const config = require('../src/config');
const fs = require('fs');
const path = require('path');

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
  console.log('HIREIQ COURSE BRIEF — COMPREHENSIVE VERIFICATION');
  console.log('======================================================\n');

  // Test 1: Load courses list from running backend
  console.log('Test 1: GET /api/courses (Load courses list from DB)');
  const resCourses = await fetch(`${BASE}/courses`);
  await assert(resCourses.status === 200, 'HTTP status is 200');
  const courses = await resCourses.json();
  await assert(Array.isArray(courses) && courses.length >= 2, `Retrieved ${courses.length} courses from DB`);
  await assert(courses.some(c => c.id === 'f1'), 'Course f1 exists');
  await assert(courses.some(c => c.id === 'f2'), 'Course f2 exists');

  // Test 2: Verify Course f1 data integrity
  console.log('\nTest 2: GET /api/courses/f1 (Verify course f1 fields, readiness & governance)');
  const resF1 = await fetch(`${BASE}/courses/f1`);
  await assert(resF1.status === 200, 'HTTP status 200 for course f1');
  const f1 = await resF1.json();
  await assert(f1.form?.title === 'Applied AI & ML Programme', `f1 title is "${f1.form?.title}"`);
  await assert(f1.form?.domain === 'AI/ML', `f1 domain is "${f1.form?.domain}"`);
  await assert(f1.form?.level === 'Intermediate', `f1 level is "${f1.form?.level}"`);
  await assert(f1.form?.mode === 'Hybrid', `f1 mode is "${f1.form?.mode}"`);
  await assert(Array.isArray(f1.form?.locations) && f1.form.locations.includes('Warangal'), 'f1 locations include Warangal');
  await assert(f1.readiness?.ok === 9 && f1.readiness?.req === 9, `f1 readiness is ${f1.readiness?.ok}/${f1.readiness?.req} (100%)`);
  await assert(Array.isArray(f1.flags) && f1.flags.length > 0, `f1 has ${f1.flags.length} governance flags`);
  await assert(Array.isArray(f1.claims) && f1.claims.length > 0, `f1 has ${f1.claims.length} outcome claims`);
  await assert(Array.isArray(f1.files) && f1.files.length > 0, `f1 has ${f1.files.length} attached files`);

  // Test 3: Verify Course f2 data integrity (partial readiness)
  console.log('\nTest 3: GET /api/courses/f2 (Verify course f2 distinct fields & readiness)');
  const resF2 = await fetch(`${BASE}/courses/f2`);
  await assert(resF2.status === 200, 'HTTP status 200 for course f2');
  const f2 = await resF2.json();
  await assert(f2.form?.title === 'Advanced Manufacturing Technician', `f2 title is "${f2.form?.title}"`);
  await assert(f2.form?.domain === 'Manufacturing', `f2 domain is "${f2.form?.domain}"`);
  await assert(f2.readiness?.req === 9, `f2 readiness req is 9`);
  await assert(f2.readiness?.noRegLink === true, 'f2 correctly flags noRegLink === true');

  // Test 4: Create new course dynamically
  console.log('\nTest 4: POST /api/courses (Create new course dynamically)');
  const uniqueTitle = 'Cybersecurity & SOC Operations ' + Date.now();
  const createRes = await fetch(`${BASE}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: uniqueTitle,
      link: 'nexaskills.org/cyber-soc',
      language: 'English',
      batch_start: '2027-04-01'
    })
  });
  await assert(createRes.status === 201, 'HTTP status 201 on course creation');
  const createdCourse = await createRes.json();
  const newId = createdCourse.id;
  await assert(newId && newId.startsWith('f'), `Course created with real persisted ID: ${newId}`);
  await assert(createdCourse.title === uniqueTitle, 'Course title matches input');

  // Test 5: Edit all 4 field groups on the new course
  console.log('\nTest 5: PATCH /api/courses/:id/form (Edit Course Brief across all 4 groups)');
  const formUpdateRes = await fetch(`${BASE}/courses/${newId}/form`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      values: {
        // Group 1: Course
        domain: 'Cloud',
        level: 'Intermediate',
        eligibility: 'B.Tech/MCA 2023-2026 graduates with networking basics',
        duration: '14 weeks',
        mode: 'Hybrid',
        locations: ['Telangana', 'Andhra Pradesh'],
        // Group 2: Batch and target
        batchName: 'Batch 1',
        batchStart: '2027-04-01',
        batchEnd: '2027-07-08',
        screenClose: '2027-03-20',
        target: '250',
        ceiling: '4000',
        regLink: 'resolence.in/r/cyber-soc-b1',
        // Group 3: Offer
        budget: '10,00,000',
        fee: 'Zero tuition fee',
        stipend: '₹5,000/month',
        benefits: 'Live SOC lab access, industry mentor hours',
        outcome: '90% placement rate in regional SOC centres',
        langs: ['English', 'Telugu'],
        // Group 4: Context
        provider: 'Nexa Skills Foundation & CERT-In Partner',
        competing: 'Private SOC bootcamps in Bengaluru',
        past: 'Pilot cohort: 32 enrolments'
      }
    })
  });
  await assert(formUpdateRes.status === 200, 'HTTP status 200 on form update');
  const updatedCourse = await formUpdateRes.json();
  await assert(updatedCourse.form?.domain === 'Cloud', 'Domain updated to "Cloud"');
  await assert(updatedCourse.form?.locations?.includes('Telangana'), 'Locations updated with "Telangana"');
  await assert(updatedCourse.form?.regLink === 'resolence.in/r/cyber-soc-b1', 'Registration link updated');
  await assert(updatedCourse.form?.stipend === '₹5,000/month', 'Stipend updated');
  await assert(updatedCourse.readiness?.ok === 9, `Readiness is now 9/9 confirmed required fields`);
  await assert(updatedCourse.readiness?.noRegLink === false, 'noRegLink is now false');

  // Test 6: Verify cold storage persistence via direct MySQL query
  console.log('\nTest 6: Direct MySQL DB query (Verify cold storage persistence)');
  const conn = await mysql.createConnection(config.db);
  const [dbRows] = await conn.query('SELECT id, title, form, batch, batch_start FROM courses WHERE id = ?', [newId]);
  await assert(dbRows.length === 1, 'Row exists in MySQL `courses` table');
  const dbForm = typeof dbRows[0].form === 'string' ? JSON.parse(dbRows[0].form) : dbRows[0].form;
  await assert(dbForm.domain === 'Cloud', 'MySQL `form` JSON contains domain="Cloud"');
  await assert(dbForm.regLink === 'resolence.in/r/cyber-soc-b1', 'MySQL `form` JSON contains regLink');
  await assert(dbForm.stipend === '₹5,000/month', 'MySQL `form` JSON contains stipend="₹5,000/month"');
  await conn.end();

  // Test 7: Confirm fields via POST /api/courses/:id/confirm
  console.log('\nTest 7: POST /api/courses/:id/confirm (Confirm file-extracted fields)');
  const confirmRes = await fetch(`${BASE}/courses/${newId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys: ['eligibility'] })
  });
  await assert(confirmRes.status === 200, 'HTTP status 200 for confirm endpoint');
  const confirmedCourse = await confirmRes.json();
  await assert(!confirmedCourse.form_src?.eligibility, 'form_src.eligibility cleared upon confirmation');

  // Test 8: Context editor via PATCH /api/courses/:id/context
  console.log('\nTest 8: PATCH /api/courses/:id/context (Save "About this course" context)');
  const newContext = 'Hands-on SOC operations and incident response course tailored for engineering graduates.';
  const contextRes = await fetch(`${BASE}/courses/${newId}/context`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: newContext })
  });
  await assert(contextRes.status === 200, 'HTTP status 200 on context patch');
  const contextCourse = await contextRes.json();
  await assert(contextCourse.context === newContext, 'Context persisted correctly in MySQL');

  // Test 9: Governance flag update via PATCH /api/courses/:id/flags/:fid
  console.log('\nTest 9: PATCH /api/courses/:id/flags/:fid (Update governance flag status & note)');
  const flagToUpdate = updatedCourse.flags?.[0];
  await assert(flagToUpdate && flagToUpdate.id, 'Course has a governance flag');
  const flagRes = await fetch(`${BASE}/courses/${newId}/flags/${flagToUpdate.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Under review', note: 'Curriculum reviewed for industry parity' })
  });
  await assert(flagRes.status === 200, 'HTTP status 200 on flag patch');
  const flagCourse = await flagRes.json();
  const updatedFlag = flagCourse.flags.find(f => f.id === flagToUpdate.id);
  await assert(updatedFlag.status === 'Under review', 'Flag status updated to "Under review"');
  await assert(updatedFlag.note === 'Curriculum reviewed for industry parity', 'Flag note persisted');

  // Test 10: Delete course file via DELETE /api/courses/:id/files/:fid
  console.log('\nTest 10: File addition & deletion (DELETE /api/courses/:id/files/:fid)');
  const conn2 = await mysql.createConnection(config.db);
  const testFileId = 'fl-test-' + Date.now();
  await conn2.query(
    'INSERT INTO files (id, course_id, name, size_label, lane, date, by_user, status) VALUES (?,?,?,?,?,?,?,?)',
    [testFileId, newId, 'temp-syllabus.pdf', '150 KB', 'Brief material', '2026-10-17', 'Tester', 'Stored']
  );
  await conn2.end();

  const getWithFile = await fetch(`${BASE}/courses/${newId}`).then(r => r.json());
  await assert(getWithFile.files.some(f => f.id === testFileId), 'File exists before delete');

  const delRes = await fetch(`${BASE}/courses/${newId}/files/${testFileId}`, { method: 'DELETE' });
  await assert(delRes.status === 200, 'DELETE file returns 200');
  const afterDel = await delRes.json();
  await assert(!afterDel.files.some(f => f.id === testFileId), 'File successfully deleted from database');

  // Test 11: Real extraction via Agent A1 (sample brochure)
  console.log('\nTest 11: POST /api/courses/:id/extract (Real Agent A1 extraction from sample brochure)');
  const extractRes = await fetch(`${BASE}/courses/${newId}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sample: true })
  });
  await assert(extractRes.status === 200, 'Extraction returns 200');
  const extractData = await extractRes.json();
  await assert(extractData.extracted && extractData.course, 'Extraction response includes extracted details and updated course');
  await assert(extractData.course.files.some(f => f.name === 'sample-brochure.pdf'), 'sample-brochure.pdf recorded in course files');

  // Test 12: Data isolation between courses
  console.log('\nTest 12: Course data isolation check');
  const checkF1 = await fetch(`${BASE}/courses/f1`).then(r => r.json());
  const checkNew = await fetch(`${BASE}/courses/${newId}`).then(r => r.json());
  await assert(checkF1.form?.domain !== checkNew.form?.domain, `f1 domain (${checkF1.form?.domain}) !== new course domain (${checkNew.form?.domain})`);
  await assert(checkF1.id !== checkNew.id, 'IDs are isolated');

  // Test 13: Error handling on invalid requests
  console.log('\nTest 13: Error handling on invalid inputs');
  const emptyRes = await fetch(`${BASE}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '' })
  });
  await assert(emptyRes.status === 400, 'Empty title returns 400 Bad Request');

  const dupRes = await fetch(`${BASE}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: uniqueTitle })
  });
  await assert(dupRes.status === 409, 'Duplicate title returns 409 Conflict');

  const nonExistent = await fetch(`${BASE}/courses/f-nonexistent-id`);
  await assert(nonExistent.status === 404, 'Non-existent course returns 404 Not Found');

  console.log('\n======================================================');
  console.log(`ALL VERIFICATION CHECKS PASSED: ${pass} passed, ${fail} failed`);
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
