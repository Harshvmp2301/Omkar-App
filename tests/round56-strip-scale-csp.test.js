import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { stripItems, STRIP_SIZE } from "../src/utils/gallery.js";
import { translations } from "../src/data/content.js";

const root = new URL("..", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

const vercel = read("vercel.json");
const blogger = read("src/utils/blogger.js");
const youtube = read("src/utils/youtube.js");
const supabase = read("src/utils/supabase.js");
const strip = read("src/components/GalleryStrip.jsx");
const view = read("src/components/GalleryView.jsx");
const styles = read("src/styles.css");

describe("round 56 — the CSP allows the feeds it must never silently kill", () => {
  it("lets the blog's JSONP feed through script-src", () => {
    // The host the feed module actually dials is the host the CSP must name.
    expect(blogger).toContain('const DEFAULT_BLOG_HOST = "omkarsamithi.blogspot.com"');
    const scriptSrc = vercel.match(/script-src [^;]+/)[0];
    expect(scriptSrc).toContain("https://omkarsamithi.blogspot.com");
    // The Blogger v3 fallback is JSONP to googleapis too.
    expect(scriptSrc).toContain("https://www.googleapis.com");
  });

  it("lets the YouTube fetch through connect-src", () => {
    expect(youtube).toContain("https://www.googleapis.com/youtube/v3/");
    const connectSrc = vercel.match(/connect-src [^;]+/)[0];
    expect(connectSrc).toContain("https://www.googleapis.com");
  });
});

describe("round 56 — the homepage strip shows the NEWEST post, not a random mix", () => {
  const row = (n, post, title) => ({
    url: `https://blogger.googleusercontent.com/img/full-${n}.jpg`,
    thumb_url: `https://blogger.googleusercontent.com/img/thumb-${n}.jpg`,
    post_title: title,
    post_url: `https://omkarsamithi.blogspot.com/2026/10/${post}.html`,
    pos: n,
  });

  it("keeps the database's newest-post-first ordering contract", () => {
    expect(supabase).toContain("order=published_at.desc,pos.asc");
  });

  it("leads with the newest post's own photographs, in post order", () => {
    const rows = [
      row(0, "newest", "ಓಂಕಾರ ನಾದಾಮೃತ ೨೦೨೬"),
      row(1, "newest", "ಓಂಕಾರ ನಾದಾಮೃತ ೨೦೨೬"),
      row(2, "newest", "ಓಂಕಾರ ನಾದಾಮೃತ ೨೦೨೬"),
      row(3, "older", "ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ ೨೦೨೬"),
      row(4, "older", "ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ ೨೦೨೬"),
      row(5, "older", "ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ ೨೦೨೬"),
      row(6, "older", "ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ ೨೦೨೬"),
      row(7, "oldest", "ಓಂಕಾರ ನಾದಾಮೃತ ೨೦೨೪"),
    ];
    const items = stripItems(rows);
    expect(items).toHaveLength(STRIP_SIZE);
    // newest post first, in its own order; a short post tops up from the next
    expect(items.map((p) => p.src)).toEqual([
      "https://blogger.googleusercontent.com/img/thumb-0.jpg",
      "https://blogger.googleusercontent.com/img/thumb-1.jpg",
      "https://blogger.googleusercontent.com/img/thumb-2.jpg",
      "https://blogger.googleusercontent.com/img/thumb-3.jpg",
      "https://blogger.googleusercontent.com/img/thumb-4.jpg",
      "https://blogger.googleusercontent.com/img/thumb-5.jpg",
    ]);
    // the event is named ONCE: the lead tile carries the post title, the
    // rest stay quiet instead of repeating it six times
    expect(items[0].caption).toBe("ಓಂಕಾರ ನಾದಾಮೃತ ೨೦೨೬");
    expect(items.slice(1).every((p) => p.caption === "")).toBe(true);
    // every tile links home to its own post
    expect(items[0].postUrl).toContain("/newest.html");
    expect(items[3].postUrl).toContain("/older.html");
  });

  it("returns null on an empty stream, so the curated set stays", () => {
    expect(stripItems([])).toBeNull();
    expect(stripItems()).toBeNull();
  });

  it("is what the homepage strip actually renders", () => {
    expect(strip).toContain("loadStripPhotos");
    expect(strip).toContain("(strip || t.galleryItems).slice(0, 6)");
  });
});

describe("round 56 — the gallery survives its own success", () => {
  it("pages the grid in batches instead of rendering every photo", () => {
    expect(view).toContain("const PAGE = 24");
    expect(view).toContain("items.slice(0, limit).map");
    expect(view).toContain("setLimit((l) => l + PAGE)");
    expect(view).toContain("{t.loadMore}");
  });

  it("swaps the dot row for a counter past the dot limit", () => {
    expect(view).toContain("const DOTS_MAX = 12");
    expect(view).toContain("items.length <= DOTS_MAX");
    expect(view).toContain("lightbox-count");
    expect(view).toContain("t.photoPosition");
  });

  it("styles both new pieces", () => {
    expect(styles).toContain(".gallery-more");
    expect(styles).toContain(".lightbox-count");
  });

  it("says 'Load more' and the position in both languages", () => {
    for (const loc of ["en", "kn"]) {
      expect(translations[loc].loadMore.trim().length).toBeGreaterThan(0);
      expect(translations[loc].photoPosition).toContain("{index}");
      expect(translations[loc].photoPosition).toContain("{total}");
    }
  });
});
