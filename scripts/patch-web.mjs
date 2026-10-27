import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = '/gym-app/';
const workerTemplate = new URL('../public/sw.js', import.meta.url);

async function buildFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? buildFiles(path) : [path];
    }),
  );
  return files.flat().sort();
}

export async function patchWebBuild(
  directory = fileURLToPath(new URL('../dist/', import.meta.url)),
) {
  const index = join(directory, 'index.html');
  let html = await readFile(index, 'utf8');
  const tags = [
    '<link rel="manifest" href="/gym-app/manifest.json">',
    '<link rel="apple-touch-icon" href="/gym-app/icon-192.png">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="LiftNotes">',
  ];
  const missing = tags.filter((tag) => !html.includes(tag)).join('');
  html = html.replace('</head>', `${missing}</head>`);
  await writeFile(index, html);

  const files = (await buildFiles(directory)).filter((path) => path !== join(directory, 'sw.js'));
  const assets = await Promise.all(
    files.map(async (path) => ({
      url: ROOT + relative(directory, path).split(sep).map(encodeURIComponent).join('/'),
      integrity: `sha256-${createHash('sha256')
        .update(await readFile(path))
        .digest('base64')}`,
    })),
  );
  const shell = assets.find((asset) => asset.url === `${ROOT}index.html`);
  if (!shell) throw new Error('The offline build is missing index.html.');
  assets.unshift({ ...shell, url: ROOT });
  const template = await readFile(workerTemplate, 'utf8');
  const build = createHash('sha256').update(template).update(JSON.stringify(assets)).digest('hex');
  const worker = template
    .replace("'__LIFTNOTES_BUILD__'", JSON.stringify(build))
    .replace("['__LIFTNOTES_ASSETS__']", JSON.stringify(assets));
  await writeFile(join(directory, 'sw.js'), worker);
  return { build, assets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await patchWebBuild();
