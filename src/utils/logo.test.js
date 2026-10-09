import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FLOOR_H,
  GAP,
  MAX_H,
  NAV_H,
  REST_GAP,
  flightDistance,
  liftAtRest,
  REST_TRANSFORM,
  logoLayout,
  logoOffset,
  restGeometry,
  scrollFraction,
} from "./logo.js";

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

describe("the mark's rest geometry is READ BACK from the rendered mark", () => {
  // A phone BROWSER has no single "viewport height": its toolbar retracts, so the
  // small, large and dynamic viewports differ by 50-90px, and `clientHeight` is a
  // different one of them on iOS and on Chrome. Everything the flight needs to
  // know about the mark at rest is therefore taken from the box the browser
  // drew — never recomputed from a viewport number and written over the
  // stylesheet. Measured in a real engine with the toolbar modelled, the old
  // computation drew the mark 10-25% too small, let it drift 28-43px whenever the
  // bar moved, and docked it 28-43px below its slot. An installed app has no
  // toolbar, which is why only the WEBSITE glitched.
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  // Comments are allowed to mention the old measurement; code is not.
  const code = app
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
  // The logo effect, and inside it measure(): the only place that reads layout.
  const effect = code.slice(code.indexOf("const logo = logoRef.current;"), code.indexOf("const setH = () =>"));
  const measure = effect.slice(effect.indexOf("const measure = () => {"), effect.indexOf("const update = () => {"));

  it("parks the mark on the stylesheet's anchor, reads its box, and flies from there", () => {
    expect(measure).toMatch(/logo\.style\.transform = REST_TRANSFORM;/);
    expect(measure).toMatch(/restGeometry\(logo\.getBoundingClientRect\(\)\)/);
    expect(measure).toMatch(/geom\.size = rest\.size;/);
    expect(measure).toMatch(/geom\.startX = rest\.startX;/);
    expect(measure).toMatch(/geom\.startY = rest\.startY;/);
    // parked first, read second — in the same synchronous call, so it is never painted
    expect(measure.indexOf("REST_TRANSFORM")).toBeLessThan(measure.indexOf("restGeometry("));
  });

  it("no longer derives the mark's size or centre from a viewport number", () => {
    expect(effect).not.toMatch(/logoLayout/);
    expect(effect).not.toMatch(/viewportH/);
    expect(effect).not.toMatch(/clientWidth/);
    expect(effect).not.toMatch(/window\.innerWidth|window\.innerHeight|visualViewport/);
    // clientHeight survives in ONE place: how far the page can scroll, which
    // only drives the 1px progress bar.
    expect(effect.match(/clientHeight/g)).toHaveLength(1);
    expect(effect).toMatch(/geom\.maxScroll = Math\.max\(0, doc\.scrollHeight - doc\.clientHeight\)/);
  });

  it("flies from the centre it read back, on both axes, on both write paths", () => {
    expect(effect.match(/centerX: geom\.startX/g)).toHaveLength(2); // snap path + flight
    expect(effect.match(/startY: geom\.startY/g)).toHaveLength(2);
    expect(effect).not.toMatch(/geom\.vw/);
  });

  it("keeps the CSS fallback when the mark is not laid out", () => {
    expect(measure).toMatch(/if \(!\(rest\.size > 0\)\) return;/);
  });

  it("sizes the navbar slot BEFORE measuring it — its centre depends on its width", () => {
    expect(measure.indexOf("slot.style.width")).toBeLessThan(measure.indexOf("slot.getBoundingClientRect()"));
  });

  it("clamps the progress bar at both ends — iOS rubber-bands above the top", () => {
    expect(code).toMatch(/scrollFraction\(scrollY, maxScroll\)/);
    expect(code).not.toMatch(/Math\.min\(1, scrollY \/ maxScroll\)/);
  });

  it("re-reads --header-h only when the WIDTH changed, not on every toolbar frame", () => {
    // The header wraps with the width and never with the height. A phone browser
    // fires `resize` on every frame its address bar slides; each one used to
    // force a synchronous layout (offsetHeight) in the middle of the scroll.
    const at = code.indexOf("const setH = () =>");
    const block = code.slice(at, at + 900);
    expect(block).toMatch(/window\.innerWidth === lastWidth/);
    expect(block).toMatch(/addEventListener\("resize", onResize\)/);
    expect(block).not.toMatch(/addEventListener\("resize", setH\)/);
  });
});

