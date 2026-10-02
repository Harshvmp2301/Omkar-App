/**
 * When a diya is lit.
 *
 * The rule, as the Samithi described it: every lamp is dark on the first day of
 * the year. Each one lights a month before its own program — and from then on
 * it STAYS lit. A program that has finished does not put its lamp out, so the
 * lamps pile up through the year: one is burning by the spring program, a
 * month before the autumn program a second joins it, and a month before the
 * December program all three are lit. They stay lit until New Year, when they
 * all go dark and the year starts again.
 *
 * A program repeats every year, so the lamp follows the month and day of the
 * stored date, never its year: 1 April lights in April of whatever year it is
 * now, and nobody has to touch the dashboard in January. A date the Samithi
 * has already put in for a future year counts as that year's program — the
 * lamp lights a month before the date as written.
 *
 * A program whose date has not been announced cannot light anything: there is
 * nothing to count down to yet.
 */

import { annualOccurrence, daysUntil } from "./calendar.js";

/** How long before a program its lamp comes on. */
export const DIYA_WINDOW_DAYS = 30;

/**
 * Is the lamp for this program lit?
 *
 * `daysUntil` counts whole calendar days, so this is a plain date comparison —
 * no clock times, no timezone arithmetic. Negative days mean the program has
 * already happened this year, which is still lit: the flame is not put out
 * when the program ends.
 */
export function diyaLit(dateISO, now = new Date()) {
  const date = annualOccurrence(dateISO, now);
  if (!date) return false;
  return daysUntil(date, now) <= DIYA_WINDOW_DAYS;
}

/**
 * Which of these programs have a lit lamp, in the order given.
 * Returns an array of booleans so it lines up with the rendered lamps.
 */
export function litDiyas(events = [], now = new Date()) {
  return events.map((event) => diyaLit(event && event.date, now));
}

/** Is any lamp lit? The hint line below them only makes a claim if one is. */
export const anyDiyaLit = (events = [], now = new Date()) =>
  litDiyas(events, now).some(Boolean);
