/**
 * The browser half of Web Push (round 29).
 *
 * The agreed split: site visitors get the in-tab reminder line (round 28);
 * the installed PWA gets real push. This module is what a device needs to be
 * reachable: subscribe with the server's VAPID public key and hand the
 * subscription to the database, where the sender picks it up.
 *
 * Nothing here asks for permission on its own. Permission is a question, and
 * the only place this site asks it is the admin dashboard's push panel, where
 * the owner enables his own device and tests the whole path. A public opt-in
 * arrives with the scheduled sender.
 *
 * With no VITE_PUSH_VAPID_PUBLIC_KEY configured every call reports
 * not-configured and nothing happens — the site never breaks on push.
 */

export const pushPublicKey = String(import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY || "").trim();

/** A P-256 point in base64url is exactly 87 characters, starting with B or A. */
export const pushConfigured = /^[AB][0-9A-Za-z_-]{86}$/.test(pushPublicKey);

export function pushSupported() {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** base64url -> bytes, the way PushManager wants an applicationServerKey. */
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getPushSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Subscribe this device, or return why not. Never prompts: the caller must
 * have asked for permission first (the admin panel does, explicitly).
 */
export async function subscribePush() {
  if (!pushSupported()) return { ok: false, error: "unsupported" };
  if (!pushConfigured) return { ok: false, error: "not-configured" };
  if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
    return { ok: false, error: "permission-denied" };
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pushPublicKey),
    });
  }
  return { ok: true, subscription: sub };
}

export async function unsubscribePush() {
  if (!pushSupported()) return { ok: false, error: "unsupported" };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true, error: null };
  await sub.unsubscribe();
  return { ok: true, error: null, endpoint: sub.endpoint };
}

/** A local toast through the service worker: proves the channel, no server. */
export async function showLocalTestNotification({ title, body }) {
  if (!pushSupported()) return { ok: false, error: "unsupported" };
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "omkar-test",
    data: { url: "/" },
  });
  return { ok: true, error: null };
}
