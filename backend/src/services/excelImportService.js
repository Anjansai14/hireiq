/**
 * Excel / Spreadsheet Import Service for HireIQ Creator Bank.
 * Handles:
 *  - Parsing .xlsx, .xls, and .csv workbooks
 *  - Dynamic sheet detection and header row identification
 *  - Column alias mapping to Creator Bank schema
 *  - Row normalization, validation, and error reporting
 *  - Merging existing records vs creating new ones (with update policy)
 *  - Generating downloadable official Excel template
 */
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('../db');
const settings = require('./settings');
const { uid, HttpError } = require('../utils/helpers');

// Supported platforms
const PLATFORMS = ['YouTube', 'Instagram', 'LinkedIn', 'Facebook', 'WhatsApp'];

const PLATFORM_MAP = {
  youtube: 'YouTube',
  yt: 'YouTube',
  instagram: 'Instagram',
  ig: 'Instagram',
  insta: 'Instagram',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  fb: 'Facebook',
  whatsapp: 'WhatsApp',
  wa: 'WhatsApp',
};

// Supported source types
const SOURCE_TYPES = [
  'Micro-influencer',
  'College network',
  'Placement cell',
  'Alumnus',
  'Trainer or mentor',
  'Community leader',
  'Digital creator',
];

const SOURCE_TYPE_MAP = {
  'micro-influencer': 'Micro-influencer',
  'micro influencer': 'Micro-influencer',
  'micro': 'Micro-influencer',
  'influencer': 'Micro-influencer',
  'college network': 'College network',
  'college': 'College network',
  'placement cell': 'Placement cell',
  'placement': 'Placement cell',
  'placements': 'Placement cell',
  'alumnus': 'Alumnus',
  'alumni': 'Alumnus',
  'trainer or mentor': 'Trainer or mentor',
  'trainer': 'Trainer or mentor',
  'mentor': 'Trainer or mentor',
  'community leader': 'Community leader',
  'community': 'Community leader',
  'digital creator': 'Digital creator',
  'creator': 'Digital creator',
  'it training institute / edtech': 'Trainer or mentor',
  'it training institute': 'Trainer or mentor',
  'training institute': 'Trainer or mentor',
  'edtech': 'Trainer or mentor',
  'individual tech creator': 'Digital creator',
  'tech creator': 'Digital creator',
  'tech recruitment & career portal': 'Placement cell',
  'tech recruitment': 'Placement cell',
  'career portal': 'Placement cell',
  'recruitment portal': 'Placement cell',
};

const INSTITUTIONAL_TYPES = ['College network', 'Placement cell'];

