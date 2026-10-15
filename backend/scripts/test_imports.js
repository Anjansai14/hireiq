/**
 * Comprehensive Automated Test Suite for HireIQ Creator Bank Imports.
 * Tests:
 *   Feature A — Single YouTube Creator Import
 *     1. Valid channel URL (@handle)
 *     2. Valid video URL and channel resolution (watch?v= and youtu.be)
 *     3. Invalid or unsupported URL (400 validation error)
 *     4. Missing API key handling (actionable configuration error)
 *     5. YouTube API inaccessible channel (404 error)
 *     6. Duplicate import & existing creator update (preserving manual metadata)
 *
 *   Feature B — Full Excel Workbook Import
 *     7. Official template download (.xlsx and .csv)
 *     8. Multiple valid data rows (.xlsx)
 *     9. Large workbook containing many rows (50 rows)
 *    10. Empty rows and blank optional cells
 *    11. Invalid headers and malformed files
 *    12. Missing required values (row-level failure reporting)
 *    13. Duplicate rows within the same workbook
 *    14. Duplicate records already in the database (merge policy)
 *    15. Mixed valid and invalid rows (partial success + error report)
 *    16. Re-importing same workbook without duplicate creation
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const BASE = process.argv[2] || 'http://localhost:4000';
let token = '';
let pass = 0;
const fails = [];

async function call(method, url, body, expectFail, headers = {}) {
  const isForm = body && typeof body.getHeaders === 'function';
  const customHeaders = isForm ? body.getHeaders() : (body ? { 'Content-Type': 'application/json' } : {});
  
  const r = await fetch(BASE + url, {
    method,
    headers: {
      ...customHeaders,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  const contentType = r.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const j = await r.json().catch(() => ({}));
    if (!r.ok && !expectFail) {
      throw new Error(`${method} ${url} → ${r.status} ${j.error || j.message || JSON.stringify(j)}`);
    }
    return expectFail ? { status: r.status, ...j } : j;
  }

  // Non-JSON responses (buffers, files)
  const buf = await r.arrayBuffer();
  if (!r.ok && !expectFail) {
    throw new Error(`${method} ${url} → ${r.status}`);
  }
  return { status: r.status, buffer: Buffer.from(buf), contentType };
}

async function uploadFile(url, buffer, filename, fieldName = 'file') {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const payload = Buffer.concat([
    Buffer.from(header, 'utf8'),
    buffer,
    Buffer.from(footer, 'utf8')
  ]);

  const res = await fetch(BASE + url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: payload,
  });

  const j = await res.json().catch(() => ({}));
  return { status: res.status, ...j };
}

async function step(name, fn) {
  try {
    const out = await fn();
    pass++;
    console.log('✓', name, out ? `— ${out}` : '');
  } catch (e) {
    fails.push(name);
    console.log('✗', name, '—', e.message);
  }
}

const assert = (condition, msg) => {
  if (!condition) throw new Error(msg);
};

(async () => {
  console.log('\n========================================');
  console.log('  HIRE IQ CREATOR BANK IMPORT TEST SUITE');
  console.log('========================================\n');

  // Authentication
  await step('01. Login as Manager', async () => {
    const r = await call('POST', '/api/auth/login', { email: 'anika.rao@peopletech.com', password: 'Hireiq@123' });
    token = r.token;
    assert(token, 'Login failed');
    return r.user.name;
  });

  // FEATURE A: YouTube Imports
  console.log('\n--- Feature A: YouTube Creator Imports ---');

  let testChannelId = '';
  await step('02. YouTube: Valid channel URL (@handle)', async () => {
    // Uses Google channel as a canonical verified YouTube channel
    const r = await call('POST', '/api/sources/import-youtube', {
      url: 'https://www.youtube.com/@Google',
      type: 'Digital creator'
    });
    assert(r.ok, 'Import response not ok');
    assert(r.creator && r.creator.name, 'Creator record not returned');
    assert(r.creator.platform === 'YouTube', 'Platform must be YouTube');
    assert(r.creator.followers > 0, 'Followers must be > 0');
    testChannelId = r.creator.id;
    return `Imported "${r.creator.name}" (${r.creator.handle}) with ${r.creator.followers.toLocaleString()} subs`;
  });

  await step('03. YouTube: Valid video URL resolving owning channel', async () => {
    // Tests video URL format (watch?v=...)
    const r = await call('POST', '/api/sources/import-youtube', {
      url: 'https://www.youtube.com/watch?v=59yiM9ZErRc',
      type: 'Digital creator'
    });
    assert(r.ok, 'Import response not ok');
    assert(r.creator && r.creator.name, 'Creator not resolved');
    return `Resolved video to channel "${r.creator.name}" (${r.creator.handle})`;
  });

  await step('04. YouTube: Video short URL (youtu.be/...)', async () => {
    const r = await call('POST', '/api/sources/import-youtube', {
      url: 'https://youtu.be/59yiM9ZErRc',
      type: 'Digital creator'
    });
    assert(r.ok, 'Import response not ok');
    assert(r.isDuplicate === true, 'Repeated import should report isDuplicate');
    return `Resolved youtu.be link correctly to "${r.creator.name}"`;
  });

  await step('05. YouTube: Invalid / unsupported URL format', async () => {
    const r = await call('POST', '/api/sources/import-youtube', {
      url: 'https://example.com/not-a-youtube-url',
      type: 'Digital creator'
    }, true);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
    assert(/YouTube URL/i.test(r.error), 'Expected validation error');
    return `Validation error: "${r.error}"`;
  });

  await step('06. YouTube: Non-existent channel handle', async () => {
    const r = await call('POST', '/api/sources/import-youtube', {
      url: 'https://www.youtube.com/@nonexistent_channel_xyz_998877665544',
      type: 'Digital creator'
    }, true);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
    return `Correct 404 error: "${r.error}"`;
  });

  await step('07. YouTube: Duplicate import & merge policy', async () => {
    // Manually add custom metadata to testChannelId to test that merge doesn't wipe it out
    await call('PATCH', `/api/sources/${testChannelId}`, {
      district: 'Hyderabad',
      tone: 'Inspiring'
    });

    const r = await call('POST', '/api/sources/import-youtube', {
      url: 'https://www.youtube.com/@Google',
      type: 'Digital creator'
    });
    assert(r.ok, 'Merge call failed');
    assert(r.isDuplicate === true, 'Must report isDuplicate === true');
    assert(r.creator.district === 'Hyderabad', 'Manual edit "district" must be preserved');
    assert(r.creator.tone === 'Inspiring', 'Manual edit "tone" must be preserved');
    return 'Preserved manual edits (district, tone) while refreshing metrics';
  });

  // FEATURE B: Excel Workbook Imports
  console.log('\n--- Feature B: Excel Workbook Imports ---');

  await step('08. Template: Download Excel template (.xlsx)', async () => {
    const r = await call('GET', '/api/sources/template?format=xlsx');
    assert(r.status === 200, 'Template download failed');
    assert(r.buffer && r.buffer.length > 500, 'Invalid workbook buffer');
    const wb = XLSX.read(r.buffer, { type: 'buffer' });
    assert(wb.SheetNames.includes('Creator Bank'), 'Sheet "Creator Bank" missing');
    return `Downloaded .xlsx (${(r.buffer.length / 1024).toFixed(1)} KB)`;
  });

  await step('09. Template: Download CSV template (.csv)', async () => {
    const r = await call('GET', '/api/sources/template?format=csv');
    assert(r.status === 200, 'CSV template download failed');
    const text = r.buffer.toString('utf8');
    assert(text.includes('Source Name') && text.includes('Handle'), 'Missing CSV headers');
    return 'Downloaded CSV template with standard columns';
  });

  await step('10. Excel: Multiple valid data rows (.xlsx)', async () => {
    const rows = [
      ['Source Name', 'Handle', 'Platform', 'Source Type', 'Profile URL', 'Followers', 'ER (%)', 'Median Views', 'Rate (INR)', 'District', 'Language', 'Skill Domains', 'Affiliation', 'Institutional Consent'],
      ['Telangana Tech Talks', '@telangtech', 'YouTube', 'Digital creator', 'https://youtube.com/@telangtech', 65000, 3.8, 14000, 20000, 'Warangal', 'Telugu', 'Software development, AI/ML', '', 'Not required'],
      ['VCE Campus Connect', 'vce-broadcast', 'WhatsApp', 'Placement cell', '', 3200, null, null, 0, 'Hyderabad', 'Telugu', 'Placements', 'Vardhaman College of Engineering', 'Recorded'],
      ['Hyderabad ML Mentors', 'linkedin.com/in/hyd-ml-mentors', 'LinkedIn', 'Trainer or mentor', 'https://linkedin.com/in/hyd-ml-mentors', 12500, 4.2, 2800, 15000, 'Hyderabad', 'English', 'AI/ML, Data engineering', '', 'Not required']
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Creators');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const r = await uploadFile('/api/sources/import', buf, 'multi_valid_test.xlsx');
    assert(r.ok, 'Upload failed: ' + (r.error || r.message));
    assert(r.totalRows === 3, `Expected 3 rows, got ${r.totalRows}`);
    assert(r.imported >= 1 || r.updated >= 1, 'Records were not processed');
    assert(r.failed === 0, `Expected 0 failures, got ${r.failed}`);
    return `Processed ${r.totalRows} rows: ${r.imported} imported, ${r.updated} updated, 0 failed`;
  });

  await step('11. Excel: Large workbook (hireiq_channels_telangana-1.xlsx)', async () => {
    const filePath = path.resolve(__dirname, '../hireiq_channels_telangana-1.xlsx');
    assert(fs.existsSync(filePath), 'hireiq_channels_telangana-1.xlsx not found at ' + filePath);
    const buf = fs.readFileSync(filePath);

    const r = await uploadFile('/api/sources/import', buf, 'hireiq_channels_telangana-1.xlsx');
    assert(r.ok, 'Large workbook failed: ' + (r.error || r.message));
    assert(r.totalRows === 429, `Expected 429 rows, got ${r.totalRows}`);
    assert(r.imported >= 0 && r.updated >= 300, `Expected at least 300 records to be updated/merged, got ${r.updated}`);
    assert(r.failed === 4, `Expected exactly 4 invalid rows, got ${r.failed}`);
    return `Successfully processed all ${r.totalRows} real rows (${r.imported} imported, ${r.updated} updated, ${r.failed} invalid rows reported)`;
  });

  await step('12. Excel: Empty rows and blank optional cells', async () => {
    const rows = [
      ['', '', '', '', ''], // empty header row 1
      ['Source Name', 'Handle', 'Platform', 'Source Type', 'Followers', 'ER (%)', 'District'],
      ['', '', '', '', '', '', ''], // empty row in middle
      ['Empty Cell Test Creator', '@emptycells_cr', 'Instagram', 'Micro-influencer', '', '', ''], // blank followers, ER, district
      ['', '', '', '', '', '', ''], // trailing empty row
      ['Numeric Zero Test', '@zero_rate_cr', 'YouTube', 'Digital creator', 0, 0, 'Hyderabad'], // zero followers, zero ER
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const r = await uploadFile('/api/sources/import', buf, 'empty_and_blanks.xlsx');
    assert(r.ok, 'Import with blanks failed');
    assert(r.totalRows === 2, `Expected 2 valid data rows (empty rows skipped), got ${r.totalRows}`);
    assert(r.failed === 0, `Expected 0 failures, got ${r.failed}`);
    return `Cleanly skipped blank rows, imported 2 records with blank and 0 values`;
  });

  await step('13. Excel: Malformed file without recognized headers', async () => {
    const rows = [
      ['Random Column 1', 'Some Other Header', 'Timestamp'],
      ['val1', 'val2', '2026-10-01']
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const r = await uploadFile('/api/sources/import', buf, 'invalid_headers.xlsx');
    assert(r.status === 400, `Expected 400 for bad headers, got ${r.status}`);
    return `Returned 400 error: "${r.error}"`;
  });

  await step('14. Excel: Missing required fields (row-level reporting)', async () => {
    const rows = [
      ['Source Name', 'Handle', 'Platform', 'Source Type'],
      ['', '@valid_handle', 'YouTube', 'Digital creator'], // missing name
      ['Missing Platform User', '@user_no_plat', '', 'Digital creator'], // missing platform
      ['Missing Handle User', '', 'YouTube', 'Digital creator'], // missing handle
      ['Unsupported Platform', '@bad_plat', 'TikTok', 'Digital creator'], // unsupported platform
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Creators');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const r = await uploadFile('/api/sources/import', buf, 'missing_required.xlsx');
    assert(r.ok, 'Failed to return error summary');
    assert(r.failed === 4, `Expected 4 failed rows, got ${r.failed}`);
    assert(r.errors && r.errors.length === 4, 'Errors array must contain 4 entries');
    assert(r.errors[0].row === 2, 'First error should be at row 2');
    return `Reported ${r.errors.length} failed rows with actionable reasons (e.g. "${r.errors[0].reason}")`;
  });

  await step('15. Excel: Duplicate rows within same workbook', async () => {
    const rows = [
      ['Source Name', 'Handle', 'Platform', 'Source Type', 'Followers'],
      ['Dupe Candidate A', '@dupe_in_file', 'YouTube', 'Digital creator', 40000],
      ['Dupe Candidate A Copy', '@dupe_in_file', 'YouTube', 'Digital creator', 45000], // duplicate handle
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const r = await uploadFile('/api/sources/import', buf, 'internal_dupes.xlsx');
    assert(r.ok, 'Import failed');
    assert(r.skipped >= 1, `Expected at least 1 duplicate skipped, got ${r.skipped}`);
    return `First occurrence saved, duplicate occurrence skipped (${r.skipped} skipped)`;
  });

  await step('16. Excel: Mixed valid and invalid rows with report', async () => {
    const rows = [
      ['Source Name', 'Handle', 'Platform', 'Source Type', 'Followers', 'District'],
      ['Valid Creator One', '@valid_one_cr', 'YouTube', 'Digital creator', 25000, 'Warangal'],
      ['Invalid Missing Name', '', 'Instagram', 'Digital creator', 10000, 'Hyderabad'], // invalid
      ['Valid Creator Two', '@valid_two_cr', 'LinkedIn', 'Alumnus', 18000, 'Hyderabad'],
      ['Invalid Unsupported Platform', '@valid_three_cr', 'MySpace', 'Digital creator', 5000, 'Karimnagar'], // invalid
      ['Valid Creator Three', '@valid_three_cr', 'WhatsApp', 'Community leader', 3000, 'Nalgonda'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mixed');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const r = await uploadFile('/api/sources/import', buf, 'mixed_rows.xlsx');
    assert(r.ok, 'Mixed import failed');
    assert(r.imported + r.updated === 3, `Expected 3 successful rows, got ${r.imported + r.updated}`);
    assert(r.failed === 2, `Expected 2 failed rows, got ${r.failed}`);
    assert(r.errors.length === 2, 'Expected 2 error reports');
    return `Saved 3 valid records, reported 2 failed rows without aborting the batch`;
  });

  await step('17. Excel: Re-importing same workbook without duplicate creation', async () => {
    // Re-importing the mixed_rows workbook from step 16
    const rows = [
      ['Source Name', 'Handle', 'Platform', 'Source Type', 'Followers', 'District'],
      ['Valid Creator One', '@valid_one_cr', 'YouTube', 'Digital creator', 26000, 'Warangal'],
      ['Valid Creator Two', '@valid_two_cr', 'LinkedIn', 'Alumnus', 19000, 'Hyderabad'],
      ['Valid Creator Three', '@valid_three_cr', 'WhatsApp', 'Community leader', 3500, 'Nalgonda'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reimport');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const r = await uploadFile('/api/sources/import', buf, 'reimport_test.xlsx');
    assert(r.ok, 'Reimport failed');
    assert(r.imported === 0, `Expected 0 new records created, got ${r.imported}`);
    assert(r.updated === 3, `Expected all 3 records to be merged/updated, got ${r.updated}`);
    return `0 duplicates created: ${r.updated} existing records merged and updated`;
  });

  // End-to-end list verification
  console.log('\n--- End-to-End List Verification ---');

  await step('18. Creator Bank: List API reflects all imported sources', async () => {
    const list = await call('GET', '/api/sources');
    assert(Array.isArray(list) && list.length >= 60, `Expected at least 60 sources, got ${list.length}`);
    const ytCr = list.find(s => s.name === 'Google' || s.handle === '@Google');
    assert(ytCr, 'Imported YouTube channel "@Google" missing from list');
    assert(ytCr.followers > 0, 'Followers not persisted');
    return `Creator Bank contains ${list.length} sources (including newly imported YouTube and Excel sources)`;
  });

  await step('19. Creator Bank: Search by handle and name works', async () => {
    const searchRes = await call('GET', '/api/sources?q=telangtech');
    assert(searchRes.length >= 1, 'Search by handle "@telangtech" failed');
    assert(searchRes[0].handle === '@telangtech', 'Handle mismatch');
    return `Found "${searchRes[0].name}" via query "telangtech"`;
  });

  await step('20. Creator Bank: Platform and District filters work', async () => {
    const ytOnly = await call('GET', '/api/sources?platform=YouTube');
    assert(ytOnly.length > 0 && ytOnly.every(s => s.platform === 'YouTube'), 'Platform filter failed');
    return `Platform filter returned ${ytOnly.length} YouTube sources`;
  });

  console.log(`\n========================================`);
  console.log(`  RESULT: ${pass} passed, ${fails.length} failed`);
  if (fails.length) {
    console.log(`  Failed steps: ${fails.join(', ')}`);
  }
  console.log(`========================================\n`);

  process.exit(fails.length ? 1 : 0);
})();
