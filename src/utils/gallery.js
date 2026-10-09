/**
 * The photo gallery, from the database to the page.
 *
 * Photos live in two places. The bundled set in src/data/content.js is always
 * there, and the Samithi's uploads come from the `photos` table and the public
 * `photos` storage bucket. This module joins them for the public Gallery page.
 *
 * Uploads are ADDED to the bundled photos rather than replacing them, which is
 * what the dashboard promises when its list is empty: the 2023–2026 photographs
 * that ship with the app do not disappear the first time someone uploads one
 * new picture.
 */

import { listPublishedPhotos, photoUrl, supabaseEnabled } from "./supabase.js";

/** Published photo rows. [] when Supabase is off, unreachable, or empty. */
export async function fetchPhotoRows() {
  if (!supabaseEnabled) return [];

  const { ok, rows } = await listPublishedPhotos();
  if (!ok || !Array.isArray(rows)) return [];
  return rows.filter((r) => r && r.storage_path);
}

/**
 * A caption in the language being read, falling back to the other one.
 *
 * Someone uploading for the first time will usually fill in only one language.
 * Showing the caption they did write beats showing none — an empty line under
 * a photograph is worse than a caption in the other language.
 */
export function captionFor(row = {}, lang = "en") {
  const kn = lang === "kn";
  const wanted = kn ? row.caption_kn : row.caption_en;
  const other = kn ? row.caption_en : row.caption_kn;
  return String(wanted || other || "").trim();
}

/**
 * A database row → the shape the gallery already uses ({ id, src, caption }).
 *
 * `urlFor` is a parameter so the mapping can be tested without a configured
 * Supabase project — photoUrl() needs a real project URL to build anything.
 */
export function mapPhotoRow(row = {}, lang = "en", urlFor = photoUrl) {
  return {
    id: row.id || `db-${row.storage_path}`,
    src: urlFor(row.storage_path),
    caption: captionFor(row, lang),
  };
}

/**
 * Uploaded photos first — newest first, which is how they were fetched — then
 * the bundled set. With nothing uploaded, or if the database is unreachable,
 * this is the bundled list untouched, the same contract the video, blog and
 * event feeds use.
 */
export function mergeGallery(curated = [], rows = [], lang = "en", urlFor = photoUrl) {
  if (!Array.isArray(rows) || rows.length === 0) return curated;

  // A row with no usable URL would render as a broken card, so drop it rather
  // than show a visitor an image that cannot load.
  const live = rows.map((row) => mapPhotoRow(row, lang, urlFor)).filter((p) => p.src);
  if (live.length === 0) return curated;

  return [...live, ...curated];
}

/** The list the public Gallery page shows. */
export async function loadGalleryPhotos(curated = [], lang = "en") {
  const rows = await fetchPhotoRows();
  return mergeGallery(curated, rows, lang);
}

/* ── the bundled photographs, at the sizes they are actually painted ─────── */

/**
 * Every bundled photograph, with the candidate widths the TILE may use.
 *
 * The originals are 1600x1067 (four of them), 800x600 (three) and 640x438
 * (one): around 1.28 MB for eight pictures. On a phone the largest tile is
 * about 350 CSS px wide, so a 1600 px file was ~4.5x more pixels than the
 * screen could show — on the very device the Samithi cares about most. The
 * gallery now offers the browser a ladder instead:
 *
 *   `tiles` — the widths a gallery tile or a homepage strip tile may take.
 *             The ladder stops at 900: no tile is ever wider than ~560 CSS px,
 *             so 900 covers a 2.5x phone and every desktop/retina case, and a
 *             3x phone gets a 900 px file rather than the 1600 px original.
 *   `full`  — the original, which only the LIGHTBOX requests, when it opens.
 *
 * Files are named by convention: `F28A5437.webp` → `F28A5437-480.webp`. They
 * are generated from the originals with ImageMagick and committed, and
 * tests/gallery-images.test.js checks each one exists, decodes to the width
 * declared here, keeps the source's aspect ratio and is smaller than it.
 *
 * A photograph uploaded through the dashboard is not in this map — it has no
 * generated variants, so gallerySrcSet() returns undefined for it and the tile
 * renders the plain src exactly as before.
 */
export const GALLERY_SOURCES = {
  "/gallery/OJ2026_DSC06494.webp": { full: 1600, tiles: [480, 900] },
  "/gallery/imga-sEgru_e_BFHf-5SY.webp": { full: 800, tiles: [480, 800] },
  "/gallery/imga-sEhySs0wHN7Rj2P-.webp": { full: 640, tiles: [480, 640] },
  "/gallery/LIR09963.webp": { full: 1600, tiles: [480, 900] },
  "/gallery/Blog-6.webp": { full: 800, tiles: [480, 800] },
  "/gallery/Blog-10.webp": { full: 800, tiles: [480, 800] },
  "/gallery/F28A5437.webp": { full: 1600, tiles: [480, 900] },
  "/gallery/F28A4999.webp": { full: 1600, tiles: [480, 900] },
};

/** Where a resized copy of `src` lives: `Photo.webp` → `Photo-480.webp`. */
export function galleryVariantHref(src, width) {
  const entry = GALLERY_SOURCES[src];
  if (!entry) return src;
  if (width >= entry.full) return src;
  return String(src).replace(/\.webp$/i, `-${width}.webp`);
}

/**
 * The `srcset` for a gallery tile — or undefined for a photograph with no
 * generated variants, so the tile falls back to a plain `src`.
 *
 * The `src` attribute stays the ORIGINAL in the markup, which is what a
 * browser without srcset support downloads; a browser that understands the
 * width descriptors ignores `src` entirely and fetches one candidate, so
 * nothing is downloaded twice.
 */
export function gallerySrcSet(src) {
  const entry = GALLERY_SOURCES[src];
  if (!entry) return undefined;
  return entry.tiles
    .map((width) => `${galleryVariantHref(src, width)} ${width}w`)
    .join(", ");
}

/**
 * The rendered width of each place a photograph appears, read off the layout
 * (max-width 880px section, minus its 20px padding; the homepage strip is a
 * 2fr/1fr grid, the gallery is `repeat(auto-fit, minmax(240px, 1fr))` with a
 * 16px gap). Accurate `sizes` is what lets the browser pick the smallest
 * candidate that still fills the box.
 */
export const GALLERY_SIZES = {
  /** Gallery tab card: 3 columns on a desktop, 1 on a phone. */
  tile: "(min-width: 940px) 270px, (min-width: 700px) 46vw, calc(100vw - 40px)",
  /** Homepage strip: the lead photograph (2fr of the 2fr/1fr grid). */
  stripLead: "(min-width: 940px) 552px, (min-width: 700px) 61vw, calc(100vw - 40px)",
  /** Homepage strip: the two beside it, and the row underneath. */
  stripSmall: "(min-width: 940px) 276px, (min-width: 700px) 30vw, calc(50vw - 26px)",
};
