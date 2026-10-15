// Sube VERSION en cada despliegue para forzar la limpieza de cachés antiguas.
const VERSION = 'v2';
const CACHE_PROPIA = `encadenadas-${VERSION}`;
const CACHE_EXTERNA = `encadenadas-ext-${VERSION}`;

const PRECACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-512.png'
];

// Recursos de terceros que necesita la interfaz (se guardan al usarlos la primera vez)
const HOSTS_EXTERNOS = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_PROPIA)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((claves) => Promise.all(
                claves
                    .filter((k) => k.startsWith('encadenadas-') && k !== CACHE_PROPIA && k !== CACHE_EXTERNA)
                    .map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Archivos propios: primero red (así las actualizaciones llegan), caché como respaldo sin conexión.
async function redPrimero(req) {
    const cache = await caches.open(CACHE_PROPIA);
    try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
    } catch (err) {
        const enCache = await cache.match(req, { ignoreSearch: true });
        if (enCache) return enCache;
        if (req.mode === 'navigate') {
            const inicio = await cache.match('./index.html');
            if (inicio) return inicio;
        }
        return Response.error();
    }
}

// Terceros (Tailwind, fuentes): sirve lo guardado y lo refresca en segundo plano.
async function revalidar(req) {
    const cache = await caches.open(CACHE_EXTERNA);
    const enCache = await cache.match(req);
    const actualizacion = fetch(req)
        .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
        })
        .catch(() => undefined);
    return enCache || (await actualizacion) || Response.error();
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // La API de palabras va siempre directa a la red: nada de respuestas viejas.
    if (url.hostname === 'api.datamuse.com') return;

    if (url.origin === self.location.origin) {
        event.respondWith(redPrimero(req));
    } else if (HOSTS_EXTERNOS.includes(url.hostname)) {
        event.respondWith(revalidar(req));
    }
});
