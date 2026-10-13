const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`Hire IQ API listening on http://localhost:${config.port}`);
  if (config.enableJobs) require('./jobs/scheduler').start();
});
