// Offline cache: the app opens even without signal.
//
// RELEASE RULE: change VERSION every time any app file changes. The browser
// notices that sw.js is different, downloads the new files into a fresh cache
// and the page reloads onto them. Old caches are deleted.
const VERSION = '2026.11.22-6';
const CACHE = 'forma-' + VERSION;
const ASSETS = [
  './', 'index.html', 'style.css', 'app.js', 'foods.js', 'plan.js', 'gym.js', 'coach.js', 'anim.js', 'manifest.webmanifest',
  'vendor/zxing.min.js', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('forma-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first for the app's own files. Open Food Facts lookups go to the network.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.open(CACHE).then((c) => c.match('index.html')).then((hit) => hit || fetch(req)).catch(() => fetch(req)));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') c.put(req, res.clone());
        return res;
      }))
    )
  );
});
