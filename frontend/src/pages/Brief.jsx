import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useApp, useLoad } from '../lib/app';
import { d } from '../lib/format';
import { AgentLoader, Badge, Card, Chips, ErrorBox, Field, Loading, Select, Tabs } from '../components/ui';

export default function Brief() {
  const { courseId, opts, lookup, refreshCourses } = useApp();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'overview';
  const { data: c, loading, error, setData } = useLoad(() => api.get(`/courses/${courseId}`), [courseId]);
  const [form, setForm] = useState(null);
  const [run, busy] = useAction();
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef();
  const evRef = useRef();
  const [evFor, setEvFor] = useState(null);

  useEffect(() => { if (c) setForm(c.form); }, [c]);
  if (loading && !c) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!form) return null;
  const src = c.form_src || {};
  const rd = c.readiness;

  const save = async (values) => {
    const r = await run(() => api.patch(`/courses/${courseId}/form`, { values }));
    if (r) { setData(r); refreshCourses(); }
  };
  const set = (k, v, commit) => { setForm({ ...form, [k]: v }); if (commit) save({ [k]: v }); };
  const blur = (k) => () => { if (JSON.stringify(form[k]) !== JSON.stringify(c.form[k])) save({ [k]: form[k] }); };
  const extract = async (file, sample) => {
    setExtracting(true);
    const fd = new FormData();
    if (file) fd.append('file', file); else fd.append('sample', String(!!sample));
    const r = await run(() => api.post(`/courses/${courseId}/extract`, fd), 'Agent A1 filled the brief. Confirm each value marked From file.');
    setExtracting(false);
    if (r) { setData(r.course); }
  };
  const confirmAll = async () => { const r = await run(() => api.post(`/courses/${courseId}/confirm`, {}), 'All extracted values confirmed'); if (r) { setData(r); refreshCourses(); } };
  const confirm = (k) => async () => { const r = await run(() => api.post(`/courses/${courseId}/confirm`, { keys: [k] })); if (r) setData(r); };
  const attach = async (file) => {
    const fd = new FormData(); fd.append('file', file);
    const r = await run(() => api.post(`/courses/${courseId}/claims/${evFor}/evidence`, fd), 'Evidence attached; claim is now usable');
    if (r) setData(r);
  };

  const FromFile = ({ k }) => (src[k] ? <span className="badge" style={{ background: 'var(--warning-100)', color: 'var(--warning-800)' }}>From {src[k]} <a onClick={confirm(k)}>Confirm</a></span> : null);
  const T = (k, label, o = {}) => (
    <Field label={label} req={o.req} help={o.help} badge={<FromFile k={k} />}>
      {o.area ? <textarea className="input" value={form[k] || ''} onChange={(e) => set(k, e.target.value)} onBlur={blur(k)} placeholder={o.ph} />
        : <input className="input" type={o.date ? 'date' : 'text'} value={form[k] || ''} onChange={(e) => set(k, e.target.value)} onBlur={blur(k)} placeholder={o.ph} />}
    </Field>
  );
  const S = (k, label, cat, o = {}) => <Field label={label} req={o.req} help={o.help} badge={<FromFile k={k} />}><Select value={form[k]} options={opts(cat)} onChange={(v) => set(k, v, true)} /></Field>;
  const M = (k, label, cat, o = {}) => <Field label={label} req={o.req} help={o.help} badge={<FromFile k={k} />}><Chips value={form[k] || []} options={opts(cat)} onChange={(v) => set(k, v, true)} /></Field>;
  const flagHelp = Object.fromEntries(lookup('flag_type').map((f) => [f.code, f.meta?.help]));
  const unconf = Object.keys(src).length;

  return (
    <>
      <div className="page-head">
        <div><div className="small muted">{c.batch} · starts {d(c.batch_start)} · {c.provider}</div><h1>{c.title}</h1></div>
        <div className="card" style={{ padding: '8px 14px' }}><div className="small muted">Required fields</div><b>{rd.ok}/{rd.req}</b></div>
      </div>
      {(rd.refused || rd.noRegLink || rd.missing.length > 0) && (
        <div className="alert" style={{ background: 'var(--warning-100)', color: 'var(--warning-800)', marginBottom: 16 }}>
          {rd.refused ? 'Create campaign is blocked: a governance flag is Refused.' : rd.noRegLink ? 'Create campaign is blocked until the Resolence registration link is confirmed.' : `${rd.missing.length} required fields still to confirm: ${rd.missing.map((m) => m.label).join(', ')}.`}
        </div>
      )}
      <Tabs value={tab} onChange={(t) => setSp({ tab: t })} tabs={[['overview', 'Overview'], ['governance', 'Governance', c.claims.filter((q) => q.status === 'Awaiting evidence').length || ''], ['files', 'Files', c.files.length]]} />

      {tab === 'overview' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 320px' }}>
          <div>
            {extracting ? <AgentLoader title="Reading the file" agent="Agent A1 · Brief Extractor" steps={['Extracting text from pages', 'Matching fields to the brief', 'Holding outcome claims (RR-H03)', 'Screening eligibility (RR-H02)']} /> : (
              <Card title="Read the course link or brochure">
                <p className="muted small" style={{ marginBottom: 10 }}>Agent A1 reads PDFs or text and fills fields marked From file. Nothing is used until you confirm it. Placement or salary figures are captured as claims awaiting evidence.</p>
                <div className="row">
                  <input ref={fileRef} type="file" hidden accept=".pdf,.txt,.md" onChange={(e) => e.target.files[0] && extract(e.target.files[0])} />
                  <button className="btn primary" onClick={() => fileRef.current.click()}>Upload brochure or syllabus</button>
                  <button className="btn" onClick={() => extract(null, true)}>Use sample brochure</button>
                  {unconf > 0 && <button className="btn" onClick={confirmAll}>Confirm all {unconf} values</button>}
                </div>
              </Card>
            )}
            <Card title="Course">
              <div className="grid g2">
                {T('title', 'Course name', { req: true, help: 'Unique per provider.' })}
                {T('link', 'Course link', { req: true, ph: 'provider.org/course' })}
                {S('domain', 'Skill domain', 'course_domain', { req: true })}
                {S('level', 'Level', 'course_level', { req: true, help: 'Stops an advanced course reaching a cohort that cannot enter it.' })}
              </div>
              <div style={{ marginTop: 12 }}>{T('eligibility', 'Eligibility', { req: true, area: true, help: 'Qualification, graduation years, marks. Protected attributes are not allowed (RR-H02).' })}</div>
              <div className="grid g2" style={{ marginTop: 12 }}>
                {T('duration', 'Duration', { req: true, ph: 'e.g. 16 weeks' })}
                {S('mode', 'Mode', 'course_mode', { req: true })}
              </div>
              <div style={{ marginTop: 12 }}>{M('locations', 'Delivery locations', 'district', { req: true, help: 'Districts with a delivery centre. Campaigns outside these are flagged.' })}</div>
            </Card>
            <Card title="Batch and target">
              <div className="grid g3">
                {T('batchName', 'Batch', { ph: 'e.g. Batch 4' })}
                {T('batchStart', 'Batch start date', { req: true, date: true })}
                {T('batchEnd', 'Batch end date', { date: true })}
                {T('screenClose', 'Screening closes', { date: true })}
                {T('target', 'Enrolment target', { req: true, ph: 'e.g. 300' })}
                {T('ceiling', 'Cost ceiling per enrolment (₹)', { req: true, ph: 'e.g. 4500' })}
              </div>
              <div style={{ marginTop: 12 }}>{T('regLink', 'Registration link (Resolence)', { req: true, ph: 'resolence.in/r/…', help: 'Every post gets a source-tagged version of this link so enrolments can be attributed. BLOCKS CREATE CAMPAIGN.' })}</div>
            </Card>
            <Card title="Offer">
              <div className="grid g3">{T('budget', 'Budget (₹)', { ph: '18,00,000' })}{T('fee', 'Fee', { ph: 'No fee' })}{T('stipend', 'Stipend', { ph: '₹2,500/month' })}</div>
              <div style={{ marginTop: 12 }}>{T('benefits', 'Benefits', { area: true })}</div>
              <div style={{ marginTop: 12 }}>{T('outcome', 'Outcome promise', { area: true, help: 'Placement, salary or job claims need Observed evidence before any content can use them (RR-H03).' })}</div>
              <div style={{ marginTop: 12 }}>{M('langs', 'Languages of instruction', 'language')}</div>
            </Card>
            <Card title="Context">
              <div className="grid g3">{T('provider', 'Provider')}{T('competing', 'Competing programmes', { help: 'Other programmes the same cohort is considering.' })}{T('past', 'Past batch results')}</div>
            </Card>
          </div>
          <div>
            <Card title="Brief readiness">
              {c.fields.map((f) => (
                <div key={f.field_key} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--ink-50)' }}>
                  <span className="small">{f.label}{f.tier === 'req' && ' *'}</span><Badge s={f.status} />
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {tab === 'governance' && (
        <>
          <Card title="Governance flags">
            {c.flags.map((f) => (
              <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--ink-50)' }}>
                <div className="row"><b>{f.type}</b><Badge s={f.status} /></div>
                <div className="small muted">{flagHelp[f.type]}</div>
                {f.note && <div className="small" style={{ marginTop: 4 }}>{f.note}</div>}
              </div>
            ))}
          </Card>
          <Card title="Outcome claims (RR-H03)">
            <input ref={evRef} type="file" hidden onChange={(e) => e.target.files[0] && attach(e.target.files[0])} />
            {c.claims.length ? c.claims.map((q) => (
              <div key={q.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--ink-50)' }}>
                <div><b>“{q.text}”</b><div className="small muted">{q.source}</div></div>
                <div className="row"><Badge s={q.status} />{q.status === 'Awaiting evidence' && <button className="btn sm" disabled={busy} onClick={() => { setEvFor(q.id); evRef.current.click(); }}>Attach evidence</button>}</div>
              </div>
            )) : <div className="muted">No outcome claims found.</div>}
          </Card>
        </>
      )}

      {tab === 'files' && (
        <Card title="Files">
          <table><thead><tr><th>Name</th><th>Lane</th><th>Date</th><th>By</th><th>Status</th></tr></thead>
            <tbody>{c.files.map((f) => <tr key={f.id}><td>{f.name}</td><td>{f.lane}</td><td>{d(f.date)}</td><td>{f.by_user}</td><td><Badge s={f.status} /></td></tr>)}</tbody></table>
        </Card>
      )}
    </>
  );
}
