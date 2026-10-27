import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { patchWebBuild } from './patch-web.mjs';

const ORIGIN = 'https://example.test';
const ROOT = '/gym-app/';
const PREFIX = 'liftnotes-gym-app-';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'liftnotes-offline-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, '_expo', 'static', 'js'), { recursive: true });
  await mkdir(join(directory, 'assets', '@expo'), { recursive: true });
  await writeFile(
    join(directory, 'index.html'),
    '<html><head></head><body><script src="/gym-app/_expo/static/js/app.js"></script></body></html>',
  );
  await writeFile(join(directory, '_expo', 'static', 'js', 'app.js'), 'console.log("build one")');
  await writeFile(join(directory, 'assets', 'font.ttf'), 'font bytes');
  await writeFile(join(directory, 'assets', '@expo', 'font name.ttf'), 'scoped font bytes');
  await writeFile(join(directory, 'manifest.json'), '{"name":"LiftNotes"}');
  await writeFile(join(directory, 'icon-192.png'), 'icon bytes');
  return directory;
}

function environment() {
  const cacheEntries = new Map();
  const networkFiles = new Map();
  let online = true;
  let skips = 0;
  let claims = 0;
  const path = (request) =>
    new URL(typeof request === 'string' ? request : request.url, ORIGIN).pathname;
  const fetch = async (request) => {
    if (!online) throw new TypeError('Offline');
    const file = networkFiles.get(path(request));
    if (!file) return new Response('Not found', { status: 404 });
    return new Response(file);
  };
  const caches = {
    open: async (name) => {
      if (!cacheEntries.has(name)) cacheEntries.set(name, new Map());
      const entries = cacheEntries.get(name);
      return {
        addAll: async (requests) => {
          const downloaded = await Promise.all(
            requests.map(async (request) => {
              assert.equal(request.cache, 'reload');
              const response = await fetch(request);
              if (!response.ok) throw new Error('Precache download failed');
              const bytes = Buffer.from(await response.clone().arrayBuffer());
              const integrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
              if (request.integrity !== integrity) throw new Error('Integrity mismatch');
              return [path(request), response];
            }),
          );
          for (const [url, response] of downloaded) entries.set(url, response);
        },
        match: async (request) => entries.get(path(request))?.clone(),
      };
    },
    keys: async () => [...cacheEntries.keys()],
    delete: async (name) => cacheEntries.delete(name),
  };
  return {
    cacheEntries,
    networkFiles,
    setOnline: (value) => {
      online = value;
    },
    async loadBuild(directory) {
      const result = await patchWebBuild(directory);
      for (const { url } of result.assets) {
        const file = url === ROOT ? 'index.html' : decodeURIComponent(url.slice(ROOT.length));
        networkFiles.set(url, await readFile(join(directory, file)));
      }
      const listeners = new Map();
      vm.runInNewContext(await readFile(join(directory, 'sw.js'), 'utf8'), {
        self: {
          location: { origin: ORIGIN },
          clients: {
            claim: async () => {
              claims++;
            },
          },
          skipWaiting: () => {
            skips++;
          },
          addEventListener: (name, callback) => listeners.set(name, callback),
        },
        caches,
        fetch,
        Request,
        URL,
        Set,
        Promise,
      });
      return {
        ...result,
        async lifecycle(name) {
          let completion;
          listeners.get(name)({
            waitUntil: (promise) => {
              completion = promise;
            },
          });
          await completion;
        },
        request(url, mode = 'cors', method = 'GET') {
          let response;
          listeners.get('fetch')({
            request: { url: new URL(url, ORIGIN).href, mode, method },
            respondWith: (promise) => {
              response = promise;
            },
          });
          return response;
        },
      };
    },
    get skips() {
      return skips;
    },
    get claims() {
      return claims;
    },
  };
}

test('build precache includes the full shell, JavaScript, fonts, icons, and integrity hashes', async (t) => {
  const directory = await fixture(t);
  const first = await patchWebBuild(directory);
  const paths = first.assets.map((asset) => asset.url);
  for (const required of [
    ROOT,
    `${ROOT}index.html`,
    `${ROOT}_expo/static/js/app.js`,
    `${ROOT}assets/font.ttf`,
    `${ROOT}manifest.json`,
    `${ROOT}icon-192.png`,
  ])
    assert.ok(paths.includes(required), required);
  assert.ok(!paths.includes(`${ROOT}sw.js`));
  assert.ok(first.assets.every((asset) => asset.integrity.startsWith('sha256-')));
  const generated = await readFile(join(directory, 'sw.js'), 'utf8');
  assert.ok(!generated.includes('__LIFTNOTES_'));
  assert.deepEqual(await patchWebBuild(directory), first);
  await writeFile(join(directory, '_expo', 'static', 'js', 'app.js'), 'console.log("changed")');
  assert.notEqual((await patchWebBuild(directory)).build, first.build);
});

