const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, 'extracted_prototype');
const files = fs.readdirSync(dir);

console.log('--- ALL FILES IN PROTOTYPE ---');
files.forEach(f => {
  const stat = fs.statSync(path.join(dir, f));
  console.log(`${f.padEnd(65)} ${stat.size} bytes`);
});

// Check the three JS files
const jsFiles = [
  '50a956b5-33ea-4f15-a527-4d831ceff604.javascript',
  'f5dd64b4-6e22-45c8-a011-30282ae2b2a7.javascript',
  '988bfe83-03c2-468a-a6eb-0e5a48186a89.javascript'
];

jsFiles.forEach(f => {
  const fp = path.join(dir, f);
  if (fs.existsSync(fp)) {
    const txt = fs.readFileSync(fp, 'utf8');
    console.log(`\n=== ${f} === (Length: ${txt.length})`);
    console.log(txt.slice(0, 500));
    console.log('\n--- END OF ' + f + ' (last 300 chars) ---');
    console.log(txt.slice(-300));
  }
});
