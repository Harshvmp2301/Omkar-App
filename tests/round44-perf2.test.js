import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const content = readFileSync(new URL("../src/data/content.js", import.meta.url), "utf8");
const yt = readFileSync(new URL("../src/utils/youtube.js", import.meta.url), "utf8");
const hub = readFileSync(new URL("../src/components/ContentHub.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const vercel = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");

describe("round 44 — the mobile report, answered", () => {
  it("fetches YouTube thumbs from the vi_webp ladder, with a jpg fallback", () => {
    expect(content).toContain("https://i.ytimg.com/vi_webp/");
    expect(content).not.toContain("img.youtube.com/vi/");
    expect(yt).toContain("https://i.ytimg.com/vi_webp/");
    expect(hub).toContain('.replace("i.ytimg.com/vi_webp/", "img.youtube.com/vi/")');
    expect(hub).toContain('.replace(".webp", ".jpg")');
  });

  it("defers the analytics tag until load plus an idle moment", () => {
    expect(html).toContain("window.requestIdleCallback");
    expect(html).toContain('window.addEventListener("load"');
    expect(html).toContain('window.gtag("config", "G-NKV9DZ5W9B")');
  });

  it("loads the Kannada face only for Kannada", () => {
    // the blocking stylesheet no longer carries it
    const blocking = html.match(
      /href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"\s+media="print"/
    );
    expect(blocking, "blocking fonts link present").toBeTruthy();
    expect(blocking[1]).not.toContain("Noto+Sans+Kannada");
    expect(html).toContain('id = "kn-fonts"');
    expect(html).toContain(`window.localStorage.getItem("omkar:lang") !== '"kn"'`);
    expect(app).toContain('link.id = "kn-fonts"');
  });

  it("ships a 32px favicon instead of the logo png", () => {
    expect(html).toContain('href="/favicon-32.png"');
    expect(html).not.toContain('rel="icon" type="image/png" href="/omkar-logo.png"');
  });

  it("keeps the precache slim and the cache at its current version", () => {
    // v5 since round 63: the bump is the purge — activate deletes every
    // older cache, including any pre-v5 copy of an /api/ response
    expect(sw).toContain('"omkar-cache-v5"');
    expect(sw).not.toContain('"omkar-cache-v4"');
    expect(sw).not.toContain('"/omkar-logo.png"');
    expect(sw).not.toContain('"/icon-512.png"');
  });

  it("answers every response with a CSP and HSTS", () => {
    expect(vercel).toContain("Content-Security-Policy");
    expect(vercel).toContain("Strict-Transport-Security");
    expect(vercel).toContain("https://lmuvmgplqjrmuinrmkkz.supabase.co");
  });
});
