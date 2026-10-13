import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("round 42 — analytics on the canonical host only", () => {
  it("loads gtag with the owner's measurement id, twice (src + config)", () => {
    expect(html).toContain("googletagmanager.com/gtag/js?id=G-NKV9DZ5W9B");
    expect(html).toContain('window.gtag("config", "G-NKV9DZ5W9B")');
  });

  it("gates the tag to omkarsamithi.com (with optional www)", () => {
    // preview URLs and the retired vercel.app host must never report
    expect(html).toContain(
      'if (!/^(www\\.)?omkarsamithi\\.com$/.test(window.location.hostname)) return;'
    );
  });

});
