/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Ignore ALL query params when matching precached pages (/search/?book=..., /set/?..)
precacheAndRoute(self.__WB_MANIFEST, { ignoreURLParametersMatching: [/.*/] });
cleanupOutdatedCaches();
// Control the page that installed us on the very first visit (later updates still wait for the user's "Update").
clientsClaim();

// Song + book pages: network first (fresh when online), cache when offline.
// "Download book" puts pages into this same cache name, saved under clean URLs (no query).
// ignoreSearch: /song/<id>/?set=…&i=2 must find the copy saved as /song/<id>/.
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/admin/'),
  new NetworkFirst({
    cacheName: 'stuti-pages',
    networkTimeoutSeconds: 3,
    matchOptions: { ignoreSearch: true, ignoreVary: true },
  }),
);

// Book manifests: network first so "Update available" compares against the live version,
// not a stale cached copy (stale-while-revalidate would always answer with the old one first).
registerRoute(
  ({ url }) => url.pathname.startsWith('/dl/'),
  new NetworkFirst({ cacheName: 'stuti-data', networkTimeoutSeconds: 3 }),
);

// Search shards
registerRoute(
  ({ url }) => url.pathname.startsWith('/search/'),
  new StaleWhileRevalidate({ cacheName: 'stuti-data' }),
);

// Fonts. ignoreVary: servers send `Vary: Origin`, and the browser's font requests carry an Origin header
// that the copies saved by "Download book" (plain fetch) don't, so a strict match would always miss.
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
    // The PWA integration precaches pages under their directory URL, not index.html.
    return (await matchPrecache('/no-connection/')) ?? Response.error();
  }
  return Response.error();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
