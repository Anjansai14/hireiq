const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { requireAuth, viewerReadOnly } = require('./middleware/auth');
const misc = require('./routes/misc');

fs.mkdirSync(config.uploadDir, { recursive: true });

const app = express();
app.use(cors({ origin: config.corsOrigin.includes('*') ? true : config.corsOrigin }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (req, res) => {
  const db = require('./db');
  const ai = require('./services/ai');
  let dbOk = false;
  try { await db.query('SELECT 1'); dbOk = true; } catch { /* reported below */ }
  res.json({ ok: dbOk, db: dbOk, ai: await ai.health() });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api', requireAuth, viewerReadOnly);
app.use('/api/lookups', misc.lookups);
app.use('/api/courses', require('./routes/courses'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/sources', require('./routes/sources'));
app.use('/api/settings', misc.settings);
app.use('/api/files', misc.files);
app.use('/api/metrics', misc.metrics);
app.use('/api/copilot', misc.copilot);
app.use('/api/agents', misc.agents);

// Serve the built React app in production (frontend/dist)
const dist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Server error', ...(err.extra || {}) });
});

module.exports = app;
