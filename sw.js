const CACHE_NAME = 'atril-app-v3';

// Recursos locales de tu propio repositorio
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Librerías externas (CDNs)
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/vue@3/dist/vue.global.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;600;700&display=swap'
];

// Instalación tolerante a fallos en navegadores antiguos
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Guardar archivos locales
      await cache.addAll(LOCAL_ASSETS).catch(err => console.warn('[SW] Error en archivos locales:', err));

      // 2. Guardar CDNs individualmente permitiendo respuestas opacas
      for (const url of CDN_ASSETS) {
        try {
          const request = new Request(url, { mode: 'no-cors' });
          const response = await fetch(request);
          await cache.put(url, response);
        } catch (err) {
          console.warn('[SW] No se pudo precargar CDN:', url, err);
        }
      }
    })
  );
});

// Activación e Invalidation de cachés obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Borrando caché antiguo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Cache First con soporte de respuestas opacas (status 0 / type opaque)
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones a la API de Google Apps Script
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Actualización en segundo plano si hay conexión disponible
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Ignorar errores de red en offline */});

        return cachedResponse;
      }

      // Si no está en caché, intentar obtener de la red y guardar copia
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse) return networkResponse;

        if (networkResponse.status === 200 || networkResponse.type === 'opaque') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback de navegación a index.html si no hay red
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
