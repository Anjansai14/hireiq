
const PROTECTED = /\b(caste|castes|religion|religious|hindu|muslim|christian|sikh|sc\/st|obc|male|males|female|females|women|woman|men only|boys only|girls only|gender|disabled|disability|married|unmarried)\b/i;
const CLAIM = /(\d+\s?%\s*(placement|placed|hired)|placement rate|salary|lpa|ctc|job guarantee|guaranteed job|100% placement)/i;
class Component extends DCLogic {
  state = { ctx: null, ctxFor: null, upl: [], drag: false, linkDraft: null };
  fileRef = React.createRef(); evRef = React.createRef();
  componentDidMount() { this.u = HQ.sub(() => this.forceUpdate()); }
  componentWillUnmount() { this.u && this.u(); (this.timers || []).forEach(clearTimeout); }
  later(ms, fn) { (this.timers = this.timers || []).push(setTimeout(fn, ms)); }
  formOf(f) {
    if (f.form) return f.form;
    const bv = k => (f.brief.find(b => b.key === k) || {}).value || '';
    return { title: f.title, link: bv('link'), domain: '', level: '', eligibility: '', duration: '', mode: '', locations: [], batchName: f.batch || 'Batch 1', batchStart: f.release || '', batchEnd: '', screenClose: '', target: '', ceiling: '', regLink: '', budget: '', fee: '', stipend: '', benefits: '', outcome: '', langs: f.language ? [f.language] : [], provider: f.studio || '', competing: '', past: '', src: {} };
  }
  sync(f) {
    const m = f.form, src = m.src || {};
    const set = (k, v, keys) => { const b = f.brief.find(q => q.key === k); if (!b) return; const from = (keys || []).map(q => src[q]).find(Boolean); b.value = v; b.status = !v ? 'Missing' : from ? 'Unconfirmed' : 'Confirmed'; b.source = v ? (from || 'Entered') : ''; b.date = HQ.TODAY; };
    const elig = m.eligibility && PROTECTED.test(m.eligibility) ? '' : m.eligibility;
    set('title', m.title, ['title']); set('link', m.link, ['link']);
    set('domain', m.domain && m.level ? m.domain + ' · ' + m.level : '', ['domain', 'level']);
    set('eligibility', elig, ['eligibility']);
    set('duration', m.duration && m.mode ? m.duration + ' · ' + m.mode : '', ['duration', 'mode']);
    set('locations', (m.locations || []).join(', '), ['locations']);
    set('batch', m.batchStart ? HQ.d(m.batchStart) + (m.batchEnd ? ' – ' + HQ.d(m.batchEnd) : '') + (m.screenClose ? ' · screening closes ' + HQ.ds(m.screenClose) : '') : '', ['batchStart']);
    set('target', m.target && m.ceiling ? m.target + ' screening enrolments · ₹' + (+m.ceiling).toLocaleString('en-IN') + ' per enrolment' : '', ['target', 'ceiling']);
    set('regLink', m.regLink, ['regLink']);
    set('budget', m.budget ? '₹' + m.budget.replace(/^₹/, '') : '', ['budget']); set('fee', [m.fee, m.stipend].filter(Boolean).join(' · '), ['fee', 'stipend']); set('benefits', m.benefits, ['benefits']);
    set('outcome', m.outcome, ['outcome']); set('langs', (m.langs || []).join(' and '), ['langs']);
    set('provider', m.provider, ['provider']); set('competing', m.competing, ['competing']); set('past', m.past, ['past']);
    const ob = f.brief.find(q => q.key === 'outcome'); f.claims = f.claims || [];
    if (m.outcome && CLAIM.test(m.outcome)) { if (ob) ob.status = 'Unconfirmed'; if (!f.claims.some(c => c.text === m.outcome)) f.claims.push({ text: m.outcome, src: src.outcome || 'Course brief', status: 'Awaiting evidence' }); }
    if (m.title) f.title = m.title; if (m.batchStart) f.release = m.batchStart; if (m.batchName) f.batch = m.batchName; f.studio = m.provider || 'Provider not set';
    f.target = +m.target || 0; f.ceiling = +m.ceiling || 0;
    const oc = f.flags.find(g => g.type === 'Outcome claims'); if (oc && oc.status !== 'Refused') { const waiting = f.claims.some(c => c.status === 'Awaiting evidence'); if (waiting) oc.status = 'Under review'; }
  }
  edit(fn) { const id = HQ.film().id; HQ.set(x => { const f = x.films.find(q => q.id === id); f.form = JSON.parse(JSON.stringify(this.formOf(f))); fn(f.form, f); this.sync(f); }); }
  extract(name, kind) {
    const fid = HQ.film().id; const id = HQ.uid('up');
    this.setState(s => ({ upl: s.upl.concat([{ id, name, note: kind === 'link' ? 'Fetching page…' : 'Uploading…', busy: true, icon: kind === 'link' ? '#i-link' : '#i-file' }]) }));
    this.later(700, () => this.setState(s => ({ upl: s.upl.map(u => u.id === id ? Object.assign({}, u, { note: kind === 'image' ? 'Saving image…' : 'Reading text and tying each value to its source…' }) : u) })));
    this.later(1900, () => { let n = 0, claim = false;
      HQ.set(x => { const f = x.films.find(q => q.id === fid); if (!f) return; f.form = JSON.parse(JSON.stringify(this.formOf(f))); const m = f.form; m.src = m.src || {};
        if (kind !== 'image') { const isMfg = /manufact|technician|iti/i.test(f.title);
          const vals = isMfg ? { domain: 'Manufacturing', level: 'Foundation', eligibility: 'ITI or diploma (mechanical, electrical, fitter), passed 2021–2026', duration: '12 weeks', mode: 'In centre', fee: 'No fee', stipend: '₹3,000/month', benefits: 'Apprenticeship with local employers, safety certification', outcome: 'Guaranteed apprenticeship with partner employers', langs: ['Telugu'], competing: 'Govt ITI short courses, TASK manufacturing track' }
            : { domain: 'AI/ML', level: 'Intermediate', eligibility: 'B.Tech/B.E. or MCA, graduated 2022–2026', duration: '16 weeks', mode: 'Hybrid', fee: 'No fee', stipend: '₹2,500/month', benefits: 'Capstone project, mentor hours, certificate', outcome: '85% placement rate', langs: ['Telugu', 'English'], competing: 'TASK AI Bootcamp' };
          Object.keys(vals).forEach(k => { const empty = Array.isArray(m[k]) ? !m[k].length : (m[k] == null || m[k] === ''); if (empty) { m[k] = vals[k]; m.src[k] = name; n++; if (k === 'outcome') claim = true; } });
          this.sync(f); }
        if (kind !== 'link') x.files.unshift({ id: HQ.uid('fl'), filmId: fid, name, size: kind === 'image' ? '1.2 MB' : '2.6 MB', lane: kind === 'image' ? 'Brand assets' : 'Brief material', date: HQ.TODAY, by: 'Anika Rao', status: kind === 'image' ? 'Stored' : 'Extracted' });
        f.activity.unshift({ t: HQ.TODAY + 'T' + new Date().toTimeString().slice(0, 5), text: name + (kind === 'link' ? ' read' : ' uploaded') + (n ? ', ' + n + ' fields filled for confirmation' : ''), kind: 'film' }); });
      this.setState(s => ({ upl: s.upl.map(u => u.id === id ? Object.assign({}, u, { busy: false, done: true, note: n ? n + ' fields filled. Confirm them below.' + (claim ? ' 1 outcome claim held for evidence.' : '') : 'Read. Nothing new to fill.' }) : u) }));
      HQ.toast(n ? name + ': ' + n + ' fields ready to confirm' : name + ' read'); });
  }
  renderVals() {
    if (!window.HQ) return {};
    const s = HQ.s, film = HQ.film(), rd = HQ.readiness(film), r = s.route, st = this.state, m = this.formOf(film), src = m.src || {};
    const tab = r.tab === 'files' ? 'files' : 'overview';
    const myFiles = s.files.filter(f => f.filmId === film.id);
    const claims = film.claims || [];
    const tabs = [['overview', 'Overview', ''], ['files', 'Files', myFiles.length]].map(([k, l, n]) => ({ label: l, n, go: () => HQ.go('brief', { tab: k }), bc: tab === k ? 'var(--teal-600)' : 'transparent', c: tab === k ? 'var(--teal-800)' : 'var(--ink-600)', fw: tab === k ? 600 : 500 }));
    const F = (key, label, o) => Object.assign({ label, help: '', after: '', badge: '', req: false, span: 'auto', ph: '', bd: 'var(--ink-300)', err: '', warn: '', isText: true, isDate: false, isArea: false, isSelect: false, isMulti: false, open: false, summary: '', ddBd: 'var(--ink-300)', ddC: 'var(--ink-900)', opts: [], chips: [], value: m[key] || '', filled: !!src[key], srcName: src[key] ? 'From ' + src[key] : '', confirm: () => this.edit(z => { if (z.src) delete z.src[key]; }), onChange: e => { const v = e.target.value; this.edit(z => { z[key] = v; if (z.src) delete z.src[key]; }); } }, o || {}, o && o.req ? { badge: o.badge || 'REQUIRED' } : {});
    const area = { isText: false, isArea: true, span: '1 / -1' }, date = { isText: false, isDate: true };
    const tgl = (key, v) => () => this.edit(z => { const L = z[key] = (z[key] || []).slice(); const i = L.indexOf(v); if (i >= 0) L.splice(i, 1); else L.push(v); if (z.src) delete z.src[key]; });
    const C = (key, label, opts, o) => { const sel = (m[key] || []).filter(v => opts.includes(v)); return F(key, label, Object.assign({ isText: false, isMulti: true, chips: opts.map(op => ({ label: op, on: (m[key] || []).includes(op), toggle: tgl(key, op) })), open: st.dd === key, toggleOpen: () => this.setState({ dd: st.dd === key ? null : key }), summary: sel.length ? sel.join(', ') : 'Choose one or more', ddC: sel.length ? 'var(--ink-900)' : 'var(--ink-500)', ddBd: st.dd === key ? 'var(--teal-600)' : 'var(--ink-300)' }, o)); };
    const Sel = (key, label, opts, o) => F(key, label, Object.assign({ isText: false, isSelect: true, opts: m[key] && !opts.includes(m[key]) ? [m[key]].concat(opts) : opts }, o));
    const eligBad = m.eligibility && PROTECTED.test(m.eligibility);
    const claimHit = m.outcome && CLAIM.test(m.outcome);
    const groups = [
      { title: 'Course', fields: [
        F('title', 'Course name', { req: true, help: 'Unique per provider.' }),
        F('link', 'Course link', { req: true, help: 'The public course page.', ph: 'provider.org/course' }),
        Sel('domain', 'Skill domain', ['AI/ML', 'Data engineering', 'Software development', 'Cloud', 'Manufacturing', 'Electronics', 'Healthcare', 'Retail'], { req: true }),
        Sel('level', 'Level', ['Foundation', 'Intermediate', 'Advanced'], { req: true, after: 'Stops an advanced course reaching a cohort that cannot enter it.' }),
        F('eligibility', 'Eligibility', Object.assign({ req: true, help: 'Qualification, graduation years, marks. Protected attributes are not allowed (RR-H02).', bd: eligBad ? 'var(--danger-600)' : 'var(--ink-300)', err: eligBad ? 'Blocked: eligibility cannot use caste, religion, gender, disability or another protected attribute. Escalated to the fairness reviewer (' + ((s.team.find(t => t.role === 'Fairness reviewer') || {}).name || 'reviewer') + '). This field stays unconfirmed until it is changed.' : '' }, area)),
        F('duration', 'Duration', { req: true, ph: 'e.g. 16 weeks' }),
        Sel('mode', 'Mode', ['Online', 'Hybrid', 'In centre'], { req: true }),
        C('locations', 'Target area', ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Maharashtra', 'Odisha', 'West Bengal', 'Gujarat', 'Rajasthan', 'Madhya Pradesh', 'Uttar Pradesh', 'Bihar', 'Delhi', 'Punjab', 'Haryana'], { req: true, after: 'States where you want to reach candidates. Select one or more.' })] },
      { title: 'Batch and target', fields: [
        F('batchName', 'Batch', { ph: 'e.g. Batch 4' }),
        F('batchStart', 'Batch start date', Object.assign({ req: true, help: 'Every recommendation is relative to it.' }, date)),
        F('batchEnd', 'Batch end date', date),
        F('screenClose', 'Screening closes', Object.assign({ help: 'Last day for Resolence screening enrolment.' }, date)),
        F('target', 'Enrolment target', { req: true, ph: 'e.g. 300', help: 'Screening enrolments for this batch.' }),
        F('ceiling', 'Cost ceiling per enrolment (₹)', { req: true, ph: 'e.g. 4500' }),
        F('regLink', 'Registration link (Resolence)', { req: true, badge: 'BLOCKS CREATE CAMPAIGN', span: '1 / -1', ph: 'resolence.in/r/…', help: 'Every post gets a source-tagged version of this link so enrolments can be attributed.' })] },
      { title: 'Offer', bd: '1px solid var(--ink-100)', pad: '20px', fields: [
        F('budget', 'Budget (₹)', { ph: 'e.g. 18,00,000' }), F('fee', 'Fee', { ph: 'e.g. No fee' }), F('stipend', 'Stipend', { ph: 'e.g. ₹2,500/month' }),
        F('benefits', 'Benefits', Object.assign({}, area, { ph: 'Capstone, mentoring, certificate' })),
        F('outcome', 'Outcome promise', Object.assign({ help: 'Placement, salary or job claims need Observed evidence before any content can use them (RR-H03).', warn: claimHit ? 'Held as a claim awaiting evidence. Attach evidence on the Governance tab.' : '' }, area)),
        C('langs', 'Languages of instruction', ['Telugu', 'English', 'Hindi', 'Urdu', 'Kannada'])] },
      { title: 'Context', fields: [F('provider', 'Provider'), F('competing', 'Competing programmes', { help: 'Other programmes the same cohort is considering.' }), F('past', 'Past batch results', { ph: 'e.g. Batch 3: 46 enrolments from 50 target' })] }
    ].map(g => Object.assign({ bd: '0', pad: '0' }, g));
    const unconf = Object.keys(src).filter(k => src[k]);
    const flagHelp = { 'Outcome claims': 'Placement rates, salary figures or job guarantees in the brief or files.', 'Institution endorsement': 'Any college, ITI or placement cell named as a partner needs a consent record (RR-H06).', 'Paid promotion': 'Paid items must carry the platform disclosure tag (RR-H04).' };
    const ctxVal = st.ctxFor === film.id && st.ctx != null ? st.ctx : (film.context || '');
    const blockNote = rd.refused ? 'Create campaign is blocked: a governance flag is Refused.' : rd.noRegLink ? 'Create campaign is blocked until the Resolence registration link is confirmed.' : rd.missing.length ? rd.missing.length + ' required field' + (rd.missing.length > 1 ? 's' : '') + ' still to confirm: ' + rd.missing.map(q => q.label).join(', ') + '.' : '';
    return {
      title: film.title, sub: (film.batch || 'Batch 1') + ' · starts ' + HQ.d(film.release) + ' · ' + film.studio, back: () => HQ.go('dashboard'), tabs, tOver: tab === 'overview', tGov: tab === 'governance', tFiles: tab === 'files', blockNote,
      rd: { ok: rd.ok, req: rd.req, pct: rd.pct, color: rd.pct === 100 ? 'var(--success-600)' : 'var(--warning-600)' },
      fileRef: this.fileRef, evRef: this.evRef, pickFiles: () => this.fileRef.current && this.fileRef.current.click(),
      onFiles: e => { Array.from(e.target.files || []).forEach(file => this.extract(file.name, /\.(png|jpe?g|webp|gif)$/i.test(file.name) ? 'image' : 'doc')); e.target.value = ''; },
      dragOver: e => { e.preventDefault(); if (!st.drag) this.setState({ drag: true }); }, dragLeave: () => this.setState({ drag: false }), onDrop: e => { e.preventDefault(); this.setState({ drag: false }); Array.from(e.dataTransfer.files || []).forEach(file => this.extract(file.name, /\.(png|jpe?g|webp|gif)$/i.test(file.name) ? 'image' : 'doc')); },
      dzBorder: st.drag ? 'var(--teal-600)' : 'var(--ink-200)', dzBg: st.drag ? 'var(--teal-50)' : '#fff',
      useSample: e => { e.stopPropagation(); this.extract(film.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-brochure.pdf', 'doc'); },
      linkDraft: st.linkDraft != null ? st.linkDraft : (m.link || ''), setLinkDraft: e => this.setState({ linkDraft: e.target.value }),
      readLink: () => { const v = (st.linkDraft != null ? st.linkDraft : m.link || '').trim(); if (!v) return HQ.toast('Paste the course link first', 'error'); if (v !== m.link) this.edit(z => { z.link = v.replace(/^https?:\/\//, ''); }); this.extract(v.replace(/^https?:\/\//, ''), 'link'); },
      upl: st.upl.map(u => ({ name: u.name, note: u.note, busy: !!u.busy, done: !!u.done, icon: u.icon || '#i-file' })),
      hasUnconf: unconf.length > 0, unconfCount: unconf.length, confirmAll: () => { this.edit(z => { z.src = {}; }); HQ.toast(unconf.length + ' values confirmed'); },
      groups,
      flags: film.flags.map((g, i) => ({ type: g.type, status: g.status, st: HQ.tone(g.status), note: g.note || '', help: flagHelp[g.type] || '', setStatus: e => { const v = e.target.value; HQ.set(x => { x.films.find(q => q.id === film.id).flags[i].status = v; }); HQ.toast(g.type + ' set to ' + v); }, setNote: e => { const v = e.target.value; HQ.set(x => { x.films.find(q => q.id === film.id).flags[i].note = v; }); } })),
      noClaims: !claims.length,
      claims: claims.map((c, i) => ({ text: c.text, src: c.src, status: c.status, st: HQ.tone(c.status === 'Evidence attached' ? 'Observed' : c.status), evNote: c.evidence ? ' · evidence: ' + c.evidence : '', canAttach: c.status === 'Awaiting evidence', attach: () => { this.evIdx = i; this.evRef.current && this.evRef.current.click(); } })),
      onEvidence: e => { const file = (e.target.files || [])[0]; e.target.value = ''; if (!file) return; const i = this.evIdx; HQ.set(x => { const f = x.films.find(q => q.id === film.id); const c = f.claims[i]; c.status = 'Evidence attached'; c.evidence = file.name + ' (Observed)'; const ob = f.brief.find(q => q.key === 'outcome'); if (ob && ob.value) ob.status = 'Confirmed'; if (!f.claims.some(q => q.status === 'Awaiting evidence')) { const oc = f.flags.find(g => g.type === 'Outcome claims'); if (oc && oc.status === 'Under review') oc.status = 'Cleared'; } x.files.unshift({ id: HQ.uid('fl'), filmId: f.id, name: file.name, size: file.size > 1e6 ? (file.size / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(file.size / 1e3)) + ' KB', lane: 'Brief material', date: HQ.TODAY, by: 'Anika Rao', status: 'Stored' }); }); HQ.toast('Evidence attached. Claim can now be used in content.'); },
      hasEsc: eligBad, escs: eligBad ? [{ field: 'Eligibility', text: m.eligibility, meta: 'Logged ' + HQ.d(HQ.TODAY) + ' · basis RR-H02 · routed to fairness reviewer' }] : [],
      ctx: ctxVal, setCtx: e => this.setState({ ctx: e.target.value, ctxFor: film.id }), ctxNote: film.context ? 'Saved' : 'Not saved yet',
      saveCtx: () => { HQ.set(x => { x.films.find(q => q.id === film.id).context = ctxVal.trim(); }); this.setState({ ctx: null, ctxFor: null }); HQ.toast('Context saved'); },
      noFiles: !myFiles.length,
      files: myFiles.map(f => ({ name: f.name, meta: f.size + ' · ' + HQ.ds(f.date) + ' · ' + f.by + ' · ' + f.status, icon: /\.(png|jpe?g|webp|gif)$/i.test(f.name) ? '#i-image' : '#i-file', del: () => { HQ.set(x => { x.files = x.files.filter(q => q.id !== f.id); }); HQ.toast('Deleted ' + f.name); } }))
    };
  }
}
