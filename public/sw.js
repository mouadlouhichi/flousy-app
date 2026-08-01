const CACHE_NAME = 'flousy-v3';
const OFFLINE_URL = '/offline.html';

// Only precache assets that are guaranteed to exist. A single 404 here makes
// cache.addAll() reject, which aborts the whole service worker install and
// silently disqualifies the app from being installable.
const ASSETS_TO_CACHE = [
  OFFLINE_URL,
  '/manifest.json',
  '/site.webmanifest',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-96x96.png',
  '/apple-touch-icon.png',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
  // legacy compat
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Cache entries individually so one failure can't abort the install.
        Promise.all(
          ASSETS_TO_CACHE.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
            return undefined;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never interfere with non-GET traffic (writes must always hit the network).
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Only handle same-origin traffic; let the browser deal with everything else.
  if (url.origin !== self.location.origin) {
    return;
  }

  // NEVER cache Firestore, Auth or API traffic
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.pathname.startsWith('/api')
  ) {
    return;
  }

  // Network-first for navigation, falling back to a real offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return (
          cached ||
          new Response('<h1>Offline</h1>', {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        );
      })
    );
    return;
  }

  // Stale-while-revalidate for static assets.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
