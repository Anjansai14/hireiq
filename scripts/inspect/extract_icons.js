const fs = require('fs');
const path = require('path');

const tpl = fs.readFileSync(path.resolve(__dirname, 'extracted_prototype', 'root_template.html'), 'utf8');
const defsMatch = tpl.match(/<defs>([\s\S]*?)<\/defs>/);
if (defsMatch) {
  console.log('Defs length:', defsMatch[1].length);
  const symbols = [...defsMatch[1].matchAll(/<symbol\s+id="([^"]+)"/g)].map(m => m[1]);
  console.log('Symbols found (' + symbols.length + '):', symbols.join(', '));
}
