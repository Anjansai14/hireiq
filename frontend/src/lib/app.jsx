/** App-wide state: signed-in user, DB lookups, current course, toasts. */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseIdState] = useState(() => { try { return localStorage.getItem('hireiq_course'); } catch { return null; } });
  const [toastMsg, setToast] = useState(null);
  const [ready, setReady] = useState(false);

  const toast = useCallback((text, kind = 'ok') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), kind === 'error' ? 6000 : 3500);
  }, []);

  const setCourseId = (id) => { setCourseIdState(id); try { localStorage.setItem('hireiq_course', id); } catch { /* ignore */ } };

  const refreshCourses = useCallback(async () => {
    const list = await api.get('/courses');
    setCourses(list);
    if (!list.find((c) => c.id === courseId) && list[0]) setCourseId(list[0].id);
    return list;
  }, [courseId]);

  useEffect(() => {
    (async () => {
      if (!api.token.get()) { setReady(true); return; }
      try {
        const me = await api.get('/auth/me');
        setUser(me.user);
        setCfg(await api.get('/lookups'));
        await refreshCourses();
      } catch { api.token.set(null); }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    api.token.set(r.token);
    setUser(r.user);
    setCfg(await api.get('/lookups'));
    await refreshCourses();
  };
  const logout = () => { api.token.set(null); setUser(null); window.location.href = '/login'; };

  /** Options for a lookup category, straight from the database. */
  const opts = (cat) => (cfg?.lookups?.[cat] || []).map((x) => x.code);
  const lookup = (cat) => cfg?.lookups?.[cat] || [];

  const course = courses.find((c) => c.id === courseId) || courses[0] || null;
  const value = { user, cfg, opts, lookup, courses, course, courseId: course?.id, setCourseId, refreshCourses, toast, login, logout, ready };
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className={`toast ${toastMsg.kind === 'error' ? 'error' : ''}`}>{toastMsg.text}</div>}
    </Ctx.Provider>
  );
}

/** useLoad(fn, deps) → {data, loading, error, reload, setData} */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try { setState({ data: await fn(), loading: false, error: null }); } catch (e) { setState({ data: null, loading: false, error: e }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) };
}

/** Wrap an async action with error toasts. */
export function useAction() {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const run = async (fn, okMsg) => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(e.message, 'error'); return null; } finally { setBusy(false); }
  };
  return [run, busy];
}
