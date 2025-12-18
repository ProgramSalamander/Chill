
const CACHE_NAME = 'chill-ide-core-v1';
const ASSETS_CACHE_NAME = 'chill-ide-assets-v1';

// Core Application Shell
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/index.tsx'
];

// Install: Cache critical core files immediately
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force waiting service worker to become active
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// Activate: Clean up old caches to prevent storage bloat
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== ASSETS_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients
  );
});

// Fetch: Intercept network requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. External CDN Dependencies -> Cache First Strategy
  // These are versioned (e.g., esm.sh/react@18) and effectively immutable.
  if (
    url.hostname.includes('esm.sh') ||
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('unpkg.com')
  ) {
    event.respondWith(
      caches.open(ASSETS_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;

          return fetch(event.request).then((networkResponse) => {
            // Only cache valid 200 responses
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'cors') {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
             // Fallback logic could go here (e.g. return offline placeholder)
          });
        });
      })
    );
    return;
  }

  // 2. Local Application Files -> Stale-While-Revalidate Strategy
  // Loads instantly from cache, then updates in background for next time.
  // We exclude API calls or anything that looks like a data request if applicable.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
             // Network failed, nothing to do. We rely on cachedResponse.
             console.log('Network fetch failed for', event.request.url);
          });

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }
});
