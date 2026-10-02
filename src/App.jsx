import { useState, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Facebook, Youtube, ExternalLink, MapPin } from "lucide-react";
import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import ContentHub from "./components/ContentHub.jsx";
import EventsView from "./components/EventsView.jsx";
import GalleryView from "./components/GalleryView.jsx";
import AboutView from "./components/AboutView.jsx";
import SevaView from "./components/SevaView.jsx";
import ContactView from "./components/ContactView.jsx";
import Contact from "./components/Contact.jsx";
import { translations } from "./data/content.js";
import useLocalStorage from "./hooks/useLocalStorage.js";
import { initMagnetic } from "./utils/magnetic.js";
import { tabFromHash } from "./utils/route.js";
import { loadEvents } from "./utils/events.js";

// The admin dashboard is code-split: it pulls in the Supabase SDK and a lot of
// UI that no ordinary visitor needs. Loading it lazily keeps all of that out of
// the bundle the public site downloads — `npm run build` shows it as its own
// chunk. It is only fetched when someone opens #/admin.
const AdminApp = lazy(() => import("./admin/AdminApp.jsx"));

// Routing lives in src/utils/route.js so it can be tested without a browser —
// see route.test.js, which covers the fragment, the sign-in return marker and
// the OAuth callback shapes.

export default function OmkarSamithiApp() {
  const [tab, setTabState] = useState(tabFromHash);
  const [notify, setNotify] = useLocalStorage("omkar:notify", {});
  const [lang, setLang] = useLocalStorage("omkar:lang", "en");
  const [toast, setToast] = useState("");
  // Permission granted on a previous visit → reminders are on at first
  // paint (lazy init instead of a mount-effect setState).
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => "Notification" in window && Notification.permission === "granted"
  );
  const toastTimer = useRef(null);
  const mainRef = useRef(null);
  const firstViewFocus = useRef(true);
  const resyncLogo = useRef(null); // imperative handle set by the logo effect
  const logoRef = useRef(null);
  const slotRef = useRef(null);
  const headerRef = useRef(null);
  const aspectRef = useRef(1); // logo aspect survives effect re-runs

  const t = translations[lang] || translations.en;

  // The program list, loaded ONCE for the whole app.
  //
  // The lamps, the program list and the festival calendar must agree about
  // dates: they used to read different sources — the curated list in two of
  // them and the database in the third — so a date set in the dashboard
  // appeared in the list but not in the calendar. One fetch, one answer.
  //
  // Whatever is stored is laid over the curated list; with nothing stored, or
  // if the database is unreachable, this is the curated list untouched.
  const [liveEvents, setLiveEvents] = useState({ lang: null, events: null });

  useEffect(() => {
    let alive = true;
    loadEvents(t.eventsList, lang).then((events) => {
      if (alive) setLiveEvents({ lang, events });
    });
    return () => {
      alive = false;
    };
  }, [lang, t]);

  const events =
    liveEvents.lang === lang && liveEvents.events ? liveEvents.events : t.eventsList;

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

  // --- document metadata follows language + active tab ---------------------
  const TAB_LABELS = {
    hub: t.contentHub,
    events: t.events,
    gallery: t.galleryTab,
    seva: t.sevaTab,
    about: t.aboutTab,
  };
  // View change → move focus into the new view so screen readers announce
  // it; preventScroll keeps the current scroll position (no hero jump).
  useEffect(() => {
    if (firstViewFocus.current) {
      firstViewFocus.current = false;
      return undefined;
    }
    mainRef.current?.focus({ preventScroll: true });
    return undefined;
  }, [tab]);

  useEffect(() => {
    document.documentElement.lang = lang;
    const page = TAB_LABELS[tab];
    document.title = page ? `${page} · ${t.appName} · Muscat` : `${t.appName} · Muscat`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, tab, t]);

  // --- scroll-reveal: hydrate every .reveal on the active view -------------
  // Progressive enhancement: with reduced motion (or no IntersectionObserver)
  // everything shows immediately; otherwise elements rise in as they enter.
  useLayoutEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal:not(.in)"));
    if (!els.length) return undefined;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [tab, lang]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support is a progressive enhancement */
      });
    }
  }, []);

  // --- magnetic CTAs (round-10 wow): spring-physics hover pull --------------
  // Views remount per tab, so magnetic surfaces are (re)bound after each
  // switch. Fine pointers only; reduced-motion users get plain buttons.
  useEffect(() => {
    const fine =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: fine)").matches;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return undefined;
    const cleanups = Array.from(document.querySelectorAll(".magnetic")).map((el) =>
      initMagnetic(el)
    );
    return () => cleanups.forEach((fn) => fn());
  }, [tab, lang]);

  // --- single-logo scroll transition (every tab) ---------------------------
  // The ONE logo (rendered once at page level) starts centred in the viewport
  // at scrollY=0 and flies into its slot in the sticky navbar over the first
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

    // Cached once per mount — the hero never unmounts, so the per-frame
    // querySelector is unnecessary (audit item 5).
    const heroContent = document.querySelector(".hero-content");

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
      // Round-10 scroll progress: full-range progress feeds the header
      // hairline (--scroll-p) while `p` below stays the 15% logo-flight ramp.
      doc.style.setProperty(
        "--scroll-p",
        String(maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0)
      );
      let p = maxScroll > 0 ? window.scrollY / (maxScroll * 0.15) : 0;
      p = Math.min(1, Math.max(0, p));
      p = p * p * (3 - 2 * p); // smoothstep for a natural glide

      const bigH = Math.max(140, Math.min(window.innerHeight * 0.3, 220));

      const rect = slot.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2;
      const targetY = rect.top + rect.height / 2;
      const headerH = headerRef.current ? headerRef.current.offsetHeight : 0;

      // First-deployment composition: the big logo starts exactly at the
      // viewport centre while the hero copy is anchored BELOW it. If any
      // visible copy would otherwise slide into the logo's path, lift the
      // progress analytically (continuous + fully reversible) so the logo
      // simply reaches its navbar slot a little sooner — it never covers
      // text or the content underneath it.
      const startY = window.innerHeight / 2;
      let pEff = p;
      if (heroContent) {
        const hc = heroContent.getBoundingClientRect();
        const visibleTop = Math.max(hc.top, headerH);
        const A = startY + bigH / 2; // logo bottom at p = 0
        const B =
          targetY - startY + (NAV_H - bigH) / 2; // change of bottom per unit p (< 0)
        if (B < 0) {
          const need = (visibleTop - 8 - A) / B; // p at which the bottom clears
          if (Number.isFinite(need)) pEff = Math.min(1, Math.max(pEff, need));
        }
      }

      const h = bigH + (NAV_H - bigH) * pEff;
      const w = h * aspect;
      const cx = window.innerWidth / 2 + (targetX - window.innerWidth / 2) * pEff;
      const cy = startY + (targetY - startY) * pEff;

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
    resyncLogo.current = schedule;

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
      resyncLogo.current = null;
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

  // Page height changes with tabs — re-sync the logo position directly.
  // Round-10: no more synthetic global "resize" events (audit item 17);
  // the logo effect hands us its scheduler via ref.
  useEffect(() => {
    resyncLogo.current?.();
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
        body: "Browser alerts are on — notifications sound while this site is open in a tab.",
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

  if (tab === "admin") {
    return (
      <div className="app">
        <Suspense
          fallback={
            <div className="admin">
              <p className="admin-muted admin-inline-loading">Loading dashboard…</p>
            </div>
          }
        >
          <AdminApp />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {t.skipToContent}
      </a>
      <Header
        ref={headerRef}
        slotRef={slotRef}
        t={t}
        lang={lang}
        tab={tab}
        onTab={setTab}
        onToggleLang={toggleLanguage}
        notificationsEnabled={notificationsEnabled}
        onRequestNotify={requestNotificationPermission}
      />

      {/* The ONE logo for the entire app — fixed at page level (a filtered
          ancestor such as the blurred header would trap a fixed child),
          centred at scrollY=0 and flown into the navbar slot by the scroll
          effect below. Never duplicated. */}
      <img
        ref={logoRef}
        src="/omkar-logo.png"
        alt="Omkar Samithi"
        className="app-logo"
      />

      <Hero t={t} events={events} onGoToEvents={() => setTab("events")} />

      <main
          key={tab}
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className="view"
          aria-label={TAB_LABELS[tab]}
        >
        {tab === "hub" && <ContentHub t={t} lang={lang} />}
        {tab === "events" && (
          <EventsView
            t={t}
            events={events}
            lang={lang}
            notify={notify}
            onToggleNotify={toggleNotify}
            flash={flash}
          />
        )}
        {tab === "gallery" && <GalleryView t={t} lang={lang} />}
        {tab === "about" && (
          <>
            <AboutView t={t} />
            <ContactView t={t} lang={lang} flash={flash} />
            <Contact t={t} />
          </>
        )}
        {tab === "seva" && <SevaView t={t} lang={lang} flash={flash} />}
      </main>

      <footer className="footer">
        <p className="footer-pranaams">{t.pranaams}</p>
        <div className="footer-meta">
          <MapPin size={12} aria-hidden="true" /> {t.footerLocation} · © {t.appName}
        </div>
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
        <button
          type="button"
          className="to-top magnetic"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
            })
          }
        >
          ↑ {t.backToTop}
        </button>
      </footer>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
