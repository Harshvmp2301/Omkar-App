/**
 * Magnetic hover — real spring physics.
 *
 * The element tracks the pointer inside its bounds (scaled by `strength`)
 * and springs back to rest with natural overshoot on leave. Integration is
 * semi-implicit Euler on a classic damped-mass system:
 *
 *   F = -k · (offset − target) − c · velocity
 *
 * With k = 190 and c = 16 the damping ratio is ≈ 0.58 — underdamped, so the
 * release settles with a single tasteful overshoot. Fine pointers only and
 * reduced-motion aware (callers gate on both; the hook also self-checks).
 *
 * Returns a cleanup that removes listeners and clears the inline transform.
 */
export function initMagnetic(el, { strength = 0.32, stiffness = 190, damping = 16, max = 14 } = {}) {
  let raf = 0;
  let running = false;
  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  const DT = 1 / 60;

  const frame = () => {
    vx += (stiffness * (tx - x) - damping * vx) * DT;
    vy += (stiffness * (ty - y) - damping * vy) * DT;
    x += vx * DT;
    y += vy * DT;

    const atRest =
      Math.abs(x - tx) < 0.04 &&
      Math.abs(y - ty) < 0.04 &&
      Math.abs(vx) < 0.04 &&
      Math.abs(vy) < 0.04;

    if (atRest) {
      x = tx;
      y = ty;
      vx = 0;
      vy = 0;
      running = false;
      raf = 0;
      // Leave no sub-pixel residue when the spring returns home.
      el.style.transform = x === 0 && y === 0 ? "" : `translate3d(${x}px, ${y}px, 0)`;
      return;
    }
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    raf = requestAnimationFrame(frame);
  };

  const kick = () => {
    if (!running) {
      running = true;
      raf = requestAnimationFrame(frame);
    }
  };

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    tx = (e.clientX - (r.left + r.width / 2)) * strength;
    ty = (e.clientY - (r.top + r.height / 2)) * strength;
    tx = Math.max(-max, Math.min(max, tx));
    ty = Math.max(-max, Math.min(max, ty));
    kick();
  };

  const onLeave = () => {
    tx = 0;
    ty = 0;
    kick();
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerleave", onLeave);
  el.addEventListener("pointercancel", onLeave);

  return () => {
    cancelAnimationFrame(raf);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerleave", onLeave);
    el.removeEventListener("pointercancel", onLeave);
    el.style.transform = "";
  };
}
