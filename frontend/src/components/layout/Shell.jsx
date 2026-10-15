import React, { useState } from 'react';
import { useHQ } from '../../hooks/useHQ';
import { Icon, SvgDefinitions } from '../icons/Icons';
import { api } from '../../lib/api';

export default function Shell({ children }) {
  const { state, HQ, currentCourse, currentRoute, go, set, toast } = useHQ();
  const [acctOpen, setAcctOpen] = useState(false);
  const [filmOpen, setFilmOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [filmQ, setFilmQ] = useState('');
  const [newCourseOpen, setNewCourseOpen] = useState(false);

  const closeMenus = () => {
    setAcctOpen(false);
    setFilmOpen(false);
    setNotifOpen(false);
  };

  const user = state.user || { name: 'Anika Rao', email: 'anika.rao@peopletech.com', title: 'Campaign manager' };
  const initials = (user.name || 'A R').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');

  const r = currentRoute;
  const film = currentCourse;

  // Navigation items mapping
  const sec = {
    dashboard: 'dashboard',
    brief: 'dashboard',
    newfilm: 'dashboard',
    campaigns: 'campaigns',
    wizard: 'campaigns',
    campaign: 'campaigns',
    influencer: 'campaigns',
    copilot: 'copilot',
    files: 'files'
  }[r.name] || 'dashboard';

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: 'i-home' },
    { key: 'campaigns', label: 'Campaigns', icon: 'i-mega' },
    { key: 'copilot', label: 'Copilot', icon: 'i-chat' },
    { key: 'files', label: 'Artifacts', icon: 'i-folder' }
  ];

  const acctItems = [
    { label: 'Connectors', icon: 'i-plug', go: () => { closeMenus(); go('settings', { tab: 'connectors' }); }, meta: state.connectors.some(c => c.status === 'Expiring') ? '1 expiring' : '' },
    { label: 'Rate card', icon: 'i-tag', go: () => { closeMenus(); go('settings', { tab: 'ratecard' }); } },
    { label: 'Creator Bank', icon: 'i-users', go: () => { closeMenus(); go('creators'); }, meta: String(state.creators.length) },
    { label: 'Profile', icon: 'i-user', go: () => { closeMenus(); go('settings', { tab: 'profile' }); } },
    { label: 'Switch module', icon: 'i-swap', go: () => { closeMenus(); set(x => { x.module = null; }); } },
    { label: 'Sign out', icon: 'i-logout', color: 'var(--danger-600)', go: () => { closeMenus(); api.token.set(null); set(x => { x.user = null; x.route = { name: 'login' }; }); toast('Signed out'); } }
  ];

  // Course switcher
  const q = filmQ.toLowerCase();
  const filmList = state.films.filter(f => f.title.toLowerCase().includes(q));

  // Breadcrumbs
  const ccName = () => {
    const x = HQ.ccOf(r.campId, r.ccId);
    return x ? (HQ.creator(x.creatorId)?.name || '') : '';
  };

  const crumbLabels = {
    dashboard: ['Dashboard'],
    brief: [film.title, 'Course brief'],
    newfilm: ['New course'],
    campaigns: ['Campaigns'],
    wizard: ['Campaigns', 'New campaign'],
    campaign: ['Campaigns', (HQ.camp(r.id) || {}).name || 'Campaign'],
    influencer: ['Campaigns', (HQ.camp(r.campId) || {}).name || 'Campaign', ccName()],
    creators: ['Settings', 'Creator Bank'],
    creator: ['Creator Bank', (HQ.creator(r.id) || {}).name || 'Source'],
    copilot: ['Copilot'],
    files: ['Artifacts'],
    settings: ['Settings', { connectors: 'Connectors', ratecard: 'Rate card', profile: 'Profile' }[r.tab] || 'Connectors']
  }[r.name] || ['Dashboard'];

  // Alerts
  const alerts = [];
  const ar = HQ.readiness(film);
  if (ar.missing.length) {
    alerts.push({
      title: `${film.title} brief is missing ${ar.missing.length} required field${ar.missing.length > 1 ? 's' : ''}`,
      sub: ar.missing.map(m => m.label).join(', '),
      go: () => { closeMenus(); go('brief'); },
      lvl: 'danger'
    });
  }
  (film.flags || []).filter(f => f.status === 'Refused').forEach(f => {
    alerts.push({
      title: `${f.type} flag is Refused`,
      sub: 'Create campaign is blocked until it is resolved',
      go: () => { closeMenus(); go('brief', { tab: 'governance' }); },
      lvl: 'danger'
    });
  });

  state.campaigns.filter(c => c.filmId === film.id && c.status === 'Live').forEach(c => {
    const cp = (c.checkpoints || []).filter(k => k.verdict).slice(-1)[0];
    if (cp && cp.verdict === 'Behind') {
      alerts.push({
        title: `${c.name} is Behind`,
        sub: `${cp.label} checkpoint · ${cp.note}`,
        go: () => { closeMenus(); go('campaign', { id: c.id, tab: 'insights' }); },
        lvl: 'danger'
      });
    }
    (c.alerts || []).filter(a => a.rule === 'RR-H05' && !a.dismissed).forEach(a => {
      alerts.push({
        title: 'Enrolment rate below floor',
        sub: `${c.name} · message and programme mismatch (RR-H05)`,
        go: () => { closeMenus(); go('campaign', { id: c.id, tab: 'insights' }); },
        lvl: 'warning'
      });
    });
    (c.ccs || []).filter(x => x.late && !x.posts.length && x.status !== 'Live').forEach(x => {
      alerts.push({
        title: `${HQ.creator(x.creatorId)?.name || 'Source'} is past the post date`,
        sub: `${c.name} · due ${HQ.ds(x.deal?.end)}`,
        go: () => { closeMenus(); go('influencer', { campId: c.id, ccId: x.id, tab: 'posts' }); },
        lvl: 'warning'
      });
    });
  });

  state.connectors.filter(c => c.status === 'Expiring').forEach(c => {
    alerts.push({
      title: `${c.name} token expires in 6 days`,
      sub: 'Reconnect before 12 Oct to keep Instagram and Facebook metrics flowing',
      go: () => { closeMenus(); go('settings', { tab: 'connectors' }); },
      lvl: 'warning'
    });
  });

  const resConn = state.connectors.find(c => c.id === 'res');
  if (resConn && (resConn.status !== 'Connected' || HQ.daysBetween(resConn.last?.slice(0, 10), HQ.TODAY) > 1)) {
    alerts.push({
      title: 'Resolence feed is stale',
      sub: 'Registrations and enrolments may be out of date',
      go: () => { closeMenus(); go('settings', { tab: 'connectors' }); },
      lvl: 'warning'
    });
  }

  const staleCreators = state.creators.filter(c => c.status === 'Failed' || c.status === 'Partial').length;
  if (staleCreators) {
    alerts.push({
      title: `${staleCreators} source profiles need a refresh`,
      sub: 'Failed or partial enrichment in the Creator Bank',
      go: () => { closeMenus(); go('creators', { filter: 'attention' }); },
      lvl: 'warning'
    });
  }

  const alertItems = alerts.map(a => {
    const t = HQ.tone(a.lvl === 'danger' ? 'Fail' : 'Warning');
    return { ...a, bg: t.bg, fg: t.fg };
  });

  return (
    <>
      <SvgDefinitions />
      <div style={{ display: 'grid', gridTemplateColumns: '232px minmax(0,1fr)', height: '100vh', overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <aside style={{ background: '#fff', borderRight: '1px solid var(--ink-100)', display: 'flex', flexDirection: 'column', padding: '20px 12px 12px', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '0 8px 16px' }}>
            <Icon name="logo-mark" size={28} />
            <b style={{ fontSize: '16px', letterSpacing: '-.02em', fontWeight: 600 }}>
              Influence<span style={{ color: 'var(--teal-600)' }}>IQ</span>
            </b>
          </div>

          {/* Module Pill */}
          <div style={{
            display: 'inline-flex',
            alignSelf: 'flex-start',
            alignItems: 'center',
            gap: '8px',
            height: '28px',
            padding: '0 10px 0 6px',
            borderRadius: '8px',
            background: 'var(--hire-tint)',
            color: '#7A4F0F',
            fontSize: '13px',
            fontWeight: 600,
            margin: '0 8px 18px',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'var(--hire)', color: '#fff', display: 'grid', placeItems: 'center' }}>
              <Icon name="i-brief" size={13} />
            </span>
            Hire IQ
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {navItems.map(it => {
              const on = sec === it.key;
              return (
                <button
                  key={it.key}
                  onClick={() => { closeMenus(); go(it.key); }}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    height: '38px',
                    padding: '0 10px',
                    border: 0,
                    borderRadius: '8px',
                    background: on ? 'var(--ink-50)' : 'transparent',
                    color: on ? 'var(--ink-900)' : 'var(--ink-600)',
                    fontWeight: on ? 600 : 500,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={e => {
                    if (!on) { e.currentTarget.style.background = 'var(--ink-50)'; e.currentTarget.style.color = 'var(--ink-900)'; }
                  }}
                  onMouseLeave={e => {
                    if (!on) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-600)'; }
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    left: '-12px',
                    top: '8px',
                    bottom: '8px',
                    width: '3px',
                    borderRadius: '0 3px 3px 0',
                    background: on ? 'var(--hire)' : 'transparent'
                  }}></span>
                  <Icon name={it.icon} size={20} style={{ color: on ? 'var(--hire)' : 'currentColor' }} />
                  {it.label}
                </button>
              );
            })}
          </nav>

          <div style={{ flex: 1 }}></div>

          {/* User Account / Settings Dropdown */}
          <div style={{ position: 'relative' }}>
            {acctOpen && (
              <>
                <div onClick={closeMenus} style={{ position: 'fixed', inset: 0, zIndex: 40 }}></div>
                <div style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  zIndex: 41,
                  background: '#fff',
                  border: '1px solid var(--ink-100)',
                  borderRadius: '12px',
                  boxShadow: 'var(--e-2)',
                  padding: '6px',
                  animation: 'fadein .12s'
                }}>
                  <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--ink-100)', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-500)' }}>{user.email}</div>
                  </div>
                  <div style={{ padding: '6px 10px 4px', fontSize: '12px', fontWeight: 600, color: 'var(--ink-500)' }}>Settings</div>
                  {acctItems.map((m, idx) => (
                    <button
                      key={idx}
                      onClick={m.go}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        minHeight: '36px',
                        padding: '6px 10px',
                        border: 0,
                        borderRadius: '8px',
                        background: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: m.color || 'inherit'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Icon name={m.icon} size={18} />
                      {m.label}
                      {m.meta && <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--ink-500)' }}>{m.meta}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              onClick={() => { closeMenus(); setAcctOpen(!acctOpen); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px',
                border: '1px solid var(--ink-100)',
                borderRadius: '10px',
                background: '#fff',
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-25)'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <span style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--teal-100)', color: 'var(--teal-800)', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '13px' }}>
                {initials}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '13px' }}>{user.name}</span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-500)' }}>{user.title}</span>
              </span>
              <Icon name="i-settings" size={16} style={{ color: 'var(--ink-500)' }} />
            </button>
          </div>
        </aside>

        {/* Right Main Body */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {/* Header */}
          <header style={{ height: '60px', flex: 'none', background: '#fff', borderBottom: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', gap: '16px', padding: '0 24px', position: 'relative', zIndex: 20 }}>
            {/* Course Switcher */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { closeMenus(); setFilmOpen(!filmOpen); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  height: '40px',
                  padding: '0 10px 0 6px',
                  border: '1px solid var(--ink-200)',
                  borderRadius: '8px',
                  background: '#fff',
                  cursor: 'pointer',
                  minWidth: '240px'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ink-400)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--ink-200)'}
              >
                <span style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--ink-900)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '12px' }}>
                  {film.title[0]}
                </span>
                <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: '14px', lineHeight: 1.2 }}>{film.title}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-500)', lineHeight: 1.2 }}>{(film.batch || 'Batch 1') + ' · starts ' + HQ.d(film.release)}</span>
                </span>
                <Icon name="i-down" size={16} style={{ color: 'var(--ink-500)' }} />
              </button>

              {filmOpen && (
                <>
                  <div onClick={closeMenus} style={{ position: 'fixed', inset: 0, zIndex: 40 }}></div>
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: '320px',
                    zIndex: 41,
                    background: '#fff',
                    border: '1px solid var(--ink-100)',
                    borderRadius: '12px',
                    boxShadow: 'var(--e-2)',
                    padding: '6px',
                    animation: 'fadein .12s'
                  }}>
                    <div style={{ padding: '2px 2px 6px', position: 'relative' }}>
                      <Icon name="i-search" size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--ink-500)' }} />
                      <input
                        value={filmQ}
                        onChange={e => setFilmQ(e.target.value)}
                        placeholder="Search courses"
                        style={{ width: '100%', height: '32px', padding: '0 10px 0 34px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                    {filmList.map(f => {
                      const on = f.id === film.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            closeMenus();
                            set(x => {
                              x.filmId = f.id;
                              x.route = { name: (['campaigns', 'files', 'copilot', 'creators'].includes(r.name)) ? r.name : 'dashboard' };
                            });
                            toast('Switched to ' + f.title);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            minHeight: '44px',
                            padding: '6px 10px',
                            border: 0,
                            borderRadius: '8px',
                            background: on ? 'var(--teal-50)' : 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                          onMouseLeave={e => e.currentTarget.style.background = on ? 'var(--teal-50)' : 'transparent'}
                        >
                          <span style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--ink-900)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '12px' }}>
                            {f.title[0]}
                          </span>
                          <span style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontWeight: 600 }}>{f.title}</span>
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-500)' }}>{(f.batch || 'Batch 1') + ' · starts ' + HQ.d(f.release)}</span>
                          </span>
                          {on && <Icon name="i-check" size={16} style={{ color: 'var(--teal-700)' }} />}
                        </button>
                      );
                    })}
                    {filmList.length === 0 && <div style={{ padding: '14px 10px', color: 'var(--ink-500)', fontSize: '13px', textAlign: 'center' }}>No courses match</div>}
                    <div style={{ height: '1px', background: 'var(--ink-100)', margin: '6px 0' }}></div>
                    <button
                      onClick={() => { closeMenus(); go('newfilm'); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        minHeight: '38px',
                        padding: '6px 10px',
                        border: 0,
                        borderRadius: '8px',
                        background: 'none',
                        cursor: 'pointer',
                        color: 'var(--teal-700)',
                        fontWeight: 600
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Icon name="i-plus" size={18} />
                      New course
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Breadcrumbs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ink-500)', fontSize: '13px', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {crumbLabels.map((c, i) => (
                <React.Fragment key={i}>
                  <Icon name="i-right" size={14} />
                  <span style={{ color: i === crumbLabels.length - 1 ? 'var(--ink-900)' : 'var(--ink-500)', fontWeight: i === crumbLabels.length - 1 ? 600 : 400 }}>
                    {c}
                  </span>
                </React.Fragment>
              ))}
            </div>

            <div style={{ flex: 1 }}></div>

            {/* Alerts Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { closeMenus(); setNotifOpen(!notifOpen); }}
                aria-label="Alerts"
                style={{
                  position: 'relative',
                  width: '40px',
                  height: '40px',
                  border: 0,
                  borderRadius: '8px',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--ink-600)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Icon name="i-bell" size={20} />
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  minWidth: '16px',
                  height: '16px',
                  padding: '0 4px',
                  borderRadius: '999px',
                  background: 'var(--danger-600)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center'
                }}>
                  {alertItems.length}
                </span>
              </button>

              {notifOpen && (
                <>
                  <div onClick={closeMenus} style={{ position: 'fixed', inset: 0, zIndex: 40 }}></div>
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '380px',
                    zIndex: 41,
                    background: '#fff',
                    border: '1px solid var(--ink-100)',
                    borderRadius: '12px',
                    boxShadow: 'var(--e-2)',
                    padding: '6px',
                    animation: 'fadein .12s'
                  }}>
                    <div style={{ padding: '8px 10px', fontWeight: 600 }}>Needs attention</div>
                    {alertItems.map((a, idx) => (
                      <button
                        key={idx}
                        onClick={a.go}
                        style={{
                          width: '100%',
                          display: 'flex',
                          gap: '10px',
                          padding: '10px',
                          border: 0,
                          borderRadius: '8px',
                          background: 'none',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: a.bg, color: a.fg, display: 'grid', placeItems: 'center', flex: 'none' }}>
                          <Icon name="i-alert" size={16} />
                        </span>
                        <span style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '13px' }}>{a.title}</span>
                          <span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-500)' }}>{a.sub}</span>
                        </span>
                        <Icon name="i-right" size={16} style={{ color: 'var(--ink-400)', marginTop: '6px' }} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </header>

          {/* Main Area & Copilot Drawer */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <main data-iq-main="1" style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
              {children}
            </main>

            {/* Copilot Drawer (Side Panel) */}
            {state.copilotOpen && r.name !== 'copilot' && (
              <div style={{ width: '400px', flex: 'none', borderLeft: '1px solid var(--ink-100)', background: '#fff', display: 'flex', flexDirection: 'column', minHeight: 0, animation: 'slidein .2s' }}>
                <div style={{ height: '48px', borderBottom: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <Icon name="i-spark" size={18} style={{ color: 'var(--teal-600)' }} />
                    Copilot
                  </div>
                  <button onClick={() => set(x => { x.copilotOpen = false; })} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-500)' }}>
                    <Icon name="i-x" size={16} />
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  {/* Copilot Component rendered in panel mode */}
                  <PanelCopilot />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Toasts Container */}
      <div style={{ position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', zIndex: 100, pointerEvents: 'none' }}>
        {(state.toasts || []).map(t => {
          const bg = t.kind === 'error' ? 'var(--danger-800)' : 'var(--ink-900)';
          const ic = t.kind === 'error' ? '#FCE9E6' : 'var(--teal-300)';
          const icon = t.kind === 'error' ? 'i-alert' : 'i-check';
          return (
            <div key={t.id} style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: '12px', background: bg, color: '#fff', padding: '12px 16px', borderRadius: '8px', boxShadow: 'var(--e-2)', fontSize: '14px', animation: 'fadein .2s', maxWidth: '520px' }}>
              <Icon name={icon} size={18} style={{ color: ic }} />
              <span>{t.text}</span>
              <button onClick={() => HQ.dismissToast(t.id)} aria-label="Dismiss" style={{ border: 0, background: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: '2px' }}>
                <Icon name="i-x" size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PanelCopilot() {
  const { state, HQ, currentCourse } = useHQ();
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const thread = (state.threads || [])[0] || { messages: [] };
  const film = currentCourse;

  const handleSend = () => {
    if (!input.trim() || thinking) return;
    const q = input.trim();
    setInput('');
    HQ.set(x => {
      const t = x.threads[0];
      t.messages.push({ role: 'user', text: q });
    });
    setThinking(true);
    setTimeout(() => {
      HQ.set(x => {
        const t = x.threads[0];
        t.messages.push({
          role: 'assistant',
          text: `Analysis for ${film.title}: Enrolment metrics and source performance are currently within the target confidence range. For detailed checkpoints, review the Campaign Insights tab.`,
          citations: ['Course Brief · Target', 'Resolence counts · 6 Oct 08:00']
        });
      });
      setThinking(false);
    }, 1200);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '10px 16px', background: 'var(--ink-25)', borderBottom: '1px solid var(--ink-100)', fontSize: '12px', color: 'var(--ink-500)' }}>
        Scoped to {film.title}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {thread.messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: '12px',
              background: m.role === 'user' ? 'var(--teal-700)' : 'var(--ink-50)',
              color: m.role === 'user' ? '#fff' : 'var(--ink-900)',
              fontSize: '13px',
              lineHeight: '1.45',
              whiteSpace: 'pre-wrap'
            }}>
              {m.text}
            </div>
            {m.citations && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {m.citations.map((c, j) => (
                  <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '6px', background: 'var(--teal-50)', color: 'var(--teal-800)', fontSize: '11px' }}>
                    <Icon name="i-link" size={11} /> {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink-500)', fontSize: '12px' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--teal-200)', borderTopColor: 'var(--teal-700)', animation: 'spin .8s linear infinite' }}></span>
            Analyzing campaign signals...
          </div>
        )}
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--ink-100)', display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask Copilot..."
          style={{ flex: 1, height: '36px', padding: '0 12px', border: '1px solid var(--ink-300)', borderRadius: '8px', fontSize: '13px' }}
        />
        <button onClick={handleSend} style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--teal-700)', color: '#fff', border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Icon name="i-send" size={16} />
        </button>
      </div>
    </div>
  );
}
