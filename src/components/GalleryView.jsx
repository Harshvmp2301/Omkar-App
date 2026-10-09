import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, ImageOff } from "lucide-react";
import useFocusTrap from "../hooks/useFocusTrap.js";
import {
  GALLERY_SIZES,
  gallerySrcSet,
  galleryVariantHref,
  loadGalleryPhotos,
} from "../utils/gallery.js";

export default function GalleryView({ t, lang }) {
  // Photographs the Samithi uploads in the dashboard are added in front of the
  // bundled ones — never instead of them. With nothing uploaded, or if the
  // database is unreachable, this stays the bundled list, the same contract the
  // video, blog and event feeds use. The result remembers WHICH language it was
  // built for, so switching language re-derives rather than showing the wrong
  // captions.
  const [live, setLive] = useState({ lang: null, items: null });

  useEffect(() => {
    let alive = true;
    loadGalleryPhotos(t.galleryItems, lang).then((photos) => {
      if (alive) setLive({ lang, items: photos });
    });
    return () => {
      alive = false;
    };
  }, [lang, t]);

  const items = live.lang === lang && live.items ? live.items : t.galleryItems;

  // Every photo needs a name for screen readers and for the browser's own
  // "image failed" text. A caption is the best one; where there is none, a
  // plain label still beats an unlabelled button.
  const labelFor = (item) => item.caption || t.photoLabel;
  const [openIndex, setOpenIndex] = useState(null);
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState({}); // src → decoded
  const [failed, setFailed] = useState({}); // src → permanently broken
  const touchX = useRef(null);
  const openerRef = useRef(null); // card that opened the lightbox
  const lightboxRef = useRef(null);

  const close = useCallback(() => setOpenIndex(null), []);
  // Shared trap (hooks/useFocusTrap — also used by the mobile nav drawer):
  // Tab containment, Escape-to-close, and focus restore to the opening card.
  useFocusTrap(lightboxRef, openIndex !== null, {
    onEscape: close,
    restoreRef: openerRef,
  });
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i + 1) % items.length)),
    [items.length]
  );
  const prev = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i - 1 + items.length) % items.length)),
    [items.length]
  );

  // Escape + Tab containment now live in useFocusTrap; this effect owns only
  // arrow-key navigation and the background scroll lock.
  useEffect(() => {
    if (openIndex === null) return undefined;
    const onKey = (e) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIndex, next, prev]);

  const markLoaded = (src) =>
    setLoaded((m) => (m[src] ? m : { ...m, [src]: true }));
  const markFailed = (src) =>
    setFailed((m) => (m[src] ? m : { ...m, [src]: true }));

  const open = openIndex === null ? null : items[openIndex];

  return (
    <div className="section">
      <div className="section-head reveal">
        <h1 className="section-title display">{t.galleryTitle}</h1>
        <span className="note">{t.sampleGallery}</span>
      </div>

      <div className="gallery-grid reveal">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className="gallery-card"
            onClick={(e) => {
              openerRef.current = e.currentTarget;
              // A failure from an earlier, transient error must not follow the
              // photograph into the lightbox — it used to: one dropped request
              // in the grid left the full-screen view showing "unavailable"
              // with nothing to retry.
              setFailed((m) => (m[item.src] ? { ...m, [item.src]: false } : m));
              setOpenIndex(i);
            }}
            aria-label={labelFor(item)}
          >
            {failed[item.src] ? (
              <span className="photo-failed">
                <ImageOff size={26} aria-hidden="true" />
                <span>{t.photoFailed}</span>
              </span>
            ) : (
              <img
                src={item.src}
                srcSet={gallerySrcSet(item.src)}
                sizes={GALLERY_SIZES.tile}
                alt={labelFor(item)}
                loading="lazy"
                decoding="async"
                className={!loaded[item.src] ? "ph" : ""}
                onLoad={() => markLoaded(item.src)}
                onError={() => markFailed(item.src)}
              />
            )}
            {item.caption ? <span className="gallery-caption">{item.caption}</span> : null}
          </button>
        ))}
      </div>

      {/* Rendered into <body>, not into this view. The view is wrapped in an entrance
          animation, and anything that leaves a transform behind on an ancestor makes
          it the containing block for `position: fixed` — which is how this viewer
          once ended up laid out against the whole page and painted under the header.
          A portal makes the viewer immune to whatever its ancestors do. */}
      {open &&
        createPortal(
          <div
            ref={lightboxRef}
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={labelFor(open)}
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
                  <button
                    type="button"
                    className="lightbox-retry"
                    onClick={() => {
                      setFailed((m) => ({ ...m, [open.src]: false }));
                      setRetry((n) => n + 1);
                    }}
                  >
                    {t.tryAgain}
                  </button>
                </span>
              ) : (
                // The lightbox is the one place the ORIGINAL is right: it is
                // opened deliberately, one photograph at a time, at up to 960px
                // on a retina screen. No srcset here — this is the full source,
                // fetched when the visitor actually asks for it.
                //
                // While that arrives, the panel shows the 480px variant as a
                // background (already downloaded for the grid), so opening a
                // photograph is never an empty maroon rectangle on a slow
                // connection — which is how it read on every device the owner
                // tried except the one with the images already cached.
                // `key` restarts the element on an explicit retry.
                <img
                  key={`${open.src}-${retry}`}
                  src={open.src}
                  alt={labelFor(open)}
                  decoding="async"
                  className={loaded[open.src] ? "" : "lb-loading"}
                  style={{
                    backgroundImage: `url(${galleryVariantHref(open.src, 480)})`,
                  }}
                  onLoad={() => markLoaded(open.src)}
                  onError={() => markFailed(open.src)}
                />
              )}
              <figcaption>
                {open.caption || labelFor(open)}
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
          </div>,
          document.body
        )}
    </div>
  );
}
