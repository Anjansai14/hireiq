const path = require('path');

async function check() {
  const res = await fetch('http://127.0.0.1:9224/json/version');
  const data = await res.json();
  const ws = new WebSocket(data.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = id++;
    const handler = (evt) => {
      const resp = JSON.parse(evt.data);
      if (resp.id === msgId) {
        ws.removeEventListener('message', handler);
        resolve(resp.result || resp.error);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  const targets = await (await fetch('http://127.0.0.1:9224/json')).json();
  console.log('Targets:', targets.map(t => ({ url: t.url, title: t.title })));
  
  const pageTarget = targets.find(t => t.url.includes('localhost:3000'));
  if (!pageTarget) {
    console.log('No page target for localhost:3000!');
    process.exit(0);
  }
  
  const { sessionId } = await send('Target.attachToTarget', { targetId: pageTarget.id, flatten: true });
  
  const sendSession = (method, params = {}) => new Promise((resolve) => {
    const msgId = id++;
    const handler = (evt) => {
      const resp = JSON.parse(evt.data);
      if (resp.id === msgId) {
        ws.removeEventListener('message', handler);
        resolve(resp.result || resp.error);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
  });

  const html = await sendSession('Runtime.evaluate', { expression: 'document.body.innerHTML', returnByValue: true });
  console.log('HTML snippet:', html?.value?.slice(0, 500));

  const errs = await sendSession('Runtime.evaluate', { expression: 'window.__lastErrors || []', returnByValue: true });
  console.log('Errors:', errs?.value);

  ws.close();
}

check().catch(console.error);
