const fs = require('fs');

async function testRoutes() {
  const listRes = await fetch('http://127.0.0.1:9224/json');
  const list = await listRes.json();
  const page = list.find(p => p.type === 'page' && p.url.includes('3000'));
  if (!page) {
    console.error('No page found on port 9224 matching 3000');
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

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

  ws.addEventListener('message', (evt) => {
    const data = JSON.parse(evt.data);
    if (data.method === 'Runtime.exceptionThrown') {
      console.error('EXCEPTION:', data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description);
    }
  });

  await send('Runtime.enable');

  console.log('Testing window.HQ.go("creators")...');
  const res = await send('Runtime.evaluate', {
    expression: 'window.HQ.go("creators")',
    returnByValue: true
  });
  console.log('Result:', res);

  await new Promise(r => setTimeout(r, 1000));

  const checkHtml = await send('Runtime.evaluate', {
    expression: 'document.querySelector("#root")?.innerHTML?.slice(0, 300)',
    returnByValue: true
  });
  console.log('Root innerHTML preview:', checkHtml);

  ws.close();
  process.exit(0);
}

testRoutes().catch(console.error);
