import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Globe, Bell, BellRing, Menu, X, Sun, Moon } from "lucide-react";
import useFocusTrap from "../hooks/useFocusTrap.js";
import { getPushSubscription, pushSupported } from "../utils/push.js";

const Header = forwardRef(function Header(
  {
    t,
    lang,
    tab,
    onTab,
    onToggleLang,
    bellOpen,
    onBell,
    slotRef,
    progressRef,
  },
  ref
) {
  const tabs = [
    { id: "hub", label: t.contentHub },
    { id: "events", label: t.events },
    { id: "gallery", label: t.galleryTab },
    { id: "about", label: t.aboutTab },
  ];

  // Round-10 / audit A1: below 768px the tabs collapse into a focus-
  // trapped drawer. Lang + bell stay visible — they're used every visit.
  const [menuOpen, setMenuOpen] = useState(false);

  /* Round 51: the open drawer used to be announced to the stylesheet through
     :has(.nav-drawer), which on Safari restyles the WHOLE document whenever
     anything inside it changes style — including the scroll loop's per-frame
     transform writes, which is exactly when the logo is flying. One class on
     <html> says the same thing for free; the cleanup covers unmount. */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("drawer-open", menuOpen);
    return () => root.classList.remove("drawer-open");
  }, [menuOpen]);
  const menuBtnRef = useRef(null);
  const drawerRef = useRef(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useFocusTrap(drawerRef, menuOpen, { onEscape: closeMenu, restoreRef: menuBtnRef });

  // Crossing into desktop while the drawer is open → snap it shut.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Tap outside the drawer (or its button) closes it.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (drawerRef.current?.contains(e.target) || menuBtnRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  // Theme: OS preference decides the first visit (index.html sets
  // data-theme pre-paint); the toggle pins a choice in localStorage and
  // otherwise the app follows live system changes — no excuses mode.
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (window.localStorage.getItem("omkar_theme")) return; // user pinned a mode
      const next = mq.matches ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      setTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("omkar_theme", next);
    } catch {
      /* private mode — session-only choice */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "light" ? "#FAF7F2" : "#170B10");
    setTheme(next);
  };

  const goTo = (id) => {
    setMenuOpen(false);
    onTab(id);
  };

  /* Round 35: the bell wears its state. A device that already enabled
     notifications gets the ringing bell (BellRing — the bell with the two
     sound waves); everyone else gets the plain bell. The panel and the
     admin panel dispatch "omkar:pushchange" whenever a subscription is
     created or deleted in this window, so the icon flips the moment the
     tap happens — no reload, no second source of truth. */
  const [pushOn, setPushOn] = useState(false);
  useEffect(() => {
    let alive = true;
    const read = () => {
      if (!pushSupported()) {
        if (alive) setPushOn(false);
        return;
      }
      getPushSubscription()
        .then((sub) => {
          if (alive) setPushOn(Boolean(sub));
        })
        .catch(() => {
          if (alive) setPushOn(false);
        });
    };
    read();
    window.addEventListener("omkar:pushchange", read);
    return () => {
      alive = false;
      window.removeEventListener("omkar:pushchange", read);
    };
  }, []);

  const tabButtons = () =>
    tabs.map((tb) => (
      <button
        key={tb.id}
        type="button"
        className={`tab-btn ${tab === tb.id ? "active" : ""}`}
        onClick={() => goTo(tb.id)}
        aria-current={tab === tb.id ? "page" : undefined}
      >
        {tb.label}
      </button>
    ));

  return (
    <header className="header" ref={ref}>
      <div className="header-left">
        {/* Invisible slot reserving the logo's final resting place in the navbar.
            The ONE logo element (rendered at page level, fixed-positioned) flies
            into it — see App.jsx. */}
        <span className="logo-slot" ref={slotRef} aria-hidden="true" />
        <div className="wordmark display" aria-hidden="true">
          {t.appName}
        </div>
      </div>
      <nav className="tabs tabs--desktop" aria-label="Primary">
        {tabButtons()}
      </nav>
      <div className="header-actions">
        <button
          type="button"
          className="lang-btn"
          onClick={toggleTheme}
          title={theme === "light" ? t.themeToDark : t.themeToLight}
          aria-label={theme === "light" ? t.themeToDark : t.themeToLight}
        >
          {theme === "light" ? (
            <Moon size={14} aria-hidden="true" />
          ) : (
            <Sun size={14} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="lang-btn"
          onClick={onToggleLang}
          title={t.toggleLanguage}
          aria-label={t.toggleLanguage}
        >
          <Globe size={14} aria-hidden="true" /> {lang === "en" ? "ಕನ್ನಡ" : "English"}
        </button>
        {/* Round 34: the bell IS the notifications door — one tap, one
            meaning. It opens the panel; nothing local fires any more. */}
        <button
          type="button"
          className={`notif-btn ${bellOpen ? "active" : ""} ${pushOn ? "on" : ""}`}
          onClick={onBell}
          title={pushOn ? t.alertsStatusOn : t.alertsTitle}
          aria-label={pushOn ? t.alertsStatusOn : t.alertsTitle}
          aria-expanded={bellOpen}
          aria-haspopup="dialog"
        >
          {/* Round 35: enabled = the ringing bell, plain = not yet. */}
          {pushOn ? <BellRing size={14} aria-hidden="true" /> : <Bell size={14} aria-hidden="true" />}
        </button>
        <button
          ref={menuBtnRef}
          type="button"
          className="menu-btn"
          aria-expanded={menuOpen}
          aria-controls="nav-drawer"
          aria-label={menuOpen ? t.closeMenu : t.openMenu}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile drawer: focus-trapped, Escape/tap-outside close, slide-down. */}
      {menuOpen && (
        <nav className="nav-drawer" id="nav-drawer" ref={drawerRef} aria-label={t.appName}>
          <div className="nav-drawer-tabs">{tabButtons()}</div>
        </nav>
      )}

      {/* Scroll progress: a 1px gold hairline whose transform is written
          directly by App's existing rAF scroll loop. No custom property, no
          extra listener — one composited write on one leaf element. */}
      <span className="scroll-progress" ref={progressRef} aria-hidden="true" />
    </header>
  );
});

export default Header;
