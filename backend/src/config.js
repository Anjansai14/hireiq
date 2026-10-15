const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'hireiq',
    password: process.env.DB_PASSWORD || 'hireiq',
    database: process.env.DB_NAME || 'hireiq',
    charset: 'utf8mb4',
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  tokenEncKey: process.env.TOKEN_ENC_KEY || '0'.repeat(64),
  ai: { url: process.env.AI_SERVICE_URL || 'http://localhost:8001', key: process.env.AI_SERVICE_KEY || 'change-me' },
  corsOrigin: (process.env.CORS_ORIGIN || '*').split(','),
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  enableJobs: process.env.ENABLE_JOBS !== 'false',
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
};
