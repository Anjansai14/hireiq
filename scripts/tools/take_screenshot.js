const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(process.env.TEMP, 'chrome_cdp_profile');

async function main() {
  console.log('Launching Chrome with remote debugging...');
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  // Wait for port 9222
  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        const data = await res.json();
        wsUrl = data.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }

  if (!wsUrl) {
    console.error('Failed to connect to Chrome CDP');
    proc.kill();
    return;
  }
  console.log('Connected to Chrome CDP:', wsUrl);

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

  // Create new target
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
  await sessionSend('DOM.enable');

  console.log('Waiting for unpack and login screen...');
  await new Promise(r => setTimeout(r, 3000));

  // Take screenshot of login
  let snap = await sessionSend('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('original_login.png', Buffer.from(snap.data, 'base64'));
  console.log('Captured original_login.png');

  // Click Sign In
  console.log('Clicking Sign in button...');
  await sessionSend('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign in'));
      if (btn) btn.click();
    })()`
  });

  // Wait for module selector
  await new Promise(r => setTimeout(r, 2000));
  snap = await sessionSend('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('original_module_select.png', Buffer.from(snap.data, 'base64'));
  console.log('Captured original_module_select.png');

  // Click Open Hire IQ
  console.log('Clicking Open Hire IQ...');
  await sessionSend('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Open Hire IQ'));
      if (btn) btn.click();
    })()`
  });

  // Wait for Hire IQ dashboard
  await new Promise(r => setTimeout(r, 2500));
  snap = await sessionSend('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('original_hire_dashboard.png', Buffer.from(snap.data, 'base64'));
  console.log('Captured original_hire_dashboard.png');

  // Click Campaigns in sidebar
  console.log('Clicking Campaigns nav...');
  await sessionSend('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('Campaigns'));
      if (btn) btn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));
  snap = await sessionSend('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('original_hire_campaigns.png', Buffer.from(snap.data, 'base64'));
  console.log('Captured original_hire_campaigns.png');

  // Click New campaign to open wizard
  console.log('Clicking New campaign...');
  await sessionSend('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New campaign'));
      if (btn) btn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1500));
  snap = await sessionSend('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('original_hire_wizard_step0.png', Buffer.from(snap.data, 'base64'));
  console.log('Captured original_hire_wizard_step0.png');

  // Close Chrome
  await send('Browser.close').catch(() => {});
  ws.close();
  console.log('Finished capturing all reference screenshots!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