describe("restGeometry — what the flight leaves from", () => {
  it("takes the size and the centre from the drawn box", () => {
    expect(restGeometry({ left: 85, top: 222, width: 220, height: 220 })).toEqual({
      size: 220,
      startX: 195,
      startY: 332,
    });
  });

  it("follows whatever the stylesheet resolved, not a number of its own", () => {
    // a mark drawn small and off the nominal centre is simply read as it is
    const r = restGeometry({ left: 20, top: 40.5, width: 100.5, height: 100 });
    expect(r.size).toBe(100);
    expect(r.startX).toBeCloseTo(70.25, 6);
    expect(r.startY).toBeCloseTo(90.5, 6);
  });

  it("lands exactly on the navbar slot from the box it read, on every phone shape", () => {
    // S = visible height with the toolbar shown, L = with it hidden
    const phones = [
      { S: 664, L: 750, W: 390 },
      { S: 553, L: 631, W: 375 },
      { S: 780, L: 836, W: 412 },
      { S: 640, L: 696, W: 360 },
    ];
    const slot = { x: 34.5, y: 32.5 };
    for (const ph of phones) {
      const size = clampSize(ph.L); // the stylesheet: 30vh of the LARGE viewport
      const drawn = { left: ph.W / 2 - size / 2, top: ph.S / 2 - size / 2, width: size, height: size };
      const rest = restGeometry(drawn);
      expect(rest.startY).toBe(ph.S / 2); // rests on the middle of what is visible when the page opens
      const t = logoOffset({
        startY: rest.startY,
        size: rest.size,
        centerX: rest.startX,
        targetX: slot.x,
        targetY: slot.y,
        progress: 1,
      });
      expect(rest.startX + t.dx).toBeCloseTo(slot.x, 6);
      expect(rest.startY + t.dy).toBeCloseTo(slot.y, 6);
      expect(t.height).toBeCloseTo(NAV_H, 6);
    }
  });
});

describe("scrollFraction — the progress bar", () => {
  it("runs 0..1 over the page", () => {
    expect(scrollFraction(0, 2000)).toBe(0);
    expect(scrollFraction(500, 2000)).toBe(0.25);
    expect(scrollFraction(2000, 2000)).toBe(1);
  });

  it("is clamped at the TOP — iOS rubber-bands to a negative scrollY", () => {
    // a negative value would be written as scaleX(-0.03): a mirrored bar
    expect(scrollFraction(-60, 2000)).toBe(0);
    expect(scrollFraction(-0.5, 2000)).toBe(0);
  });

  it("is clamped at the BOTTOM — and on a page that cannot scroll", () => {
    expect(scrollFraction(2150, 2000)).toBe(1);
    expect(scrollFraction(30, 0)).toBe(0);
    expect(scrollFraction(30, -5)).toBe(0);
  });
});