// Column header aliases mapping
const COLUMN_ALIASES = {
  name: ['source', 'name', 'creator', 'creator name', 'source name', 'display name', 'influencer', 'influencer name', 'title', 'channel name', 'channel_name', 'youtube channel', 'account name'],
  handle: ['handle', 'username', 'profile handle', '@handle', 'account', 'user name', 'social handle', 'custom url', 'channel handle'],
  platform: ['platform', 'social media', 'network', 'medium'], // 'channel' removed to prevent collision with channel_id, channel_name, channel_type
  type: ['type', 'source type', 'creator type', 'category', 'role', 'type of source', 'channel type', 'channel_type'],
  profile_link: ['profile link', 'url', 'link', 'profile url', 'channel url', 'channel_url', 'page url', 'profile_link', 'website', 'youtube url'],
  external_id: ['channel id', 'channel_id', 'external id', 'external_id', 'youtube id', 'creator id', 'id'],
  followers: ['followers', 'audience', 'audience size', 'subscribers', 'reach', 'follower count', 'subs', 'subscribe count', 'subscribe_count', 'subscribers count'],
  er: ['er', 'engagement rate', 'er %', 'er(%)', 'engagement', 'engagement %'],
  median_views: ['median views', 'mv', 'median_views', 'avg views', 'average views', 'views', 'view count', 'view_count', 'total views'],
  rate: ['rate', 'fee', 'rate per post', 'cost per post', 'commercials', 'price', 'rate (inr)', 'rate inr', 'cost'],
  district: ['district', 'location', 'city', 'region', 'market', 'state', 'territory'],
  language: ['language', 'languages', 'primary language', 'content language', 'langs'],
  skills: ['skills', 'skill domains', 'skill domain', 'topics', 'domain', 'skill', 'topic'],
  affiliation: ['affiliation', 'college', 'organization', 'institution', 'college / org', 'network'],
  attributed: ['attributed', 'enrolments', 'attributed enrolments', 'enrolments attributed', 'conversions'],
  consent: ['consent', 'consent status', 'institutional consent'],
  consent_date: ['consent date', 'date of consent', 'consent_date'],
  consent_basis: ['consent basis', 'basis', 'consent_basis'],
  catchment: ['catchment', 'institutional reach', 'network size', 'catchment size'],
  collab: ['collaboration', 'collab', 'deal type', 'payment type'],
  account_type: ['account type', 'entity type', 'account_type'],
  tone: ['tone', 'content tone', 'style'],
  description: ['description', 'bio', 'about', 'channel description'],
  video_count: ['video count', 'video_count', 'videos', 'total videos'],
  contact_email: ['email', 'contact email', 'email address', 'contact_email'],
  contact_phone: ['phone', 'contact phone', 'phone number', 'mobile', 'contact_phone'],
};

function normalizeHeader(str) {
  if (!str) return '';
  return String(str).toLowerCase().trim().replace(/[\r\n\t_]+/g, ' ').replace(/\s+/g, ' ');
}

function resolvePlatformFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const t = url.toLowerCase();
  if (t.includes('youtube.com') || t.includes('youtu.be')) return 'YouTube';
  if (t.includes('instagram.com')) return 'Instagram';
  if (t.includes('linkedin.com')) return 'LinkedIn';
  if (t.includes('facebook.com') || t.includes('fb.com')) return 'Facebook';
  if (t.includes('whatsapp') || t.includes('chat.whatsapp.com')) return 'WhatsApp';
  return null;
}

function resolveHandleFromUrl(url, platform) {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();

  // YouTube
  if (t.includes('youtube.com') || t.includes('youtu.be')) {
    const m = t.match(/@([a-zA-Z0-9_.-]+)/);
    if (m) return '@' + m[1];
    const c = t.match(/youtube\.com\/(?:c\/|user\/)?([a-zA-Z0-9_.-]+)/i);
    if (c) return '@' + c[1];
    return null;
  }

  // Instagram
  if (t.includes('instagram.com')) {
    const m = t.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i);
    if (m && !['p', 'reel', 'stories', 'explore'].includes(m[1].toLowerCase())) {
      return '@' + m[1];
    }
  }

  // LinkedIn
  if (t.includes('linkedin.com')) {
    const m = t.match(/linkedin\.com\/(in|company|school)\/([a-zA-Z0-9_.-]+)/i);
    if (m) return `linkedin.com/${m[1]}/${m[2]}`;
  }

  // Facebook
  if (t.includes('facebook.com') || t.includes('fb.com')) {
    const m = t.match(/(?:facebook\.com|fb\.com)\/(?:groups\/)?([a-zA-Z0-9_.]+)/i);
    if (m) return `fb.com/${m[1]}`;
  }

  return null;
}

function calculateTier(followers) {
  const f = Number(followers) || 0;
  if (f >= 1000000) return 'Mega';
  if (f >= 500000) return 'Macro';
  if (f >= 100000) return 'Mid';
  if (f >= 10000) return 'Micro';
  return 'Nano';
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const clean = String(val).replace(/,/g, '').replace(/₹/g, '').replace(/%/g, '').trim();
  if (clean === '') return null;
  const n = Number(clean);
  return isNaN(n) ? null : n;
}

