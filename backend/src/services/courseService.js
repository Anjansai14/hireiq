/**
 * Course brief logic: form → readiness fields, confirmation of file-extracted
 * values, governance (RR-H02 eligibility screen, RR-H03 outcome claims),
 * Agent A1 extraction and Agent A2 reads.
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const settings = require('./settings');
const repo = require('./repo');
const ai = require('./ai');
const { uid, fmtDate, HttpError } = require('../utils/helpers');

/** Readiness field value derived from the raw form. */
function fieldValue(key, f) {
  const j = (a) => (Array.isArray(a) ? a.join(', ') : a || '');
  switch (key) {
    case 'domain': return [f.domain, f.level].filter(Boolean).join(' · ');
    case 'duration': return [f.duration, f.mode].filter(Boolean).join(' · ');
    case 'locations': return j(f.locations);
    case 'batch': return f.batchStart ? `${fmtDate(f.batchStart)}${f.batchEnd ? ' – ' + fmtDate(f.batchEnd) : ''}${f.screenClose ? ' · screening closes ' + fmtDate(f.screenClose) : ''}` : '';
    case 'target': return f.target && f.ceiling ? `${f.target} screening enrolments · ₹${Number(String(f.ceiling).replace(/,/g, '')).toLocaleString('en-IN')} per enrolment` : '';
    case 'budget': return f.budget ? `₹${f.budget}` : '';
    case 'fee': return [f.fee, f.stipend && `${f.stipend} stipend`].filter(Boolean).join(' · ');
    case 'langs': return j(f.langs);
    default: return f[key] || '';
  }
}
const FIELD_INPUTS = { domain: ['domain', 'level'], duration: ['duration', 'mode'], batch: ['batchStart', 'batchEnd', 'screenClose'], target: ['target', 'ceiling'], fee: ['fee', 'stipend'] };

async function screen(text) {
  const r = await fetch(`${require('../config').ai.url}/v1/governance/screen`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Service-Key': require('../config').ai.key }, body: JSON.stringify({ text }),
  }).then((x) => x.json()).catch(() => ({ refused: false, claim: false }));
  return r;
}

/** Recompute brief_fields + governance after any form change. */
async function syncBrief(courseId, user) {
  const c = await db.one('SELECT * FROM courses WHERE id = ?', [courseId]);
  const form = c.form || {};
  const src = c.form_src || {};
  const fields = await db.query('SELECT * FROM brief_fields WHERE course_id = ?', [courseId]);
  const today = await settings.today();

  for (const b of fields) {
    const value = fieldValue(b.field_key, form);
    const inputs = FIELD_INPUTS[b.field_key] || [b.field_key];
    const fromFile = inputs.map((k) => src[k]).find(Boolean);
    let status = !value ? 'Missing' : fromFile ? 'Unconfirmed' : 'Confirmed';
    let source = !value ? null : fromFile ? fromFile : b.value && b.value !== value ? 'Edited' : b.source || 'Entered';
    if (b.field_key === 'outcome' && value) {
      const r = await screen(value);
      if (r.claim) {
        status = 'Unconfirmed';
        const exists = await db.one('SELECT id FROM course_claims WHERE course_id = ? AND text = ?', [courseId, value]);
        if (!exists) await db.insert('course_claims', { id: uid('cl'), course_id: courseId, text: value, source: source || 'Entered', status: 'Awaiting evidence' });
        await setFlag(courseId, 'Outcome claims', 'Under review', `Outcome promise "${value}" is held as a claim awaiting Observed evidence (RR-H03).`);
      }
    }
    if (b.field_key === 'eligibility' && value) {
      const r = await screen(value);
      if (r.refused && r.rule === 'RR-H02') {
        status = 'Unconfirmed';
        await setFlag(courseId, 'Eligibility', 'Refused', 'Eligibility uses a protected attribute (RR-H02). Escalated to the fairness reviewer.');
        await db.insert('fairness_escalations', { rule_code: 'RR-H02', user_id: user?.id || null, context: 'brief.eligibility', request: value });
      } else {
        await db.query("DELETE FROM governance_flags WHERE course_id = ? AND type = 'Eligibility'", [courseId]);
      }
    }
    if (b.value !== value || b.status !== status) {
      await db.update('brief_fields', { value: value || null, status, source, updated_at: today }, 'course_id = ? AND field_key = ?', [courseId, b.field_key]);
    }
  }
  const tgt = parseInt(String(form.target || '').replace(/,/g, ''), 10) || null;
  const ceil = parseInt(String(form.ceiling || '').replace(/,/g, ''), 10) || null;
  await db.update('courses', { title: form.title || c.title, batch: form.batchName || c.batch, batch_start: form.batchStart || c.batch_start, provider: form.provider || c.provider, target: tgt, ceiling: ceil }, 'id = ?', [courseId]);
}

