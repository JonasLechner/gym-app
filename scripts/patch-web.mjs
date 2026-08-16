import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../dist/index.html', import.meta.url);
let html = await readFile(file, 'utf8');
const tags = [
  '<link rel="manifest" href="/gym-app/manifest.json">',
  '<link rel="apple-touch-icon" href="/gym-app/icon-192.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="LiftNotes">',
].join('');
html = html.replace('</head>', `${tags}</head>`);
await writeFile(file, html);
