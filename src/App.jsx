import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Facebook, Youtube, ExternalLink } from "lucide-react";
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

const TABS = ["hub", "events", "gallery", "about", "donate", "seva"];

function tabFromHash() {
  const h = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#\/?/, "");
  if (h === "contact") return "about"; // legacy deep-link: Contact merged into About
  return TABS.includes(h) ? h : "hub";
}

export default function OmkarSamithiApp() {
  const [tab, setTabState] = useState(tabFromHash);
  const [notify, setNotify] = useLocalStorage("omkar:notify", {});
  const [lang, setLang] = useLocalStorage("omkar:lang", "en");
  const [toast, setToast] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const toastTimer = useRef(null);
  const logoRef = useRef(null);
  const slotRef = useRef(null);
  const headerRef = useRef(null);
  const aspectRef = useRef(1); // logo aspect survives effect re-runs

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

  // --- single-logo scroll transition (every tab) ---------------------------
  // The ONE logo (rendered in the Header) starts centred in the viewport at
  // scrollY=0 and flies into its slot in the sticky navbar over the first
  // 15% of the page's scrollable range — on EVERY tab, exactly as before.
  // Scroll back to the top and it glides back to the centre; it follows the
  // scroll wherever you are.
  useLayoutEffect(() => {
    const logo = logoRef.current;
    const slot = slotRef.current;
    if (!logo || !slot) return undefined;

    const NAV_H = 45;
    let raf = 0;
    if (!aspectRef.current && logo.naturalWidth && logo.naturalHeight) {
      aspectRef.current = logo.naturalWidth / logo.naturalHeight;
    }
    let aspect = aspectRef.current || 1; // width / height, measured once

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
      const heroContent = document.querySelector(".hero-content");
      const textBottom = heroContent
        ? heroContent.getBoundingClientRect().bottom
        : -Infinity;
      const headerH = headerRef.current ? headerRef.current.offsetHeight : 0;
      // Start Y = viewport centre, pushed down when necessary so the big logo
      // NEVER starts on top of the top-anchored hero text (text + clearance).
      let startY = window.innerHeight / 2;
      if (heroContent) {
        startY = Math.max(startY, textBottom + h / 2 + 16);
      }
      const cx = window.innerWidth / 2 + (targetX - window.innerWidth / 2) * p;
      let cy = startY + (targetY - startY) * p;
      // Mid-flight safety floor: while hero text is still visible below the
      // header, hold the logo just beneath it until its natural path clears —
      // the logo then continues up to the slot with no jump.
      if (textBottom > headerH && cy + h / 2 > headerH && cy - h / 2 < textBottom + 8) {
        cy = textBottom + 8 + h / 2;
      }

      logo.style.left = "0";
      logo.style.top = "0";
      logo.style.height = `${h}px`;
      logo.style.width = `${w}px`;
      logo.style.transform = `translate3d(${cx - w / 2}px, ${cy - h / 2}px, 0)`;
    };

    const measure = () => {
      if (logo.naturalWidth && logo.naturalHeight) {
        aspect = logo.naturalWidth / logo.naturalHeight;
        aspectRef.current = aspect;
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

  // --- reminders -------------------------------------------------------------
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
            notify={notify}
            onToggleNotify={toggleNotify}
            flash={flash}
          />
        )}
        {tab === "gallery" && <GalleryView t={t} />}
        {tab === "about" && (
          <>
            <AboutView t={t} />
            <ContactView t={t} flash={flash} />
            <Contact t={t} />
          </>
        )}
        {tab === "donate" && <DonateView t={t} flash={flash} />}
        {tab === "seva" && <SevaView t={t} lang={lang} flash={flash} />}
      </main>

      <footer className="footer">
        <p>{t.pranaams}</p>
        {/* Social & feedback links live with the Pranaams box on every page */}
        <div className="social-icons footer-links">
          <a
            href="https://www.facebook.com/groups/omkarsamithi/"
            target="_blank"
            rel="noreferrer"
            className="social-link"
          >
            <Facebook size={16} aria-hidden="true" /> Facebook Group
          </a>
          <a
            href="https://www.youtube.com/@OmkarSamithi"
            target="_blank"
            rel="noreferrer"
            className="social-link"
          >
            <Youtube size={16} aria-hidden="true" /> YouTube Channel
          </a>
          <a
            href="https://omkarfeedback.blogspot.com/"
            target="_blank"
            rel="noreferrer"
            className="social-link"
          >
            <ExternalLink size={16} aria-hidden="true" /> Feedback Form
          </a>
        </div>
      </footer>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
