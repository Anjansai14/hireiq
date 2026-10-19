import React, { useState, useEffect, useCallback } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';
import { api } from '../../lib/api';

export default function Campaigns() {
  const { HQ, currentCourse, go, toast } = useHQ();
  const film = currentCourse || {};
  const [filter, setFilter] = useState('Live');
  const [search, setSearch] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    if (!film.id) return;
    try {
      setLoading(true);
      setError(null);
      const list = await api.get(`/campaigns?course=${film.id}`);
      if (Array.isArray(list)) {
        setCampaigns(list);
        HQ.set((z) => {
          list.forEach((item) => {
            const exIdx = (z.campaigns || []).findIndex((k) => k.id === item.id);
            if (exIdx >= 0) {
              Object.assign(z.campaigns[exIdx], item);
            } else {
              z.campaigns = z.campaigns || [];
              z.campaigns.push(item);
            }
          });
        });
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [film.id, HQ]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const liveCount = campaigns.filter((c) => c.status === 'Live').length;
  const draftCount = campaigns.filter((c) => c.status === 'Draft').length;
  const closedCount = campaigns.filter((c) => c.status === 'Closed').length;

  const filtered = campaigns.filter((c) => {
    if (c.status !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getTone = (kind) => {
    const tones = {
      Live: { bg: 'var(--success-100)', fg: 'var(--success-800)' },
      Draft: { bg: 'var(--ink-100)', fg: 'var(--ink-700)' },
      Closed: { bg: 'var(--ink-100)', fg: 'var(--ink-600)' },
      'On track': { bg: 'var(--success-100)', fg: 'var(--success-800)' },
      Ahead: { bg: 'var(--success-100)', fg: 'var(--success-800)' },
      Behind: { bg: 'var(--danger-100)', fg: 'var(--danger-800)' },
      Pass: { bg: 'var(--success-100)', fg: 'var(--success-800)' },
      Warning: { bg: 'var(--warning-100)', fg: 'var(--warning-800)' },
      Fail: { bg: 'var(--danger-100)', fg: 'var(--danger-800)' },
      Info: { bg: 'var(--teal-50)', fg: 'var(--teal-800)' }
    };
    return tones[kind] || { bg: 'var(--ink-100)', fg: 'var(--ink-700)' };
  };

  const handleNewCampaign = async () => {
    const rd = HQ.readiness ? HQ.readiness(film) : { refused: false, missing: [] };
    if (rd.refused || (rd.missing && rd.missing.length)) {
      toast(
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
        toast('Draft campaign created');
        go('wizard', { id: res.campaign.id });
      }
    } catch (err) {
      toast(err.message || 'Failed to create campaign draft', 'error');
    }
  };

  const handleDeleteDraft = async (e, id, name) => {
    e.stopPropagation();
    setDeleteTarget({ id, name });
  };

  const confirmDeleteDraft = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.del(`/campaigns/${deleteTarget.id}`);
      toast(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await fetchCampaigns();
    } catch (err) {
      toast(err.message || 'Failed to delete campaign draft', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicateDraft = async (e, c) => {
    e.stopPropagation();
    try {
      const res = await api.post('/campaigns', {
        course_id: film.id,
        name: `${c.name} (copy)`
      });
      if (res && res.campaign) {
        // also save objective settings from source
        await api.patch(`/campaigns/${res.campaign.id}/wizard/objective`, {
          objective: c.objective,
          kpi: c.kpi,
          target: c.target,
          ceiling: c.ceiling,
          budget: c.budget,
          markets: c.markets,
          languages: c.languages,
          qual: c.qual,
          skill_bg: c.skill_bg,
          age_band: c.age_band,
          exp_band: c.exp_band,
          free_text: c.free_text,
          cohort: c.cohort,
          asset: c.asset
        });
        toast('Duplicated as draft');
        await fetchCampaigns();
      }
    } catch (err) {
      toast(err.message || 'Failed to duplicate campaign', 'error');
    }
  };

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600, letterSpacing: '-.015em' }}>Campaigns</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-600)' }}>
            {film.title || 'Course'} · one cohort in one geography for one course batch
          </p>
        </div>
        <button
          onClick={handleNewCampaign}
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
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--teal-800)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--teal-700)')}
        >
          <Icon name="i-plus" size={18} />
          New campaign
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--ink-50)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
          {[
            { id: 'Live', label: 'Live', count: liveCount },
            { id: 'Draft', label: 'Draft', count: draftCount },
            { id: 'Closed', label: 'Closed', count: closedCount }
          ].map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  border: 0,
                  borderRadius: '6px',
                  background: on ? '#fff' : 'transparent',
                  boxShadow: on ? 'var(--e-1)' : 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: on ? 'var(--ink-900)' : 'var(--ink-600)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {f.label}
                <span style={{ color: 'var(--ink-500)', fontWeight: 500 }}>{f.count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Icon
            name="i-search"
            size={16}
            style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--ink-500)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns"
            style={{
              width: '100%',
              height: '40px',
              padding: '0 12px 0 36px',
              border: '1px solid var(--ink-300)',
              borderRadius: '8px',
              background: '#fff',
              fontSize: '13px'
            }}
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--danger-50)', border: '1px solid var(--danger-200)', borderRadius: '8px', color: 'var(--danger-800)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Campaigns Table */}
      <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px,2fr) 120px minmax(160px,1.2fr) 120px 70px 130px 150px 100px 100px',
            minWidth: '1260px',
            gap: '12px',
            padding: '0 20px',
            height: '40px',
            alignItems: 'center',
            background: 'var(--ink-50)',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--ink-600)',
            borderRadius: '12px 12px 0 0'
          }}
        >
          <span>Campaign</span>
          <span>Objective</span>
          <span>Cohort</span>
          <span>Window</span>
          <span style={{ textAlign: 'right' }}>Sources</span>
          <span style={{ textAlign: 'right' }}>Enrolments</span>
          <span>Spend</span>
          <span>Verdict</span>
          <span></span>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--ink-500)', fontSize: '14px' }}>
            Loading campaigns…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--ink-500)', fontSize: '14px' }}>
            No campaigns match.{' '}
            {search && (
              <a
                href="#clear"
                onClick={(e) => {
                  e.preventDefault();
                  setSearch('');
                }}
                style={{ color: 'var(--teal-700)', fontWeight: 600, textDecoration: 'none' }}
              >
                Clear filters
              </a>
            )}
          </div>
        ) : (
          filtered.map((c) => {
            const isDraft = c.status === 'Draft';
            const isClosed = c.status === 'Closed';
            const stTone = getTone(c.status);
            const verdictText = isDraft
              ? `Step ${typeof c.wizard_step === 'number' ? c.wizard_step + 1 : 1}/6`
              : isClosed
              ? 'Closed'
              : c.verdict || 'On track';
            const vtTone = getTone(isDraft ? 'Draft' : verdictText);

            const spentOrCommitted = c.committed || c.spent || 0;
            const budgetVal = c.budget || 1;
            const spendPct = Math.min(100, Math.round((spentOrCommitted / budgetVal) * 100));
            const subText = isDraft
              ? `Draft · created ${HQ.ds ? HQ.ds(c.created_at) : c.created_at || 'Recently'}${c.markets && c.markets.length ? ' · ' + (Array.isArray(c.markets) ? c.markets.join(', ') : c.markets) : ''}`
              : `v${c.version || 1} · ${c.owner || 'Anika Rao'}${c.markets && c.markets.length ? ' · ' + (Array.isArray(c.markets) ? c.markets.join(', ') : c.markets) : ''}`;

            const windowText = c.start_date && c.end_date
              ? `${HQ.ds ? HQ.ds(c.start_date) : c.start_date} – ${HQ.ds ? HQ.ds(c.end_date) : c.end_date}`
              : '—';

            const enrolsText = isDraft
              ? '—'
              : `${c.enrols ?? 0}${c.target ? ' / ' + c.target : ''}`;

            return (
              <div
                key={c.id}
                onClick={() => (isDraft ? go('wizard', { id: c.id }) : go('campaign', { id: c.id, tab: 'overview' }))}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(240px,2fr) 120px minmax(160px,1.2fr) 120px 70px 130px 150px 100px 100px',
                  minWidth: '1260px',
                  gap: '12px',
                  padding: '0 20px',
                  minHeight: '60px',
                  alignItems: 'center',
                  borderTop: '1px solid var(--ink-100)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-25)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                {/* Campaign Name & Subtitle */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <b style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                      {c.name}
                    </b>
                    <span
                      style={{
                        flex: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        height: '22px',
                        padding: '0 8px',
                        borderRadius: '999px',
                        background: stTone.bg,
                        color: stTone.fg,
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '2px' }}>{subText}</div>
                </div>

                {/* Objective */}
                <span style={{ fontSize: '13px', color: 'var(--ink-800)' }}>{c.objective || 'Getting onboarded'}</span>

                {/* Cohort */}
                <span style={{ fontSize: '13px', color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.asset || c.cohort || '—'}
                </span>

                {/* Window */}
                <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>{windowText}</span>

                {/* Sources */}
                <span style={{ textAlign: 'right', fontSize: '13px', color: 'var(--ink-700)' }}>{c.sources ?? '—'}</span>

                {/* Enrolments */}
                <span style={{ textAlign: 'right', fontWeight: 600, fontSize: '13px', color: 'var(--ink-900)' }}>{enrolsText}</span>

                {/* Spend */}
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--ink-800)' }}>
                    {HQ.inrL ? HQ.inrL(spentOrCommitted) : `₹${spentOrCommitted}`} / {HQ.inrL ? HQ.inrL(c.budget) : `₹${c.budget}`}
                  </div>
                  <div style={{ height: '4px', borderRadius: '999px', background: 'var(--ink-100)', marginTop: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${spendPct}%`, background: 'var(--teal-600)' }}></div>
                  </div>
                </div>

                {/* Verdict */}
                <span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '22px',
                      padding: '0 8px',
                      borderRadius: '999px',
                      background: vtTone.bg,
                      color: vtTone.fg,
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    {verdictText}
                  </span>
                </span>

                {/* Actions */}
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                    {isDraft ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            go('wizard', { id: c.id });
                          }}
                          title="Continue wizard"
                          aria-label="Continue wizard"
                          style={{
                            width: '30px',
                            height: '30px',
                            border: 0,
                            borderRadius: '6px',
                            background: 'none',
                            cursor: 'pointer',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--ink-600)'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-100)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <Icon name="i-arrow" size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteDraft(e, c.id, c.name)}
                          title="Delete draft"
                          aria-label="Delete draft"
                          style={{
                            width: '30px',
                            height: '30px',
                            border: 0,
                            borderRadius: '6px',
                            background: 'none',
                            cursor: 'pointer',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--danger-600)'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-100)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <Icon name="i-trash" size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            go('campaign', { id: c.id, tab: 'overview' });
                          }}
                          title="Open"
                          aria-label="Open"
                          style={{
                            width: '30px',
                            height: '30px',
                            border: 0,
                            borderRadius: '6px',
                            background: 'none',
                            cursor: 'pointer',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--ink-600)'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-100)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <Icon name="i-ext" size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            go('campaign', { id: c.id, tab: 'insights' });
                          }}
                          title="Insights"
                          aria-label="Insights"
                          style={{
                            width: '30px',
                            height: '30px',
                            border: 0,
                            borderRadius: '6px',
                            background: 'none',
                            cursor: 'pointer',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--ink-600)'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-100)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <Icon name="i-bulb" size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDuplicateDraft(e, c)}
                          title="Duplicate as draft"
                          aria-label="Duplicate as draft"
                          style={{
                            width: '30px',
                            height: '30px',
                            border: 0,
                            borderRadius: '6px',
                            background: 'none',
                            cursor: 'pointer',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--ink-600)'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-100)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <Icon name="i-copy" size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Draft Confirmation Modal */}
      {deleteTarget && (
        <div
          onClick={() => !deleting && setDeleteTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16,36,43,.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 60
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
            <b style={{ fontSize: '18px', display: 'block', color: 'var(--ink-900)' }}>Delete draft campaign?</b>
            <p style={{ margin: '8px 0 20px', color: 'var(--ink-600)', fontSize: '14px', lineHeight: 1.5 }}>
              Delete &quot;{deleteTarget.name}&quot;? This will remove the draft and any generated candidate narratives and channels. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  border: '1px solid var(--ink-300)',
                  borderRadius: '8px',
                  background: '#fff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: 'var(--ink-700)'
                }}
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={confirmDeleteDraft}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  border: 0,
                  borderRadius: '8px',
                  background: 'var(--danger-600)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {deleting ? 'Deleting…' : 'Delete draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
