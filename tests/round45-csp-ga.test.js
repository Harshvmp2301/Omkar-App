import { describe, expect, it } from "vitest";
import { readFileSync, statSync, readdirSync } from "node:fs";

const vercel = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");

describe("round 45 — the CSP lets GA finish its job", () => {
  it("allows the www.google.com fallback transport in connect-src", () => {
    // gtag falls back to https://www.google.com/g/collect when the
    // analytics host is unreachable; round 44's CSP blocked it and the
    // console proved it.
    expect(vercel).toContain(
      "connect-src 'self' https://lmuvmgplqjrmuinrmkkz.supabase.co https://www.google-analytics.com https://www.google.com"
    );
  });

  it("keeps every tile rung lean", () => {
    const dir = new URL("../public/gallery/", import.meta.url);
    for (const f of readdirSync(dir)) {
      if (!f.endsWith("-480.webp")) continue;
      const kb = statSync(new URL(f, dir)).size / 1024;
      expect(kb, f).toBeLessThan(42);
    }
  });
});
