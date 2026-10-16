import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { extractImageUrls, postsToImageRows } from "../api/gallery-sync.js";
import { mergeGallery } from "../src/utils/gallery.js";

const root = new URL("..", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

const adminApp = read("src/admin/AdminApp.jsx");
const vercel = read("vercel.json");
const migration = read("supabase/migrations/0003_gallery_blog_images.sql");
const sync = read("api/gallery-sync.js");
const gallery = read("src/utils/gallery.js");
const supabase = read("src/utils/supabase.js");

describe("round 54 — the Photos section is gone from the dashboard", () => {
  it("deletes the view and every reference to it", () => {
    expect(existsSync(new URL("src/admin/views/PhotosAdmin.jsx", root))).toBe(false);
    expect(adminApp).not.toContain("PhotosAdmin");
    expect(adminApp).not.toContain('{ id: "photos"');
  });
});

describe("round 54 — the gallery reads the blogs, fortnightly, by itself", () => {
  it("schedules the sync on the 1st and 15th, with room to run", () => {
    const config = JSON.parse(vercel);
    expect(config.crons).toEqual([
      { path: "/api/gallery-sync", schedule: "0 4 1,15 * *" },
    ]);
    expect(config.functions["api/gallery-sync.js"].maxDuration).toBe(60);
  });

  it("lets the page paint Blogger's image hosts, and nothing wider", () => {
    expect(vercel).toContain("https://blogger.googleusercontent.com");
    expect(vercel).toContain("https://bp.blogspot.com");
  });

  it("creates a public-read, write-locked table for the stream", () => {
    expect(migration).toContain("create table if not exists public.gallery_blog_images");
    expect(migration).toContain("for select to anon, authenticated");
    // no write policy: the service role writes, the world reads
    expect(migration).not.toContain("for insert to anon");
    expect(migration).not.toContain("for all to authenticated");
  });

  it("gates the function behind one secret, server-side keys only", () => {
    expect(sync).toContain("process.env.CRON_SECRET");
    expect(sync).toContain("401");
    expect(sync).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
    expect(sync).toContain("omkarsamithi.blogspot.com,omkarsandesh.blogspot.com");
    expect(sync).toContain("const PAGE_SIZE = 500");
    expect(sync).toContain("max-results=${PAGE_SIZE}");
    expect(sync).toContain("on_conflict=url");
    expect(sync).toContain("synced_at=lt.");
  });

  it("keeps only Blogger-hosted photographs, de-duplicated, in order", () => {
    const html = [
      '<img src="https://blogger.googleusercontent.com/img/aaa/s200/one.jpg">',
      '<img src="https://blogger.googleusercontent.com/img/aaa/s200/one.jpg">',
      '<img src="https://example.com/outside.jpg">',
      '<img src="https://bp.blogspot.com/spacer/icon.gif">',
      '<img src="https://bp.blogspot.com/-x-/s320/two.jpg">',
    ].join("");
    const urls = extractImageUrls(html);
    expect(urls).toEqual([
      "https://blogger.googleusercontent.com/img/aaa/s200/one.jpg",
      "https://bp.blogspot.com/-x-/s320/two.jpg",
    ]);
  });

  it("stores every picture twice: tile size and lightbox size", () => {
    const rows = postsToImageRows(
      [
        {
          title: "Naadamrutha 2024",
          url: "https://omkarsamithi.blogspot.com/2024/09/x.html",
          published: "2024-09-30T10:00:00Z",
          html: '<img src="https://blogger.googleusercontent.com/img/aaa/s200/one.jpg">',
        },
      ],
      "omkarsamithi.blogspot.com",
      "2026-10-14T00:00:00.000Z"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].thumb_url).toContain("s480");
    expect(rows[0].url).toContain("s1600");
    expect(rows[0].post_title).toBe("Naadamrutha 2024");
    expect(rows[0].pos).toBe(0);
  });

  it("leads the gallery with the blog stream, then uploads, then bundled", () => {
    const merged = mergeGallery(
      [{ id: "curated", src: "/gallery/x.webp", caption: "c" }],
      [],
      "en",
      () => "",
      [{ url: "u", thumb_url: "t", post_title: "p", post_url: "p-url" }]
    );
    expect(merged[0].id).toBe("blog-u");
    expect(merged[0].postUrl).toBe("p-url");
    expect(merged[1].id).toBe("curated");
  });

  it("reads the stream through the anon key like every other public table", () => {
    expect(supabase).toContain("listBlogImages");
    expect(supabase).toContain("gallery_blog_images");
    expect(gallery).toContain("fetchBlogImageRows");
  });
});
