/**
 * Comprehensive Verification Script for HireIQ Course Brief — Production Quality:
 * Security (Auth 401, Bearer JWT), Upload Separation (Overview Extract vs Files Store),
 * File Deduplication, Evidence Deletion Protection, MySQL Persistence, Error Handling.
 */
const mysql = require('mysql2/promise');
const config = require('../src/config');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4000/api';
let pass = 0;
let fail = 0;
let authToken = '';

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

async function authedFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
  };
  return fetch(url, { ...options, headers });
}

async function run() {
  console.log('\n======================================================');
  console.log('HIREIQ ENTERPRISE REMEDIATION & VERIFICATION SUITE');
  console.log('======================================================\n');

  // Security Test 1: Reject unauthenticated request
  console.log('Security Test 1: GET /api/courses without token (Expect 401)');
  const unauthedRes = await fetch(`${BASE}/courses`);
  await assert(unauthedRes.status === 401, 'Unauthenticated request correctly rejected with HTTP 401');

  // Security Test 2: Reject invalid token
  console.log('\nSecurity Test 2: GET /api/courses with invalid Bearer token (Expect 401)');
  const badTokenRes = await fetch(`${BASE}/courses`, {
    headers: { Authorization: 'Bearer invalid-token-12345' }
  });
  await assert(badTokenRes.status === 401, 'Invalid token correctly rejected with HTTP 401');

  // Security Test 3: Authenticate and obtain JWT
  console.log('\nSecurity Test 3: POST /api/auth/login (Login as Manager Anika Rao)');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'anika.rao@peopletech.com', password: 'Hireiq@123' })
  });
  await assert(loginRes.status === 200, 'Login returns HTTP 200 OK');
  const loginData = await loginRes.json();
  await assert(Boolean(loginData.token), 'Valid JWT token returned');
  authToken = loginData.token;

  // Test 1: Load courses list from running backend
  console.log('\nTest 1: GET /api/courses with valid Bearer token');
  const resCourses = await authedFetch(`${BASE}/courses`);
  await assert(resCourses.status === 200, 'HTTP status is 200');
  const courses = await resCourses.json();
  await assert(Array.isArray(courses) && courses.length >= 2, `Retrieved ${courses.length} courses from DB`);
  await assert(courses.some(c => c.id === 'f1'), 'Course f1 exists');
  await assert(courses.some(c => c.id === 'f2'), 'Course f2 exists');

  // Test 2: Verify Course f1 data integrity
  console.log('\nTest 2: GET /api/courses/f1 (Verify course f1 fields, readiness & governance)');
  const resF1 = await authedFetch(`${BASE}/courses/f1`);
  await assert(resF1.status === 200, 'HTTP status 200 for course f1');
  const f1 = await resF1.json();
  await assert(Boolean(f1.title || f1.form?.title), `f1 has title: "${f1.form?.title || f1.title}"`);
  await assert(Boolean(f1.form?.domain), `f1 domain is "${f1.form?.domain}"`);
  await assert(Boolean(f1.form?.level), `f1 level is "${f1.form?.level}"`);
  await assert(Boolean(f1.form?.mode), `f1 mode is "${f1.form?.mode}"`);
  await assert(Array.isArray(f1.form?.locations) && f1.form.locations.includes('Warangal'), 'f1 locations include Warangal');
  await assert(f1.readiness?.req === 9 && typeof f1.readiness?.ok === 'number', `f1 readiness is ${f1.readiness?.ok}/${f1.readiness?.req}`);
  await assert(Array.isArray(f1.flags) && f1.flags.length > 0, `f1 has ${f1.flags.length} governance flags`);
  await assert(Array.isArray(f1.claims) && f1.claims.length > 0, `f1 has ${f1.claims.length} outcome claims`);
  await assert(Array.isArray(f1.files) && f1.files.length > 0, `f1 has ${f1.files.length} attached files`);

  // Test 3: Verify Course f2 data integrity
  console.log('\nTest 3: GET /api/courses/f2 (Verify course f2 distinct fields & readiness)');
  const resF2 = await authedFetch(`${BASE}/courses/f2`);
  await assert(resF2.status === 200, 'HTTP status 200 for course f2');
  const f2 = await resF2.json();
  await assert(f2.form?.title === 'Advanced Manufacturing Technician', `f2 title is "${f2.form?.title}"`);
  await assert(f2.form?.domain === 'Manufacturing', `f2 domain is "${f2.form?.domain}"`);

  // Test 4: Create a new Course dynamically
  console.log('\nTest 4: POST /api/courses (Create a new course dynamically)');
  const uniqueTitle = 'Test Cloud Engineering ' + Date.now();
  const resCreate = await authedFetch(`${BASE}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: uniqueTitle,
      batch: 'Batch 1',
      language: 'Telugu',
      batch_start: '2026-12-01',
      provider: 'Nexa Skills Foundation'
    })
  });
  await assert(resCreate.status === 201, 'Course creation returns HTTP 201');
  const createdCourse = await resCreate.json();
  const newId = createdCourse.id;
  await assert(Boolean(newId), `Created new course with ID: ${newId}`);

  // Test 5: Patch course form values
  console.log('\nTest 5: PATCH /api/courses/:id/form (Update form fields & readiness)');
  const patchRes = await authedFetch(`${BASE}/courses/${newId}/form`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      values: {
        title: uniqueTitle,
        domain: 'Cloud',
        level: 'Intermediate',
        duration: '12 weeks',
        mode: 'Online',
        locations: ['Hyderabad'],
        batchStart: '2026-12-01',
        target: '50',
        ceiling: '4000',
        fee: 'Free'
      }
    })
  });
  await assert(patchRes.status === 200, 'Form patch returns HTTP 200');
  const patchedCourse = await patchRes.json();
  await assert(patchedCourse.form?.domain === 'Cloud', 'Form domain updated to "Cloud"');
  await assert(patchedCourse.readiness?.ok > 0, `Readiness increased to ${patchedCourse.readiness?.ok}/${patchedCourse.readiness?.req}`);

  // Test 6: Separate Files-tab Upload (POST /api/courses/:id/files) without running A1 extraction
  console.log('\nTest 6: POST /api/courses/:id/files (Files-tab direct document upload)');
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const samplePdfContent = '%PDF-1.4 sample course syllabus document for testing';
  const fileBody = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="test_curriculum.pdf"',
    'Content-Type: application/pdf',
    '',
    samplePdfContent,
    `--${boundary}--`
  ].join('\r\n');

  const filesTabRes = await authedFetch(`${BASE}/courses/${newId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: fileBody
  });
  await assert(filesTabRes.status === 201, 'Files-tab upload returns HTTP 201 Created');
  const filesTabData = await filesTabRes.json();
  await assert(filesTabData.file && filesTabData.course, 'Returns uploaded file metadata and updated course');
  await assert(filesTabData.file.name === 'test_curriculum.pdf', 'Uploaded file name is preserved');
  await assert(filesTabData.file.status === 'Stored', 'File status is "Stored" (NOT Extracted)');
  await assert(filesTabData.course.form?.domain === 'Cloud', 'Brief form was NOT overwritten by extraction');

  // Test 7: Duplicate Upload Prevention (Re-uploading same file updates record instead of creating duplicate)
  console.log('\nTest 7: Re-uploading test_curriculum.pdf (Deduplication check)');
  const reuploadRes = await authedFetch(`${BASE}/courses/${newId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: fileBody
  });
  await assert(reuploadRes.status === 201, 'Re-upload returns HTTP 201');
  const reuploadData = await reuploadRes.json();
  const matchingFiles = reuploadData.course.files.filter(f => f.name === 'test_curriculum.pdf');
  await assert(matchingFiles.length === 1, `Exactly 1 record exists for test_curriculum.pdf (Found: ${matchingFiles.length})`);
  await assert(matchingFiles[0].id === filesTabData.file.id, 'Existing file ID was preserved across updates');

  // Test 8: Evidence Attachment and Deletion Protection
  console.log('\nTest 8: Evidence attachment & deletion protection (DELETE /api/courses/:id/files/:fid)');
  // Add a test claim to course
  const conn = await mysql.createConnection(config.db);
  const testClaimId = 'cl-test-' + Date.now();
  await conn.query(
    'INSERT INTO course_claims (id, course_id, text, status) VALUES (?,?,?,?)',
    [testClaimId, newId, '90% placement guaranteed in Cloud roles', 'Awaiting evidence']
  );
  await conn.end();

  // Attach evidence
  const evBoundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const evBody = [
    `--${evBoundary}`,
    'Content-Disposition: form-data; name="file"; filename="placement_audit_report.pdf"',
    'Content-Type: application/pdf',
    '',
    '%PDF-1.4 audited evidence placement report',
    `--${evBoundary}--`
  ].join('\r\n');

  const evRes = await authedFetch(`${BASE}/courses/${newId}/claims/${testClaimId}/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${evBoundary}` },
    body: evBody
  });
  await assert(evRes.status === 200, 'Evidence attached successfully');
  const evCourse = await evRes.json();
  const evidenceFile = evCourse.files.find(f => f.name === 'placement_audit_report.pdf');
  await assert(Boolean(evidenceFile), 'Evidence file exists in course files');

  // Attempt to delete evidenced file (Must be blocked with HTTP 400)
  console.log('Attempting to delete evidenced file (Expect HTTP 400 block)');
  const blockedDelRes = await authedFetch(`${BASE}/courses/${newId}/files/${evidenceFile.id}`, { method: 'DELETE' });
  await assert(blockedDelRes.status === 400, 'Evidenced file deletion correctly BLOCKED with HTTP 400');
  const blockedDelData = await blockedDelRes.json();
  await assert(blockedDelData.error.includes('referenced as evidence'), `Informative error returned: ${blockedDelData.error}`);

  // Test 9: Deleting unreferenced file succeeds
  console.log('\nTest 9: Deleting unreferenced file (test_curriculum.pdf)');
  const unrefDelRes = await authedFetch(`${BASE}/courses/${newId}/files/${filesTabData.file.id}`, { method: 'DELETE' });
  await assert(unrefDelRes.status === 200, 'Unreferenced file deleted successfully with HTTP 200');
  const courseAfterDel = await unrefDelRes.json();
  await assert(!courseAfterDel.files.some(f => f.id === filesTabData.file.id), 'File removed from course files');

  // Test 10: Overview Extraction via Agent A1 (sample brochure)
  console.log('\nTest 10: POST /api/courses/:id/extract (Overview tab Agent A1 extraction)');
  const extractRes = await authedFetch(`${BASE}/courses/${newId}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sample: true })
  });
  await assert(extractRes.status === 200, 'Extraction returns HTTP 200');
  const extractData = await extractRes.json();
  await assert(extractData.extracted && extractData.course, 'Extraction returns extracted values and updated course');
  await assert(extractData.course.files.some(f => f.name === 'sample-brochure.pdf'), 'sample-brochure.pdf recorded in course files');
  const sampleFiles = extractData.course.files.filter(f => f.name === 'sample-brochure.pdf');
  await assert(sampleFiles.length === 1, 'Only 1 record for sample-brochure.pdf exists');

  // Re-run extraction to verify deduplication
  const extract2Res = await authedFetch(`${BASE}/courses/${newId}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sample: true })
  });
  const extract2Data = await extract2Res.json();
  const sampleFiles2 = extract2Data.course.files.filter(f => f.name === 'sample-brochure.pdf');
  await assert(sampleFiles2.length === 1, 'Re-extraction does NOT create duplicate files records');

  console.log('\n======================================================');
  console.log(`ALL VERIFICATION CHECKS PASSED: ${pass} passed, ${fail} failed`);
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
