const fs = require('fs');
const path = require('path');

const jsPath = path.resolve(__dirname, 'extracted_prototype', 'f5dd64b4-6e22-45c8-a011-30282ae2b2a7.javascript');
const js = fs.readFileSync(jsPath, 'utf8');

// Search for resolve, import, fetchDC, getDC
const regex = /(fetchDC|loadDC|import|resolvePath|registry|getDC)[\s\S]{0,300}/g;
let m;
let count = 0;
while ((m = regex.exec(js)) && count < 10) {
  console.log(`\nMatch: ${m[0].slice(0, 200)}...`);
  count++;
}
