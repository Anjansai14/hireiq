/**
 * Rate Card & Observation Data Model
 */
const db = require('../db');

class RateCardModel {
  static async getTiers() {
    return db.query('SELECT * FROM rate_tiers ORDER BY sort_order');
  }

  static async getObservations(limit = 50) {
    return db.query(
      `SELECT ro.*, s.name source 
       FROM rate_observations ro 
       LEFT JOIN sources s ON s.id = ro.source_id 
       ORDER BY date DESC LIMIT ?`,
      [limit]
    );
  }

  static async recordObservation(obsData) {
    return db.insert('rate_observations', obsData);
  }

  static async updateTier(tierId, patch) {
    return db.update('rate_tiers', patch, 'tier = ?', [tierId]);
  }
}

module.exports = RateCardModel;
