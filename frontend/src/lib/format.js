const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const n = (x) => {
  if (x == null || Number.isNaN(x)) return '—';
  const a = Math.abs(x);
  if (a >= 1e6) return (x / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (a >= 1e4) return Math.round(x / 1e3) + 'K';
  if (a >= 1e3) return (x / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(x));
};
export const inr = (x) => (x == null ? '—' : '₹' + Math.round(x).toLocaleString('en-IN'));
export const inrL = (x) => {
  if (x == null) return '—';
  if (x >= 1e7) return '₹' + (x / 1e7).toFixed(2) + ' Cr';
  if (x >= 1e5) return '₹' + (x / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
  return inr(x);
};
export const d = (s) => { if (!s) return '—'; const [y, m, dd] = String(s).slice(0, 10).split('-'); return m ? `${+dd} ${MO[+m - 1]} ${y}` : s; };
export const ds = (s) => { if (!s) return '—'; const [, m, dd] = String(s).slice(0, 10).split('-'); return m ? `${+dd} ${MO[+m - 1]}` : s; };
export const pct = (x, digits = 1) => (x == null ? '—' : `${Number(x).toFixed(digits)}%`);
export const range = (a) => (a ? `${n(a[0])}–${n(a[1])}` : '—');
export const initials = (name = '') => name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('');

/** Status → tone. Presentation only; the statuses themselves come from the DB. */
const TONES = { success: ['#E6F5EC', '#14582F'], warning: ['#FDF3DC', '#7A4F0F'], danger: ['#FCE9E6', '#8A241A'], info: ['#E6EFFA', '#183F6E'], neutral: ['#EEF3F2', '#43565A'] };
const MAP = {
  success: ['Live', 'Delivered', 'Enriched', 'Pass', 'Ahead', 'Approved', 'Connected', 'Active', 'Verified', 'On track', 'Observed', 'Accepted', 'Cleared', 'Ready', 'Extracted', 'Imported', 'Generated', 'Positive', 'Recorded', 'Evidenced', 'High'],
  info: ['Confirmed', 'Partnership', 'Approached', 'Content in review', 'Inferred', 'In review', 'Predicted', 'Open', 'Pending', 'Running'],
  warning: ['Negotiating', 'Warning', 'Partial', 'Expiring', 'Illustrative', 'Stale', 'Under review', 'Unconfirmed', 'Medium', 'Awaiting evidence'],
  danger: ['Behind', 'Fail', 'Failed', 'Declined', 'Backed out', 'Blocked', 'Refused', 'Negative', 'Missing', 'Low', 'Expired'],
};
export const tone = (s) => {
  const k = Object.keys(MAP).find((t) => MAP[t].includes(s)) || 'neutral';
  return { bg: TONES[k][0], fg: TONES[k][1] };
};
const AV = [['#CFEDE4', '#0F5C54'], ['#E6EFF8', '#1D4775'], ['#FBF1DD', '#7A4F0F'], ['#F3E9F6', '#5E3070'], ['#FBE9E5', '#8E3322'], ['#ECEDF8', '#3A3E86']];
export const avatarColors = (id = '') => AV[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
