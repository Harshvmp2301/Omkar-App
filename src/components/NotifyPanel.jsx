import { useCallback, useEffect, useState, useRef } from "react";
import { Bell, BellOff, X } from "lucide-react";
import useFocusTrap from "../hooks/useFocusTrap.js";
import {
  getPushSubscription,
  isInstalled,
  pushConfigured,
  pushSupported,
  subscribePush,
  unsubscribePush,
} from "../utils/push.js";
import { deletePushSubscription, savePushSubscription } from "../utils/supabase.js";

/**
 * The bell's panel — the one and only door to notifications (round 34).
 *
 * The owner's ruling: no separate tab. The gold bell in the header opens
 * this panel; everything the Alerts tab carried lives here instead — what
 * will arrive, the installed-app gate, enable/disable, and the promise that
 * a visitor merely browsing is never popped at (the quiet line under the
 * header tells them, in the tab).
 *
 * Round 34 also ends the blind failure: if storing the device ever fails
 * again, the note carries the database's own words (reason + detail), so
 * the next person to read it — owner or builder — knows the seam at once.
 */
export default function NotifyPanel({ t, open, onClose }) {
  const panelRef = useRef(null);
  useFocusTrap(panelRef, open, { onEscape: onClose });

  const [device, setDevice] = useState(null); // { supported, permission, endpoint }
  const [installed] = useState(() => isInstalled());
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  // Round 38: the service worker stamps every push it receives into the
  // "omkar-diag" cache ({at, mode}). Reading it back here turns the panel
  // into the witness the owner asked for during testing: did a push reach
  // THIS device at all, and did it ring or go to an open tab?
  const [diag, setDiag] = useState(null);

  const readDevice = useCallback(async () => {
    const supported = pushSupported();
    const sub = supported ? await getPushSubscription().catch(() => null) : null;
    return {
      supported,
      permission: typeof Notification !== "undefined" ? Notification.permission : "",
      endpoint: sub ? sub.endpoint : "",
    };
  }, []);

  const readDiag = useCallback(async () => {
    try {
      if (typeof caches === "undefined") return null;
      const cache = await caches.open("omkar-diag");
      const res = await cache.match("/last-push");
      if (!res) return null;
      const j = await res.json();
      return j && j.at ? j : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    readDevice().then((snap) => {
      if (alive) setDevice(snap);
    });
    readDiag().then((stamp) => {
      if (alive) setDiag(stamp);
    });
    return () => {
      alive = false;
    };
  }, [open, readDevice, readDiag]);

  if (!open) return null;

  const on = Boolean(device && device.endpoint);

  const enable = async () => {
    setBusy("on");
    setNote("");
    // The permission ask is a user-visible prompt, so it happens here, inside
    // the click — subscribePush itself never prompts.
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    const res = await subscribePush();
    if (!res.ok) {
      setBusy("");
      setNote(res.error === "permission-denied" ? t.permissionDenied : t.alertsUnsupported);
      return;
    }
    const json = res.subscription.toJSON();
    const saved = await savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys ? json.keys.p256dh : "",
      auth: json.keys ? json.keys.auth : "",
    });
    await readDevice().then(setDevice);
    // Round 35: tell the header's bell to re-read its state (ringing bell).
    window.dispatchEvent(new Event("omkar:pushchange"));
    setBusy("");
    // Round 37: success needs no sentence — the state line flipping to
    // "Notifications are on for this device" is the done. Failures keep
    // the database's own words (testing phase and forever after).
    setNote(
      saved.ok
        ? ""
        : `${t.alertsStoreFail} (${saved.reason}${saved.detail ? `: ${saved.detail}` : ""})`
    );
  };

  const disable = async () => {
    setBusy("off");
    setNote("");
    const endpoint = device ? device.endpoint : "";
    await unsubscribePush();
    if (endpoint) await deletePushSubscription(endpoint);
    await readDevice().then(setDevice);
    // Round 37: the button flipping back to Enable is the whole sentence.
    setBusy("");
    setNote("");
  };

  return (
    <div className="notify-scrim" onClick={onClose}>
      <section
        className="notify-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notify-title"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="notify-close" onClick={onClose} aria-label={t.closeNotify}>
          <X size={16} aria-hidden="true" />
        </button>
        <h2 id="notify-title" className="section-title display">
          {t.alertsTitle}
        </h2>

        {/* Round 37, the owner's surgery: the panel is now the state line and
            the button — nothing else. The intro paragraph, the four-bullet
            promise list and the quiet-rule footnote are gone; "Done — this
            device will hear from the app itself" is gone too, because the
            state line flipping to "Notifications are on for this device"
            IS the done. What remains beside them is diagnostic, for the
            testing phase: a failure carries the database's own words, and
            a plain browser tab is told once that rings live in the
            installed app. */}
        <div className="alerts-box">
          {device === null ? null : !device.supported || !pushConfigured ? (
            <p className="alerts-note">{t.alertsUnsupported}</p>
          ) : on ? (
            <>
              <p className="alerts-note">{t.alertsStatusOn}</p>
              <button
                type="button"
                className="btn-quiet"
                onClick={disable}
                disabled={busy !== ""}
              >
                <BellOff size={16} aria-hidden="true" /> {t.alertsDisable}
              </button>
            </>
          ) : installed ? (
            <button type="button" className="btn-primary" onClick={enable} disabled={busy !== ""}>
              <Bell size={16} aria-hidden="true" /> {t.alertsEnable}
            </button>
          ) : (
            <p className="alerts-note">{t.alertsInstallHint}</p>
          )}
          {busy === "on" ? <p className="alerts-note">{t.alertsBusy}</p> : null}
          {note ? (
            <p className="alerts-note" role="status">
              {note}
            </p>
          ) : null}
          {/* Round 38, testing phase: the push receipt. "No push has reached
              this device yet" points above the device (sender, FCM, keys);
              "reached … told in the tab" means the site was open in front of
              it; "reached … rang it" with no sound heard points at the OS
              (battery sleep, DND, channel). One line, three worlds. */}
          {diag ? (
            <p className="alerts-note">
              {(diag.mode === "tab" ? t.pushDiagTab : t.pushDiagRing).replaceAll(
                "{time}",
                new Date(diag.at).toLocaleTimeString()
              )}
            </p>
          ) : (
            <p className="alerts-note">{t.pushDiagNone}</p>
          )}
        </div>
      </section>
    </div>
  );
}
