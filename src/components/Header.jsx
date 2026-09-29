import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Globe, BellRing, BellOff, Menu, X, Sun, Moon } from "lucide-react";
import useFocusTrap from "../hooks/useFocusTrap.js";

const Header = forwardRef(function Header(
  {
    t,
    lang,
    tab,
    onTab,
    onToggleLang,
    notificationsEnabled,
    onRequestNotify,
    slotRef,
  },
  ref
) {
  const tabs = [
    { id: "hub", label: t.contentHub },
    { id: "events", label: t.events },
    { id: "gallery", label: t.galleryTab },
    { id: "seva", label: t.sevaTab },
    { id: "about", label: t.aboutTab },
  ];

  // Round-10 / audit A1: below 768px the tabs collapse into a focus-
  // trapped drawer. Lang + bell stay visible — they're used every visit.
  const [menuOpen, setMenuOpen] = useState(false);
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
        <div className="wordmark display">{t.appName}</div>
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
        <button
          type="button"
          className={`notif-btn ${notificationsEnabled ? "active" : ""}`}
          onClick={onRequestNotify}
          title={t.enableNotifications}
          aria-label={t.enableNotifications}
          aria-pressed={notificationsEnabled}
        >
          {notificationsEnabled ? (
            <BellRing size={14} aria-hidden="true" />
          ) : (
            <BellOff size={14} aria-hidden="true" />
          )}
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

      {/* Round-10 scroll progress: 2px gold hairline driven by --scroll-p
          (set inside App's existing rAF scroll loop — no extra listener). */}
      <span className="scroll-progress" aria-hidden="true" />
    </header>
  );
});

export default Header;
