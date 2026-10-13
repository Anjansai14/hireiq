const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsPath = path.resolve(__dirname, 'extracted_prototype', '988bfe83-03c2-468a-a6eb-0e5a48186a89.javascript');
const js = fs.readFileSync(jsPath, 'utf8');

const sandbox = { window: {}, setTimeout, clearTimeout, Math, Date, JSON };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
const HQ = sandbox.window.HQ;

console.log('--- Film 0 Brief ---');
console.log(JSON.stringify(HQ.s.films[0].brief, null, 2));

console.log('--- Files ---');
console.log(JSON.stringify(HQ.s.files, null, 2));

console.log('--- Rate Card ---');
console.log(JSON.stringify(HQ.s.rateTiers, null, 2));

console.log('--- Campaign 0 (k1) ---');
console.log(JSON.stringify({
  ...HQ.s.campaigns[0],
  ccs: HQ.s.campaigns[0].ccs.map(c => ({
    id: c.id,
    creatorId: c.creatorId,
    creatorName: HQ.creator(c.creatorId).name,
    status: c.status,
    deal: c.deal,
    posts: c.posts
  }))
}, null, 2));
