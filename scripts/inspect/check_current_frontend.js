const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, 'frontend', 'src');

function walk(d) {
  let res = [];
  fs.readdirSync(d).forEach(f => {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) res = res.concat(walk(p));
    else res.push(p);
  });
  return res;
}

const files = walk(srcDir);
console.log('Frontend files count:', files.length);

files.forEach(f => {
  const rel = path.relative(srcDir, f);
  const content = fs.readFileSync(f, 'utf8');
  console.log(`\n=== ${rel} (${content.length} chars, ${content.split('\n').length} lines) ===`);
  console.log(content.slice(0, 300).replace(/\n/g, ' '));
});
