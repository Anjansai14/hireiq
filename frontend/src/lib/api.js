/** Tiny API client. JWT lives in localStorage (wrapped in try/catch for private windows). */
const KEY = 'hireiq_token';
const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

export class ApiError extends Error {
  constructor(status, body) { super(body.error || `Request failed (${status})`); this.status = status; this.body = body; }
}

async function req(method, url, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: { ...(isForm || !body ? {} : { 'Content-Type': 'application/json' }), ...(store.get() ? { Authorization: `Bearer ${store.get()}` } : {}) },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !url.includes('/auth/login')) {
    store.set(null);
    if (typeof window !== 'undefined' && window.HQ) {
      window.HQ.set((z) => { z.user = null; z.route = { name: 'login' }; });
    }
  }
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  token: store,
  get: (u) => req('GET', '/api' + u),
  post: (u, b) => req('POST', '/api' + u, b || {}),
  patch: (u, b) => req('PATCH', '/api' + u, b || {}),
  put: (u, b) => req('PUT', '/api' + u, b || {}),
  del: (u) => req('DELETE', '/api' + u),
};
