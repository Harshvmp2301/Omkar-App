/**
 * When a diya is lit.
 *
 * The rule, as the Samithi described it: every lamp is dark at the start of the
 * year, and each one lights a month before its own program — so the lamps come
 * on one by one through the year, in the order the programs fall. A lamp is
 * dark again once its program is over.
 *
 * With programs months apart that means at most one lamp is lit at a time, and
 * the lit one is always the soonest program — which is exactly what the line
 * beneath them promises: "The next lit diya marks your soonest upcoming
 * program."
 *
 * A program whose date has not been announced cannot light anything: there is
 * nothing to count down to yet.
 */

import { daysUntil, dateOnly } from "./calendar.js";

/** How long before a program its lamp comes on. */
export const DIYA_WINDOW_DAYS = 30;

/**
 * Is the lamp for this date lit?
 *
 * `daysUntil` counts whole calendar days from today, so this is a plain date
 * comparison — no clock times, no timezone arithmetic. A program is lit from
 * the first moment of the day 30 days before it, through to the end of the day
 * it happens on.
 */
export function diyaLit(dateISO, now = new Date()) {
  const date = dateOnly(dateISO);
  if (!date) return false;

  const days = daysUntil(date, now);
  return days >= 0 && days <= DIYA_WINDOW_DAYS;
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
