import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useApp, useLoad } from '../lib/app';
import { d, inrL } from '../lib/format';
import { Badge, Card, Empty, ErrorBox, Loading, Modal } from '../components/ui';

export default function Campaigns() {
  const { courseId, course } = useApp();
  const nav = useNavigate();
  const { data, loading, error, reload } = useLoad(() => api.get(`/campaigns?course=${courseId}`), [courseId]);
  const [filter, setFilter] = useState('All');
  const [del, setDel] = useState(null);
  const [run, busy] = useAction();
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const counts = ['All', 'Live', 'Draft', 'Closed'].map((f) => [f, f === 'All' ? data.length : data.filter((c) => c.status === f).length]);
  const rows = data.filter((c) => filter === 'All' || c.status === filter);
  const create = async () => { const r = await run(() => api.post('/campaigns', { course_id: courseId, name: 'New campaign' })); if (r) nav(`/campaigns/${r.campaign.id}/wizard`); };
  const remove = async () => { await run(() => api.del(`/campaigns/${del.id}`), 'Draft deleted'); setDel(null); reload(); };

  return (
    <>
      <div className="page-head">
        <div><h1>Campaigns</h1><div className="muted">{course?.title} · one cohort in one geography for one course batch</div></div>
        <button className="btn primary" onClick={create} disabled={busy}>＋ New campaign</button>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        {counts.map(([f, n]) => <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f} {n}</button>)}
      </div>
      <Card>
        {rows.length ? (
          <table>
            <thead><tr><th>Campaign</th><th>Objective</th><th>Cohort</th><th>Window</th><th>Sources</th><th>Enrolments</th><th>Spend</th><th>Verdict</th><th /></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="click" onClick={() => nav(c.status === 'Draft' ? `/campaigns/${c.id}/wizard` : `/campaigns/${c.id}`)}>
                  <td><b>{c.name}</b> <Badge s={c.status} /><div className="small muted">{c.status === 'Draft' ? `Wizard step ${(c.wizard_step ?? 0) + 1} of 6` : `Plan v${c.version}`}</div></td>
                  <td>{c.objective}</td>
                  <td className="small">{c.asset || '—'}</td>
                  <td className="small">{d(c.start_date)} – {d(c.end_date)}</td>
                  <td>{c.sources}</td>
                  <td><b>{c.enrols}</b>{c.target ? <span className="small muted"> / {c.target}</span> : null}</td>
                  <td>{inrL(c.spent)}</td>
                  <td>{c.verdict ? <Badge s={c.verdict} /> : '—'}</td>
                  <td>{c.status === 'Draft' && <button className="btn sm danger" onClick={(e) => { e.stopPropagation(); setDel(c); }}>Delete</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No campaigns match. <a onClick={() => setFilter('All')}>Clear filters</a></Empty>}
      </Card>
      {del && <Modal title="Delete draft?" onClose={() => setDel(null)} footer={<><button className="btn" onClick={() => setDel(null)}>Cancel</button><button className="btn primary" style={{ background: 'var(--danger-600)', borderColor: 'var(--danger-600)' }} onClick={remove}>Delete draft</button></>}>
        <p>“{del.name}” and its wizard progress will be removed. This can't be undone.</p>
      </Modal>}
    </>
  );
}
