import { useState, useEffect, useRef, useCallback } from "react";
import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import ContentHub from "./components/ContentHub.jsx";
import EventsView from "./components/EventsView.jsx";
import GalleryView from "./components/GalleryView.jsx";
import AboutView from "./components/AboutView.jsx";
import Contact from "./components/Contact.jsx";
import { translations } from "./data/content.js";
import useLocalStorage from "./hooks/useLocalStorage.js";

const TABS = ["hub", "events", "gallery", "about"];

function tabFromHash() {
  const h = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#\/?/, "");
  return TABS.includes(h) ? h : "hub";
}

export default function OmkarSamithiApp() {
  const [tab, setTabState] = useState(tabFromHash);
  const [rsvps, setRsvps] = useLocalStorage("omkar:rsvps", {});
  const [notify, setNotify] = useLocalStorage("omkar:notify", {});
  const [lang, setLang] = useLocalStorage("omkar:lang", "en");
  const [toast, setToast] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const toastTimer = useRef(null);

  const t = translations[lang] || translations.en;

  // --- hash routing (deep-linkable: #/hub, #/events, #/gallery, #/about) -----
  useEffect(() => {
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setTab = useCallback((next) => {
    setTabState(next);
    const target = `#/${next}`;
    if (window.location.hash !== target) window.location.hash = target;
  }, []);

  // --- document metadata follows language ----------------------------------
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t.appName} · Muscat`;
  }, [lang, t.appName]);

  // --- notifications --------------------------------------------------------
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support is a progressive enhancement */
      });
    }
  }, []);

  const flash = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const sendNotification = useCallback(
    (eventTitle) => {
      if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
        new Notification(t.notificationTitle, {
          body: `${t.notificationBody} ${eventTitle}`,
          icon: "🪔",
          tag: "omkar-reminder",
          requireInteraction: true,
        });
      }
    },
    [notificationsEnabled, t]
  );

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      flash("This browser doesn't support notifications");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      flash(t.notificationsEnabled);
      new Notification(t.notificationTitle, {
        body: "You'll now receive reminders for upcoming programs!",
        icon: "🔔",
      });
    } else {
      setNotificationsEnabled(false);
      flash(t.permissionDenied);
    }
  }, [flash, t]);

  // --- RSVP / reminders -----------------------------------------------------
  const toggleRsvp = useCallback(
    (id, title) => {
      const next = { ...rsvps, [id]: !rsvps[id] };
      setRsvps(next);
      flash(next[id] ? `RSVP'd for ${title}` : `RSVP cancelled for ${title}`);
      if (next[id]) sendNotification(title);
    },
    [rsvps, setRsvps, flash, sendNotification]
  );

  const toggleNotify = useCallback(
    (id, title) => {
      const next = { ...notify, [id]: !notify[id] };
      setNotify(next);
      flash(`${next[id] ? t.remindersOn : t.remindersOff} — ${title}`);
      if (next[id]) sendNotification(title);
    },
    [notify, setNotify, flash, sendNotification, t]
  );

  const toggleLanguage = useCallback(() => {
    const nextLang = lang === "en" ? "kn" : "en";
    setLang(nextLang);
    flash(nextLang === "kn" ? "ಭಾಷೆ ಬದಲಾಯಿಸಲಾಗಿದೆ" : "Language changed");
  }, [lang, setLang, flash]);

  return (
    <div className="app">
      <Header
        t={t}
        lang={lang}
        tab={tab}
        onTab={setTab}
        onToggleLang={toggleLanguage}
        notificationsEnabled={notificationsEnabled}
        onRequestNotify={requestNotificationPermission}
      />

      <Hero t={t} events={t.eventsList} onGoToEvents={() => setTab("events")} />

      <main>
        {tab === "hub" && <ContentHub t={t} />}
        {tab === "events" && (
          <EventsView
            t={t}
            lang={lang}
            rsvps={rsvps}
            notify={notify}
            onToggleRsvp={toggleRsvp}
            onToggleNotify={toggleNotify}
            flash={flash}
          />
        )}
        {tab === "gallery" && <GalleryView t={t} />}
        {tab === "about" && <AboutView t={t} />}
      </main>

      <Contact t={t} />

      <footer className="footer">
        <p>{t.pranaams}</p>
      </footer>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
