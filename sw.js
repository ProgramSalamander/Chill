const CACHE_NAME = 'chill-ide-core-v2';
const ASSETS_CACHE_NAME = 'chill-ide-assets-v2';
const PREVIEW_CACHE_NAME = 'chill-ide-preview-v2';

// Core Application Shell
const PRECACHE_URLS = [
  '/',
  '/index.html'
];

// Install: Cache critical core files immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core shell');
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Activate: Clean up old caches to prevent storage bloat
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (![CACHE_NAME, ASSETS_CACHE_NAME, PREVIEW_CACHE_NAME].includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message: Handle updates from main thread (e.g. for Preview)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UPDATE_PREVIEW_FILE') {
    const { path, content, mimeType } = event.data;
    const response = new Response(content, { 
        headers: { 
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
        } 
    });
    
    // Normalize path to ensure it starts with /preview/
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`/preview${normalizedPath}`, self.location.origin);
    
    event.waitUntil(
        caches.open(PREVIEW_CACHE_NAME).then(cache => cache.put(url, response))
    );
  }
});

// Fetch: Intercept network requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 0. Preview Server Handler
  if (url.pathname.startsWith('/preview/')) {
      event.respondWith(
          caches.open(PREVIEW_CACHE_NAME).then(cache => {
              return cache.match(event.request).then(response => {
                  return response || new Response(`
                    <!DOCTYPE html>
                    <html>
                    <body style="background:#050508;color:#475569;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;">
                        <div style="text-align:center;">
                            <h3 style="color:#f1f5f9;margin-bottom:8px;">404 Not Found</h3>
                            <p style="font-size:14px;">The virtual file <code>${url.pathname}</code> is not in the preview cache.</p>
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
  const isCdnAsset = [
    'esm.sh', 
    'cdn.tailwindcss.com', 
    'cdnjs.cloudflare.com', 
    'fonts.googleapis.com', 
    'fonts.gstatic.com', 
    'cdn.jsdelivr.net'
  ].some(domain => url.hostname.includes(domain));

  if (isCdnAsset) {
    event.respondWith(
      caches.open(ASSETS_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;

          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
             // Fallback for offline CDN assets could be added here
          });
        });
      })
    );
    return;
  }

  // 2. Local Application Files -> Network First (or Stale-While-Revalidate)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then(response => {
          if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
      }).catch(() => {
          return caches.match(event.request);
      })
    );
  }
});