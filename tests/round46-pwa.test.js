import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8")
);
const vercel = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");

describe("round 46 — the PWA installs from whichever host serves it", () => {
  it("keeps start_url and scope relative, so scope always contains the page", () => {
    // A manifest's scope must contain the installing page's origin. Absolute
    // apex URLs made www visits fail Chrome's installability check with
    // "this app cannot be downloaded"; relative URLs resolve against the
    // manifest's own URL and are valid on every host.
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("keeps every icon relative too", () => {
    for (const icon of manifest.icons) {
      expect(icon.src, icon.src).not.toMatch(/^https?:/);
    }
    expect(manifest.icons.length).toBe(4);
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("308s www to the apex so one origin owns the install", () => {
    expect(vercel).toContain('"value": "www.omkarsamithi.com"');
    expect(vercel).toContain('"destination": "https://omkarsamithi.com/:path*"');
  });
});
