/**
 * Database access layer with intelligent Dual-Engine support:
 * 1. MySQL 8 / MariaDB pool if available on configured port.
 * 2. Embedded high-performance Relational Store if MySQL is offline.
 * JSON columns are cleanly parsed and serialized across both engines.
 */
const mysql = require('mysql2/promise');
const config = require('./config');
const relationalStore = require('./engine/relationalStore');

const JSON_COLS = new Set([
  'meta', 'setting_value', 'form', 'form_src', 'items', 'langs', 'markets', 'content_types', 'formats', 'topics',
  'skills', 'contact', 'skill_bg', 'languages', 'hashtags', 'pred_frozen', 'band_now', 'diagnosis', 'lessons',
  'wizard', 'pred_views', 'pred_enrols', 'beats', 'tags', 'checks', 'sources', 'proposal', 'output', 'answers',
  'cohort', 'questions', 'proposals', 'district_changes', 'outside', 'size'
]);

let mysqlPool = null;
let mysqlAvailable = null; // null = untested, true, false

try {
  mysqlPool = mysql.createPool({
    ...config.db,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    decimalNumbers: true,
  });
} catch (e) {
  mysqlPool = null;
  mysqlAvailable = false;
}

async function checkMysql() {
  if (mysqlAvailable !== null) return mysqlAvailable;
  if (!mysqlPool) {
    mysqlAvailable = false;
    return false;
  }
  try {
    const conn = await Promise.race([
      mysqlPool.getConnection(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
    ]);
    conn.release();
    mysqlAvailable = true;
    console.log('✓ Connected to MySQL 8 on port ' + config.db.port);
    return true;
  } catch (err) {
    mysqlAvailable = false;
    console.log('ℹ MySQL offline, using dynamic embedded Relational Engine');
    return false;
  }
}

function parseRow(row) {
  if (!row || typeof row !== 'object') return row;
  for (const k of Object.keys(row)) {
    if (JSON_COLS.has(k) && typeof row[k] === 'string') {
      try { row[k] = JSON.parse(row[k]); } catch { /* leave as string */ }
    }
  }
  return row;
}

const enc = (v) => (v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v);

async function query(sql, params = []) {
  const isMy = await checkMysql();
  if (isMy) {
    const [rows] = await mysqlPool.query(sql, (params || []).map(enc));
    return Array.isArray(rows) ? rows.map(parseRow) : rows;
  }
  const rows = await relationalStore.execute(sql, (params || []).map(enc));
  return Array.isArray(rows) ? rows.map(parseRow) : rows;
}

async function one(sql, params = []) {
  const rows = await query(sql, params);
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}

/** INSERT helper: insert('table', {col: val}) */
async function insert(table, obj) {
  const isMy = await checkMysql();
  const keys = Object.keys(obj);
  if (isMy) {
    const sql = `INSERT INTO ${table} (${keys.map((k) => '`' + k + '`').join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    return query(sql, keys.map((k) => obj[k]));
  }
  const cleanTable = table.replace(/`/g, '');
  const sql = `INSERT INTO ${cleanTable} (${keys.map((k) => '`' + k + '`').join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  return relationalStore.execute(sql, keys.map((k) => obj[k]));
}

/** UPDATE helper: update('table', {col: val}, 'id = ?', [id]) */
async function update(table, obj, where, params = []) {
  const keys = Object.keys(obj);
  if (!keys.length) return null;
  const isMy = await checkMysql();
  if (isMy) {
    const sql = `UPDATE ${table} SET ${keys.map((k) => '`' + k + '` = ?').join(', ')} WHERE ${where}`;
    return query(sql, [...keys.map((k) => obj[k]), ...params]);
  }
  const cleanTable = table.replace(/`/g, '');
  const sql = `UPDATE ${cleanTable} SET ${keys.map((k) => '`' + k + '` = ?').join(', ')} WHERE ${where}`;
  return relationalStore.execute(sql, [...keys.map((k) => obj[k]), ...params]);
}

async function tx(fn) {
  const isMy = await checkMysql();
  if (isMy) {
    const conn = await mysqlPool.getConnection();
    try {
      await conn.beginTransaction();
      const q = async (sql, params = []) => { const [r] = await conn.query(sql, (params || []).map(enc)); return r; };
      q.query = q;
      const out = await fn(q);
      await conn.commit();
      return out;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
  // Embedded transaction fallback
  const q = async (sql, params = []) => query(sql, params);
  q.query = q;
  return fn(q);
}

module.exports = {
  pool: mysqlPool,
  query,
  one,
  insert,
  update,
  tx,
  parseRow,
  checkMysql,
  store: relationalStore
};
