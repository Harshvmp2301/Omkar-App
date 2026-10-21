import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const push = readFileSync(new URL("../src/utils/push.js", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/components/NotifyPanel.jsx", import.meta.url), "utf8");
const content = readFileSync(new URL("../src/data/content.js", import.meta.url), "utf8");

describe("round 50 — the site behaves on iPhones and iPads", () => {
  it("lets the installed app run edge-to-edge, then clears the notch in CSS", () => {
    // viewport-fit=cover is what stops iOS letterboxing the installed app
    // inside the safe area; the insets it unlocks are spent in styles.css.
    expect(html).toContain("viewport-fit=cover");
    expect(css).toContain("env(safe-area-inset-top, 0px)");
    expect(css).toContain("env(safe-area-inset-bottom, 0px)");
  });

  it("keeps the full iOS home-screen meta set, including the icon label", () => {
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Omkar Samithi"');
  });

  it("hangs the sticky header off the top inset so it never sits under the notch", () => {
    const header = css.slice(css.indexOf(".header {"), css.indexOf(".header-left"));
    expect(header).toContain("calc(14px + env(safe-area-inset-top, 0px))");
  });

  it("hangs the bell panel off the measured header, not a frozen pixel top", () => {
    const p = css.slice(css.indexOf(".notify-panel {"), css.indexOf(".notify-close"));
    expect(p).toContain("top: calc(var(--header-h, 80px) + 8px)");
    expect(p).not.toContain("top: 76px");
  });

  it("keeps the toast, the footer and the lightbox close out of the swipe zones", () => {
    expect(css).toContain("bottom: calc(20px + env(safe-area-inset-bottom, 0px))");
    expect(css).toContain("padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px))");
    const close = css.slice(css.indexOf(".lightbox-close {"), css.indexOf(".lightbox-close:hover"));
    expect(close).toContain("env(safe-area-inset-top, 0px)");
    expect(close).toContain("env(safe-area-inset-right, 0px)");
  });

  it("paints the rubber-band overscroll with the themed ground, no white flash", () => {
    expect(css).toMatch(/html \{[^}]*background: var\(--bg\)/);
  });

  it("knows iOS, including iPadOS posing as a Mac", () => {
    expect(push).toContain("export function isIos()");
    expect(push).toContain("maxTouchPoints > 1");
  });

  it("gives iPhone owners the home-screen route instead of a dead end", () => {
    expect(panel).toContain("isIos()");
    expect(panel).toContain("t.alertsIosInstallHint");
    expect(panel).toContain("t.alertsIosOld");
  });

  it("says the iOS lines in both languages, Kannada actually in Kannada", () => {
    for (const key of ["alertsIosInstallHint", "alertsIosOld"]) {
      const values = [...content.matchAll(new RegExp(`${key}:\\s*"([^"]*)"`, "g"))].map((m) => m[1]);
      // EN block first, KN block second — the identical-names rule means the
      // surrounding blocks both carry Kannada program titles, so judge the
      // two values of the key itself, not the slices around them.
      expect(values.length, key).toBe(2);
      expect(values[0], `${key} EN`).not.toMatch(/[ಕ-೯]/);
      expect(values[1], `${key} KN`).toMatch(/[ಕ-೯]/);
    }
  });
});
