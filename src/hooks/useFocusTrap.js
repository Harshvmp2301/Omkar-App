import { useEffect, useRef } from "react";

/**
 * Shared focus trap — powers the gallery lightbox AND the mobile nav drawer
 * (one implementation, per audit A1: extract the pattern, use it twice).
 *
 * While `active`:
 *  - focus moves to the first focusable child (or `initialFocus`)
 *  - Tab / Shift+Tab cycle inside `ref` (and pull focus back if it escapes)
 *  - Escape fires `onEscape`
 * On deactivation, focus returns to where it came from (`restoreRef` or the
 * element that had focus when the trap activated).
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useFocusTrap(ref, active, { onEscape, restoreRef } = {}) {
  // Keep the latest Escape handler without re-binding the key listener
  // every render (ref writes belong in effects, not during render).
  const escRef = useRef(onEscape);
  useEffect(() => {
    escRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return undefined;
    const root = ref.current;
    if (!root) return undefined;

    // Capture the return target NOW — cleanup must not read refs that may
    // have moved on by the time the trap deactivates.
    const cameFrom = restoreRef?.current || document.activeElement;

    const items = () =>
      Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);

    // Initial focus: first interactive child of the trapped surface.
    const first = items()[0];
    if (first) first.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        escRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const head = list[0];
      const tail = list[list.length - 1];
      if (!root.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? tail : head).focus();
      } else if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (cameFrom && typeof cameFrom.focus === "function") cameFrom.focus();
    };
  }, [active, ref, restoreRef]);
}
