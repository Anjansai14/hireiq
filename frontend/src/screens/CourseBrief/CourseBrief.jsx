import React, { useState, useEffect, useRef } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';
import { api } from '../../lib/api';

const PROTECTED = /\b(caste|castes|religion|religious|hindu|muslim|christian|sikh|sc\/st|obc|male|males|female|females|women|woman|men only|boys only|girls only|gender|disabled|disability|married|unmarried)\b/i;
const CLAIM = /(\d+\s?%\s*(placement|placed|hired)|placement rate|salary|lpa|ctc|job guarantee|guaranteed job|100% placement)/i;

const DOMAINS = ['AI/ML', 'Data engineering', 'Software development', 'Cloud', 'Manufacturing', 'Electronics', 'Healthcare', 'Retail'];
const LEVELS = ['Foundation', 'Intermediate', 'Advanced'];
const MODES = ['Online', 'Hybrid', 'In centre'];
const LOCATIONS = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Maharashtra', 'Odisha', 'West Bengal', 'Gujarat', 'Rajasthan', 'Madhya Pradesh', 'Uttar Pradesh', 'Bihar', 'Delhi', 'Punjab', 'Haryana'];
const LANGUAGES = ['Telugu', 'English', 'Hindi', 'Urdu', 'Kannada'];

const formOf = (c) => {
  const f = c?.form || {};
  return {
    title: f.title || c?.title || '',
    link: f.link || '',
    domain: f.domain || '',
    level: f.level || '',
    eligibility: f.eligibility || '',
    duration: f.duration || '',
    mode: f.mode || '',
    locations: Array.isArray(f.locations) ? f.locations : [],
    batchName: f.batchName || c?.batch || '',
    batchStart: f.batchStart || c?.batch_start || '',
    batchEnd: f.batchEnd || '',
    screenClose: f.screenClose || '',
    target: f.target ? String(f.target) : c?.target ? String(c.target) : '',
    ceiling: f.ceiling ? String(f.ceiling) : c?.ceiling ? String(c.ceiling) : '',
    regLink: f.regLink || '',
    budget: f.budget || '',
    fee: f.fee || '',
    stipend: f.stipend || '',
    benefits: f.benefits || '',
    outcome: f.outcome || '',
    langs: Array.isArray(f.langs) ? f.langs : (c?.language ? [c.language] : []),
    provider: f.provider || c?.provider || '',
    competing: f.competing || '',
    past: f.past || '',
  };
};

