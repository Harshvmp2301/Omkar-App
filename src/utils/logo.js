/**
 * Geometry for the one signature animation: the big logo that sits at the
 * centre of the first screen and docks into the navbar as you scroll.
 *
 * It lives here, apart from the effect that reads the DOM, because the rule it
 * encodes is the thing that is easy to get wrong: **at rest the logo is
 * centred, and it is the size the design asks for**.
 *
 * The logo is a fixed element pinned to the viewport centre; the hero copy is
 * anchored to the bottom of the screen. Those two facts have one consequence:
 * something has to give when the copy's top edge would reach the centre line.
 *
 * The size is NOT that thing. An earlier version shrank the mark to whatever
 * room was left between the centre and the copy — which sounds reasonable and
 * is not: the redesigned hero copy is tall, so its top edge sits only a little
 * below the centre, the "room" collapsed to 110px, and the mark rendered at
 * half its size with the minimum 8px gap left to the name. Small mark,
 * crowded name: one mechanism produced both.
 *
 * So the clearance is reserved in the layout instead — see the `.hero::after`
 * spacer in src/styles.css, whose minimum height is exactly the line the copy
 * must not cross:
 *
 *     copy top  >=  viewport centre + mark/2 + REST_GAP
 *
 * The mark therefore keeps its full size (the stylesheet's clamp, mirrored
 * here) and stays on the centre line, and on a window too short for both the
 * hero grows by a few pixels rather than the mark shrinking or lifting.
 */

export const NAV_H = 45; // the logo's size once it has docked into the navbar
export const MAX_H = 220; // its size at rest on a tall screen
export const FLOOR_H = 88; // the smallest it will ever be drawn
export const GAP = 8; // breathing room the FLIGHT keeps from whatever is near it
export const REST_GAP = 28; // breathing room the LAYOUT reserves under the mark

/**
 * How big the logo is at rest, and where "rest" is — on a screen WITHOUT a
 * retracting toolbar.
 *
 * This is the SPECIFICATION of the stylesheet's size clamp, kept for the tests
 * that tie `.app-logo` and the hero's spacer to the same expression. The effect
 * does not call it any more: it used to feed it `documentElement.clientHeight`
 * and write the answer over the stylesheet, which is only right where every
 * definition of "the viewport height" coincides (a desktop, an installed app).
 * In a phone browser they differ by the toolbar's height, so the mark came out
 * 10-25% smaller than designed. The effect now reads the rendered box back —
 * see restGeometry().
 */
export function logoLayout({ viewportH, navH = NAV_H, maxH = MAX_H, floorH = FLOOR_H }) {
  const startY = viewportH / 2;
  const size = Math.min(maxH, Math.max(floorH, viewportH * 0.3));
  return { startY, size, navH };
}

/**
 * The mark's rest transform: the stylesheet's anchor and nothing else. It is
 * `.app-logo`'s own `transform`, so putting it inline parks the mark exactly
 * where the stylesheet puts it — which is how the effect reads that position
 * back (restGeometry) without a flight offset in the way. A test keeps this
 * string and the stylesheet in step.
 */
export const REST_TRANSFORM = "translate(-50%, -50%)";

/**
 * Where the mark rests and how big it is, taken from the box the browser
 * actually drew with the rest transform applied (a DOMRect, or any
 * {left, top, width, height}).
 *
 * Reading it back — rather than recomputing it from a viewport number — is what
 * makes the flight correct in a phone BROWSER. There the address bar and toolbars
 * retract, so "the viewport height" has several answers (small, large, dynamic)
 * and `clientHeight` is a different one on iOS and on Chrome. Whatever the
 * stylesheet resolved, this is it, so the size, the centre the flight leaves
 * from and the centre it returns to can never disagree with what is on screen.
 */
export function restGeometry(rect) {
  return {
    size: rect.height,
    startX: rect.left + rect.width / 2,
    startY: rect.top + rect.height / 2,
  };
}

