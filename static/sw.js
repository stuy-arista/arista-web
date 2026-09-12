const CACHE_NAME = 'arista-v1.3';
const urlsToCache = [
  '/',
  '/favicon.png',
  '/favicon-192x192.png',
  '/apple-touch-icon-180x180.png',
  '/apple-touch-icon-152x152.png',
  '/apple-touch-icon-167x167.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Cache only same-origin GET assets. Auth and form POST requests must always
// reach the network and must never be stored in a browser cache.
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return;
  }

  const isStaticAsset = requestUrl.pathname.startsWith('/_app/') || urlsToCache.includes(requestUrl.pathname);
  if (!isStaticAsset) {
    return;
  }

  // Navigation responses can contain per-user HTML and cookies, so never
  // serve a cached page in place of a fresh authenticated response.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If a same-origin asset request succeeds, update its cache entry.
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback is limited to previously cached static assets.
        return caches.match(event.request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
