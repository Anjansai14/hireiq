const fs = require('fs');
const path = require('path');

const jsPath = path.resolve(__dirname, 'extracted_prototype', 'f5dd64b4-6e22-45c8-a011-30282ae2b2a7.javascript');
const js = fs.readFileSync(jsPath, 'utf8');

const idx = js.indexOf('component(name)');
if (idx !== -1) {
  console.log(js.slice(idx - 100, idx + 1000));
} else {
  const idx2 = js.indexOf('component:');
  console.log('component: at', idx2);
  if (idx2 !== -1) console.log(js.slice(idx2 - 100, idx2 + 1000));
}