test('the first installed build serves its HTML, JS, and fonts completely offline', async (t) => {
  const env = environment();
  const worker = await env.loadBuild(await fixture(t));
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  env.setOnline(false);
  assert.match(await (await worker.request(ROOT, 'navigate')).text(), /<html>/);
  assert.match(await (await worker.request(`${ROOT}_expo/static/js/app.js`)).text(), /build one/);
  assert.equal(await (await worker.request(`${ROOT}assets/font.ttf`)).text(), 'font bytes');
  assert.equal(
    await (await worker.request(`${ROOT}assets/@expo/font%20name.ttf`)).text(),
    'scoped font bytes',
  );
  assert.equal(
    await (await worker.request(`${ROOT}assets/%40expo/font%20name.ttf`)).text(),
    'scoped font bytes',
  );
  assert.equal(env.skips, 0);
  assert.equal(env.claims, 1);
});

test('unknown non-navigation requests never receive the HTML shell as fallback', async (t) => {
  const env = environment();
  const worker = await env.loadBuild(await fixture(t));
  await worker.lifecycle('install');
  env.setOnline(false);
  assert.equal(worker.request(`${ROOT}missing.js`), undefined);
  assert.equal(worker.request(`${ROOT}%invalid`), undefined);
  assert.equal(worker.request(`${ROOT}backup.json`), undefined);
  assert.equal(worker.request('https://other.test/font.ttf'), undefined);
  assert.equal(worker.request(`${ROOT}submit`, 'cors', 'POST'), undefined);
  assert.match(await (await worker.request(`${ROOT}some-page`, 'navigate')).text(), /<html>/);
  // Even a missing known asset must fail as an asset, not resolve to HTML.
  env.cacheEntries.get(`${PREFIX}${worker.build}`).delete(`${ROOT}assets/font.ttf`);
  await assert.rejects(worker.request(`${ROOT}assets/font.ttf`), /Offline/);
});

test('updates retain the old coherent build until activation, then clean only app-owned caches', async (t) => {
  const directory = await fixture(t);
  const env = environment();
  const first = await env.loadBuild(directory);
  await first.lifecycle('install');
  await first.lifecycle('activate');
  env.cacheEntries.set('another-pages-app', new Map());
  env.cacheEntries.set('liftnotes-v1', new Map());
  await writeFile(join(directory, '_expo', 'static', 'js', 'app.js'), 'console.log("build two")');
  const second = await env.loadBuild(directory);
  await second.lifecycle('install');
  assert.ok(env.cacheEntries.has(`${PREFIX}${first.build}`));
  assert.match(await (await first.request(`${ROOT}_expo/static/js/app.js`)).text(), /build one/);
  assert.match(await (await second.request(`${ROOT}_expo/static/js/app.js`)).text(), /build two/);
  assert.equal(env.skips, 0);
  await second.lifecycle('activate');
  assert.ok(!env.cacheEntries.has(`${PREFIX}${first.build}`));
  assert.ok(!env.cacheEntries.has('liftnotes-v1'));
  assert.ok(env.cacheEntries.has('another-pages-app'));
  env.setOnline(false);
  assert.match(await (await second.request(`${ROOT}_expo/static/js/app.js`)).text(), /build two/);
});

test('incomplete or mismatched downloads reject installation without replacing the working build', async (t) => {
  const directory = await fixture(t);
  const env = environment();
  const first = await env.loadBuild(directory);
  await first.lifecycle('install');
  await first.lifecycle('activate');
  await writeFile(join(directory, '_expo', 'static', 'js', 'app.js'), 'console.log("build two")');
  const second = await env.loadBuild(directory);
  env.networkFiles.delete(`${ROOT}assets/font.ttf`);
  await assert.rejects(second.lifecycle('install'), /Precache download failed/);
  assert.ok(!env.cacheEntries.has(`${PREFIX}${second.build}`));
  assert.ok(env.cacheEntries.has(`${PREFIX}${first.build}`));
  const retry = await env.loadBuild(directory);
  env.networkFiles.set(ROOT, Buffer.from('<html>shell from another deployment</html>'));
  await assert.rejects(retry.lifecycle('install'), /Integrity mismatch/);
  assert.ok(!env.cacheEntries.has(`${PREFIX}${retry.build}`));
  assert.ok(env.cacheEntries.has(`${PREFIX}${first.build}`));
});
