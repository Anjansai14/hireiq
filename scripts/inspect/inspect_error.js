const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(process.env.TEMP, 'chrome_cdp_inspect');

async function main() {
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9225/json/version');
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

  ws.addEventListener('message', (evt) => {
    const d = JSON.parse(evt.data);
    if (d.method === 'Runtime.exceptionThrown') {
      console.log('CRITICAL RUNTIME EXCEPTION:', d.params.exceptionDetails?.text, d.params.exceptionDetails?.exception?.description);
    }
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
      console.log('CONSOLE ERROR:', d.params.args?.map(a => a.value || a.description).join(' '));
    }
  });

  await sendSession('Runtime.enable');
  await sendSession('Page.enable');

  await new Promise(r => setTimeout(r, 2000));

  console.log('Setting auth and navigating to wizard step 2...');
  await sendSession('Runtime.evaluate', {
    expression: `
      window.HQ.set(x => { 
        x.user = { name: 'Anika Rao', email: 'anika.rao@peopletech.com', role: 'Manager', title: 'Campaign manager' }; 
        x.module = 'hire'; 
        x.route = { name: 'wizard', step: 6 }; 
      });
    `
  });

  await new Promise(r => setTimeout(r, 2000));

  const check = await sendSession('Runtime.evaluate', {
    expression: 'document.querySelector("#root")?.innerHTML?.slice(0, 300)',
    returnByValue: true
  });
  console.log('Creators HTML:', check.value);

  ws.close();
  try { process.kill(proc.pid); } catch(e) {}
  process.exit(0);
}

main().catch(console.error);
