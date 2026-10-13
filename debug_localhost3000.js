const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(process.env.TEMP, 'chrome_cdp_profile_debug');

async function main() {
  console.log('Launching Chrome to debug localhost:3000...');
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--window-size=1440,900',
    'http://localhost:3000'
  ], { detached: true, stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:9225/json');
      if (res.ok) {
        const data = await res.json();
        const page = data.find(t => t.type === 'page');
        if (page) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch (e) {}
  }

  const ws = new WebSocket(wsUrl);
  await new Promise(resolve => ws.onopen = resolve);

  ws.addEventListener('message', (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log('EXCEPTION:', msg.params.exceptionDetails);
    }
  });

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

  await send('Page.enable');
  await send('Runtime.enable');

  await new Promise(r => setTimeout(r, 3000));

  const html = await send('Runtime.evaluate', { expression: 'document.body.innerHTML', returnByValue: true });
  console.log('Document body HTML length:', html ? html.value.length : 0);
  console.log('Document body HTML:', html ? html.value.slice(0, 500) : 'none');

  ws.close();
  proc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
