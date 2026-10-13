const fs = require('fs');
const path = require('path');

const wizPath = path.resolve(__dirname, 'extracted_prototype', 'HireWizard.dc.html');
const content = fs.readFileSync(wizPath, 'utf8');

const scriptMatch = content.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  const s = scriptMatch[1];
  console.log('Wizard Script Length:', s.length);
  
  // Search for predict, narrPool, step render logic
  ['predict', 'narrPool', 'channels', 'shortlist', 'govRules', 'step === 0', 'step === 1', 'step === 2', 'step === 3', 'step === 4', 'step === 5'].forEach(k => {
    const idx = s.indexOf(k);
    if (idx !== -1) {
      console.log(`\n--- Found "${k}" at ${idx} ---`);
      console.log(s.slice(idx, idx + 500));
    }
  });
}
