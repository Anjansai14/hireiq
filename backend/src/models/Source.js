/**
 * Source Data Model (Influencer & Institutional Partners)
 * Maps to MySQL / Relational Database 'sources', 'source_history', 'source_recent_posts', etc.
 */
const db = require('../db');

class SourceModel {
  static async findAll(filters = {}) {
    let sql = 'SELECT * FROM sources';
    const params = [];
    const clauses = [];

    if (filters.platform) {
      clauses.push('platform = ?');
      params.push(filters.platform);
    }
    if (filters.tier) {
      clauses.push('tier = ?');
      params.push(filters.tier);
    }
    if (filters.type) {
      clauses.push('type = ?');
      params.push(filters.type);
    }

    if (clauses.length) {
      sql += ' WHERE ' + clauses.join(' AND ');
    }
    sql += ' ORDER BY name';

    const rows = await db.query(sql, params);
    if (!rows.length) return [];

    const sids = rows.map(r => r.id);
    const ph = sids.map(() => '?').join(',');
    const [hist, recent] = await Promise.all([
      db.query(`SELECT * FROM source_history WHERE source_id IN (${ph}) ORDER BY date`, sids),
      db.query(`SELECT * FROM source_recent_posts WHERE source_id IN (${ph}) ORDER BY date DESC`, sids),
    ]);

    return rows.map(s => ({
      ...s,
      history: hist.filter(h => h.source_id === s.id),
      recent: recent.filter(r => r.source_id === s.id),
    }));
  }

  static async findById(id) {
    const s = await db.one('SELECT * FROM sources WHERE id = ?', [id]);
    if (!s) return null;

    const [hist, recent, snapshots, activity, bookings] = await Promise.all([
      db.query('SELECT * FROM source_history WHERE source_id = ? ORDER BY date', [id]),
      db.query('SELECT * FROM source_recent_posts WHERE source_id = ? ORDER BY date DESC', [id]),
      db.query('SELECT month, followers FROM source_snapshots WHERE source_id = ?', [id]),
      db.query('SELECT date, text FROM source_activity WHERE source_id = ? ORDER BY date DESC', [id]),
      db.query(`SELECT cs.id, cs.status, cs.rate, cs.deal_posts, c.id AS campaign_id, c.name AS campaign, c.status AS campaign_status
                FROM (SELECT id, status, rate, posts AS deal_posts, campaign_id FROM campaign_sources WHERE source_id = ?) cs
                JOIN campaigns c ON c.id = cs.campaign_id`, [id]),
    ]);

    return {
      ...s,
      history: hist,
      recent: recent,
      snapshots,
      activity,
      bookings
    };
  }

  static async create(sourceData) {
    await db.insert('sources', sourceData);
    return sourceData.id;
  }

  static async update(id, patch) {
    return db.update('sources', patch, 'id = ?', [id]);
  }
}

module.exports = SourceModel;
