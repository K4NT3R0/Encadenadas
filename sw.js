// Red primero: así una actualización de index.html llega siempre; la caché solo sirve sin conexión.
const C = 'encadenadas-v3';
const ASSETS = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
self.addEventListener('install', e => e.waitUntil(
  caches.open(C).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))).then(() => self.skipWaiting())
));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname === 'api.datamuse.com') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)).catch(() => {}); }
      return r;
    }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html')))
  );
});
