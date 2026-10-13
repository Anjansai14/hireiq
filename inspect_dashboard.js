const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.resolve(__dirname, 'extracted_prototype', 'HireDashboard.dc.html'), 'utf8');
const scriptMatch = content.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
const templateMatch = content.match(/<x-dc>([\s\S]*?)<\/x-dc>/);

console.log('HireDashboard template length:', templateMatch ? templateMatch[1].length : 'none');
console.log('HireDashboard script length:', scriptMatch ? scriptMatch[1].length : 'none');

if (scriptMatch) {
  const lines = scriptMatch[1].split('\n');
  console.log('Script preview (first 50 lines):');
  console.log(lines.slice(0, 50).join('\n'));
}
