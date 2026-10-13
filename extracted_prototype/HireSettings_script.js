
class Component extends DCLogic {
  state = { busy: null, testing: null, editing: null, lo: '', hi: '', confirm: null, prefs: [true, true, false] };
  componentDidMount() { this.u = HQ.sub(() => this.forceUpdate()); }
  componentWillUnmount() { this.u && this.u(); (this.timers || []).forEach(clearTimeout); }
  later(ms, fn) { (this.timers = this.timers || []).push(setTimeout(fn, ms)); }
  renderVals() {
    if (!window.HQ) return {};
    const S = HQ.s, r = S.route, tab = r.tab || 'connectors', st = this.state;
    const icons = { yt: '#i-play', yta: '#i-up', meta: '#i-image', x: '#i-x', tg: '#i-send', res: '#i-shield', li: '#i-upload' };
    const setConn = (id, patch) => HQ.set(z => Object.assign(z.connectors.find(c => c.id === id), patch));
    const confirms = { reset: ['Reset demo data?', 'Restores all courses, campaigns, sources and settings to the starting synthetic data.', 'Reset', () => { HQ.reset(); HQ.toast('Demo data reset'); }] };
    S.connectors.forEach(c => { confirms['dc_' + c.id] = ['Disconnect ' + c.name + '?', 'Tracking and enrichment from this source stop for every course until you reconnect.', 'Disconnect', () => { setConn(c.id, { status: 'Disconnected', detail: 'Disconnected by Anika Rao on ' + HQ.d(HQ.TODAY) }); HQ.toast(c.name + ' disconnected', 'error'); }]; });
    const cf = st.confirm && confirms[st.confirm];
    return {
      tabs: [['connectors', 'Connectors'], ['ratecard', 'Rate card'], ['profile', 'Profile']].map(([k, l]) => ({ label: l, go: () => HQ.go('settings', { tab: k }), bc: tab === k ? 'var(--teal-600)' : 'transparent', c: tab === k ? 'var(--teal-800)' : 'var(--ink-600)', fw: tab === k ? 600 : 500 })),
      tConn: tab === 'connectors', tRate: tab === 'ratecard', tProfile: tab === 'profile', tTeam: tab === 'team', team: S.team.map(m => ({ name: m.name, email: m.email, title: m.title, role: m.role, initials: m.name.split(' ').map(w => w[0]).slice(0, 2).join(''), perms: { Admin: 'Connectors, rate card, all campaign actions', Manager: 'All campaign actions, contact reveal', Viewer: 'Read and export; totals only for fees', 'Fairness reviewer': 'Clears or rejects blocked campaigns (RR-H02)' }[m.role] || '', setRole: e => { const v = e.target.value; HQ.set(z => { z.team.find(q => q.email === m.email).role = v; }); HQ.toast(m.name + ' is now ' + v); } })),
      conns: S.connectors.map(c => { const unsup = c.status === 'Unsupported' || c.status === 'Phase 2'; return { name: c.name, kind: c.kind, status: c.status, st: HQ.tone(c.status === 'Disconnected' ? 'Failed' : c.status), detail: c.detail, last: c.last ? HQ.dt(c.last) : '', hasLast: !!c.last, icon: icons[c.id] || '#i-plug', bd: c.status === 'Expiring' ? '#F1DDAE' : 'var(--ink-100)', op: unsup ? 0.6 : 1, hasQuota: c.quota != null, quota: c.quota, qc: c.quota > 80 ? 'var(--danger-600)' : 'var(--teal-600)',
        canTest: !unsup && c.status !== 'Disconnected', testLabel: st.testing === c.id ? 'Testing…' : 'Test', test: () => { this.setState({ testing: c.id }); this.later(1100, () => { this.setState({ testing: null }); setConn(c.id, { last: HQ.TODAY + 'T' + new Date().toTimeString().slice(0, 5) }); HQ.toast(c.name + ': connection OK'); }); },
        canConnect: !unsup && c.status !== 'Connected', connectLabel: st.busy === c.id ? 'Waiting for sign-in…' : c.status === 'Expiring' ? 'Reconnect' : 'Connect', busy: st.busy === c.id,
        connect: () => { this.setState({ busy: c.id }); this.later(1800, () => { setConn(c.id, { status: 'Connected', last: HQ.TODAY + 'T' + new Date().toTimeString().slice(0, 5), detail: c.id === 'meta' ? 'Business account @sitaralanes · token valid until 2 Dec 2026' : c.detail.replace(/Disconnected.*/, 'Connected') }); this.setState({ busy: null }); HQ.toast(c.name + ' connected'); }); },
        canDisconnect: c.status === 'Connected' || c.status === 'Expiring', disconnect: () => this.setState({ confirm: 'dc_' + c.id }) }; }),
      tiers: S.rateTiers.map(t => { const editing = st.editing === t.id; return { tier: t.tier, range: t.range, loF: HQ.inr(t.lo), hiF: HQ.inr(t.hi), lo: st.lo, hi: st.hi, prov: t.prov, pt: HQ.tone(t.prov), bookings: t.bookings + ' across ' + t.films + ' course' + (t.films > 1 ? 's' : ''), editing, notEditing: !editing, canEdit: t.prov === 'Illustrative', locked: t.prov !== 'Illustrative', editLabel: editing ? 'Save' : 'Edit',
        setLo: e => this.setState({ lo: e.target.value.replace(/[^\d]/g, '') }), setHi: e => this.setState({ hi: e.target.value.replace(/[^\d]/g, '') }),
        edit: () => { if (!editing) return this.setState({ editing: t.id, lo: String(t.lo), hi: String(t.hi) }); if (+st.lo >= +st.hi) return HQ.toast('Low must be below high', 'error'); HQ.set(z => { const x = z.rateTiers.find(q => q.id === t.id); x.lo = +st.lo; x.hi = +st.hi; }); this.setState({ editing: null }); HQ.toast(t.tier + ' band saved (still Illustrative)'); } }; }),
      obs: S.rateObs.slice(0, 10).map(o => ({ date: HQ.ds(o.date), creator: (HQ.creator(o.creator) || {}).name, film: o.film, tier: o.tier, posts: o.posts, rate: HQ.inr(o.rate) + '/post' })),
      user: S.user || {}, setName: e => { const v = e.target.value; HQ.set(z => { z.user.name = v; }); },
      prefs: ['Email me when a checkpoint is Behind', 'Daily digest of live posts', 'Weekly Creator Bank freshness report'].map((l, i) => ({ l, on: st.prefs[i], toggle: () => { const p = st.prefs.slice(); p[i] = !p[i]; this.setState({ prefs: p }); HQ.toast('Preference saved'); } })),
      team: S.team.map(m => ({ name: m.name, title: m.title, email: m.email, role: m.role, initials: m.name.split(' ').map(w => w[0]).slice(0, 2).join('') })),
      askReset: () => this.setState({ confirm: 'reset' }), signOut: () => { HQ.set(z => { z.user = null; z.route = { name: 'login' }; }); },
      confirm: !!cf, confirmTitle: cf && cf[0], confirmBody: cf && cf[1], confirmCta: cf && cf[2], cancel: () => this.setState({ confirm: null }), doConfirm: () => { cf[3](); this.setState({ confirm: null }); }
    };
  }
}
