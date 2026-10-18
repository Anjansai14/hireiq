const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || (isProd ? '' : 'dev-secret-key-hireiq-2026');
if (isProd && (!jwtSecret || jwtSecret === 'dev-secret' || jwtSecret === 'change-this-long-random-string')) {
  console.error('CRITICAL SECURITY ERROR: Production deployment requires a secure, high-entropy JWT_SECRET in environment variables.');
  process.exit(1);
}

const rawCors = process.env.CORS_ORIGIN || (isProd ? 'http://localhost:4000' : '*');
const corsOrigin = rawCors.split(',').map((s) => s.trim());

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
  jwtSecret: jwtSecret || 'dev-secret-key-hireiq-2026',
  tokenEncKey: process.env.TOKEN_ENC_KEY || (isProd ? '' : '0'.repeat(64)),
  ai: { url: process.env.AI_SERVICE_URL || 'http://localhost:8001', key: process.env.AI_SERVICE_KEY || 'change-me' },
  corsOrigin,
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  enableJobs: process.env.ENABLE_JOBS !== 'false',
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  isProd,
};
