const fs = require('fs');
const path = require('path');

const jsPath = path.resolve(__dirname, 'extracted_prototype', 'f5dd64b4-6e22-45c8-a011-30282ae2b2a7.javascript');
const js = fs.readFileSync(jsPath, 'utf8');

console.log('Size:', js.length);
// Check functions exported or defined
const matches = js.match(/(class|function|var|const)\s+([A-Za-z0-9_$]+)/g);
console.log('Top symbols:', matches ? matches.slice(0, 30) : []);

// How does it render?
const keywords = ['createElement', 'ReactDOM', 'render', 'DCLogic', 'dc-import', 'sc-if', 'sc-for'];
keywords.forEach(k => {
  const count = (js.match(new RegExp(k, 'g')) || []).length;
  console.log(`Keyword "${k}": ${count} occurrences`);
});
