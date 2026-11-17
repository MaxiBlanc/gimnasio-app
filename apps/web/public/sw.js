/*
 * Service worker de GimnasioApp: hace que la app se pueda instalar y que abra rápido
 * (y sin conexión muestre al menos la pantalla, en vez del dinosaurio del navegador).
 *
 * Estrategia:
 * - /api/...: NUNCA se guarda en caché. Cuotas, pagos y sesiones tienen que ser siempre
 *   los datos reales del momento.
 * - /assets/...: los archivos de Vite llevan un hash en el nombre (index-C6y5O4L7.js), así que
 *   si cambian, cambia el nombre. Se pueden guardar para siempre: primero caché, después red.
 * - Páginas (navegación): primero la red; si no hay conexión, la última versión guardada.
 */
const CACHE = 'gimnasioapp-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  // Borra cachés de versiones anteriores del service worker.
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((clave) => clave !== CACHE).map((clave) => caches.delete(clave))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(
      caches.match(request).then(
        (guardada) =>
          guardada ??
          fetch(request).then((respuesta) => {
            const copia = respuesta.clone();
            if (respuesta.ok) void caches.open(CACHE).then((cache) => cache.put(request, copia));
            return respuesta;
          }),
      ),
    );
    return;
  }

  if (request.mode === 'navigate') {
    evento.respondWith(
      fetch(request)
        .then((respuesta) => {
          const copia = respuesta.clone();
          // Es una SPA: todas las rutas devuelven el mismo index.html, lo guardamos como "/".
          if (respuesta.ok) void caches.open(CACHE).then((cache) => cache.put('/', copia));
          return respuesta;
        })
        .catch(() => caches.match('/').then((guardada) => guardada ?? Response.error())),
    );
  }
});
