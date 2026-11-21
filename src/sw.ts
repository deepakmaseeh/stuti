/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Assets only in precache — NOT HTML shells. Precaching index/search HTML caused
// CacheFirst hits that served yesterday's page (missing toolbar / old Browse UI)
// until a hard refresh. Navigations use NetworkFirst below instead.
precacheAndRoute(self.__WB_MANIFEST, { ignoreURLParametersMatching: [/.*/] });
cleanupOutdatedCaches();
clientsClaim();

// Activate immediately when the page asks (auto-update from pwa.ts).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Drop the HTML page cache on every new worker so a deploy cannot leave
// stale song/search documents around after "Download book" / prior visits.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await caches.delete('stuti-pages');
      await self.clients.claim();
    })(),
  );
});

// Song + book + app pages: prefer network so deploys show up without refresh.
// Short timeout still allows offline when the book was downloaded into this cache.
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/admin/'),
  new NetworkFirst({
    cacheName: 'stuti-pages',
    networkTimeoutSeconds: 4,
    matchOptions: { ignoreSearch: true, ignoreVary: true },
    plugins: [
      {
        cacheWillUpdate: async ({ response }) =>
          response && response.ok && response.type === 'basic' ? response : null,
      },
    ],
  }),
);

// Book manifests: network first so "Update available" compares against the live version.
registerRoute(
  ({ url }) => url.pathname.startsWith('/dl/'),
  new NetworkFirst({ cacheName: 'stuti-data', networkTimeoutSeconds: 3 }),
);

// Search shards + book lyric bundles (Present / PPT).
registerRoute(
  ({ url }) => url.pathname.startsWith('/search/') || url.pathname.startsWith('/data/'),
  new StaleWhileRevalidate({ cacheName: 'stuti-data' }),
);

// Lazy pptxgenjs chunk: cache after first PPT export.
registerRoute(
  ({ url }) => /pptxgen/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'stuti-pptx',
    plugins: [new ExpirationPlugin({ maxEntries: 4 })],
  }),
);

// Fonts. ignoreVary: servers send `Vary: Origin`.
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'stuti-fonts',
    matchOptions: { ignoreVary: true },
    plugins: [new ExpirationPlugin({ maxEntries: 60 })],
  }),
);

setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    return (await matchPrecache('/no-connection/')) ?? Response.error();
  }
  return Response.error();
});
