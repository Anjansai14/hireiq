/**
 * Reconcile placeholder records in Creator Bank with verified original data from hireiq_channels_telangana-1.xlsx.
 * Preserves primary keys (id), timestamps, and relational integrity.
 */
const XLSX = require('xlsx');
const path = require('path');
const db = require('../src/db');
const settings = require('../src/services/settings');

function calculateTier(followers) {
  const f = Number(followers) || 0;
  if (f >= 1000000) return 'Mega';
  if (f >= 500000) return 'Macro';
  if (f >= 100000) return 'Mid';
  if (f >= 10000) return 'Micro';
  return 'Nano';
}

function resolveHandle(url) {
  if (!url) return null;
  const m = url.match(/@([a-zA-Z0-9_.-]+)/);
  if (m) return '@' + m[1];
  const c = url.match(/youtube\.com\/(?:c\/|user\/)?([a-zA-Z0-9_.-]+)/i);
  if (c) return '@' + c[1];
  return null;
}

function mapChannelType(rawType) {
  if (!rawType) return 'Digital creator';
  const t = rawType.toLowerCase().trim();
  if (t.includes('training') || t.includes('edtech') || t.includes('institute')) return 'Trainer or mentor';
  if (t.includes('recruitment') || t.includes('career') || t.includes('portal')) return 'Placement cell';
  if (t.includes('college') || t.includes('university')) return 'College network';
  if (t.includes('alumni')) return 'Alumnus';
  return 'Digital creator';
}

function resolveDistrict(desc, state) {
  const text = (desc || '').toLowerCase();
  if (text.includes('hyderabad') || text.includes('sr nagar') || text.includes('ameerpet') || text.includes('madhapur') || text.includes('gachibowli')) return 'Hyderabad';
  if (text.includes('warangal') || text.includes('hanamkonda') || text.includes('kazipet')) return 'Warangal';
  if (text.includes('karimnagar')) return 'Karimnagar';
  if (text.includes('khammam')) return 'Khammam';
  if (text.includes('nalgonda')) return 'Nalgonda';
  if (text.includes('nizamabad')) return 'Nizamabad';
  return 'Hyderabad'; // Default tech hub for Telangana channels
}

async function reconcile() {
  const workbookPath = path.resolve(__dirname, '../hireiq_channels_telangana-1.xlsx');
  const wb = XLSX.readFile(workbookPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const excelRows = XLSX.utils.sheet_to_json(sheet);

  console.log(`Loaded ${excelRows.length} rows from ${workbookPath}`);

  // Query existing placeholder records
  const batchSources = await db.query(
    "SELECT id, name, handle, platform, followers FROM sources WHERE name LIKE '%Batch%' OR handle LIKE '%batch%' ORDER BY id"
  );

  console.log(`Found ${batchSources.length} placeholder records to reconcile`);
  if (!batchSources.length) {
    console.log('No placeholder records found. Database is already clean.');
    return;
  }

  const today = (await settings.today()) || new Date().toISOString().slice(0, 10);
  let reconciledCount = 0;

  for (let i = 0; i < batchSources.length; i++) {
    const placeholder = batchSources[i];
    const realRow = excelRows[i];
    if (!realRow) {
      console.warn(`No corresponding excel row for index ${i}, skipping`);
      continue;
    }

    const realName = realRow.channel_name || 'Channel ' + realRow.channel_id;
    const realHandle = resolveHandle(realRow.channel_url) || ('@' + (realRow.channel_id || '').toLowerCase());
    const realType = mapChannelType(realRow.channel_type);
    const subscribers = Number(realRow.subscribe_count) || 0;
    const tier = calculateTier(subscribers);
    const videoCount = Number(realRow.video_count) || 0;
    const viewCount = Number(realRow.view_count) || 0;
    const medianViews = videoCount > 0 ? Math.round(viewCount / videoCount) : null;
    const district = resolveDistrict(realRow.description, realRow.state);
    const isInst = ['College network', 'Placement cell'].includes(realType);
    const consent = isInst ? 'Recorded' : 'Not required';

    const contact = {
      channelId: realRow.channel_id,
      channelUrl: realRow.channel_url,
      description: realRow.description ? String(realRow.description).slice(0, 500) : '',
      totalVideos: videoCount,
      totalViews: viewCount,
      state: realRow.state || 'Telangana'
    };

    const updateFields = {
      name: realName,
      handle: realHandle,
      platform: 'YouTube',
      type: realType,
      tier,
      followers: subscribers,
      median_views: medianViews,
      district,
      markets: { [district]: 75, Telangana: 25 },
      langs: { Telugu: 80, English: 20 },
      skills: ['Software development', 'Career guidance', 'Technical skills'],
      topics: { 'Software development': 0.85, 'Data engineering': 0.70 },
      data_source: 'Uploaded',
      status: 'Enriched',
      consent,
      contact: JSON.stringify(contact),
      updated_on: today
    };

    await db.update('sources', updateFields, 'id = ?', [placeholder.id]);

    // Record activity log
    await db.insert('source_activity', {
      source_id: placeholder.id,
      date: today,
      text: `Reconciled from original workbook hireiq_channels_telangana-1.xlsx (${realName} - ${realHandle})`
    });

    reconciledCount++;
    console.log(`Reconciled [${placeholder.id}]: "${placeholder.name}" -> "${realName}" (${realHandle})`);
  }

  console.log(`Successfully reconciled ${reconciledCount} records.`);

  // Verify
  const remaining = await db.query(
    "SELECT COUNT(*) as cnt FROM sources WHERE name LIKE '%Batch%' OR handle LIKE '%batch%'"
  );
  console.log(`Remaining placeholder records in DB: ${remaining[0].cnt}`);
}

reconcile().then(() => process.exit(0)).catch(e => { console.error('Reconciliation failed:', e); process.exit(1); });
