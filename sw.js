const CACHE_NAME = 'atril-cache-v49'; // Incrementado para forzar actualización

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/vue@3/dist/vue.global.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;600;700&display=swap'
];

// 1. INSTALACIÓN
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Guardando recursos esenciales en caché ' + CACHE_NAME + '...');
      for (const asset of PRECACHE_ASSETS) {
        try {
          const req = new Request(asset, { mode: asset.startsWith('http') ? 'no-cors' : 'cors' });
          const res = await fetch(req);
          if (res.ok || res.type === 'opaque') {
            await cache.put(asset, res);
          }
        } catch (err) {
          console.warn('[SW] No se pudo precachear:', asset, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// 2. ACTIVACIÓN Y LIMPIEZA DE CACHÉ OBSOLETA
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. INTERCEPCIÓN DE RED
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET (como el POST hacia Google Apps Script)
  if (event.request.method !== 'GET') return;

  // Intercepción especial para la navegación principal
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('./index.html', responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('./index.html').then((cachedIndex) => {
            return cachedIndex || caches.match('./');
          });
        })
    );
    return;
  }

  // Intercepción estándar de recursos (Network First / Cache Fallback)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
