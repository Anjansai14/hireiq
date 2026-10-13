const fs = require('fs');
const path = require('path');

const jsPath = path.resolve(__dirname, 'extracted_prototype', '988bfe83-03c2-468a-a6eb-0e5a48186a89.javascript');
const js = fs.readFileSync(jsPath, 'utf8');

// Let's run it in a sandbox or inspect key parts
const vm = require('vm');
const sandbox = {
  window: {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Math: Math,
  Date: Date,
  JSON: JSON
};
sandbox.window = sandbox;

try {
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);
  const HQ = sandbox.window.HQ;
  console.log('HQ loaded successfully!');
  console.log('HQ keys:', Object.keys(HQ));
  console.log('State keys (HQ.s):', Object.keys(HQ.s));
  console.log('Courses count (films):', HQ.s.films.length);
  console.log('Campaigns count:', HQ.s.campaigns.length);
  console.log('Creators count:', HQ.s.creators.length);
  console.log('Connectors count:', HQ.s.connectors.length);
  console.log('Files/Artifacts count:', HQ.s.files.length);
  console.log('Threads count:', HQ.s.threads.length);
  console.log('Sample course 0:', JSON.stringify(HQ.s.films[0].title));
  console.log('Sample course 1:', JSON.stringify(HQ.s.films[1]?.title));
  console.log('Rules count / rules:', HQ.s.rules ? Object.keys(HQ.s.rules) : 'no rules prop');
  console.log('Sample campaign 0:', HQ.s.campaigns[0].name, 'Status:', HQ.s.campaigns[0].status);
} catch (e) {
  console.error('Error running HQ script:', e);
}
