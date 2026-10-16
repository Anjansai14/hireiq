/**
 * Background jobs (node-cron, Asia/Kolkata):
 *  08:05 daily  Resolence attribution pass + late-source flags
 *  09:00 daily  Checkpoint evaluation → Insights (A11 + A12) for campaigns with a checkpoint today
 *  02:00 1st    Creator Bank monthly refresh (A3) for profiles past next_refresh
 *  07:00 daily  Connector token-expiry check
 * Integration point: replace the Resolence pass with the vendor's API pull once credentials exist.
 */
const cron = require('node-cron');
const db = require('../db');
const campaigns = require('../services/campaignService');
const settings = require('../services/settings');
const { addDays } = require('../utils/helpers');

const TZ = { timezone: 'Asia/Kolkata' };
const safe = (name, fn) => async () => {
  try {
    console.log(`[job] ${name}`);
    await fn();
  } catch (e) {
    console.error(`[job] ${name} failed:`, e.message);
    try {
      await db.query(
        'INSERT INTO activity_log (course_id, campaign_id, ts, kind, text) VALUES (?, ?, NOW(), ?, ?)',
        [null, null, 'alert', `Job ${name} failed: ${e.message.slice(0, 450)}`]
      );
    } catch {}
  }
};

function start() {
  cron.schedule('5 8 * * *', safe('resolence-attribution', async () => {
    await campaigns.applyAttribution();
    await campaigns.markLate();
  }), TZ);

  cron.schedule('0 9 * * *', safe('checkpoints', async () => {
    for (const { campaign_id } of await campaigns.checkpointsDueToday()) await campaigns.runInsights(campaign_id);
  }), TZ);

  cron.schedule('0 2 1 * *', safe('creator-bank-refresh', async () => {
    const { refresh } = require('../routes/sources');
    const today = await settings.today();
    const due = await db.query("SELECT id FROM sources WHERE next_refresh = 'Overdue' OR next_refresh <= ? OR status IN ('Failed','Partial')", [today]);
    let succeeded = 0;
    let failed = 0;
    for (const { id } of due) {
      try {
        await refresh(id);
        const days = (await settings.load()).settings.source_refresh_days || 30;
        await db.update('sources', { next_refresh: addDays(today, days) }, 'id = ?', [id]);
        succeeded++;
      } catch (err) {
        failed++;
        console.error(`[job] creator-bank-refresh failed for source ${id}:`, err.message);
      }
    }
    try {
      await db.query(
        'INSERT INTO activity_log (course_id, campaign_id, ts, kind, text) VALUES (?, ?, NOW(), ?, ?)',
        [null, null, 'fetch', `Monthly Creator Bank refresh completed: ${succeeded} succeeded, ${failed} failed across ${due.length} sources`]
      );
    } catch {}
  }), TZ);

  cron.schedule('0 7 * * *', safe('token-expiry', async () => {
    // Connector rows carry their own expiry text in v1; mark Expiring ones in the alert feed.
    const exp = await db.query("SELECT id FROM connectors WHERE status = 'Expiring'");
    if (exp.length) console.log(`[job] ${exp.length} connector token(s) expiring`);
  }), TZ);

  console.log('Background jobs scheduled');
}

module.exports = { start };
