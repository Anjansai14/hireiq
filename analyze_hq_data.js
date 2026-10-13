const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsPath = path.resolve(__dirname, 'extracted_prototype', '988bfe83-03c2-468a-a6eb-0e5a48186a89.javascript');
const js = fs.readFileSync(jsPath, 'utf8');

const sandbox = {
  window: {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Math: Math,
  Date: Date,
  JSON: JSON
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(js, sandbox);

const HQ = sandbox.window.HQ;
console.log('=== HQ OVERVIEW ===');
console.log('TODAY:', HQ.TODAY);
console.log('STATUSES:', HQ.STATUSES);
console.log('COMMITTED:', HQ.COMMITTED);
console.log('SOURCE_TYPES:', HQ.SOURCE_TYPES);
console.log('INSTITUTIONAL:', HQ.INSTITUTIONAL);
console.log('SKILLS:', HQ.SKILLS);
console.log('MARKETS / STATES:', HQ.STATES);

console.log('\n=== COURSES (FILMS) ===');
HQ.s.films.forEach((f, idx) => {
  console.log(`[Course ${idx}] ID: ${f.id}, Title: ${f.title}, Language: ${f.language}, Batch: ${f.batch}, Start: ${f.release}`);
  console.log(`  Brief fields (${f.brief?.fields?.length || 0}):`, (f.brief?.fields || []).map(x => x.name + ` (${x.status})`).slice(0, 5).join(', '));
  console.log(`  Flags (${f.flags?.length || 0}):`, (f.flags || []).map(x => `${x.rule || x.type}: ${x.status}`).join(' | '));
  console.log(`  Claims (${f.claims?.length || 0}):`, (f.claims || []).map(x => x.text).slice(0, 3).join(' ; '));
});

console.log('\n=== CAMPAIGNS ===');
HQ.s.campaigns.forEach((c, idx) => {
  console.log(`[Campaign ${idx}] ID: ${c.id}, Name: ${c.name}, Status: ${c.status}, CourseId: ${c.filmId}, Objective: ${c.objective}`);
  console.log(`  Budget: ${c.budget}, Cohort: ${c.cohort || c.markets?.join(', ')}, Creators count: ${c.ccs?.length || 0}`);
  console.log(`  Checkpoints (${c.checkpoints?.length || 0}):`, (c.checkpoints || []).map(k => `${k.label}: ${k.verdict || 'Pending'}`).join(', '));
  console.log(`  Alerts (${c.alerts?.length || 0}):`, (c.alerts || []).map(a => `${a.rule}: ${a.title || a.note || ''}`).join(', '));
  if (c.wiz) {
    console.log(`  Wizard Draft Step: ${c.wiz.step}, Target Enrolments: ${c.wiz.targetEnrolments}`);
  }
});

console.log('\n=== CREATORS / SOURCES ===');
console.log(`Total: ${HQ.s.creators.length}`);
HQ.s.creators.slice(0, 5).forEach((cr, idx) => {
  console.log(`[Creator ${idx}] ID: ${cr.id}, Name: ${cr.name}, Handle: ${cr.handle}, Platform: ${cr.platform}, Tier: ${cr.tier}, Category: ${cr.category}, Status: ${cr.status}`);
});

console.log('\n=== CONNECTORS ===');
HQ.s.connectors.forEach((cn, idx) => {
  console.log(`[Connector ${idx}] ID: ${cn.id}, Name: ${cn.name}, Status: ${cn.status}, Last Sync: ${cn.last}`);
});

console.log('\n=== ARTIFACTS / FILES ===');
HQ.s.files.forEach((f, idx) => {
  console.log(`[File ${idx}] ID: ${f.id}, Title: ${f.title}, Type: ${f.type}, CourseId: ${f.filmId}`);
});

console.log('\n=== COPILOT THREADS ===');
HQ.s.threads.forEach((t, idx) => {
  console.log(`[Thread ${idx}] ID: ${t.id}, Title: ${t.title}, Messages count: ${t.messages.length}`);
  console.log(`  First message:`, t.messages[0]?.text?.slice(0, 80));
});

console.log('\n=== RATE CARD ===');
console.log('Tiers:', Object.keys(HQ.s.rateTiers));
console.log('Tier A:', HQ.s.rateTiers['Tier A']);
