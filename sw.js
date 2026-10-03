const CACHE_NAME = 'atril-cache-v30'; // <-- Incrementar siempre al publicar cambios

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com'
];

// 1. INSTALACIÓN
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Guardando recursos en caché ' + CACHE_NAME + '...');
      for (const asset of PRECACHE_ASSETS) {
        try {
          const req = new Request(asset, { mode: asset.startsWith('http') ? 'no-cors' : 'cors' });
          const res = await fetch(req);
          if (res.ok || res.type === 'opaque') {
            await cache.put(asset, res);
          }
        } catch (err) {
          console.warn('[SW] No se pudo guardar en precaché:', asset, err);
        }
      }
    })
  );
  self.skipWaiting(); // Se instala e interrumpe la versión vieja inmediatamente
});

// 2. ACTIVACIÓN Y LIMPIEZA DE CACHÉ ANTIGUA
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Borrando caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim(); // Toma el control de la página de inmediato
});

// 3. INTERCEPCIÓN DE RED
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Para navegación (Carga de la página index.html)
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

  // Para el resto de archivos (imágenes, scripts, estilos)
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
