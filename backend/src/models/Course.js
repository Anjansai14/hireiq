/**
 * Course Data Model
 * Maps directly to MySQL / Relational Database 'courses', 'brief_fields', 'course_claims', etc.
 */
const db = require('../db');
const stats = require('../services/stats');
const { HttpError } = require('../utils/helpers');

class CourseModel {
  static async findAll() {
    return db.query('SELECT * FROM courses ORDER BY release_date');
  }

  static async findById(id) {
    const c = await db.one('SELECT * FROM courses WHERE id = ?', [id]);
    if (!c) return null;

    const [fields, claims, flags, reads, watch, activity, files] = await Promise.all([
      db.query('SELECT * FROM brief_fields WHERE course_id = ? ORDER BY sort_order', [id]),
      db.query('SELECT * FROM course_claims WHERE course_id = ?', [id]),
      db.query('SELECT * FROM governance_flags WHERE course_id = ?', [id]),
      db.query('SELECT * FROM course_reads WHERE course_id = ? ORDER BY FIELD(read_key, "public","audience","risk")', [id]),
      db.query('SELECT * FROM watch_handles WHERE course_id = ?', [id]),
      db.query('SELECT * FROM activity_log WHERE course_id = ? ORDER BY ts DESC LIMIT 30', [id]),
      db.query('SELECT * FROM files WHERE course_id = ? ORDER BY date DESC', [id]),
    ]);

    return {
      ...c,
      fields,
      claims,
      flags,
      reads,
      watch,
      activity,
      files,
      readiness: stats.readiness(fields, flags)
    };
  }

  static async create(courseData) {
    await db.insert('courses', courseData);
    return courseData.id;
  }

  static async update(id, patch) {
    return db.update('courses', patch, 'id = ?', [id]);
  }

  static async delete(id) {
    return db.del('courses', 'id = ?', [id]);
  }
}

module.exports = CourseModel;
