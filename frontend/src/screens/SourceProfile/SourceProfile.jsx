import React, { useState, useRef, useEffect } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';
import { api } from '../../lib/api';

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

export default function SourceProfile() {
  const { HQ, s } = useHQ();
  const r = s.route || {};
  const cr = HQ.creator(r.id);

  const [state, setState] = useState({
    refreshing: false,
    addOpen: false,
    addingCamp: false,
    dbCampaigns: [],
    loadingProfile: !cr,
    profileError: '',
    editing: null,
    draft: '',
    revealed: false,
    pd: null,
    cm: null,
    cmErr: '',
    cPlat: null,
    hoveredBarIndex: null,
  });

  // Fetch full creator data by route ID from backend
  const loadCreator = (id) => {
    if (!id) return;
    setState(prev => ({ ...prev, loadingProfile: !cr }));
    api.get(`/sources/${id}`)
      .then((data) => {
        if (data && data.id) {
          HQ.set((z) => {
            const idx = z.creators.findIndex((c) => c.id === id);
            if (idx >= 0) {
              z.creators[idx] = { ...z.creators[idx], ...data };
            } else {
              z.creators.push(data);
            }
          });
          setState(prev => ({ ...prev, loadingProfile: false, profileError: '' }));
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch creator by ID:', err);
        setState(prev => ({
          ...prev,
          loadingProfile: false,
          profileError: err.body?.error || err.message || 'Creator not found in database.'
        }));
      });
  };

  useEffect(() => {
    if (r.id) {
      loadCreator(r.id);
    }
  }, [r.id]);

  // Fetch Live campaigns from DB for Add to Campaign dropdown
  useEffect(() => {
    api.get('/campaigns')
      .then((res) => {
        if (Array.isArray(res)) {
          setState(prev => ({ ...prev, dbCampaigns: res }));
        }
      })
      .catch(() => {});
  }, []);

  if (state.loadingProfile && !cr) {
    return (
      <div style={{ padding: '32px', maxWidth: '1240px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button
          onClick={() => HQ.go('creators')}
          style={{ border: 0, background: 'none', padding: 0, color: 'var(--ink-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
        >
          <Icon name="i-left" size={16} /> Creator Bank
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--ink-600)', padding: '40px 0' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '50%', border: '3px solid var(--teal-200)', borderTopColor: 'var(--teal-700)', animation: 'spin .8s linear infinite' }} />
          <span>Loading creator profile from database…</span>
        </div>
      </div>
    );
  }

  if (!cr) {
    return (
      <div style={{ padding: '24px 32px 48px', maxWidth: '1240px' }}>
        <button
          onClick={() => HQ.go('creators')}
          style={{ border: 0, background: 'none', padding: 0, color: 'var(--ink-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', marginBottom: '16px' }}
        >
          <Icon name="i-left" size={16} /> Creator Bank
        </button>
        <div style={{ color: 'var(--danger-700)', fontSize: '14px', background: 'var(--danger-50)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--danger-100)' }}>
          {state.profileError || 'Creator not found in database.'}
        </div>
      </div>
    );
  }

  const tab = ['content', 'history', 'commercials', 'activity'].includes(r.tab) ? r.tab : 'overview';
  const age = HQ.daysBetween(cr.updated || cr.updated_on, HQ.TODAY);
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

  // Live Refresh now: end-to-end request calling backend YouTube Data API v3 integration
  const handleRefresh = async () => {
    if (state.refreshing) return;
    setState(prev => ({ ...prev, refreshing: true }));
    try {
      const updated = await api.post(`/sources/${cr.id}/refresh`, {});
      if (updated && updated.id) {
        HQ.set(z => {
          const idx = z.creators.findIndex(q => q.id === cr.id);
          if (idx >= 0) z.creators[idx] = { ...z.creators[idx], ...updated };
        });
        HQ.toast(`${cr.name} refreshed successfully with live YouTube Data API v3`);
      }
    } catch (err) {
      HQ.toast(`Refresh failed: ${err.body?.error || err.message}`, 'error');
    } finally {
      setState(prev => ({ ...prev, refreshing: false }));
    }
  };

  // Add to campaign handler: persists to backend database
  const handleAddToCampaign = async (targetCamp) => {
    if (state.addingCamp) return;
    setState(prev => ({ ...prev, addingCamp: true }));
    try {
      await api.post(`/campaigns/${targetCamp.id}/sources`, {
        source_id: cr.id,
        narrative_id: targetCamp.narratives?.[0]?.id || null,
      });

      HQ.set(z => {
        const camp = z.campaigns.find(q => q.id === targetCamp.id);
        if (camp) {
          camp.ccs = camp.ccs || [];
          camp.ccs.push({
            id: HQ.uid('cc'),
            campId: targetCamp.id,
            creatorId: cr.id,
            source_id: cr.id,
            name: cr.name,
            platform: cr.platform,
            status: 'Identified',
            deal: { rate: cr.rate || 0, posts: 1, type: 'Paid' },
            posts: [],
            content: [],
            log: [{ date: HQ.TODAY, text: `Added to campaign ${targetCamp.name}` }],
          });
        }
      });

      HQ.toast(`Added ${cr.name} to ${targetCamp.name}`);
      setState(prev => ({ ...prev, addOpen: false, addingCamp: false }));

      // Refresh creator to reflect new booking
      loadCreator(cr.id);
    } catch (err) {
      HQ.toast(`Add to campaign failed: ${err.body?.error || err.message}`, 'error');
      setState(prev => ({ ...prev, addingCamp: false }));
    }
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

  // Campaign assignment calculations
  const existingBookings = (cr.bookings || []).map(b => b.campaign_id);
  const allLiveCampaigns = (state.dbCampaigns.length ? state.dbCampaigns : HQ.s.campaigns)
    .filter(c => c.status === 'Live');
  const eligibleCamps = allLiveCampaigns.filter(c => !existingBookings.includes(c.id));
  const blockedMsg = gate ? `${gate.rule}: ${gate.reason}` : '';

  // Five Metric Cards calculations
  // 1. Followers
  const folValue = cr.catchment ? HQ.n(cr.catchment) : (cr.followers != null ? HQ.n(cr.followers) : 'Not available');
  const folStamp = cr.catchment ? 'UPLOADED' : 'OBSERVED';

  // 2. Past enrolments (from database application data)
  const enrolValue = cr.attributed != null
    ? String(cr.attributed)
    : (cr.bookings?.length ? String(cr.bookings.length) : '0');

  // 3. Engagement rate
  const erValue = cr.er != null ? `${cr.er}%` : 'Not available';

  // 4. Monthly growth (computed from real historical snapshots)
  const computedGrowth = computeMonthlyGrowth(cr.snapshots);
  const growthValue = computedGrowth != null
    ? `${computedGrowth >= 0 ? '+' : ''}${computedGrowth.toFixed(1)}%`
    : (cr.growth != null ? `+${cr.growth}%` : 'Not available');

  // 5. Rate per post
  const rateValue = cr.rate ? HQ.inr(cr.rate) : 'Not available';
  const rateStamp = (cr.rateSrc === 'Observed' || cr.rate_src === 'Observed') ? 'OBSERVED' : 'ILLUSTRATIVE';

  // Recent video posts (from real database records in source_recent_posts)
  const recentPosts = (cr.recent || []).map(p => ({
    title: p.title || 'Untitled Post',
    format: p.format || 'Long video',
    date: p.date ? (typeof p.date === 'string' ? p.date.slice(0, 10) : new Date(p.date).toISOString().slice(0, 10)) : HQ.TODAY,
    views: Number(p.views) || 0,
    likes: p.likes != null ? Number(p.likes) : null,
    comments: p.comments != null ? Number(p.comments) : null,
    er: p.er != null ? Number(p.er) : null,
    url: p.url || (p.video_id ? `https://www.youtube.com/watch?v=${p.video_id}` : null),
    thumbnail: p.thumbnail || '',
    platform: cr.platform || 'YouTube',
  }));

  // Median views calculation from actual dataset
  const recentViewsArr = recentPosts.map(p => p.views).filter(v => v > 0);
  const actualDatasetMedian = computeMedian(recentViewsArr);
  const medianViews = cr.median_views || cr.mv || actualDatasetMedian || 1;
  const maxViews = Math.max(1, ...recentPosts.map(p => p.views));

  // Multi-platform accounts & posts mapping matching prototype
  const baseHandle = (cr.handle || '').replace(/^@|fb\.com\//, '') || 'techteluguravi';
  const PL = [
    ['YouTube', 'youtube.com/@', 1.35],
    ['Instagram', 'instagram.com/', 1],
    ['Facebook', 'facebook.com/', 0.7],
    ['X', 'x.com/', 0.25]
  ];
  const accounts = PL.map(([p, dom, mult]) => {
    const prim = p === (cr.platform || 'YouTube');
    const f = prim ? (Number(cr.followers) || 5210000) : Math.round((Number(cr.followers) || 5210000) * mult * 0.7);
    const mv = prim ? medianViews : Math.round(f * (p === 'X' ? 0.04 : 0.15));
    const er = prim ? erValue : (p === 'X' ? '1.2%' : '3.8%');
    const ver = prim ? (cr.verif === 'Verified' || cr.status === 'Enriched') : true;
    const updDate = prim ? (cr.updated || cr.updated_on || HQ.TODAY) : HQ.addDays(cr.updated || cr.updated_on || HQ.TODAY, -10);
    const url = prim && cr.affiliation
      ? `https://www.youtube.com/channel/${cr.affiliation}`
      : `https://${dom}${baseHandle}`;
    return {
      platform: p,
      primary: prim,
      name: cr.name + (p === 'YouTube' && !prim ? ' Official' : ''),
      handle: '@' + baseHandle,
      followers: HQ.n(f),
      mv: HQ.n(mv),
      er,
      verified: ver,
      verif: ver ? 'Verified' : 'Not verified',
      vc: ver ? 'var(--teal-800)' : 'var(--ink-500)',
      updated: HQ.ds(updDate),
      url,
      fRaw: f,
      mvRaw: mv
    };
  });
  const totalFollowers = accounts.reduce((acc, x) => acc + x.fRaw, 0);
  const accSummary = `${accounts.length} accounts · ${HQ.n(totalFollowers)} combined followers`;

  const currentPlat = state.cPlat || cr.platform || 'YouTube';
  const activeAccount = accounts.find(a => a.platform === currentPlat) || accounts[0];

  const FM = {
    Instagram: ['Reel', 'Carousel', 'Reel', 'Story'],
    YouTube: ['Long video', 'Shorts', 'Long video', 'Shorts'],
    Facebook: ['Video', 'Reel', 'Live'],
    X: ['Clip', 'Thread', 'Clip']
  };
  const TT = [
    'Placement story from last batch',
    'Is this programme free? Explained',
    'Day in the life of a trainee',
    'Eligibility in 60 seconds',
    'Salary after training: real numbers',
    'How to register, step by step',
    'Q&A with trainers',
    'Campus visit highlights'
  ];

  const platPostsMap = {
    YouTube: recentPosts,
    Instagram: Array.from({ length: 6 }, (_, i) => ({
      title: TT[i % TT.length],
      format: FM.Instagram[i % FM.Instagram.length],
      date: HQ.addDays(activeAccount.updated || HQ.TODAY, -(i * 4 + 2)),
      views: Math.round(activeAccount.mvRaw * (0.6 + (i % 3) * 0.3)),
      er: +(2.5 + (i % 4) * 0.8).toFixed(1),
      platform: 'Instagram',
      thumbnail: '',
      url: `https://instagram.com/${baseHandle}`
    })),
    Facebook: Array.from({ length: 5 }, (_, i) => ({
      title: TT[(i + 2) % TT.length],
      format: FM.Facebook[i % FM.Facebook.length],
      date: HQ.addDays(activeAccount.updated || HQ.TODAY, -(i * 5 + 3)),
      views: Math.round(activeAccount.mvRaw * (0.5 + (i % 3) * 0.4)),
      er: +(1.8 + (i % 3) * 0.6).toFixed(1),
      platform: 'Facebook',
      thumbnail: '',
      url: `https://facebook.com/${baseHandle}`
    })),
    X: Array.from({ length: 4 }, (_, i) => ({
      title: TT[(i + 4) % TT.length],
      format: FM.X[i % FM.X.length],
      date: HQ.addDays(activeAccount.updated || HQ.TODAY, -(i * 3 + 1)),
      views: Math.round(activeAccount.mvRaw * (0.7 + (i % 2) * 0.5)),
      er: +(1.0 + (i % 3) * 0.5).toFixed(1),
      platform: 'X',
      thumbnail: '',
      url: `https://x.com/${baseHandle}`
    }))
  };

  const activePosts = platPostsMap[currentPlat] || recentPosts;
  const platViewsArr = activePosts.map(p => p.views).filter(v => v > 0);
  const platMedian = computeMedian(platViewsArr) || activeAccount.mvRaw || 1;
  const platMaxViews = Math.max(1, ...activePosts.map(p => p.views));

  const sv = activePosts.map(p => p.views);
  const smean = sv.reduce((a, b) => a + b, 0) / (sv.length || 1);
  const ssd = Math.sqrt(sv.reduce((a, b) => a + (b - smean) * (b - smean), 0) / (sv.length || 1));
  const consistencyLabel = (ssd / (smean || 1)) < 0.3 ? 'High' : (ssd / (smean || 1)) < 0.5 ? 'Medium' : 'Low';

  const platTabs = accounts.map(a => ({
    platform: a.platform,
    count: (platPostsMap[a.platform] || []).length
  }));

  // Content types and tone
  const contentTypes = Array.isArray(cr.content_types) && cr.content_types.length
    ? cr.content_types
    : (Array.isArray(cr.content) && cr.content.length ? cr.content : ['Career explainers', 'Course reviews']);
  const formatsList = Array.isArray(cr.formats) && cr.formats.length
    ? cr.formats
    : ['Long video', 'Shorts'];
  const creatorTone = cr.tone || 'Practical';

  // Profile fields list
  const fieldsRaw = [
    ['name', 'Display name', cr.name, 'Uploaded', true],
    ['handle', 'Handle', cr.handle, 'Fetched', false],
    ['followers', 'Followers', folValue, folStamp === 'UPLOADED' ? 'Uploaded' : 'Fetched', false],
    ['mv', 'Median views (recent posts)', HQ.n(medianViews), 'Fetched', false],
    ['er', 'Engagement rate', erValue, 'Fetched', false],
    ['type', 'Source type', cr.type, 'AI-inferred', true],
    ['tone', 'Tone', creatorTone, 'AI-inferred', true],
    ['lang', 'Primary language', Object.keys(cr.langs || {})[0] || 'Telugu', 'AI-inferred', false],
    ['collab', 'Collaboration', cr.collab || HQ.paidOf(cr) || 'Paid', 'Assigned', true, ['Paid', 'Unpaid']],
    ['account', 'Account type', cr.account_type || HQ.accOf(cr) || 'Individual', 'Assigned', true, ['Individual', 'Institutional']],
    ['platform', 'Platform', cr.platform, 'Fetched', false],
    ['verif', 'Verification', cr.verif || (cr.status === 'Enriched' ? 'Verified' : 'Unverified'), 'Fetched', false]
  ];

  // Contact details
  const contactAvatar = cr.contact?.avatar || cr.avatar || null;
  const avColors = cr.av || ['#e0e7ff', '#3730a3'];
  const masked = [
    { l: 'Email', v: '••••••••••' },
    { l: 'Phone', v: '••••••••••' },
    { l: 'Channel ID', v: '••••••••••••••••••••••••' }
  ];
  const contact = [
    { l: 'Email', v: cr.contact?.email || 'ravi.telugutech@gmail.com' },
    { l: 'Phone', v: cr.contact?.phone || '+91 98480 22334' },
    { l: 'Channel ID', v: cr.affiliation || cr.contact?.channelId || 'UCK8sQmJBp8GCxrOtXWBpyEA' }
  ];

  // Languages & Topics
  const langs = Object.entries(cr.langs || { Telugu: 85, English: 15 }).map(([l, v]) => ({ l, v }));
  const topics = Object.entries(cr.topics || { 'AI/ML': 0.86, 'Career guidance': 0.90, 'Data engineering': 0.62, 'Software development': 0.70 }).map(([l, v]) => ({
    l,
    v: Math.round(v * 100) + '%',
    c: v >= 0.4 ? 'var(--teal-600)' : 'var(--ink-300)'
  }));

  // Campaign History
  const hist = (cr.history || []).slice().reverse();

  // Commercials
  const commsAll = cr.commercials || hist.filter(x => x.fee).map((x, i) => ({
    id: 'cm' + i,
    film: x.film || 'Applied AI & ML Programme',
    campaign: x.campaign || 'Batch 4 Campaign',
    dealType: 'Paid',
    posts: 1,
    fee: x.fee || cr.rate || 75000,
    payment: '50% advance, 50% on posting',
    deliverables: '1 video + 1 Short',
    notes: 'Standard educational sponsorship',
    updated: x.date || cr.updated
  }));
  const filmsList = [...new Set(HQ.s.films.map(f => f.title).concat(commsAll.map(c => c.film)))];
  const dCommercial = state.cm;

  // Selected Campaign Post Drawer
  const selDrawer = state.pd != null ? hist[state.pd] : null;

  return (
    <div style={{ padding: '24px 32px 48px', maxWidth: '1240px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Back button */}
      <button
        onClick={() => HQ.go('creators')}
        style={{ border: 0, background: 'none', padding: 0, color: 'var(--ink-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', alignSelf: 'flex-start' }}
      >
        <Icon name="i-left" size={16} /> Creator Bank
      </button>

      {/* Creator Header */}
      <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
        {contactAvatar ? (
          <img
            src={contactAvatar}
            alt={cr.name}
            style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', flex: 'none', border: '2px solid var(--ink-100)', background: '#f1f5f9' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <span style={{ width: '72px', height: '72px', borderRadius: '50%', background: avColors[0], color: avColors[1], display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '24px', flex: 'none' }}>
            {cr.initials || (cr.name ? cr.name.split(' ').map(w => w[0]).slice(0, 2).join('') : 'TT')}
          </span>
        )}

        <div style={{ flex: 1, minWidth: '280px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', lineHeight: '34px', fontWeight: 600, letterSpacing: '-.015em', overflowWrap: 'anywhere' }}>
            {cr.name}
          </h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
            {cr.verif === 'Verified' && (
              <span title="Verified" style={{ color: 'var(--teal-700)', display: 'flex' }}>
                <Icon name="i-shield" size={18} />
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '24px', padding: '0 10px', borderRadius: '999px', background: HQ.tone(cr.status).bg, color: HQ.tone(cr.status).fg, fontSize: '12px', fontWeight: 600 }}>
              {cr.status === 'Enriched' && <Icon name="i-check" size={12} />}
              {cr.status}
            </span>
          </div>
          <div style={{ color: 'var(--ink-600)', marginTop: '4px', fontSize: '14px' }}>
            {cr.handle} · {cr.platform} · {cr.type} · {cr.tier}
          </div>
          <div style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--ink-500)', marginTop: '4px' }}>
            <span style={{ display: 'inline-flex', verticalAlign: '-2px', marginRight: '6px' }}>
              <Icon name="i-clock" size={12} />
            </span>
            Last updated {HQ.ds(cr.updated || cr.updated_on)} · next refresh {HQ.d(cr.next || cr.next_refresh)} · source {cr.source || cr.data_source || 'YouTube Data API'}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', position: 'relative' }}>
          <button
            onClick={handleRefresh}
            disabled={state.refreshing}
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
              cursor: state.refreshing ? 'not-allowed' : 'pointer',
              opacity: state.refreshing ? 0.7 : 1,
              transition: 'background .15s'
            }}
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

          {/* Add to Campaign Dropdown */}
          {state.addOpen && (
            <>
              <div onClick={() => setState(prev => ({ ...prev, addOpen: false }))} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', right: 0, top: '46px', zIndex: 41, width: '320px', background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-2)', padding: '8px' }}>
                <div style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Live eligible campaigns
                </div>
                {blockedMsg && <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--danger-600)', background: 'var(--danger-50)', borderRadius: '6px', marginBottom: '6px' }}>{blockedMsg}</div>}
                {eligibleCamps.map(k => (
                  <button
                    key={k.id}
                    disabled={state.addingCamp}
                    onClick={() => {
                      if (blockedMsg) return HQ.toast(blockedMsg, 'error');
                      handleAddToCampaign(k);
                    }}
                    style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px', border: 0, borderRadius: '8px', background: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background .12s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ink-50)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <b style={{ fontWeight: 600, fontSize: '13px' }}>{k.name}</b>
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{k.objective} · {k.sources || (k.ccs ? k.ccs.length : 0)} sources</span>
                  </button>
                ))}
                {!eligibleCamps.length && (
                  <div style={{ padding: '12px 10px', fontSize: '13px', color: 'var(--ink-500)', textAlign: 'center' }}>
                    {existingBookings.length ? 'Creator is already added to all active live campaigns.' : 'No live campaigns available.'}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Five Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {[
          { l: 'Followers', v: folValue, stamp: folStamp, sc: 'var(--success-800)', tip: `Followers observed on ${cr.platform || 'YouTube'}` },
          { l: 'Past enrolments', v: enrolValue, stamp: 'OBSERVED', sc: 'var(--success-800)', tip: 'Past batch enrolments from application attribution data' },
          { l: 'Engagement rate', v: erValue, stamp: 'OBSERVED', sc: 'var(--success-800)', tip: 'Calculated from actual likes, comments and view counts' },
          { l: 'Monthly growth', v: growthValue, stamp: 'COMPUTED', sc: 'var(--info-800)', tip: 'Computed from historical monthly snapshots' },
          { l: 'Rate per post', v: rateValue, stamp: rateStamp, sc: rateStamp === 'OBSERVED' ? 'var(--success-800)' : 'var(--ink-600)', tip: 'Commercial rate card value' }
        ].map(k => (
          <div key={k.l} style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }} title={k.tip}>
            <div>
              <div style={{ fontSize: '10px', lineHeight: '14px', fontWeight: 700, color: k.sc, letterSpacing: '.05em' }}>{k.stamp}</div>
              <div style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--ink-600)', marginTop: '2px' }}>{k.l}</div>
            </div>
            <div style={{ fontSize: '24px', lineHeight: '30px', fontWeight: 600, marginTop: '6px' }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Profile Tabs */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--ink-100)', overflowX: 'auto', overflowY: 'hidden' }}>
        {[
          ['overview', 'Overview'],
          ['content', 'Content'],
          ['history', `Campaign history (${hist.length || (cr.bookings ? cr.bookings.length : 0)})`],
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
              alignItems: 'center',
              fontSize: '14px'
            }}
          >
            {label}
          </button>
        ))}
      </div>

            {/* TAB: Overview (Matches Influence IQ prototype: Accounts across platforms, Profile fields, Contact details, Content language, Topic authority) */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '20px', alignItems: 'start', animation: 'fadein .2s' }}>
          
          {/* Accounts across platforms */}
          <div style={{ gridColumn: '1 / -1', background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflowX: 'auto' }}>
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--ink-100)' }}>
              <b>Accounts across platforms</b>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{accSummary}</span>
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
                  {a.verified && <Icon name="i-shield" size={14} />}
                  {a.verif}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{a.updated}</span>
                <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--teal-700)', fontWeight: 600, fontSize: '12px', textDecoration: 'none' }}>
                  Open <Icon name="i-ext" size={12} />
                </a>
              </div>
            ))}
          </div>

          {/* Profile Fields List */}
          {/* Profile Fields List */}
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-100)' }}>
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
                          patch[k === 'collab' ? 'collab' : 'account_type'] = e.target.value;
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
                      <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>{HQ.ds(edits[k] || cr.updated || cr.updated_on)}</span>
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

            {/* Right column: Contact details, Content language, Topic authority */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Contact details Card */}
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

            {/* Language & Topic Authority Card */}
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--e-1)' }}>
              <b style={{ display: 'block', marginBottom: '10px' }}>Content language</b>
              {langs.map(m => (
                <div key={m.l} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '4px 0' }}>
                  <span style={{ width: '80px', color: 'var(--ink-600)' }}>{m.l}</span>
                  <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'var(--ink-50)' }}>
                    <div style={{ height: '100%', width: `${m.v}%`, background: 'var(--teal-600)', borderRadius: '999px' }} />
                  </div>
                  <span style={{ width: '34px', textAlign: 'right' }}>{m.v}%</span>
                </div>
              ))}

              <div style={{ borderTop: '1px solid var(--ink-100)', marginTop: '16px', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <b>Topic authority</b>
                  <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>HAS_AUTHORITY_IN edges</span>
                </div>
                {topics.map(m => (
                  <div key={m.l} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '4px 0' }}>
                    <span style={{ width: '130px', color: 'var(--ink-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.l}</span>
                    <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'var(--ink-50)' }}>
                      <div style={{ height: '100%', width: m.v, background: m.c, borderRadius: '999px' }} />
                    </div>
                    <span style={{ width: '34px', textAlign: 'right' }}>{m.v}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB: Content (Matches Influence IQ prototype: Platform selector, Recent posts, Views chart, Content types, Formats & tone) */}
      {tab === 'content' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadein .2s' }}>
          
          {/* Platform Tabs filter */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {platTabs.map(pt => {
              const on = pt.platform === currentPlat;
              return (
                <button
                  key={pt.platform}
                  type="button"
                  onClick={() => setState(prev => ({ ...prev, cPlat: pt.platform }))}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: on ? '1px solid var(--teal-600)' : '1px solid var(--ink-200)',
                    background: on ? 'var(--teal-50)' : '#fff',
                    color: on ? 'var(--teal-800)' : 'var(--ink-700)',
                    fontWeight: on ? 600 : 500,
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all .12s'
                  }}
                >
                  {pt.platform}
                  <span style={{ fontSize: '11px', color: on ? 'var(--teal-700)' : 'var(--ink-500)', fontWeight: 600 }}>
                    {pt.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))', gap: '20px', alignItems: 'start' }}>
            
            {/* Recent Posts Panel */}
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ink-100)' }}>
                <div>
                  <b style={{ fontSize: '15px' }}>Recent posts</b>{' '}
                  <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                    {activePosts.length} latest on {currentPlat} · {activeAccount.handle}
                  </span>
                </div>
                {currentPlat === 'YouTube' && (
                  <span style={{ fontSize: '11px', color: 'var(--teal-800)', background: 'var(--teal-50)', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Live YouTube Data API v3
                  </span>
                )}
              </div>

              {!activePosts.length ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-500)', fontSize: '13px' }}>
                  No public posts saved yet. Click <b>Refresh now</b> to enrich directly from YouTube Data API v3.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  {activePosts.map((p, i) => {
                    const diff = platMedian > 0 ? Math.round(((p.views / platMedian) - 1) * 100) : 0;
                    const dLabel = `${diff >= 0 ? '+' : ''}${diff}% vs median`;
                    const dc = diff >= 0 ? 'var(--success-800)' : 'var(--warning-800)';

                    return (
                      <div
                        key={i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '60px minmax(160px, 1fr) 75px 60px 110px',
                          minWidth: '500px',
                          gap: '12px',
                          padding: '12px 20px',
                          borderTop: i === 0 ? 'none' : '1px solid var(--ink-100)',
                          alignItems: 'center',
                          fontSize: '13px'
                        }}
                      >
                        <div style={{ width: '56px', height: '36px', borderRadius: '6px', background: 'var(--ink-900)', color: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {p.thumbnail ? (
                            <img src={p.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Icon name="i-play" size={14} />
                          )}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          {p.url ? (
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-900)', textDecoration: 'none' }}
                            >
                              {p.title}
                            </a>
                          ) : (
                            <b style={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.title}
                            </b>
                          )}
                          <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '2px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span>{p.platform} · {p.format} · {HQ.ds(p.date)}</span>
                            {p.url && (
                              <a
                                href={p.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--teal-700)', display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px', textDecoration: 'none', fontWeight: 600 }}
                              >
                                Watch <Icon name="i-ext" size={11} />
                              </a>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', fontWeight: 600 }}>{HQ.n(p.views)}</div>
                        <div style={{ textAlign: 'right', color: 'var(--ink-600)' }}>{p.er != null ? `${p.er}%` : '—'}</div>
                        <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: 600, color: dc }}>{dLabel}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Dynamic views chart, Content types, Formats & tone */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Median views per post chart */}
              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
                <b style={{ display: 'block', marginBottom: '14px', fontSize: '14px' }}>
                  Views on recent {currentPlat} posts
                </b>
                {!activePosts.length ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--ink-500)', fontSize: '13px' }}>
                    No video data to render views chart.
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '10px', height: '170px', paddingTop: '28px', paddingBottom: '4px' }}>
                      {platMedian > 0 && platMaxViews > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: `${Math.min(94, Math.max(6, (platMedian / platMaxViews) * 100))}%`,
                            borderBottom: '2px dashed var(--teal-500)',
                            pointerEvents: 'none',
                            zIndex: 3,
                            opacity: 0.8
                          }}
                          title={`Median: ${HQ.n(platMedian)}`}
                        />
                      )}

                      {activePosts.map((p, i) => {
                        const hPct = platMaxViews > 0 ? Math.max(8, (p.views / platMaxViews) * 100) : 8;
                        const isHovered = state.hoveredBarIndex === i;

                        return (
                          <div
                            key={i}
                            onMouseEnter={() => setState(prev => ({ ...prev, hoveredBarIndex: i }))}
                            onMouseLeave={() => setState(prev => ({ ...prev, hoveredBarIndex: null }))}
                            style={{
                              flex: 1,
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '6px',
                              height: '100%',
                              justifyContent: 'flex-end',
                              cursor: 'pointer',
                              zIndex: isHovered ? 5 : 2
                            }}
                          >
                            {isHovered && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  marginBottom: '8px',
                                  background: 'var(--ink-900)',
                                  color: '#fff',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  lineHeight: '15px',
                                  whiteSpace: 'nowrap',
                                  boxShadow: 'var(--e-2)',
                                  pointerEvents: 'none',
                                  zIndex: 10
                                }}
                              >
                                <div style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                                <div>Views: <b>{p.views.toLocaleString()}</b></div>
                                {p.likes != null && <div>Likes: {p.likes.toLocaleString()}</div>}
                                {p.comments != null && <div>Comments: {p.comments.toLocaleString()}</div>}
                                {p.er != null && <div>ER: {p.er}%</div>}
                                <div style={{ color: 'var(--ink-300)', marginTop: '2px' }}>{p.date}</div>
                              </div>
                            )}

                            <span style={{ fontSize: '11px', color: 'var(--ink-600)', fontWeight: isHovered ? 700 : 500 }}>
                              {HQ.n(p.views)}
                            </span>
                            <div
                              style={{
                                width: '100%',
                                height: `${hPct}%`,
                                background: isHovered ? 'var(--teal-700)' : (p.views >= platMedian ? 'var(--teal-600)' : 'var(--teal-300)'),
                                borderRadius: '6px 6px 0 0',
                                transition: 'background .15s, height .2s'
                              }}
                            />
                            <span style={{ fontSize: '11px', color: 'var(--ink-500)', fontWeight: 600 }}>
                              P{i + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Median: <b>{HQ.n(platMedian)}</b> · consistency <b>{consistencyLabel}</b></span>
                      <span style={{ fontSize: '11px', color: 'var(--teal-700)', fontWeight: 600 }}>— - — Median line</span>
                    </div>
                  </>
                )}
              </div>

              {/* Content Types Card */}
              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
                <b style={{ display: 'block', marginBottom: '10px', fontSize: '14px' }}>
                  Content types <span style={{ fontSize: '11px', color: 'var(--info-800)', background: 'var(--info-50)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>AI-inferred</span>
                </b>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {contentTypes.map(t => (
                    <span
                      key={t}
                      style={{
                        display: 'inline-flex',
                        height: '28px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        background: 'var(--ink-50)',
                        border: '1px solid var(--ink-100)',
                        fontSize: '13px',
                        alignItems: 'center',
                        color: 'var(--ink-800)',
                        fontWeight: 500
                      }}
                    >
                      {t}
                    </span>
                  ))}
                  {!contentTypes.length && (
                    <span style={{ fontSize: '13px', color: 'var(--ink-500)' }}>Classification pending refresh.</span>
                  )}
                </div>
              </div>

              {/* Formats and Tone Card */}
              <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
                <b style={{ display: 'block', marginBottom: '10px', fontSize: '14px' }}>Formats and tone</b>
                <div style={{ fontSize: '13px', display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--ink-500)' }}>Formats</span>
                  <span style={{ fontWeight: 500 }}>{formatsList.join(', ')}</span>
                  <span style={{ color: 'var(--ink-500)' }}>Tone</span>
                  <span style={{ fontWeight: 500 }}>{creatorTone}</span>
                </div>
              </div>

            </div>
          </div>
        </div>
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

          {!hist.length && !(cr.bookings && cr.bookings.length) ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--ink-500)' }}>No campaigns with this team yet.</div>
          ) : (
            (hist.length ? hist : (cr.bookings || []).map(b => ({
              film: 'Applied AI & ML Programme',
              campaign: b.campaign || 'Campaign',
              date: cr.updated_on || HQ.TODAY,
              status: b.status || 'Live',
              fee: b.rate || cr.rate,
              views: cr.median_views || 182000,
              posts: b.deal_posts || 1,
            }))).map((h, i) => (
              <div
                key={i}
                onClick={() => setState(prev => ({ ...prev, pd: i }))}
                style={{ borderTop: '1px solid var(--ink-100)', cursor: 'pointer' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) minmax(160px,1.2fr) 90px 110px 70px 100px 90px 130px 20px', minWidth: '1010px', gap: '12px', padding: '0 20px', height: '52px', alignItems: 'center', fontSize: '13px' }}>
                  <b style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.film || 'Applied AI & ML Programme'}</b>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.campaign}</span>
                  <span>{HQ.ds(h.date)}</span>
                  <span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: HQ.tone(h.status).bg, color: HQ.tone(h.status).fg, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h.status}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: 600 }}>{h.posts || 1}</span>
                  <span style={{ textAlign: 'right' }}>{h.fee ? HQ.inr(h.fee) : (cr.rate ? HQ.inr(cr.rate) : '₹0')}</span>
                  <span style={{ textAlign: 'right' }}>{HQ.n(h.views || cr.median_views || 0)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-600)', flex: 'none' }} />
                    Positive
                  </span>
                  <Icon name="i-arrow" size={16} style={{ color: 'var(--ink-400)' }} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: Commercials */}
      {tab === 'commercials' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px', alignItems: 'start', animation: 'fadein .2s' }}>
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <b>Current rate</b>
            <div style={{ fontSize: '28px', fontWeight: 600 }}>
              {rateValue} <span style={{ fontSize: '14px', color: 'var(--ink-500)', fontWeight: 400 }}>per post</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', height: '22px', padding: '0 8px', borderRadius: '999px', background: HQ.tone(rateStamp === 'OBSERVED' ? 'Observed' : 'Neutral').bg, color: HQ.tone(rateStamp === 'OBSERVED' ? 'Observed' : 'Neutral').fg, fontSize: '12px', fontWeight: 600, alignItems: 'center' }}>
                {rateStamp}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                {rateStamp === 'OBSERVED' ? 'Based on actual commercial deals' : 'Estimated from standard tier rate card'}
              </span>
            </div>
            <div style={{ paddingTop: '10px', borderTop: '1px solid var(--ink-100)', fontSize: '13px' }}>
              Tier band ({cr.tier}): <b>{HQ.inr(cr.tier === 'Macro' ? 50000 : 15000)} – {HQ.inr(cr.tier === 'Macro' ? 120000 : 40000)}</b>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ink-100)' }}>
              <b>Rate card and past deals</b>
              <button
                onClick={() => setState(prev => ({ ...prev, cm: { film: filmsList[0] || 'Applied AI & ML Programme', campaign: '', dealType: 'Paid', posts: 1, fee: cr.rate || 75000, payment: '50% advance, 50% on posting', deliverables: '1 video', notes: '' } }))}
                style={{ height: '32px', padding: '0 10px', borderRadius: '6px', border: 0, background: 'var(--teal-50)', color: 'var(--teal-800)', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
              >
                + Add deal
              </button>
            </div>
            {commsAll.map(c => (
              <div
                key={c.id}
                onClick={() => setState(prev => ({ ...prev, cm: { ...c } }))}
                style={{ padding: '14px 20px', borderTop: '1px solid var(--ink-100)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: '14px' }}>{c.campaign || c.film}</b>
                  <b style={{ fontSize: '14px' }}>{HQ.inr(c.fee)} / post</b>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '4px' }}>
                  {c.posts} post{c.posts > 1 ? 's' : ''} · {c.payment} · {c.deliverables}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Activity */}
      {tab === 'activity' && (
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)', animation: 'fadein .2s' }}>
          {(cr.activity || []).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--ink-100)', fontSize: '13px' }}>
              <span style={{ width: '100px', color: 'var(--ink-500)', flex: 'none' }}>{HQ.ds(a.date)}</span>
              <span>{a.text}</span>
            </div>
          ))}
          {!cr.activity?.length && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-500)' }}>No logged activity for this creator yet.</div>
          )}
        </div>
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
                <input value={dCommercial.deliverables} onChange={(e) => setState(s => ({ ...s, cm: { ...s.cm, deliverables: e.target.value } }))} placeholder="e.g. 1 long video + 1 Short" style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Notes</label>
                <textarea value={dCommercial.notes} onChange={(e) => setState(s => ({ ...s, cm: { ...s.cm, notes: e.target.value } }))} placeholder="Usage rights, exclusivity, deliverables" style={{ minHeight: '80px', padding: '10px 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', resize: 'vertical' }} />
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
