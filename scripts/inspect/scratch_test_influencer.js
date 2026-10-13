const { spawn } = require('child_process');
const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const proc = spawn(chromePath, ['--headless=new', '--remote-debugging-port=9239', '--disable-gpu', '--window-size=1440,900', 'http://localhost:3000'], { detached: true, stdio: 'ignore' });

setTimeout(async () => {
  const ver = await (await fetch('http://127.0.0.1:9239/json/version')).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const msgId = id++;
    const handler = (evt) => {
      const resp = JSON.parse(evt.data);
      if (resp.id === msgId) { ws.removeEventListener('message', handler); res(resp.result); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  const targets = await (await fetch('http://127.0.0.1:9239/json')).json();
  const page = targets.find(t => t.url.includes('localhost:3000'));
  const { sessionId } = await send('Target.attachToTarget', { targetId: page.id, flatten: true });

  const errors = [];
  ws.addEventListener('message', evt => {
    const data = JSON.parse(evt.data);
    if (data.method === 'Runtime.exceptionThrown') {
      errors.push(data.params.exceptionDetails?.exception?.description || JSON.stringify(data.params.exceptionDetails));
    }
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      errors.push('CONSOLE: ' + data.params.args?.map(a => a.value || a.description).join(' '));
    }
  });

  const sessionSend = (method, params = {}) => new Promise(res => {
    const msgId = id++;
    const handler = (evt) => {
      const resp = JSON.parse(evt.data);
      if (resp.id === msgId) { ws.removeEventListener('message', handler); res(resp.result); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
  });

  await sessionSend('Runtime.enable');
  await sessionSend('Page.enable');

  await new Promise(r => setTimeout(r, 1500));
  await sessionSend('Runtime.evaluate', { expression: "window.HQ.go('influencer', { campId: 'k1', ccId: 'cc1', tab: 'profile' })" });
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Errors logged (' + errors.length + '):');
  for (const e of errors) console.log(e);

  ws.close();
  proc.kill();
}, 2500);
