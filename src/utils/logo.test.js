import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FLOOR_H, GAP, MAX_H, NAV_H, REST_GAP, liftAtRest, logoLayout, logoOffset } from "./logo.js";

/**
 * The placement as it was implemented BEFORE the offsets: absolute box centre
 * and size. Kept here as the reference the current implementation must match,
 * so "the animation looks the same" is asserted rather than claimed.
 */
function referenceBox({ startY, size, centerX, targetX, targetY, progress, navH = NAV_H, aspect = 1 }) {
  const h = size + (navH - size) * progress;
  const w = h * aspect;
  const cx = centerX + (targetX - centerX) * progress;
  const cy = startY + (targetY - startY) * progress;
  return { h, w, cx, cy };
}

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
// Comments are allowed to explain the old behaviour; declarations may not keep it.
const css = styles.replace(/\/\*[\s\S]*?\*\//g, "");
const ruleOf = (selector) => {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} must exist`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
};

// Real screen shapes. The mark's size comes from the viewport alone now, so the
// copy position is not an input — but it IS the thing the layout has to keep out
// of the mark's way, which the CSS-contract tests below assert.
const SCREENS = [
  { name: "large desktop", viewportH: 1440, headerH: 76 },
  { name: "900-tall laptop", viewportH: 900, headerH: 72 },
  { name: "1366x768 laptop", viewportH: 768, headerH: 72 },
  { name: "short window", viewportH: 720, headerH: 70 },
  { name: "very short window", viewportH: 660, headerH: 70 },
  { name: "phone, portrait", viewportH: 844, headerH: 64 },
];

const clampSize = (viewportH, floorH = FLOOR_H, maxH = MAX_H) =>
  Math.min(maxH, Math.max(floorH, viewportH * 0.3));

describe("logo layout at rest", () => {
  it("mirrors the stylesheet's clamp, so the size is the design size", () => {
    expect(logoLayout({ viewportH: 1440 }).size).toBe(MAX_H); // capped
    expect(logoLayout({ viewportH: 900 }).size).toBe(MAX_H); // still capped (30vh = 270)
    expect(logoLayout({ viewportH: 740 }).size).toBe(MAX_H); // 30vh = 222, just capped
    expect(logoLayout({ viewportH: 700 }).size).toBeCloseTo(210, 6); // 30vh, under the cap
    expect(logoLayout({ viewportH: 600 }).size).toBeCloseTo(180, 6); // 30vh
    expect(logoLayout({ viewportH: 300 }).size).toBeCloseTo(90, 6); // 30vh, above the floor
    expect(logoLayout({ viewportH: 200 }).size).toBe(FLOOR_H); // floored, never smaller
  });

  it("puts the centre of the mark on the centre line of the viewport", () => {
    for (const s of SCREENS) {
      expect(logoLayout({ viewportH: s.viewportH }).startY).toBe(s.viewportH / 2);
    }
  });

  it("keeps the whole mark clear of the header on any realistic window", () => {
    for (const s of SCREENS) {
      const { startY, size } = logoLayout({ viewportH: s.viewportH });
      expect(startY - size / 2).toBeGreaterThanOrEqual(s.headerH + GAP - 0.001);
    }
  });

  it("does not depend on the hero copy at all — only on the viewport", () => {
    // The copy's position drove the old shrink. It must not any more: that is
    // what made a tall hero collapse the mark to the floor.
    const base = logoLayout({ viewportH: 900 });
    expect(logoLayout({ viewportH: 900, copyTop: 513, headerH: 80 })).toEqual(base);
    expect(logoLayout({ viewportH: 900, copyTop: Infinity, headerH: 0 })).toEqual(base);
  });
});

describe("the copy is laid out clear of the mark", () => {
  // The mark keeps its full size, so the CLEARANCE has to come from the layout.
  // The stylesheet reserves it with a flexible spacer above the copy, and these
  // tests tie that rule to the geometry here so neither can drift.
  it("reserves the mark's space with a spacer, not by shrinking the mark", () => {
    const spacer = ruleOf(".hero::after");
    expect(spacer).toMatch(/order:\s*-1/); // first in the hero's column
    expect(spacer).toMatch(/flex:\s*1 1 auto/); // takes the slack on a tall screen
    expect(spacer).toContain("50vh"); // half the viewport: where the mark's centre is
    expect(spacer).toContain("var(--header-h");
  });

  it("sizes that spacer from the same clamp the mark uses", () => {
    const clampText = `clamp(${FLOOR_H}px, 30vh, ${MAX_H}px)`;
    expect(ruleOf(".hero::after")).toContain(clampText);
    expect(ruleOf(".hero::after")).toContain(`${REST_GAP}px`);
    // Every .app-logo rule that sets the mark's SIZE (the base rule and the
    // narrow-screen override) must agree, or the CSS fallback and the size the
    // effect writes would disagree. Rules that only fade the mark are not size
    // rules and are ignored.
    const logoBlocks = [...css.matchAll(/\.app-logo\s*\{[^}]*\}/g)]
      .map((m) => m[0])
      .filter((block) => block.includes("height:"));
    expect(logoBlocks.length).toBeGreaterThanOrEqual(2); // base + mobile override
    for (const block of logoBlocks) expect(block).toContain(clampText);
  });

  it("leaves the mark nothing to lift for, on every real screen shape", () => {
    // The spacer guarantees the copy starts at centre + mark/2 + REST_GAP.
    // At that position there is no correction to make: lift === 0.
    for (const s of SCREENS) {
      const { startY, size } = logoLayout({ viewportH: s.viewportH });
      const copyTopGuaranteed = startY + size / 2 + REST_GAP;
      const lift = liftAtRest({
        copyTopVisible: copyTopGuaranteed,
        headerH: s.headerH,
        startY,
        size,
        targetY: 40,
      });
      expect(lift, `${s.name} must not lift the mark`).toBe(0);
    }
  });

  it("reserves a gap that is a real one, not the flight's few pixels", () => {
    expect(REST_GAP).toBeGreaterThan(GAP * 2);
  });
});

describe("the flight, end to end", () => {
  const centerX = 683;
  const { startY, size } = logoLayout({ viewportH: 768 });

  it("starts exactly on the centre line", () => {
    const t = logoOffset({ startY, size, centerX, targetX: 1400, targetY: 40, progress: 0 });
    expect(t.dx).toBe(0);
    expect(t.dy).toBe(0);
    expect(centerX + t.dx).toBe(centerX); // the viewport centre, by construction
    expect(t.height).toBe(size);
  });

  it("ends docked at the navbar slot, at the navbar size", () => {
    const t = logoOffset({ startY, size, centerX, targetX: 1400, targetY: 40, progress: 1 });
    expect(t.height).toBeCloseTo(NAV_H, 6);
    expect(centerX + t.dx).toBe(1400);
    expect(startY + t.dy).toBe(40);
  });

  it("moves in one direction only (centre → slot), never backwards", () => {
    let prevDx = -Infinity;
    for (let i = 0; i <= 20; i += 1) {
      const t = logoOffset({ startY, size, centerX, targetX: 1400, targetY: 40, progress: i / 20 });
      expect(t.dx).toBeGreaterThanOrEqual(prevDx);
      prevDx = t.dx;
    }
  });
});

describe("the logo measures the layout viewport, not the window", () => {
  // window.innerWidth / innerHeight include the scrollbars. A fixed element's
  // `left: 50%` does not — so positioning from innerWidth put the mark half a
  // scrollbar to the right of everything else on the page. This guard keeps
  // the fix honest, because the difference is invisible until someone looks.
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  // Comments are allowed to mention the old measurement; code is not.
  const code = app
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");

  it("uses clientWidth/clientHeight for the logo's centre", () => {
    expect(code).toMatch(/doc\.clientWidth/);
    expect(code).toMatch(/doc\.clientHeight/);
    expect(code).toMatch(/centerX: geom\.vw \/ 2/);
  });

  it("never positions the mark from window.innerWidth", () => {
    expect(code).not.toMatch(/window\.innerWidth/);
  });

  it("takes the scrollable distance from the layout viewport too", () => {
    // The distance the page can move is scrollHeight - clientHeight, measured
    // against the LAYOUT viewport — the same box the mark is centred in, so the
    // two cannot disagree about where the bottom of the page is.
    expect(code).toMatch(/doc\.scrollHeight - doc\.clientHeight/);
    expect(code).not.toMatch(/window\.innerHeight/);
  });
});

describe("the same box as the previous implementation, drawn as one transform", () => {
  const cases = [
    { name: "desktop", startY: 475, size: MAX_H, centerX: 960, targetX: 236, targetY: 40, aspect: 1 },
    { name: "short window", startY: 384, size: 220, centerX: 683, targetX: 120, targetY: 40, aspect: 1 },
    { name: "phone", startY: 422, size: MAX_H, centerX: 195, targetX: 60, targetY: 40, aspect: 1 },
    { name: "non-square art", startY: 400, size: 180, centerX: 800, targetX: 100, targetY: 40, aspect: 1.25 },
  ];

  for (const c of cases) {
    it(`${c.name}: identical centre and size at every point in the flight`, () => {
      for (let i = 0; i <= 20; i += 1) {
        const progress = i / 20;
        const box = referenceBox({ ...c, progress });
        const t = logoOffset({ ...c, progress });
        // the centre is the CSS centre plus the offset
        expect(c.centerX + t.dx).toBeCloseTo(box.cx, 6);
        expect(c.startY + t.dy).toBeCloseTo(box.cy, 6);
        expect(t.width).toBeCloseTo(box.w, 6);
        expect(t.height).toBeCloseTo(box.h, 6);
      }
    });
  }

  it("at rest the offset is exactly zero — the mark is centred by CSS", () => {
    for (const c of cases) {
      const t = logoOffset({ ...c, progress: 0 });
      expect(t.dx).toBe(0);
      expect(t.dy).toBe(0);
      expect(t.scale).toBe(1); // and at its full rest size
      expect(t.height).toBe(c.size);
      expect(t.width).toBe(c.size * c.aspect);
    }
  });

  it("scales down from 1 and lands at the navbar size", () => {
    const at1 = logoOffset({ startY: 400, size: MAX_H, centerX: 0, targetX: 0, targetY: 40, progress: 1 });
    expect(at1.scale).toBeCloseTo(NAV_H / MAX_H, 6);
    expect(at1.height).toBeCloseTo(NAV_H, 6);
  });
});

describe("the mark can always begin centred, at its design size", () => {
  it("is the design size on every real screen shape", () => {
    for (const s of SCREENS) {
      const { startY, size } = logoLayout({ viewportH: s.viewportH });
      expect(size, s.name).toBeGreaterThanOrEqual(FLOOR_H);
      expect(size, s.name).toBeCloseTo(clampSize(s.viewportH), 6); // the CSS clamp, exactly
      expect(startY, s.name).toBe(s.viewportH / 2); // and always on the centre line
    }
    // The sizes the owner sees on a desktop or a laptop are the full 220px.
    for (const viewportH of [1440, 1366, 900, 864, 800, 768, 760]) {
      expect(logoLayout({ viewportH }).size, `${viewportH}px tall`).toBe(MAX_H);
    }
  });

  it("shrinks only on a window too short for the floor — and stays centred there", () => {
    const tiny = { viewportH: 200, headerH: 60 };
    const { startY, size } = logoLayout({ viewportH: tiny.viewportH });
    expect(size).toBe(FLOOR_H); // it refuses to shrink past the floor
    expect(startY).toBe(100); // and it is still on the centre line
  });

  it("lifts only when copy genuinely scrolls up into the mark's path", () => {
    // At rest the layout keeps the copy clear. As the page scrolls, the copy
    // rises towards the mark — that is the case this correction exists for.
    const { startY, size } = logoLayout({ viewportH: 768 });
    const atRest = liftAtRest({ copyTopVisible: 550, headerH: 72, startY, size, targetY: 40 });
    expect(atRest).toBe(0);
    const scrolling = liftAtRest({ copyTopVisible: 420, headerH: 72, startY, size, targetY: 40 });
    expect(scrolling).toBeGreaterThan(0);
    expect(scrolling).toBeLessThanOrEqual(1);
  });
});

describe("the flight stays compositor-only", () => {
  // Every assertion here is a real jank cause that was in the code: a size
  // animation the GPU cannot perform, a layout read per frame, and a custom
  // property on :root that invalidated style for the whole document per frame.
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const code = app
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");

  it("leaves the rest position to the stylesheet", () => {
    // The anchor must stay CSS-only: if the effect wrote left/top, the centred
    // rest position would depend on a measurement again.
    expect(code).not.toMatch(/logo\.style\.left/);
    expect(code).not.toMatch(/logo\.style\.top/);
    expect(code).toMatch(/translate\(-50%, -50%\) translate3d/);
  });

  it("fades the scroll lift in, so it cannot move the mark at rest", () => {
    expect(code).toMatch(/if \(Number\.isFinite\(geom\.copyTopDoc\) && scrollY > 0\)/);
    expect(code).toMatch(/Math\.min\(1, scrollY \/ 40\)/);
  });

  it("re-measures when the hero copy's own size changes", () => {
    // fonts swapping in change the copy's metrics behind our back
    expect(code).toMatch(/new ResizeObserver/);
    expect(code).toMatch(/ro\.observe\(heroContent\)/);
  });

  it("never animates the logo's width or height", () => {
    // measure() sets the box once; nothing else may touch it
    expect((code.match(/logo\.style\.height/g) || []).length).toBe(1);
    expect((code.match(/logo\.style\.width/g) || []).length).toBe(1);
  });

  it("animates with a translate + scale transform", () => {
    expect(code).toMatch(/scale\(\$\{t\.scale\.toFixed\(4\)\}\)/);
    expect(code).toMatch(/translate3d/);
  });

  it("reads layout only in measure(), never in the frame loop", () => {
    // two reads: the slot rect and the hero copy top
    expect((code.match(/getBoundingClientRect/g) || []).length).toBe(2);
    expect((code.match(/\.offsetHeight/g) || []).length).toBe(2); // header + the --header-h effect
  });

  it("writes the progress bar directly, with no inherited custom property", () => {
    // A custom property set on the header is INHERITED: it restyled the whole
    // header subtree every frame, and the next frame's layout read flushed it.
    expect(code).not.toMatch(/style\.setProperty\(\s*"\s*--scroll-p/);
    expect(code).toMatch(/progressRef\.current\.style\.transform/);
  });

  it("performs no layout read in the frame loop", () => {
    // The frame body must touch nothing that can force a style/layout flush:
    // no scrollHeight, no innerHeight, no getBoundingClientRect, no offset*.
    // window.scrollY is a scroll offset, not a layout read.
    const body = code.slice(code.indexOf("const update = () => {"), code.indexOf("const schedule = () => {"));
    expect(body.length).toBeGreaterThan(400);
    for (const read of [
      "scrollHeight",
      "window.innerHeight",
      "getBoundingClientRect",
      "offsetHeight",
      "offsetWidth",
      "clientHeight",
      "clientWidth",
      "getComputedStyle",
    ]) {
      expect(body, `frame loop reads ${read}`).not.toContain(read);
    }
    expect(body).toContain("window.scrollY");
    expect(body).toContain("geom.maxScroll");
  });

  it("measures maxScroll once per scene, and follows the page height", () => {
    expect(code).toMatch(/geom\.maxScroll = Math\.max\(0, doc\.scrollHeight - doc\.clientHeight\)/);
    expect(code).toMatch(/ro\.observe\(document\.body\)/);
  });

  it("skips style writes when nothing changed", () => {
    expect(code).toMatch(/if \(transform !== lastTransform\)/);
    expect(code).toMatch(/if \(roundedP !== lastScrollP\)/);
  });

  it("only asks the compositor for transform", () => {
    const block = ruleOf(".app-logo");
    expect(block).toMatch(/will-change: transform;/);
    expect(block).not.toMatch(/will-change: transform, height/);
  });

  it("defers a re-measure while the page is scrolling", () => {
    // the address bar collapsing fires resize mid-scroll on phones
    expect(code).toMatch(/lastScrollAt/);
    expect(code).toMatch(/measureSoon/);
  });
});
