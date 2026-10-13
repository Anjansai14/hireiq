const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, 'extracted_prototype');

// Let's inspect Governance in HireWizard.dc.html
const wizHtml = fs.readFileSync(path.join(dir, 'HireWizard.dc.html'), 'utf8');
const rrMatches = [...wizHtml.matchAll(/RR-H\d\d[^\n<"]*/g)].map(m => m[0]);
console.log('Wizard RR rules found:', [...new Set(rrMatches)]);

// Step names in HireWizard
const stepMatches = [...wizHtml.matchAll(/step\s*===?\s*(\d)/g)].map(m => m[1]);
console.log('Wizard steps checked:', [...new Set(stepMatches)]);

// Let's inspect the wizard steps labels
const wizScriptMatch = wizHtml.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
if (wizScriptMatch) {
  const ws = wizScriptMatch[1];
  const stepsDef = ws.match(/steps\s*=\s*\[[\s\S]*?\];/);
  if (stepsDef) console.log('Wizard steps definition:', stepsDef[0]);
  const wizState = ws.match(/state\s*=\s*\{[\s\S]*?\};/);
  if (wizState) console.log('Wizard initial state:', wizState[0].slice(0, 300));
}

// Let's inspect Brief tabs
const briefHtml = fs.readFileSync(path.join(dir, 'HireCourseBrief.dc.html'), 'utf8');
const briefScriptMatch = briefHtml.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
if (briefScriptMatch) {
  const bs = briefScriptMatch[1];
  const tabsMatch = bs.match(/tabs\s*=\s*\[[\s\S]*?\];/);
  if (tabsMatch) console.log('Brief tabs:', tabsMatch[0]);
}

// Let's inspect Settings tabs
const setHtml = fs.readFileSync(path.join(dir, 'HireSettings.dc.html'), 'utf8');
const setScriptMatch = setHtml.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
if (setScriptMatch) {
  const ss = setScriptMatch[1];
  console.log('Settings script preview:', ss.slice(0, 400));
}
