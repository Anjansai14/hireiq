const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, requireAuth } = require('../middleware/auth');
const { ah, HttpError } = require('../utils/helpers');

router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body || {};
  const u = await db.one('SELECT * FROM users WHERE email = ?', [String(email || '').toLowerCase().trim()]);
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) throw new HttpError(401, 'Email or password is incorrect');
  res.json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role, title: u.title } });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

module.exports = router;
