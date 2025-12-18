
const CACHE_NAME = 'chill-ide-core-v1';
const ASSETS_CACHE_NAME = 'chill-ide-assets-v1';
const PREVIEW_CACHE_NAME = 'chill-ide-preview-v1';

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
          if (cacheName !== CACHE_NAME && cacheName !== ASSETS_CACHE_NAME && cacheName !== PREVIEW_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients
  );
});

// Message: Handle updates from main thread (e.g. for Preview)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UPDATE_PREVIEW_FILE') {
    const { path, content, mimeType } = event.data;
    const response = new Response(content, { 
        headers: { 
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache'
        } 
    });
    
    // Normalize path to ensure it starts with /preview/
    const url = new URL(`/preview/${path.replace(/^\//, '')}`, self.location.origin);
    
    event.waitUntil(
        caches.open(PREVIEW_CACHE_NAME).then(cache => cache.put(url, response))
    );
  }
});

// Fetch: Intercept network requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 0. Preview Server Handler
  // Intercepts any request starting with /preview/ and serves from the specific cache
  if (url.pathname.startsWith('/preview/')) {
      event.respondWith(
          caches.open(PREVIEW_CACHE_NAME).then(cache => {
              return cache.match(event.request).then(response => {
                  return response || new Response(`
                    <!DOCTYPE html>
                    <html>
                    <body style="background:#000;color:#666;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
                        <div>
                            <h3>404 Not Found</h3>
                            <p>File not found in preview cache: ${url.pathname}</p>
                        </div>
                    </body>
                    </html>
                  `, { status: 404, headers: { 'Content-Type': 'text/html' }});
              });
          })
      );
      return;
  }

  // 1. External CDN Dependencies -> Cache First Strategy
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
             // Fallback logic
          });
        });
      })
    );
    return;
  }

  // 2. Local Application Files -> Stale-While-Revalidate Strategy
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
             console.log('Network fetch failed for', event.request.url);
          });

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }
});
