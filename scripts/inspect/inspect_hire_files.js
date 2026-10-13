const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, 'extracted_prototype');
const hireFiles = [
  'HireIQ.dc.html',
  'HireDashboard.dc.html',
  'HireCourseBrief.dc.html',
  'HireNewCourse.dc.html',
  'HireCampaigns.dc.html',
  'HireWizard.dc.html',
  'HireCampaignPage.dc.html',
  'HireSourceDetail.dc.html',
  'HireCreatorBank.dc.html',
  'HireSourceProfile.dc.html',
  'HireCopilot.dc.html',
  'HireArtifacts.dc.html',
  'HireSettings.dc.html'
];

hireFiles.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  console.log(`\n================== ${f} (${content.length} bytes) ==================`);
  
  // Extract custom tags, imports, and script
  const imports = [...content.matchAll(/<dc-import[^>]*name=["']([^"']+)["'][^>]*>/g)].map(m => m[0]);
  console.log('Imports:', imports);
  
  const scriptMatch = content.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    const script = scriptMatch[1];
    console.log('Script length:', script.length);
    // Find class definition or state
    const lines = script.split('\n');
    const classLine = lines.find(l => l.includes('class ') || l.includes('Component'));
    const stateLine = lines.find(l => l.includes('state =') || l.includes('state='));
    console.log('Class line:', classLine ? classLine.trim() : 'none');
    console.log('State line:', stateLine ? stateLine.trim().slice(0, 150) : 'none');
    const renderVals = script.indexOf('renderVals');
    if (renderVals !== -1) {
      console.log('renderVals snippet:\n', script.slice(renderVals, renderVals + 400));
    }
  }
});
