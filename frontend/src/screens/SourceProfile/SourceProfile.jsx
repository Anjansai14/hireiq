import React, { useState, useRef } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

export default function SourceProfile() {
  const { HQ, s } = useHQ();
  const r = s.route || {};
  const cr = HQ.creator(r.id);

  const [state, setState] = useState({
    refreshing: false,
    addOpen: false,
    editing: null,
    draft: '',
    revealed: false,
    pd: null,
    cm: null,
    cmErr: '',
    cPlat: null
  });

  if (!cr) {
    return (
      <div style={{ padding: '24px 32px 48px', maxWidth: '1240px' }}>
        <button
          onClick={() => HQ.go('creators')}
          style={{ border: 0, background: 'none', padding: 0, color: 'var(--ink-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', marginBottom: '16px' }}
        >
          <Icon name="i-left" size={16} /> Creator Bank
        </button>
        <div style={{ color: 'var(--ink-500)', fontSize: '14px' }}>Creator not found.</div>
      </div>
    );
  }

  const tab = ['content', 'history', 'commercials', 'activity'].includes(r.tab) ? r.tab : 'overview';
  const age = HQ.daysBetween(cr.updated, HQ.TODAY);
  const rk = HQ.rank({ objective: 'Awareness' });
  const gate = rk.blocked.find(b => b.c.id === cr.id);
  const edits = cr.edits || {};

  const updC = (patch, text) => {
    HQ.set(z => {
      const c = z.creators.find(q => q.id === cr.id);
      if (c) {
        Object.assign(c, patch);
        if (text) c.activity.unshift({ date: HQ.TODAY, text });
      }
    });
  };

  const handleRefresh = () => {
    if (state.refreshing) return;
    setState(prev => ({ ...prev, refreshing: true }));
    setTimeout(() => {
      updC({ updated: HQ.TODAY, next: HQ.addDays(HQ.TODAY, 31) }, 'Manual refresh: profile re-fetched from ' + cr.platform);
      setState(prev => ({ ...prev, refreshing: false }));
      HQ.toast(`${cr.name} refreshed`);
    }, 1200);
  };

  // Field editing
  const saveField = (k) => {
    const val = state.draft.trim();
    const ed = Object.assign({}, edits, { [k]: HQ.TODAY });
    const patch = { edits: ed };
    if (k === 'type') patch.type = val;
    if (k === 'tone') patch.tone = val;
    if (k === 'name') {
      patch.name = val;
      patch.initials = val.split(' ').map(w => w[0]).slice(0, 2).join('');
    }
    updC(patch, `Field "${k}" edited by Anika Rao (protected from refresh)`);
    setState(prev => ({ ...prev, editing: null }));
    HQ.toast('Saved. Refreshes will not overwrite this edit.');
  };

  // Live Campaigns for "Add to campaign"
  const liveCamps = HQ.s.campaigns.filter(c => c.status === 'Live' && !c.ccs.some(x => x.creatorId === cr.id));
  const blockedMsg = gate ? `${gate.rule}: ${gate.reason}` : '';

  // Accounts
  const rng = (seed) => {
    let x = 0;
    for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
    return () => {
      x = (x * 1664525 + 1013904223) >>> 0;
      return x / 4294967296;
    };
  };

  const ar = rng('acc' + cr.id);
  const base = (cr.handle || '').replace(/^@|fb\.com\//, '');
  const PL = [['Instagram', 'instagram.com/', 1], ['YouTube', 'youtube.com/@', 1.35], ['Facebook', 'facebook.com/', 0.7], ['X', 'x.com/', 0.25]];
  const accounts = PL.map(([p, dom, mult]) => {
    const prim = p === cr.platform;
    const f = prim ? cr.followers : Math.round(cr.followers * mult * (0.4 + ar() * 0.8));
    const mv = prim ? cr.mv : Math.round(f * (p === 'X' ? 0.04 : 0.12 + ar() * 0.2));
    const er = prim ? cr.er : +(p === 'X' ? 0.8 + ar() * 1.5 : 1.5 + ar() * 5).toFixed(1);
    const ver = prim ? cr.verif === 'Verified' : ar() > 0.55;
    return {
      platform: p,
      primary: prim,
      name: cr.name + (p === 'YouTube' && !prim ? ' Official' : ''),
      handle: '@' + base.replace(/^@/, ''),
      followers: HQ.n(f),
      mv: HQ.n(mv),
      er: er + '%',
      verified: ver,
      verif: ver ? 'Verified' : 'Not verified',
      vc: ver ? 'var(--teal-800)' : 'var(--ink-500)',
      updated: HQ.ds(prim ? cr.updated : HQ.addDays(cr.updated, -Math.floor(ar() * 20))),
      url: 'https://' + dom + base.replace(/^@/, ''),
      fRaw: f,
      mvRaw: mv,
      erRaw: er,
      updRaw: prim ? cr.updated : HQ.addDays(cr.updated, -Math.floor(ar() * 20))
    };
  });

  const totalF = accounts.reduce((a, x) => a + x.fRaw, 0);

  // Profile Fields List
  const fieldsRaw = [
    ['name', 'Display name', cr.name, 'Uploaded', true],
    ['handle', 'Handle', cr.handle, 'Fetched', false],
    ['followers', 'Followers', HQ.n(cr.followers), 'Fetched', false],
    ['mv', 'Median views (10 posts)', HQ.n(cr.mv), 'Fetched', false],
    ['er', 'Engagement rate', cr.er + '%', 'Fetched', false],
    ['type', 'Source type', cr.type, 'AI-inferred', true],
    ['tone', 'Tone', cr.tone, 'AI-inferred', true],
    ['lang', 'Primary language', Object.keys(cr.langs || {})[0] || 'Telugu', 'AI-inferred', false],
    ['collab', 'Collaboration', HQ.paidOf(cr), 'Assigned', true, ['Paid', 'Unpaid']],
    ['account', 'Account type', HQ.accOf(cr), 'Assigned', true, ['Internal', 'External']],
    ['acct', 'Platform account', cr.acct, 'Fetched', false],
    ['verif', 'Verification', cr.verif, 'Fetched', false]
  ];

  // Contact details
  const masked = [
    { l: 'Email', v: '••••••••••' },
    { l: 'Phone', v: '••••••••••' },
    { l: 'Manager', v: '••••••••••' }
  ];
  const contact = [
    { l: 'Email', v: cr.contact?.email || 'ravi.telugutech@gmail.com' },
    { l: 'Phone', v: cr.contact?.phone || '+91 98480 22334' },
    { l: 'Manager', v: cr.contact?.manager || 'Self-managed' }
  ];

  // Language & Topics
  const langs = Object.entries(cr.langs || {}).map(([l, v]) => ({ l, v }));
  const topics = Object.entries(cr.topics || {}).map(([l, v]) => ({
    l,
    v: Math.round(v * 100) + '%',
    c: v >= 0.4 ? 'var(--teal-600)' : 'var(--ink-300)'
  }));

  // Posts generator for campaigns
  const postsFor = (h, idx) => {
    const rRng = rng(cr.id + h.campaign + h.date);
    const liveC = !/Backed out|Declined|Cancel/i.test(h.status);
    const n = liveC ? 1 + Math.floor(rRng() * 3) : 0;
    const total = h.views || Math.round(cr.mv * (0.8 + rRng() * 1.4) * Math.max(1, n));
    const fmts = cr.platform === 'YouTube' ? ['Video', 'Short'] : cr.platform === 'Instagram' ? ['Reel', 'Carousel', 'Story'] : ['Video', 'Post'];
    const tag = '#' + h.film.replace(/\s+/g, '') + cr.handle.replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
    const dom = cr.platform === 'YouTube' ? 'youtube.com/watch?v=' : cr.platform === 'Instagram' ? 'instagram.com/reel/' : 'facebook.com/watch/?v=';
    const posts = [];
    let left = total;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.round(total * (0.3 + rRng() * 0.3));
      left -= v;
      const pos = 45 + Math.floor(rRng() * 40);
      const neg = Math.floor(rRng() * 12);
      const neu = 100 - pos - neg;
      posts.push({
        title: [h.campaign + ': registrations open', 'Eligibility explained', 'Alumni story', 'Syllabus walkthrough', 'Screening reminder'][(idx + i) % 5],
        platform: cr.platform,
        format: fmts[i % fmts.length],
        date: HQ.addDays(h.date, i * 2),
        url: 'https://' + dom + Math.floor(rRng() * 1e10).toString(36),
        tag,
        views: Math.max(0, v),
        likes: Math.round(v * (0.03 + rRng() * 0.04)),
        comments: Math.round(v * (0.002 + rRng() * 0.004)),
        shares: Math.round(v * (0.001 + rRng() * 0.003)),
        pos,
        neu,
        neg
      });
    }
    return posts;
  };

  const hist = (cr.history || []).slice().reverse();
  const histP = hist.map((h, i) => ({ h, posts: postsFor(h, i) }));

  const agg = (ps) => {
    const v = ps.reduce((a, p) => a + p.views, 0) || 1;
    const w = (k) => Math.round(ps.reduce((a, p) => a + p[k] * p.views, 0) / v);
    const pos = w('pos');
    const neg = w('neg');
    return { pos, neg, neu: Math.max(0, 100 - pos - neg) };
  };

  const selDrawer = state.pd != null ? histP[state.pd] : null;

  // Commercials
  const commsAll = cr.commercials || histP.filter(x => x.h.fee).map((x, i) => {
    const n = x.posts.length || 1;
    return {
      id: 'cm' + i,
      film: x.h.film,
      campaign: x.h.campaign,
      dealType: 'Paid',
      posts: n,
      fee: Math.round(x.h.fee / n),
      payment: '50% advance, 50% on posting',
      deliverables: n + ' ' + (cr.platform === 'Instagram' ? 'reels' : 'posts'),
      notes: '',
      updated: x.h.date
    };
  });

  const filmsList = [...new Set(HQ.s.films.map(f => f.title).concat(commsAll.map(c => c.film)))];
  const dCommercial = state.cm;

  // Recent Content by Platform
  const FM = { Instagram: ['Reel', 'Carousel', 'Reel', 'Story'], YouTube: ['Long video', 'Short', 'Long video', 'Short'], Facebook: ['Video', 'Reel', 'Live'], X: ['Clip', 'Thread', 'Clip'] };
  const TT = ['Placement story from last batch', 'Is this programme free? Explained', 'Day in the life of a trainee', 'Eligibility in 60 seconds', 'Salary after training: real numbers', 'How to register, step by step', 'Q&A with trainers', 'Campus visit highlights'];
  const pr = rng('posts' + cr.id);
  const platPosts = {};
  accounts.forEach((a, ai) => {
    const list = a.primary
      ? (cr.recent || []).map(p => ({ title: p.title, format: p.format, dateRaw: p.date, v: p.views != null ? p.views : (p.clicks || 0), er: p.er || 0 }))
      : Array.from({ length: 6 }, (_, i) => ({
          title: TT[(i + ai * 3) % TT.length],
          format: FM[a.platform][i % FM[a.platform].length],
          dateRaw: HQ.addDays(a.updRaw, -(i * 4 + Math.floor(pr() * 3))),
          v: Math.round(a.mvRaw * (0.45 + pr() * 1.2)),
          er: +(a.erRaw * (0.7 + pr() * 0.6)).toFixed(1)
        }));
    platPosts[a.platform] = list.map(p => ({ ...p, platform: a.platform, mv: a.mvRaw || 1 }));
  });

  const cp = accounts.some(a => a.platform === state.cPlat) ? state.cPlat : (accounts.find(a => a.primary) || accounts[0]).platform;
  const shownP = platPosts[cp] || [];
  const sv = shownP.map(p => p.v);
  const smax = Math.max(1, ...sv);
  const avColors = cr.av || ['#e0e7ff', '#3730a3'];

  return (
    <div style={{ padding: '24px 32px 48px', maxWidth: '1240px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Back button */}
      <button
        onClick={() => HQ.go('creators')}
        style={{ border: 0, background: 'none', padding: 0, color: 'var(--ink-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', alignSelf: 'flex-start' }}
      >
        <Icon name="i-left" size={16} /> Creator Bank
      </button>

      {/* Header */}
      <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ width: '72px', height: '72px', borderRadius: '50%', background: avColors[0], color: avColors[1], display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '24px', flex: 'none' }}>
          {cr.initials || (cr.name ? cr.name[0] : 'S')}
        </span>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', lineHeight: '34px', fontWeight: 600, letterSpacing: '-.015em', overflowWrap: 'anywhere' }}>{cr.name}</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
            {cr.verif === 'Verified' && (
              <span title="Verified" style={{ color: 'var(--teal-700)', display: 'flex' }}>
                <Icon name="i-shield" size={20} />
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '24px', padding: '0 10px', borderRadius: '999px', background: HQ.tone(cr.status).bg, color: HQ.tone(cr.status).fg, fontSize: '12px', fontWeight: 600 }}>
              {cr.status}
            </span>
          </div>
          <div style={{ color: 'var(--ink-600)', marginTop: '4px' }}>
            {cr.handle} · {cr.platform} · {cr.type} · {cr.tier}
          </div>
          <div style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--ink-500)', marginTop: '4px' }}>
            <span style={{ display: 'inline-flex', verticalAlign: '-2px', marginRight: '6px' }}>
              <Icon name="i-clock" size={12} />
            </span>
            Last updated {HQ.ds(cr.updated)} · next refresh {HQ.d(cr.next)} · source {cr.source}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', position: 'relative' }}>
          <button
            onClick={handleRefresh}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 14px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            <Icon name="i-refresh" size={16} style={{ animation: state.refreshing ? 'spin .8s linear infinite' : 'none' }} />
            {state.refreshing ? 'Refreshing…' : 'Refresh now'}
          </button>

          <button
            onClick={() => setState(prev => ({ ...prev, addOpen: !prev.addOpen }))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 14px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            <Icon name="i-plus" size={16} /> Add to campaign
          </button>

          {state.addOpen && (
            <>
              <div onClick={() => setState(prev => ({ ...prev, addOpen: false }))} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', right: 0, top: '46px', zIndex: 41, width: '300px', background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-2)', padding: '6px' }}>
                <div style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: 'var(--ink-500)' }}>Live campaigns</div>
                {blockedMsg && <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--danger-600)' }}>{blockedMsg}</div>}
                {liveCamps.map(k => (
                  <button
                    key={k.id}
                    onClick={() => {
                      if (blockedMsg) return HQ.toast(blockedMsg, 'error');
                      HQ.set(z => {
                        const targetCamp = z.campaigns.find(q => q.id === k.id);
                        targetCamp.ccs.push({
                          id: HQ.uid('cc'),
                          campId: k.id,
                          creatorId: cr.id,
                          narrative: (targetCamp.narratives[0] || {}).id,
                          channel: cr.platform,
                          status: 'Identified',
                          deal: { rate: cr.rate, posts: 1, type: 'Paid', del: '1 post', start: HQ.TODAY, end: HQ.addDays(HQ.TODAY, 7), terms: '' },
                          posts: [],
                          content: [],
                          log: [{ date: HQ.TODAY, text: `Added to campaign ${targetCamp.name}` }],
                          predViews: [Math.round(cr.mv * 0.62), Math.round(cr.mv * 1.45)]
                        });
                      });
                      setState(prev => ({ ...prev, addOpen: false }));
                      HQ.toast(`Added ${cr.name} to ${k.name}`);
                    }}
                    style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '8px 10px', border: 0, borderRadius: '8px', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <b style={{ fontWeight: 600 }}>{k.name}</b>
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{k.objective} · {k.ccs.length} sources</span>
                  </button>
                ))}
                {!liveCamps.length && (
                  <div style={{ padding: '8px 10px', fontSize: '13px', color: 'var(--ink-500)' }}>No live campaigns to add to.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {[
          { l: 'Followers', v: cr.catchment ? HQ.n(cr.catchment) : HQ.n(cr.followers), stamp: cr.catchment ? 'UPLOADED' : 'OBSERVED', sc: 'var(--success-800)', tip: 'Followers' },
          { l: 'Past enrolments', v: String(cr.attributed || 0), stamp: 'OBSERVED', sc: 'var(--success-800)', tip: 'Past batch enrolments' },
          { l: 'Engagement rate', v: cr.er ? `${cr.er}%` : '—', stamp: 'OBSERVED', sc: 'var(--success-800)', tip: 'Observed engagement' },
          { l: 'Monthly growth', v: `+${cr.growth || 2.5}%`, stamp: 'COMPUTED', sc: 'var(--info-800)', tip: 'Estimated growth' },
          { l: 'Rate per post', v: cr.rate ? HQ.inr(cr.rate) : '₹0', stamp: cr.rateSrc === 'Observed' ? 'OBSERVED' : 'ILLUSTRATIVE', sc: 'var(--success-800)', tip: 'Rate per post' }
        ].map(k => (
          <div key={k.l} style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--e-1)' }} title={k.tip}>
            <div>
              <div style={{ fontSize: '10px', lineHeight: '14px', fontWeight: 600, color: k.sc, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.stamp}</div>
              <div style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--ink-600)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.l}</div>
            </div>
            <div style={{ fontSize: '22px', lineHeight: '28px', fontWeight: 600, marginTop: '4px' }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--ink-100)', overflowX: 'auto', overflowY: 'hidden' }}>
        {[
          ['overview', 'Overview'],
          ['content', 'Content'],
          ['history', `Campaign history (${hist.length})`],
          ['commercials', 'Commercials'],
          ['activity', 'Activity']
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => HQ.go('creator', { id: cr.id, tab: k })}
            style={{
              border: 0,
              background: 'none',
              padding: '10px 0',
              marginBottom: '-1px',
              borderBottom: tab === k ? '2px solid var(--teal-600)' : '2px solid transparent',
              color: tab === k ? 'var(--teal-800)' : 'var(--ink-600)',
              fontWeight: tab === k ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              gap: '6px',
              alignItems: 'center'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '20px', alignItems: 'start', animation: 'fadein .2s' }}>
          {/* Accounts across platforms */}
          <div style={{ gridColumn: '1 / -1', background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflowX: 'auto' }}>
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <b>Accounts across platforms</b>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{accounts.length} accounts · {HQ.n(totalF)} combined followers</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(180px, 1.4fr) 100px 100px 70px 110px 110px 90px', minWidth: '900px', gap: '12px', padding: '0 20px', height: '36px', alignItems: 'center', background: 'var(--ink-50)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-600)' }}>
              <span>Platform</span>
              <span>Display name · handle</span>
              <span style={{ textAlign: 'right' }}>Followers</span>
              <span style={{ textAlign: 'right' }}>Median views</span>
              <span style={{ textAlign: 'right' }}>ER</span>
              <span>Verification</span>
              <span>Updated</span>
              <span></span>
            </div>
            {accounts.map(a => (
              <div key={a.platform} style={{ display: 'grid', gridTemplateColumns: '110px minmax(180px, 1.4fr) 100px 100px 70px 110px 110px 90px', minWidth: '900px', gap: '12px', padding: '0 20px', height: '52px', alignItems: 'center', borderTop: '1px solid var(--ink-100)', fontSize: '13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  {a.platform}
                  {a.primary && (
                    <span style={{ height: '18px', padding: '0 6px', borderRadius: '4px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                      PRIMARY
                    </span>
                  )}
                </span>
                <span style={{ minWidth: 0 }}>
                  <b style={{ fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</b>
                  <span style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{a.handle}</span>
                </span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{a.followers}</span>
                <span style={{ textAlign: 'right' }}>{a.mv}</span>
                <span style={{ textAlign: 'right' }}>{a.er}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: a.vc }}>
                  {a.verified && <Icon name="i-shield" size={14} />} {a.verif}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{a.updated}</span>
                <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--teal-700)', fontWeight: 600, fontSize: '12px' }}>
                  Open <Icon name="i-ext" size={12} />
                </a>
              </div>
            ))}
          </div>

          {/* Profile fields list */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between' }}>
              <b>Profile fields</b>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Every field keeps its source and date</span>
            </div>
            {fieldsRaw.map(([k, l, val, src, editable, opts]) => {
              const editing = state.editing === k;
              const s2 = edits[k] ? 'Edited' : src;
              const tone = HQ.tone(s2 === 'Fetched' ? 'Observed' : s2 === 'AI-inferred' ? 'Inferred' : s2 === 'Edited' ? 'Edited' : 'Neutral');

              return (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 150px) minmax(110px, 1fr) minmax(0, auto) 32px', gap: '12px', padding: '10px 20px', borderTop: '1px solid var(--ink-100)', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: 'var(--ink-500)' }}>{l}</span>
                  {editing && opts ? (
                    <select
                      value={state.draft}
                      onChange={(e) => {
                        const patch = { edits: { ...edits, [k]: HQ.TODAY } };
                        patch[k === 'collab' ? 'paid' : 'account'] = e.target.value;
                        updC(patch, `${l} set to ${e.target.value} by Anika Rao`);
                        setState(prev => ({ ...prev, editing: null }));
                        HQ.toast(`${l}: ${e.target.value}`);
                      }}
                      style={{ height: '32px', padding: '0 6px', border: '1px solid var(--ink-300)', borderRadius: '6px', background: '#fff', width: '100%' }}
                    >
                      {opts.map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : editing && !opts ? (
                    <input
                      value={state.draft}
                      onChange={(e) => setState(prev => ({ ...prev, draft: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveField(k);
                        if (e.key === 'Escape') setState(prev => ({ ...prev, editing: null }));
                      }}
                      style={{ height: '32px', padding: '0 8px', border: '1px solid var(--ink-300)', borderRadius: '6px' }}
                    />
                  ) : (
                    <span style={{ fontWeight: 500 }}>{val}</span>
                  )}

                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 6px', alignItems: 'center', minWidth: 0 }}>
                    <span style={{ display: 'inline-flex', height: '20px', padding: '0 6px', borderRadius: '4px', background: tone.bg, color: tone.fg, fontSize: '11px', fontWeight: 600, alignItems: 'center' }}>
                      {s2}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>{HQ.ds(edits[k] || cr.updated)}</span>
                  </span>

                  {editable && (
                    <button
                      onClick={() => {
                        if (editing) saveField(k);
                        else setState(prev => ({ ...prev, editing: k, draft: String(val) }));
                      }}
                      aria-label="Edit"
                      style={{ width: '28px', height: '28px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--ink-500)', display: 'grid', placeItems: 'center' }}
                    >
                      <Icon name={editing ? 'i-check' : 'i-edit'} size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right column: Contact, Language, Topics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: 'var(--ink-600)', display: 'flex' }}><Icon name="i-lock" size={16} /></span>
                <b style={{ flex: 1 }}>Contact details</b>
                <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>Every reveal is logged</span>
              </div>
              {!state.revealed ? (
                <>
                  {masked.map(m => (
                    <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'var(--ink-50)', fontSize: '13px' }}>
                      <span style={{ color: 'var(--ink-500)' }}>{m.l}</span>
                      <span style={{ letterSpacing: '2px' }}>{m.v}</span>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setState(prev => ({ ...prev, revealed: true }));
                      updC({}, 'Contact details revealed by Anika Rao');
                      HQ.toast('Contact details revealed');
                    }}
                    style={{ height: '36px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="i-eye" size={16} /> Reveal (Manager role)
                  </button>
                </>
              ) : (
                <>
                  {contact.map(m => (
                    <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'var(--ink-25)', border: '1px solid var(--ink-100)', fontSize: '13px' }}>
                      <span style={{ color: 'var(--ink-500)' }}>{m.l}</span>
                      <b style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.v}</b>
                    </div>
                  ))}
                  <button
                    onClick={() => setState(prev => ({ ...prev, revealed: false }))}
                    style={{ height: '36px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Hide
                  </button>
                </>
              )}
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Never included in exports or sent to AI agents.</span>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--e-1)' }}>
              <b style={{ display: 'block', marginBottom: '10px' }}>Content language</b>
              {langs.map(m => (
                <div key={m.l} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '4px 0' }}>
                  <span style={{ width: '80px', color: 'var(--ink-600)' }}>{m.l}</span>
                  <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'var(--ink-50)' }}>
                    <div style={{ height: '100%', width: `${m.v}%`, background: 'var(--screen)', borderRadius: '999px' }} />
                  </div>
                  <span style={{ width: '34px', textAlign: 'right' }}>{m.v}%</span>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--e-1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <b>Topic authority</b>
                <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>HAS_AUTHORITY_IN edges</span>
              </div>
              {topics.map(m => (
                <div key={m.l} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '4px 0' }}>
                  <span style={{ width: '110px', color: 'var(--ink-600)' }}>{m.l}</span>
                  <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'var(--ink-50)' }}>
                    <div style={{ height: '100%', width: m.v, background: m.c, borderRadius: '999px' }} />
                  </div>
                  <span style={{ width: '34px', textAlign: 'right' }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Content */}
      {tab === 'content' && (
        <>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {accounts.map(pt => (
              <button
                key={pt.platform}
                onClick={() => setState(prev => ({ ...prev, cPlat: pt.platform }))}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: `1px solid ${cp === pt.platform ? 'var(--teal-600)' : 'var(--ink-200)'}`,
                  background: cp === pt.platform ? 'var(--teal-50)' : '#fff',
                  color: cp === pt.platform ? 'var(--teal-800)' : 'var(--ink-700)',
                  fontWeight: cp === pt.platform ? 600 : 400,
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                {pt.platform}
                <span style={{ fontSize: '11px', color: 'var(--ink-500)', fontWeight: 600 }}>{platPosts[pt.platform]?.length || 0}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '20px', alignItems: 'start', animation: 'fadein .2s' }}>
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflowX: 'auto' }}>
              <div style={{ padding: '14px 20px' }}>
                <b>Recent posts</b> <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Last 6 posts on {cp}</span>
              </div>
              {shownP.map((p, i) => {
                const diff = Math.round((p.v / (p.mv || 1) - 1) * 100);
                const dLabel = `${diff >= 0 ? '+' : ''}${diff}% vs median`;
                const dc = diff >= 0 ? 'var(--success-800)' : 'var(--warning-800)';

                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px minmax(140px,1fr) 70px 50px 110px', minWidth: '480px', gap: '12px', padding: '10px 20px', borderTop: '1px solid var(--ink-100)', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ width: '56px', height: '36px', borderRadius: '6px', background: 'var(--ink-900)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                      <Icon name="i-play" size={14} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</b>
                      <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{p.platform} · {p.format} · {HQ.ds(p.dateRaw)}</span>
                    </span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{HQ.n(p.v)}</span>
                    <span style={{ textAlign: 'right', color: 'var(--ink-600)' }}>{p.er}%</span>
                    <span style={{ textAlign: 'right', fontSize: '12px', fontWeight: 600, color: dc }}>{dLabel}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
                <b style={{ display: 'block', marginBottom: '14px' }}>Median views per post on {cp}</b>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '160px' }}>
                  {shownP.map((p, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '11px', color: 'var(--ink-600)' }}>{HQ.n(p.v)}</span>
                      <div style={{ width: '100%', height: `${(p.v / smax) * 100}%`, background: 'var(--teal-600)', borderRadius: '6px 6px 0 0' }} />
                      <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>P{i + 1}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '8px' }}>
                  Median {HQ.n(selAcc?.mvRaw || cr.mv)} views per post.
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--e-1)' }}>
                <b style={{ display: 'block', marginBottom: '10px' }}>Content types <span style={{ fontSize: '11px', color: 'var(--info-800)', fontWeight: 600 }}>AI-inferred</span></b>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(cr.content || ['Career content', 'Tech explainers']).map(t => (
                    <span key={t} style={{ display: 'inline-flex', height: '28px', padding: '0 10px', borderRadius: '8px', background: 'var(--ink-50)', border: '1px solid var(--ink-100)', fontSize: '13px', alignItems: 'center' }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--e-1)' }}>
                <b style={{ display: 'block', marginBottom: '10px' }}>Formats and tone</b>
                <div style={{ fontSize: '13px', display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px' }}>
                  <span style={{ color: 'var(--ink-500)' }}>Formats</span>
                  <span>{(cr.formats || []).join(', ')}</span>
                  <span style={{ color: 'var(--ink-500)' }}>Tone</span>
                  <span>{cr.tone}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB: Campaign History */}
      {tab === 'history' && (
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflowX: 'auto', animation: 'fadein .2s' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) minmax(160px,1.2fr) 90px 110px 70px 100px 90px 130px 20px', minWidth: '1010px', gap: '12px', padding: '0 20px', height: '40px', alignItems: 'center', background: 'var(--ink-50)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-600)' }}>
            <span>Course</span>
            <span>Campaign</span>
            <span>Date</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Posts</span>
            <span style={{ textAlign: 'right' }}>Fee</span>
            <span style={{ textAlign: 'right' }}>Views</span>
            <span>Sentiment</span>
            <span></span>
          </div>

          {!hist.length ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--ink-500)' }}>No campaigns with this team yet.</div>
          ) : (
            hist.map((h, i) => {
              const ps = postsFor(h, i);
              const a = agg(ps);
              const sentInfo = a.pos >= 65 ? ['Positive', 'var(--success-600)'] : a.neg >= 10 ? ['Mixed', 'var(--warning-600)'] : ['Mostly positive', 'var(--success-600)'];

              return (
                <div
                  key={i}
                  onClick={() => setState(prev => ({ ...prev, pd: i }))}
                  style={{ borderTop: '1px solid var(--ink-100)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) minmax(160px,1.2fr) 90px 110px 70px 100px 90px 130px 20px', minWidth: '1010px', gap: '12px', padding: '0 20px', height: '52px', alignItems: 'center', fontSize: '13px' }}>
                    <b style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.film}</b>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.campaign}</span>
                    <span>{HQ.ds(h.date)}</span>
                    <span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: HQ.tone(h.status).bg, color: HQ.tone(h.status).fg, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {h.status}
                      </span>
                    </span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{ps.length}</span>
                    <span style={{ textAlign: 'right' }}>{h.fee ? HQ.inr(h.fee) : '₹0'}</span>
                    <span style={{ textAlign: 'right' }}>{HQ.n(h.views || 0)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sentInfo[1], flex: 'none' }} />
                      {sentInfo[0]}
                    </span>
                    <Icon name="i-arrow" size={16} style={{ color: 'var(--ink-400)' }} />
                  </div>
                  {h.note && (
                    <div style={{ padding: '0 20px 10px', fontSize: '12px', color: 'var(--danger-800)' }}>Reason: {h.note}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB: Commercials */}
      {tab === 'commercials' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px', alignItems: 'start', animation: 'fadein .2s' }}>
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <b>Current rate</b>
            <div style={{ fontSize: '28px', fontWeight: 600 }}>
              {HQ.inr(cr.rate)} <span style={{ fontSize: '14px', color: 'var(--ink-500)', fontWeight: 400 }}>per post</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', height: '22px', padding: '0 8px', borderRadius: '999px', background: HQ.tone(cr.rateSrc === 'Observed' ? 'Observed' : 'Neutral').bg, color: HQ.tone(cr.rateSrc === 'Observed' ? 'Observed' : 'Neutral').fg, fontSize: '12px', fontWeight: 600, alignItems: 'center' }}>
                {cr.rateSrc}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                {cr.rateSrc === 'Observed' ? 'Based on actual closed deals' : 'Estimated from market band'}
              </span>
            </div>
            <div style={{ paddingTop: '10px', borderTop: '1px solid var(--ink-100)', fontSize: '13px' }}>
              Rate card {cr.tier}: <b>{HQ.inr(tiersB.lo || 10000)} – {HQ.inr(tiersB.hi || 25000)}</b>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ flex: 1 }}>Commercials</b>
              <button
                onClick={() => setState(prev => ({ ...prev, cm: { film: HQ.s.films[0]?.title || '', campaign: 'New campaign', dealType: 'Paid', posts: '1', fee: String(cr.rate), payment: '50% advance, 50% on posting', deliverables: '1 post', notes: '' }, cmErr: '' }))}
                style={{ height: '36px', padding: '0 14px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}
              >
                <Icon name="i-plus" size={14} /> Add commercial
              </button>
            </div>

            {!commsAll.length ? (
              <div style={{ padding: '24px 20px', borderTop: '1px solid var(--ink-100)', fontSize: '13px', color: 'var(--ink-500)' }}>
                No commercials yet. Add the first deal agreed with this source.
              </div>
            ) : (
              commsAll.map((o, idx) => (
                <div key={o.id || idx} style={{ display: 'flex', gap: '8px 16px', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--ink-100)', fontSize: '13px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <b style={{ fontWeight: 600, display: 'block' }}>{o.film} · {o.campaign}</b>
                    <span style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{o.dealType} · {o.posts} post{o.posts == 1 ? '' : 's'} · {o.deliverables}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-500)', marginTop: '2px' }}>Updated {HQ.ds(o.updated)}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <b style={{ display: 'block' }}>{HQ.inr(o.fee * o.posts)}</b>
                    <span style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{HQ.inr(o.fee)}/post</span>
                  </div>
                  <button
                    onClick={() => setState(prev => ({ ...prev, cm: { ...o }, cmErr: '' }))}
                    aria-label="Edit commercial"
                    style={{ width: '32px', height: '32px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--ink-500)', display: 'grid', placeItems: 'center' }}
                  >
                    <Icon name="i-edit" size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: Activity */}
      {tab === 'activity' && (
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)', animation: 'fadein .2s' }}>
          {(cr.activity || []).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--ink-100)', fontSize: '13px' }}>
              <span style={{ width: '90px', color: 'var(--ink-500)' }}>{a.date}</span>
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Post Drawer when clicking campaign history row */}
      {selDrawer && (
        <>
          <div onClick={() => setState(prev => ({ ...prev, pd: null }))} style={{ position: 'fixed', inset: 0, background: 'rgba(16,36,43,.35)', zIndex: 80 }} />
          <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '560px', maxWidth: '100%', background: '#fff', boxShadow: 'var(--e-3)', zIndex: 81, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--ink-100)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: '16px' }}>{selDrawer.h.campaign}</b>
                <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>{selDrawer.h.film} · {HQ.ds(selDrawer.h.date)} · {selDrawer.h.status}</span>
              </div>
              <button onClick={() => setState(prev => ({ ...prev, pd: null }))} aria-label="Close" style={{ width: '32px', height: '32px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--ink-500)', display: 'grid', placeItems: 'center' }}>
                <Icon name="i-x" size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'grid', alignContent: 'start', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
                <div style={{ padding: '12px 14px', border: '1px solid var(--ink-100)', borderRadius: '10px' }}>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-600)' }}>Posts this campaign</span>
                  <b style={{ fontSize: '20px' }}>{selDrawer.posts.length}</b>
                </div>
                <div style={{ padding: '12px 14px', border: '1px solid var(--ink-100)', borderRadius: '10px' }}>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-600)' }}>Views</span>
                  <b style={{ fontSize: '20px' }}>{HQ.n(selDrawer.posts.reduce((s, p) => s + p.views, 0))}</b>
                </div>
                <div style={{ padding: '12px 14px', border: '1px solid var(--ink-100)', borderRadius: '10px' }}>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-600)' }}>Engagements</span>
                  <b style={{ fontSize: '20px' }}>{HQ.n(selDrawer.posts.reduce((s, p) => s + p.likes + p.comments + p.shares, 0))}</b>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <b style={{ fontSize: '14px' }}>Posts in this campaign</b>
                {selDrawer.posts.map((p, i) => (
                  <div key={i} style={{ border: '1px solid var(--ink-100)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <span style={{ width: '64px', height: '44px', borderRadius: '6px', background: 'var(--ink-900)', color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}>
                        <Icon name="i-play" size={14} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: 'block', fontSize: '13px' }}>{p.title}</b>
                        <span style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{p.platform} · {p.format} · {HQ.ds(p.date)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', fontSize: '12px' }}>
                      <div><span style={{ display: 'block', color: 'var(--ink-500)' }}>Views</span><b style={{ fontSize: '13px' }}>{HQ.n(p.views)}</b></div>
                      <div><span style={{ display: 'block', color: 'var(--ink-500)' }}>Likes</span><b style={{ fontSize: '13px' }}>{HQ.n(p.likes)}</b></div>
                      <div><span style={{ display: 'block', color: 'var(--ink-500)' }}>Comments</span><b style={{ fontSize: '13px' }}>{HQ.n(p.comments)}</b></div>
                      <div><span style={{ display: 'block', color: 'var(--ink-500)' }}>Shares</span><b style={{ fontSize: '13px' }}>{HQ.n(p.shares)}</b></div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: 'var(--ink-600)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--teal-800)' }}>{p.tag}</span>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal-700)', fontWeight: 600 }}>Open post</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Commercial Edit Drawer */}
      {dCommercial && (
        <>
          <div onClick={() => setState(prev => ({ ...prev, cm: null }))} style={{ position: 'fixed', inset: 0, background: 'rgba(16,36,43,.35)', zIndex: 80 }} />
          <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px', maxWidth: '100%', background: '#fff', boxShadow: 'var(--e-3)', zIndex: 81, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--ink-100)', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <b style={{ flex: 1, fontSize: '16px' }}>{dCommercial.id ? 'Edit commercial' : 'Add commercial'}</b>
              <button onClick={() => setState(prev => ({ ...prev, cm: null }))} aria-label="Close" style={{ width: '32px', height: '32px', border: 0, borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--ink-500)', display: 'grid', placeItems: 'center' }}>
                <Icon name="i-x" size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'grid', alignContent: 'start', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Course</label>
                <select value={dCommercial.film} onChange={(e) => setState(s => ({ ...s, cm: { ...s.cm, film: e.target.value } }))} style={{ height: '40px', padding: '0 8px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}>
                  {filmsList.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Campaign</label>
                <input value={dCommercial.campaign} onChange={(e) => setState(s => ({ ...s, cm: { ...s.cm, campaign: e.target.value } }))} placeholder="e.g. Post launch" style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Deal type</label>
                  <select value={dCommercial.dealType} onChange={(e) => setState(s => ({ ...s, cm: { ...s.cm, dealType: e.target.value } }))} style={{ height: '40px', padding: '0 8px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}>
                    <option>Paid</option>
                    <option>Barter</option>
                    <option>Paid + barter</option>
                    <option>Revenue share</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Posts</label>
                  <input value={dCommercial.posts} onChange={(e) => setState(s => ({ ...s, cm: { ...s.cm, posts: e.target.value.replace(/[^0-9]/g, '') } }))} inputMode="numeric" style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Fee per post (₹)</label>
                  <input value={dCommercial.fee} onChange={(e) => setState(s => ({ ...s, cm: { ...s.cm, fee: e.target.value.replace(/[^0-9]/g, '') } }))} inputMode="numeric" style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Total</label>
                  <div style={{ height: '40px', padding: '0 12px', borderRadius: '8px', background: 'var(--ink-50)', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                    {HQ.inr((+dCommercial.fee || 0) * (+dCommercial.posts || 0))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Payment terms</label>
                <select value={dCommercial.payment} onChange={(e) => setState(s => ({ ...s, cm: { ...s.cm, payment: e.target.value } }))} style={{ height: '40px', padding: '0 8px', border: '1px solid var(--ink-300)', borderRadius: '8px', background: '#fff' }}>
                  <option>50% advance, 50% on posting</option>
                  <option>100% on posting</option>
                  <option>100% advance</option>
                  <option>Net 30 after posting</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Deliverables</label>
                <input value={dCommercial.deliverables} onChange={(e) => setState(s => ({ ...s, cm: { ...s.cm, deliverables: e.target.value } }))} placeholder="e.g. 2 reels + 3 stories" style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Notes</label>
                <textarea value={dCommercial.notes} onChange={(e) => setState(s => ({ ...s, cm: { ...s.cm, notes: e.target.value } }))} placeholder="Usage rights, exclusivity, what was agreed" style={{ minHeight: '80px', padding: '10px 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--ink-100)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {dCommercial.id && (
                <button
                  onClick={() => {
                    HQ.set(z => {
                      const cItem = z.creators.find(q => q.id === cr.id);
                      if (cItem) cItem.commercials = (cItem.commercials || []).filter(q => q.id !== dCommercial.id);
                    });
                    setState(prev => ({ ...prev, cm: null }));
                    HQ.toast('Commercial deleted');
                  }}
                  style={{ height: '40px', padding: '0 14px', borderRadius: '8px', border: 0, background: 'none', color: 'var(--danger-600)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Delete
                </button>
              )}
              <span style={{ flex: 1, minWidth: '100px', fontSize: '13px', color: 'var(--danger-600)' }}>{state.cmErr}</span>
              <button onClick={() => setState(prev => ({ ...prev, cm: null }))} style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  const fee = +dCommercial.fee || 0;
                  const posts = +dCommercial.posts || 0;
                  if (!fee || !posts) return setState(prev => ({ ...prev, cmErr: 'Fee and posts are required' }));
                  HQ.set(z => {
                    const cItem = z.creators.find(q => q.id === cr.id);
                    if (!cItem.commercials) cItem.commercials = commsAll.slice();
                    const existing = cItem.commercials.find(q => q.id === dCommercial.id);
                    if (existing) {
                      Object.assign(existing, { ...dCommercial, fee, posts, updated: HQ.TODAY });
                    } else {
                      cItem.commercials.unshift({ ...dCommercial, id: HQ.uid('cm'), fee, posts, updated: HQ.TODAY });
                    }
                  });
                  setState(prev => ({ ...prev, cm: null }));
                  HQ.toast('Commercial saved');
                }}
                style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
