import { describe, expect, it } from "vitest";
import { translations } from "../data/content.js";
import {
  captionFor,
  fetchPhotoRows,
  loadGalleryPhotos,
  mapPhotoRow,
  mergeGallery,
} from "./gallery.js";

/** Stand-in for photoUrl, which needs a configured Supabase project. */
const urlFor = (path) => `https://example.supabase.co/storage/v1/object/public/photos/${path}`;

const curated = translations.en.galleryItems;
const row = (over = {}) => ({
  id: "row-1",
  storage_path: "2026-09-30/abc.jpg",
  caption_en: "Anjaneya Pooje 2026",
  caption_kn: "ಆಂಜನೇಯ ಪೂಜೆ ೨೦೨೬",
  published: true,
  ...over,
});

describe("captionFor — one caption, two languages", () => {
  it("gives each language its own caption", () => {
    expect(captionFor(row(), "en")).toBe("Anjaneya Pooje 2026");
    expect(captionFor(row(), "kn")).toBe("ಆಂಜನೇಯ ಪೂಜೆ ೨೦೨೬");
  });

  it("falls back to the other language rather than showing nothing", () => {
    expect(captionFor(row({ caption_kn: null }), "kn")).toBe("Anjaneya Pooje 2026");
    expect(captionFor(row({ caption_en: null }), "en")).toBe("ಆಂಜನೇಯ ಪೂಜೆ ೨೦೨೬");
  });

  it("returns an empty string when there is no caption at all", () => {
    expect(captionFor(row({ caption_en: null, caption_kn: null }), "en")).toBe("");
    expect(captionFor({}, "kn")).toBe("");
  });

  it("trims stray whitespace, and treats a blank caption as absent", () => {
    expect(captionFor(row({ caption_en: "  Evening of music  " }), "en")).toBe("Evening of music");
    expect(captionFor(row({ caption_en: "   " }), "en")).toBe("");
  });
});

describe("mapPhotoRow — a database row as the gallery needs it", () => {
  it("builds the public URL from the stored path", () => {
    expect(mapPhotoRow(row(), "en", urlFor).src).toBe(
      "https://example.supabase.co/storage/v1/object/public/photos/2026-09-30/abc.jpg"
    );
  });

  it("keeps the row id, and derives one when the row has none", () => {
    expect(mapPhotoRow(row(), "en", urlFor).id).toBe("row-1");
    expect(mapPhotoRow(row({ id: null }), "en", urlFor).id).toBe("db-2026-09-30/abc.jpg");
  });

  it("produces the shape the gallery renders", () => {
    const photo = mapPhotoRow(row(), "en", urlFor);
    expect(Object.keys(photo).sort()).toEqual(["caption", "id", "src"]);
  });
});

describe("mergeGallery — uploads in front of the bundled photographs", () => {
  it("changes nothing when nothing is uploaded", () => {
    expect(mergeGallery(curated, [], "en", urlFor)).toBe(curated);
    expect(mergeGallery(curated, null, "en", urlFor)).toBe(curated);
  });

  it("puts uploads first and keeps every bundled photograph", () => {
    const merged = mergeGallery(curated, [row()], "en", urlFor);
    expect(merged).toHaveLength(curated.length + 1);
    expect(merged[0].caption).toBe("Anjaneya Pooje 2026");
    expect(merged.slice(1).map((p) => p.id)).toEqual(curated.map((p) => p.id));
  });

  it("keeps the order the database returned — newest first", () => {
    const merged = mergeGallery(
      curated,
      [row({ id: "a", caption_en: "Newest" }), row({ id: "b", caption_en: "Older" })],
      "en",
      urlFor
    );
    expect(merged.slice(0, 2).map((p) => p.caption)).toEqual(["Newest", "Older"]);
  });

  it("drops a row whose image URL cannot be built", () => {
    // A card pointing at nothing would show a broken image to visitors.
    const merged = mergeGallery(curated, [row(), row({ id: "x", storage_path: "" })], "en", () => "");
    expect(merged).toBe(curated);
  });

  it("translates the captions it merges", () => {
    const merged = mergeGallery(curated, [row()], "kn", urlFor);
    expect(merged[0].caption).toBe("ಆಂಜನೇಯ ಪೂಜೆ ೨೦೨೬");
  });
});

describe("with no Supabase configured", () => {
  it("returns no rows at all", async () => {
    // The test environment has no VITE_SUPABASE_URL, which is exactly the
    // state of a fresh clone — the site must still work.
    expect(await fetchPhotoRows()).toEqual([]);
  });

  it("leaves the bundled gallery exactly as it was", async () => {
    expect(await loadGalleryPhotos(curated, "en")).toBe(curated);
  });
});
