const fs = require('fs');
const path = require('path');

const jsPath = path.resolve(__dirname, 'extracted_prototype', 'f5dd64b4-6e22-45c8-a011-30282ae2b2a7.javascript');
const js = fs.readFileSync(jsPath, 'utf8');

const idx = js.indexOf('getDC(');
console.log('getDC( found at:', idx);
if (idx !== -1) {
  // Find where getDC is defined on runtime
  const idx2 = js.indexOf('getDC(name', 0) !== -1 ? js.indexOf('getDC(name') : js.indexOf('getDC =', 0);
  console.log('getDC definition at:', idx2);
  if (idx2 !== -1) console.log(js.slice(idx2 - 50, idx2 + 800));
}