async function setFlag(courseId, type, status, note) {
  const f = await db.one('SELECT id FROM governance_flags WHERE course_id = ? AND type = ?', [courseId, type]);
  if (f) await db.update('governance_flags', { status, note }, 'id = ?', [f.id]);
  else await db.insert('governance_flags', { id: uid('gf'), course_id: courseId, type, status, note });
}

async function createCourse({ title, link, language, batch_start }, user) {
  if (!title) throw new HttpError(400, 'Course name is required');
  const dup = await db.one('SELECT id FROM courses WHERE title = ?', [title]);
  if (dup) throw new HttpError(409, 'A course with this name already exists');
  const { lookups } = await settings.load();
  const id = uid('f');
  const form = { title, link: link || '', langs: language ? [language] : [], batchStart: batch_start || '', locations: [] };
  await db.insert('courses', { id, title, language, batch_start: batch_start || null, form, form_src: {}, created_by: user.id, batch: 'Batch 1' });
  let i = 0;
  for (const bf of lookups.brief_field || []) {
    await db.insert('brief_fields', { course_id: id, field_key: bf.code, label: bf.label, tier: bf.meta?.tier || 'opt', status: 'Missing', sort_order: i++ });
  }
  for (const ft of lookups.flag_type || []) await db.insert('governance_flags', { id: uid('gf'), course_id: id, type: ft.code, status: 'Cleared', note: '' });
  for (const rt of lookups.read_type || []) await db.insert('course_reads', { id: uid('rd'), course_id: id, read_key: rt.code, title: rt.label, status: 'Waiting', items: [] });
  await db.insert('activity_log', { course_id: id, ts: new Date(), kind: 'deal', text: `Course created by ${user.name}` });
  await syncBrief(id, user);
  return repo.loadCourse(id);
}

async function updateForm(courseId, values, user) {
  const c = await db.one('SELECT form, form_src FROM courses WHERE id = ?', [courseId]);
  if (!c) throw new HttpError(404, 'Course not found');
  const form = { ...c.form, ...values };
  const src = { ...(c.form_src || {}) };
  Object.keys(values).forEach((k) => delete src[k]); // a typed value is a confirmed value
  await db.update('courses', { form, form_src: src }, 'id = ?', [courseId]);
  // Inputs a read depends on changed → that read becomes Stale until Agent A2 reruns
  const changed = ['locations', 'competing', 'domain', 'eligibility'].filter((k) => k in values && JSON.stringify(values[k]) !== JSON.stringify(c.form[k]));
  if (changed.length) {
    await db.query("UPDATE course_reads SET status = 'Stale', stale_note = ? WHERE course_id = ? AND status = 'Ready'",
      [`${changed.join(', ')} changed on ${fmtDate(await settings.today())}`, courseId]);
  }
  await syncBrief(courseId, user);
  return repo.loadCourse(courseId);
}

async function confirm(courseId, keys, user) {
  const c = await db.one('SELECT form_src FROM courses WHERE id = ?', [courseId]);
  const src = { ...(c.form_src || {}) };
  (keys && keys.length ? keys : Object.keys(src)).forEach((k) => delete src[k]);
  await db.update('courses', { form_src: src }, 'id = ?', [courseId]);
  await syncBrief(courseId, user);
  return repo.loadCourse(courseId);
}

