import React, { useState } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

export default function Campaigns() {
  const { state, HQ, currentCourse, go } = useHQ();
  const [filter, setFilter] = useState('Live');
  const [search, setSearch] = useState('');

  const film = currentCourse;
  const allCamps = state.campaigns.filter(c => c.filmId === film.id);

  const filteredCamps = allCamps.filter(c => {
    if (filter !== 'All' && c.status !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const liveCount = allCamps.filter(c => c.status === 'Live').length;
  const draftCount = allCamps.filter(c => c.status === 'Draft').length;
  const closedCount = allCamps.filter(c => c.status === 'Closed').length;

  const handleOpenCampaign = (c) => {
    if (c.status === 'Draft') {
      go('wizard', { id: c.id });
    } else {
      go('campaign', { id: c.id });
    }
  };

  const handleCreateCampaign = () => {
    const draft = allCamps.find(c => c.status === 'Draft');
    if (draft) {
      go('wizard', { id: draft.id });
    } else {
      const newId = HQ.uid('k');
      HQ.set(x => {
        x.campaigns.push({
          id: newId,
          name: 'New campaign draft',
          status: 'Draft',
          filmId: film.id,
          batch: film.batch || 'Batch 4',
          objective: 'Getting onboarded',
          targetKPI: 'Screening enrolments',
          targetEnrolments: 50,
          costCeiling: 4500,
          budget: 300000,
          spent: 0,
          start: '2026-10-15',
          end: '2026-11-10',
          markets: ['Telangana'],
          cohort: 'Engineering graduates',
          checkpoints: [],
          diagnosis: { verdict: null, gap: 0, topCause: '', moves: [] },
          alerts: [],
          ccs: [],
          comments: [],
          wiz: {
            step: 0,
            done: [],
            answers: { q1: 'No', q2: 'No', q3: 'No' },
            focus: null,
            needs: [],
            targetEnrolments: 50,
            costCeiling: 4500,
            budget: 300000,
            qualification: 'B.Tech / B.E.',
            skill: 'CSE, IT, ECE',
            age: '21–26 years',
            exp: '0–2 years experience',
            lang: 'Telugu',
            channels: [
              { ch: 'YouTube', format: 'Long video', share: 45 },
              { ch: 'Instagram', format: 'Reels', share: 30 },
              { ch: 'LinkedIn', format: 'Posts', share: 15 },
              { ch: 'WhatsApp', format: 'Community broadcast', share: 10 }
            ],
            shortlist: []
          }
        });
      });
      go('wizard', { id: newId });
    }
  };

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '32px', fontWeight: 600, letterSpacing: '-.015em' }}>
            Campaigns
          </h1>
          <div style={{ color: 'var(--ink-600)', fontSize: '14px' }}>
            {film.title} · one cohort in one geography for one course batch
          </div>
        </div>

        <button
          onClick={handleCreateCampaign}
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

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', background: 'var(--ink-100)', padding: '3px', borderRadius: '10px', gap: '2px' }}>
          {[
            { id: 'Live', label: `Live ${liveCount}` },
            { id: 'Draft', label: `Draft ${draftCount}` },
            { id: 'Closed', label: `Closed ${closedCount}` },
            { id: 'All', label: 'All' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                height: '32px',
                padding: '0 12px',
                border: 0,
                borderRadius: '8px',
                background: filter === tab.id ? '#fff' : 'transparent',
                color: filter === tab.id ? 'var(--ink-900)' : 'var(--ink-600)',
                fontWeight: filter === tab.id ? 600 : 500,
                fontSize: '13px',
                boxShadow: filter === tab.id ? 'var(--e-1)' : 'none',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Icon name="i-search" size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--ink-400)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns"
            style={{ width: '100%', height: '40px', padding: '0 12px 0 36px', border: '1px solid var(--ink-200)', borderRadius: '8px', background: '#fff', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Campaigns Table */}
      <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--ink-25)', color: 'var(--ink-600)', textAlign: 'left', borderBottom: '1px solid var(--ink-100)' }}>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Campaign</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Objective</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Cohort</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Window</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Sources</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Enrolments</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Spend</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {filteredCamps.map((c, idx) => {
                const st = HQ.campStats(c);
                const isBehind = c.checkpoints?.some(k => k.verdict === 'Behind');
                const isAhead = c.checkpoints?.some(k => k.verdict === 'Ahead');
                const vColor = isBehind ? 'var(--danger-800)' : isAhead ? 'var(--success-800)' : 'var(--ink-700)';
                const vBg = isBehind ? 'var(--danger-100)' : isAhead ? 'var(--success-100)' : 'var(--ink-100)';
                const verdict = isBehind ? 'Behind' : isAhead ? 'Ahead' : c.status === 'Draft' ? 'Draft' : 'On track';
                return (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenCampaign(c)}
                    style={{ borderTop: idx > 0 ? '1px solid var(--ink-100)' : 0, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-25)'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <b style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-900)' }}>{c.name}</b>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: '20px',
                          padding: '0 6px',
                          borderRadius: '999px',
                          background: c.status === 'Live' ? 'var(--success-100)' : 'var(--ink-100)',
                          color: c.status === 'Live' ? 'var(--success-800)' : 'var(--ink-700)',
                          fontSize: '11px',
                          fontWeight: 600
                        }}>
                          {c.status}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                        {c.batch || 'v2'} · Anika Rao · {c.markets?.join(', ') || 'Telangana'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 14px', color: 'var(--ink-700)' }}>
                      {c.objective || 'Getting onboarded'}
                    </td>

                    <td style={{ padding: '14px 14px', color: 'var(--ink-700)' }}>
                      {c.cohort || c.markets?.join(', ')}
                    </td>

                    <td style={{ padding: '14px 14px', color: 'var(--ink-600)', whiteSpace: 'nowrap' }}>
                      {HQ.ds(c.start)} – {HQ.ds(c.end)}
                    </td>

                    <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: 600 }}>
                      {c.ccs?.length || 0}
                    </td>

                    <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                      <b style={{ fontWeight: 600 }}>{st.enrols} / {c.targetEnrolments || 60}</b>
                      <div style={{ height: '4px', width: '80px', borderRadius: '2px', background: 'var(--ink-100)', marginTop: '4px', marginLeft: 'auto', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, Math.round((st.enrols / (c.targetEnrolments || 60)) * 100))}%`, background: 'var(--teal-700)' }}></div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                      <span>{HQ.inrL(c.spent)} / {HQ.inrL(c.budget)}</span>
                      <div style={{ height: '4px', width: '80px', borderRadius: '2px', background: 'var(--ink-100)', marginTop: '4px', marginLeft: 'auto', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, Math.round((c.spent / c.budget) * 100))}%`, background: 'var(--teal-700)' }}></div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: '22px',
                        padding: '0 8px',
                        borderRadius: '999px',
                        background: vBg,
                        color: vColor,
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        {verdict}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
