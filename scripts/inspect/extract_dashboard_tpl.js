const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.resolve(__dirname, 'extracted_prototype', 'HireDashboard.dc.html'), 'utf8');
const templateMatch = content.match(/<x-dc>([\s\S]*?)<\/x-dc>/);
if (templateMatch) {
  fs.writeFileSync('extracted_prototype/HireDashboard_template_clean.html', templateMatch[1]);
  console.log('Saved clean HireDashboard template, length:', templateMatch[1].length);
}
