#!/bin/sh
# Wait for MySQL, seed once if SEED_ON_START=true and the DB is empty, then start the API.
until node -e "require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD}).then(c=>c.end()).catch(()=>process.exit(1))"; do
  echo "waiting for database..."; sleep 3
done
if [ "$SEED_ON_START" = "true" ]; then
  node -e "require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME}).then(c=>c.query('SELECT 1 FROM users LIMIT 1')).then(()=>process.exit(0)).catch(()=>process.exit(1))" \
    || node scripts/seed.js
fi
exec node src/server.js
