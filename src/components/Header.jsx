import { forwardRef } from "react";
import { Globe, BellRing, BellOff } from "lucide-react";

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
    { id: "donate", label: t.donateTab },
    { id: "seva", label: t.sevaTab },
    { id: "about", label: t.aboutTab },
  ];

  return (
    <header className="header" ref={ref}>
      <div className="header-left">
        {/* Invisible slot reserving the logo's final resting place in the navbar.
            The ONE logo element (rendered at page level, fixed-positioned) flies
            into it — see App.jsx. */}
        <span className="logo-slot" ref={slotRef} aria-hidden="true" />
        <div className="wordmark display">{t.appName}</div>
      </div>
      <div className="header-actions">
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
        <nav className="tabs" aria-label="Primary">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              className={`tab-btn ${tab === tb.id ? "active" : ""}`}
              onClick={() => onTab(tb.id)}
              aria-current={tab === tb.id ? "page" : undefined}
            >
              {tb.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
});

export default Header;