describe("the stylesheet anchors the mark and the hero to units a toolbar cannot move", () => {
  // `top: 50%` on a fixed box is half the DYNAMIC viewport, and `dvh` is the
  // dynamic viewport: both are recomputed every time a phone browser's address bar
  // slides. The mark drifted, the hero re-laid itself out in the middle of the
  // scroll, and the flight (which cannot know either) landed off its slot.
  // svh — the viewport with the toolbar shown — is constant while the bar moves,
  // and identical to every other unit where there is no toolbar (a desktop, an
  // installed app), so nothing changes there.
  it("rests the mark on half the SMALL viewport", () => {
    const rule = ruleOf(".app-logo");
    expect(rule).toMatch(/top:\s*50svh;/);
    expect(rule).not.toMatch(/top:\s*50%/);
  });

  it("falls back to 50% only in an engine without svh — as a block the minifier cannot drop", () => {
    expect(css).toMatch(/@supports not \(top:\s*1svh\)\s*\{\s*\.app-logo\s*\{\s*top:\s*50%;\s*\}\s*\}/);
  });

  it("lays the hero out from the small viewport, never the dynamic one", () => {
    const hero = ruleOf(".hero");
    expect(hero).toMatch(/min-height:\s*calc\(100svh - var\(--header-h/);
    expect(hero).not.toMatch(/dvh/);
    expect(hero).toMatch(/min-height:\s*calc\(100vh - var\(--header-h/); // the fallback line
  });

  it("reserves the mark's clearance from the SAME line the mark rests on", () => {
    expect(ruleOf(".hero::after")).toMatch(/min-height:\s*calc\(50svh - var\(--header-h/);
    expect(ruleOf(".hero::after")).not.toMatch(/dvh/);
    expect(ruleOf(".app-logo")).toMatch(/top:\s*50svh/);
  });

  it("keeps the mark's SIZE on the large viewport — the design size on a phone, constant under the bar", () => {
    expect(ruleOf(".app-logo")).toContain(`clamp(${FLOOR_H}px, 30vh, ${MAX_H}px)`);
  });

  it("has no dynamic unit left on anything that positions the mark or sizes the hero", () => {
    for (const sel of [".app-logo", ".hero", ".hero::after"]) {
      expect(ruleOf(sel), sel).not.toMatch(/\ddvh|\ddvw/);
    }
  });

  it("leaves the open menu as the one place that follows the visible area", () => {
    // It IS an overlay over the visible area, and it exists only while open.
    expect(ruleOf(".nav-drawer")).not.toMatch(/dvh/); // the first .nav-drawer rule is positioning
    expect(css).toMatch(/\.nav-drawer \{[^}]*max-height: calc\(100dvh/);
  });

  it("keeps ONE definition of the rest transform, shared by the effect and the stylesheet", () => {
    expect(ruleOf(".app-logo")).toContain(`transform: ${REST_TRANSFORM};`);
  });

  it("stops a quick second tap being read as double-tap-to-zoom", () => {
    // iOS Safari and Chrome for Android zoom the page on a fast second tap — on a
    // chevron, say — and the fixed mark and the sticky header stop lining up until
    // the visitor pinches back out. Pinch-zoom itself is untouched.
    expect(css).toMatch(
      /button, a, summary, label, input, select, textarea, \[role="button"\] \{ touch-action: manipulation; \}/
    );
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

describe("the flight distance is a viewport quantity, not a page quantity", () => {
  it("scales with the mark, so it is the same on a short page and a long one", () => {
    // The old ramp was `maxScroll * 0.15`: 150px on a 1000px page, 900px on a
    // 6000px one — the same scroll gesture behaved completely differently
    // depending on how much content happened to be below the fold, and it
    // changed under the visitor whenever that content arrived.
    expect(flightDistance(220)).toBe(205);
    expect(flightDistance(138)).toBeCloseTo(143.5, 1);
    expect(flightDistance(88)).toBe(106);
    // No argument a page length could take ever reaches this function.
    expect(flightDistance.length).toBe(1);
  });

  it("clears the copy well before the copy can reach the mark", () => {
    // The hero keeps REST_GAP (28px) of clearance below the mark at rest, and
    // the mark is docking from the first pixel of scroll, so the gap only
    // grows. At 220px the flight is 205px — under one screenful on any phone.
    for (const size of [88, 138, 180, 220]) {
      expect(flightDistance(size)).toBeLessThan(size * 0.75 + 41);
      expect(flightDistance(size)).toBeLessThan(size + REST_GAP + 60);
    }
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
    expect(code).toMatch(/\$\{REST_TRANSFORM\} translate3d/);
    expect(code).not.toMatch(/`translate\(-50%, -50%\) translate3d/); // one definition, not a copy
  });

  it("docks over a FIXED distance, never over a share of the page", () => {
    // What this replaced: `scrollY / (maxScroll * 0.15)`. On a long page that
    // is 600-1200px of scrolling for the mark to reach the corner, so the copy
    // overtook it and slid behind it; worse, anything that changed the page
    // height (a feed arriving, the ResizeObserver on <body>) rescaled the ramp
    // mid-scroll and the mark jumped. The owner reported exactly that on every
    // device except the one with everything cached.
    expect(code).toMatch(/const flightPx = flightDistance\(geom\.size\);/);
    expect(code).toMatch(/let p = scrollY \/ flightPx;/);
    expect(code).not.toMatch(/maxScroll \* 0\.15/);
  });

  it("no longer reacts to the hero copy's measured position per frame", () => {
    // The collision lift read a document-space copy position measured earlier
    // and clamped the flight to it. When that measurement was stale — font
    // swap, language change, the address bar collapsing — the mark stopped
    // early and stayed over the text, and it could not settle back. The layout
    // clearance (.hero::after) plus a short, fixed flight replaces it.
    expect(code).not.toMatch(/liftAtRest/);
    expect(code).not.toMatch(/copyTopDoc/);
    expect(code).toMatch(/smoothstep for a natural glide/);
  });

  it("re-measures when the hero copy's own size changes", () => {
    // fonts swapping in change the copy's metrics behind our back
    expect(code).toMatch(/new ResizeObserver/);
    expect(code).toMatch(/ro\.observe\(heroContent\)/);
  });

  it("never writes the logo's width or height — the stylesheet owns its size", () => {
    // It used to write both, from clientHeight, over the stylesheet: right on a
    // desktop, 10-25% too small in a phone browser. Now the size is the CSS
    // clamp, read back; the flight only ever writes a transform.
    expect(code).not.toMatch(/logo\.style\.height/);
    expect(code).not.toMatch(/logo\.style\.width/);
  });

  it("animates with a translate + scale transform", () => {
    expect(code).toMatch(/scale\(\$\{t\.scale\.toFixed\(4\)\}\)/);
    expect(code).toMatch(/translate3d/);
  });

  it("reads layout only in measure(), never in the frame loop", () => {
    // TWO reads, both in measure(): the navbar slot rect and the mark's own rest
    // box. The hero-copy rect that used to sit beside them fed the collision lift,
    // which is gone, and the header's offsetHeight read had no reader left — so
    // nothing is measured per frame and nothing but the --header-h effect reads
    // a height.
    expect((code.match(/getBoundingClientRect/g) || []).length).toBe(2);
    const measureAt = code.indexOf("const measure = () => {");
    const measureBody = code.slice(measureAt, code.indexOf("const update = () => {"));
    expect((measureBody.match(/getBoundingClientRect/g) || []).length).toBe(2);
    expect((code.match(/\.offsetHeight/g) || []).length).toBe(1); // the --header-h effect
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
