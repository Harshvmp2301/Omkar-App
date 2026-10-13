import { describe, expect, it } from "vitest";
import { readFileSync, statSync, readdirSync } from "node:fs";

const content = readFileSync(new URL("../src/data/content.js", import.meta.url), "utf8");
const yt = readFileSync(new URL("../src/utils/youtube.js", import.meta.url), "utf8");
const hub = readFileSync(new URL("../src/components/ContentHub.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("round 43 — the performance audit, fixed at the source", () => {
  it("serves YouTube thumbnails as small webp, never maxres jpg", () => {
    expect(content).not.toContain("maxresdefault.jpg");
    expect(yt).not.toContain("maxresdefault.jpg");
    expect(content).toContain("hqdefault.webp");
  });

  it("gives the thumbnail and the logo explicit dimensions (no layout shift)", () => {
    expect(hub).toContain("width={480}");
    expect(hub).toContain("height={360}");
    expect(app).toContain("width={220}");
    expect(app).toContain("height={220}");
  });

  it("marks the LCP image high priority, at the tag and at the preload", () => {
    expect(app).toContain('fetchPriority="high"');
    expect(html).toContain('fetchpriority="high"');
  });

  it("stops the fonts stylesheet from blocking first paint", () => {
    expect(html).toContain('media="print"');
    expect(html).toContain(`onload="this.media='all'"`);
    expect(html).toContain("<noscript>");
  });

  it("keeps every gallery webp under 170 KB after the re-encode", () => {
    const dir = new URL("../public/gallery/", import.meta.url);
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".webp")) continue;
      const kb = statSync(new URL(f, dir)).size / 1024;
      expect(kb, f).toBeLessThan(170);
    }
  });
});
