const CACHE_NAME = 'atril-cache-v18';

// Lista de recursos locales
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// CDNs externas que requieren modo no-cors
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Guardando recursos en caché...');
      
      // 1. Guardar archivos locales
      await cache.addAll(LOCAL_ASSETS);

      // 2. Guardar CDNs externas de forma segura (sin bloqueo CORS)
      for (const url of EXTERNAL_ASSETS) {
        try {
          const req = new Request(url, { mode: 'no-cors' });
          const res = await fetch(req);
          await cache.put(req, res);
        } catch (err) {
          console.warn('[SW] No se pudo precachar CDN:', url, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepción de peticiones (estrategia Cache First con respaldo Network)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => {
        // Retorna fallback si es una navegación principal
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
