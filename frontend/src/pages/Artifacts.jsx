import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAction, useApp, useLoad } from '../lib/app';
import { d } from '../lib/format';
import { Badge, Card, Empty, Loading, Select } from '../components/ui';

export default function Artifacts() {
  const { courseId, course, opts } = useApp();
  const { data, loading, reload } = useLoad(() => api.get(`/files?course=${courseId}`), [courseId]);
  const [lane, setLane] = useState('All');
  const [upLane, setUpLane] = useState('Brand assets');
  const [sel, setSel] = useState(null);
  const [run] = useAction();
  const ref = useRef();
  if (loading && !data) return <Loading />;
  const lanes = ['All', ...opts('file_lane')];
  const rows = data.filter((f) => lane === 'All' || f.lane === lane);
  const upload = async (file) => {
    const fd = new FormData(); fd.append('file', file); fd.append('course_id', courseId); fd.append('lane', upLane);
    if (await run(() => api.post('/files', fd), 'Uploaded')) reload();
  };
  const download = async (f) => {
    const r = await fetch(`/api/files/${f.id}/download`, { headers: { Authorization: `Bearer ${api.token.get()}` } });
    if (!r.ok) return alert((await r.json()).error);
    const u = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = u; a.download = f.name; a.click();
  };
  return (
    <>
      <div className="page-head">
        <div><h1>Artifacts</h1><div className="muted">{course?.title} · everything uploaded or generated for this course</div></div>
        <div className="row"><div style={{ width: 180 }}><Select value={upLane} options={opts('file_lane')} onChange={setUpLane} /></div><input type="file" hidden ref={ref} onChange={(e) => e.target.files[0] && upload(e.target.files[0])} /><button className="btn primary" onClick={() => ref.current.click()}>Upload file</button></div>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>{lanes.map((l) => <button key={l} className={`chip ${lane === l ? 'on' : ''}`} onClick={() => setLane(l)}>{l} {l === 'All' ? data.length : data.filter((f) => f.lane === l).length}</button>)}</div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 340px' }}>
        <Card>
          {rows.length ? <table><thead><tr><th>Name</th><th>Lane</th><th>Date</th><th>By</th><th>Status</th></tr></thead>
            <tbody>{rows.map((f) => <tr key={f.id} className="click" onClick={() => setSel(f)}><td><b>{f.name}</b><div className="small muted">{f.size_label}</div></td><td>{f.lane}</td><td>{d(f.date)}</td><td>{f.by_user}</td><td><Badge s={f.status} /></td></tr>)}</tbody></table>
            : <Empty>Nothing here yet. Ask Copilot to generate one.</Empty>}
        </Card>
        {sel && <Card title={sel.name}>
          <dl className="kv" style={{ gridTemplateColumns: '80px 1fr' }}><dt>Lane</dt><dd>{sel.lane}</dd><dt>Status</dt><dd>{sel.status}</dd><dt>By</dt><dd>{sel.by_user}</dd><dt>Date</dt><dd>{d(sel.date)}</dd>{sel.prompt && <><dt>Prompt</dt><dd>{sel.prompt}</dd></>}</dl>
          <div className="row" style={{ marginTop: 12 }}><button className="btn" onClick={() => download(sel)}>Download</button><button className="btn danger" onClick={async () => { await run(() => api.del(`/files/${sel.id}`), 'Deleted'); setSel(null); reload(); }}>Delete</button></div>
        </Card>}
      </div>
    </>
  );
}
