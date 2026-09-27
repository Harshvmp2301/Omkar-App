import { useState, useEffect, useRef, useCallback } from "react";
import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import ContentHub from "./components/ContentHub.jsx";
import EventsView from "./components/EventsView.jsx";
import GalleryView from "./components/GalleryView.jsx";
import AboutView from "./components/AboutView.jsx";
import DonateView from "./components/DonateView.jsx";
import SevaView from "./components/SevaView.jsx";
import ContactView from "./components/ContactView.jsx";
import Contact from "./components/Contact.jsx";
import { translations } from "./data/content.js";
import useLocalStorage from "./hooks/useLocalStorage.js";

const TABS = ["hub", "events", "gallery", "about", "donate", "seva", "contact"];

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
  const logoRef = useRef(null);
  const slotRef = useRef(null);
  const headerRef = useRef(null);

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

  // --- single-logo scroll animation ----------------------------------------
  // The ONE logo (rendered in the Header) starts centred in the viewport at
  // scrollY=0 and flies into its slot in the sticky navbar over the first
  // 15% of the page's scrollable range, then stays there.
  useEffect(() => {
    const logo = logoRef.current;
    const slot = slotRef.current;
    if (!logo || !slot) return undefined;

    const NAV_H = 45;
    let raf = 0;
    let aspect = 1; // width / height, measured once the image loads

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
      let p = maxScroll > 0 ? window.scrollY / (maxScroll * 0.15) : 0;
      p = Math.min(1, Math.max(0, p));
      p = p * p * (3 - 2 * p); // smoothstep for a natural glide

      const bigH = Math.max(140, Math.min(window.innerHeight * 0.3, 220));
      const h = bigH + (NAV_H - bigH) * p;
      const w = h * aspect;

      const rect = slot.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2;
      const targetY = rect.top + rect.height / 2;
      const cx = window.innerWidth / 2 + (targetX - window.innerWidth / 2) * p;
      const cy = window.innerHeight / 2 + (targetY - window.innerHeight / 2) * p;

      logo.style.left = "0";
      logo.style.top = "0";
      logo.style.height = `${h}px`;
      logo.style.width = `${w}px`;
      logo.style.transform = `translate3d(${cx - w / 2}px, ${cy - h / 2}px, 0)`;
    };

    const measure = () => {
      if (logo.naturalWidth && logo.naturalHeight) {
        aspect = logo.naturalWidth / logo.naturalHeight;
      }
      slot.style.width = `${Math.round(NAV_H * aspect)}px`;
      update();
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    if (logo.complete) measure();
    else logo.addEventListener("load", measure);
    update();

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      logo.removeEventListener("load", measure);
    };
  }, []);

  // Keep --header-h in sync so the hero is exactly viewport-height at the top.
  useEffect(() => {
    const setH = () =>
      document.documentElement.style.setProperty(
        "--header-h",
        `${headerRef.current?.offsetHeight || 80}px`
      );
    setH();
    window.addEventListener("resize", setH);
    return () => window.removeEventListener("resize", setH);
  }, [lang, tab]);

  // Page height changes with tabs — re-sync the logo position.
  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [tab]);

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
        ref={headerRef}
        logoRef={logoRef}
        slotRef={slotRef}
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
        {tab === "donate" && <DonateView t={t} flash={flash} />}
        {tab === "seva" && <SevaView t={t} flash={flash} />}
        {tab === "contact" && <ContactView t={t} flash={flash} />}
      </main>

      {tab !== "contact" && <Contact t={t} />}

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
