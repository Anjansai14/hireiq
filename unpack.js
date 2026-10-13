const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const htmlPath = path.resolve('C:/Users/lenovo/Downloads/Influence IQ (4).html');
const html = fs.readFileSync(htmlPath, 'utf8');

const manifestMatch = html.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/);
const extResMatch = html.match(/<script type="__bundler\/ext_resources">\s*([\s\S]*?)\s*<\/script>/);
const templateMatch = html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);

if (!manifestMatch || !extResMatch) {
  console.error('Could not find manifest or ext_resources');
  process.exit(1);
}

const manifest = JSON.parse(manifestMatch[1]);
const extResources = JSON.parse(extResMatch[1]);

const outDir = path.resolve(__dirname, 'extracted_prototype');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

if (templateMatch) {
  try {
    const template = JSON.parse(templateMatch[1]);
    fs.writeFileSync(path.join(outDir, 'root_template.html'), template);
    console.log('Saved root_template.html');
  } catch(e) {
    console.error('Failed to parse template:', e);
  }
}

const uuidToId = {};
extResources.forEach(r => uuidToId[r.uuid] = r.id);

let count = 0;
for (const [uuid, entry] of Object.entries(manifest)) {
  const buf = Buffer.from(entry.data, 'base64');
  let decompressed = buf;
  if (entry.compressed) {
    try {
      decompressed = zlib.gunzipSync(buf);
    } catch(err) {
      console.error('Error gunzipping', uuid, err);
    }
  }
  
  let origId = uuidToId[uuid] || '';
  let filename = origId ? origId.replace(/^(\.\/|\/)/, '').replace(/[^a-zA-Z0-9._-]/g, '_') : `${uuid}.${entry.mime.split('/')[1] || 'bin'}`;
  if (!filename.includes('.')) filename += '.txt';
  
  fs.writeFileSync(path.join(outDir, filename), decompressed);
  console.log(`Extracted: ${filename} (id: ${origId}, size: ${decompressed.length}, mime: ${entry.mime})`);
  count++;
}
console.log(`Total extracted: ${count}`);
