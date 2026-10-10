// Minimal offline-first service worker for Omkar Samithi.
// Strategy: network-first (always try the network), cache successful same-origin
// GET responses as a fallback so the app opens offline after the first visit.
const CACHE = "omkar-cache-v1";

// Pre-cache the app shell so the FIRST offline visit works (audit E17),
// not only after a second visit.
// The WebP twins are what a retina screen actually paints (see src/App.jsx),
// so the first offline visit needs them too, not only the PNG fallbacks.
const PRECACHE = [
  "/",
  "/index.html",
  "/omkar-logo.png",
  "/omkar-logo-220.webp",
  "/omkar-logo-512.webp",
  "/icon-192.png",
  "/icon-512.png",
];

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

/* ---- Web Push (round 29): render whatever the sender encrypted ----------
   The payload is { title, body, url, tag }; anything missing falls back
   gracefully, and a push with no parseable JSON still shows the site's name
   rather than nothing. Clicking opens (or reuses) a window at the url. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Omkar Samithi";
  const body = data.body || "";

  event.waitUntil(
    (async () => {
      /* Round 33: a visitor looking at the site is told in the tab, by the
         quiet line under the header — ringing their phone on top of that was
         ruled out. So when any window of the site is in front of them, the
         push is handed to those windows instead of shown, and they refresh
         the strip. Same rule as anyClientOpen in src/utils/push-text.js; the
         tests read both copies and fail if they drift. */
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = clients.some((c) => c.focused || c.visibilityState === "visible");
      if (open) {
        await Promise.all(
          clients.map((c) => c.postMessage({ type: "omkar:push", title, body }))
        );
        return;
      }
      await self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: data.tag || "omkar",
        data: { url: data.url || "/" },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            if ("navigate" in client) client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
