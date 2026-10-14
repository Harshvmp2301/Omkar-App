import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const header = readFileSync(new URL("../src/components/Header.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
// The stylesheet's own history lessons quote the old bad declarations in
// comments; judge the rules, not the prose.
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("round 51 — the logo flight stays smooth on Safari", () => {
  it("never asks Safari to evaluate :has(), whose invalidation is document-wide", () => {
    // On Safari a :has() selector is re-matched against the whole document
    // whenever anything in the subtree changes style. The scroll loop writes
    // two transforms per frame, so two :has() rules on .app and <body> meant
    // two document-wide restyles per frame — the iPhone-only stutter in the
    // logo flight. Chrome and Firefox invalidate finely, which is why the
    // same build felt fine on Android.
    expect(rules).not.toContain(":has(");
  });

  it("carries the open-drawer meanings on one class on <html> instead", () => {
    expect(css).toContain("html.drawer-open .app-logo { opacity: 0; }");
    expect(css).toContain("html.drawer-open body { overflow: hidden; }");
    expect(header).toContain('root.classList.toggle("drawer-open", menuOpen)');
    expect(header).toContain('root.classList.remove("drawer-open")');
  });

  it("keeps the mark on its own compositor layer", () => {
    const logo = rules.slice(rules.indexOf(".app-logo {"), rules.indexOf(".app-logo { transition"));
    expect(logo).toContain("will-change: transform");
    // the bad promise that re-rasterised the image every frame, never again
    expect(logo).not.toContain("will-change: transform, height");
  });

  it("keeps the scroll loop passive and the per-frame writes transform-only", () => {
    expect(app).toContain('window.addEventListener("scroll", onScroll, { passive: true })');
    // Police the frame callback itself: one-shot measuring writes (the slot's
    // docked width, say) happen outside it and are harmless.
    const update = app.slice(app.indexOf("const update = () => {"), app.indexOf("const schedule = () => {"));
    expect(update).toContain("logo.style.transform");
    expect(update).toContain('progressRef.current.style.transform = `scaleX(');
    for (const write of ["style.top =", "style.left =", "style.width =", "style.height ="]) {
      expect(update, write).not.toContain(write);
    }
  });
});
