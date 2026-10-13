const fs = require('fs');
const path = require('path');

const tpl = fs.readFileSync(path.resolve(__dirname, 'extracted_prototype', 'root_template.html'), 'utf8');
const defsMatch = tpl.match(/<defs>([\s\S]*?)<\/defs>/);

if (!defsMatch) {
  console.error('No defs found');
  process.exit(1);
}

// Convert HTML inside defs to JSX-safe SVG
let defsHtml = defsMatch[1]
  .replace(/viewBox/g, 'viewBox')
  .replace(/sc-camel-view-box/g, 'viewBox')
  .replace(/stroke-width/g, 'strokeWidth')
  .replace(/stroke-linecap/g, 'strokeLinecap')
  .replace(/stroke-linejoin/g, 'strokeLinejoin')
  .replace(/stroke-miterlimit/g, 'strokeMiterlimit')
  .replace(/fill-rule/g, 'fillRule')
  .replace(/clip-rule/g, 'clipRule');

const iconsJsx = `import React from 'react';

export function SvgDefinitions() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs dangerouslySetInnerHTML={{ __html: \`${defsHtml.replace(/`/g, '\\`')}\` }} />
    </svg>
  );
}

export function Icon({ name, size = 18, width, height, className = '', style = {}, ...props }) {
  const href = name.startsWith('#') ? name : '#' + name;
  return (
    <svg
      width={width || size}
      height={height || size}
      className={className}
      style={{ flex: 'none', ...style }}
      {...props}
    >
      <use href={href} />
    </svg>
  );
}

export default Icon;
`;

const outPath = path.resolve(__dirname, 'frontend', 'src', 'components', 'icons', 'Icons.jsx');
const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(outPath, iconsJsx);
console.log('Saved Icons.jsx to', outPath);
