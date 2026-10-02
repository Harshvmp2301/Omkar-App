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
