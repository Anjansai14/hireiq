import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useApp, useLoad } from '../lib/app';
import { d, n } from '../lib/format';
import { Avatar, Badge, Card, Empty, ErrorBox, Kpi, Loading, Select } from '../components/ui';

export default function CreatorBank() {
  const { opts } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ q: '', platform: '', type: '', status: '', filter: sp.get('filter') || '' });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data, loading, error, reload } = useLoad(() => api.get(`/sources?${qs}`), [qs]);
  const [run, busy] = useAction();
  const fileRef = useRef();
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const failed = data.filter((s) => ['Failed', 'Partial'].includes(s.status)).length;

  const importCsv = async (file) => {
    const fd = new FormData(); fd.append('file', file);
    const r = await run(() => api.post('/sources/import', fd));
    if (r) { alert(`Imported: ${r.created} new, ${r.merged} merged${r.errors.length ? `, ${r.errors.length} rows with errors` : ''}`); reload(); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Creator Bank</h1><div className="muted">Influence sources for Hire IQ: creators, college networks, placement cells, alumni, trainers and community leaders. Enriched from official APIs and refreshed monthly. No scraping.</div></div>
        <div className="row">
          {failed > 0 && <button className="btn" disabled={busy} onClick={() => run(() => api.post('/sources/refresh-failed'), 'Agent A3 retried failed profiles').then(reload)}>Retry failed ({failed})</button>}
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files[0] && importCsv(e.target.files[0])} />
          <button className="btn primary" onClick={() => fileRef.current.click()}>Import sources (CSV)</button>
        </div>
      </div>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Kpi l="Sources" v={data.length} sub="in this view" />
        <Kpi l="Institutional" v={data.filter((s) => s.institutional).length} sub={`${data.filter((s) => s.institutional && s.consent !== 'Recorded').length} without consent`} />
        <Kpi l="Gated" v={data.filter((s) => s.gate).length} sub="cannot be booked now" />
        <Kpi l="Attributed enrolments" v={data.reduce((a, s) => a + (s.attributed || 0), 0)} sub="past batches" stamp="Observed" />
      </div>
      <Card>
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input" style={{ maxWidth: 240 }} placeholder="Search name or handle" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <div style={{ width: 160 }}><Select value={f.platform} options={opts('platform')} placeholder="All platforms" onChange={(v) => setF({ ...f, platform: v })} /></div>
          <div style={{ width: 180 }}><Select value={f.type} options={opts('source_type')} placeholder="All types" onChange={(v) => setF({ ...f, type: v })} /></div>
          <button className={`chip ${f.filter === 'attention' ? 'on' : ''}`} onClick={() => setF({ ...f, filter: f.filter ? '' : 'attention' })}>Needs attention</button>
          {Object.values(f).some(Boolean) && <a onClick={() => setF({ q: '', platform: '', type: '', status: '', filter: '' })}>Clear filters</a>}
        </div>
        {data.length ? (
          <table>
            <thead><tr><th>Source</th><th>Type</th><th>Platform</th><th>Followers</th><th>ER</th><th>District</th><th>Skill domains</th><th>Affiliation</th><th>Enrolments</th><th>Consent</th><th>Enrichment</th><th>Updated</th></tr></thead>
            <tbody>{data.map((s) => (
              <tr key={s.id} className="click" onClick={() => nav(`/creators/${s.id}`)}>
                <td><div className="row"><Avatar name={s.name} id={s.id} /><div><b>{s.name}</b> {s.gate && <Badge s="Blocked">Gate</Badge>}<div className="small muted">{s.handle}</div></div></div></td>
                <td className="small">{s.type}</td><td>{s.platform}</td><td>{s.catchment ? <span title="catchment (uploaded)">{n(s.catchment)}*</span> : n(s.followers)}</td><td>{s.er ? `${s.er}%` : '—'}</td>
                <td className="small">{s.district}</td><td className="small">{(s.skills || []).join(', ')}</td><td className="small">{s.affiliation || '—'}</td><td>{s.attributed || 0}</td>
                <td><Badge s={s.consent} /></td><td><Badge s={s.status} /></td><td className="small">{d(s.updated_on)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <Empty>No sources match these filters.</Empty>}
        <p className="small muted" style={{ marginTop: 10 }}>CSV columns: name, handle, platform, type, followers, median_views, er, rate, district, language, affiliation, catchment</p>
      </Card>
    </>
  );
}
