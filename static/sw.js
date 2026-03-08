const CACHE = 'garden-v2';

// Assets that should always be cached
const PRECACHE = [
  '/',
  '/notes',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install: precache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Navigation (HTML pages): network-first, fall back to cache
// - API calls: network-only (always fresh)
// - Static assets (JS/CSS/fonts/images): cache-first
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests except fonts
  if (url.origin !== location.origin && !url.hostname.includes('fonts.g')) return;

  // API calls — always network
  if (url.pathname.includes('/api/')) return;

  // Navigation — network first, stale fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then(r => r ?? caches.match('/')))
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      });
    })
  );
});
