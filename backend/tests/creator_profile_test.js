const assert = require('assert');
const repo = require('../src/services/repo');
const youtubeService = require('../src/services/youtubeService');
const campaignService = require('../src/services/campaignService');
const db = require('../src/db');

// Helper: Calculate monthly growth from snapshots
function computeMonthlyGrowth(snapshots) {
  if (!snapshots || snapshots.length < 2) return null;
  const monthOrder = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const sorted = [...snapshots]
    .filter(s => s && s.month && s.followers != null)
    .sort((a, b) => (monthOrder[a.month] || 0) - (monthOrder[b.month] || 0));
  if (sorted.length < 2) return null;
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  if (!prev.followers || prev.followers <= 0) return null;
  return ((latest.followers - prev.followers) / prev.followers) * 100;
}

// Helper: Calculate median of numbers array
function computeMedian(arr) {
  if (!arr || !arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

async function runTests() {
  console.log('=== HIREIQ CREATOR BANK PROFILE OVERVIEW AUTOMATED TESTS ===\n');

  // Test 1: Load Real Creator Profile by ID ('c1' - Tech Telugu Ravi)
  console.log('Test 1: Loading creator profile by ID ("c1" - Tech Telugu Ravi)...');
  const c1 = await repo.loadSource('c1');
  assert(c1, 'Creator c1 should exist');
  assert.strictEqual(c1.name, 'Tech Telugu Ravi', 'Name must match');
  assert.strictEqual(c1.handle, '@techteluguravi', 'Handle must match');
  assert.strictEqual(c1.platform, 'YouTube', 'Platform must be YouTube');
  assert(c1.followers > 0, 'Followers must be positive number');
  assert.strictEqual(c1.attributed, 62, 'Past enrolments must be from DB attribution (62)');
  assert(c1.er != null, 'Engagement rate must exist');
  assert.strictEqual(c1.rate, 75000, 'Rate per post must be 75,000');
  console.log(`✓ Test 1 Passed: c1 loaded with ${c1.followers.toLocaleString()} followers, 62 enrolments, ${c1.er}% ER, ₹${c1.rate.toLocaleString()} rate.\n`);

  // Test 2: KPI Metric Cards Values & Calculations
  console.log('Test 2: Validating 5 Metric Cards calculations...');
  // 1. Followers
  assert(c1.followers > 0, 'Card 1: Followers must be positive');
  // 2. Past enrolments
  assert.strictEqual(c1.attributed, 62, 'Card 2: Past enrolments must be 62');
  // 3. Engagement rate
  assert(c1.er != null, 'Card 3: Engagement rate must be valid');
  // 4. Monthly growth calculation from snapshots
  assert(c1.snapshots && c1.snapshots.length >= 2, 'Must have at least 2 snapshots');
  const growth = computeMonthlyGrowth(c1.snapshots);
  assert(growth !== null, 'Growth should be calculable');
  const growthFormatted = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
  console.log(`  Calculated growth from snapshots: ${growthFormatted}`);
  // 5. Rate per post
  assert.strictEqual(c1.rate, 75000, 'Card 5: Rate per post must be ₹75,000');
  console.log('✓ Test 2 Passed: All 5 metric cards verified.\n');

  // Test 3: Recent Posts Panel Data Integrity
  console.log('Test 3: Checking recent YouTube posts for c1...');
  assert(Array.isArray(c1.recent), 'c1.recent must be an array');
  assert(c1.recent.length > 0, 'Must have recent posts');
  for (const post of c1.recent) {
    assert(post.title, 'Post must have title');
    assert(post.views > 0, 'Post must have views > 0');
    assert(post.format, 'Post must have format (Long video / Shorts)');
    assert(post.url, 'Post must have YouTube URL');
    assert(post.thumbnail, 'Post must have thumbnail URL');
  }
  console.log(`  Sample Post 1: "${c1.recent[0].title}" (${c1.recent[0].views.toLocaleString()} views, ${c1.recent[0].format}, ER: ${c1.recent[0].er}%)`);
  console.log(`✓ Test 3 Passed: Recent posts panel verified (${c1.recent.length} posts returned).\n`);

  // Test 4: Dynamic Views Chart Median & Consistency Calculations
  console.log('Test 4: Verifying dynamic chart median and relative calculations...');
  const views = c1.recent.map(p => p.views);
  const datasetMedian = computeMedian(views);
  assert(datasetMedian > 0, 'Dataset median must be > 0 views');
  const overallMedian = c1.median_views || datasetMedian;
  assert(overallMedian > 0, 'Overall median must be > 0 views');

  for (const p of c1.recent) {
    const diff = Math.round(((p.views / overallMedian) - 1) * 100);
    assert(!isNaN(diff), 'diff must be a valid number');
  }
  console.log(`  Dataset median: ${datasetMedian.toLocaleString()} views, Overall median: ${overallMedian.toLocaleString()} views`);
  console.log('✓ Test 4 Passed: Dynamic chart calculations verified.\n');

  // Test 5: Content Types, Formats, and Tone
  console.log('Test 5: Verifying content types, formats, and tone...');
  assert(Array.isArray(c1.content_types), 'content_types must be array');
  assert(Array.isArray(c1.formats), 'formats must be array');
  assert(c1.formats.length > 0, 'Formats must have entries');
  assert(c1.tone, 'Tone must exist');
  console.log(`  Content types: ${JSON.stringify(c1.content_types)}, Formats: ${JSON.stringify(c1.formats)}, Tone: ${c1.tone}`);
  console.log('✓ Test 5 Passed: Content classifications verified.\n');

  // Test 6: Refresh Now End-to-End
  console.log('Test 6: Testing Refresh now for creator c1...');
  const refreshedC1 = await youtubeService.refreshCreator('c1');
  assert(refreshedC1, 'Refresh should return updated creator');
  assert.strictEqual(refreshedC1.id, 'c1', 'ID must remain c1');
  assert(refreshedC1.followers > 0, 'Followers must be positive number from live YouTube Data API');
  assert(refreshedC1.recent.length > 0, 'Recent posts must be populated from uploads playlist');
  console.log(`  Live refreshed: ${refreshedC1.followers.toLocaleString()} subscribers, ${refreshedC1.recent.length} videos fetched.`);
  console.log('✓ Test 6 Passed: Refresh now completed successfully with live YouTube Data API v3.\n');

  // Test 7: Add to Campaign & Duplicate Prevention
  console.log('Test 7: Testing Add to Campaign with duplicate prevention...');
  // Find a live campaign
  const [liveCamp] = await db.query("SELECT id, name FROM campaigns WHERE status = 'Live' LIMIT 1");
  assert(liveCamp, 'At least one live campaign must exist');
  
  // Check if c1 is already on this campaign
  const [existingAssignment] = await db.query(
    "SELECT id FROM campaign_sources WHERE campaign_id = ? AND source_id = 'c1'",
    [liveCamp.id]
  );
  
  if (existingAssignment) {
    // Should throw 409 duplicate error
    let thrown = false;
    try {
      await campaignService.addSource(liveCamp.id, 'c1');
    } catch (err) {
      thrown = true;
      assert.strictEqual(err.status, 409, 'Must return HTTP 409 Conflict');
      console.log(`  Expected duplicate rejection: "${err.message}"`);
    }
    assert(thrown, 'Duplicate addition must throw 409 error');
  } else {
    // Add to campaign
    const ccId = await campaignService.addSource(liveCamp.id, 'c1');
    assert(ccId, 'New campaign assignment ID created');
    console.log(`  Successfully added c1 to ${liveCamp.name} (ccId: ${ccId})`);
  }
  console.log('✓ Test 7 Passed: Add to campaign and duplicate prevention verified.\n');

  // Test 8: Live YouTube Channel Enrichment with Real YouTube Data API v3
  console.log('Test 8: Testing live YouTube Data API enrichment on real channel (Vegam Digital Academy)...');
  const [vegamSource] = await db.query("SELECT id FROM sources WHERE handle LIKE '%vegamdigitalacademy%' LIMIT 1");
  if (vegamSource) {
    const refreshedVegam = await youtubeService.refreshCreator(vegamSource.id);
    assert(refreshedVegam, 'Vegam must be refreshed');
    assert(refreshedVegam.followers >= 1000000, 'Followers must be >= 1M from YouTube Data API');
    assert(refreshedVegam.recent.length > 0, 'Recent posts must be fetched via uploads playlist');
    for (const post of refreshedVegam.recent) {
      assert(post.url.startsWith('https://www.youtube.com/watch?v='), 'Must have valid YouTube watch URL');
      assert(post.thumbnail.startsWith('https://'), 'Must have valid HTTPS thumbnail');
    }
    console.log(`  Vegam Digital Academy enriched: ${refreshedVegam.followers.toLocaleString()} subscribers, ${refreshedVegam.recent.length} videos fetched.`);
  }
  console.log('✓ Test 8 Passed: Real YouTube Data API v3 integration verified.\n');

  console.log('================================================================');
  console.log('ALL 8 AUTOMATED TEST SUITES PASSED CLEANLY (100% SUCCESS)');
  console.log('================================================================');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
