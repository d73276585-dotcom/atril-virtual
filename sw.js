const CACHE_NAME = 'atril-app-v17'; // Cambiado a v17 para forzar la actualización de la caché

const INITIAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/vue@3/dist/vue.global.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. INSTALACIÓN
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of INITIAL_ASSETS) {
        try {
          // Se realiza una petición estándar para obtener respuestas válidas con CORS cuando estén disponibles
          const res = await fetch(url);
          if (res.ok || res.type === 'opaque') {
            await cache.put(url, res);
          }
        } catch (e) {
          console.warn('[SW] No se pudo guardar en precaché:', url);
        }
      }
    })
  );
});

// 2. ACTIVACIÓN Y LIMPIEZA DE CACHÉ ANTIGUA
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => key !== CACHE_NAME ? caches.delete(key) : null)
      );
    }).then(() => self.clients.claim())
  );
});

// 3. INTERCEPCIÓN DE PETICIONES (FETCH)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // NUNCA guardar en caché las consultas a Google Apps Script ni sus dominios de respuesta
  if (url.includes('script.google.com') || url.includes('googleusercontent.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // A. Si el archivo está en caché local, se entrega de inmediato
      if (cachedResponse) {
        return cachedResponse;
      }

      // B. Si no está en caché, intenta obtenerlo de la red
      return fetch(event.request).then((networkResponse) => {
        // Se permiten tipos 'basic', 'cors' u 'opaque' para guardar archivos de CDN externos (Tailwind, Vue, FontAwesome)
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return networkResponse;
      }).catch(() => {
        // C. MANEJO DE ERRORES OFFLINE
        // Si es una navegación entre páginas, devuelve el index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html').then((indexRes) => {
            return indexRes || caches.match('./');
          });
        }

        // ⚠️ CORRECCIÓN CLAVE: Si falla la red para un asset (fuentes, imágenes, CSS) y no está en caché,
        // devolvemos un objeto Response válido para evitar el error 'TypeError: Failed to convert value to Response'.
        return new Response('Recurso no disponible sin conexión', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});
