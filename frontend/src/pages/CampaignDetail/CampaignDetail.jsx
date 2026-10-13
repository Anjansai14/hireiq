import React, { useState } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

export default function CampaignDetail() {
  const { state, HQ, go, toast } = useHQ();
  const campId = state.route.id || 'k1';
  const c = state.campaigns.find(k => k.id === campId) || state.campaigns[0];
  const tab = state.route.tab || 'overview';

  const [refreshing, setRefreshing] = useState(false);
  const [closed, setClosed] = useState(c.status === 'Closed');

  const stats = HQ.campStats(c);
  const isBehind = c.checkpoints?.some(k => k.verdict === 'Behind');

  const handleRefresh = () => {
    setRefreshing(true);
    toast('Fetching latest API telemetry from Meta, YouTube, and Resolence...');
    setTimeout(() => {
      setRefreshing(false);
      toast('Campaign metrics refreshed (as of today 09:30).');
    }, 1200);
  };

  const handleCloseCampaign = () => {
    setClosed(true);
    HQ.set(x => {
      const camp = x.campaigns.find(q => q.id === c.id);
      if (camp) camp.status = 'Closed';
    });
    toast(`${c.name} has been closed. Final metrics frozen.`);
  };

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div>
        <button
          onClick={() => go('campaigns')}
          style={{ border: 0, background: 'none', color: 'var(--ink-500)', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}
        >
          <Icon name="i-left" size={14} /> Campaigns
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 600, letterSpacing: '-.015em' }}>
                {c.name}
              </h1>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '24px',
                padding: '0 8px',
                borderRadius: '999px',
                background: closed ? 'var(--ink-100)' : 'var(--success-100)',
                color: closed ? 'var(--ink-700)' : 'var(--success-800)',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {closed ? 'Closed' : c.status}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', height: '24px', padding: '0 8px', borderRadius: '999px', background: 'var(--ink-50)', color: 'var(--ink-600)', fontSize: '12px', fontWeight: 600 }}>
                Plan v2
              </span>
            </div>

            <div style={{ color: 'var(--ink-600)', fontSize: '14px' }}>
              {`${c.cohort || 'Engineering graduates'} · ${c.objective} · KPI ${c.targetKPI || 'Screening enrolments'} (target ${c.targetEnrolments || 120}) · ${HQ.ds(c.start)} – ${HQ.ds(c.end)} · ${HQ.inrL(c.budget)} · ${c.markets?.join(', ')}`}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="i-refresh" size={16} />
              {refreshing ? 'Refreshing...' : 'Refresh metrics'}
            </button>
            <button
              onClick={() => toast('Exporting campaign audit CSV...')}
              style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="i-download" size={16} />
              Export
            </button>
            {!closed && (
              <button
                onClick={handleCloseCampaign}
                style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Close campaign
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--ink-100)', gap: '24px' }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'influencers', label: `Influencers (${c.ccs?.length || 0})` },
          { id: 'posts', label: 'Performance' },
          { id: 'insights', label: 'Insights', badge: '4' },
          { id: 'plan', label: 'Plan' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => go('campaign', { id: c.id, tab: t.id })}
            style={{
              border: 0,
              background: 'none',
              padding: '10px 0',
              fontSize: '14px',
              fontWeight: tab === t.id ? 600 : 500,
              color: tab === t.id ? 'var(--teal-800)' : 'var(--ink-600)',
              borderBottom: tab === t.id ? '2px solid var(--teal-600)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {t.label}
            {t.badge && (
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--danger-600)', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Day 14 Alert Banner */}
          {isBehind && (
            <div style={{ background: 'var(--danger-100)', border: '1px solid #F2C6BF', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Icon name="i-alert" size={22} style={{ color: 'var(--danger-600)' }} />
                <div>
                  <b style={{ color: 'var(--danger-800)', fontSize: '15px', display: 'block' }}>Behind at the Day 14 checkpoint</b>
                  <span style={{ color: 'var(--danger-800)', fontSize: '13px' }}>63 enrolments vs band 78–118. 4 suggested moves can close the gap.</span>
                </div>
              </div>
              <button
                onClick={() => go('campaign', { id: c.id, tab: 'insights' })}
                style={{ height: '36px', padding: '0 14px', borderRadius: '8px', border: '1px solid #E4A29B', background: '#fff', color: 'var(--danger-800)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                See causes and fixes
              </button>
            </div>
          )}

          {/* Campaign Summary Card */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--e-1)' }}>
            <b style={{ fontSize: '16px', display: 'block', marginBottom: '8px' }}>Campaign summary</b>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '22px', color: 'var(--ink-700)' }}>
              Comments on Warangal engineering graduates content are led by eligibility and schedule questions, with many viewers asking whether their graduation year qualifies and whether a weekend option exists. Posts from placement cells and alumni draw the most "registered" and "applying" replies, while job-alert style posts draw more doubt about placement outcomes. 18,790 tracked clicks have produced 1,928 registrations and 63 screening enrolments so far. Telugu and code-mixed comments outnumber English roughly three to one. Overall sentiment is positive, and the stipend is the most praised benefit.
            </p>
          </div>

          {/* 5 KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '16px' }}>
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '4px' }}>Screening enrolments</div>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{stats.enrols} / {c.targetEnrolments || 120}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px' }}>Range 105–160 (v1) · 7 unattributed</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '4px' }}>Registrations</div>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{HQ.n(stats.regs)}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px' }}>10.3% of clicks · enrol rate 3.3%</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '4px' }}>Tracked clicks</div>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{HQ.n(stats.clicks)}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px' }}>Reach 613K · CTR 1.78%</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '4px' }}>Cost per enrolment</div>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{HQ.inr(stats.cpe || 3857)}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px' }}>Ceiling ₹4,500 · range ₹3,400–₹5,100</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '4px' }}>Committed spend</div>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{HQ.inrL(c.spent)}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px' }}>₹2.4L spent · ₹8L budget</div>
            </div>
          </div>

          {/* Checkpoints Progress */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--e-1)' }}>
            <b style={{ fontSize: '16px', display: 'block', marginBottom: '14px' }}>Checkpoints</b>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
              {(c.checkpoints || []).map((cp, idx) => {
                const t = HQ.tone(cp.verdict || 'Pending');
                return (
                  <div key={idx} style={{ border: '1px solid var(--ink-100)', borderRadius: '10px', padding: '14px', background: 'var(--ink-25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <b style={{ fontSize: '14px' }}>{cp.label}</b>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: t.bg, color: t.fg }}>
                        {cp.verdict || 'Pending'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{cp.note}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Influencers Tab */}
      {tab === 'influencers' && (
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ink-100)' }}>
            <b style={{ fontSize: '16px' }}>Assigned creators & networks ({c.ccs?.length || 0})</b>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--ink-25)', color: 'var(--ink-600)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Source</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Platform</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Fee</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Clicks</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Enrols</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(c.ccs || []).map(cc => {
                  const cr = HQ.creator(cc.creatorId);
                  const st = HQ.ccStats(cc);
                  const t = HQ.tone(cc.status);
                  return (
                    <tr
                      key={cc.id}
                      style={{ borderTop: '1px solid var(--ink-100)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-25)'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <td style={{ padding: '12px 20px' }}>
                        <b style={{ display: 'block', fontWeight: 600 }}>{cr?.name}</b>
                        <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{cr?.handle}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>{cr?.platform}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '6px', background: t.bg, color: t.fg, fontSize: '11px', fontWeight: 600 }}>
                          {cc.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>{HQ.inr(cc.deal?.rate || 0)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>{HQ.n(st.clicks)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>{st.enrols}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => go('influencer', { campId: c.id, ccId: cc.id })}
                          style={{ border: 0, background: 'none', color: 'var(--teal-700)', fontWeight: 600, cursor: 'pointer' }}
                        >
                          View deal →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Posts Tab */}
      {tab === 'posts' && (
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ink-100)' }}>
            <b style={{ fontSize: '16px' }}>Delivered & scheduled posts</b>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--ink-25)', color: 'var(--ink-600)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Post Title</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Format</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Views</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Clicks</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Registrations</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Enrolments</th>
                </tr>
              </thead>
              <tbody>
                {(c.ccs || []).flatMap(cc => cc.posts || []).map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--ink-100)' }}>
                    <td style={{ padding: '12px 20px' }}>
                      <b style={{ display: 'block', fontWeight: 600 }}>{p.title}</b>
                      <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{p.url}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>{p.format}</td>
                    <td style={{ padding: '12px 14px' }}>{HQ.d(p.date)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{p.views ? HQ.n(p.views) : '—'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{HQ.n(p.clicks)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{HQ.n(p.regs)}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--teal-800)' }}>{p.enrols}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insights Tab */}
      {tab === 'insights' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--e-1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <b style={{ fontSize: '18px' }}>Day 14 Checkpoint Diagnosis</b>
              <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '4px', background: 'var(--danger-100)', color: 'var(--danger-800)' }}>
                Behind (Gap: 15 enrolments)
              </span>
            </div>

            <div style={{ padding: '14px 18px', borderRadius: '8px', background: 'var(--ink-50)', marginBottom: '20px', fontSize: '14px', lineHeight: '22px' }}>
              <b>Primary Root Cause:</b> Hyderabad Tech Jobs delivered 6,100 clicks with an engagement rate of 3.2%, but generated only 2 enrolments. 71% of viewers were based in Hyderabad, whereas this campaign is localized to Warangal district engineering colleges.
            </div>

            <b style={{ fontSize: '15px', display: 'block', marginBottom: '12px' }}>4 Recommended Moves to Close the Gap:</b>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(c.diagnosis?.moves || [
                'Shift remaining budget to KITS Warangal placement broadcast',
                'Post alumni FAQ addressing stipend eligibility doubts',
                'Fast-track Prof. Lakshmi Narayana syllabus walkthrough',
                'Throttle meme-page distribution with high clicks but 0.5% enrolment'
              ]).map((m, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--ink-200)', background: '#fff' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--teal-100)', color: 'var(--teal-800)', fontSize: '12px', fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 500, flex: 1 }}>{m}</span>
                  <button onClick={() => toast(`Move applied: ${m}`)} style={{ height: '30px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--teal-600)', background: '#fff', color: 'var(--teal-700)', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Plan Tab */}
      {tab === 'plan' && (
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--e-1)' }}>
          <b style={{ fontSize: '18px', display: 'block', marginBottom: '14px' }}>Plan Version History</b>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--ink-200)', background: 'var(--ink-25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <b>Plan v2 (Active)</b>
                <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Adopted 29 Sep 2026</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-600)' }}>Added KITS Warangal broadcast and expanded Sai Kiran Reddy deliverable to 2 posts.</p>
            </div>
            <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--ink-100)', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <b>Plan v1 (Initial Prediction)</b>
                <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Created 22 Sep 2026</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-600)' }}>Frozen prediction: 105–160 enrolments at ₹3,857 CPE.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
