// K.N Furniture Billing — Service Worker v1
const CACHE = 'kn-billing-v1';

// Assets to cache on install — local files only
// (Unsplash images are decorative, not critical for app function)
const PRECACHE = [
  './',
  './kn-furniture-billing.html',
  './manifest.json',
  './icon.png'
];

// External CDN assets to cache at runtime when first fetched
const RUNTIME_PATTERNS = [
  'unpkg.com/lucide'
];

// ── Install: pre-cache core shell ─────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      // skipWaiting so new SW activates immediately
      return cache.addAll(PRECACHE).catch(() => {
        // If icon.png isn't present yet, cache what we can
        return cache.addAll(['./', './kn-furniture-billing.html', './manifest.json']);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app shell, network-first for data ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // Unsplash images — network with cache fallback (decorative)
  if (url.hostname.includes('unsplash.com') || url.hostname.includes('images.unsplash.com')) {
    event.respondWith(
      caches.open(CACHE).then(cache =>
        fetch(request).then(res => {
          if (res && res.status === 200) cache.put(request, res.clone());
          return res;
        }).catch(() => caches.match(request))
      )
    );
    return;
  }

  // Lucide CDN — cache-first (rarely changes)
  if (RUNTIME_PATTERNS.some(p => url.href.includes(p))) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(request, res.clone()));
          }
          return res;
        });
      })
    );
    return;
  }

  // App shell — cache-first, update in background
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(request, res.clone()));
          }
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }
});
        
