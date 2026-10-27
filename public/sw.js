// The production build replaces these placeholders with a content hash and asset list.
const BUILD = '__LIFTNOTES_BUILD__';
const ASSETS = ['__LIFTNOTES_ASSETS__'];
const ROOT = '/gym-app/';
const PREFIX = 'liftnotes-gym-app-';
const CACHE = `${PREFIX}${BUILD}`;
const assetPaths = new Map(ASSETS.map((asset) => [decodeURIComponent(asset.url), asset.url]));

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await cache.addAll(
          ASSETS.map(
            ({ url, integrity }) =>
              new Request(new URL(url, self.location.origin), { cache: 'reload', integrity }),
          ),
        );
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
      // Do not skipWaiting: existing clients must finish using their complete old build.
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => (key.startsWith(PREFIX) || key === 'liftnotes-v1') && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(ROOT)
  )
    return;

  let assetPath;
  try {
    assetPath = assetPaths.get(decodeURIComponent(url.pathname));
  } catch {
    return;
  }
  if (request.mode === 'navigate') {
    // Navigation and its assets always come from the same fully installed build.
    event.respondWith(
      caches.open(CACHE).then(async (cache) => (await cache.match(ROOT)) || fetch(request)),
    );
  } else if (assetPath) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => (await cache.match(assetPath)) || fetch(request)),
    );
  }
  // Unknown scripts/fonts/JSON use the browser's normal fetch; never substitute HTML.
});