export default function CourseBrief() {
  const { state, HQ, currentCourse, go, toast } = useHQ();
  const film = currentCourse;
  const r = state.route || {};
  const tab = r.tab === 'files' ? 'files' : 'overview';

  const [form, setForm] = useState(() => formOf(film));
  const [formSrc, setFormSrc] = useState(() => film?.form_src || {});
  const [flags, setFlags] = useState(() => film?.flags || []);
  const [claims, setClaims] = useState(() => film?.claims || []);
  const [files, setFiles] = useState(() => film?.files || []);
  const [readiness, setReadiness] = useState(() => film?.readiness || HQ.readiness(film));
  const [contextVal, setContextVal] = useState(() => film?.context || '');
  const [linkDraft, setLinkDraft] = useState('');

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [openDropdown, setOpenDropdown] = useState(null); // 'locations' | 'langs' | null
  const [uploadList, setUploadList] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [showReadinessModal, setShowReadinessModal] = useState(false);

  const activeCourseIdRef = useRef(film?.id);
  const pendingSaveTimeoutRef = useRef(null);
  const pendingValuesRef = useRef({});
  const fileInputRef = useRef(null);
  const filesTabInputRef = useRef(null);
  const evidenceInputRef = useRef(null);
  const activeClaimIdRef = useRef(null);

  // Sync course data when active course changes
  useEffect(() => {
    activeCourseIdRef.current = film?.id;
    if (!film?.id) return;

    let cancelled = false;
    setLoading(true);

    api.get(`/courses/${film.id}`)
      .then((data) => {
        if (cancelled || activeCourseIdRef.current !== film.id) return;
        const mapped = formOf(data);
        setForm(mapped);
        setFormSrc(data.form_src || {});
        setFlags(data.flags || []);
        setClaims(data.claims || []);
        setFiles(data.files || []);
        setReadiness(data.readiness || HQ.readiness(data));
        setContextVal(data.context || '');
        setLinkDraft(mapped.link || '');

        HQ.set((x) => {
          const target = (x.films || []).find((f) => f.id === film.id);
          if (target) {
            target.title = data.title;
            target.batch = data.batch;
            target.release = data.batch_start || target.release;
            target.provider = data.provider;
            target.target = data.target;
            target.ceiling = data.ceiling;
            target.form = data.form || {};
            target.form_src = data.form_src || {};
            target.fields = data.fields || [];
            target.claims = data.claims || [];
            target.flags = data.flags || [];
            target.reads = data.reads || [];
            target.files = data.files || [];
            target.readiness = data.readiness;
            target.context = data.context || '';
          }
        });
      })
      .catch((err) => {
        if (!cancelled && activeCourseIdRef.current === film.id) {
          toast(err.message || 'Could not load course from server', 'error');
        }
      })
      .finally(() => {
        if (!cancelled && activeCourseIdRef.current === film.id) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (pendingSaveTimeoutRef.current) {
        clearTimeout(pendingSaveTimeoutRef.current);
        const valuesToSave = { ...pendingValuesRef.current };
        pendingValuesRef.current = {};
        if (Object.keys(valuesToSave).length > 0) {
          api.patch(`/courses/${film.id}/form`, { values: valuesToSave }).catch(() => {});
        }
      }
    };
  }, [film?.id]);

  // Sync state helper from API response
  const applyCourseUpdate = (courseData) => {
    const mapped = formOf(courseData);
    setForm(mapped);
    setFormSrc(courseData.form_src || {});
    setFlags(courseData.flags || []);
    setClaims(courseData.claims || []);
    setFiles(courseData.files || []);
    setReadiness(courseData.readiness || HQ.readiness(courseData));
    setContextVal(courseData.context || '');
    if (mapped.link) setLinkDraft(mapped.link);

    HQ.set((x) => {
      const target = (x.films || []).find((f) => f.id === courseData.id);
      if (target) {
        target.title = courseData.title;
        target.batch = courseData.batch;
        target.release = courseData.batch_start || target.release;
        target.provider = courseData.provider;
        target.target = courseData.target;
        target.ceiling = courseData.ceiling;
        target.form = courseData.form || {};
        target.form_src = courseData.form_src || {};
        target.fields = courseData.fields || [];
        target.claims = courseData.claims || [];
        target.flags = courseData.flags || [];
        target.reads = courseData.reads || [];
        target.files = courseData.files || [];
        target.readiness = courseData.readiness;
        target.context = courseData.context || '';
      }
    });
  };

  // Debounced save for text inputs
  const triggerDebouncedSave = (courseId, key, val) => {
    pendingValuesRef.current[key] = val;
    setSaveStatus('saving');

    if (pendingSaveTimeoutRef.current) {
      clearTimeout(pendingSaveTimeoutRef.current);
    }

    pendingSaveTimeoutRef.current = setTimeout(async () => {
      const valuesToSave = { ...pendingValuesRef.current };
      pendingValuesRef.current = {};
      try {
        const updated = await api.patch(`/courses/${courseId}/form`, { values: valuesToSave });
        if (activeCourseIdRef.current === courseId) {
          setSaveStatus('saved');
          setTimeout(() => {
            if (activeCourseIdRef.current === courseId) setSaveStatus('idle');
          }, 2000);
          applyCourseUpdate(updated);
        }
      } catch (err) {
        if (activeCourseIdRef.current === courseId) {
          setSaveStatus('error');
          toast(err.message || 'Failed to save changes to server', 'error');
        }
      }
    }, 600);
  };

  // Immediate save for selects / multiselects / chip toggles
  const saveFieldImmediate = async (key, val) => {
    if (pendingSaveTimeoutRef.current) clearTimeout(pendingSaveTimeoutRef.current);
    const valuesToSave = { ...pendingValuesRef.current, [key]: val };
    pendingValuesRef.current = {};
    setSaveStatus('saving');

    try {
      const updated = await api.patch(`/courses/${film.id}/form`, { values: valuesToSave });
      if (activeCourseIdRef.current === film.id) {
        setSaveStatus('saved');
        setTimeout(() => {
          if (activeCourseIdRef.current === film.id) setSaveStatus('idle');
        }, 2000);
        applyCourseUpdate(updated);
      }
    } catch (err) {
      if (activeCourseIdRef.current === film.id) {
        setSaveStatus('error');
        toast(err.message || 'Failed to save changes', 'error');
      }
    }
  };

  const handleFieldChange = (key, val, immediate = false) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    // Typing confirms the field locally
    if (formSrc[key]) {
      setFormSrc((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    if (immediate) {
      saveFieldImmediate(key, val);
    } else {
      triggerDebouncedSave(film.id, key, val);
    }
  };

  const toggleArrayItem = (key, item) => {
    const list = Array.isArray(form[key]) ? form[key] : [];
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
    handleFieldChange(key, next, true);
  };

  // Confirm single field
  const handleConfirmField = async (key) => {
    try {
      const updated = await api.post(`/courses/${film.id}/confirm`, { keys: [key] });
      applyCourseUpdate(updated);
      toast(`Confirmed ${key}`);
    } catch (err) {
      toast(err.message || 'Failed to confirm field', 'error');
    }
  };

  // Confirm all fields
  const handleConfirmAll = async () => {
    try {
      const updated = await api.post(`/courses/${film.id}/confirm`, { keys: [] });
      applyCourseUpdate(updated);
      toast('All extracted & proposed values confirmed');
    } catch (err) {
      toast(err.message || 'Failed to confirm fields', 'error');
    }
  };

  // Auto-fill all 9 required brief fields with sensible defaults & confirm (9/9 ready)
  const handleAutoFillDefaults = async () => {
    const slug = (film?.title || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const defaults = {
      title: form.title || film?.title || 'Applied AI & ML Programme',
      link: form.link || `nexaskills.org/${slug}`,
      domain: form.domain || 'AI/ML',
      level: form.level || 'Intermediate',
      eligibility: form.eligibility || 'B.Tech/B.E. or MCA, graduated 2022–2026, 60% aggregate',
      duration: form.duration || '16 weeks',
      mode: form.mode || 'Hybrid',
      locations: form.locations?.length ? form.locations : ['Andhra Pradesh', 'Telangana'],
      batchName: form.batchName || film?.batch || 'Batch 1',
      batchStart: form.batchStart || film?.release || '2026-11-16',
      batchEnd: form.batchEnd || '2027-03-07',
      screenClose: form.screenClose || '2026-10-31',
      target: form.target || film?.target || '300',
      ceiling: form.ceiling || film?.ceiling || '4500',
      regLink: form.regLink || `resolence.in/r/${slug}`,
    };
    setForm((prev) => ({ ...prev, ...defaults }));
    try {
      await api.patch(`/courses/${film.id}/form`, { values: defaults });
      const updated = await api.post(`/courses/${film.id}/confirm`, { keys: [] });
      applyCourseUpdate(updated);
      toast('All 9 required fields filled and confirmed (9/9 ready!)');
    } catch (err) {
      toast(err.message || 'Failed to auto-fill defaults', 'error');
    }
  };

  // Read Course Link via backend Agent A1
  const handleReadLink = async () => {
    const url = (linkDraft || form.link || '').trim();
    if (!url) {
      toast('Paste the course link first', 'error');
      return;
    }
    const uploadId = 'up-' + Date.now();
    const cleanName = url.replace(/^https?:\/\//, '');
    setUploadList((prev) => [
      ...prev,
      { id: uploadId, name: cleanName, note: 'Fetching page and reading details…', busy: true, icon: 'i-link' }
    ]);

    try {
      const res = await api.post(`/courses/${film.id}/extract`, { url, text: url });
      const n = Object.keys(res.extracted?.values || {}).length;
      const claimsCount = res.extracted?.claims?.length || 0;
      setUploadList((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? {
                ...u,
                busy: false,
                done: true,
                note: n
                  ? `${n} fields filled. Confirm them below.${claimsCount ? ' 1 outcome claim held for evidence.' : ''}`
                  : 'Read. Nothing new to fill.'
              }
            : u
        )
      );
      applyCourseUpdate(res.course);
      toast(n ? `${cleanName}: ${n} fields ready to confirm` : `${cleanName} read`);
    } catch (err) {
      setUploadList((prev) =>
        prev.map((u) => (u.id === uploadId ? { ...u, busy: false, note: 'Failed to extract: ' + err.message } : u))
      );
      toast(err.message || 'Could not extract from link', 'error');
    }
  };

  // Use sample brochure via backend Agent A1
  const handleUseSampleBrochure = async () => {
    const uploadId = 'up-' + Date.now();
    const filename = `${film.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-brochure.pdf`;
    setUploadList((prev) => [
      ...prev,
      { id: uploadId, name: filename, note: 'Reading pages and extracting details…', busy: true, icon: 'i-file' }
    ]);

    try {
      const res = await api.post(`/courses/${film.id}/extract`, { sample: true });
      const n = Object.keys(res.extracted?.values || {}).length;
      const claimsCount = res.extracted?.claims?.length || 0;
      setUploadList((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? {
                ...u,
                busy: false,
                done: true,
                note: n
                  ? `${n} fields filled. Confirm them below.${claimsCount ? ' Outcome claim held for evidence.' : ''}`
                  : 'Read. Nothing new to fill.'
              }
            : u
        )
      );
      applyCourseUpdate(res.course);
      toast(n ? `${filename}: ${n} fields ready to confirm` : `${filename} processed`);
    } catch (err) {
      setUploadList((prev) =>
        prev.map((u) => (u.id === uploadId ? { ...u, busy: false, note: 'Failed: ' + err.message } : u))
      );
      toast(err.message || 'Could not process sample brochure', 'error');
    }
  };

  // Upload custom brochure / syllabus file
  const handleUploadFile = async (file) => {
    if (!file) return;
    const uploadId = 'up-' + Date.now();
    const isImg = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    setUploadList((prev) => [
      ...prev,
      { id: uploadId, name: file.name, note: isImg ? 'Saving image…' : 'Reading text and extracting fields…', busy: true, icon: isImg ? 'i-image' : 'i-file' }
    ]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/courses/${film.id}/extract`, formData);
      const n = Object.keys(res.extracted?.values || {}).length;
      setUploadList((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? { ...u, busy: false, done: true, note: isImg ? 'Saved' : n ? `${n} fields ready to confirm` : 'Extracted' }
            : u
        )
      );
      applyCourseUpdate(res.course);
      toast(`${file.name} uploaded`);
    } catch (err) {
      setUploadList((prev) =>
        prev.map((u) => (u.id === uploadId ? { ...u, busy: false, note: 'Failed: ' + err.message } : u))
      );
      toast(err.message || 'Failed to upload file', 'error');
    }
  };

  // Upload document directly to course files (Files tab - no AI extraction)
  const handleUploadCourseFile = async (file) => {
    if (!file) return;
    const uploadId = 'up-fl-' + Date.now();
    const isImg = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    setUploadList((prev) => [
      ...prev,
      { id: uploadId, name: file.name, note: 'Uploading file…', busy: true, icon: isImg ? 'i-image' : 'i-file' }
    ]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('lane', isImg ? 'Brand assets' : 'Brief material');

    try {
      const res = await api.post(`/courses/${film.id}/files`, formData);
      setUploadList((prev) =>
        prev.map((u) => (u.id === uploadId ? { ...u, busy: false, done: true, note: 'Stored in course files' } : u))
      );
      applyCourseUpdate(res.course || res);
      toast(`${file.name} uploaded`);
    } catch (err) {
      setUploadList((prev) =>
        prev.map((u) => (u.id === uploadId ? { ...u, busy: false, note: 'Failed: ' + err.message } : u))
      );
      toast(err.message || 'Failed to upload file', 'error');
    }
  };

  // Attach evidence to an outcome claim
  const handleAttachEvidence = async (file) => {
    const claimId = activeClaimIdRef.current;
    if (!file || !claimId) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const updated = await api.post(`/courses/${film.id}/claims/${claimId}/evidence`, formData);
      applyCourseUpdate(updated);
      toast('Evidence attached. Claim can now be used in content.');
    } catch (err) {
      toast(err.message || 'Failed to attach evidence', 'error');
    } finally {
      activeClaimIdRef.current = null;
    }
  };

  // Delete a course file
  const handleDeleteFile = async (fileId, fileName) => {
    try {
      const updated = await api.del(`/courses/${film.id}/files/${fileId}`);
      applyCourseUpdate(updated);
      toast(`Deleted ${fileName}`);
    } catch (err) {
      toast(err.message || 'Failed to delete file', 'error');
    }
  };

  // Save "About this course" context
  const handleSaveContext = async () => {
    try {
      const updated = await api.patch(`/courses/${film.id}/context`, { context: contextVal.trim() });
      applyCourseUpdate(updated);
      toast('Context saved');
    } catch (err) {
      toast(err.message || 'Failed to save context', 'error');
    }
  };

  // Update a governance flag
  const handleFlagUpdate = async (flagId, newStatus, newNote) => {
    try {
      const updated = await api.patch(`/courses/${film.id}/flags/${flagId}`, { status: newStatus, note: newNote });
      applyCourseUpdate(updated);
      toast('Governance flag updated');
    } catch (err) {
      toast(err.message || 'Failed to update governance flag', 'error');
    }
  };

  const unconfirmedKeys = Object.keys(formSrc).filter((k) => formSrc[k]);
  const eligProtectedHit = form.eligibility && PROTECTED.test(form.eligibility);
  const outcomeClaimHit = form.outcome && CLAIM.test(form.outcome);

  const rdOk = readiness?.ok ?? 0;
  const rdReq = readiness?.req ?? 9;
  const rdPct = readiness?.pct ?? Math.round((rdOk / (rdReq || 1)) * 100);
  const rdColor = rdPct === 100 ? 'var(--success-600)' : 'var(--warning-600)';

  const REQ_BRIEF_FIELDS = [
    { key: 'title', label: 'Course name', val: form.title, isSet: Boolean(form.title), unconf: Boolean(formSrc.title) },
    { key: 'link', label: 'Course link', val: form.link, isSet: Boolean(form.link), unconf: Boolean(formSrc.link) },
    { key: 'domain', label: 'Skill domain & level', val: [form.domain, form.level].filter(Boolean).join(' · '), isSet: Boolean(form.domain && form.level), unconf: Boolean(formSrc.domain || formSrc.level) },
    { key: 'eligibility', label: 'Eligibility', val: form.eligibility, isSet: Boolean(form.eligibility), unconf: Boolean(formSrc.eligibility) },
    { key: 'duration', label: 'Duration & mode', val: [form.duration, form.mode].filter(Boolean).join(' · '), isSet: Boolean(form.duration && form.mode), unconf: Boolean(formSrc.duration || formSrc.mode) },
    { key: 'locations', label: 'Target area', val: Array.isArray(form.locations) ? form.locations.join(', ') : '', isSet: Boolean(form.locations && form.locations.length > 0), unconf: Boolean(formSrc.locations) },
    { key: 'batch', label: 'Batch start date', val: form.batchStart, isSet: Boolean(form.batchStart), unconf: Boolean(formSrc.batchStart || formSrc.batch) },
    { key: 'target', label: 'Enrolment target & cost ceiling', val: [form.target && `${form.target} enrolments`, form.ceiling && `₹${form.ceiling}`].filter(Boolean).join(' · '), isSet: Boolean(form.target && form.ceiling), unconf: Boolean(formSrc.target || formSrc.ceiling) },
    { key: 'regLink', label: 'Registration link (Resolence)', val: form.regLink, isSet: Boolean(form.regLink), unconf: Boolean(formSrc.regLink) }
  ];

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1240px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files?.[0]) handleUploadFile(e.target.files[0]);
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={filesTabInputRef}
        onChange={(e) => {
          if (e.target.files?.[0]) handleUploadCourseFile(e.target.files[0]);
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={evidenceInputRef}
        onChange={(e) => {
          if (e.target.files?.[0]) handleAttachEvidence(e.target.files[0]);
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <button
            onClick={() => go('dashboard')}
            style={{ border: 0, background: 'none', padding: 0, color: 'var(--ink-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', marginBottom: '8px' }}
          >
            <Icon name="i-left" size={16} /> Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600, letterSpacing: '-.015em' }}>
              {form.title || film.title}
            </h1>
            {saveStatus === 'saving' && (
              <span style={{ fontSize: '12px', color: 'var(--ink-500)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '2px solid var(--teal-200)', borderTopColor: 'var(--teal-700)', animation: 'spin .8s linear infinite' }}></span>
                Saving…
              </span>
            )}
            {saveStatus === 'saved' && (
              <span style={{ fontSize: '12px', color: 'var(--teal-700)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <Icon name="i-check" size={13} /> Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span style={{ fontSize: '12px', color: 'var(--danger-600)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <Icon name="i-alert" size={13} /> Save failed
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-600)', fontSize: '14px' }}>
            {(form.batchName || film.batch || 'Batch 1') + ' · starts ' + HQ.d(form.batchStart || film.release) + ' · ' + (form.provider || film.provider || 'Provider not set')}
          </p>
        </div>

        {/* Readiness Meter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '10px 16px', boxShadow: 'var(--e-1)' }}>
          <div
            onClick={() => setShowReadinessModal(true)}
            style={{ width: '180px', cursor: 'pointer' }}
            title="Click to view 9/9 required fields checklist"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', lineHeight: '16px', fontSize: '12px', color: 'var(--ink-600)', marginBottom: '6px' }}>
              <span style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Required fields <Icon name="i-info" size={12} style={{ color: 'var(--teal-600)' }} />
              </span>
              <b style={{ color: rdPct === 100 ? 'var(--success-700)' : 'var(--ink-900)' }}>{rdOk}/{rdReq}</b>
            </div>
            <div style={{ height: '8px', borderRadius: '999px', background: 'var(--ink-100)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${rdPct}%`, background: rdColor, borderRadius: '999px', transition: 'width .3s ease' }}></div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowReadinessModal(true)}
            style={{ border: '1px solid var(--ink-200)', background: 'var(--ink-50)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Checklist
          </button>
          {rdPct < 100 && (
            <button
              type="button"
              onClick={handleAutoFillDefaults}
              style={{ border: 0, background: 'var(--teal-700)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
              title="One-click populate and confirm all 9 required brief fields"
            >
              Auto-fill 9/9 ✓
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--ink-100)', overflowX: 'auto', overflowY: 'hidden' }}>
        {[
          { key: 'overview', label: 'Overview', n: '' },
          { key: 'files', label: 'Files', n: files.length }
        ].map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => go('brief', { tab: t.key })}
              style={{
                border: 0,
                background: 'none',
                padding: '10px 0',
                marginBottom: '-1px',
                borderBottom: on ? '2px solid var(--teal-600)' : '2px solid transparent',
                color: on ? 'var(--teal-800)' : 'var(--ink-600)',
                fontWeight: on ? 600 : 500,
                fontSize: '14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {t.label} {t.n !== '' && <span style={{ color: 'var(--ink-500)', fontWeight: 400 }}>({t.n})</span>}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top 2 Extraction Panels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: '16px' }}>
            {/* Panel 1: Read Course Link */}
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: 'var(--e-1)' }}>
              <div>
                <b style={{ display: 'block', fontSize: '15px' }}>Read the course link</b>
                <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                  We read the page and fill fields marked From file. Nothing is used until you confirm it.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  placeholder="nexaskills.org/applied-ai"
                  style={{ flex: 1, minWidth: 0, height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontSize: '13px' }}
                />
                <button
                  onClick={handleReadLink}
                  style={{ height: '40px', padding: '0 14px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center', whiteSpace: 'nowrap' }}
                >
                  <Icon name="i-link" size={16} /> Read link
                </button>
              </div>
            </div>

            {/* Panel 2: Drop a Brochure or Syllabus */}
            <div
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files?.[0]) handleUploadFile(e.dataTransfer.files[0]);
              }}
              style={{
                border: `2px dashed ${dragActive ? 'var(--teal-600)' : 'var(--ink-200)'}`,
                background: dragActive ? 'var(--teal-50)' : '#fff',
                borderRadius: '12px',
                padding: '18px 20px',
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                flexWrap: 'wrap',
                cursor: 'pointer'
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--teal-50)', color: 'var(--teal-700)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                <Icon name="i-upload" size={22} />
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <b style={{ display: 'block', fontSize: '15px' }}>Drop a brochure or syllabus</b>
                <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                  PDF, Word or images. Placement or salary figures are captured as claims awaiting evidence.
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUseSampleBrochure();
                }}
                style={{ height: '36px', padding: '0 14px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Use sample brochure
              </button>
            </div>
          </div>

          {/* Upload In-progress / Done Banner List */}
          {uploadList.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '10px' }}>
              <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--ink-50)', display: 'grid', placeItems: 'center', color: 'var(--ink-600)', flex: 'none' }}>
                <Icon name={f.icon || 'i-file'} size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{f.note}</div>
              </div>
              {f.busy && (
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--teal-100)', borderTopColor: 'var(--teal-600)', animation: 'spin .8s linear infinite', flex: 'none' }}></span>
              )}
              {f.done && (
                <span style={{ color: 'var(--success-600)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <Icon name="i-check" size={18} />
                </span>
              )}
            </div>
          ))}

          {/* Unconfirmed Values Banner */}
          {unconfirmedKeys.length > 0 ? (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', borderRadius: '8px', background: 'var(--teal-50)', border: '1px solid var(--teal-100)', fontSize: '13px', color: 'var(--teal-900)', flexWrap: 'wrap' }}>
              <Icon name="i-info" size={18} style={{ flex: 'none' }} />
              <span style={{ flex: 1 }}>
                {unconfirmedKeys.length} value{unconfirmedKeys.length > 1 ? 's' : ''} came from a file or link and {unconfirmedKeys.length > 1 ? 'are' : 'is'} waiting for you to confirm {unconfirmedKeys.length > 1 ? 'them' : 'it'}.
              </span>
              <button
                type="button"
                onClick={handleConfirmAll}
                style={{ height: '32px', padding: '0 14px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Confirm all
              </button>
            </div>
          ) : rdOk < rdReq ? (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', borderRadius: '8px', background: 'var(--ink-50)', border: '1px solid var(--ink-200)', fontSize: '13px', color: 'var(--ink-800)', flexWrap: 'wrap' }}>
              <Icon name="i-info" size={18} style={{ color: 'var(--teal-600)', flex: 'none' }} />
              <span style={{ flex: 1 }}>
                Brief readiness is <b>{rdOk}/{rdReq}</b>. Complete all 9 required fields (or auto-fill defaults) to create and launch campaigns.
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowReadinessModal(true)}
                  style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--ink-700)' }}
                >
                  View checklist
                </button>
                <button
                  type="button"
                  onClick={handleAutoFillDefaults}
                  style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Auto-fill 9/9 ✓
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 16px', borderRadius: '8px', background: 'var(--success-50)', border: '1px solid var(--success-200)', fontSize: '13px', color: 'var(--success-800)' }}>
              <Icon name="i-check" size={18} style={{ color: 'var(--success-600)', flex: 'none' }} />
              <span style={{ flex: 1 }}>
                All 9 required brief fields are confirmed! Ready for campaign creation.
              </span>
              <button
                type="button"
                onClick={() => go('campaigns')}
                style={{ height: '30px', padding: '0 12px', borderRadius: '6px', border: 0, background: 'var(--teal-700)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Go to Campaigns →
              </button>
            </div>
          )}

          {/* Main Course Brief Form Groups */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* GROUP 1: COURSE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <b style={{ fontSize: '15px' }}>Course</b>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: '24px 32px' }}>
                {/* Course Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Course name</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {formSrc.title && (
                      <>
                        <span style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('title')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      REQUIRED
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Unique per provider.</span>
                  <input
                    value={form.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    onBlur={() => saveFieldImmediate('title', form.title)}
                    placeholder="e.g. Applied AI & ML Programme"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Course Link */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Course link</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {formSrc.link && (
                      <>
                        <span style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('link')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      REQUIRED
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>The public course page.</span>
                  <input
                    value={form.link}
                    onChange={(e) => handleFieldChange('link', e.target.value)}
                    onBlur={() => saveFieldImmediate('link', form.link)}
                    placeholder="provider.org/course"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Skill Domain */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Skill domain</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {formSrc.domain && (
                      <>
                        <span style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('domain')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      REQUIRED
                    </span>
                  </div>
                  <select
                    value={form.domain}
                    onChange={(e) => handleFieldChange('domain', e.target.value, true)}
                    style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%' }}
                  >
                    <option value="">Choose one</option>
                    {DOMAINS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Level */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Level</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {formSrc.level && (
                      <>
                        <span style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('level')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      REQUIRED
                    </span>
                  </div>
                  <select
                    value={form.level}
                    onChange={(e) => handleFieldChange('level', e.target.value, true)}
                    style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%' }}
                  >
                    <option value="">Choose one</option>
                    {LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Stops an advanced course reaching a cohort that cannot enter it.</span>
                </div>

                {/* Eligibility (spans full width) */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Eligibility</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {formSrc.eligibility && (
                      <>
                        <span title={`From ${formSrc.eligibility}`} style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('eligibility')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      REQUIRED
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                    Qualification, graduation years, marks. Protected attributes are not allowed (RR-H02).
                  </span>
                  <textarea
                    value={form.eligibility}
                    onChange={(e) => handleFieldChange('eligibility', e.target.value)}
                    onBlur={() => saveFieldImmediate('eligibility', form.eligibility)}
                    placeholder="e.g. B.Tech/B.E. or MCA, graduated 2022–2026, 60% aggregate"
                    style={{
                      minHeight: '80px',
                      padding: '10px 12px',
                      border: `1px solid ${eligProtectedHit ? 'var(--danger-600)' : 'var(--ink-300)'}`,
                      borderRadius: '8px',
                      resize: 'vertical',
                      font: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                  {eligProtectedHit && (
                    <div style={{ display: 'flex', gap: '8px', padding: '8px 10px', borderRadius: '6px', background: 'var(--danger-100)', color: 'var(--danger-800)', fontSize: '12px' }}>
                      <Icon name="i-shield" size={14} style={{ flex: 'none', marginTop: '1px' }} />
                      <span>
                        Blocked: eligibility cannot use caste, religion, gender, disability or another protected attribute. Escalated to the fairness reviewer. This field stays unconfirmed until it is changed.
                      </span>
                    </div>
                  )}
                </div>

                {/* Duration */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Duration</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {formSrc.duration && (
                      <>
                        <span style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('duration')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      REQUIRED
                    </span>
                  </div>
                  <input
                    value={form.duration}
                    onChange={(e) => handleFieldChange('duration', e.target.value)}
                    onBlur={() => saveFieldImmediate('duration', form.duration)}
                    placeholder="e.g. 16 weeks"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Mode */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Mode</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {formSrc.mode && (
                      <>
                        <span style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('mode')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      REQUIRED
                    </span>
                  </div>
                  <select
                    value={form.mode}
                    onChange={(e) => handleFieldChange('mode', e.target.value, true)}
                    style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%' }}
                  >
                    <option value="">Choose one</option>
                    {MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Target Area (Locations multi-select) */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Target area</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {formSrc.locations && (
                      <>
                        <span style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('locations')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      REQUIRED
                    </span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'locations' ? null : 'locations')}
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 12px',
                        border: `1px solid ${openDropdown === 'locations' ? 'var(--teal-600)' : 'var(--ink-300)'}`,
                        borderRadius: '8px',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit'
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: form.locations.length ? 'var(--ink-900)' : 'var(--ink-500)', fontSize: '13px' }}>
                        {form.locations.length ? form.locations.join(', ') : 'Choose one or more'}
                      </span>
                      <Icon name="i-down" size={16} style={{ color: 'var(--ink-600)' }} />
                    </button>
                    {openDropdown === 'locations' && (
                      <>
                        <div onClick={() => setOpenDropdown(null)} style={{ position: 'fixed', inset: 0, zIndex: 20 }}></div>
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '44px', zIndex: 21, background: '#fff', border: '1px solid var(--ink-200)', borderRadius: '8px', boxShadow: 'var(--e-2)', padding: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                          {LOCATIONS.map((loc) => {
                            const isChecked = form.locations.includes(loc);
                            return (
                              <label key={loc} style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '36px', padding: '0 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleArrayItem('locations', loc)}
                                  style={{ width: '16px', height: '16px', margin: 0, accentColor: 'var(--teal-700)' }}
                                />
                                {loc}
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                    States where you want to reach candidates. Select one or more.
                  </span>
                </div>
              </div>
            </div>

            {/* GROUP 2: BATCH AND TARGET */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <b style={{ fontSize: '15px' }}>Batch and target</b>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: '24px 32px' }}>
                {/* Batch Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Batch</b>
                  <input
                    value={form.batchName}
                    onChange={(e) => handleFieldChange('batchName', e.target.value)}
                    onBlur={() => saveFieldImmediate('batchName', form.batchName)}
                    placeholder="e.g. Batch 4"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Batch Start Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Batch start date</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {(formSrc.batchStart || formSrc.batch) && (
                      <>
                        <span style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('batch')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      REQUIRED
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Every recommendation is relative to it.</span>
                  <input
                    type="date"
                    value={form.batchStart}
                    onChange={(e) => handleFieldChange('batchStart', e.target.value, true)}
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Batch End Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Batch end date</b>
                  <input
                    type="date"
                    value={form.batchEnd}
                    onChange={(e) => handleFieldChange('batchEnd', e.target.value, true)}
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Screening Closes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Screening closes</b>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Last day for Resolence screening enrolment.</span>
                  <input
                    type="date"
                    value={form.screenClose}
                    onChange={(e) => handleFieldChange('screenClose', e.target.value, true)}
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Enrolment Target */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Enrolment target</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {formSrc.target && (
                      <>
                        <span style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('target')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      REQUIRED
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Screening enrolments for this batch.</span>
                  <input
                    value={form.target}
                    onChange={(e) => handleFieldChange('target', e.target.value)}
                    onBlur={() => saveFieldImmediate('target', form.target)}
                    placeholder="e.g. 300"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Cost Ceiling Per Enrolment */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Cost ceiling per enrolment (₹)</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {formSrc.ceiling && (
                      <>
                        <span style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('ceiling')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      REQUIRED
                    </span>
                  </div>
                  <input
                    value={form.ceiling}
                    onChange={(e) => handleFieldChange('ceiling', e.target.value)}
                    onBlur={() => saveFieldImmediate('ceiling', form.ceiling)}
                    placeholder="e.g. 4500"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Registration Link (Resolence) (Spans full width) */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '14px', fontWeight: 600 }}>Registration link (Resolence)</b>
                    <span style={{ color: 'var(--ink-400)' }}>*</span>
                    {formSrc.regLink && (
                      <>
                        <span style={{ height: '20px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                          From file
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmField('regLink')}
                          style={{ height: '20px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Icon name="i-check" size={11} /> Confirm
                        </button>
                      </>
                    )}
                    <span style={{ flex: 1 }}></span>
                    <span style={{ height: '22px', padding: '0 6px', borderRadius: '4px', border: '1px solid var(--ink-200)', color: 'var(--ink-600)', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', display: 'inline-flex', alignItems: 'center' }}>
                      BLOCKS CREATE CAMPAIGN
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                    Every post gets a source-tagged version of this link so enrolments can be attributed.
                  </span>
                  <input
                    value={form.regLink}
                    onChange={(e) => handleFieldChange('regLink', e.target.value)}
                    onBlur={() => saveFieldImmediate('regLink', form.regLink)}
                    placeholder="resolence.in/r/…"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* GROUP 3: OFFER (Boxed) */}
            <div style={{ border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <b style={{ fontSize: '15px' }}>Offer</b>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: '24px 32px' }}>
                {/* Budget */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Budget (₹)</b>
                  <input
                    value={form.budget}
                    onChange={(e) => handleFieldChange('budget', e.target.value)}
                    placeholder="e.g. 18,00,000"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Fee */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Fee</b>
                  <input
                    value={form.fee}
                    onChange={(e) => handleFieldChange('fee', e.target.value)}
                    placeholder="e.g. No fee"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Stipend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Stipend</b>
                  <input
                    value={form.stipend}
                    onChange={(e) => handleFieldChange('stipend', e.target.value)}
                    placeholder="e.g. ₹2,500/month"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Benefits */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Benefits</b>
                  <textarea
                    value={form.benefits}
                    onChange={(e) => handleFieldChange('benefits', e.target.value)}
                    placeholder="Capstone, mentoring, certificate"
                    style={{ minHeight: '80px', padding: '10px 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', resize: 'vertical', font: 'inherit', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Outcome Promise */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Outcome promise</b>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                    Placement, salary or job claims need Observed evidence before any content can use them (RR-H03).
                  </span>
                  <textarea
                    value={form.outcome}
                    onChange={(e) => handleFieldChange('outcome', e.target.value)}
                    placeholder="e.g. 85% placement rate"
                    style={{ minHeight: '80px', padding: '10px 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', resize: 'vertical', font: 'inherit', width: '100%', boxSizing: 'border-box' }}
                  />
                  {outcomeClaimHit && (
                    <div style={{ display: 'flex', gap: '8px', padding: '8px 10px', borderRadius: '6px', background: 'var(--warning-100)', color: 'var(--warning-800)', fontSize: '12px' }}>
                      <Icon name="i-alert" size={14} style={{ flex: 'none', marginTop: '1px' }} />
                      <span>Held as a claim awaiting evidence.</span>
                    </div>
                  )}
                </div>

                {/* Languages of Instruction */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Languages of instruction</b>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'langs' ? null : 'langs')}
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 12px',
                        border: `1px solid ${openDropdown === 'langs' ? 'var(--teal-600)' : 'var(--ink-300)'}`,
                        borderRadius: '8px',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit'
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: form.langs.length ? 'var(--ink-900)' : 'var(--ink-500)', fontSize: '13px' }}>
                        {form.langs.length ? form.langs.join(', ') : 'Choose one or more'}
                      </span>
                      <Icon name="i-down" size={16} style={{ color: 'var(--ink-600)' }} />
                    </button>
                    {openDropdown === 'langs' && (
                      <>
                        <div onClick={() => setOpenDropdown(null)} style={{ position: 'fixed', inset: 0, zIndex: 20 }}></div>
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '44px', zIndex: 21, background: '#fff', border: '1px solid var(--ink-200)', borderRadius: '8px', boxShadow: 'var(--e-2)', padding: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                          {LANGUAGES.map((l) => {
                            const isChecked = form.langs.includes(l);
                            return (
                              <label key={l} style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '36px', padding: '0 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleArrayItem('langs', l)}
                                  style={{ width: '16px', height: '16px', margin: 0, accentColor: 'var(--teal-700)' }}
                                />
                                {l}
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* GROUP 4: CONTEXT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <b style={{ fontSize: '15px' }}>Context</b>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: '24px 32px' }}>
                {/* Provider */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Provider</b>
                  <input
                    value={form.provider}
                    onChange={(e) => handleFieldChange('provider', e.target.value)}
                    placeholder="e.g. Nexa Skills Foundation"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Competing Programmes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Competing programmes</b>
                  <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Other programmes the same cohort is considering.</span>
                  <input
                    value={form.competing}
                    onChange={(e) => handleFieldChange('competing', e.target.value)}
                    placeholder="e.g. TASK AI Bootcamp"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Past Batch Results */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <b style={{ fontSize: '14px', fontWeight: 600 }}>Past batch results</b>
                  <input
                    value={form.past}
                    onChange={(e) => handleFieldChange('past', e.target.value)}
                    placeholder="e.g. Batch 3: 46 enrolments from 50 target"
                    style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILES TAB */}
      {tab === 'files' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: '20px', alignItems: 'start' }}>
          {/* About this Course Context Editor */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <b style={{ fontSize: '16px' }}>About this course</b>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ink-600)' }}>
                Who it is for, what it teaches, what makes it different. Copilot uses this as context.
              </p>
            </div>
            <textarea
              value={contextVal}
              onChange={(e) => setContextVal(e.target.value)}
              placeholder="e.g. A hybrid AI programme for recent engineering graduates in Warangal, taught in Telugu with English technical terms."
              style={{ width: '100%', minHeight: '160px', padding: '10px 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', resize: 'vertical', font: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                {film.context ? 'Saved' : 'Not saved yet'}
              </span>
              <button
                onClick={handleSaveContext}
                style={{ height: '36px', padding: '0 14px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Save context
              </button>
            </div>
          </div>

          {/* Course Files Table */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--ink-100)' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <b style={{ fontSize: '16px', display: 'block' }}>Course files</b>
                <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Brochures, syllabi, past batch reports</span>
              </div>
              <button
                onClick={() => filesTabInputRef.current && filesTabInputRef.current.click()}
                style={{ height: '36px', padding: '0 14px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                <Icon name="i-upload" size={16} /> Upload
              </button>
            </div>

            {files.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--ink-500)', fontSize: '13px' }}>
                No files yet.
              </div>
            ) : (
              files.map((fl) => {
                const isImg = /\.(png|jpe?g|webp|gif)$/i.test(fl.name || '');
                return (
                  <div key={fl.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', borderBottom: '1px solid var(--ink-100)' }}>
                    <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--ink-50)', display: 'grid', placeItems: 'center', color: 'var(--ink-600)', flex: 'none' }}>
                      <Icon name={isImg ? 'i-image' : 'i-file'} size={16} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fl.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--ink-600)' }}>
                        {(fl.size_label || fl.size || '—') + ' · ' + (fl.date ? HQ.ds(fl.date) : '—') + ' · ' + (fl.by_user || state.user?.name || '—')}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(fl.id, fl.name)}
                      aria-label="Delete"
                      style={{ width: '32px', height: '32px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--ink-500)', display: 'grid', placeItems: 'center', flex: 'none' }}
                    >
                      <Icon name="i-trash" size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* READINESS CHECKLIST MODAL */}
      {showReadinessModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            onClick={() => setShowReadinessModal(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(3px)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 10000,
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '620px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--ink-200)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh'
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <b style={{ fontSize: '18px', fontWeight: 600, display: 'block' }}>
                  Course Brief Readiness Checklist
                </b>
                <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                  All 9 required fields must be populated and confirmed to create campaigns.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowReadinessModal(false)}
                style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-500)', padding: '4px', display: 'grid', placeItems: 'center', borderRadius: '6px' }}
              >
                <Icon name="i-close" size={20} />
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ padding: '16px 24px', background: 'var(--ink-50)', borderBottom: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  <span>Confirmed Readiness</span>
                  <span style={{ color: rdPct === 100 ? 'var(--success-700)' : 'var(--ink-800)' }}>
                    {rdOk} of {rdReq} ({rdPct}%)
                  </span>
                </div>
                <div style={{ height: '8px', borderRadius: '999px', background: 'var(--ink-200)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${rdPct}%`, background: rdColor, borderRadius: '999px', transition: 'width .3s ease' }} />
                </div>
              </div>
            </div>

            {/* Checklist items */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {REQ_BRIEF_FIELDS.map((f, idx) => {
                const confirmed = f.isSet && !f.unconf;
                const unconf = f.isSet && f.unconf;
                const missing = !f.isSet;

                return (
                  <div
                    key={f.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: confirmed ? 'var(--success-50)' : unconf ? 'var(--teal-50)' : 'var(--danger-50)',
                      border: `1px solid ${confirmed ? 'var(--success-200)' : unconf ? 'var(--teal-200)' : 'var(--danger-200)'}`,
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          flex: 'none',
                          background: confirmed ? 'var(--success-600)' : unconf ? 'var(--teal-700)' : 'var(--danger-600)',
                          color: '#fff'
                        }}
                      >
                        {confirmed ? '✓' : idx + 1}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <b style={{ fontSize: '13px', display: 'block', color: 'var(--ink-900)' }}>{f.label}</b>
                        <span style={{ fontSize: '12px', color: 'var(--ink-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                          {f.val || '— Missing / Not filled —'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 'none' }}>
                      {confirmed && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--success-700)', padding: '2px 8px', borderRadius: '4px', background: '#fff' }}>
                          Confirmed
                        </span>
                      )}
                      {unconf && (
                        <>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--teal-800)', padding: '2px 8px', borderRadius: '4px', background: '#fff' }}>
                            Unconfirmed
                          </span>
                          <button
                            type="button"
                            onClick={() => handleConfirmField(f.key)}
                            style={{ border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-800)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Confirm
                          </button>
                        </>
                      )}
                      {missing && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--danger-700)', padding: '2px 8px', borderRadius: '4px', background: '#fff' }}>
                          Required
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleAutoFillDefaults}
                  style={{ border: 0, background: 'var(--teal-700)', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Auto-fill 9/9 Defaults ✓
                </button>
                {unconfirmedKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={handleConfirmAll}
                    style={{ border: '1px solid var(--ink-300)', background: '#fff', color: 'var(--ink-800)', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Confirm all values
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowReadinessModal(false)}
                style={{ border: '1px solid var(--ink-300)', background: '#fff', color: 'var(--ink-700)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
