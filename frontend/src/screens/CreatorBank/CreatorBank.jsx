import React, { useState, useRef, useEffect } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';
import { api } from '../../lib/api';

const DISTRICT_LIST = ['Hyderabad', 'Warangal', 'Hanumakonda', 'Karimnagar', 'Khammam', 'Nalgonda', 'Nizamabad'];

export default function CreatorBank() {
  const { HQ, s } = useHQ();
  const r = s.route || {};
  const fileRef = useRef(null);

  const [state, setState] = useState({
    q: '',
    platform: '',
    tier: '',
    market: '',
    lang: '',
    type: '',
    fresh: r.filter === 'attention' ? 'attention' : '',
    skill: '',
    consent: '',
    paid: '',
    acc: '',
    imOpen: false,
    mode: 'sheet', // default to 'sheet' as full sheet import is primary
    step: 'input', // 'input' | 'summary'
    links: '',
    file: null,
    fileName: '',
    fileSize: '',
    one: { link: '', name: '', type: 'Digital creator' },
    parsing: false,
    importError: '',
    importSummary: null,
    retrying: false,
    fresh_ids: [],
    sortBy: 'name', // 'name' | 'followers' | 'er' | 'district' | 'attributed' | 'updated'
    sortDir: 'asc', // 'asc' | 'desc'
    page: 1,
    pageSize: 50
  });

  const loadSources = async () => {
    try {
      const res = await api.get('/sources');
      if (Array.isArray(res)) {
        HQ.set(z => {
          z.creators = res;
        });
      }
    } catch (err) {
      console.warn('Failed to fetch sources:', err);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const S = HQ.s;
  const creators = Array.isArray(S.creators) ? S.creators : [];

  const attention = c => c.status === 'Failed' || c.status === 'Partial' || HQ.daysBetween(c.updated, HQ.TODAY) > 31;

  const list = creators.filter(c =>
    (!state.q || ((c.name || '') + ' ' + (c.handle || '')).toLowerCase().includes(state.q.toLowerCase())) &&
    (!state.platform || c.platform === state.platform) &&
    (!state.tier || c.tier === state.tier) &&
    (!state.market || c.district === state.market || ((c.markets || {})[state.market] || 0) >= 20) &&
    (!state.lang || Object.keys(c.langs || {}).includes(state.lang) || ((c.langs || {})[state.lang] || 0) >= 30) &&
    (!state.type || c.type === state.type) &&
    (!state.skill || (Array.isArray(c.skills) && c.skills.includes(state.skill)) || ((c.topics || {})[state.skill] || 0) >= 0.5) &&
    (!state.consent || c.consent === state.consent) &&
    (!state.paid || HQ.paidOf(c) === state.paid) &&
    (!state.acc || HQ.accOf(c) === state.acc) &&
    (!state.fresh || (state.fresh === 'fresh' ? HQ.daysBetween(c.updated, HQ.TODAY) <= 31 : attention(c)))
  );

  // Sorting
  const sortedList = [...list].sort((a, b) => {
    let cmp = 0;
    if (state.sortBy === 'followers') {
      cmp = (b.followers || 0) - (a.followers || 0);
    } else if (state.sortBy === 'er') {
      cmp = (Number(b.er) || 0) - (Number(a.er) || 0);
    } else if (state.sortBy === 'attributed') {
      cmp = (b.attributed || 0) - (a.attributed || 0);
    } else if (state.sortBy === 'district') {
      cmp = String(a.district || '').localeCompare(String(b.district || ''));
    } else if (state.sortBy === 'updated') {
      cmp = String(b.updated || '').localeCompare(String(a.updated || ''));
    } else {
      cmp = String(a.name || '').localeCompare(String(b.name || ''));
    }
    return state.sortDir === 'desc' ? -cmp : cmp;
  });

  // Pagination
  const totalPages = state.pageSize === 0 ? 1 : Math.ceil(sortedList.length / state.pageSize) || 1;
  const currentPage = Math.min(state.page, totalPages);
  const pagedList = state.pageSize === 0
    ? sortedList
    : sortedList.slice((currentPage - 1) * state.pageSize, currentPage * state.pageSize);

  const toggleSort = (col) => {
    setState(prev => ({
      ...prev,
      sortBy: col,
      sortDir: prev.sortBy === col && prev.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1
    }));
  };

  const freshCount = creators.filter(c => HQ.daysBetween(c.updated, HQ.TODAY) <= 31).length;
  const failedList = creators.filter(c => c.status === 'Failed' || c.status === 'Partial');

  // Dynamic filter values extracted directly from loaded database creators
  const distinctTypes = Array.from(new Set([...(HQ.SOURCE_TYPES || []), ...creators.map(c => c.type).filter(Boolean)])).sort();
  const distinctPlatforms = Array.from(new Set(['YouTube', 'Instagram', 'LinkedIn', 'Facebook', 'WhatsApp', ...creators.map(c => c.platform).filter(Boolean)]));
  const distinctDistricts = Array.from(new Set([...DISTRICT_LIST, ...creators.map(c => c.district).filter(Boolean)])).sort();
  const distinctLangs = Array.from(new Set(['Telugu', 'English', 'Hindi', ...creators.flatMap(c => Object.keys(c.langs || {}))])).sort();
  const distinctSkills = Array.from(new Set([...(HQ.SKILLS || []), ...creators.flatMap(c => Array.isArray(c.skills) ? c.skills : Object.keys(c.topics || {}))])).sort();

  const F = (key, label, opts) => ({
    val: state[key],
    set: e => setState(prev => ({ ...prev, [key]: e.target.value, page: 1 })),
    opts: [{ v: '', l: label }].concat(opts.map(o => typeof o === 'string' ? { v: o, l: o } : o)),
    bc: state[key] ? 'var(--teal-600)' : 'var(--ink-300)',
    bg: state[key] ? 'var(--teal-50)' : '#fff',
    fw: state[key] ? 600 : 400
  });

  const filters = [
    F('type', 'All source types', distinctTypes),
    F('platform', 'All platforms', distinctPlatforms),
    F('market', 'All districts', distinctDistricts),
    F('lang', 'All languages', distinctLangs),
    F('skill', 'All skill domains', distinctSkills),
    F('tier', 'All tiers', ['Nano', 'Micro', 'Mid', 'Macro', 'Mega']),
    F('consent', 'Any consent status', ['Recorded', 'Missing', 'Not required']),
    F('paid', 'Any collaboration', ['Paid', 'Partnership']),
    F('acc', 'Any account type', ['Individual', 'Institutional']),
    F('fresh', 'Any freshness', [{ v: 'fresh', l: 'Fresh (≤31 days)' }, { v: 'attention', l: 'Needs attention' }])
  ];

  const anyFilter = !!(state.platform || state.tier || state.market || state.lang || state.type || state.fresh || state.paid || state.acc || state.skill || state.consent || state.q);
  const clearFilters = () => setState(prev => ({ ...prev, q: '', platform: '', tier: '', market: '', lang: '', type: '', fresh: '', paid: '', acc: '', skill: '', consent: '', page: 1 }));

  const handleRetryAll = async () => {
    if (!failedList.length || state.retrying) return HQ.toast(failedList.length ? 'Already retrying' : 'Nothing to retry');
    setState(prev => ({ ...prev, retrying: true }));
    try {
      const res = await api.post('/sources/refresh-failed', {});
      await loadSources();
      HQ.toast(`Retried failed sources: ${res.refreshed || 0} refreshed`);
    } catch (err) {
      HQ.toast(`Retry failed: ${err.message}`, 'error');
    } finally {
      setState(prev => ({ ...prev, retrying: false }));
    }
  };

  // Download official template from backend
  const handleDownloadTemplate = async (format = 'xlsx') => {
    try {
      const token = api.token.get();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/sources/template?format=${format}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hireiq-creator-bank-template.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      HQ.toast(`Downloaded template (${format.toUpperCase()})`);
    } catch (err) {
      HQ.toast(`Failed to download template: ${err.message}`, 'error');
    }
  };

  // Handle single YouTube creator import
  const handleImportSingle = async () => {
    const link = (state.one.link || '').trim();
    if (!link) {
      setState(prev => ({ ...prev, importError: 'Please enter a YouTube channel or video URL' }));
      HQ.toast('Please enter a YouTube channel or video URL', 'error');
      return;
    }

    setState(prev => ({ ...prev, parsing: true, importError: '' }));
    try {
      const res = await api.post('/sources/import-youtube', {
        url: link,
        type: state.one.type || 'Digital creator',
        name: state.one.name || null
      });

      if (res.ok) {
        HQ.toast(res.message || 'Creator imported successfully!');
        await loadSources();
        setState(prev => ({
          ...prev,
          imOpen: false,
          parsing: false,
          importError: '',
          one: { link: '', name: '', type: 'Digital creator' }
        }));
        if (res.sourceId) {
          HQ.go('creator', { id: res.sourceId });
        }
      } else {
        const msg = res.message || 'Import failed';
        setState(prev => ({ ...prev, parsing: false, importError: msg }));
        HQ.toast(msg, 'error');
      }
    } catch (err) {
      const msg = err.body?.error || err.message || 'YouTube import failed';
      setState(prev => ({ ...prev, parsing: false, importError: msg }));
      HQ.toast(msg, 'error');
    }
  };

  // Handle Full Sheet Excel/CSV import
  const handleImportSheet = async () => {
    if (!state.file) {
      setState(prev => ({ ...prev, importError: 'Please choose an Excel (.xlsx, .xls) or CSV file first.' }));
      HQ.toast('Please select a spreadsheet file', 'error');
      return;
    }

    setState(prev => ({ ...prev, parsing: true, importError: '' }));
    try {
      const formData = new FormData();
      formData.append('file', state.file);

      const res = await api.post('/sources/import', formData);
      if (res && res.ok) {
        await loadSources();
        setState(prev => ({
          ...prev,
          parsing: false,
          step: 'summary',
          importSummary: res,
          importError: ''
        }));
        HQ.toast(res.message || `Import completed: ${res.imported} added, ${res.updated} updated`);
      } else {
        const msg = res?.error || 'Spreadsheet import failed';
        setState(prev => ({ ...prev, parsing: false, importError: msg }));
        HQ.toast(msg, 'error');
      }
    } catch (err) {
      const msg = err.body?.error || err.message || 'Spreadsheet import failed';
      setState(prev => ({ ...prev, parsing: false, importError: msg }));
      HQ.toast(msg, 'error');
    }
  };

  // Download failure report as CSV
  const handleDownloadFailureReport = () => {
    if (!state.importSummary || !state.importSummary.errors || !state.importSummary.errors.length) return;
    const rows = state.importSummary.errors.map(e => `"${e.row}","${(e.source || '').replace(/"/g, '""')}","${(e.reason || '').replace(/"/g, '""')}"`);
    const csvContent = 'Row,Source,Failure Reason\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-failures-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    HQ.toast('Failure report downloaded');
  };

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title & Actions */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600, letterSpacing: '-.015em' }}>Creator Bank</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-600)' }}>
            Influence sources for Hire IQ: creators, college networks, placement cells, alumni, trainers and community leaders. Separate from Screen IQ's bank. Enriched from official APIs and refreshed monthly.
          </p>
        </div>
        <button
          onClick={handleRetryAll}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            height: '40px',
            padding: '0 14px',
            borderRadius: '8px',
            border: '1px solid var(--ink-300)',
            background: '#fff',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Icon name="i-refresh" size={16} style={{ animation: state.retrying ? 'spin .8s linear infinite' : 'none' }} />
          Retry failed ({failedList.length})
        </button>
        <button
          onClick={() => setState(prev => ({
            ...prev,
            imOpen: true,
            step: 'input',
            mode: 'sheet',
            file: null,
            fileName: '',
            fileSize: '',
            importError: '',
            importSummary: null
          }))}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            height: '40px',
            padding: '0 16px',
            borderRadius: '8px',
            border: 0,
            background: 'var(--teal-700)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Icon name="i-upload" size={16} /> Import sources
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px' }}>
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
          <div style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Sources</div>
          <div style={{ fontSize: '24px', fontWeight: 600 }}>{creators.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
            {creators.filter(c => HQ.isInst(c)).length} institutional · {creators.filter(c => ['Alumnus', 'Trainer or mentor', 'Community leader'].includes(c.type)).length} trust anchors · {creators.filter(c => ['Micro-influencer', 'Digital creator'].includes(c.type)).length} creators
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
          <div style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Refreshed in 31 days</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: creators.length && (freshCount / creators.length) >= 0.9 ? 'var(--success-600)' : 'var(--warning-600)' }}>
            {creators.length ? Math.round((freshCount / creators.length) * 100) : 0}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Target 90% of active creators</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
          <div style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Need attention</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: failedList.length ? 'var(--danger-600)' : 'var(--ink-900)' }}>
            {failedList.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Failed or partial enrichment</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
          <div style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Consent missing</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: creators.some(c => HQ.isInst(c) && c.consent !== 'Recorded') ? 'var(--warning-600)' : 'var(--ink-900)' }}>
            {creators.filter(c => HQ.isInst(c) && c.consent !== 'Recorded').length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Institutional sources blocked by RR-H06</div>
        </div>
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '260px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--ink-500)', display: 'flex' }}>
            <Icon name="i-search" size={16} />
          </span>
          <input
            value={state.q}
            onChange={(e) => setState(prev => ({ ...prev, q: e.target.value }))}
            placeholder="Search name or handle"
            style={{ width: '100%', height: '40px', padding: '0 12px 0 36px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
          />
        </div>

        {filters.map((f, i) => (
          <select
            key={i}
            value={f.val}
            onChange={f.set}
            style={{
              height: '40px',
              padding: '0 10px',
              border: `1px solid ${f.bc}`,
              borderRadius: '8px',
              background: f.bg,
              fontWeight: f.fw
            }}
          >
            {f.opts.map(o => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
        ))}

        {anyFilter && (
          <button
            onClick={clearFilters}
            style={{ height: '40px', padding: '0 12px', border: 0, background: 'none', color: 'var(--teal-700)', fontWeight: 600, cursor: 'pointer' }}
          >
            Clear filters
          </button>
        )}
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: '13px', color: 'var(--ink-500)' }}>{list.length} of {creators.length}</span>
      </div>

      {/* Creator Table */}
      <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.6fr) 130px 90px 84px 60px 110px minmax(150px,1fr) minmax(170px,1.1fr) 84px 100px 100px 100px', minWidth: '1500px', gap: '12px', padding: '0 20px', height: '40px', alignItems: 'center', background: 'var(--ink-50)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-600)' }}>
          <span onClick={() => toggleSort('name')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Source {state.sortBy === 'name' ? (state.sortDir === 'asc' ? '▲' : '▼') : ''}
          </span>
          <span>Type</span>
          <span>Platform</span>
          <span onClick={() => toggleSort('followers')} style={{ textAlign: 'right', cursor: 'pointer', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}>
            Followers {state.sortBy === 'followers' ? (state.sortDir === 'asc' ? '▲' : '▼') : ''}
          </span>
          <span onClick={() => toggleSort('er')} style={{ textAlign: 'right', cursor: 'pointer', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}>
            ER {state.sortBy === 'er' ? (state.sortDir === 'asc' ? '▲' : '▼') : ''}
          </span>
          <span onClick={() => toggleSort('district')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            District {state.sortBy === 'district' ? (state.sortDir === 'asc' ? '▲' : '▼') : ''}
          </span>
          <span>Skill domains</span>
          <span>Affiliation</span>
          <span onClick={() => toggleSort('attributed')} style={{ textAlign: 'right', cursor: 'pointer', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}>
            Enrolments {state.sortBy === 'attributed' ? (state.sortDir === 'asc' ? '▲' : '▼') : ''}
          </span>
          <span>Consent</span>
          <span>Enrichment</span>
          <span onClick={() => toggleSort('updated')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Updated {state.sortBy === 'updated' ? (state.sortDir === 'asc' ? '▲' : '▼') : ''}
          </span>
        </div>

        {!pagedList.length ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--ink-500)' }}>No sources match these filters.</div>
        ) : (
          pagedList.map(c => {
            const age = HQ.daysBetween(c.updated, HQ.TODAY);
            const g = HQ.gateOf(c);
            const skills = Array.isArray(c.skills) && c.skills.length
              ? c.skills.slice(0, 2).join(', ')
              : Object.entries(c.topics || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]).join(', ');
            const folTip = c.catchment ? 'Catchment entered by the team (Uploaded)' : 'Followers (Fetched)';
            const cstTone = HQ.tone(c.consent);
            const stTone = HQ.tone(c.status);
            const updColor = age > 90 ? 'var(--danger-600)' : age > 31 ? 'var(--warning-800)' : 'var(--ink-600)';
            const avColors = c.av || ['#e0e7ff', '#3730a3'];

            return (
              <div
                key={c.id}
                onClick={() => HQ.go('creator', { id: c.id })}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(220px,1.6fr) 130px 90px 84px 60px 110px minmax(150px,1fr) minmax(170px,1.1fr) 84px 100px 100px 100px',
                  minWidth: '1500px',
                  gap: '12px',
                  padding: '0 20px',
                  height: '56px',
                  alignItems: 'center',
                  borderTop: '1px solid var(--ink-100)',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                <span style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                  {c.contact?.avatar ? (
                    <img src={c.contact.avatar} alt="" style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', flex: 'none', border: '1px solid var(--ink-100)' }} />
                  ) : (
                    <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: avColors[0], color: avColors[1], display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '12px', flex: 'none' }}>
                      {c.initials || (c.name ? c.name[0] : 'S')}
                    </span>
                  )}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <b style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</b>
                      {g && (
                        <span title={`${g.rule}: ${g.reason}`} style={{ display: 'inline-flex', height: '18px', padding: '0 6px', borderRadius: '4px', background: 'var(--danger-100)', color: 'var(--danger-800)', fontSize: '11px', fontWeight: 600, alignItems: 'center' }}>
                          Gate
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{c.handle}</span>
                  </span>
                </span>
                <span style={{ color: 'var(--ink-700)' }}>{c.type}</span>
                <span>{c.platform}</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }} title={folTip}>{c.catchment ? HQ.n(c.catchment) : HQ.n(c.followers)}</span>
                <span style={{ textAlign: 'right' }}>{c.er != null ? `${c.er}%` : '—'}</span>
                <span>{c.district || '—'}</span>
                <span style={{ fontSize: '12px', color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skills || '—'}</span>
                <span style={{ fontSize: '12px', color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.affiliation || '—'}>{c.affiliation || '—'}</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{c.attributed ? String(c.attributed) : '—'}</span>
                <span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: cstTone.bg, color: cstTone.fg, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {c.consent || 'Not required'}
                  </span>
                </span>
                <span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '22px', padding: '0 8px', borderRadius: '999px', background: stTone.bg, color: stTone.fg, fontSize: '12px', fontWeight: 600 }}>
                    {c.status || 'Enriched'}
                  </span>
                </span>
                <span style={{ fontSize: '12px', color: updColor }}>{HQ.ds(c.updated)}{age > 31 ? ` · ${age}d` : ''}</span>
              </div>
            );
          })
        )}

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--ink-100)', background: '#fff', fontSize: '13px' }}>
          <div style={{ color: 'var(--ink-600)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Showing {sortedList.length === 0 ? 0 : (currentPage - 1) * state.pageSize + 1}–{Math.min(currentPage * state.pageSize, sortedList.length)} of {sortedList.length} sources ({creators.length} total)</span>
            <span style={{ color: 'var(--ink-300)' }}>•</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Per page:</span>
              <select
                value={state.pageSize}
                onChange={e => setState(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
                style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--ink-300)', fontSize: '12px', background: '#fff' }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={0}>All</option>
              </select>
            </label>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setState(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                style={{ height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--ink-300)', background: '#fff', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.5 : 1, fontSize: '12px', fontWeight: 600 }}
              >
                Previous
              </button>
              <span style={{ padding: '0 8px', color: 'var(--ink-700)', fontWeight: 600 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setState(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                style={{ height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--ink-300)', background: '#fff', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.5 : 1, fontSize: '12px', fontWeight: 600 }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {state.imOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,36,43,.45)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
          <div style={{ width: '760px', maxHeight: '88vh', background: '#fff', borderRadius: '16px', boxShadow: 'var(--e-3)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ink-100)' }}>
              <div>
                <b style={{ fontSize: '18px', display: 'block' }}>Import sources</b>
                <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                  {state.step === 'input'
                    ? (state.mode === 'sheet' ? 'Full Excel Workbook Import' : state.mode === 'one' ? 'Single YouTube Creator Import' : 'Links Import')
                    : 'Import Results & Summary'}
                </span>
              </div>
              <button
                onClick={() => setState(prev => ({ ...prev, imOpen: false }))}
                aria-label="Close"
                style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-500)', padding: '4px' }}
              >
                <Icon name="i-x" size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Mode Selector Tabs (only shown on input step) */}
              {state.step === 'input' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                  {[
                    ['sheet', 'Full sheet', 'Complete Excel workbook (.xlsx, .xls)', 'i-file'],
                    ['one', 'One creator', 'Single YouTube channel or video URL', 'i-user'],
                    ['links', 'Links only', 'Batch profile links', 'i-link']
                  ].map(([k, l, d, ic]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setState(prev => ({ ...prev, mode: k, importError: '' }))}
                      style={{
                        textAlign: 'left',
                        padding: '14px',
                        borderRadius: '10px',
                        border: `1.5px solid ${state.mode === k ? 'var(--teal-600)' : 'var(--ink-200)'}`,
                        background: state.mode === k ? 'var(--teal-50)' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <span style={{ color: 'var(--teal-700)', display: 'flex' }}><Icon name={ic} size={20} /></span>
                      <b>{l}</b>
                      <span style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{d}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Error Banner */}
              {state.importError && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'var(--danger-50)', border: '1px solid var(--danger-200)', color: 'var(--danger-800)', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <Icon name="i-alert" size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <b>Import Error:</b> {state.importError}
                  </div>
                </div>
              )}

              {/* Mode: FULL SHEET */}
              {state.step === 'input' && state.mode === 'sheet' && (
                <>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    ref={fileRef}
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) {
                        const sizeKb = (f.size / 1024).toFixed(1) + ' KB';
                        setState(prev => ({ ...prev, file: f, fileName: f.name, fileSize: sizeKb, importError: '' }));
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <div
                    onClick={() => fileRef.current && fileRef.current.click()}
                    style={{
                      border: '2px dashed var(--teal-300)',
                      background: state.fileName ? 'var(--teal-50)' : 'var(--ink-25)',
                      borderRadius: '12px',
                      padding: '32px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'background .2s, border-color .2s'
                    }}
                  >
                    <span style={{ color: 'var(--teal-700)', display: 'flex', justifyContent: 'center' }}>
                      <Icon name="i-upload" size={28} />
                    </span>
                    <b style={{ display: 'block', marginTop: '8px', fontSize: '15px' }}>
                      {state.fileName || 'Click to select or drop your Excel workbook'}
                    </b>
                    <span style={{ fontSize: '12px', color: 'var(--ink-600)', marginTop: '4px', display: 'block' }}>
                      {state.fileName ? `${state.fileSize} · Click to choose a different file` : 'Supports .xlsx, .xls, and .csv files with complete creator rows'}
                    </span>
                  </div>

                  {/* Template links */}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '13px', background: 'var(--ink-50)', padding: '12px 16px', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink-700)' }}>Template:</span>
                    <a
                      href="#download-xlsx"
                      onClick={(e) => { e.preventDefault(); handleDownloadTemplate('xlsx'); }}
                      style={{ color: 'var(--teal-700)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Icon name="i-file" size={14} /> Download Excel template (.xlsx)
                    </a>
                    <span style={{ color: 'var(--ink-300)' }}>·</span>
                    <a
                      href="#download-csv"
                      onClick={(e) => { e.preventDefault(); handleDownloadTemplate('csv'); }}
                      style={{ color: 'var(--teal-700)', fontWeight: 600 }}
                    >
                      Download CSV template
                    </a>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--ink-500)', lineHeight: '18px' }}>
                    <b>How it works:</b> We read the entire sheet and map column names (e.g. Source Name, Handle, Platform, Followers, ER, District, Skills, Affiliation, Consent). Valid rows are saved to the database. Duplicates are merged without overwriting your manual edits. Row-level errors are reported for correction.
                  </div>
                </>
              )}

              {/* Mode: ONE CREATOR */}
              {state.step === 'input' && state.mode === 'one' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1/-1' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>YouTube URL <span style={{ color: 'var(--danger-600)' }}>*</span></label>
                    <input
                      value={state.one.link}
                      onChange={(e) => setState(prev => ({ ...prev, one: { ...prev.one, link: e.target.value }, importError: '' }))}
                      placeholder="https://www.youtube.com/@channel or https://www.youtube.com/watch?v=..."
                      style={{ height: '42px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontSize: '13px' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)', lineHeight: '16px' }}>
                      Supports channel URLs (@handle, /channel/UC..., /c/name, /user/name) or video URLs (watch?v=..., youtu.be/..., /shorts/...). Video URLs are automatically resolved to their owning channel.
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Display name <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}>(optional)</span></label>
                    <input
                      value={state.one.name}
                      onChange={(e) => setState(prev => ({ ...prev, one: { ...prev.one, name: e.target.value } }))}
                      placeholder="Auto-fetched from YouTube API"
                      style={{ height: '42px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Source type</label>
                    <select
                      value={state.one.type}
                      onChange={(e) => setState(prev => ({ ...prev, one: { ...prev.one, type: e.target.value } }))}
                      style={{ height: '42px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff', fontSize: '13px' }}
                    >
                      <option>Digital creator</option>
                      <option>Micro-influencer</option>
                      <option>College network</option>
                      <option>Placement cell</option>
                      <option>Alumnus</option>
                      <option>Trainer or mentor</option>
                      <option>Community leader</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Mode: LINKS ONLY */}
              {state.step === 'input' && state.mode === 'links' && (
                <>
                  <textarea
                    value={state.links}
                    onChange={(e) => setState(prev => ({ ...prev, links: e.target.value }))}
                    placeholder="Paste one profile link or video URL per line:
https://www.youtube.com/@channel
https://www.youtube.com/watch?v=...
https://instagram.com/profile
https://linkedin.com/in/profile"
                    style={{ minHeight: '140px', padding: '12px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '12px' }}
                  />
                  <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                    For single YouTube creators with live enrichment, we recommend using the <b>One creator</b> tab. For multiple records with districts, rates, and skills, use the <b>Full sheet</b> tab.
                  </div>
                </>
              )}

              {/* Loading Indicator */}
              {state.parsing && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--teal-800)', background: 'var(--teal-50)', padding: '14px 18px', borderRadius: '8px', border: '1px solid var(--teal-200)' }}>
                  <span style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid var(--teal-300)', borderTopColor: 'var(--teal-700)', animation: 'spin .8s linear infinite', flexShrink: 0 }}></span>
                  <div style={{ fontSize: '13px' }}>
                    <b>{state.mode === 'one' ? 'Fetching YouTube Data API v3...' : 'Processing workbook...'}</b>
                    <span style={{ display: 'block', color: 'var(--ink-600)', fontSize: '12px' }}>
                      {state.mode === 'one' ? 'Resolving channel ID, metrics, thumbnail, and public videos...' : 'Validating rows, calculating metrics, and persisting to database...'}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 2: SUMMARY & FAILURE REPORT */}
              {state.step === 'summary' && state.importSummary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '10px' }}>
                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--ink-50)', border: '1px solid var(--ink-100)' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700 }}>{state.importSummary.totalRows || 0}</div>
                      <div style={{ fontSize: '12px', color: 'var(--ink-600)', fontWeight: 600 }}>Total rows</div>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--success-100)', color: 'var(--success-800)', border: '1px solid #BFE3CE' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700 }}>{state.importSummary.imported || 0}</div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>New imported</div>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--warning-100)', color: 'var(--warning-800)', border: '1px solid #F6E3B4' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700 }}>{state.importSummary.updated || 0}</div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>Updated existing</div>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--ink-100)', color: 'var(--ink-700)', border: '1px solid var(--ink-200)' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700 }}>{state.importSummary.skipped || 0}</div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>Duplicates skipped</div>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: state.importSummary.failed ? 'var(--danger-100)' : 'var(--ink-50)', color: state.importSummary.failed ? 'var(--danger-800)' : 'var(--ink-500)', border: state.importSummary.failed ? '1px solid #F2C6BF' : '1px solid var(--ink-100)' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700 }}>{state.importSummary.failed || 0}</div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>Failed rows</div>
                    </div>
                  </div>

                  {/* Success Message Banner */}
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--success-50, #f0fdf4)', border: '1px solid var(--success-200, #bbf7d0)', color: 'var(--success-800)', fontSize: '13px' }}>
                    {state.importSummary.message}
                  </div>

                  {/* Failure Report Table */}
                  {state.importSummary.errors && state.importSummary.errors.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <b style={{ fontSize: '14px', color: 'var(--danger-800)' }}>
                          Failed Rows Report ({state.importSummary.errors.length})
                        </b>
                        <button
                          type="button"
                          onClick={handleDownloadFailureReport}
                          style={{
                            border: '1px solid var(--ink-300)',
                            background: '#fff',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Icon name="i-upload" size={12} /> Download failure report (.csv)
                        </button>
                      </div>

                      <div style={{ border: '1px solid var(--danger-200)', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', background: '#fff' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'var(--danger-50)', borderBottom: '1px solid var(--danger-200)', color: 'var(--danger-900)' }}>
                              <th style={{ padding: '8px 12px', width: '60px' }}>Row</th>
                              <th style={{ padding: '8px 12px', width: '160px' }}>Source / Handle</th>
                              <th style={{ padding: '8px 12px' }}>Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {state.importSummary.errors.map((err, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--ink-100)' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--ink-600)' }}>{err.row}</td>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{err.source || err.handle || '—'}</td>
                                <td style={{ padding: '8px 12px', color: 'var(--danger-700)' }}>{err.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                    All valid records have been saved to the database. The Creator Bank list has been reloaded.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--ink-100)', display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
              {state.step === 'summary' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setState(prev => ({
                      ...prev,
                      step: 'input',
                      file: null,
                      fileName: '',
                      fileSize: '',
                      importSummary: null,
                      importError: ''
                    }))}
                    style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Import another file
                  </button>
                  <button
                    type="button"
                    onClick={() => setState(prev => ({ ...prev, imOpen: false }))}
                    style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={state.parsing}
                    onClick={() => setState(prev => ({ ...prev, imOpen: false }))}
                    style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={state.parsing || (state.mode === 'sheet' && !state.file) || (state.mode === 'one' && !state.one.link.trim())}
                    onClick={() => {
                      if (state.mode === 'one') {
                        handleImportSingle();
                      } else if (state.mode === 'sheet') {
                        handleImportSheet();
                      } else if (state.mode === 'links') {
                        const first = (state.links || '').split('\n').map(l => l.trim()).filter(Boolean)[0];
                        if (first) {
                          setState(prev => ({ ...prev, one: { ...prev.one, link: first }, mode: 'one' }));
                        } else {
                          HQ.toast('Please enter at least one link', 'error');
                        }
                      }
                    }}
                    style={{
                      height: '40px',
                      padding: '0 20px',
                      borderRadius: '8px',
                      border: 0,
                      background: state.parsing ? 'var(--teal-600)' : (state.mode === 'sheet' && !state.file) || (state.mode === 'one' && !state.one.link.trim()) ? 'var(--ink-200)' : 'var(--teal-700)',
                      color: (state.mode === 'sheet' && !state.file) || (state.mode === 'one' && !state.one.link.trim()) ? 'var(--ink-500)' : '#fff',
                      fontWeight: 600,
                      cursor: state.parsing ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {state.parsing && <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .8s linear infinite' }}></span>}
                    {state.parsing
                      ? (state.mode === 'one' ? 'Importing from YouTube…' : 'Importing spreadsheet…')
                      : (state.mode === 'one' ? 'Import creator' : state.mode === 'sheet' ? 'Import sheet' : 'Check links')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
