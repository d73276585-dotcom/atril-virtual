const CACHE_NAME = 'atril-cache-v19';

// Recursos críticos a precachar (incluye íconos y CDN)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com'
];

// 1. INSTALACIÓN (Tolerante a errores individuales)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Guardando recursos en caché...');
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
  self.skipWaiting();
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
  self.clients.claim();
});

// 3. INTERCEPCIÓN DE RED Y NAVEGACIÓN OFFLINE
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // A. Si se está abriendo la App (navegación principal)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cachedIndex) => {
        if (cachedIndex) return cachedIndex;
        return caches.match('./').then((cachedRoot) => {
          if (cachedRoot) return cachedRoot;
          return fetch(event.request);
        });
      }).catch(() => {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // B. Para scripts, estilos e imágenes (Cache First con auto-guardado dinámico)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Guarda automáticamente en caché cualquier nuevo recurso cargado (Vue, fuentes, etc.)
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
