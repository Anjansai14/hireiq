/**
 * Campaign Data Model
 * Maps to MySQL / Relational Database 'campaigns', 'campaign_sources', 'checkpoints', 'posts', 'diagnosis'
 */
const db = require('../db');
const stats = require('../services/stats');

class CampaignModel {
  static async findByCourse(courseId) {
    const rows = await db.query('SELECT * FROM campaigns WHERE course_id = ? ORDER BY created_at DESC', [courseId]);
    return rows;
  }

  static async findById(id) {
    const c = await db.one('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (!c) return null;

    const [narratives, channels, checkpoints, ccs, moves, planVers, diag] = await Promise.all([
      db.query('SELECT * FROM campaign_narratives WHERE campaign_id = ?', [id]),
      db.query('SELECT * FROM campaign_channels WHERE campaign_id = ?', [id]),
      db.query('SELECT * FROM checkpoints WHERE campaign_id = ? ORDER BY day_number', [id]),
      db.query('SELECT * FROM campaign_sources WHERE campaign_id = ?', [id]),
      db.query('SELECT * FROM copilot_proposals WHERE campaign_id = ?', [id]),
      db.query('SELECT * FROM plan_versions WHERE campaign_id = ? ORDER BY version_number', [id]),
      db.one('SELECT * FROM diagnosis_reports WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 1', [id]),
    ]);

    const ccIds = ccs.map(x => x.id);
    let posts = [], logs = [];
    if (ccIds.length) {
      const ph = ccIds.map(() => '?').join(',');
      [posts, logs] = await Promise.all([
        db.query(`SELECT * FROM posts WHERE campaign_source_id IN (${ph}) ORDER BY post_date`, ccIds),
        db.query(`SELECT * FROM campaign_source_logs WHERE campaign_source_id IN (${ph}) ORDER BY date`, ccIds),
      ]);
    }

    const ccsFull = ccs.map(x => ({
      ...x,
      posts: posts.filter(p => p.campaign_source_id === x.id),
      log: logs.filter(l => l.campaign_source_id === x.id),
    }));

    return {
      ...c,
      narratives,
      channels,
      checkpoints,
      ccs: ccsFull,
      moves,
      planVers,
      diagnosis: diag,
      stats: stats.campaignRollup(c, ccsFull)
    };
  }

  static async create(campaignData) {
    await db.insert('campaigns', campaignData);
    return campaignData.id;
  }

  static async update(id, patch) {
    return db.update('campaigns', patch, 'id = ?', [id]);
  }
}

module.exports = CampaignModel;
