const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, 'extracted_prototype');
const files = [
  'HireCampaignPage.dc.html',
  'HireSourceDetail.dc.html',
  'HireCreatorBank.dc.html',
  'HireSourceProfile.dc.html',
  'HireSettings.dc.html',
  'HireArtifacts.dc.html',
  'HireCopilot.dc.html',
  'HireCourseBrief.dc.html'
];

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  const tplMatch = content.match(/<x-dc>([\s\S]*?)<\/x-dc>/);
  const scriptMatch = content.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  
  const tpl = tplMatch ? tplMatch[1] : '';
  const script = scriptMatch ? scriptMatch[1] : '';
  
  const baseName = f.replace('.dc.html', '');
  fs.writeFileSync(path.join(dir, `${baseName}_tpl.html`), tpl);
  fs.writeFileSync(path.join(dir, `${baseName}_script.js`), script);
  console.log(`Saved clean tpl & script for ${baseName} (tpl: ${tpl.length}, script: ${script.length})`);
});
