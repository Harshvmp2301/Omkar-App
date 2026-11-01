import NextProgram from "./NextProgram.jsx";
import WhatWeDo from "./WhatWeDo.jsx";
import GalleryStrip from "./GalleryStrip.jsx";
import WatchStacks from "./WatchStacks.jsx";

/**
 * The homepage, in the order round 70 settled it:
 *
 *   the identity hero (above) → what happens next → what we do →
 *   THE STACKS: one fanned card per program, newest video on top,
 *   one click to that program's YouTube playlist → photographs.
 *
 * Round 70 retired the old archive band completely: the curated recordings
 * grid, the Omkar Sandesh blog list and the festival-notes column are gone
 * from the site and from the PWA, together with the footer's blog link.
 * Two earlier showcase attempts (shelves-with-accordion, then pills plus a
 * rotating stage) were retired the same round on the owner's rulings: no
 * click-maze, every program named, the fan of newest thumbnails springing
 * open on hover, and one click straight to YouTube.
 */
export default function ContentHub({ t, lang, events = [], onTab, flash }) {
  return (
    <>
      <NextProgram
        t={t}
        lang={lang}
        events={events}
        onViewAll={() => onTab("events")}
        flash={flash}
      />

      <WhatWeDo t={t} />

      <WatchStacks t={t} lang={lang} />

      <GalleryStrip t={t} onOpenGallery={() => onTab("gallery")} />
    </>
  );
}
