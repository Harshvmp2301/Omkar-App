import { dateOnly } from "../utils/calendar.js";

/** Dates in the dashboard: readable, unambiguous, Muscat-friendly. */
export function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

export const toInput = (iso) => (iso ? String(iso).slice(0, 16) : "");
export const toIso = (local) => (local ? new Date(local).toISOString() : null);

/**
 * A date without a time. Events are whole-day occasions, and formatWhen() would
 * otherwise print the UTC offset as a clock time — "27 Oct 2026, 04:00" for a
 * date the admin simply picked as 27 October.
 */
export function formatDate(value) {
  const date = dateOnly(value);
  if (!date) return "—";
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return date;
  }
}
