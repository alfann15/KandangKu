const CACHE_NAME = 'kandangku-v4';
const OFFLINE_URL = '/offline';

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(OFFLINE_URL).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate event
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
    })
  );
  self.clients.claim();
});

// Fetch event - simple network first, fallback to offline page
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET
  if (request.method !== 'GET') {
    return;
  }

  // Skip API
  if (new URL(request.url).pathname.startsWith('/api/')) {
    return;
  }

  // Network first, fallback to offline page
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(OFFLINE_URL);
    })
  );
});
