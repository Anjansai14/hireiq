
class Component extends DCLogic {
  state = { tab: 'image', q: '', sel: null };
  componentDidMount() { this.u = HQ.sub(() => this.forceUpdate()); }
  componentWillUnmount() { this.u && this.u(); }
  data(t) {
    const s = t.toLowerCase().replace(/\s+/g, '-');
    return [
      { id: 'a1', kind: 'image', name: 'Alumni testimonial card · Telugu', fmt: 'PNG', size: '1.4 MB', dims: '1080×1080', created: '2026-09-21', updated: '2026-10-02', thread: 'Forwardable cards for Warangal', prompt: 'WhatsApp-forwardable card in Telugu: Batch 3 alumnus quote, eligibility line, tagged QR to the Resolence page. No salary figures.', log: [['QR moved to bottom-right', '2026-10-02'], ['Created from alumni quote (consent on file)', '2026-09-21']] },
      { id: 'a2', kind: 'image', name: 'Eligibility carousel · 5 slides', fmt: 'PNG', size: '2.2 MB', dims: '1080×1350', created: '2026-09-26', updated: '2026-09-27', thread: 'Can you apply?', prompt: '5-slide carousel: graduation years, degree, aggregate, schedule, how to register. English with Telugu captions.', log: [['Slide 3 reworded: 60% aggregate', '2026-09-27'], ['Created', '2026-09-26']] },
      { id: 'a3', kind: 'image', name: 'Campus info-session poster · JNTUH', fmt: 'PNG', size: '1.1 MB', dims: '1080×1350', created: '2026-09-30', updated: '2026-10-01', thread: 'JNTUH info session', prompt: 'Event poster for a 45-minute info session with the JNTUH Students\' Forum on 4 Oct, tagged QR for registration.', log: [['Date and venue added', '2026-10-01'], ['Created', '2026-09-30']] },
      { id: 'a4', kind: 'image', name: 'Stipend forwardable card', fmt: 'PNG', size: '760 KB', dims: '1080×1080', created: '2026-10-03', updated: '2026-10-03', thread: 'Forwardable cards for Warangal', prompt: 'Card: "No fee · ₹2,500 a month while you learn · Batch 4 starts 16 Nov". Telugu first, English second.', log: [['Created', '2026-10-03']] },
      { id: 'v1', kind: 'video', name: 'Alumni testimonial cut · 45s', fmt: 'MP4', size: '22.6 MB', dims: '1080×1920', dur: '0:45', created: '2026-09-24', updated: '2026-09-29', thread: 'Alumni stories', prompt: 'Cut Sai Kiran Reddy\'s interview to 45 seconds: where he started, his capstone, who should apply. Burned-in Telugu subtitles.', log: [['Subtitles corrected', '2026-09-29'], ['Created', '2026-09-24']] },
      { id: 'v2', kind: 'video', name: 'Syllabus walkthrough short · 60s', fmt: 'MP4', size: '28.1 MB', dims: '1080×1920', dur: '1:00', created: '2026-09-27', updated: '2026-09-27', thread: 'Can you apply?', prompt: 'One-minute short covering the 16 weeks of the syllabus, ending on the eligibility line and tracked link.', log: [['Created', '2026-09-27']] },
      { id: 'v3', kind: 'video', name: 'Live Q&A highlight · 90s', fmt: 'MP4', size: '41.3 MB', dims: '1920×1080', dur: '1:30', created: '2026-10-05', updated: '2026-10-05', thread: 'Answering placement doubts', prompt: 'Highlight from the live Q&A answering "Is it really free?" and "Is there a weekend batch?". No placement-rate claims.', log: [['Created', '2026-10-05']] },
      { id: 'r1', kind: 'report', name: 'Warangal campaign plan · v2', fmt: 'PDF', size: '290 KB', pages: 6, created: '2026-09-29', updated: '2026-09-29', thread: 'Why is Warangal engineering graduates behind?', prompt: 'Export the plan for Warangal engineering graduates: narratives, channels, sources and the frozen prediction. No contact details.', log: [['v2: shifted ₹40,000 to WhatsApp placement-cell cards', '2026-09-29'], ['v1 created', '2026-09-20']] },
      { id: 'r2', kind: 'report', name: 'Weekly enrolment funnel · week 40', fmt: 'PDF', size: '1.3 MB', pages: 5, created: '2026-10-06', updated: '2026-10-06', thread: 'Weekly summary', prompt: 'Weekly funnel per campaign, cohort and district: reach, clicks, registrations, screening enrolments, unattributed. Counts only.', log: [['Resolence counts refreshed 08:00', '2026-10-06'], ['Created', '2026-10-06']] },
      { id: 'r3', kind: 'report', name: 'Cost per enrolment vs ceiling', fmt: 'XLSX', size: '96 KB', pages: 2, created: '2026-10-04', updated: '2026-10-06', thread: 'Budget check', prompt: 'Compare spend per source with attributed enrolments and the ₹4,500 ceiling; flag sources above it.', log: [['Updated with Day 14 counts', '2026-10-06'], ['Created', '2026-10-04']] }
    ].map(a => Object.assign({ file: s + '-' + a.id }, a));
  }
  look(a) {
    if (a.kind === 'video') return { bg: 'var(--ink-800)', fg: '#fff', icon: '#i-play', ratio: '16/10' };
    if (a.kind === 'report') return { bg: 'var(--ink-50)', fg: 'var(--ink-600)', icon: '#i-file', ratio: '16/10' };
    return { bg: 'var(--teal-50)', fg: 'var(--teal-700)', icon: '#i-image', ratio: '16/10' };
  }
  renderVals() {
    if (!window.HQ) return {};
    const film = HQ.film(), st = this.state, all = this.data(film.title).filter(a => !(HQ.s.artDeleted || []).includes(film.id + ':' + a.id));
    const ago = d => { const n = Math.round((new Date(HQ.TODAY) - new Date(d)) / 864e5); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; };
    const meta = a => HQ.ds(a.created) + ' · ' + a.fmt + ' · ' + a.size;
    const download = a => { const b = new Blob(['InfluenceIQ prototype placeholder for ' + a.name + '\nGenerated by Copilot · ' + a.thread + '\nPrompt: ' + a.prompt], { type: 'text/plain' }); const x = document.createElement('a'); x.href = URL.createObjectURL(b); x.download = a.file + '.txt'; document.body.appendChild(x); x.click(); x.remove(); HQ.toast('Downloading ' + a.name); };
    const remove = a => { HQ.set(x => { x.artDeleted = (x.artDeleted || []).concat([film.id + ':' + a.id]); }); this.setState({ sel: null }); HQ.toast(a.name + ' deleted'); };
    const tabsL = [['image', 'Images', '#i-image'], ['video', 'Video', '#i-play'], ['report', 'Report', '#i-file']];
    const list = all.filter(a => a.kind === st.tab && a.name.toLowerCase().includes(st.q.toLowerCase()));
    const sel = all.find(a => a.id === st.sel);
    const selV = sel ? Object.assign({}, this.look(sel), { name: sel.name, meta: meta(sel), prompt: sel.prompt,
      facts: [['Format', sel.fmt], ['Size', sel.size], sel.dims && ['Dimensions', sel.dims], sel.dur && ['Duration', sel.dur], sel.pages && ['Pages', sel.pages], sel.data && ['Key figure', sel.data], ['Created', HQ.ds(sel.created)], ['From thread', sel.thread]].filter(Boolean).map(([k, v]) => ({ k, v })),
      log: sel.log.map(([t, d]) => ({ t, d: HQ.ds(d) })) }) : {};
    return {
      film: film.title, q: st.q, setQ: e => this.setState({ q: e.target.value }),
      tabs: tabsL.map(([k, label, icon]) => ({ label, icon, n: all.filter(a => a.kind === k).length, go: () => this.setState({ tab: k }), bc: st.tab === k ? 'var(--teal-600)' : 'transparent', c: st.tab === k ? 'var(--teal-800)' : 'var(--ink-600)', fw: st.tab === k ? 600 : 500 })),
      empty: !list.length,
      items: list.map(a => { const L = this.look(a); return Object.assign({}, L, { name: a.name, meta: meta(a), dur: a.dur || '', isReport: a.kind === 'report', isMedia: a.kind !== 'report', dl: e => { e.stopPropagation(); download(a); }, del: e => { e.stopPropagation(); remove(a); }, open: () => this.setState({ sel: a.id }) }); }),
      open: !!sel, sel: selV, close: () => this.setState({ sel: null }), stop: e => e.stopPropagation(),
      askCopilot: () => { this.setState({ sel: null }); HQ.go('copilot'); },
      delSel: () => remove(sel), dl: () => download(sel), dlOld: () => { const b = new Blob(['InfluenceIQ prototype placeholder for ' + sel.name + '\nGenerated by Copilot · ' + sel.thread + '\nPrompt: ' + sel.prompt], { type: 'text/plain' }); const x = document.createElement('a'); x.href = URL.createObjectURL(b); x.download = sel.file + '.txt'; document.body.appendChild(x); x.click(); x.remove(); HQ.toast('Downloading ' + sel.name); }
    };
  }
}
