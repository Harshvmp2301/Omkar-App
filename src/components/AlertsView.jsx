import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
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
 * The public notifications page — the one place a visitor says "tell me".
 *
 * Round 33 split, exactly as the owner drew it: the installed app may ring
 * the phone (this page is where that permission is given, no admin needed);
 * a visitor merely browsing never gets a pop-up — the quiet line under the
 * header already tells them, in the tab, about moved dates, new posts and
 * new videos. So the enable button appears only once the app is installed,
 * and until then the page says how to install it in one sentence.
 *
 * Everything here is the same subscribe/store pair the dashboard has used
 * since round 29; nothing new touches the wire.
 */
export default function AlertsView({ t }) {
  const [device, setDevice] = useState(null); // { supported, permission, endpoint }
  // Read once, lazily: installing happens in another app, so this page is
  // re-opened rather than live-updated, and a lazy initializer keeps the
  // browser read out of the effect body.
  const [installed] = useState(() => isInstalled());
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const readDevice = useCallback(async () => {
    const supported = pushSupported();
    const sub = supported ? await getPushSubscription().catch(() => null) : null;
    return {
      supported,
      permission: typeof Notification !== "undefined" ? Notification.permission : "",
      endpoint: sub ? sub.endpoint : "",
    };
  }, []);

  useEffect(() => {
    let alive = true;
    readDevice().then((snap) => {
      if (alive) setDevice(snap);
    });
    return () => {
      alive = false;
    };
  }, [readDevice]);

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
    setBusy("");
    setNote(saved.ok ? t.alertsOn : t.alertsStoreFail);
  };

  const disable = async () => {
    setBusy("off");
    setNote("");
    const endpoint = device ? device.endpoint : "";
    await unsubscribePush();
    if (endpoint) await deletePushSubscription(endpoint);
    await readDevice().then(setDevice);
    setBusy("");
    setNote(t.alertsOff);
  };

  return (
    <section className="view alerts-view">
      <h1 className="section-title display">{t.alertsTitle}</h1>
      <p className="alerts-intro">{t.alertsIntro}</p>
      <ul className="alerts-list">
        <li>{t.alertsItemProgram}</li>
        <li>{t.alertsItemBlog}</li>
        <li>{t.alertsItemVideo}</li>
        <li>{t.alertsItemCustom}</li>
      </ul>

      <div className="alerts-box">
        {device === null ? null : !device.supported || !pushConfigured ? (
          <p className="alerts-note">{t.alertsUnsupported}</p>
        ) : on ? (
          <>
            <p className="alerts-note">{t.alertsStatusOn}</p>
            <button type="button" className="btn-quiet" onClick={disable} disabled={busy !== ""}>
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
      </div>

      <p className="alerts-quiet">{t.alertsQuiet}</p>
    </section>
  );
}
