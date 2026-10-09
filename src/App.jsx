import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { Facebook, Youtube, ExternalLink, MapPin, Mail } from "lucide-react";
import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import ContentHub from "./components/ContentHub.jsx";
import EventsView from "./components/EventsView.jsx";
import GalleryView from "./components/GalleryView.jsx";
import AboutView from "./components/AboutView.jsx";
import SevaView from "./components/SevaView.jsx";
import ContactView from "./components/ContactView.jsx";
import Contact from "./components/Contact.jsx";
import ReminderStrip from "./components/ReminderStrip.jsx";
import { translations } from "./data/content.js";
import useLocalStorage from "./hooks/useLocalStorage.js";
import { tabFromHash } from "./utils/route.js";
import { loadEvents, upcomingEvents } from "./utils/events.js";
import { directionsUrl } from "./utils/venue.js";
import {
  NAV_H,
  REST_TRANSFORM,
  flightDistance,
  logoOffset,
  restGeometry,
  scrollFraction,
} from "./utils/logo.js";

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
  const progressRef = useRef(null); // the 1px scroll-progress bar in the header
  const aspectRef = useRef(1); // logo aspect survives effect re-runs
  // Is the HOME hero (and its big mark) on screen? Seeded from the first tab so
  // a deep link never paints a centred mark on a view that has no hero.
  const heroModeRef = useRef(tab === "hub");

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

  // One loaded list, two questions asked of it.
  //
  //   programs — when is each programme NEXT? Today or later, in date order.
  //              This is what the programme rows, the homepage blocks and the
  //              festival calendar render, so a programme that has already
  //              happened this year can never appear under "Upcoming".
  //   events   — the same-year view (past dates included), which the LAMPS
  //              need: a lamp stays lit from a month before its programme
  //              until New Year, so April's lamp is still burning in October.
  //
  // Both come from the same loaded list, so the two can never drift apart.
  const programs = useMemo(() => upcomingEvents(events), [events]);

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
  // View change → move focus into the new view so screen readers announce it,
  // and START THE NEW VIEW AT ITS TOP. Tabs are separate pages: keeping the old
  // scroll offset dropped you into the middle of the next one (and, on Home,
  // mid-flight of the logo). focus() runs first with preventScroll so the jump
  // is never announced as a scroll.
  useEffect(() => {
    if (firstViewFocus.current) {
      firstViewFocus.current = false;
      return undefined;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    return undefined;
  }, [tab]);

  // The mark is docked in the navbar on every view that has no hero — the mark
  // only takes the centre stage where it belongs (Home). Published through a
  // ref so the scroll effect reads it per frame without re-subscribing.
  useEffect(() => {
    heroModeRef.current = tab === "hub";
    resyncLogo.current?.();
  }, [tab]);

  useEffect(() => {
    document.documentElement.lang = lang;
    const page = TAB_LABELS[tab];
    // appNamePlain, not appName: the wordmark token is upper-case for display,
    // and a tab title should not shout.
    const brand = t.appNamePlain || t.appName;
    document.title = page ? `${page} · ${brand} · Muscat` : `${brand} · Muscat`;
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

  // --- single-logo scroll transition (every tab) ---------------------------
  // The ONE logo (rendered once at page level) starts centred in the viewport
  // at scrollY=0 and flies into its slot in the sticky navbar over a fixed
  // distance (flightDistance, derived from its own size) — on EVERY tab.
  // Scroll back to the top and it glides back to the centre; it follows the
  // scroll wherever you are.
  useLayoutEffect(() => {
    const logo = logoRef.current;
    const slot = slotRef.current;
    if (!logo || !slot) return undefined;

    let raf = 0;
    let measureTimer = 0;
    let measureDeadline = 0;
    let lastScrollAt = 0;
    let lastTransform = "";
    let lastScrollP = -1;


    // Reduced motion: no scroll-linked movement at all. The mark is centred at
    // rest and switches to its navbar slot on the first nudge of scrolling —
    // a state change, not a glide. (The CSS block already kills transitions;
    // the flight is JavaScript, so it needs its own switch.)
    const motionQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    let reduced = Boolean(motionQuery && motionQuery.matches);
    const onMotionChange = () => {
      reduced = Boolean(motionQuery && motionQuery.matches);
      lastTransform = "";
      schedule();
    };

    // Everything that depends on the WINDOW and not on the scroll is read once,
    // here, and reused. Reading layout on every scroll frame is what made this
    // animation stutter on phones: position:fixed geometry plus a forced
    // synchronous layout per frame, while the previous frame's style writes
    // were still unflushed.
    const geom = {
      aspect: aspectRef.current || 1, // width / height, measured from the file
      size: 0, // the mark's height at rest — READ BACK from the rendered mark
      startX: 0, // the centre it rests on, read back the same way
      startY: 0,
      targetX: 0, // the navbar slot's centre
      targetY: 0,
      maxScroll: 0, // measured, so the frame loop never reads layout
      ready: false, // no transform is written until measure() has run once
    };
    if (!geom.aspect && logo.naturalWidth && logo.naturalHeight) {
      geom.aspect = logo.naturalWidth / logo.naturalHeight;
    }

    // The hero is only rendered on Home, so it is (re)found inside measure()
    // — which runs a handful of times per scene, never per frame. Both the
    // observed node and the observer itself are declared HERE: measure() can be
    // called before the observer is created.
    let heroContent = null;
    let previousHero = null;
    let ro = null;

    // ── measure: the only place that reads layout (so it must not run per frame)
    const measure = () => {
      const doc = document.documentElement;
      const hero = document.querySelector(".hero-content");
      if (hero !== heroContent) {
        heroContent = hero;
        if (ro) {
          if (previousHero) ro.unobserve(previousHero);
          previousHero = hero;
          if (hero) ro.observe(hero);
        }
      }
      if (logo.naturalWidth && logo.naturalHeight) {
        geom.aspect = logo.naturalWidth / logo.naturalHeight;
        aspectRef.current = geom.aspect;
      }
      slot.style.width = `${Math.round(NAV_H * geom.aspect)}px`; // the docked size
      const rect = slot.getBoundingClientRect();
      geom.targetX = rect.left + rect.width / 2;
      geom.targetY = rect.top + rect.height / 2;
      // How far the page can scroll. Cheap here (measure() runs a handful of
      // times per scene), never in the frame loop. It only drives the 1px
      // progress bar; the flight does not depend on it.
      geom.maxScroll = Math.max(0, doc.scrollHeight - doc.clientHeight);

      // The mark's rest size and centre are READ BACK from what the stylesheet
      // drew — never recomputed here from a viewport number.
      //
      // They used to come from documentElement.clientHeight, written over the
      // stylesheet as pixels. That agrees with the CSS on a desktop and in an
      // installed app, where "the viewport height" has one answer. In a phone
      // BROWSER it has several — the address bar and toolbars retract, so the
      // small, large and dynamic viewports differ by 50-90px, clientHeight is
      // a different one on iOS and on Chrome, and the mark's own `top: 50%`
      // follows yet another. Measured in a real engine with the toolbar
      // modelled, that gave a mark 10-25% smaller than designed, a rest
      // position that slid 28-43px whenever the bar moved, and a docked mark
      // 28-43px below its slot that never corrected itself — browser-only,
      // and none of it in the installed app, where there is no toolbar.
      //
      // So: park the mark on the stylesheet's own anchor, read the box, and fly
      // from exactly there. The anchor is a STATIC unit (svh — see .app-logo),
      // so what is read here stays true while the toolbar moves. All of this
      // is synchronous, so the parked position is never painted.
      logo.style.transform = REST_TRANSFORM;
      const rest = restGeometry(logo.getBoundingClientRect());
      // Not laid out (hidden, or the stylesheet has not arrived): keep the CSS
      // fallback rather than flying from a made-up position.
      if (!(rest.size > 0)) return;
      geom.size = rest.size;
      geom.startX = rest.startX;
      geom.startY = rest.startY;
      // NOTE: neither the size nor left/top are written. The stylesheet owns
      // the mark's size and its rest position; the flight is a transform added
      // on top, so the box the image is rasterised in never changes while it
      // moves.
      geom.ready = true;
      lastTransform = "";
      update();
    };

    // ── update: per frame, and it touches no layout at all
    const update = () => {
      raf = 0;
      // Until the logo has been measured, the CSS fallback (fixed, centred)
      // stands — an unmeasured transform would park the mark in the corner.
      if (!geom.ready) return;
      const scrollY = window.scrollY;
      // maxScroll is MEASURED, never read here. `documentElement.scrollHeight`
      // is a layout read: with the previous frame's style writes still
      // unflushed it forces a synchronous style+layout flush on every scroll
      // frame — the single most expensive thing this loop used to do, and a
      // classic source of stutter on a mid-range phone. It is recomputed in
      // measure() (load, resize, tab change, and any change in the page's own
      // height, via the ResizeObserver on <body>).
      const maxScroll = geom.maxScroll;

      // The header hairline is a custom property written to the HEADER, not to
      // :root. A custom property on the root invalidates style for the whole
      // document on every scroll frame; scoped to the header it is one tiny
      // subtree. Written only when the value actually changed.
      // Clamped at BOTH ends: iOS rubber-bands, so scrollY goes negative above
      // the top, and a negative scaleX would draw the bar mirrored.
      const scrollP = scrollFraction(scrollY, maxScroll);
      // Written STRAIGHT onto the 1px bar, not as a custom property on the
      // header. A custom property is inherited, so setting one on the header
      // restyled its whole subtree (tabs, buttons, wordmark) on every frame —
      // and the next frame's layout read then flushed it synchronously. One
      // style write on one leaf element costs a fraction of that.
      const roundedP = Math.round(scrollP * 500);
      if (roundedP !== lastScrollP) {
        lastScrollP = roundedP;
        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${(roundedP / 500).toFixed(4)})`;
        }
      }

      // Which progress the mark is drawn at:
      //   · no hero on this view  → already docked; nothing to animate
      //   · reduced motion        → snap between the two states, never glide
      //   · otherwise             → the scroll-linked flight, below
      const home = heroModeRef.current;
      if (!home || reduced) {
        const pSnap = !home ? 1 : scrollY > 24 ? 1 : 0;
        const snapped = logoOffset({
          startY: geom.startY,
          size: geom.size,
          centerX: geom.startX,
          targetX: geom.targetX,
          targetY: geom.targetY,
          progress: pSnap,
          aspect: geom.aspect,
        });
        const snapTransform = `${REST_TRANSFORM} translate3d(${snapped.dx.toFixed(2)}px, ${snapped.dy.toFixed(2)}px, 0) scale(${snapped.scale.toFixed(4)})`;
        if (snapTransform !== lastTransform) {
          lastTransform = snapTransform;
          logo.style.transform = snapTransform;
        }
        return;
      }

      // Flight ramp: a FIXED distance derived from the mark's own size — never
      // a fraction of the page's scrollable range.
      //
      // It used to be the first 15% of the whole range. On a long page — a
      // phone, with the gallery and the feeds loaded — that is 600-1200px, so
      // the mark barely moved while the copy slid up behind it, and any change
      // in the page's height (a feed arriving, an image settling, the
      // ResizeObserver on <body>) RESCALED the ramp mid-scroll and made the
      // mark jump. That is the jitter, the mark-over-the-name overlap and the
      // "it never reaches the corner" report, all from one line.
      //
      // The stylesheet owns the mark's size (clamp(88px, 30vh, 220px)) and the
      // hero reserves REST_GAP of clearance below it, so docking within about
      // three quarters of the mark's own height clears the copy before the copy
      // can ever reach it — at every viewport, on any page length.
      const flightPx = flightDistance(geom.size);
      let p = scrollY / flightPx;
      p = Math.min(1, Math.max(0, p));
      p = p * p * (3 - 2 * p); // smoothstep for a natural glide

      // One compositor-only write. The element's width and height never change
      // after measure, so this is a transform and never a layout. The
      // `translate(-50%, -50%)` half is the stylesheet's anchor — it is what
      // puts the mark's centre on the viewport centre when dx/dy are zero.
      const t = logoOffset({
        startY: geom.startY,
        size: geom.size,
        centerX: geom.startX,
        targetX: geom.targetX,
        targetY: geom.targetY,
        progress: p,
        aspect: geom.aspect,
      });
      const transform = `${REST_TRANSFORM} translate3d(${t.dx.toFixed(2)}px, ${t.dy.toFixed(2)}px, 0) scale(${t.scale.toFixed(4)})`;
      if (transform !== lastTransform) {
        lastTransform = transform;
        logo.style.transform = transform;
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    // Re-measuring is deferred until the page is still. On phones the address
    // bar sliding fires `resize` (and moves the ResizeObserver) DURING a
    // scroll. Nothing measure() reads depends on the toolbar any more — the
    // mark's anchor and the hero are static units — so those events are
    // harmless; the deferral is only so a forced layout never lands in the
    // middle of a gesture. A short hard cap guarantees the measure still runs
    // on a long momentum scroll.
    const measureSoon = () => {
      if (measureTimer) return;
      if (!measureDeadline) measureDeadline = performance.now() + 1200;
      measureTimer = window.setTimeout(() => {
        measureTimer = 0;
        const settled = performance.now() - lastScrollAt >= 200;
        if (!settled && performance.now() < measureDeadline) {
          measureSoon();
          return;
        }
        measureDeadline = 0;
        measure();
      }, 120);
    };

    const onScroll = () => {
      lastScrollAt = performance.now();
      schedule();
    };

    // Tab and language changes re-run this measure: the hero copy's own height
    // can change with the text, and the geometry follows it.
    resyncLogo.current = measure;

    if (logo.complete) measure();
    else logo.addEventListener("load", measure);

    // The hero copy's box is what sets the logo's size and clearance, and it
    // changes behind our back: the webfonts swap in (different metrics), the
    // headline rewraps, a language change alters every line. Measuring once and
    // trusting it is what left the mark parked off-centre — so watch the two
    // elements whose size decides the geometry and re-measure when either
    // changes. ResizeObserver fires on those changes, not on every frame.
    if (typeof ResizeObserver === "function") {
      ro = new ResizeObserver(() => measureSoon());
      heroContent = document.querySelector(".hero-content");
      previousHero = heroContent;
      if (heroContent) ro.observe(heroContent);
      if (headerRef.current) ro.observe(headerRef.current);
      // Body height changes as content arrives (feeds, images, a tab switch):
      // that moves the end of the page, so maxScroll must follow it.
      ro.observe(document.body);
    }
    // Belt and braces for the font swap: `fonts.ready` can resolve before the
    // layout has taken the new metrics, so measure on the next frames rather
    // than synchronously on the promise.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measureSoon).catch(() => {});
    }
    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measureSoon);
    // The OS "reduce motion" setting can be changed while the app is open.
    if (motionQuery) motionQuery.addEventListener("change", onMotionChange);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (measureTimer) clearTimeout(measureTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measureSoon);
      if (motionQuery) motionQuery.removeEventListener("change", onMotionChange);
      if (ro) ro.disconnect();
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
    // The header's height depends on the WIDTH (it wraps), never on the height.
    // A phone browser fires `resize` on every frame while its address bar
    // slides, with the width unchanged — and each of those events forced a
    // synchronous layout (offsetHeight) in the middle of the scroll, on the
    // browser only: an installed app has no address bar to slide.
    let lastWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      setH();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
    flash(nextLang === "kn" ? "ಭಾಷೆ ಬದಲಾಗಿದೆ" : "Language changed");
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
        progressRef={progressRef}
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
      {/* The mark is drawn at 220 CSS px, so a 220px file is upscaled on every
          retina screen — 2.3x soft at the most prominent element on the page.
          srcset lets those screens take the 512px candidate while 1x screens
          keep the small file, and both are the same artwork in the same frame
          (verified pixel-wise), so the mark's size and aspect are identical
          whichever the browser picks.

          Retina screens are the phones, so the file a phone actually downloads
          is the WebP pair: 50 kB at 512px instead of 334 kB, for the same
          pixels. The PNG pair stays behind it as the fallback, with the same
          widths and the same sizes, so the browser selects the same candidate
          in whichever format it supports and the chosen width never changes.
          index.html preloads the same list — the two must stay identical. */}
      <picture>
        <source
          type="image/webp"
          srcSet="/omkar-logo-220.webp 220w, /omkar-logo-512.webp 512w"
          sizes="220px"
        />
        <img
          ref={logoRef}
          src="/omkar-logo.png"
          srcSet="/omkar-logo.png 220w, /icon-512.png 512w"
          sizes="220px"
          alt="Omkar Samithi"
          decoding="async"
          className="app-logo"
        />
      </picture>

      {/* The hero belongs to the HOME tab. On the other tabs it stood between
          the visitor and the page they asked for — opening "Events" showed the
          homepage's hero and its CTAs — so those views now begin with their own
          heading, and the mark is already docked in the navbar. */}
      {tab === "hub" && (
        <Hero
          t={t}
          events={events}
          onGoToEvents={() => setTab("events")}
          onGoToAbout={() => setTab("about")}
        />
      )}

      <ReminderStrip t={t} lang={lang} programs={programs} />

      <main
          key={tab}
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className="view"
          aria-label={TAB_LABELS[tab]}
        >
        {tab === "hub" && (
          <ContentHub
            t={t}
            lang={lang}
            events={programs}
            flash={flash}
            onTab={setTab}
          />
        )}
        {tab === "events" && (
          <EventsView
            t={t}
            events={programs}
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
        {tab === "seva" && (
          <SevaView t={t} lang={lang} flash={flash} events={programs} />
        )}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <p className="footer-name display">{t.appName}</p>
            <p className="footer-org">{t.footerOrgLine}</p>
            <p className="footer-pranaams">{t.pranaams}</p>
          </div>

          <nav className="footer-col" aria-label={t.footerExplore}>
            <h2 className="footer-col-title">{t.footerExplore}</h2>
            <button type="button" className="footer-link" onClick={() => setTab("events")}>
              {t.events}
            </button>
            <button type="button" className="footer-link" onClick={() => setTab("gallery")}>
              {t.galleryTab}
            </button>
            <button type="button" className="footer-link" onClick={() => setTab("seva")}>
              {t.sevaTab}
            </button>
            <button type="button" className="footer-link" onClick={() => setTab("about")}>
              {t.aboutTab}
            </button>
          </nav>

          <nav className="footer-col" aria-label={t.footerConnect}>
            <h2 className="footer-col-title">{t.footerConnect}</h2>
            <a className="footer-link" href={`mailto:${t.contactEmail}`}>
              <Mail size={13} aria-hidden="true" /> {t.footerEmail}
            </a>
            <a
              className="footer-link"
              href="https://www.youtube.com/@OmkarSamithi"
              target="_blank"
              rel="noreferrer"
            >
              <Youtube size={13} aria-hidden="true" /> YouTube
            </a>
            <a
              className="footer-link"
              href="https://www.facebook.com/groups/omkarsamithi/"
              target="_blank"
              rel="noreferrer"
            >
              <Facebook size={13} aria-hidden="true" /> Facebook
            </a>
            <a
              className="footer-link"
              href="https://omkarfeedback.blogspot.com/"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={13} aria-hidden="true" /> {t.footerFeedback}
            </a>
            <a
              className="footer-link"
              href={directionsUrl(t.eventsList[0]?.venue || t.footerLocation)}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin size={13} aria-hidden="true" /> {t.getDirections}
            </a>
          </nav>
        </div>

        <div className="footer-base">
          <span className="footer-copy">
            © {t.appName} · {t.footerLocation}
          </span>
          <button
            type="button"
            className="to-top"
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
