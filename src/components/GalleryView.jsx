import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export default function GalleryView({ t }) {
  const items = t.galleryItems;
  const [openIndex, setOpenIndex] = useState(null);

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
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIndex, close, next, prev]);

  const open = items[openIndex];

  return (
    <div className="section">
      <div className="section-head">
        <h2 className="section-title display">{t.galleryTitle}</h2>
        <span className="note">{t.sampleGallery}</span>
      </div>

      <div className="gallery-grid">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className="gallery-card"
            onClick={() => setOpenIndex(i)}
            aria-label={item.caption}
          >
            <img src={item.src} alt={item.caption} loading="lazy" />
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
            <img src={open.src} alt={open.caption} />
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
