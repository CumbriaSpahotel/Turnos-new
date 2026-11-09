const CACHE_NAME = "turnosweb-app-v14.88";
const PRECACHE = [
  "styles.css",
  "styles.mobile.css",
  "turnos-rules.js",
  "turnos-engine.js",
  "supabase.js",
  "localforage.js",
  "flatpickr.js",
  "flatpickr_es.js",
  "html2pdf.bundle.min.js",
  "flatpickr.min.css",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).catch(err => {
      console.warn("[SW] Precache parcial:", err);
    })
  );
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  // 1. Ignorar peticiones no-GET (POST, PATCH, DELETE, PUT)
  if (e.request.method !== 'GET') {
    return;
  }

  const url = new URL(e.request.url);

  // 2. NUNCA interceptar Supabase (REST API, Auth, Storage, WebSockets) ni protocolos no-HTTP
  if (url.hostname.includes("supabase.co") || !url.protocol.startsWith("http")) {
    return;
  }

  // 3. NUNCA interceptar el panel de administración
  if (url.pathname.includes("admin") || (e.request.referrer && e.request.referrer.includes("admin.html"))) {
    return;
  }

  // 4. Recursos externos (CDNs jsdelivr, etc.)
  if (url.origin !== location.origin) {
    if (url.hostname.includes("jsdelivr") || url.hostname.includes("cdnjs")) {
      e.respondWith(
        caches.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(r => {
            if (r && r.status === 200) {
              const copy = r.clone();
              caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(() => {});
            }
            return r;
          }).catch(() => cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' }));
        })
      );
    }
    return;
  }

  // 5. Archivos HTML y scripts locales -> Network-First con fallback a caché
  if (url.pathname.endsWith(".html") || url.pathname.endsWith(".js") || url.pathname === "/") {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.status === 200 && r.type === 'basic') {
            const copy = r.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return r;
        })
        .catch(async () => {
          const cached = await caches.match(e.request);
          if (cached) return cached;
          return new Response('Contenido no disponible sin conexión', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // 6. Resto (estilos, iconos, fuentes) -> Cache-First con actualización en segundo plano
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(r => {
        if (r && r.status === 200 && r.type === 'basic') {
          const copy = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return r;
      }).catch(() => cached);

      return cached || fetchPromise.catch(() => new Response('Recurso no disponible', { status: 503 }));
    })
  );
});
