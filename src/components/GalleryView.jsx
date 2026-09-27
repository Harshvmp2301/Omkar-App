import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, X, ImageOff } from "lucide-react";

export default function GalleryView({ t }) {
  const items = t.galleryItems;
  const [openIndex, setOpenIndex] = useState(null);
  const [loaded, setLoaded] = useState({}); // src → decoded
  const [failed, setFailed] = useState({}); // src → permanently broken
  const touchX = useRef(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i + 1) % items.length)),
    [items.length]
  );
  const prev = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i - 1 + items.length) % items.length)),
    [items.length]
  );

  useEffect(() => {
    if (openIndex === null) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Tab") {
        // Keep focus inside the dialog (skip link and page behind stay unreachable).
        const root = document.querySelector(".lightbox");
        if (!root) return;
        const focusables = root.querySelectorAll("button");
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIndex, close, next, prev]);

  const markLoaded = (src) =>
    setLoaded((m) => (m[src] ? m : { ...m, [src]: true }));
  const markFailed = (src) =>
    setFailed((m) => (m[src] ? m : { ...m, [src]: true }));

  const open = items[openIndex];

  return (
    <div className="section">
      <div className="section-head reveal">
        <h2 className="section-title display">{t.galleryTitle}</h2>
        <span className="note">{t.sampleGallery}</span>
      </div>

      <div className="gallery-grid reveal">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className="gallery-card"
            onClick={() => setOpenIndex(i)}
            aria-label={item.caption}
          >
            {failed[item.src] ? (
              <span className="photo-failed">
                <ImageOff size={26} aria-hidden="true" />
                <span>{t.photoFailed}</span>
              </span>
            ) : (
              <img
                src={item.src}
                alt={item.caption}
                loading="lazy"
                decoding="async"
                className={!loaded[item.src] ? "ph" : ""}
                onLoad={() => markLoaded(item.src)}
                onError={() => markFailed(item.src)}
              />
            )}
            <span className="gallery-caption">{item.caption}</span>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={open.caption}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 48) (dx < 0 ? next : prev)();
          }}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={close}
            aria-label={t.closePhoto}
            autoFocus
          >
            <X size={22} aria-hidden="true" />
          </button>
          <button type="button" className="lightbox-nav left" onClick={prev} aria-label={t.prevPhoto}>
            <ChevronLeft size={28} aria-hidden="true" />
          </button>
          <figure className="lightbox-figure">
            {failed[open.src] ? (
              <span className="photo-failed photo-failed--big">
                <ImageOff size={30} aria-hidden="true" />
                <span>{t.photoFailed}</span>
              </span>
            ) : (
              <img
                src={open.src}
                alt={open.caption}
                decoding="async"
                onLoad={(e) => markLoaded(open.src)}
                onError={() => markFailed(open.src)}
              />
            )}
            <figcaption>
              {open.caption}
              <span className="lightbox-hint">{t.lightboxHint}</span>
            </figcaption>
          </figure>
          <button type="button" className="lightbox-nav right" onClick={next} aria-label={t.nextPhoto}>
            <ChevronRight size={28} aria-hidden="true" />
          </button>
          <div className="lightbox-dots">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={`dot ${i === openIndex ? "on" : ""}`}
                onClick={() => setOpenIndex(i)}
                aria-label={`${i + 1} / ${items.length}`}
                aria-current={i === openIndex}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
