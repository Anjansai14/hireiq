const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(process.env.TEMP, 'chrome_cdp_profile_direct');

async function main() {
  console.log('Launching Chrome with remote debugging...');
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:9224/json/version');
      if (res.ok) {
        const data = await res.json();
        wsUrl = data.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }

  const ws = new WebSocket(wsUrl);
  await new Promise(resolve => ws.onopen = resolve);

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = id++;
    const handler = (evt) => {
      const resp = JSON.parse(evt.data);
      if (resp.id === msgId) {
        ws.removeEventListener('message', handler);
        if (resp.error) reject(resp.error);
        else resolve(resp.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  const { targetId } = await send('Target.createTarget', { url: 'http://localhost:8080' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  const sessionSend = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = id++;
    const handler = (evt) => {
      const resp = JSON.parse(evt.data);
      if (resp.id === msgId) {
        ws.removeEventListener('message', handler);
        if (resp.error) reject(resp.error);
        else resolve(resp.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
  });

  await sessionSend('Page.enable');
  await sessionSend('Runtime.enable');

  console.log('Waiting for prototype to boot...');
  await new Promise(r => setTimeout(r, 3500));

  const screenshot = async (filename) => {
    const snap = await sessionSend('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filename, Buffer.from(snap.data, 'base64'));
    console.log('Saved:', filename);
  };

  const evalJs = async (expr) => {
    return await sessionSend('Runtime.evaluate', { expression: expr });
  };

  await screenshot('ref_01_login.png');

  console.log('Setting user and module=hire directly on window.IQ...');
  const res = await evalJs(`(() => {
    if (!window.IQ) return 'no IQ';
    window.IQ.set(x => {
      x.user = { name: 'Anika Rao', email: 'anika.rao@peopletech.com', role: 'Manager', title: 'Campaign manager' };
      x.module = 'hire';
      x.route = { name: 'dashboard' };
    });
    return 'ok: module set to ' + window.IQ.s.module;
  })()`);
  console.log('Eval result:', res.result.value);

  await new Promise(r => setTimeout(r, 2000));
  await screenshot('ref_03_hire_dashboard.png');

  // Go to Course Brief
  console.log('Navigating to Course Brief...');
  await evalJs(`window.HQ.go('brief')`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_04_hire_course_brief.png');

  // Course brief files tab
  console.log('Course brief files tab...');
  await evalJs(`window.HQ.go('brief', { tab: 'files' })`);
  await new Promise(r => setTimeout(r, 1000));
  await screenshot('ref_05_hire_course_brief_files.png');

  // Go to Campaigns list
  console.log('Navigating to Campaigns list...');
  await evalJs(`window.HQ.go('campaigns')`);
  await new Promise(r => setTimeout(r, 1000));
  await screenshot('ref_06_hire_campaigns.png');

  // Campaign Detail Page (k1)
  console.log('Navigating to Campaign Detail Page...');
  await evalJs(`window.HQ.go('campaign', { id: 'k1' })`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_07_hire_campaign_detail_overview.png');

  // Campaign Detail Posts tab
  console.log('Campaign Detail Posts tab...');
  await evalJs(`window.HQ.go('campaign', { id: 'k1', tab: 'posts' })`);
  await new Promise(r => setTimeout(r, 1000));
  await screenshot('ref_08_hire_campaign_detail_posts.png');

  // Campaign Detail Checkpoints tab
  console.log('Campaign Detail Checkpoints tab...');
  await evalJs(`window.HQ.go('campaign', { id: 'k1', tab: 'insights' })`);
  await new Promise(r => setTimeout(r, 1000));
  await screenshot('ref_09_hire_campaign_detail_checkpoints.png');

  // Source Detail within Campaign (k1, cc50033481 - Tech Telugu Ravi)
  console.log('Navigating to Source Detail...');
  await evalJs(`window.HQ.go('influencer', { campId: 'k1', ccId: 'cc50033481' })`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_10_hire_source_detail.png');

  // Creator Bank
  console.log('Navigating to Creator Bank...');
  await evalJs(`window.HQ.go('creators')`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_11_hire_creator_bank.png');

  // Creator Profile (c1 - Tech Telugu Ravi)
  console.log('Navigating to Creator Profile...');
  await evalJs(`window.HQ.go('creator', { id: 'c1' })`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_12_hire_creator_profile.png');

  // Copilot Page
  console.log('Navigating to Copilot...');
  await evalJs(`window.HQ.go('copilot')`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_13_hire_copilot.png');

  // Artifacts Page
  console.log('Navigating to Artifacts...');
  await evalJs(`window.HQ.go('files')`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_14_hire_artifacts.png');

  // Settings Page
  console.log('Navigating to Settings...');
  await evalJs(`window.HQ.go('settings')`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_15_hire_settings_connectors.png');

  // Settings Rate Card
  console.log('Settings Rate card tab...');
  await evalJs(`window.HQ.go('settings', { tab: 'ratecard' })`);
  await new Promise(r => setTimeout(r, 1000));
  await screenshot('ref_16_hire_settings_ratecard.png');

  // Wizard Steps (k4 draft)
  console.log('Wizard Step 0...');
  await evalJs(`window.HQ.go('wizard', { id: 'k4' })`);
  await new Promise(r => setTimeout(r, 1500));
  await screenshot('ref_17_wizard_step0.png');

  console.log('Wizard Step 1...');
  await evalJs(`window.HQ.set(z => { const c = z.campaigns.find(q => q.id === 'k4'); c.wiz.step = 1; c.wiz.done = [0]; })`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_18_wizard_step1.png');

  console.log('Wizard Step 2...');
  await evalJs(`window.HQ.set(z => { const c = z.campaigns.find(q => q.id === 'k4'); c.wiz.step = 2; c.wiz.done = [0, 1]; })`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_19_wizard_step2.png');

  console.log('Wizard Step 3...');
  await evalJs(`window.HQ.set(z => { const c = z.campaigns.find(q => q.id === 'k4'); c.wiz.step = 3; c.wiz.done = [0, 1, 2]; })`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_20_wizard_step3.png');

  console.log('Wizard Step 4...');
  await evalJs(`window.HQ.set(z => { const c = z.campaigns.find(q => q.id === 'k4'); c.wiz.step = 4; c.wiz.done = [0, 1, 2, 3]; })`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_21_wizard_step4.png');

  console.log('Wizard Step 5...');
  await evalJs(`window.HQ.set(z => { const c = z.campaigns.find(q => q.id === 'k4'); c.wiz.step = 5; c.wiz.done = [0, 1, 2, 3, 4]; })`);
  await new Promise(r => setTimeout(r, 1200));
  await screenshot('ref_22_wizard_step5.png');

  console.log('ALL REFERENCE SCREENSHOTS CAPTURED WITH LIVE HIRE IQ DATA!');
  await send('Browser.close').catch(() => {});
  ws.close();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
