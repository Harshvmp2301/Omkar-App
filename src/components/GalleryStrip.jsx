import { ArrowRight } from "lucide-react";

/**
 * Photography, given room to be the point.
 *
 * The Gallery tab has the full set and the lightbox. On the homepage one
 * photograph leads, two sit beside it, and the rest line up underneath — a
 * composition rather than a grid of equals — with one way through to the whole
 * gallery. Every tile opens that tab rather than duplicating the lightbox, so
 * there is a single place where photos are viewed.
 */
export default function GalleryStrip({ t, onOpenGallery }) {
  const items = (t.galleryItems || []).slice(0, 6);
  if (items.length === 0) return null;

  const [lead, ...rest] = items;
  const supporting = rest.slice(0, 2);
  const remaining = rest.slice(2);
  const tile = (item, className) => (
    <button
      key={item.id}
      type="button"
      className={`strip-tile ${className}`}
      onClick={onOpenGallery}
      aria-label={item.caption || t.photoLabel}
    >
      <img src={item.src} alt="" loading="lazy" decoding="async" />
      {item.caption ? <span className="strip-caption">{item.caption}</span> : null}
    </button>
  );

  return (
    <section className="section gallery-strip reveal" aria-labelledby="gallery-strip-title">
      <div className="section-head">
        <h2 className="section-title display" id="gallery-strip-title">
          {t.fromOurGallery}
        </h2>
        <button type="button" className="link-cta" onClick={onOpenGallery}>
          {t.viewGallery} <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="strip-grid">
        {tile(lead, "strip-lead")}
        <div className="strip-support">{supporting.map((it) => tile(it, "strip-small"))}</div>
      </div>
      {remaining.length > 0 && (
        <div className="strip-row">{remaining.map((it) => tile(it, "strip-small"))}</div>
      )}
    </section>
  );
}
