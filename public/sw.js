// control.io — Service Worker
// Maneja push notifications + caché offline básico (app shell).

const CACHE = "controlio-v2";

// Assets mínimos para que la app abra sin conexión.
const PRECACHE = ["/offline.html", "/icon-192.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Borra cachés de versiones viejas para no servir assets obsoletos.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// ── Fetch: estrategia por tipo de request ───────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo GET; nunca interceptamos POST/PUT (mutaciones de datos).
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // No tocar otros orígenes ni las APIs (datos siempre frescos desde la red).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navegaciones (HTML): network-first → si no hay red, mostramos offline.html.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Assets estáticos de Next (hashed/inmutables) e íconos: cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|svg|ico|woff2?|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            // Guardamos copia para la próxima (solo respuestas OK).
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
  }
});

// ── Push notifications ──────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "control.io", body: event.data.text() };
  }

  const { title = "control.io", body = "", icon = "/icon-192.png", url = "/dashboard" } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/badge-96.png",
      vibrate: [200, 100, 200],
      data: { url },
      actions: [{ action: "open", title: "Ver →" }],
    })
  );
});

// ── Notification click ──────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? "/dashboard";
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === fullUrl && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(fullUrl);
        }
      })
  );
});
