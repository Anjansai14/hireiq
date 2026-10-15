const db = require('../src/db');

async function inspect() {
  const batch = await db.query("SELECT COUNT(*) as cnt FROM sources WHERE name LIKE '%Batch%' OR handle LIKE '%batch%'");
  console.log('Batch placeholder records count:', batch[0].cnt);

  const total = await db.query("SELECT COUNT(*) as cnt FROM sources");
  console.log('Total sources in database:', total[0].cnt);

  const platforms = await db.query("SELECT platform, COUNT(*) as cnt FROM sources GROUP BY platform ORDER BY cnt DESC");
  console.log('Sources by platform:', platforms);

  const top10 = await db.query("SELECT name, handle, platform, followers, district, status FROM sources ORDER BY followers DESC LIMIT 10");
  console.log('Top 10 creators by followers in DB:');
  console.table(top10);
}

inspect().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
