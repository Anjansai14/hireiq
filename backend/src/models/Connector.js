/**
 * Connector Data Model
 */
const db = require('../db');

class ConnectorModel {
  static async findAll() {
    return db.query('SELECT id, name, kind, status, detail, last_sync, quota FROM connectors');
  }

  static async findById(id) {
    return db.one('SELECT * FROM connectors WHERE id = ?', [id]);
  }

  static async update(id, patch) {
    return db.update('connectors', patch, 'id = ?', [id]);
  }
}

module.exports = ConnectorModel;
