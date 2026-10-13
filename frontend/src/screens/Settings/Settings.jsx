import React, { useState } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon } from '../../components/icons/Icons';

export default function Settings() {
  const { HQ, s } = useHQ();
  const r = s.route || {};
  const tab = r.tab || 'connectors';

  const [state, setState] = useState({
    busy: null,
    testing: null,
    editing: null,
    lo: '',
    hi: '',
    confirm: null,
    prefs: [true, true, false]
  });

  const icons = {
    yt: 'i-play',
    yta: 'i-up',
    meta: 'i-image',
    x: 'i-x',
    tg: 'i-send',
    res: 'i-shield',
    li: 'i-upload'
  };

  const setConn = (id, patch) => {
    HQ.set(z => {
      const c = z.connectors.find(q => q.id === id);
      if (c) Object.assign(c, patch);
    });
  };

  const confirms = {
    reset: [
      'Reset demo data?',
      'Restores all courses, campaigns, sources and settings to the starting synthetic data.',
      'Reset',
      () => {
        HQ.reset();
        HQ.toast('Demo data reset');
      }
    ]
  };

  (s.connectors || []).forEach(c => {
    confirms['dc_' + c.id] = [
      `Disconnect ${c.name}?`,
      'Tracking and enrichment from this source stop for every course until you reconnect.',
      'Disconnect',
      () => {
        setConn(c.id, {
          status: 'Disconnected',
          detail: `Disconnected by Anika Rao on ${HQ.d(HQ.TODAY)}`
        });
        HQ.toast(`${c.name} disconnected`, 'error');
      }
    ];
  });

  const cf = state.confirm && confirms[state.confirm];

  const tabs = [
    ['connectors', 'Connectors'],
    ['ratecard', 'Rate card'],
    ['profile', 'Profile']
  ].map(([k, label]) => ({
    key: k,
    label,
    go: () => HQ.go('settings', { tab: k }),
    active: tab === k
  }));

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1140px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600, letterSpacing: '-.015em' }}>Settings</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-600)' }}>
          Company-wide: connectors and the rate card apply to every course.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--ink-100)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={t.go}
            style={{
              border: 0,
              background: 'none',
              padding: '10px 0',
              marginBottom: '-1px',
              borderBottom: t.active ? '2px solid var(--teal-600)' : '2px solid transparent',
              color: t.active ? 'var(--teal-800)' : 'var(--ink-600)',
              fontWeight: t.active ? 600 : 500,
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Connectors */}
      {tab === 'connectors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadein .2s' }}>
          {(s.connectors || []).map(c => {
            const unsup = c.status === 'Unsupported' || c.status === 'Phase 2';
            const bd = c.status === 'Expiring' ? '#F1DDAE' : 'var(--ink-100)';
            const op = unsup ? 0.6 : 1;
            const qc = c.quota > 80 ? 'var(--danger-600)' : 'var(--teal-600)';
            const canTest = !unsup && c.status !== 'Disconnected';
            const canConnect = !unsup && c.status !== 'Connected';
            const canDisconnect = c.status === 'Connected' || c.status === 'Expiring';
            const isBusy = state.busy === c.id;
            const isTesting = state.testing === c.id;

            return (
              <div
                key={c.id}
                style={{
                  background: '#fff',
                  border: `1px solid ${bd}`,
                  borderRadius: '12px',
                  padding: '18px 20px',
                  boxShadow: 'var(--e-1)',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  opacity: op
                }}
              >
                <span style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--ink-50)', color: 'var(--ink-700)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <Icon name={icons[c.id] || 'i-plug'} size={22} />
                </span>

                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <b style={{ fontSize: '15px' }}>{c.name}</b>
                    <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{c.kind}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '22px', padding: '0 8px', borderRadius: '999px', background: HQ.tone(c.status === 'Disconnected' ? 'Failed' : c.status).bg, color: HQ.tone(c.status === 'Disconnected' ? 'Failed' : c.status).fg, fontSize: '12px', fontWeight: 600 }}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--ink-600)', marginTop: '2px' }}>{c.detail}</div>
                  {c.last && <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Last sync {HQ.dt(c.last)}</div>}
                  {c.quota != null && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', maxWidth: '360px' }}>
                      <div style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'var(--ink-100)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${c.quota}%`, background: qc }}></div>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--ink-600)' }}>{c.quota}% of daily quota</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {canTest && (
                    <button
                      onClick={() => {
                        setState(prev => ({ ...prev, testing: c.id }));
                        setTimeout(() => {
                          setState(prev => ({ ...prev, testing: null }));
                          setConn(c.id, { last: HQ.TODAY + 'T' + new Date().toTimeString().slice(0, 5) });
                          HQ.toast(`${c.name}: connection OK`);
                        }, 1000);
                      }}
                      style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                    >
                      {isTesting ? 'Testing…' : 'Test'}
                    </button>
                  )}

                  {canConnect && (
                    <button
                      onClick={() => {
                        setState(prev => ({ ...prev, busy: c.id }));
                        setTimeout(() => {
                          setConn(c.id, {
                            status: 'Connected',
                            last: HQ.TODAY + 'T' + new Date().toTimeString().slice(0, 5),
                            detail: c.id === 'meta' ? 'Business account @nexaskills · token valid until 2 Dec 2026' : c.detail.replace(/Disconnected.*/, 'Connected')
                          });
                          setState(prev => ({ ...prev, busy: null }));
                          HQ.toast(`${c.name} connected`);
                        }, 1500);
                      }}
                      style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: 0, background: 'var(--teal-700)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}
                    >
                      {isBusy && <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', animation: 'spin .8s linear infinite' }}></span>}
                      {isBusy ? 'Waiting for sign-in…' : c.status === 'Expiring' ? 'Reconnect' : 'Connect'}
                    </button>
                  )}

                  {canDisconnect && (
                    <button
                      onClick={() => setState(prev => ({ ...prev, confirm: 'dc_' + c.id }))}
                      style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', color: 'var(--danger-600)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>
            Data comes only from official APIs, source-authorised access, licensed vendors and uploads. No scraping. Tokens are encrypted at rest; alerts fire 7 days before expiry.
          </div>
        </div>
      )}

      {/* TAB 2: Rate card */}
      {tab === 'ratecard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadein .2s' }}>
          <div style={{ display: 'flex', gap: '10px', padding: '12px 14px', borderRadius: '8px', background: 'var(--info-100)', border: '1px solid #C5D9F0', color: 'var(--info-800)', fontSize: '13px' }}>
            <Icon name="i-info" size={18} />
            A tier becomes Observed after 3 bookings across 2 courses. Illustrative tiers can be edited; Observed tiers learn from real deals.
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 130px 150px 150px 130px 130px 100px', minWidth: '1000px', gap: '12px', padding: '0 20px', height: '40px', alignItems: 'center', background: 'var(--ink-50)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-600)' }}>
              <span>Tier</span>
              <span>Followers</span>
              <span>Low (₹/post)</span>
              <span>High (₹/post)</span>
              <span>Provenance</span>
              <span>Bookings</span>
              <span></span>
            </div>

            {(s.rateTiers || []).map(t => {
              const editing = state.editing === t.id;
              const pt = HQ.tone(t.prov);
              const canEdit = t.prov === 'Illustrative';

              return (
                <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '110px 130px 150px 150px 130px 130px 100px', minWidth: '1000px', gap: '12px', padding: '0 20px', height: '56px', alignItems: 'center', borderTop: '1px solid var(--ink-100)', fontSize: '13px' }}>
                  <b>{t.tier}</b>
                  <span style={{ color: 'var(--ink-600)' }}>{t.range}</span>

                  {editing ? (
                    <>
                      <input
                        value={state.lo}
                        onChange={(e) => setState(prev => ({ ...prev, lo: e.target.value.replace(/[^\d]/g, '') }))}
                        style={{ height: '34px', padding: '0 8px', border: '1px solid var(--ink-300)', borderRadius: '6px', width: '120px' }}
                      />
                      <input
                        value={state.hi}
                        onChange={(e) => setState(prev => ({ ...prev, hi: e.target.value.replace(/[^\d]/g, '') }))}
                        style={{ height: '34px', padding: '0 8px', border: '1px solid var(--ink-300)', borderRadius: '6px', width: '120px' }}
                      />
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 600 }}>{HQ.inr(t.lo)}</span>
                      <span style={{ fontWeight: 600 }}>{HQ.inr(t.hi)}</span>
                    </>
                  )}

                  <span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '999px', background: pt.bg, color: pt.fg, fontSize: '12px', fontWeight: 600 }}>
                      {t.prov}
                    </span>
                  </span>

                  <span style={{ color: 'var(--ink-600)' }}>{t.bookings} across {t.films} course{t.films > 1 ? 's' : ''}</span>

                  <span style={{ textAlign: 'right' }}>
                    {canEdit ? (
                      <button
                        onClick={() => {
                          if (!editing) return setState(prev => ({ ...prev, editing: t.id, lo: String(t.lo), hi: String(t.hi) }));
                          if (+state.lo >= +state.hi) return HQ.toast('Low must be below high', 'error');
                          HQ.set(z => {
                            const x = z.rateTiers.find(q => q.id === t.id);
                            if (x) {
                              x.lo = +state.lo;
                              x.hi = +state.hi;
                            }
                          });
                          setState(prev => ({ ...prev, editing: null }));
                          HQ.toast(`${t.tier} band saved (still Illustrative)`);
                        }}
                        style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                      >
                        {editing ? 'Save' : 'Edit'}
                      </button>
                    ) : (
                      <span title="Observed tiers update from bookings" style={{ color: 'var(--ink-400)', display: 'inline-flex' }}>
                        <Icon name="i-lock" size={16} />
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Recent Rate Observations */}
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', boxShadow: 'var(--e-1)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px' }}>
              <b>Recent rate observations</b>
            </div>
            {(s.rateObs || []).slice(0, 10).map((o, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '100px minmax(0,1fr) 120px 80px 120px', gap: '12px', padding: '10px 20px', borderTop: '1px solid var(--ink-100)', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-500)' }}>{HQ.ds(o.date)}</span>
                <span>
                  <b style={{ fontWeight: 600 }}>{(HQ.creator(o.creator) || {}).name || o.creator}</b> · {o.film}
                </span>
                <span>{o.tier}</span>
                <span>{o.posts} posts</span>
                <b style={{ textAlign: 'right' }}>{HQ.inr(o.rate)}/post</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Profile */}
      {tab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 560px)', gap: '20px', alignItems: 'start', animation: 'fadein .2s' }}>
          <div style={{ background: '#fff', border: '1px solid var(--ink-100)', borderRadius: '12px', padding: '22px', boxShadow: 'var(--e-1)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <span style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--teal-100)', color: 'var(--teal-800)', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '18px' }}>
                AR
              </span>
              <div>
                <b style={{ fontSize: '18px', display: 'block' }}>{s.user?.name || 'Anika Rao'}</b>
                <span style={{ color: 'var(--ink-600)' }}>{s.user?.title || 'Campaign manager'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Name</label>
              <input
                value={s.user?.name || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  HQ.set(z => { if (z.user) z.user.name = val; });
                }}
                style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Email</label>
              <input
                value={s.user?.email || 'anika.rao@peopletech.com'}
                disabled
                style={{ height: '40px', padding: '0 12px', border: '1px solid var(--ink-200)', borderRadius: '8px', background: 'var(--ink-50)', color: 'var(--ink-500)' }}
              />
            </div>

            {['Email me when a checkpoint is Behind', 'Daily digest of live posts', 'Weekly Creator Bank freshness report'].map((label, idx) => (
              <label key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', cursor: 'pointer', padding: '6px 0', borderTop: '1px solid var(--ink-100)' }}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={state.prefs[idx]}
                  onChange={() => {
                    const p = state.prefs.slice();
                    p[idx] = !p[idx];
                    setState(prev => ({ ...prev, prefs: p }));
                    HQ.toast('Preference saved');
                  }}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--teal-700)' }}
                />
              </label>
            ))}

            <div style={{ display: 'flex', gap: '10px', paddingTop: '6px' }}>
              <button
                onClick={() => setState(prev => ({ ...prev, confirm: 'reset' }))}
                style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Reset demo data
              </button>
              <button
                onClick={() => {
                  HQ.set(z => {
                    z.user = null;
                    z.route = { name: 'login' };
                  });
                }}
                style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid var(--danger-600)', background: '#fff', color: 'var(--danger-600)', fontWeight: 600, cursor: 'pointer' }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {cf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,36,43,.45)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
          <div style={{ width: '440px', background: '#fff', borderRadius: '16px', boxShadow: 'var(--e-3)', padding: '24px' }}>
            <b style={{ fontSize: '18px', display: 'block', marginBottom: '8px' }}>{cf[0]}</b>
            <p style={{ margin: '0 0 20px', color: 'var(--ink-600)' }}>{cf[1]}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setState(prev => ({ ...prev, confirm: null }))} style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--ink-300)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  cf[3]();
                  setState(prev => ({ ...prev, confirm: null }));
                }}
                style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: 0, background: 'var(--danger-600)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                {cf[2]}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
