import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useApp } from '../lib/app';
import { d } from '../lib/format';
import { AlertRow, Avatar, Field, Modal, Select } from './ui';

const NAV = [['/', 'Dashboard', '⌂'], ['/campaigns', 'Campaigns', '◎'], ['/copilot', 'Copilot', '✦'], ['/files', 'Artifacts', '▤']];

export const linkFor = (l) => ({
  brief: `/brief${l.tab ? '?tab=' + l.tab : ''}`, campaign: `/campaigns/${l.id}${l.tab ? '?tab=' + l.tab : ''}`,
  influencer: `/campaigns/${l.campaignId}/sources/${l.ccId}`, settings: `/settings/${l.tab || 'connectors'}`, creators: `/creators${l.filter ? '?filter=' + l.filter : ''}`,
}[l.page] || '/');

export default function Layout() {
  const { user, course, courses, setCourseId, logout, refreshCourses, opts, toast } = useApp();
  const [menu, setMenu] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [newCourse, setNewCourse] = useState(null);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (course?.id) api.get(`/courses/${course.id}/alerts`).then((r) => setAlerts(r.alerts)).catch(() => {});
  }, [course?.id, loc.pathname]);
  useEffect(() => setMenu(null), [loc.pathname]);

  const create = async () => {
    try {
      const c = await api.post('/courses', newCourse);
      await refreshCourses();
      setCourseId(c.id);
      setNewCourse(null);
      toast('Course created. Upload a brochure to fill the brief.');
      nav('/brief');
    } catch (e) { toast(e.message, 'error'); }
  };

  const crumbs = loc.pathname.split('/').filter(Boolean);
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="dot">IQ</span>Influence IQ <small>Hire IQ</small></div>
        <div className="course-switch" style={{ position: 'relative' }}>
          <div className="small muted">Course</div>
          <button className="btn sm" style={{ width: '100%', justifyContent: 'space-between', marginTop: 4 }} onClick={() => setMenu(menu === 'course' ? null : 'course')}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{course?.title || 'No course'}</span> ▾
          </button>
          {course && <div className="small muted" style={{ marginTop: 4 }}>{course.batch} · starts {d(course.batch_start)}</div>}
          {menu === 'course' && (
            <div className="dropdown" style={{ top: '100%', left: 0 }}>
              {courses.map((c) => <a key={c.id} className="item" onClick={() => { setCourseId(c.id); setMenu(null); nav('/'); }}><b>{c.title}</b><div className="small muted">{c.batch} · {c.readiness.ok}/{c.readiness.req} brief ready</div></a>)}
              <a className="item" onClick={() => { setNewCourse({ title: '', link: '', language: '', batch_start: '' }); setMenu(null); }}>＋ New course</a>
            </div>
          )}
        </div>
        {NAV.map(([to, label, ic]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive || (to === '/' && loc.pathname === '/brief') ? 'active' : ''}`}><span>{ic}</span>{label}</NavLink>)}
        <div className="spacer" />
        <NavLink to="/creators" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><span>☺</span>Creator Bank</NavLink>
        <NavLink to="/settings/connectors" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><span>⚙</span>Settings</NavLink>
        <div style={{ position: 'relative' }}>
          <button className="nav-item" style={{ border: 'none', background: 'none', width: '100%' }} onClick={() => setMenu(menu === 'acct' ? null : 'acct')}>
            <Avatar name={user?.name} id={user?.id} size={26} /><span style={{ textAlign: 'left' }}><div style={{ fontWeight: 600 }}>{user?.name}</div><div className="small muted">{user?.title}</div></span>
          </button>
          {menu === 'acct' && (
            <div className="dropdown" style={{ bottom: '100%', left: 0 }}>
              <div className="item small muted">{user?.email} · {user?.role}</div>
              <a className="item" onClick={() => nav('/settings/profile')}>Profile</a>
              <a className="item" style={{ color: 'var(--danger-600)' }} onClick={logout}>Sign out</a>
            </div>
          )}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="crumbs"><span>{course?.title}</span>{crumbs.map((c, i) => <span key={i}>/ {i === crumbs.length - 1 ? <b>{c}</b> : c}</span>)}</div>
          <div style={{ position: 'relative' }}>
            <button className="btn sm" onClick={() => setMenu(menu === 'bell' ? null : 'bell')}>🔔 {alerts.length ? <span className="badge" style={{ background: 'var(--danger-100)', color: 'var(--danger-800)' }}>{alerts.length}</span> : null}</button>
            {menu === 'bell' && (
              <div className="dropdown" style={{ right: 0, top: '110%', width: 420 }}>
                <div className="item"><b>Needs attention</b></div>
                {alerts.length ? alerts.map((a, i) => <div key={i} style={{ marginTop: 6 }}><AlertRow {...a} onClick={() => nav(linkFor(a.link))} /></div>) : <div className="item muted">All clear</div>}
              </div>
            )}
          </div>
          <button className="btn sm" onClick={() => nav('/copilot')}>✦ Copilot</button>
        </header>
        <main className="content">
          {course ? <Outlet /> : (
            <div className="empty card"><h2>No courses yet</h2><p className="muted" style={{ margin: '8px 0 16px' }}>Add a course to start a brief and plan cohort campaigns.</p>
              <button className="btn primary" onClick={() => setNewCourse({ title: '', link: '', language: '', batch_start: '' })}>＋ New course</button></div>
          )}
        </main>
      </div>
      {newCourse && (
        <Modal title="Add a course" onClose={() => setNewCourse(null)} footer={<><button className="btn" onClick={() => setNewCourse(null)}>Cancel</button><button className="btn primary" disabled={!newCourse.title} onClick={create}>Create course</button></>}>
          <p className="muted small" style={{ marginBottom: 12 }}>Everything else can come later. Agent A1 can read the course link or brochure on the next page.</p>
          <div className="stack">
            <Field label="Course name" req><input className="input" value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })} /></Field>
            <Field label="Course link"><input className="input" placeholder="provider.org/course" value={newCourse.link} onChange={(e) => setNewCourse({ ...newCourse, link: e.target.value })} /></Field>
            <Field label="Language"><Select value={newCourse.language} options={opts('language')} onChange={(v) => setNewCourse({ ...newCourse, language: v })} /></Field>
            <Field label="Batch start date"><input type="date" className="input" value={newCourse.batch_start} onChange={(e) => setNewCourse({ ...newCourse, batch_start: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
