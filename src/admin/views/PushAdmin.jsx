import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, ClipboardCopy, Send } from "lucide-react";
import { AdminError, AdminLoading } from "../ui.jsx";
import {
  getPushSubscription,
  pushConfigured,
  pushSupported,
  showLocalTestNotification,
  subscribePush,
  unsubscribePush,
} from "../../utils/push.js";
import { deletePushSubscription, savePushSubscription } from "../../utils/supabase.js";

/**
 * The push panel: where a device is made reachable, and where the whole
 * notification path is tested from the owner's own hardware.
 *
 * "Send test notification" needs no keys and no server — it asks the service
 * worker already running on this device to show a notification, which proves
 * the channel end to end on the only hardware that matters. The enable /
 * copy / disable trio is the real-push path: subscribe with the VAPID key
 * from Vercel, store the subscription in Supabase, and hand the JSON to
 * tools/send-test-push.mjs on the owner's machine.
 */
export default function PushAdmin() {
  const [state, setState] = useState(null); // { supported, permission, endpoint }
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [subJson, setSubJson] = useState("");

  // A pure read: it returns the snapshot and sets no state, so the effect
  // below can setState inside a .then() — the same shape the other views use
  // to keep synchronous state writes out of effect bodies.
  const readDevice = useCallback(async () => {
    const supported = pushSupported();
    const sub = supported ? await getPushSubscription().catch(() => null) : null;
    return {
      supported,
      permission: typeof Notification !== "undefined" ? Notification.permission : "",
      endpoint: sub ? sub.endpoint : "",
      json: sub ? JSON.stringify(sub.toJSON(), null, 2) : "",
    };
  }, []);

  const refresh = useCallback(
    () => readDevice().then((snap) => {
      setState({ supported: snap.supported, permission: snap.permission, endpoint: snap.endpoint });
      if (snap.json) setSubJson(snap.json);
    }),
    [readDevice]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = (name, fn) => async () => {
    setBusy(name);
    setError("");
    setNote("");
    try {
      await fn();
    } catch (err) {
      setError(String((err && err.message) || err));
    }
    setBusy("");
    refresh();
  };

  const enable = run("enable", async () => {
    if (typeof Notification === "undefined") throw new Error("This browser has no Notification API.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error(`Permission was ${permission}.`);
    const res = await subscribePush();
    if (!res.ok) {
      if (res.error === "not-configured") {
        throw new Error("No VAPID public key yet: set VITE_PUSH_VAPID_PUBLIC_KEY in Vercel and redeploy.");
      }
      throw new Error(`Subscribe said ${res.error}.`);
    }
    const json = res.subscription.toJSON();
    const saved = await savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    setSubJson(JSON.stringify(json, null, 2));
    if (!saved.ok) {
      throw new Error(
        `Subscribed, but storing failed (${saved.reason}${saved.detail ? `: ${saved.detail}` : ""}). ` +
        "Run the push_subscriptions SQL from TRANSFER-NOTES if the table is missing."
      );
    }
    setNote("This device is subscribed and stored. The sender can reach it now.");
  });

  const test = run("test", async () => {
    const res = await showLocalTestNotification({
      title: "Omkar Samithi",
      body: "Test notification — the channel works on this device.",
    });
    if (!res.ok) throw new Error(`The service worker said ${res.error}.`);
    setNote("Asked this device's service worker to show a notification. Look up.");
  });

  const copy = run("copy", async () => {
    const sub = await getPushSubscription();
    if (!sub) throw new Error("No subscription on this device yet — enable push first.");
    const text = JSON.stringify(sub.toJSON());
    setSubJson(JSON.stringify(sub.toJSON(), null, 2));
    await navigator.clipboard.writeText(text);
    setNote("Subscription JSON copied. Paste it into subscription.json beside the sender script.");
  });

  const disable = run("disable", async () => {
    const sub = await getPushSubscription();
    const res = await unsubscribePush();
    if (!res.ok) throw new Error(`Unsubscribe said ${res.error}.`);
    if (sub) await deletePushSubscription(sub.endpoint);
    setSubJson("");
    setNote("This device will no longer receive push.");
  });

  if (!state) return <AdminLoading label="Reading this device's push state…" />;

  return (
    <div className="admin-push">
      <p className="admin-muted">
        {state.supported
          ? `This device: push supported · permission ${state.permission || "not asked"} · ` +
            (state.endpoint ? "subscribed." : "not subscribed.")
          : "This browser cannot do Web Push."}
        {" "}
        {pushConfigured
          ? "VAPID public key: configured."
          : "VAPID public key: not configured yet (VITE_PUSH_VAPID_PUBLIC_KEY in Vercel)."}
      </p>

      <div className="admin-filters">
        <button className="admin-btn" onClick={test} disabled={busy !== "" || !state.supported}>
          <Send size={14} aria-hidden="true" /> Send test notification to this device
        </button>
        {state.endpoint ? (
          <>
            <button className="admin-btn" onClick={copy} disabled={busy !== ""}>
              <ClipboardCopy size={14} aria-hidden="true" /> Copy subscription JSON
            </button>
            <button className="admin-btn" onClick={disable} disabled={busy !== ""}>
              <BellOff size={14} aria-hidden="true" /> Disable push on this device
            </button>
          </>
        ) : (
          <button className="admin-btn" onClick={enable} disabled={busy !== "" || !state.supported}>
            <Bell size={14} aria-hidden="true" /> Enable push on this device
          </button>
        )}
      </div>

      {busy ? <AdminLoading label="Working…" /> : null}
      {error ? <AdminError>{error}</AdminError> : null}
      {note ? <p className="admin-muted">{note}</p> : null}

      {subJson ? (
        <details className="admin-sub-wrap">
          <summary className="admin-muted">Subscription JSON (for tools/send-test-push.mjs)</summary>
          <pre className="admin-sub">{subJson}</pre>
        </details>
      ) : null}
    </div>
  );
}
