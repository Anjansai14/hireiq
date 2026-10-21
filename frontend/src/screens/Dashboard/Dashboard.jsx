import React, { useState, useEffect } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';
import NewCourseModal from '../Courses/NewCourseModal';
import { api } from '../../lib/api';

export default function Dashboard() {
  const { state, HQ, currentCourse, go, set, toast } = useHQ();
  const [loading, setLoading] = useState(true);
  const [dashData, setDashData] = useState(null);
  const [courseCamps, setCourseCamps] = useState([]);
  const [running, setRunning] = useState({});
  const [newCourseOpen, setNewCourseOpen] = useState(false);

  const film = currentCourse;
  const s = state;

  useEffect(() => {
    let cancelled = false;
    if (!film?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setDashData(null);

    Promise.all([
      api.get(`/courses/${film.id}/dashboard`).catch((err) => {
        console.warn('Dashboard fetch error:', err);
        return null;
      }),
      api.get(`/campaigns?course=${film.id}`).catch(() => [])
    ])
      .then(([dash, campsList]) => {
        if (cancelled) return;
        setDashData(dash);
        if (Array.isArray(campsList)) {
          setCourseCamps(campsList);
          HQ.set((z) => {
            z.campaigns = z.campaigns || [];
            campsList.forEach((item) => {
              const exIdx = z.campaigns.findIndex((k) => k.id === item.id);
              if (exIdx >= 0) {
                Object.assign(z.campaigns[exIdx], item);
              } else {
                z.campaigns.push(item);
              }
            });
          });
        }
        if (dash?.course) {
          HQ.set((z) => {
            const cur = (z.films || []).find((f) => f.id === film.id);
            if (cur) {
              if (dash.course.reads) cur.reads = dash.course.reads;
              if (dash.course.activity) cur.activity = dash.course.activity;
              if (dash.course.flags) cur.flags = dash.course.flags;
              if (dash.course.readiness) cur.readiness = dash.course.readiness;
              if (dash.course.form) cur.form = dash.course.form;
              if (dash.course.target != null) cur.target = dash.course.target;
              if (dash.course.ceiling != null) cur.ceiling = dash.course.ceiling;
            }
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [film?.id]);

  if (!film) {
    return (
      <div style={{ padding: '28px 32px 48px', maxWidth: '1320px', textAlign: 'center', color: 'var(--ink-500)' }}>
        No course selected.
      </div>
    );
  }

  if (loading && !dashData) {
    return (
      <div style={{ padding: '28px 32px 48px', maxWidth: '1320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ minHeight: '340px', display: 'grid', placeItems: 'center', background: '#fff', borderRadius: '12px', border: '1px solid var(--ink-100)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid var(--teal-200)', borderTopColor: 'var(--teal-700)', animation: 'spin .8s linear infinite' }}></span>
            <span style={{ fontSize: '14px', color: 'var(--ink-600)', fontWeight: 500 }}>Loading dashboard for {film.title}…</span>
          </div>
        </div>
      </div>
    );
  }

  const courseInfo = dashData?.course || film;
  const form = courseInfo.form || film.form || {};
  const domain = form.domain || film.brief?.domain || '—';
  const level = form.level || film.brief?.level || 'Intermediate';
  const dur = form.duration || film.brief?.duration || '16 weeks';
  const mode = form.mode || film.brief?.mode || 'Hybrid (3 days in centre)';
  const releaseDate = courseInfo.batch_start || film.release || film.batch_start;
  const days = releaseDate ? HQ.daysBetween(HQ.TODAY, releaseDate) : 0;
  const batch = courseInfo.batch || film.batch || 'Batch 1';
  const title = courseInfo.title || film.title || 'Untitled Course';
  const provider = courseInfo.provider || film.provider || 'Nexa Skills Foundation';

  const allCamps = courseCamps.length > 0 ? courseCamps : s.campaigns.filter(c => (c.filmId === film.id || c.course_id === film.id));
  const batchCamps = allCamps.filter(c => (c.batch || batch) === batch && c.status !== 'Draft');

  const bud = form.budget || film.brief?.budget || film.budget || 0;
  const filmBudget = +String(bud).replace(/[^\d]/g, '') || 0;

  const target = Number(courseInfo.target || form.target || film.target || film.brief?.intakeTarget || 0);
  const ceiling = Number(courseInfo.ceiling || form.ceiling || film.ceiling || film.brief?.costCeiling || 0);

  let committed = dashData?.totals?.committed ?? 0;
  let spent = dashData?.totals?.spent ?? 0;
  let reach = dashData?.totals?.reach ?? 0;
  let clicks = dashData?.totals?.clicks ?? 0;
  let regs = dashData?.totals?.regs ?? 0;
  let enrols = dashData?.totals?.enrols ?? 0;
  let unattr = dashData?.totals?.unattributed ?? 0;
  let posts = dashData?.totals?.posts ?? 0;

  if (!dashData?.totals) {
    batchCamps.forEach(c => {
      const st = c.stats || HQ.campStats(c);
      committed += (c.committed || st.committed || 0);
      spent += (c.spent || st.spent || 0);
      reach += (st.reach || st.views || 0);
      clicks += (st.clicks || 0);
      regs += (st.regs || 0);
      enrols += (st.enrols || 0);
      posts += (st.posts || 0);
      unattr += (c.unattributed || 0);
    });
  }

  const cpe = enrols > 0 ? Math.round(spent / enrols) : null;
  const rd = courseInfo.readiness || HQ.readiness(courseInfo) || { ok: 0, total: 9, req: 9, pct: 0, missing: [] };

  // Alerts for current course only
  const alerts = [];
  if (rd.missing && rd.missing.length > 0) {
    alerts.push({
      title: 'Brief is missing ' + rd.missing.length + ' required field' + (rd.missing.length > 1 ? 's' : ''),
      sub: rd.missing.map(m => m.label).join(', ') + ' · programme reads are blocked',
      cta: 'Complete brief',
      go: () => go('brief'),
      dot: 'var(--danger-600)'
    });
  }

  const flags = courseInfo.flags || film.flags || [];
  flags.filter(f => f.status === 'Refused').forEach(f => {
    alerts.push({
      title: `${f.type} flag is Refused`,
      sub: f.note || 'Create campaign is blocked until resolved',
      cta: 'Review',
      go: () => go('brief'),
      dot: 'var(--danger-600)'
    });
  });

  allCamps.filter(c => c.status === 'Live').forEach(c => {
    const cp = (c.checkpoints || []).filter(k => k.verdict).slice(-1)[0];
    if (cp && cp.verdict === 'Behind') {
      alerts.push({
        title: c.name + ' is Behind at ' + cp.label,
        sub: `${c.name} · ${cp.note || 'Enrolments below expected band'}`,
        cta: 'Open Insights',
        go: () => go('campaign', { id: c.id, tab: 'insights' }),
        dot: 'var(--danger-600)'
      });
    }
    (c.alerts || []).filter(a => !a.dismissed).forEach(a => {
      alerts.push({
        title: ((a.rule_code || a.rule) === 'RR-H05' ? 'Enrolment rate below floor' : 'Scepticism alert') + ' · ' + c.name,
        sub: a.text || a.note || a.title || 'Alert requires review',
        cta: 'Review',
        go: () => go('campaign', { id: c.id, tab: 'insights' }),
        dot: 'var(--warning-600)'
      });
    });
    (c.ccs || []).filter(x => x.late && !(x.posts || []).length).forEach(x => {
      alerts.push({
        title: (HQ.creator(x.creatorId || x.source_id)?.name || x.name || 'Source') + ' is past the post date',
        sub: c.name + ' · due ' + HQ.ds(x.deal?.end || x.deal_end),
        cta: 'Open source',
        go: () => go('influencer', { campId: c.id, ccId: x.id, tab: 'posts' }),
        dot: 'var(--warning-600)'
      });
    });
  });

  (s.connectors || []).filter(c => c.status === 'Expiring').forEach(c => {
    alerts.push({
      title: c.name + ' token expires in 6 days',
      sub: c.detail || 'Platform tracking stops soon',
      cta: 'Reconnect',
      go: () => go('settings', { tab: 'connectors' }),
      dot: 'var(--warning-600)'
    });
  });

  const fmax = Math.max(reach, 1);
  const fH = (v) => reach > 0 && v > 0 ? Math.max(8, Math.round(Math.pow(v / fmax, 0.32) * 100)) : 8;
  const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + '%' : '0.0%');

  const funnel = [
    { l: 'Reach', v: HQ.n(reach), rate: reach > 0 ? 'Inferred where no API' : 'No reach recorded', h: reach > 0 ? 100 : 8, c: 'var(--teal-100)', stamp: 'Observed where platform API provides, otherwise Inferred' },
    { l: 'Clicks', v: HQ.n(clicks), rate: reach > 0 ? 'CTR ' + pct(clicks, reach) : 'CTR 0.0%', h: fH(clicks), c: 'var(--teal-300)', stamp: 'Observed · tracked link clicks' },
    { l: 'Registrations', v: HQ.n(regs), rate: clicks > 0 ? pct(regs, clicks) + ' of clicks' : '0.0% of clicks', h: fH(regs), c: 'var(--teal-600)', stamp: 'Observed · Resolence LMS registration records' },
    { l: 'Enrolments', v: String(enrols), rate: regs > 0 ? pct(enrols, regs) + ' of registrations' : '0.0% of registrations', h: fH(enrols), c: 'var(--teal-800)', stamp: 'Observed · screening enrolments confirmed' }
  ];

  // Programme Reads - dynamic per course
  const defaultReads = [
    { key: 'public', title: 'Cohort demand and aspirations', status: 'Waiting', items: [] },
    { key: 'audience', title: 'Competing programmes and employers', status: 'Waiting', items: [] },
    { key: 'risk', title: 'What could go wrong', status: 'Waiting', items: [] }
  ];
  const serverReads = (dashData?.course?.reads?.length ? dashData.course.reads : courseInfo.reads) || [];
  const readsList = defaultReads.map(def => {
    const found = serverReads.find(r => (r.read_key || r.key) === def.key);
    const status = running[def.key] ? 'Running' : (found?.status || def.status);
    return {
      key: def.key,
      title: found?.title || def.title,
      status,
      st: HQ.tone(status),
      date: found?.read_date ? 'Updated ' + HQ.d(found.read_date) : 'Not generated yet',
      items: found?.items || []
    };
  });

  // Districts & Cohorts Table - dynamic per course
  const distRows = (dashData?.districts && dashData.districts.length > 0)
    ? dashData.districts
    : batchCamps.map(c => {
        const st = c.stats || HQ.campStats(c);
        return {
          cohort: c.cohort || c.name || c.asset || 'General',
          districts: (Array.isArray(c.markets) ? c.markets.join(', ') : c.markets) || 'All districts',
          clicks: HQ.n(st.clicks || 0),
          regs: HQ.n(st.regs || 0),
          enrols: String(st.enrols || 0),
          rate: st.regs ? ((st.enrols / st.regs) * 100).toFixed(1) + '%' : '—',
          cpe: st.enrols ? HQ.inr(Math.round((st.spent || 0) / st.enrols)) : '—'
        };
      });

  // Live Activity Feed - dynamic per course
  const activityRaw = (dashData?.course?.activity?.length ? dashData.course.activity : courseInfo.activity) || [];
  const activityFeed = activityRaw.slice(0, 5).map(a => {
    let icon = 'i-spark';
    if (a.kind === 'alert') icon = 'i-alert';
    else if (a.kind === 'fetch') icon = 'i-check';
    else if (a.kind === 'post') icon = 'i-play';
    else if (a.kind === 'deal') icon = 'i-upload';
    else if (a.kind === 'agent') icon = 'i-spark';

    return {
      icon,
      text: a.text,
      t: a.ts ? (typeof a.ts === 'string' && a.ts.includes('T') ? HQ.ds(a.ts) : a.ts) : 'Recently'
    };
  });

  const talk = dashData?.talk || allCamps.find(c => c.summary)?.summary || null;

  const handleRerunRead = async (key, readTitle) => {
    setRunning(r => ({ ...r, [key]: true }));
    toast(`Re-running "${readTitle}"...`);
    try {
      const res = await api.post(`/courses/${film.id}/reads/run`);
      if (res && res.reads) {
        setDashData(prev => prev ? { ...prev, course: { ...prev.course, reads: res.reads } } : null);
        HQ.set(z => {
          const cur = (z.films || []).find(f => f.id === film.id);
          if (cur) cur.reads = res.reads;
        });
        toast(`"${readTitle}" analysis updated.`);
      }
    } catch (err) {
      toast(err.message || `Failed to re-run ${readTitle}`, 'error');
    } finally {
      setRunning(r => ({ ...r, [key]: false }));
    }
  };

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Hero Banner */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{
          width: '88px',
          height: '120px',
          borderRadius: '10px',
          background: 'var(--ink-900)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '10px',
          flex: 'none',
          backgroundImage: 'repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 8px,transparent 8px 16px)'
        }}>
          <span style={{ fontSize: '10px', color: 'var(--ink-300)' }}>{batch}</span>
          <span style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.2 }}>{title}</span>
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '24px',
              padding: '0 10px',
              borderRadius: '999px',
              background: 'var(--hire-tint)',
              color: '#7A4F0F',
              fontSize: '12px',
              fontWeight: 600
            }}>
              {days > 0 ? `${days} days to batch start` : 'Batch in progress'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>
              {provider}
            </span>
          </div>

          <h1 style={{ margin: '0 0 4px', fontSize: '32px', lineHeight: '40px', fontWeight: 600, letterSpacing: '-.015em' }}>
            {title}
          </h1>

          <div style={{ color: 'var(--ink-600)', fontSize: '14px' }}>
            {`${batch} · ${domain} · ${level} · ${dur} · ${mode} · batch starts ${releaseDate ? HQ.d(releaseDate) : 'TBD'}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flex: 'none' }}>
          <button
            onClick={() => go('brief')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '40px',
              padding: '0 16px',
              borderRadius: '8px',
              border: '1px solid var(--ink-300)',
              background: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <Icon name="i-edit" size={18} />
            Course brief
          </button>
          <button
            onClick={async () => {
              const rdc = HQ.readiness ? HQ.readiness(courseInfo) : { refused: false, missing: [] };
              if (rdc.refused || (rdc.missing && rdc.missing.length)) {
                HQ.toast(
                  rdc.refused
                    ? `Blocked: a governance flag is Refused for ${title}`
                    : `Complete required brief fields (${rdc.ok}/9): ${(rdc.missing || []).map((m) => m.label).slice(0, 3).join(', ')}${(rdc.missing || []).length > 3 ? '...' : ''}`,
                  'error'
                );
                go('brief');
                return;
              }
              try {
                const res = await api.post('/campaigns', {
                  course_id: film.id,
                  name: 'Untitled campaign'
                });
                if (res && res.campaign) {
                  go('wizard', { id: res.campaign.id });
                }
              } catch (err) {
                HQ.toast(err.message || 'Failed to create campaign draft', 'error');
              }
            }}
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
            onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-800)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--teal-700)'}
          >
            <Icon name="i-plus" size={18} />
            New campaign
          </button>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
        {/* Card 1: Brief Readiness */}
        <div
          onClick={() => go('brief')}
          style={{
            background: '#fff',
            border: '1px solid var(--ink-100)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: 'var(--e-1)',
            cursor: 'pointer'
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ink-300)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--ink-100)'}
        >
          <div style={{ fontSize: '13px', color: 'var(--ink-600)', marginBottom: '6px' }}>Brief readiness</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', lineHeight: '32px', fontWeight: 600 }}>{rd.ok ?? 0}/{rd.total || rd.req || 9}</span>
            <span style={{ fontSize: '13px', color: 'var(--ink-500)' }}>required fields</span>
          </div>
          <div style={{ height: '8px', borderRadius: '999px', background: 'var(--ink-100)', overflow: 'hidden', marginTop: '12px' }}>
            <div style={{ height: '100%', width: `${rd.pct}%`, background: rd.pct === 100 ? 'var(--success-600)' : 'var(--warning-600)', borderRadius: '999px' }}></div>
          </div>
        </div>

        {/* Card 2: Enrolments vs Target */}
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
          <div style={{ fontSize: '13px', color: 'var(--ink-600)', marginBottom: '6px' }}>Enrolments vs target</div>
          <div style={{ fontSize: '28px', lineHeight: '32px', fontWeight: 600, letterSpacing: '-.01em', color: 'var(--ink-900)' }}>
            {enrols} / {target || '—'}
          </div>
          <div style={{ height: '8px', borderRadius: '999px', background: 'var(--ink-100)', overflow: 'hidden', marginTop: '10px' }}>
            <div style={{ height: '100%', width: `${Math.min(100, target > 0 ? Math.round((enrols / target) * 100) : 0)}%`, background: 'var(--teal-700)', borderRadius: '999px' }}></div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '8px' }}>
            {unattr} unattributed · Observed · Resolence 08:00
          </div>
        </div>

        {/* Card 3: Cost per Enrolment */}
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
          <div style={{ fontSize: '13px', color: 'var(--ink-600)', marginBottom: '6px' }}>Cost per enrolment</div>
          <div style={{ fontSize: '28px', lineHeight: '32px', fontWeight: 600, letterSpacing: '-.01em', color: 'var(--ink-900)' }}>
            {cpe != null ? HQ.inr(cpe) : '—'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '8px' }}>
            {ceiling ? `Ceiling ${HQ.inr(ceiling)} · ${cpe && cpe > ceiling ? 'exceeds ceiling' : 'within ceiling'}` : 'No ceiling set'}
          </div>
        </div>

        {/* Card 4: Spend */}
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
          <div style={{ fontSize: '13px', color: 'var(--ink-600)', marginBottom: '6px' }}>Spend</div>
          <div style={{ fontSize: '28px', lineHeight: '32px', fontWeight: 600, letterSpacing: '-.01em', color: 'var(--ink-900)' }}>
            {HQ.inrL(spent)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '8px' }}>
            {HQ.inrL(committed)} committed {filmBudget ? `of ${HQ.inrL(filmBudget)}` : ''}
          </div>
        </div>
      </div>

      {/* Needs Attention Alert List */}
      {alerts.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="i-alert" size={18} style={{ color: 'var(--danger-600)' }} />
            <b style={{ fontWeight: 600 }}>Needs attention</b>
            <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{alerts.length} items · each links to where you fix it</span>
          </div>
          {alerts.map((a, idx) => (
            <button
              key={idx}
              onClick={a.go}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 20px',
                border: 0,
                borderBottom: idx < alerts.length - 1 ? '1px solid var(--ink-100)' : 0,
                background: '#fff',
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-25)'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.dot, flex: 'none' }}></span>
              <span style={{ flex: 1, minWidth: 0, fontSize: '13px' }}>
                <b style={{ fontWeight: 600 }}>{a.title}</b>
                <span style={{ color: 'var(--ink-500)' }}> · {a.sub}</span>
              </span>
              <span style={{ color: 'var(--teal-700)', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                {a.cta}
                <Icon name="i-right" size={14} />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Main Grid: Funnel / Content / Campaigns on Left, Money / Activity / Governance on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Funnel Card */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
              <b style={{ fontSize: '16px' }}>Funnel to screening enrolment</b>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{batch} · {batchCamps.length} campaigns · {posts} tracked posts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
              {funnel.map((fn, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ height: '64px', display: 'flex', alignItems: 'flex-end', background: 'var(--ink-25)', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: `${fn.h}%`, background: fn.c, borderRadius: '8px 8px 0 0' }}></div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{fn.l}</div>
                    <div style={{ fontSize: '20px', fontWeight: 600 }} title={fn.stamp}>{fn.v}</div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{fn.rate}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cohort Voice / Comments Card */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <b style={{ fontSize: '16px', flex: 1 }}>What the cohort is saying</b>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Telugu and English student comments</span>
            </div>
            {talk ? (
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '23px', color: 'var(--ink-800)' }}>
                {talk}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '23px', color: 'var(--ink-500)', fontStyle: 'italic' }}>
                No cohort feedback recorded for this course yet. Student sentiment and comments will appear here once campaigns are live.
              </p>
            )}
          </div>

          {/* Campaigns at a glance Table */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)' }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ fontSize: '16px' }}>Campaigns at a glance</b>
              <button onClick={() => go('campaigns')} style={{ border: 0, background: 'none', color: 'var(--teal-700)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                View all
              </button>
            </div>
            {allCamps.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--ink-500)', fontSize: '13px', borderTop: '1px solid var(--ink-100)' }}>
                No campaigns created for this course yet. Click "New campaign" to start one.
              </div>
            ) : (
              allCamps.map(c => {
                const st = c.stats || HQ.campStats(c);
                const isBehind = c.checkpoints?.some(k => k.verdict === 'Behind') || c.verdict === 'Behind';
                const isAhead = c.checkpoints?.some(k => k.verdict === 'Ahead') || c.verdict === 'Ahead';
                const vColor = isBehind ? 'var(--danger-800)' : isAhead ? 'var(--success-800)' : 'var(--ink-700)';
                const vBg = isBehind ? 'var(--danger-100)' : isAhead ? 'var(--success-100)' : 'var(--ink-100)';
                const verdict = isBehind ? 'Behind' : isAhead ? 'Ahead' : 'On track';
                return (
                  <button
                    key={c.id}
                    onClick={() => go('campaign', { id: c.id })}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1.3fr) 110px',
                      gap: '16px',
                      alignItems: 'center',
                      padding: '14px 20px',
                      border: 0,
                      borderTop: '1px solid var(--ink-100)',
                      background: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-25)'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                        <b style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</b>
                        <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: c.status === 'Live' ? 'var(--success-100)' : 'var(--ink-100)', color: c.status === 'Live' ? 'var(--success-800)' : 'var(--ink-700)', fontSize: '12px', fontWeight: 600 }}>
                          {c.status}
                        </span>
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{c.cohort || (Array.isArray(c.markets) ? c.markets.join(', ') : c.markets)}</span>
                    </span>

                    <span>
                      <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--ink-600)', marginBottom: '6px' }}>
                        <span>Enrolments</span>
                        <b style={{ color: 'var(--ink-900)' }}>{st.enrols || 0} / {c.target || c.targetEnrolments || 120}</b>
                      </span>
                      <span style={{ display: 'block', position: 'relative', height: '8px', borderRadius: '999px', background: 'var(--ink-100)' }}>
                        <span style={{ position: 'absolute', left: 0, width: `${Math.min(100, Math.round(((st.enrols || 0) / (c.target || c.targetEnrolments || 120)) * 100))}%`, top: 0, bottom: 0, background: 'var(--teal-700)', borderRadius: '999px' }}></span>
                      </span>
                    </span>

                    <span style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: vBg, color: vColor, fontSize: '12px', fontWeight: 600 }}>
                        {verdict}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Districts and Cohorts Table */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ fontSize: '16px' }}>Districts and cohorts</b>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Aggregate counts only · attribution last click</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--ink-25)', color: 'var(--ink-600)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 20px', fontWeight: 600 }}>Cohort</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Districts</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Clicks</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Registrations</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Enrolments</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Enrolment rate</th>
                    <th style={{ padding: '10px 20px', fontWeight: 600, textAlign: 'right' }}>Cost / enrolment</th>
                  </tr>
                </thead>
                <tbody>
                  {distRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--ink-500)', fontSize: '13px' }}>
                        No campaign cohort or district data available for this course yet.
                      </td>
                    </tr>
                  ) : (
                    distRows.map((d, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid var(--ink-100)' }}>
                        <td style={{ padding: '10px 20px', fontWeight: 600 }}>{d.cohort}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--ink-600)' }}>{d.districts}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{d.clicks}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{d.regs}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{d.enrols}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{d.rate}</td>
                        <td style={{ padding: '10px 20px', textAlign: 'right' }}>{d.cpe != null && d.cpe !== '' ? (typeof d.cpe === 'number' ? HQ.inr(d.cpe) : d.cpe) : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Programme Reads */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)' }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ fontSize: '16px' }}>Programme reads</b>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Background intelligence synthesis</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderTop: '1px solid var(--ink-100)' }}>
              {readsList.map((r2, idx) => (
                <div key={idx} style={{ padding: '16px 20px', borderRight: idx < 2 ? '1px solid var(--ink-100)' : 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                    <b style={{ fontSize: '14px' }}>{r2.title}</b>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: r2.st.bg, color: r2.st.fg, fontSize: '12px', fontWeight: 600 }}>
                      {r2.status}
                    </span>
                  </div>
                  {running[r2.key] && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--ink-500)' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--teal-200)', borderTopColor: 'var(--teal-700)', animation: 'spin .8s linear infinite' }}></span>
                      Analyzing data sources...
                    </div>
                  )}
                  {r2.items.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--ink-500)', fontStyle: 'italic', padding: '12px 0' }}>
                      No synthesis generated yet. Click Re-run to analyze cohort demand and background intelligence.
                    </div>
                  ) : (
                    r2.items.map((it, j) => (
                      <div key={j} style={{ display: 'flex', gap: '8px', fontSize: '13px', lineHeight: '1.45' }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--ink-400)', marginTop: '8px', flex: 'none' }}></span>
                        <span style={{ flex: 1 }}>
                          {it.t}{' '}
                          <span title={it.src} style={{ display: 'inline-flex', height: '18px', padding: '0 6px', borderRadius: '4px', background: it.stamp === 'Observed' ? 'var(--info-100)' : it.stamp === 'Warning' ? 'var(--warning-100)' : 'var(--ink-50)', color: it.stamp === 'Observed' ? 'var(--info-800)' : it.stamp === 'Warning' ? 'var(--warning-800)' : 'var(--ink-700)', fontSize: '11px', fontWeight: 600, alignItems: 'center' }}>
                            {it.stamp}
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{r2.date}</span>
                    <button
                      onClick={() => handleRerunRead(r2.key, r2.title)}
                      disabled={running[r2.key]}
                      style={{ height: '28px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--ink-300)', background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <Icon name="i-refresh" size={14} />
                      Re-run
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Money Card */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
              <b style={{ fontSize: '16px' }}>Money</b>
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Computed from deals</span>
            </div>
            <div style={{ display: 'flex', height: '12px', borderRadius: '999px', overflow: 'hidden', background: 'var(--ink-100)', marginBottom: '14px' }}>
              <div style={{ width: `${filmBudget > 0 ? Math.min(100, Math.round((spent / filmBudget) * 100)) : 0}%`, background: 'var(--teal-700)' }}></div>
              <div style={{ width: `${filmBudget > 0 ? Math.min(100, Math.round(((committed - spent) / filmBudget) * 100)) : 0}%`, background: 'var(--teal-300)' }}></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              <div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: 'var(--ink-600)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--teal-700)' }}></span>
                  Spent
                </div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{HQ.inrL(spent)}</div>
              </div>
              <div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: 'var(--ink-600)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--teal-300)' }}></span>
                  Committed
                </div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{HQ.inrL(committed)}</div>
              </div>
              <div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: 'var(--ink-600)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--ink-200)' }}></span>
                  Remaining
                </div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{HQ.inrL(Math.max(0, filmBudget - committed))}</div>
              </div>
              <div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: 'var(--ink-600)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--ink-400)' }}></span>
                  Budget
                </div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{HQ.inrL(filmBudget)}</div>
              </div>
            </div>
          </div>

          {/* Live Activity Feed */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)' }}>
            <div style={{ padding: '16px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: '16px' }}>Live activity</b>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--success-600)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success-600)', animation: 'pulse 2s infinite' }}></span>
                Live
              </span>
            </div>
            {activityFeed.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--ink-500)', fontSize: '13px' }}>
                No live activity recorded for this course yet.
              </div>
            ) : (
              activityFeed.map((a, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', padding: '10px 20px' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--ink-50)', color: 'var(--ink-600)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                    <Icon name={a.icon} size={15} />
                  </span>
                  <div style={{ flex: 1, fontSize: '13px' }}>
                    <div>{a.text}</div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{a.t}</div>
                  </div>
                </div>
              ))
            )}
            <div style={{ height: '8px' }}></div>
          </div>

          {/* Governance Flags */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
              <b style={{ fontSize: '16px' }}>Governance</b>
              <button onClick={() => go('brief')} style={{ border: 0, background: 'none', color: 'var(--teal-700)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Review
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {flags.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--ink-500)' }}>No governance flags recorded.</div>
              ) : (
                flags.map((g, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ flex: 1, fontSize: '13px' }}>
                      <b style={{ display: 'block', fontWeight: 600 }}>{g.type}</b>
                      <span style={{ color: 'var(--ink-500)', fontSize: '12px' }}>{g.note}</span>
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: '22px',
                      padding: '0 8px',
                      borderRadius: '999px',
                      background: g.status === 'Cleared' ? 'var(--success-100)' : 'var(--warning-100)',
                      color: g.status === 'Cleared' ? 'var(--success-800)' : 'var(--warning-800)',
                      fontSize: '12px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      {g.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {newCourseOpen && <NewCourseModal onClose={() => setNewCourseOpen(false)} />}
    </div>
  );
}
