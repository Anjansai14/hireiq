const http = require('http');
const fs = require('fs');
const path = require('path');

const filePath = path.resolve('C:/Users/lenovo/Downloads/Influence IQ (4).html');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url.includes('Influence')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8080, () => {
  console.log('Original prototype server listening on http://localhost:8080');
});
