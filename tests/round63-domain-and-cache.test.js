import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* Round 63 — the external review's findings 3, 4 and 5, pinned so they can
   never drift back:
   3. the domain migration: every declaring URL in index.html belongs to
      omkarsamithi.com; the ONLY old-domain string left is the GA comment
      that explains why the retired origin never reports;
   4. the README must not claim "no backend" or the old production domain;
   5. the gallery-sync secret boundary: the function answers no-store on
      every response, and the service worker never touches /api/ — a
      secret-carrying URL cannot be stored in, or served from, any cache. */

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const indexHtml = read("index.html");
const readme = read("README.md");
const sw = read("public/sw.js");
const sync = read("api/gallery-sync.js");
const vercel = read("vercel.json");

const OLD = "omkar-app.vercel.app";

describe("round 63 · finding 3 — one canonical host in every declaration", () => {
  it("declares omkarsamithi.com in canonical, social and structured data", () => {
    expect(indexHtml).toContain('<link rel="canonical" href="https://omkarsamithi.com/" />');
    expect(indexHtml).toContain('<meta property="og:url" content="https://omkarsamithi.com/" />');
    expect(indexHtml).toContain(
      '<meta property="og:image" content="https://omkarsamithi.com/og-banner.jpg" />'
    );
    expect(indexHtml).toContain(
      '<meta name="twitter:image" content="https://omkarsamithi.com/og-banner.jpg" />'
    );
    expect(indexHtml).toContain('"url": "https://omkarsamithi.com/"');
    expect(indexHtml).toContain('"logo": "https://omkarsamithi.com/icon-512.png"');
  });

  it("carries the old domain ONLY inside the GA guard's comment", () => {
    const hits = indexHtml.split("\n").filter((l) => l.includes(OLD));
    expect(hits).toHaveLength(1);
    // the one mention is the comment line explaining the GA host guard —
    // it ends the comment, it declares nothing
    expect(hits[0].trim().endsWith("-->")).toBe(true);
    expect(hits[0]).toContain("never report into the property");
    // no attribute or JSON value anywhere declares the old host
    expect(indexHtml).not.toContain(`href="https://${OLD}`);
    expect(indexHtml).not.toContain(`content="https://${OLD}`);
    expect(indexHtml).not.toContain(`"https://${OLD}`);
  });

  it("keeps the permanent redirect that retires the old host", () => {
    const j = JSON.parse(vercel);
    const redirect = j.redirects.find((r) =>
      (r.has || []).some((h) => h.type === "host" && h.value === OLD)
    );
    expect(redirect).toBeTruthy();
    expect(redirect.destination).toBe("https://omkarsamithi.com/:path*");
    expect(redirect.permanent).toBe(true);
  });
});

describe("round 63 · finding 4 — the README describes the app that exists", () => {
  it("no longer claims the site has no backend", () => {
    expect(readme).not.toContain("No backend required");
    expect(readme).toContain("**Supabase** backend");
    expect(readme).toContain("api/gallery-sync.js");
    expect(readme).toContain("gallery_blog_images");
  });

  it("names the real production domain and explains the old one", () => {
    expect(readme).toContain("Production is **https://omkarsamithi.com**");
    expect(readme).not.toContain("Production** → `omkar-app.vercel.app`");
    // the one honest mention left: the redirect that retires it
    const hits = readme.split("\n").filter((l) => l.includes(OLD));
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("redirects to it");
  });

  it("documents the gallery as blog-fed — the admin Photos section is gone", () => {
    expect(readme).toContain("no Photos section");
    expect(readme).not.toContain("upload one or many images");
    expect(readme).toContain("0 4 1,15 * *");
  });
});

describe("round 63 · finding 5 — the secret never lands in a cache", () => {
  it("answers no-store on every response, before any auth decision", () => {
    expect(sync).toContain('res.setHeader("Cache-Control", "no-store, max-age=0");');
    // set before the 401 path, so failures are uncacheable too
    expect(sync.indexOf('no-store')).toBeLessThan(sync.indexOf('"unauthorized"'));
    // both doors stay open: the header Vercel's cron sends, and the query
    expect(sync).toContain("req.headers.authorization");
    expect(sync).toContain("req.query.secret");
  });

  it("service worker bypasses /api/ entirely and purged the old cache", () => {
    expect(sw).toContain('if (url.pathname.startsWith("/api/")) return;');
    // the bypass sits in the fetch handler, before any respondWith
    expect(sw.indexOf('startsWith("/api/")')).toBeLessThan(sw.indexOf("event.respondWith("));
    // the version bump makes activate delete every pre-v5 cache — including
    // any /api/ response an older worker once stored
    expect(sw).toContain('const CACHE = "omkar-cache-v5"');
  });

  it("documents the safer header door for manual runs", () => {
    expect(readme).toContain("Authorization=\"Bearer YOUR_CRON_SECRET\"");
    expect(readme).toContain("no-store");
  });
});
