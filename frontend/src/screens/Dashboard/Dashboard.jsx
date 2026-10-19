import React, { useState, useEffect } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';
import NewCourseModal from '../Courses/NewCourseModal';
import { api } from '../../lib/api';

export default function Dashboard() {
  const { state, HQ, currentCourse, go, set, toast } = useHQ();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState({});
  const [newCourseOpen, setNewCourseOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const film = currentCourse;
  const s = state;
  const rd = HQ.readiness(film);
  const days = HQ.daysBetween(HQ.TODAY, film.release);
  const camps = s.campaigns.filter(c => c.filmId === film.id);
  const batchCamps = camps.filter(c => (c.batch || film.batch) === film.batch && c.status !== 'Draft');

  const bud = (film.brief?.budget || '1800000');
  const filmBudget = +String(bud).replace(/[^\d]/g, '') || 1800000;
  const domain = film.brief?.domain || 'AI/ML';
  const dur = film.brief?.duration || '16 weeks';

  let committed = 0, spent = 0, reach = 0, clicks = 0, regs = 0, enrols = 0, unattr = 11, posts = 0;
  batchCamps.forEach(c => {
    const st = HQ.campStats(c);
    committed += (c.spent || 0) + 180000;
    spent += c.spent || 0;
    reach += (st.views || 0) + 200000;
    clicks += st.clicks || 0;
    regs += st.regs || 0;
    enrols += st.enrols || 0;
    posts += st.posts || 0;
  });

  const target = +film.brief?.intakeTarget || 300;
  const ceiling = +film.brief?.costCeiling || 4500;
  const cpe = enrols ? Math.round(spent / enrols) : 3206;

  // Alerts
  const alerts = [];
  if (rd.missing.length) {
    alerts.push({
      title: 'Brief is missing ' + rd.missing.length + ' required field' + (rd.missing.length > 1 ? 's' : ''),
      sub: rd.missing.map(m => m.label).join(', ') + ' · programme reads are blocked',
      cta: 'Complete brief',
      go: () => go('brief'),
      dot: 'var(--danger-600)'
    });
  }

  camps.filter(c => c.status === 'Live').forEach(c => {
    const cp = (c.checkpoints || []).filter(k => k.verdict).slice(-1)[0];
    if (cp && cp.verdict === 'Behind') {
      alerts.push({
        title: c.name + ' is Behind at ' + cp.label,
        sub: `${c.name} · ${cp.note || '63 enrolments vs band 78–118'}`,
        cta: 'Open Insights',
        go: () => go('campaign', { id: c.id, tab: 'insights' }),
        dot: 'var(--danger-600)'
      });
    }
    (c.alerts || []).filter(a => !a.dismissed).forEach(a => {
      alerts.push({
        title: (a.rule === 'RR-H05' ? 'Enrolment rate below floor' : 'Scepticism alert') + ' · ' + c.name,
        sub: a.note || a.title || 'Placement-doubt share at 22% of comments on Instagram. Consider an alumni testimonial.',
        cta: 'Review',
        go: () => go('campaign', { id: c.id, tab: 'insights' }),
        dot: 'var(--warning-600)'
      });
    });
    (c.ccs || []).filter(x => x.late && !x.posts.length).forEach(x => {
      alerts.push({
        title: (HQ.creator(x.creatorId)?.name || 'Source') + ' is past the post date',
        sub: c.name + ' · due ' + HQ.ds(x.deal?.end),
        cta: 'Open source',
        go: () => go('influencer', { campId: c.id, ccId: x.id, tab: 'posts' }),
        dot: 'var(--warning-600)'
      });
    });
  });

  s.connectors.filter(c => c.status === 'Expiring').forEach(c => {
    alerts.push({
      title: c.name + ' token expires in 6 days',
      sub: 'Instagram and Facebook tracking stops on 12 Oct',
      cta: 'Reconnect',
      go: () => go('settings', { tab: 'connectors' }),
      dot: 'var(--warning-600)'
    });
  });

  const fmax = Math.max(reach, 1);
  const fH = (v) => Math.max(8, Math.round(Math.pow(v / fmax, 0.32) * 100));
  const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + '%' : '—');

  const funnel = [
    { l: 'Reach', v: HQ.n(reach || 620000), rate: 'Inferred where no API', h: 100, c: 'var(--teal-100)', stamp: 'Observed where platform API provides, otherwise Inferred' },
    { l: 'Clicks', v: HQ.n(clicks || 19200), rate: 'CTR ' + pct(clicks || 19200, reach || 620000), h: 68, c: 'var(--teal-300)', stamp: 'Observed · tracked link clicks' },
    { l: 'Registrations', v: HQ.n(regs || 1928), rate: pct(regs || 1928, clicks || 19200) + ' of clicks', h: 42, c: 'var(--teal-600)', stamp: 'Observed · Resolence LMS registration records' },
    { l: 'Enrolments', v: String(enrols || 126), rate: pct(enrols || 126, regs || 1928) + ' of registrations', h: 22, c: 'var(--teal-800)', stamp: 'Observed · screening enrolments confirmed' }
  ];

  const reads = [
    {
      key: 'public',
      title: 'Cohort demand and aspirations',
      status: running.public ? 'Running' : 'Ready',
      st: HQ.tone(running.public ? 'Running' : 'Ready'),
      date: 'Updated ' + HQ.d('2026-10-04'),
      items: [
        { t: 'High demand for AI tools in final year projects across Warangal engineering colleges', stamp: 'Observed', src: 'College forum posts' },
        { t: 'Salary anxiety dominant; students prioritize verified job placement credentials over theory', stamp: 'Inferred', src: 'Comment sentiment' }
      ]
    },
    {
      key: 'audience',
      title: 'Competing programmes and employers',
      status: running.audience ? 'Running' : 'Ready',
      st: HQ.tone(running.audience ? 'Running' : 'Ready'),
      date: 'Updated ' + HQ.d('2026-10-05'),
      items: [
        { t: 'Three private edtechs advertising ₹25K–₹45K paid bootcamps in same target districts', stamp: 'Observed', src: 'Ad library' },
        { t: 'Zero-fee government sponsored angle provides massive competitive edge', stamp: 'Inferred', src: 'Comparison analysis' }
      ]
    },
    {
      key: 'risk',
      title: 'What could go wrong',
      status: running.risk ? 'Running' : 'Ready',
      st: HQ.tone(running.risk ? 'Running' : 'Ready'),
      date: 'Updated ' + HQ.d('2026-10-06'),
      items: [
        { t: 'High scepticism on 85% placement claims without third-party audit evidence attached', stamp: 'Warning', src: 'RR-H03 rule check' },
        { t: 'Meme channels driving click spikes without qualification matching', stamp: 'Observed', src: 'Channel telemetry' }
      ]
    }
  ];

  const distRows = [
    { cohort: 'Engineering graduates 2023–2026', districts: 'Warangal, Karimnagar', clicks: '14,250', regs: '1,420', enrols: '63', rate: '4.4%', cpe: '₹3,857' },
    { cohort: 'Final-year CSE and IT students', districts: 'Hyderabad, Medak', clicks: '4,950', regs: '508', enrols: '63', rate: '12.4%', cpe: '₹2,100' }
  ];

  const activityFeed = [
    { icon: 'i-spark', text: 'Day 14 checkpoint generated for Warangal engineering graduates', t: 'Today at 09:00' },
    { icon: 'i-check', text: 'Resolence sync completed: 126 confirmed screening enrolments', t: 'Today at 08:00' },
    { icon: 'i-play', text: 'New post delivered by Coding with Sravani on Instagram Reels', t: 'Yesterday at 17:30' },
    { icon: 'i-upload', text: 'TASK MoU institutional verification uploaded to course brief', t: '3 Oct at 14:15' }
  ];

  const handleRerunRead = (key, title) => {
    setRunning(r => ({ ...r, [key]: true }));
    toast(`Re-running "${title}"...`);
    setTimeout(() => {
      setRunning(r => ({ ...r, [key]: false }));
      toast(`"${title}" analysis updated.`);
    }, 2000);
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
          <span style={{ fontSize: '10px', color: 'var(--ink-300)' }}>{film.batch || 'Batch 4'}</span>
          <span style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.2 }}>{film.title}</span>
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
              {film.provider || 'Nexa Skills Foundation'}
            </span>
          </div>

          <h1 style={{ margin: '0 0 4px', fontSize: '32px', lineHeight: '40px', fontWeight: 600, letterSpacing: '-.015em' }}>
            {film.title}
          </h1>

          <div style={{ color: 'var(--ink-600)', fontSize: '14px' }}>
            {`${film.batch || 'Batch 4'} · ${domain} · Intermediate · ${dur} · Hybrid (3 days in centre) · batch starts ${HQ.d(film.release)}`}
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
              const rd = HQ.readiness ? HQ.readiness(film) : { refused: false, missing: [] };
              if (rd.refused || (rd.missing && rd.missing.length)) {
                HQ.toast(
                  rd.refused
                    ? `Blocked: a governance flag is Refused for ${film.title}`
                    : rd.noRegLink
                    ? 'Add the Resolence registration link to the brief first'
                    : 'Complete the 9 required brief fields first',
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
            <span style={{ fontSize: '28px', lineHeight: '32px', fontWeight: 600 }}>{rd.ok}/{rd.total}</span>
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
            {enrols} / {target}
          </div>
          <div style={{ height: '8px', borderRadius: '999px', background: 'var(--ink-100)', overflow: 'hidden', marginTop: '10px' }}>
            <div style={{ height: '100%', width: `${Math.min(100, Math.round((enrols / target) * 100))}%`, background: 'var(--teal-700)', borderRadius: '999px' }}></div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '8px' }}>
            {unattr} unattributed · Observed · Resolence 08:00
          </div>
        </div>

        {/* Card 3: Cost per Enrolment */}
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
          <div style={{ fontSize: '13px', color: 'var(--ink-600)', marginBottom: '6px' }}>Cost per enrolment</div>
          <div style={{ fontSize: '28px', lineHeight: '32px', fontWeight: 600, letterSpacing: '-.01em', color: 'var(--ink-900)' }}>
            {HQ.inr(cpe)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '8px' }}>
            Ceiling {HQ.inr(ceiling)} · within ceiling
          </div>
        </div>

        {/* Card 4: Spend */}
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--e-1)' }}>
          <div style={{ fontSize: '13px', color: 'var(--ink-600)', marginBottom: '6px' }}>Spend</div>
          <div style={{ fontSize: '28px', lineHeight: '32px', fontWeight: 600, letterSpacing: '-.01em', color: 'var(--ink-900)' }}>
            {HQ.inrL(spent)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '8px' }}>
            {HQ.inrL(committed)} committed of {HQ.inrL(filmBudget)}
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
              <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{film.batch || 'Batch 4'} · {batchCamps.length} campaigns · {posts} tracked posts</span>
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
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '23px', color: 'var(--ink-800)' }}>
              Comments across Warangal content focus on stipend certainty ("Stipend nijamga istara?") and batch timing. Candidates responding to placement-cell broadcasts register within 48 hours; social media meme posts trigger questions on job placement guarantees.
            </p>
          </div>

          {/* Campaigns at a Glance Table */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)' }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ fontSize: '16px' }}>Campaigns at a glance</b>
              <button onClick={() => go('campaigns')} style={{ border: 0, background: 'none', color: 'var(--teal-700)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                View all
              </button>
            </div>
            {camps.map(c => {
              const st = HQ.campStats(c);
              const isBehind = c.checkpoints?.some(k => k.verdict === 'Behind');
              const isAhead = c.checkpoints?.some(k => k.verdict === 'Ahead');
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
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{c.cohort || c.markets?.join(', ')}</span>
                  </span>

                  <span>
                    <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--ink-600)', marginBottom: '6px' }}>
                      <span>Enrolments</span>
                      <b style={{ color: 'var(--ink-900)' }}>{st.enrols} / {c.targetEnrolments || 120}</b>
                    </span>
                    <span style={{ display: 'block', position: 'relative', height: '8px', borderRadius: '999px', background: 'var(--ink-100)' }}>
                      <span style={{ position: 'absolute', left: 0, width: `${Math.min(100, Math.round((st.enrols / (c.targetEnrolments || 120)) * 100))}%`, top: 0, bottom: 0, background: 'var(--teal-700)', borderRadius: '999px' }}></span>
                    </span>
                  </span>

                  <span style={{ textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: vBg, color: vColor, fontSize: '12px', fontWeight: 600 }}>
                      {verdict}
                    </span>
                  </span>
                </button>
              );
            })}
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
                  {distRows.map((d, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--ink-100)' }}>
                      <td style={{ padding: '10px 20px', fontWeight: 600 }}>{d.cohort}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--ink-600)' }}>{d.districts}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{d.clicks}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{d.regs}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{d.enrols}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{d.rate}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right' }}>{d.cpe}</td>
                    </tr>
                  ))}
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
              {reads.map((r2, idx) => (
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
                  {r2.items.map((it, j) => (
                    <div key={j} style={{ display: 'flex', gap: '8px', fontSize: '13px', lineHeight: '1.45' }}>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--ink-400)', marginTop: '8px', flex: 'none' }}></span>
                      <span style={{ flex: 1 }}>
                        {it.t}{' '}
                        <span title={it.src} style={{ display: 'inline-flex', height: '18px', padding: '0 6px', borderRadius: '4px', background: it.stamp === 'Observed' ? 'var(--info-100)' : it.stamp === 'Warning' ? 'var(--warning-100)' : 'var(--ink-50)', color: it.stamp === 'Observed' ? 'var(--info-800)' : it.stamp === 'Warning' ? 'var(--warning-800)' : 'var(--ink-700)', fontSize: '11px', fontWeight: 600, alignItems: 'center' }}>
                          {it.stamp}
                        </span>
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{r2.date}</span>
                    <button
                      onClick={() => handleRerunRead(r2.key, r2.title)}
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
              <div style={{ width: `${Math.round((spent / filmBudget) * 100)}%`, background: 'var(--teal-700)' }}></div>
              <div style={{ width: `${Math.round(((committed - spent) / filmBudget) * 100)}%`, background: 'var(--teal-300)' }}></div>
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
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{HQ.inrL(filmBudget - committed)}</div>
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
            {activityFeed.map((a, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px', padding: '10px 20px' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--ink-50)', color: 'var(--ink-600)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <Icon name={a.icon} size={15} />
                </span>
                <div style={{ flex: 1, fontSize: '13px' }}>
                  <div>{a.text}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{a.t}</div>
                </div>
              </div>
            ))}
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
              {(film.flags || []).map((g, idx) => (
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
              ))}
            </div>
          </div>
        </div>
      </div>

      {newCourseOpen && <NewCourseModal onClose={() => setNewCourseOpen(false)} />}
    </div>
  );
}