function parseString(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function safeUnicodeSlice(str, maxLen = 500) {
  if (!str) return null;
  const chars = Array.from(String(str));
  return chars.slice(0, maxLen).join('');
}

/**
 * Read and normalize raw rows from workbook file.
 */
function readWorkbookData(filePathOrBuffer) {
  let workbook;
  if (Buffer.isBuffer(filePathOrBuffer)) {
    workbook = XLSX.read(filePathOrBuffer, { type: 'buffer' });
  } else {
    workbook = XLSX.readFile(filePathOrBuffer);
  }

  if (!workbook || !workbook.SheetNames || !workbook.SheetNames.length) {
    throw new HttpError(400, 'The uploaded spreadsheet contains no sheets or is corrupted.');
  }

  // Choose sheet: prioritize sheet with relevant names, else first sheet with rows
  let targetSheetName = workbook.SheetNames[0];
  const preferredNames = ['creators', 'sources', 'creator bank', 'sheet1', 'data'];
  for (const name of workbook.SheetNames) {
    if (preferredNames.includes(name.toLowerCase().trim())) {
      targetSheetName = name;
      break;
    }
  }

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new HttpError(400, `Could not read worksheet "${targetSheetName}".`);
  }

  // Convert to 2D array of rows
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (!rawRows || !rawRows.length) {
    throw new HttpError(400, 'The selected worksheet contains no data rows.');
  }

  // Detect header row index
  let headerIndex = -1;
  let headerMap = {}; // normalizedKey -> colIndex

  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;
    const colMatches = {};
    const matchedCols = new Set();

    // Pass 1: Exact matches across all columns
    for (let c = 0; c < row.length; c++) {
      const cellVal = normalizeHeader(row[c]);
      if (!cellVal) continue;
      for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (colMatches[key] === undefined && !matchedCols.has(c) && aliases.includes(cellVal)) {
          colMatches[key] = c;
          matchedCols.add(c);
          break;
        }
      }
    }

    // Pass 2: Fuzzy word-boundary matches for remaining unmapped columns
    for (let c = 0; c < row.length; c++) {
      if (matchedCols.has(c)) continue;
      const cellVal = normalizeHeader(row[c]);
      if (!cellVal) continue;
      for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (colMatches[key] === undefined && !matchedCols.has(c)) {
          const match = aliases.some(a => {
            if (a.length < 3) return false;
            try {
              const regex = new RegExp(`\\b${a.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
              return regex.test(cellVal);
            } catch {
              return cellVal === a;
            }
          });
          if (match) {
            colMatches[key] = c;
            matchedCols.add(c);
            break;
          }
        }
      }
    }
    // A header row must match 'name' or ('handle' and 'platform') or ('external_id' and 'profile_link') or ('name' and 'profile_link')
    if (
      colMatches.name !== undefined ||
      (colMatches.handle !== undefined && colMatches.platform !== undefined) ||
      (colMatches.external_id !== undefined && colMatches.profile_link !== undefined) ||
      (colMatches.name !== undefined && colMatches.profile_link !== undefined)
    ) {
      headerIndex = r;
      headerMap = colMatches;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new HttpError(400, 'Could not detect column headers. Please ensure the file contains columns like "Source Name", "Handle", "Platform", and "Source Type", or download our template.');
  }

  // Collect data rows starting after header
  const dataRows = [];
  for (let r = headerIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    // Check if row is completely empty
    const isAllBlank = row.every(cell => cell === '' || cell === null || cell === undefined || String(cell).trim() === '');
    if (isAllBlank) continue;

    // Extract fields based on header map
    const rowObj = { _rowNumber: r + 1 };
    for (const [key, colIdx] of Object.entries(headerMap)) {
      rowObj[key] = row[colIdx] !== undefined ? row[colIdx] : '';
    }
    dataRows.push(rowObj);
  }

  return { sheetName: targetSheetName, dataRows, headerMap };
}

/**
 * Import all rows from an Excel or CSV file into the Creator Bank.
 */
async function importWorkbook(file, { user = {} } = {}) {
  if (!file) throw new HttpError(400, 'No file uploaded.');

  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    throw new HttpError(400, `Unsupported file format ".${ext}". Please upload an .xlsx, .xls, or .csv spreadsheet.`);
  }

  const { sheetName, dataRows } = readWorkbookData(file.path || file.buffer);
  const totalRows = dataRows.length;

  if (totalRows === 0) {
    throw new HttpError(400, 'The worksheet does not contain any populated creator rows.');
  }

  const today = (await settings.today()) || new Date().toISOString().slice(0, 10);
  const typesCfg = await settings.typeSets();
  const institutionalTypes = typesCfg?.institutional || INSTITUTIONAL_TYPES;
  const userName = user.name || 'User';

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];
  const createdIds = [];

  // Track handles seen within this file to detect workbook-internal duplicates
  const seenInWorkbook = new Map(); // handleLower -> firstRowNumber

  for (const raw of dataRows) {
    const rowNum = raw._rowNumber;
    let name = parseString(raw.name);
    let handle = parseString(raw.handle);
    let platform = parseString(raw.platform);
    let type = parseString(raw.type);
    const profileLink = parseString(raw.profile_link);
    let externalId = parseString(raw.external_id);
    const desc = parseString(raw.description);
    const videoCount = parseNumber(raw.video_count);

    // Safeguard: Never confuse a YouTube channel ID with a platform name or creator name!
    if (platform && (platform.startsWith('UC') && platform.length >= 20)) {
      if (!externalId) externalId = platform;
      platform = 'YouTube';
    }
    if (name && (name.startsWith('UC') && name.length === 24) && !profileLink && !raw.channel_name) {
      if (!externalId) externalId = name;
      name = ''; // Do not use channel ID as creator name
    }

    // 1. Resolve Platform if missing or messy
    if (!platform) {
      if (profileLink) {
        platform = resolvePlatformFromUrl(profileLink);
      }
      if (!platform && externalId && externalId.startsWith('UC')) {
        platform = 'YouTube';
      }
    }
    if (platform) {
      const platLower = platform.toLowerCase().trim();
      platform = PLATFORM_MAP[platLower] || PLATFORMS.find(p => p.toLowerCase() === platLower) || platform;
    }

    // 2. Resolve Handle if missing
    if (!handle && profileLink) {
      handle = resolveHandleFromUrl(profileLink, platform);
    }
    if (!handle && externalId) {
      handle = '@' + externalId.toLowerCase();
    }

    // 3. Normalize handle formatting
    if (handle) {
      if (platform === 'YouTube' || platform === 'Instagram') {
        if (!handle.startsWith('@') && !handle.includes('/')) {
          handle = '@' + handle;
        }
      }
    }

    // 4. Validate Required Fields
    if (!name) {
      failed++;
      errors.push({ row: rowNum, source: handle || externalId || 'Unknown', reason: 'Missing required field: "Source Name"' });
      continue;
    }

    if (!platform || !PLATFORMS.includes(platform)) {
      failed++;
      errors.push({
        row: rowNum,
        source: name,
        reason: platform
          ? `Unsupported platform "${platform}". Must be one of: ${PLATFORMS.join(', ')}`
          : 'Missing required field: "Platform" (or valid Profile URL)',
      });
      continue;
    }

    if (!handle) {
      failed++;
      errors.push({ row: rowNum, source: name, reason: 'Missing required field: "Handle" (or valid Profile URL)' });
      continue;
    }

    // 5. Normalize Source Type
    if (type) {
      const typeLower = type.toLowerCase().trim();
      type = SOURCE_TYPE_MAP[typeLower] || SOURCE_TYPES.find(t => t.toLowerCase() === typeLower) || type;
    }
    if (!type || !SOURCE_TYPES.includes(type)) {
      // Default type based on institutional check
      type = 'Digital creator';
    }

    const isInstitutional = institutionalTypes.includes(type);

    // 6. Check duplicates within the same workbook
    const dupKey = `${platform}:${handle.toLowerCase()}`;
    if (seenInWorkbook.has(dupKey)) {
      // Already processed earlier in this file
      skipped++;
      continue;
    }
    seenInWorkbook.set(dupKey, rowNum);

    // 7. Parse Metrics & Attributes
    const followers = parseNumber(raw.followers) ?? 0;
    let medianViews = parseNumber(raw.median_views);
    if (medianViews && videoCount && videoCount > 0 && medianViews > 1000000) {
      medianViews = Math.round(medianViews / videoCount);
    }
    const er = parseNumber(raw.er);
    let rate = parseNumber(raw.rate);
    const catchment = isInstitutional ? (parseNumber(raw.catchment) || followers || null) : null;
    const attributed = parseNumber(raw.attributed) ?? 0;
    let district = parseString(raw.district) || null;
    if (district) {
      const distLower = district.toLowerCase();
      if (distLower.includes('telangana') || distLower.includes('andhra')) {
        const descText = (desc || '').toLowerCase();
        if (descText.includes('warangal') || descText.includes('hanamkonda')) district = 'Warangal';
        else if (descText.includes('karimnagar')) district = 'Karimnagar';
        else if (descText.includes('khammam')) district = 'Khammam';
        else if (descText.includes('nalgonda')) district = 'Nalgonda';
        else if (descText.includes('nizamabad')) district = 'Nizamabad';
        else district = 'Hyderabad';
      }
    }
    const languageStr = parseString(raw.language);
    const skillsStr = parseString(raw.skills);
    const affiliation = parseString(raw.affiliation) || null;
    const consentVal = parseString(raw.consent);
    const tone = parseString(raw.tone) || 'Conversational';
    const email = parseString(raw.contact_email);
    const phone = parseString(raw.contact_phone);

    // Tier calculation
    const tier = calculateTier(followers);

    // Rate default if not provided
    if (rate === null) {
      if (isInstitutional) {
        rate = 0;
      } else {
        const tierRates = { Mega: 150000, Macro: 75000, Mid: 35000, Micro: 15000, Nano: 5000 };
        rate = tierRates[tier] || 15000;
      }
    }

    // Consent resolution
    let consent = 'Not required';
    if (isInstitutional) {
      consent = consentVal && consentVal.toLowerCase().includes('recorded') ? 'Recorded' : 'Missing';
    }

    // Collab & Account type
    const collab = parseString(raw.collab) || (rate > 0 ? 'Paid' : isInstitutional ? 'Partnership' : 'Unpaid');
    const accountType = parseString(raw.account_type) || (isInstitutional ? 'Institutional' : 'Individual');

    // Language dict
    let langs = {};
    if (languageStr) {
      const parts = languageStr.split(/[,/&]+/).map(s => s.trim()).filter(Boolean);
      if (parts.length === 1) {
        langs[parts[0]] = 100;
      } else if (parts.length > 1) {
        const share = Math.round(100 / parts.length);
        parts.forEach((p, idx) => {
          langs[p] = idx === parts.length - 1 ? 100 - share * (parts.length - 1) : share;
        });
      }
    }

    // Markets dict
    const markets = district ? { [district]: 100 } : {};

    // Skills array & Topics
    const skills = skillsStr ? skillsStr.split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [];
    const topics = {};
    skills.forEach(sk => {
      topics[sk] = 0.8;
    });

    // Formats
    const formats = platform === 'YouTube'
      ? ['Long video', 'Shorts']
      : platform === 'LinkedIn'
      ? ['Posts']
      : platform === 'WhatsApp'
      ? ['Broadcast message']
      : ['Reels'];

    // Contact object
    const contact = {
      email: email || '—',
      phone: phone || '—',
      profile_link: profileLink || null,
      channelId: externalId || null,
      description: safeUnicodeSlice(desc, 500),
      totalVideos: videoCount || null,
      totalViews: parseNumber(raw.median_views) || null,
    };

    // 8. Database Duplicate Match
    try {
      const existing = await db.one(
        `SELECT id, name, handle, followers, median_views, er, rate, district, langs, markets, skills, topics, affiliation, consent, contact
         FROM sources 
         WHERE platform = ? AND (
           LOWER(handle) = LOWER(?) 
           OR (affiliation IS NOT NULL AND affiliation = ?)
           OR (? IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(contact, '$.channelId')) = ?)
         )
         LIMIT 1`,
        [platform, handle, profileLink || handle, externalId || null, externalId || null]
      );

      if (existing) {
        // MERGE POLICY: Update provided metrics, preserve existing user fields
        const existingContact = typeof existing.contact === 'string' ? JSON.parse(existing.contact || '{}') : (existing.contact || {});
        const mergedContact = { ...existingContact, ...contact };
        if (!email && existingContact.email) mergedContact.email = existingContact.email;
        if (!phone && existingContact.phone) mergedContact.phone = existingContact.phone;

        const updateData = {
          name,
          type,
          tier,
          followers: followers > 0 ? followers : existing.followers,
          median_views: medianViews !== null ? medianViews : existing.median_views,
          er: er !== null ? er : existing.er,
          rate: rate > 0 ? rate : existing.rate,
          collab,
          account_type: accountType,
          status: 'Enriched',
          updated_on: today,
          next_refresh: new Date(Date.now() + 31 * 864e5).toISOString().slice(0, 10),
          contact: mergedContact,
        };

        if (district) updateData.district = district;
        if (Object.keys(markets).length) updateData.markets = markets;
        if (Object.keys(langs).length) updateData.langs = langs;
        if (skills.length) {
          updateData.skills = skills;
          updateData.topics = topics;
        }
        if (affiliation) updateData.affiliation = affiliation;
        if (isInstitutional) updateData.consent = consent;
        if (catchment !== null) updateData.catchment = catchment;
        if (attributed > 0) updateData.attributed = attributed;

        await db.update('sources', updateData, 'id = ?', [existing.id]);
        await db.insert('source_activity', {
          source_id: existing.id,
          date: today,
          text: `Updated from spreadsheet "${file.originalname}" by ${userName}`,
        });

        updated++;
      } else {
        // INSERT New Record
        const sourceId = uid('c');
        const nextRefresh = new Date(Date.now() + 31 * 864e5).toISOString().slice(0, 10);

        await db.insert('sources', {
          id: sourceId,
          name,
          handle,
          platform,
          type,
          tier,
          followers,
          median_views: medianViews,
          er,
          langs,
          markets,
          content_types: [],
          tone,
          formats,
          topics,
          rate,
          rate_src: isInstitutional ? 'Partnership' : 'Illustrative',
          verif: 'Verified',
          acct: isInstitutional ? 'Institution' : 'Creator',
          collab,
          account_type: accountType,
          status: 'Enriched',
          status_note: `Imported from ${file.originalname}`,
          updated_on: today,
          next_refresh: nextRefresh,
          last_post: today,
          data_source: 'Uploaded',
          connected: 0,
          affiliation,
          consent,
          catchment,
          district,
          cohort: isInstitutional ? 'College students & alumni' : 'Graduates & Tech aspirants',
          skills,
          attributed,
          growth: 1.0,
          contact,
        });

        await db.insert('source_activity', {
          source_id: sourceId,
          date: today,
          text: `Imported from spreadsheet "${file.originalname}" by ${userName}`,
        });

        createdIds.push(sourceId);
        imported++;
      }
    } catch (err) {
      failed++;
      errors.push({
        row: rowNum,
        source: name,
        handle,
        reason: `Database error: ${err.message}`,
      });
    }
  }

  // Clean up uploaded temporary file
  if (file.path && fs.existsSync(file.path)) {
    try { fs.unlinkSync(file.path); } catch {}
  }

  return {
    ok: true,
    sheetName,
    totalRows,
    imported,
    updated,
    skipped,
    failed,
    errors,
    createdIds,
    message: `Processed ${totalRows} rows: ${imported} imported, ${updated} updated, ${skipped} duplicate rows skipped, ${failed} failed.`,
  };
}

/**
 * Generate official downloadable template (.xlsx or .csv)
 */
function generateTemplate(format = 'xlsx') {
  const headers = [
    'Source Name',
    'Handle',
    'Platform',
    'Source Type',
    'Profile URL',
    'Followers',
    'ER (%)',
    'Median Views',
    'Rate (INR)',
    'District',
    'Language',
    'Skill Domains',
    'Affiliation',
    'Institutional Consent',
    'Enrolments Attributed',
    'Contact Email',
    'Contact Phone',
  ];

  const sampleRows = [
    [
      'Tech Telugu Ravi',
      '@techteluguravi',
      'YouTube',
      'Digital creator',
      'https://youtube.com/@techteluguravi',
      820000,
      4.6,
      182000,
      75000,
      'Hyderabad',
      'Telugu',
      'AI/ML, Career guidance',
      '',
      'Not required',
      62,
      'ravi@telugutech.com',
      '+91 98480 22334',
    ],
    [
      'Coding with Sravani',
      '@codingwithsravani',
      'Instagram',
      'Micro-influencer',
      'https://instagram.com/codingwithsravani',
      214000,
      7.8,
      48000,
      45000,
      'Hyderabad',
      'Telugu',
      'Software development, Interview prep',
      '',
      'Not required',
      18,
      'sravani.code@gmail.com',
      '+91 91234 56789',
    ],
    [
      'KITS Warangal Placement Cell',
      'KITS-W placement broadcast',
      'WhatsApp',
      'Placement cell',
      '',
      4200,
      null,
      null,
      0,
      'Warangal',
      'Telugu',
      'Placements',
      'KITS Warangal',
      'Recorded',
      41,
      'placements@kitsw.ac.in',
      '+91 870 256 4888',
    ],
    [
      'Sai Kiran Reddy',
      'linkedin.com/in/saikiran-ml',
      'LinkedIn',
      'Alumnus',
      'https://linkedin.com/in/saikiran-ml',
      18000,
      5.4,
      3200,
      15000,
      'Hyderabad',
      'English',
      'AI/ML, Data engineering',
      'PeopleTech Alumni',
      'Not required',
      27,
      'saikiran.ml@outlook.com',
      '+91 97012 34567',
    ],
    [
      'Telangana Engineering Students',
      'fb.com/groups/tgengineers',
      'Facebook',
      'College network',
      'https://facebook.com/groups/tgengineers',
      342000,
      2.4,
      52000,
      18000,
      'Hyderabad',
      'Telugu',
      'Placements, Career guidance',
      '14 regional engineering colleges',
      'Recorded',
      6,
      'groupstgengineers@gmail.com',
      '+91 91568 17638',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  // Adjust column widths
  ws['!cols'] = [
    { wch: 30 }, // Source Name
    { wch: 26 }, // Handle
    { wch: 14 }, // Platform
    { wch: 20 }, // Source Type
    { wch: 38 }, // Profile URL
    { wch: 12 }, // Followers
    { wch: 10 }, // ER (%)
    { wch: 14 }, // Median Views
    { wch: 12 }, // Rate (INR)
    { wch: 16 }, // District
    { wch: 16 }, // Language
    { wch: 34 }, // Skill Domains
    { wch: 30 }, // Affiliation
    { wch: 22 }, // Institutional Consent
    { wch: 20 }, // Enrolments Attributed
    { wch: 28 }, // Contact Email
    { wch: 18 }, // Contact Phone
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Creator Bank');

  if (format === 'csv') {
    return XLSX.utils.sheet_to_csv(ws);
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  importWorkbook,
  generateTemplate,
  readWorkbookData,
  resolvePlatformFromUrl,
  resolveHandleFromUrl,
  calculateTier,
};