/**
 * Scroll position as a 0..1 fraction of the page, clamped at BOTH ends.
 *
 * iOS rubber-bands: `scrollY` goes negative above the top and past `maxScroll`
 * below the bottom. Clamping only the top turned the 1px progress bar into a
 * mirrored bar (a negative scaleX) every time the page was pulled down.
 */
export function scrollFraction(scrollY, maxScroll) {
  if (!(maxScroll > 0)) return 0;
  return Math.min(1, Math.max(0, scrollY / maxScroll));
}

/**
 * How far along the flight to the navbar the logo must already be so that it
 * clears copy that has scrolled up into its path.
 *
 * This is a scroll-induced correction and nothing else: the caller fades it in
 * with the scroll, so it can never displace the logo at rest. With the layout
 * above the copy starts clear of the mark, so this is 0 at rest anyway — it
 * exists for copy that scrolls up behind the mark.
 */
export function liftAtRest({
  copyTopVisible,
  headerH = 0,
  startY,
  size,
  targetY,
  navH = NAV_H,
  gap = GAP,
}) {
  const visibleTop = Math.max(copyTopVisible, headerH);
  const bottom = startY + size / 2; // logo bottom at rest
  const perUnit = targetY - startY + (navH - size) / 2; // change of bottom per unit progress
  if (!(perUnit < 0)) return 0;
  const need = (visibleTop - gap - bottom) / perUnit; // progress at which it clears
  if (!Number.isFinite(need) || need <= 0.002) return 0;
  return Math.min(1, Math.max(0, need));
}

/** How much scrolling the flight covers, in pixels.
 *
 * Derived from the mark's own size, which the stylesheet owns —
 * `clamp(88px, 30vh, 220px)` — so it is the same on every page of the site and
 * can never be rescaled by content arriving above the fold.
 *
 * It replaced a fraction of the page's scrollable range (15%), which on a long
 * page meant 600-1200px: the copy overtook the mark and slid behind it, the
 * mark seemed not to move at all for the first screenful, and any change in
 * page height — a feed arriving, an image settling, the ResizeObserver on
 * <body> — rescaled the ramp mid-scroll and made the mark jump.
 *
 * The hero reserves REST_GAP of clearance below the mark (`.hero::after`), and
 * docking within about three quarters of the mark's height clears the copy
 * before the copy can reach it, at every viewport.
 */
export function flightDistance(size) {
  return size * 0.75 + 40;
}

/**
 * The logo's placement at a given point in the flight, expressed as the OFFSET
 * FROM THE VIEWPORT CENTRE (plus a uniform scale).
 *
 * This is the shape the effect needs, and it is what makes the rest position
 * unconditional: the mark's CSS anchor is `left: 50%; top: 50%` with
 * `translate(-50%, -50%)`, so at progress 0 the offsets are 0/0 and the logo is
 * centred by the stylesheet — not by anything JavaScript measured. A stale or
 * missing measurement can then never leave the mark off-centre at rest, which
 * is exactly what a captured-then-changed hero layout used to do.
 *
 * During the flight the offsets move the centre toward the navbar slot:
 *   dx = (targetX - centerX) * progress
 *   dy = (targetY - centerY) * progress   (centerY === startY === half the viewport)
 * and the scale shrinks the mark from its rest size to the docked size, about
 * its own centre (the default transform-origin), so scaling never moves it.
 */
export function logoOffset({
  startY,
  size,
  centerX,
  targetX,
  targetY,
  progress,
  navH = NAV_H,
  aspect = 1,
}) {
  const baseW = size * aspect;
  const height = size + (navH - size) * progress;
  const scale = size > 0 ? height / size : 1;
  const cx = centerX + (targetX - centerX) * progress;
  const cy = startY + (targetY - startY) * progress;
  return {
    dx: cx - centerX, // 0 at progress 0 — the at-rest guarantee
    dy: cy - startY, // 0 at progress 0
    scale,
    width: baseW * scale,
    height,
    cx,
    cy,
  };
}
