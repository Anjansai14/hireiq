const fs = require('fs');
const path = require('path');

const jsPath = path.resolve(__dirname, 'extracted_prototype', 'f5dd64b4-6e22-45c8-a011-30282ae2b2a7.javascript');
const js = fs.readFileSync(jsPath, 'utf8');

function findFn(name) {
  const idx = js.indexOf(name);
  if (idx !== -1) {
    console.log(`\n=== Function ${name} ===`);
    console.log(js.slice(idx, idx + 1000));
  }
}

findFn('function parseDcText');
findFn('function parseDcDocument');
findFn('function boot');
findFn('window.__resources');
findFn('dc-import');
