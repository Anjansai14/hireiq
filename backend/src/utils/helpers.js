const crypto = require('crypto');
const config = require('../config');

const uid = (p = 'x') => p + crypto.randomBytes(5).toString('hex');

const addDays = (d, n) => {
  const x = new Date(String(d).slice(0, 10) + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const daysBetween = (a, b) =>
  Math.round((new Date(String(b).slice(0, 10) + 'T12:00:00Z') - new Date(String(a).slice(0, 10) + 'T12:00:00Z')) / 864e5);

const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (s) => {
  if (!s) return '—';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  return `${+d} ${MO[+m - 1]} ${y}`;
};
const inr = (x) => (x == null ? '—' : '₹' + Math.round(x).toLocaleString('en-IN'));

/** AES-256-GCM for connector tokens at rest. */
function encrypt(plain) {
  const key = Buffer.from(config.tokenEncKey, 'hex');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return [iv.toString('hex'), c.getAuthTag().toString('hex'), enc.toString('hex')].join(':');
}
function decrypt(blob) {
  const [iv, tag, data] = blob.split(':').map((h) => Buffer.from(h, 'hex'));
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(config.tokenEncKey, 'hex'), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { uid, addDays, daysBetween, fmtDate, inr, encrypt, decrypt, HttpError, ah };