/** Agent A1: read a brochure / syllabus / course link and propose brief values (Unconfirmed). */
async function extract(courseId, { file, sample, text }, user) {
  const { lookups } = await settings.load();
  const today = await settings.today();
  const payload = { fields: lookups.brief_field, lookups: Object.fromEntries(['course_mode', 'course_level', 'course_domain', 'district', 'language'].map((k) => [k, settings.codes(lookups, k)])) };
  let filename = 'pasted-text';
  if (file) {
    filename = file.originalname;
    payload.filename = filename;
    if (/pdf$/i.test(file.mimetype) || /\.pdf$/i.test(filename)) payload.file_b64 = fs.readFileSync(file.path).toString('base64');
    else payload.text = fs.readFileSync(file.path, 'utf8');
  } else if (sample) {
    filename = 'sample-brochure.pdf';
    payload.filename = filename;
    payload.text = fs.readFileSync(path.resolve(__dirname, '../../../database/seed/sample_brochure.txt'), 'utf8');
  } else {
    payload.text = text || '';
  }
  const r = await ai.runAgent('a1', payload, { entityType: 'course', entityId: courseId });
  const c = await db.one('SELECT form, form_src FROM courses WHERE id = ?', [courseId]);
  const form = { ...c.form };
  const src = { ...(c.form_src || {}) };
  const MAP = { domain: 'domain', level: 'level', mode: 'mode' };
  for (const [k, v] of Object.entries(r.values || {})) {
    const key = MAP[k] || k;
    if (form[key] && String(form[key]).length && !src[key]) continue; // never overwrite confirmed values
    form[key] = v;
    src[key] = r.sources[k] || filename;
  }
  await db.update('courses', { form, form_src: src }, 'id = ?', [courseId]);
  for (const cl of r.claims || []) {
    const exists = await db.one('SELECT id FROM course_claims WHERE course_id = ? AND text = ?', [courseId, cl.text]);
    if (!exists) await db.insert('course_claims', { id: uid('cl'), course_id: courseId, text: cl.text, source: cl.src, status: 'Awaiting evidence' });
  }
  for (const f of r.flags || []) await setFlag(courseId, f.type, f.status, f.note);
  await db.insert('files', { id: uid('fl'), course_id: courseId, name: filename, size_label: file ? `${Math.round(file.size / 1024)} KB` : null, lane: 'Brief material', date: today, by_user: user.name, status: 'Extracted', storage_path: file?.path || null });
  await db.insert('activity_log', { course_id: courseId, ts: new Date(), kind: 'agent', text: `Agent A1 read ${filename}: ${Object.keys(r.values || {}).length} fields proposed, ${r.claims?.length || 0} claims held` });
  await syncBrief(courseId, user);
  return { extracted: r, course: await repo.loadCourse(courseId) };
}

/** Agent A2: refresh the three programme reads. */
async function runReads(courseId) {
  const course = await repo.loadCourse(courseId);
  const today = await settings.today();
  const themes = await db.query(`SELECT theme, COUNT(*) n FROM comments cm JOIN campaigns c ON c.id = cm.campaign_id
                                 WHERE c.course_id = ? GROUP BY theme ORDER BY n DESC`, [courseId]);
  const r = await ai.runAgent('a2', { course: repo.courseDTO(course), evidence: { comment_themes: themes.map((t) => t.theme) }, today }, { entityType: 'course', entityId: courseId });
  for (const rd of r.reads) {
    await db.query('DELETE FROM course_reads WHERE course_id = ? AND read_key = ?', [courseId, rd.key]);
    await db.insert('course_reads', { id: uid('rd'), course_id: courseId, read_key: rd.key, title: rd.title, status: 'Ready', read_date: today, items: rd.items });
  }
  return repo.loadCourse(courseId);
}

module.exports = { createCourse, updateForm, confirm, extract, runReads, syncBrief, setFlag, fieldValue };
