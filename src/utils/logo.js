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
 * How big the logo is at rest, and where "rest" is.
 *
 * Mirrors the stylesheet exactly — `.app-logo` carries the same
 * `clamp(FLOOR_H, 30vh, MAX_H)`, and the hero's spacer reuses that expression —
 * so the CSS fallback, the size the effect writes and the reserved clearance
 * can never disagree. A test parses the stylesheet and asserts all three.
 */
export function logoLayout({ viewportH, navH = NAV_H, maxH = MAX_H, floorH = FLOOR_H }) {
  const startY = viewportH / 2;
  const size = Math.min(maxH, Math.max(floorH, viewportH * 0.3));
  return { startY, size, navH };
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
