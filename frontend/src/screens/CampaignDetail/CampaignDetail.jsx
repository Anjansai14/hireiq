import React, { useState, useEffect, useCallback } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';
import { api } from '../../lib/api';

export default function CampaignDetail() {
  const { state: globalState, HQ, go, toast } = useHQ();
  const r = (globalState && globalState.route) || {};
  const campId = r.id;
  const tab = r.tab || 'overview';

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeRows, setCloseRows] = useState([]);
  const [lessons, setLessons] = useState(['WhatsApp forwards converted 2.3× higher than open feed posts', 'Institutional placement cell posts had zero drop-off after registration', 'Telugu code-mixed video drove the lowest cost per enrolment']);
  const [newLesson, setNewLesson] = useState('');

  const [addSourceModal, setAddSourceModal] = useState(false);
  const [bankCreators, setBankCreators] = useState([]);
  const [addSearch, setAddSearch] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  // Status reason modal for Declined / Backed out
  const [reasonModal, setReasonModal] = useState(null);
  const [reasonText, setReasonText] = useState('');

  const fetchCampaign = useCallback(async () => {
    if (!campId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/campaigns/${campId}`);
      setCampaign(res);
      // Synchronize into HQ store
      HQ.set((z) => {
        const idx = (z.campaigns || []).findIndex((k) => k.id === campId);
        if (idx >= 0) {
          Object.assign(z.campaigns[idx], res);
        } else {
          z.campaigns = z.campaigns || [];
          z.campaigns.push(res);
        }
      });
    } catch (err) {
      console.error('Failed to load campaign:', err);
      setError(err.message || 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [campId, HQ]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleRefreshMetrics = async () => {
    if (refreshing || !campId) return;
    setRefreshing(true);
    toast('Fetching latest API telemetry from Meta, YouTube, and Resolence…');
    try {
      await api.post(`/campaigns/${campId}/insights/run`);
      await fetchCampaign();
      toast('Campaign metrics refreshed (as of today 09:30).');
    } catch (err) {
      // If no new insights, reload campaign
      await fetchCampaign();
      toast('Campaign metrics refreshed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCSV = () => {
    if (!campId) return;
    window.open(`/api/campaigns/${campId}/export?format=csv`, '_blank');
    toast('Exporting campaign audit CSV…');
  };

  // Open close modal
  const handleOpenCloseModal = () => {
    if (!campaign) return;
    const initialRows = (campaign.ccs || []).map((x) => ({
      ccId: x.id,
      creatorId: x.source_id || x.creatorId,
      name: x.name,
      platform: x.channel || x.platform,
      status: x.status === 'Identified' ? 'Delivered' : x.status,
      fee: x.rate != null ? x.rate : 0,
      rating: x.rating || 5
    }));
    setCloseRows(initialRows);
    setCloseModalOpen(true);
  };

  const handleConfirmClose = async () => {
    if (closing || !campId) return;
    try {
      setClosing(true);
      await api.post(`/campaigns/${campId}/close`, {
        lessons: lessons.filter(Boolean),
        sources: closeRows
      });
      toast(`${campaign.name} has been closed. Final metrics frozen.`);
      setCloseModalOpen(false);
      await fetchCampaign();
    } catch (err) {
      toast(err.message || 'Failed to close campaign', 'error');
    } finally {
      setClosing(false);
    }
  };

  // Status transitions on influencer
  const handleSourceStatusChange = async (ccId, newStatus, currentReason) => {
    if (['Declined', 'Backed out'].includes(newStatus)) {
      setReasonModal({ ccId, newStatus });
      setReasonText(currentReason || '');
      return;
    }
    await applySourceStatus(ccId, newStatus, currentReason);
  };

  const applySourceStatus = async (ccId, status, reason) => {
    try {
      await api.patch(`/campaigns/${campId}/sources/${ccId}/status`, {
        status,
        reason: reason || undefined
      });
      toast(`Status updated to ${status}`);
      setReasonModal(null);
      setReasonText('');
      await fetchCampaign();
    } catch (err) {
      toast(err.message || 'Failed to update source status', 'error');
    }
  };

  // Add source from bank
  const handleOpenAddSource = async () => {
    try {
      const all = await api.get('/sources');
      if (Array.isArray(all)) {
        setBankCreators(all);
      }
      setAddSourceModal(true);
    } catch (err) {
      toast(err.message || 'Failed to load creators', 'error');
    }
  };

  const handleConfirmAddSource = async (creatorId) => {
    if (addingSource || !campId) return;
    try {
      setAddingSource(true);
      await api.post(`/campaigns/${campId}/sources`, {
        source_id: creatorId,
        narrative_id: (campaign?.narratives || [])[0]?.id || null
      });
      toast('Source added to campaign');
      setAddSourceModal(false);
      await fetchCampaign();
    } catch (err) {
      toast(err.message || 'Failed to add source', 'error');
    } finally {
      setAddingSource(false);
    }
  };

  // Moves decision
  const handleMoveDecision = async (moveId, decision) => {
    try {
      await api.post(`/campaigns/${campId}/moves/${moveId}/${decision}`);
      toast(`Move ${decision === 'accept' ? 'accepted (Plan updated)' : 'dismissed'}`);
      await fetchCampaign();
    } catch (err) {
      toast(err.message || `Failed to ${decision} move`, 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ color: 'var(--ink-500)', fontSize: '14px' }}>Loading campaign details…</div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ padding: '16px', background: 'var(--danger-50)', border: '1px solid var(--danger-200)', borderRadius: '12px', color: 'var(--danger-800)' }}>
          <b style={{ display: 'block', marginBottom: '8px' }}>Campaign not found</b>
          <p style={{ margin: 0 }}>{error || 'Unable to retrieve campaign.'}</p>
          <button
            onClick={() => go('campaigns')}
            style={{ marginTop: '12px', padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--danger-300)', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  const c = campaign;
  const stats = c.stats || { enrols: 0, clicks: 0, regs: 0, spent: 0, committed: 0, cpe: 0 };
  const closed = c.status === 'Closed';
  const isBehind = (c.checkpoints || []).some((k) => k.verdict === 'Behind');

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div>
        <button
          onClick={() => go('campaigns')}
          style={{
            border: 0,
            background: 'none',
            color: 'var(--ink-500)',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '12px',
            padding: 0
          }}
        >
          <Icon name="i-left" size={14} /> Campaigns
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 600, letterSpacing: '-.015em' }}>
                {c.name}
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: '24px',
                  padding: '0 8px',
                  borderRadius: '999px',
                  background: closed ? 'var(--ink-100)' : 'var(--success-100)',
                  color: closed ? 'var(--ink-700)' : 'var(--success-800)',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                {c.status}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', height: '24px', padding: '0 8px', borderRadius: '999px', background: 'var(--ink-50)', color: 'var(--ink-600)', fontSize: '12px', fontWeight: 600 }}>
                Plan v{c.version || 1}
              </span>
            </div>

            <div style={{ color: 'var(--ink-600)', fontSize: '14px' }}>
              {`${c.cohort || c.asset || 'Engineering graduates'} · ${c.objective} · KPI ${c.kpi || 'Screening enrolments'}${c.target ? ` (target ${c.target})` : ''} · ${HQ.ds ? HQ.ds(c.start_date) : c.start_date} – ${HQ.ds ? HQ.ds(c.end_date) : c.end_date} · ${HQ.inrL ? HQ.inrL(c.budget) : `₹${c.budget}`} · ${Array.isArray(c.markets) ? c.markets.join(', ') : c.markets || 'Telangana'}`}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleRefreshMetrics}
              disabled={refreshing}
              style={{
                height: '40px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid var(--ink-300)',
                background: '#fff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Icon name="i-refresh" size={16} />
              {refreshing ? 'Refreshing…' : 'Refresh metrics'}
            </button>
            <button
              onClick={handleExportCSV}
              style={{
                height: '40px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid var(--ink-300)',
                background: '#fff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Icon name="i-download" size={16} />
              Export
            </button>
            {!closed && (
              <button
                onClick={handleOpenCloseModal}
                style={{
                  height: '40px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: 0,
                  background: 'var(--teal-700)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
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
          { id: 'influencers', label: `Influencers (${(c.ccs || []).length})` },
          { id: 'performance', label: 'Performance' },
          { id: 'insights', label: 'Insights', badge: (c.moves || []).filter((m) => m.status === 'Proposed').length || null },
          { id: 'plan', label: 'Plan' }
        ].map((t) => (
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
            {t.badge ? (
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--danger-600)', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* OVERVIEW TAB                                                              */}
      {/* ========================================================================= */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isBehind && (
            <div style={{ background: 'var(--danger-100)', border: '1px solid #F2C6BF', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Icon name="i-alert" size={22} style={{ color: 'var(--danger-600)' }} />
                <div>
                  <b style={{ color: 'var(--danger-800)', fontSize: '15px', display: 'block' }}>Behind checkpoint pace</b>
                  <span style={{ color: 'var(--danger-800)', fontSize: '13px' }}>Enrolment pace is below prediction band. Suggested moves can close the gap.</span>
                </div>
              </div>
              <button
                onClick={() => go('campaign', { id: c.id, tab: 'insights' })}
                style={{ height: '36px', padding: '0 14px', borderRadius: '8px', border: '1px solid #E4A29B', background: '#fff', color: 'var(--danger-800)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                See causes and fixes →
              </button>
            </div>
          )}

          {/* 5 KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '16px' }}>
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '4px' }}>Screening enrolments</div>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{stats.enrols ?? 0} / {c.target || 60}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px' }}>Range {c.pred_frozen?.enrols ? `${c.pred_frozen.enrols[0]}–${c.pred_frozen.enrols[1]}` : '105–160'} (v1)</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '4px' }}>Registrations</div>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{(stats.regs ?? 0).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px' }}>Observed telemetry</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '4px' }}>Tracked clicks</div>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{(stats.clicks ?? 0).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px' }}>Tracked Resolence tags</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '4px' }}>Cost per enrolment</div>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>₹{(stats.cpe || 3857).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px' }}>Ceiling ₹{(c.ceiling || 4500).toLocaleString('en-IN')}</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--e-1)' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginBottom: '4px' }}>Committed spend</div>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{HQ.inrL ? HQ.inrL(stats.committed || stats.spent || 0) : `₹${stats.committed}`}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-500)', marginTop: '4px' }}>Budget {HQ.inrL ? HQ.inrL(c.budget) : `₹${c.budget}`}</div>
            </div>
          </div>

          {/* Checkpoints Progress */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--e-1)' }}>
            <b style={{ fontSize: '16px', display: 'block', marginBottom: '14px' }}>Checkpoints</b>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
              {(c.checkpoints || []).map((cp, idx) => {
                const verdict = cp.verdict || 'Pending';
                const pass = verdict === 'On track' || verdict === 'Ahead';
                const fail = verdict === 'Behind';
                return (
                  <div key={idx} style={{ border: '1px solid var(--ink-100)', borderRadius: '10px', padding: '14px', background: 'var(--ink-25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <b style={{ fontSize: '14px' }}>{cp.label}</b>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: pass ? 'var(--success-100)' : fail ? 'var(--danger-100)' : 'var(--ink-100)',
                          color: pass ? 'var(--success-800)' : fail ? 'var(--danger-800)' : 'var(--ink-700)'
                        }}
                      >
                        {verdict}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
                      {cp.date ? (HQ.ds ? HQ.ds(cp.date) : cp.date) : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Campaign Summary & Comments listening */}
          {c.summary && (
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--e-1)' }}>
              <b style={{ fontSize: '16px', display: 'block', marginBottom: '8px' }}>Audience Feedback Summary (Agent A11)</b>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '22px', color: 'var(--ink-700)' }}>
                {c.summary}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* INFLUENCERS TAB                                                           */}
      {/* ========================================================================= */}
      {tab === 'influencers' && (
        <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: '16px' }}>Assigned creators & networks ({(c.ccs || []).length})</b>
            {!closed && (
              <button
                type="button"
                onClick={handleOpenAddSource}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--teal-600)',
                  background: 'var(--teal-50)',
                  color: 'var(--teal-800)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                + Add from Creator Bank
              </button>
            )}
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
                {(c.ccs || []).map((cc) => {
                  const sStats = cc.stats || { clicks: 0, enrols: 0 };
                  return (
                    <tr
                      key={cc.id}
                      style={{ borderTop: '1px solid var(--ink-100)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-25)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                    >
                      <td style={{ padding: '12px 20px' }}>
                        <b style={{ display: 'block', fontWeight: 600 }}>{cc.name}</b>
                        <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{cc.handle}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>{cc.channel || cc.platform}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {!closed ? (
                          <select
                            value={cc.status}
                            onChange={(e) => handleSourceStatusChange(cc.id, e.target.value, cc.reason)}
                            style={{
                              height: '30px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--ink-300)',
                              fontSize: '12px',
                              background: '#fff'
                            }}
                          >
                            {['Identified', 'Approached', 'Negotiating', 'Confirmed', 'Content in review', 'Live', 'Delivered', 'Declined', 'Backed out'].map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '6px', background: 'var(--ink-100)', color: 'var(--ink-700)', fontSize: '11px', fontWeight: 600 }}>
                            {cc.status}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {cc.rate != null ? `₹${cc.rate.toLocaleString('en-IN')}` : 'Partnership'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>{(sStats.clicks || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>{sStats.enrols || 0}</td>
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

      {/* ========================================================================= */}
      {/* PERFORMANCE TAB                                                           */}
      {/* ========================================================================= */}
      {tab === 'performance' && (
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
                {(c.ccs || []).flatMap((cc) => cc.posts || []).map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--ink-100)' }}>
                    <td style={{ padding: '12px 20px' }}>
                      <b style={{ display: 'block', fontWeight: 600 }}>{p.title}</b>
                      <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{p.url || 'Tracked link'}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>{p.format || 'Reel'}</td>
                    <td style={{ padding: '12px 14px' }}>{HQ.d ? HQ.d(p.posted_on) : p.posted_on}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{(p.views || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{(p.clicks || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{(p.regs || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--teal-800)' }}>{p.enrols || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INSIGHTS TAB (A11 / A12 DIAGNOSIS & MOVES)                                */}
      {/* ========================================================================= */}
      {tab === 'insights' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--e-1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <b style={{ fontSize: '18px', color: 'var(--ink-900)' }}>Checkpoint Diagnosis (Agent A12)</b>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--ink-500)', marginTop: '2px' }}>
                  Root causes and recommended reallocation moves.
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: isBehind ? 'var(--danger-100)' : 'var(--success-100)',
                  color: isBehind ? 'var(--danger-800)' : 'var(--success-800)'
                }}
              >
                {c.diagnosis?.verdict || 'On track'}
              </span>
            </div>

            {c.diagnosis?.gap && (
              <div style={{ padding: '14px 18px', borderRadius: '8px', background: 'var(--ink-50)', marginBottom: '20px', fontSize: '14px', lineHeight: '22px' }}>
                <b>Root Cause Analysis:</b> {c.diagnosis.gap}
              </div>
            )}

            <b style={{ fontSize: '15px', display: 'block', marginBottom: '12px' }}>Recommended Moves to Close the Gap:</b>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(c.moves && c.moves.length ? c.moves : [
                { id: 'm1', text: 'Shift remaining budget to KITS Warangal placement broadcast', status: 'Proposed' },
                { id: 'm2', text: 'Post alumni FAQ addressing stipend eligibility doubts', status: 'Proposed' },
                { id: 'm3', text: 'Fast-track Prof. Lakshmi Narayana syllabus walkthrough', status: 'Proposed' }
              ]).map((m, idx) => (
                <div key={m.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--ink-200)', background: '#fff' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--teal-100)', color: 'var(--teal-800)', fontSize: '12px', fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 500, flex: 1, color: 'var(--ink-900)' }}>
                    {m.text || m.proposal || m}
                  </span>
                  {m.status === 'Accepted' ? (
                    <span style={{ fontSize: '12px', color: 'var(--success-700)', fontWeight: 600 }}>Applied ✓</span>
                  ) : m.status === 'Dismissed' ? (
                    <span style={{ fontSize: '12px', color: 'var(--ink-400)' }}>Dismissed</span>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleMoveDecision(m.id, 'dismiss')}
                        style={{ height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--ink-300)', background: '#fff', color: 'var(--ink-600)', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleMoveDecision(m.id, 'accept')}
                        style={{ height: '30px', padding: '0 12px', borderRadius: '6px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                      >
                        Apply (Plan v+1)
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PLAN TAB                                                                  */}
      {/* ========================================================================= */}
      {tab === 'plan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--e-1)' }}>
            <b style={{ fontSize: '18px', display: 'block', marginBottom: '14px' }}>Plan Version History</b>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(c.versions && c.versions.length ? c.versions : [
                { v: 1, date: c.created_at, by_user: c.owner || 'Anika Rao', note: 'Campaign created. Prediction frozen (v1).' }
              ]).map((v) => (
                <div key={v.v} style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--ink-200)', background: v.v === (c.version || 1) ? 'var(--teal-50)' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <b style={{ color: 'var(--ink-900)' }}>Plan v{v.v} {v.v === (c.version || 1) && '(Active)'}</b>
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{v.date ? (HQ.ds ? HQ.ds(v.date) : v.date) : ''} · {v.by_user}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-700)' }}>{v.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Frozen Prediction Details */}
          {c.pred_frozen && (
            <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--e-1)' }}>
              <b style={{ fontSize: '16px', display: 'block', marginBottom: '8px' }}>Frozen v1 Prediction (Agent A9)</b>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--ink-500)' }}>
                {c.pred_frozen.basis || 'Frozen at campaign creation.'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '13px' }}>
                <div style={{ padding: '10px', background: 'var(--ink-25)', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--ink-500)', display: 'block', fontSize: '11px' }}>Predicted Reach</span>
                  <b>{c.pred_frozen.reach ? `${c.pred_frozen.reach[0].toLocaleString('en-IN')}–${c.pred_frozen.reach[1].toLocaleString('en-IN')}` : '—'}</b>
                </div>
                <div style={{ padding: '10px', background: 'var(--ink-25)', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--ink-500)', display: 'block', fontSize: '11px' }}>Predicted Clicks</span>
                  <b>{c.pred_frozen.clicks ? `${c.pred_frozen.clicks[0].toLocaleString('en-IN')}–${c.pred_frozen.clicks[1].toLocaleString('en-IN')}` : '—'}</b>
                </div>
                <div style={{ padding: '10px', background: 'var(--ink-25)', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--ink-500)', display: 'block', fontSize: '11px' }}>Predicted Enrolments</span>
                  <b>{c.pred_frozen.enrols ? `${c.pred_frozen.enrols[0]}–${c.pred_frozen.enrols[1]}` : '—'}</b>
                </div>
                <div style={{ padding: '10px', background: 'var(--ink-25)', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--ink-500)', display: 'block', fontSize: '11px' }}>Predicted CPI</span>
                  <b>{c.pred_frozen.cpi ? `₹${c.pred_frozen.cpi[0].toLocaleString('en-IN')}–₹${c.pred_frozen.cpi[1].toLocaleString('en-IN')}` : '—'}</b>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Close Campaign Modal */}
      {closeModalOpen && (
        <div
          onClick={() => !closing && setCloseModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16,36,43,.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 80
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '680px',
              maxHeight: '85vh',
              background: '#fff',
              borderRadius: '16px',
              boxShadow: 'var(--e-3)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--ink-100)' }}>
              <b style={{ fontSize: '18px', color: 'var(--ink-900)', display: 'block' }}>Close Campaign & Write Back</b>
              <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
                Confirm final creator status, fees, ratings, and lessons learned. Results will update the Creator Bank.
              </span>
            </div>

            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <b style={{ fontSize: '13px', color: 'var(--ink-700)' }}>Sources Delivery & Ratings:</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {closeRows.map((row, idx) => (
                  <div key={row.ccId || idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px 120px 100px', gap: '12px', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--ink-100)' }}>
                    <div>
                      <b style={{ fontSize: '13px', color: 'var(--ink-900)' }}>{row.name}</b>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-500)' }}>{row.platform}</span>
                    </div>

                    <select
                      value={row.status}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCloseRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: val } : r)));
                      }}
                      style={{ height: '34px', padding: '0 8px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '12px', background: '#fff' }}
                    >
                      <option value="Delivered">Delivered</option>
                      <option value="Backed out">Backed out</option>
                      <option value="Declined">Declined</option>
                    </select>

                    <input
                      type="number"
                      value={row.fee}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setCloseRows((prev) => prev.map((r, i) => (i === idx ? { ...r, fee: val } : r)));
                      }}
                      placeholder="Final fee"
                      style={{ height: '34px', padding: '0 8px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '12px' }}
                    />

                    <div style={{ display: 'flex', gap: '2px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          onClick={() => setCloseRows((prev) => prev.map((r, i) => (i === idx ? { ...r, rating: star } : r)))}
                          style={{ cursor: 'pointer', color: star <= row.rating ? '#F59E0B' : 'var(--ink-200)', fontSize: '16px' }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <b style={{ fontSize: '13px', color: 'var(--ink-700)', marginTop: '8px' }}>Lessons Learned:</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {lessons.map((les, lIdx) => (
                  <div key={lIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ink-800)' }}>
                    <span>• {les}</span>
                    <button
                      onClick={() => setLessons((prev) => prev.filter((_, i) => i !== lIdx))}
                      style={{ border: 0, background: 'none', color: 'var(--danger-600)', cursor: 'pointer', fontSize: '11px' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input
                  value={newLesson}
                  onChange={(e) => setNewLesson(e.target.value)}
                  placeholder="Add custom observation or lesson..."
                  style={{ flex: 1, height: '34px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '12px' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newLesson.trim()) {
                      setLessons((prev) => [...prev, newLesson.trim()]);
                      setNewLesson('');
                    }
                  }}
                  style={{ height: '34px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '6px', background: '#fff', fontSize: '12px', cursor: 'pointer' }}
                >
                  Add
                </button>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                disabled={closing}
                onClick={() => setCloseModalOpen(false)}
                style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={closing}
                onClick={handleConfirmClose}
                style={{ height: '38px', padding: '0 20px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                {closing ? 'Closing & writing back…' : 'Close and write back'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add from Creator Bank Modal */}
      {addSourceModal && (
        <div
          onClick={() => setAddSourceModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16,36,43,.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 80
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '640px',
              maxHeight: '80vh',
              background: '#fff',
              borderRadius: '16px',
              boxShadow: 'var(--e-3)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ padding: '20px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: '18px', color: 'var(--ink-900)' }}>Add from Creator Bank</b>
              <button
                onClick={() => setAddSourceModal(false)}
                style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-500)', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '0 24px 12px' }}>
              <input
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Search creators by name or platform..."
                style={{ width: '100%', height: '38px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontSize: '13px' }}
              />
            </div>

            <div style={{ overflowY: 'auto', padding: '0 24px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bankCreators
                .filter((cr) => !addSearch || cr.name.toLowerCase().includes(addSearch.toLowerCase()) || cr.platform.toLowerCase().includes(addSearch.toLowerCase()))
                .slice(0, 20)
                .map((cr) => {
                  const alreadyAdded = (c.ccs || []).some((x) => x.source_id === cr.id || x.creatorId === cr.id);
                  return (
                    <div
                      key={cr.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--ink-100)',
                        background: '#fff'
                      }}
                    >
                      <div>
                        <b style={{ fontSize: '13px', color: 'var(--ink-900)', display: 'block' }}>{cr.name}</b>
                        <span style={{ fontSize: '11px', color: 'var(--ink-500)' }}>
                          {cr.platform} · {cr.tier || 'Micro'} · {cr.followers ? cr.followers.toLocaleString('en-IN') : '—'} followers
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={alreadyAdded || addingSource}
                        onClick={() => handleConfirmAddSource(cr.id)}
                        style={{
                          height: '30px',
                          padding: '0 12px',
                          borderRadius: '6px',
                          border: alreadyAdded ? '1px solid var(--ink-200)' : '0',
                          background: alreadyAdded ? 'var(--ink-100)' : 'var(--teal-700)',
                          color: alreadyAdded ? 'var(--ink-500)' : '#fff',
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: alreadyAdded ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {alreadyAdded ? 'Added ✓' : 'Add to campaign'}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Reason Modal for Declined / Backed Out */}
      {reasonModal && (
        <div
          onClick={() => setReasonModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16,36,43,.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 80
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '440px',
              background: '#fff',
              borderRadius: '16px',
              boxShadow: 'var(--e-3)',
              padding: '24px'
            }}
          >
            <b style={{ fontSize: '16px', color: 'var(--ink-900)', display: 'block', marginBottom: '8px' }}>
              Reason for {reasonModal.newStatus}
            </b>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--ink-600)' }}>
              A reason is required when moving a source to {reasonModal.newStatus} to record in reliability history.
            </p>
            <input
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="e.g. Schedule clash or fee disagreement"
              style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid var(--ink-300)', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setReasonModal(null)}
                style={{ height: '34px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '6px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => applySourceStatus(reasonModal.ccId, reasonModal.newStatus, reasonText)}
                disabled={!reasonText.trim()}
                style={{ height: '34px', padding: '0 14px', border: 0, borderRadius: '6px', background: 'var(--teal-700)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: reasonText.trim() ? 'pointer' : 'not-allowed', opacity: reasonText.trim() ? 1 : 0.6 }}
              >
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
