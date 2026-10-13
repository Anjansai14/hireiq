import React, { useState, useRef } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

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
    mode: 'links',
    step: 'input',
    links: '',
    fileName: '',
    one: { link: '', name: '', type: 'Digital creator' },
    parsing: false,
    preview: [],
    jobs: [],
    retrying: false,
    fresh_ids: []
  });

  const S = HQ.s;
  const attention = c => c.status === 'Failed' || c.status === 'Partial' || HQ.daysBetween(c.updated, HQ.TODAY) > 31;
  const list = S.creators.filter(c =>
    (!state.q || ((c.name || '') + (c.handle || '')).toLowerCase().includes(state.q.toLowerCase())) &&
    (!state.platform || c.platform === state.platform) &&
    (!state.tier || c.tier === state.tier) &&
    (!state.market || ((c.markets || {})[state.market] || 0) >= 20) &&
    (!state.lang || ((c.langs || {})[state.lang] || 0) >= 30) &&
    (!state.type || c.type === state.type) &&
    (!state.skill || ((c.topics || {})[state.skill] || 0) >= 0.5) &&
    (!state.consent || c.consent === state.consent) &&
    (!state.paid || HQ.paidOf(c) === state.paid) &&
    (!state.acc || HQ.accOf(c) === state.acc) &&
    (!state.fresh || (state.fresh === 'fresh' ? HQ.daysBetween(c.updated, HQ.TODAY) <= 31 : attention(c)))
  );

  const freshCount = S.creators.filter(c => HQ.daysBetween(c.updated, HQ.TODAY) <= 31).length;
  const failedList = S.creators.filter(c => c.status === 'Failed' || c.status === 'Partial');

  const F = (key, label, opts) => ({
    val: state[key],
    set: e => setState(prev => ({ ...prev, [key]: e.target.value })),
    opts: [{ v: '', l: label }].concat(opts.map(o => typeof o === 'string' ? { v: o, l: o } : o)),
    bc: state[key] ? 'var(--teal-600)' : 'var(--ink-300)',
    bg: state[key] ? 'var(--teal-50)' : '#fff',
    fw: state[key] ? 600 : 400
  });

  const filters = [
    F('type', 'All source types', HQ.SOURCE_TYPES),
    F('platform', 'All platforms', ['YouTube', 'Instagram', 'Facebook', 'WhatsApp', 'LinkedIn']),
    F('market', 'All districts', HQ.MK),
    F('lang', 'All languages', ['Telugu', 'English', 'Hindi']),
    F('skill', 'All skill domains', HQ.SKILLS),
    F('tier', 'All tiers', ['Nano', 'Micro', 'Mid', 'Macro', 'Mega']),
    F('consent', 'Any consent status', ['Recorded', 'Missing', 'Not required']),
    F('paid', 'Any collaboration', ['Paid', 'Partnership']),
    F('acc', 'Any account type', ['Individual', 'Institutional']),
    F('fresh', 'Any freshness', [{ v: 'fresh', l: 'Fresh (≤31 days)' }, { v: 'attention', l: 'Needs attention' }])
  ];

  const anyFilter = !!(state.platform || state.tier || state.market || state.lang || state.type || state.fresh || state.paid || state.acc || state.skill || state.consent || state.q);
  const clearFilters = () => setState(prev => ({ ...prev, q: '', platform: '', tier: '', market: '', lang: '', type: '', fresh: '', paid: '', acc: '', skill: '', consent: '' }));

  const handleRetryAll = () => {
    if (!failedList.length || state.retrying) return HQ.toast(failedList.length ? 'Already retrying' : 'Nothing to retry');
    setState(prev => ({ ...prev, retrying: true }));
    setTimeout(() => {
      HQ.set(z => {
        z.creators.forEach(c => {
          if (c.status === 'Failed') {
            c.status = 'Enriched';
            c.updated = HQ.TODAY;
            c.next = HQ.addDays(HQ.TODAY, 31);
            c.activity.unshift({ date: HQ.TODAY, text: 'Retry succeeded: profile refreshed' });
          } else if (c.status === 'Partial') {
            c.updated = HQ.TODAY;
            c.next = HQ.addDays(HQ.TODAY, 31);
            c.activity.unshift({ date: HQ.TODAY, text: 'Retry: still partial (owner-only fields unavailable)' });
          }
        });
      });
      setState(prev => ({ ...prev, retrying: false }));
      HQ.toast(`Retried ${failedList.length}: failed profiles refreshed; partial ones still need the creator to connect`);
    }, 1800);
  };

  const parseLink = (l) => {
    const t = l.trim();
    if (!t) return null;
    if (!/^https?:\/\//.test(t)) return { kind: 'Error', src: t, platform: '—', note: 'Not a link' };
    const m = t.match(/(youtube\.com\/(@[\w.]+)|instagram\.com\/([\w.]+)|facebook\.com\/([\w.\/]+)|linkedin\.com\/(in|school|company)\/([\w.-]+)|(x\.com|twitter\.com)\/([\w.]+))/i);
    if (!m) return { kind: 'Error', src: t, platform: '—', note: 'Unrecognised platform' };
    if (m[7]) return { kind: 'Error', src: t, platform: 'X', note: 'X is not supported in v1' };
    const platform = m[2] ? 'YouTube' : m[3] ? 'Instagram' : m[6] ? 'LinkedIn' : 'Facebook';
    const handle = m[2] ? m[2] : m[3] ? '@' + m[3] : m[6] ? 'linkedin.com/' + m[5] + '/' + m[6] : 'fb.com/' + m[4];
    if (/tiny|small|new/i.test(t) && platform !== 'LinkedIn') return { kind: 'Error', src: t, platform, note: 'Rejected: creator below 1,000 followers (rule applies to creators, not institutional channels)' };
    if (platform === 'LinkedIn') {
      const dupL = HQ.s.creators.find(c => c.handle.toLowerCase() === handle.toLowerCase());
      if (dupL) return { kind: 'Merge', src: t, platform, handle, note: 'Already in bank as ' + dupL.name, dupId: dupL.id };
      return { kind: 'New', src: t, platform, handle, note: 'LinkedIn: sheet upload and manual metrics in v1' };
    }
    const dup = HQ.s.creators.find(c => c.handle.toLowerCase() === handle.toLowerCase() && c.platform === platform);
    if (dup) return { kind: 'Merge', src: t, platform, handle, note: 'Already in bank as ' + dup.name + ': will refresh, keep your edits', dupId: dup.id };
    return { kind: 'New', src: t, platform, handle, note: 'Will be enriched from ' + (platform === 'YouTube' ? 'YouTube Data API' : 'Meta Graph API') };
  };

  const parseImport = () => {
    let rows = [];
    if (state.mode === 'links') {
      rows = state.links.split('\n').map(l => parseLink(l)).filter(Boolean).map(r => ({ ...r, via: 'links-only sheet' }));
    } else if (state.mode === 'one') {
      const r = parseLink(state.one.link);
      if (r) rows = [{ ...r, name: state.one.name, type: state.one.type, via: 'single creator' }];
    } else {
      rows = [
        'https://youtube.com/@telugutechtalks',
        'https://instagram.com/warangal.coders',
        'https://youtube.com/@techteluguravi',
        'https://linkedin.com/school/vce-placements',
        'https://instagram.com/tiny.dev.notes',
        'name-only row (no link)'
      ].map(l => parseLink(l)).map((r, i) => ({
        ...r,
        via: state.fileName || 'source roster sheet',
        type: ['Digital creator', 'Micro-influencer', '', 'Placement cell', 'Micro-influencer', ''][i],
        note: r.kind === 'Error' && i === 5 ? 'Row 7: profile link missing' : r.note
      }));
    }
    if (!rows.length) return HQ.toast(state.mode === 'sheet' ? 'Choose a file or use the sample roster' : 'Add at least one link', 'error');
    setState(prev => ({ ...prev, parsing: true }));
    setTimeout(() => {
      setState(prev => ({ ...prev, parsing: false, step: 'preview', preview: rows }));
    }, 800);
  };

  const makeCreator = (row, i) => {
    const R = (a, b) => Math.round(a + Math.random() * (b - a));
    const nm = row.name || row.handle.replace(/^@|fb\.com\//, '').split(/[._]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    const followers = R(40000, 900000);
    const tier = followers > 1.5e6 ? 'Mega' : followers > 5e5 ? 'Macro' : followers > 1e5 ? 'Mid' : 'Micro';
    const AV = [['#CFEDE4', '#0F5C54'], ['#E6EFF8', '#1D4775'], ['#FBF1DD', '#7A4F0F'], ['#F3E9F6', '#5E3070']][i % 4];
    const mv = Math.round(followers * (0.15 + Math.random() * 0.25));
    const type = row.type || 'Digital creator';
    const inst = HQ.INSTITUTIONAL.includes(type);
    const status = row.result || 'Enriched';
    return {
      id: HQ.uid('c'),
      name: nm,
      handle: row.handle,
      platform: row.platform,
      type,
      tier,
      followers,
      mv,
      er: +(2.5 + Math.random() * 6).toFixed(1),
      langs: { Telugu: 72, English: 28 },
      markets: { Hyderabad: 40, Warangal: 22, Hanumakonda: 10, Karimnagar: 10, Khammam: 10, Nalgonda: 8 },
      district: 'Hyderabad',
      content: ['Career content', 'Tech explainers'],
      tone: 'Conversational',
      formats: row.platform === 'YouTube' ? ['Long video', 'Shorts'] : row.platform === 'LinkedIn' ? ['Posts'] : ['Reels'],
      topics: { 'AI/ML': +(0.3 + Math.random() * 0.5).toFixed(2), 'Career guidance': +(0.3 + Math.random() * 0.5).toFixed(2), Placements: 0.4 },
      skills: ['AI/ML', 'Career guidance'],
      cohort: 'Engineering graduates (AI-inferred)',
      affiliation: '',
      consent: inst ? 'Missing' : 'Not required',
      attributed: 0,
      catchment: null,
      rate: inst ? 0 : (HQ.s.rateTiers.find(t => t.tier === tier) || { lo: 10000, hi: 20000 }).lo + 5000,
      rateSrc: inst ? 'Partnership' : 'Illustrative',
      verif: 'Verified',
      acct: 'Creator',
      updated: HQ.TODAY,
      next: HQ.addDays(HQ.TODAY, 31),
      status,
      partialNote: status === 'Partial' ? 'Audience geography unavailable (owner-only); comment text unavailable' : undefined,
      failNote: status === 'Failed' ? 'Account is private or personal: Business Discovery cannot read it' : undefined,
      flags: [],
      history: [],
      connected: false,
      lastPost: HQ.addDays(HQ.TODAY, -3),
      source: 'Fetched',
      av: AV,
      initials: nm.split(' ').map(w => w[0]).slice(0, 2).join(''),
      recent: [0, 1, 2, 3].map(j => ({
        title: 'Recent ' + (row.platform === 'YouTube' ? 'video' : 'reel') + ' ' + (j + 1),
        date: HQ.addDays(HQ.TODAY, -3 - j * 5),
        views: Math.round(mv * (0.6 + Math.random())),
        format: row.platform === 'YouTube' ? 'Long video' : 'Reels',
        er: 4
      })),
      contact: { email: '—', phone: '—', manager: 'Unknown' },
      activity: [{ date: HQ.TODAY, text: `Imported by Anika Rao (${row.via})` }, { date: HQ.TODAY, text: 'Enrichment: ' + status }],
      growth: 1.2,
      snapshots: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((m, k) => ({ m, f: Math.round(followers * (0.9 + k * 0.02)) }))
    };
  };

  const commitImport = () => {
    const todo = state.preview.filter(r => r.kind !== 'Error');
    if (!todo.length) return HQ.toast('Nothing to import', 'error');
    const results = ['Enriched', 'Enriched', 'Partial', 'Enriched', 'Failed', 'Enriched'];
    const js = todo.map((r, i) => ({ ...r, id: i, status: 'Queued', result: r.kind === 'Merge' ? 'Enriched' : results[i % results.length] }));
    setState(prev => ({ ...prev, step: 'enrich', jobs: js }));

    js.forEach((j, i) => {
      setTimeout(() => {
        setState(s => ({ ...s, jobs: s.jobs.map(q => q.id === j.id ? { ...q, status: 'Fetching' } : q) }));
      }, 400 + i * 350);
      setTimeout(() => {
        setState(s => ({ ...s, jobs: s.jobs.map(q => q.id === j.id ? { ...q, status: q.result } : q) }));
      }, 1000 + i * 350);
    });

    setTimeout(() => {
      const added = [];
      HQ.set(z => {
        js.forEach((j, i) => {
          if (j.kind === 'Merge') {
            const c = z.creators.find(q => q.id === j.dupId);
            if (c) {
              c.updated = HQ.TODAY;
              c.activity.unshift({ date: HQ.TODAY, text: 'Merged from import; refreshed (your edits kept)' });
            }
          } else {
            const c = makeCreator(j, i);
            added.push(c.id);
            z.creators.unshift(c);
          }
        });
      });
      setState(prev => ({ ...prev, fresh_ids: added }));
      HQ.toast(`${added.length} added, ${js.filter(j => j.kind === 'Merge').length} merged`);
    }, 1200 + js.length * 350);
  };

  const doneJobs = state.jobs.filter(j => ['Enriched', 'Partial', 'Failed'].includes(j.status)).length;

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
          onClick={() => setState(prev => ({ ...prev, imOpen: true, step: 'input', preview: [], jobs: [], links: '', fileName: '' }))}
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
          <div style={{ fontSize: '24px', fontWeight: 600 }}>{S.creators.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
            {S.creators.filter(c => HQ.isInst(c)).length} institutional · {S.creators.filter(c => ['Alumnus', 'Trainer or mentor', 'Community leader'].includes(c.type)).length} trust anchors · {S.creators.filter(c => ['Micro-influencer', 'Digital creator'].includes(c.type)).length} creators
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
          <div style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Refreshed in 31 days</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: (freshCount / S.creators.length) >= 0.9 ? 'var(--success-600)' : 'var(--warning-600)' }}>
            {Math.round((freshCount / S.creators.length) * 100)}%
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
          <div style={{ fontSize: '24px', fontWeight: 600, color: S.creators.some(c => HQ.isInst(c) && c.consent !== 'Recorded') ? 'var(--warning-600)' : 'var(--ink-900)' }}>
            {S.creators.filter(c => HQ.isInst(c) && c.consent !== 'Recorded').length}
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
        <span style={{ fontSize: '13px', color: 'var(--ink-500)' }}>{list.length} of {S.creators.length}</span>
      </div>

      {/* Creator Table */}
      <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.6fr) 130px 90px 84px 60px 110px minmax(150px,1fr) minmax(170px,1.1fr) 84px 100px 100px 100px', minWidth: '1500px', gap: '12px', padding: '0 20px', height: '40px', alignItems: 'center', background: 'var(--ink-50)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-600)' }}>
          <span>Source</span>
          <span>Type</span>
          <span>Platform</span>
          <span style={{ textAlign: 'right' }}>Followers</span>
          <span style={{ textAlign: 'right' }}>ER</span>
          <span>District</span>
          <span>Skill domains</span>
          <span>Affiliation</span>
          <span style={{ textAlign: 'right' }}>Enrolments</span>
          <span>Consent</span>
          <span>Enrichment</span>
          <span>Updated</span>
        </div>

        {!list.length ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--ink-500)' }}>No sources match these filters.</div>
        ) : (
          list.map(c => {
            const age = HQ.daysBetween(c.updated, HQ.TODAY);
            const g = HQ.gateOf(c);
            const skills = Object.entries(c.topics || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]).join(', ');
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
                  <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: avColors[0], color: avColors[1], display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '12px', flex: 'none' }}>
                    {c.initials || (c.name ? c.name[0] : 'S')}
                  </span>
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
                <span style={{ textAlign: 'right' }}>{c.er ? `${c.er}%` : '—'}</span>
                <span>{c.district}</span>
                <span style={{ fontSize: '12px', color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skills}</span>
                <span style={{ fontSize: '12px', color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.affiliation || '—'}>{c.affiliation || '—'}</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{c.attributed ? String(c.attributed) : '—'}</span>
                <span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: cstTone.bg, color: cstTone.fg, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {c.consent}
                  </span>
                </span>
                <span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '22px', padding: '0 8px', borderRadius: '999px', background: stTone.bg, color: stTone.fg, fontSize: '12px', fontWeight: 600 }}>
                    {c.status}
                  </span>
                </span>
                <span style={{ fontSize: '12px', color: updColor }}>{HQ.ds(c.updated)}{age > 31 ? ` · ${age}d` : ''}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Import Modal */}
      {state.imOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,36,43,.45)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
          <div style={{ width: '760px', maxHeight: '88vh', background: '#fff', borderRadius: '16px', boxShadow: 'var(--e-3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <b style={{ fontSize: '18px', display: 'block' }}>Import sources</b>
                <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                  {state.step === 'input' ? 'Step 1 of 3 · Choose what you have' : state.step === 'preview' ? 'Step 2 of 3 · Check before saving' : 'Step 3 of 3 · Enrichment'}
                </span>
              </div>
              <button onClick={() => setState(prev => ({ ...prev, imOpen: false }))} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-500)' }}>
                <Icon name="i-x" size={20} />
              </button>
            </div>

            <div style={{ overflow: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Step 1: Input */}
              {state.step === 'input' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                    {[
                      ['sheet', 'Full sheet', 'Our template with all columns', 'i-file'],
                      ['links', 'Links only', 'A list of profile links', 'i-link'],
                      ['one', 'One creator', 'Add a single profile', 'i-user']
                    ].map(([k, l, d, ic]) => (
                      <button
                        key={k}
                        onClick={() => setState(prev => ({ ...prev, mode: k }))}
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

                  {state.mode === 'sheet' && (
                    <>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        ref={fileRef}
                        onChange={(e) => {
                          const f = e.target.files[0];
                          if (f) setState(prev => ({ ...prev, fileName: f.name }));
                        }}
                        style={{ display: 'none' }}
                      />
                      <div
                        onClick={() => fileRef.current && fileRef.current.click()}
                        style={{ border: '2px dashed var(--ink-200)', background: 'var(--ink-25)', borderRadius: '12px', padding: '28px', textAlign: 'center', cursor: 'pointer' }}
                      >
                        <span style={{ color: 'var(--teal-700)', display: 'flex', justifyContent: 'center' }}><Icon name="i-upload" size={24} /></span>
                        <b style={{ display: 'block', marginTop: '6px' }}>{state.fileName || 'Choose a sheet'}</b>
                        <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>CSV or XLSX using the template columns</span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            const csv = 'name,profile_link,platform,creator_type,content_language,rate_per_post,contact_email\nExample Creator,https://youtube.com/@example,YouTube,Reviewer,Telugu,25000,example@mail.com\n';
                            const b = new Blob([csv], { type: 'text/csv' });
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(b);
                            a.download = 'hireiq-source-template.csv';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            HQ.toast('Template downloaded');
                          }}
                          style={{ color: 'var(--teal-700)', fontWeight: 600 }}
                        >
                          Download template
                        </a>
                        <span style={{ color: 'var(--ink-300)' }}>·</span>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setState(prev => ({ ...prev, fileName: 'source-roster-oct.xlsx' }));
                          }}
                          style={{ color: 'var(--teal-700)', fontWeight: 600 }}
                        >
                          Use sample roster (6 rows)
                        </a>
                      </div>
                    </>
                  )}

                  {state.mode === 'links' && (
                    <>
                      <textarea
                        value={state.links}
                        onChange={(e) => setState(prev => ({ ...prev, links: e.target.value }))}
                        placeholder="One profile link per line"
                        style={{ minHeight: '160px', padding: '12px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '12px' }}
                      />
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setState(prev => ({ ...prev, links: 'https://youtube.com/@telugutechtalks\nhttps://instagram.com/warangal.coders\nhttps://youtube.com/@techteluguravi\nhttps://linkedin.com/in/priya-ml-alumna\nhttps://x.com/jobsalerts\nplacement updates group' }));
                          }}
                          style={{ color: 'var(--teal-700)', fontWeight: 600 }}
                        >
                          Paste sample links
                        </a>
                        <span style={{ color: 'var(--ink-500)' }}>We fill the rest of the profile from platform APIs.</span>
                      </div>
                    </>
                  )}

                  {state.mode === 'one' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1/-1' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600 }}>Profile link</label>
                        <input
                          value={state.one.link}
                          onChange={(e) => setState(prev => ({ ...prev, one: { ...prev.one, link: e.target.value } }))}
                          placeholder="https://youtube.com/@channel"
                          style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600 }}>Display name <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}>optional</span></label>
                        <input
                          value={state.one.name}
                          onChange={(e) => setState(prev => ({ ...prev, one: { ...prev.one, name: e.target.value } }))}
                          style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600 }}>Source type</label>
                        <select
                          value={state.one.type}
                          onChange={(e) => setState(prev => ({ ...prev, one: { ...prev.one, type: e.target.value } }))}
                          style={{ height: '40px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}
                        >
                          <option>Micro-influencer</option>
                          <option>College network</option>
                          <option>Placement cell</option>
                          <option>Alumnus</option>
                          <option>Trainer or mentor</option>
                          <option>Community leader</option>
                          <option>Digital creator</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {state.parsing && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--teal-800)', fontSize: '13px' }}>
                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--teal-100)', borderTopColor: 'var(--teal-600)', animation: 'spin .8s linear infinite' }}></span>
                      Parsing, validating and checking for duplicates…
                    </div>
                  )}
                </>
              )}

              {/* Step 2: Preview */}
              {state.step === 'preview' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                    {[
                      ['New', 'New', 'Pass'],
                      ['Already in bank (merge)', 'Merge', 'Neutral'],
                      ['Errors', 'Error', 'Fail']
                    ].map(([l, k, tone]) => (
                      <div key={k} style={{ padding: '12px 14px', borderRadius: '10px', background: HQ.tone(tone).bg, color: HQ.tone(tone).fg }}>
                        <div style={{ fontSize: '22px', fontWeight: 700 }}>{state.preview.filter(r => r.kind === k).length}</div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{l}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ border: '1px solid var(--ink-100)', borderRadius: '10px', overflow: 'hidden' }}>
                    {state.preview.map((r, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr) 100px minmax(0,1fr)', gap: '10px', padding: '10px 14px', borderTop: '1px solid var(--ink-100)', fontSize: '13px', alignItems: 'center' }}>
                        <span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: HQ.tone(r.kind === 'New' ? 'Pass' : r.kind === 'Merge' ? 'Neutral' : 'Fail').bg, color: HQ.tone(r.kind === 'New' ? 'Pass' : r.kind === 'Merge' ? 'Neutral' : 'Fail').fg, fontSize: '12px', fontWeight: 600 }}>
                            {r.kind}
                          </span>
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '12px' }}>{r.src}</span>
                        <span>{r.platform}</span>
                        <span style={{ color: 'var(--ink-600)' }}>{r.note}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Nothing is saved until you commit. Duplicates are merged by platform ID; your edits are never overwritten.</div>
                </>
              )}

              {/* Step 3: Enrichment */}
              {state.step === 'enrich' && (
                <>
                  <div style={{ height: '6px', borderRadius: '999px', background: 'var(--ink-100)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${state.jobs.length ? (doneJobs / state.jobs.length) * 100 : 0}%`, background: 'var(--teal-600)', transition: 'width .3s' }}></div>
                  </div>
                  {state.jobs.map((j) => {
                    const t = HQ.tone(j.status);
                    const isFailed = j.status === 'Failed';
                    const isPartial = j.status === 'Partial';
                    const isQueued = j.status === 'Queued';
                    const isFetching = j.status === 'Fetching';
                    const iconName = isFailed ? 'i-x' : isPartial ? 'i-alert' : isQueued ? 'i-clock' : 'i-check';

                    return (
                      <div key={j.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--ink-100)', borderRadius: '10px' }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--ink-50)', display: 'grid', placeItems: 'center' }}>
                          {isFetching ? (
                            <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--teal-100)', borderTopColor: 'var(--teal-600)', animation: 'spin .8s linear infinite' }}></span>
                          ) : (
                            <span style={{ color: t.fg, display: 'flex' }}><Icon name={iconName} size={14} /></span>
                          )}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ fontWeight: 600 }}>{j.name || j.handle}</b> <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{j.platform}</span>
                          <div style={{ fontSize: '12px', color: 'var(--ink-600)' }}>
                            {isQueued ? 'Waiting for API quota slot' : isFetching ? 'Fetching profile and last 25 posts; detecting language; tagging content' : isPartial ? 'Audience geography unavailable (owner-only)' : isFailed ? 'Private or personal account: Business Discovery cannot read it. Retry after the creator connects.' : (j.kind === 'Merge' ? 'Merged and refreshed' : 'Profile created with source and date on every field')}
                          </div>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: t.bg, color: t.fg, fontSize: '12px', fontWeight: 600 }}>
                          {j.status}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--ink-100)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              {state.step === 'preview' && (
                <button
                  onClick={() => setState(prev => ({ ...prev, step: 'input' }))}
                  style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Back
                </button>
              )}
              <button
                onClick={() => {
                  if (state.step === 'input') parseImport();
                  else if (state.step === 'preview') commitImport();
                  else if (doneJobs === state.jobs.length) setState(prev => ({ ...prev, imOpen: false }));
                }}
                disabled={state.step === 'enrich' && doneJobs < state.jobs.length}
                style={{
                  height: '40px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: 0,
                  background: state.step === 'enrich' && doneJobs < state.jobs.length ? 'var(--ink-100)' : 'var(--teal-700)',
                  color: state.step === 'enrich' && doneJobs < state.jobs.length ? 'var(--ink-400)' : '#fff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {state.step === 'input' ? 'Check import' : state.step === 'preview' ? `Commit ${state.preview.filter(r => r.kind !== 'Error').length} creators` : doneJobs === state.jobs.length ? 'Done' : 'Enriching…'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
