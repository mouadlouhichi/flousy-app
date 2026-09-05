const CACHE_NAME = 'flousy-v6';
// Prerendered app documents, kept separately from the asset cache so an update
// of the shell never strands a stale HTML response behind a hashed chunk.
const HTML_CACHE_NAME = 'flousy-html-v6';
const OFFLINE_URL = '/offline.html';

// Only precache assets that are guaranteed to exist. A single 404 here makes
// cache.addAll() reject, which aborts the whole service worker install and
// silently disqualifies the app from being installable.
const ASSETS_TO_CACHE = [
  OFFLINE_URL,
  '/manifest.json',
  '/manifest-fr.json',
  '/manifest-ar.json',
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
            if (cacheName !== CACHE_NAME && cacheName !== HTML_CACHE_NAME) {
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
      fetch(request)
        .then(async (response) => {
          // Remember the last good copy of each page the user actually opened.
          // Every route here is prerendered static HTML whose JS/CSS references
          // are content-hashed, so a cached document stays usable offline.
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            const cache = await caches.open(HTML_CACHE_NAME);
            await cache.put(request, copy);
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(HTML_CACHE_NAME);
          const page = await cache.match(request);
          if (page) return page;
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

// ---------------------------------------------------------------------------
// Web Push (bill reminders). The payload is a small JSON object built by
// /api/reminders/dispatch: { title, body, url, tag }. No financial detail
// beyond what the user opted into is ever pushed.
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'SmartJib';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      tag: payload.tag || undefined,
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
      data: { url: payload.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/dashboard', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// Background sync hook: when the browser regains connectivity it pings the
// open clients so the IndexedDB mutation outbox flushes even if the tab was
// throttled (Chromium/Android only; other engines ignore the event).
self.addEventListener('sync', (event) => {
  if (event.tag === 'flousy-flush-outbox') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'FLUSH_OUTBOX' }));
      })
    );
  }
});
