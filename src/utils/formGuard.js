/* Round 64 — the audit's B3: the two conversion forms (Seva signup and
   Contact) are the site's only anonymous write surfaces, and the committee
   inbox is where spam would land. Two client-side guards, no new service:

   1. HONEYPOT — a field placed off-screen that no human can see or reach
      (tabindex −1, aria-hidden wrapper). Bots that fill every input fill
      it; a filled honeypot means the submission is discarded silently,
      answered with the same success the human flow shows.
   2. VELOCITY — a form a bot opens and posts in under three seconds is a
      bot. A human cannot read the labels and type a message that fast;
      an autofill user who somehow does is shown the
      wait line once and succeeds on the next attempt — no real signup is
      ever lost, which is why this guard warns instead of discarding.

   Turnstile (or any server-side check) remains the stronger answer if the
   forms ever get a real endpoint that spam actually targets. */

/** The shortest believable human fill, in milliseconds. */
export const GUARD_MIN_MS = 3000;

/** True when any honeypot value is filled — a bot signature. */
export function botFilled(values) {
  return Object.values(values || {}).some((v) => String(v || "").trim() !== "");
}

/** True when the form is being submitted faster than a human could fill it. */
export function tooFast(openedAt, now = Date.now(), minMs = GUARD_MIN_MS) {
  return now - Number(openedAt || 0) < minMs;
}

/**
 * Required-field errors as { field: true } for the fields left blank.
 * Components translate the flag into their own bilingual line and wire it
 * to the field with aria-invalid / aria-describedby (audit A5).
 */
export function requiredErrors(values, requiredFields) {
  const errors = {};
  for (const field of requiredFields) {
    if (!String((values || {})[field] || "").trim()) errors[field] = true;
  }
  return errors;
}
