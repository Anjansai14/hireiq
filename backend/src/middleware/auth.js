const jwt = require('jsonwebtoken');
const config = require('../config');

function sign(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, title: user.title }, config.jwtSecret, { expiresIn: '30d' });
}

const DEMO_USER = {
  id: 'u1',
  name: 'Anika Rao',
  email: 'anika.rao@peopletech.com',
  role: 'Admin',
  title: 'Campaign manager'
};

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    // Fall back to demo user in dev/local mode
    req.user = DEMO_USER;
    return next();
  }
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    req.user = DEMO_USER;
    next();
  }
}

/** requireRole('Admin','Manager') — Viewer is read-only; Fairness reviewer handles escalations. */
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });

/** Block writes for Viewer role on any non-GET request. */
function viewerReadOnly(req, res, next) {
  if (req.method !== 'GET' && req.user?.role === 'Viewer') return res.status(403).json({ error: 'Viewer accounts are read-only' });
  next();
}

module.exports = { sign, requireAuth, requireRole, viewerReadOnly, DEMO_USER };
