// Minimal offline-first service worker for Omkar Samithi.
// Strategy: network-first (always try the network), cache successful same-origin
// GET responses as a fallback so the app opens offline after the first visit.
const CACHE = "omkar-cache-v1";

// Pre-cache the app shell so the FIRST offline visit works (audit E17),
// not only after a second visit.
const PRECACHE = ["/", "/index.html", "/omkar-logo.png", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}) // never block install on a transient asset failure
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/index.html").then((c) => c || Response.error()))
      )
  );
});
