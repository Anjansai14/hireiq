const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(process.env.TEMP, 'chrome_cdp_profile_rec');

async function main() {
  console.log('Launching Chrome with remote debugging on port 9224...');
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

  if (!wsUrl) {
    console.error('Failed to get WebSocket debugger URL');
    process.exit(1);
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

  const { targetId } = await send('Target.createTarget', { url: 'http://localhost:3000' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  const sendSession = (method, params = {}) => new Promise((resolve, reject) => {
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

  await sendSession('Page.enable');
  await sendSession('DOM.enable');
  await sendSession('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  async function evalScript(expression) {
    const res = await sendSession('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res ? res.value : null;
  }

  async function takeScreenshot(filename) {
    const res = await sendSession('Page.captureScreenshot', { format: 'png' });
    if (res && res.data) {
      fs.writeFileSync(path.join(__dirname, filename), Buffer.from(res.data, 'base64'));
      console.log('Saved ' + filename);
    } else {
      console.error('Failed screenshot for ' + filename);
    }
  }

  await new Promise(r => setTimeout(r, 2000));

  console.log('1. Capturing login screen...');
  await evalScript(`
    window.HQ.set(x => { x.user = null; x.module = null; x.route = { name: 'login' }; });
  `);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_01_login.png');

  console.log('2. Capturing module select screen...');
  await evalScript(`
    window.HQ.set(x => { 
      x.user = { name: 'Anika Rao', email: 'anika.rao@peopletech.com', role: 'Manager', title: 'Campaign manager' }; 
      x.module = null; 
    });
  `);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_02_module_select.png');

  console.log('3. Capturing hire dashboard...');
  await evalScript(`
    window.HQ.set(x => { 
      x.user = { name: 'Anika Rao', email: 'anika.rao@peopletech.com', role: 'Manager', title: 'Campaign manager' }; 
      x.module = 'hire'; 
      x.route = { name: 'dashboard' }; 
    });
  `);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_03_hire_dashboard.png');

  console.log('4. Capturing course brief...');
  await evalScript(`window.HQ.go('brief')`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_04_hire_course_brief.png');

  console.log('5. Capturing new course modal...');
  await evalScript(`window.HQ.go('newfilm')`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_05_hire_new_course_modal.png');

  console.log('6. Capturing campaigns list...');
  await evalScript(`window.HQ.go('campaigns')`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_06_hire_campaigns.png');

  console.log('7. Capturing campaign detail (overview)...');
  await evalScript(`window.HQ.go('campaign', { id: 'k1', tab: 'overview' })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_07_hire_campaign_detail.png');

  console.log('8. Capturing campaign performance...');
  await evalScript(`window.HQ.go('campaign', { id: 'k1', tab: 'performance' })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_08_hire_campaign_performance.png');

  console.log('9. Capturing campaign insights (diagnosis)...');
  await evalScript(`window.HQ.go('campaign', { id: 'k1', tab: 'insights' })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_09_hire_campaign_insights.png');

  console.log('10. Capturing source detail...');
  await evalScript(`window.HQ.go('influencer', { campId: 'k1', ccId: 'cc1', tab: 'profile' })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_10_hire_source_detail.png');

  console.log('11. Capturing creator bank...');
  await evalScript(`window.HQ.go('creators')`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_11_hire_creator_bank.png');

  console.log('12. Capturing creator profile...');
  await evalScript(`window.HQ.go('creator', { id: 'c1', tab: 'overview' })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_12_hire_creator_profile.png');

  console.log('13. Capturing copilot...');
  await evalScript(`window.HQ.go('copilot')`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_13_hire_copilot.png');

  console.log('14. Capturing artifacts...');
  await evalScript(`window.HQ.go('files')`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_14_hire_artifacts.png');

  console.log('15. Capturing settings connectors...');
  await evalScript(`window.HQ.go('settings', { tab: 'connectors' })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_15_hire_settings_connectors.png');

  console.log('16. Capturing settings rate card...');
  await evalScript(`window.HQ.go('settings', { tab: 'ratecard' })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_16_hire_settings_ratecard.png');

  console.log('17. Capturing wizard step 1...');
  await evalScript(`window.HQ.go('wizard', { step: 1 })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_17_wizard_step1.png');

  console.log('18. Capturing wizard step 2...');
  await evalScript(`window.HQ.go('wizard', { step: 2 })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_18_wizard_step2.png');

  console.log('19. Capturing wizard step 3...');
  await evalScript(`window.HQ.go('wizard', { step: 3 })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_19_wizard_step3.png');

  console.log('20. Capturing wizard step 4...');
  await evalScript(`window.HQ.go('wizard', { step: 4 })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_20_wizard_step4.png');

  console.log('21. Capturing wizard step 5...');
  await evalScript(`window.HQ.go('wizard', { step: 5 })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_21_wizard_step5.png');

  console.log('22. Capturing wizard step 6...');
  await evalScript(`window.HQ.go('wizard', { step: 6 })`);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('rec_22_wizard_step6.png');

  console.log('All 22 reconstructed screenshots captured!');
  ws.close();
  proc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
