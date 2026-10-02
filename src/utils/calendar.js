// Date, countdown and .ics (Add-to-Calendar) helpers — no external dependencies.

const KN_DIGITS = ["೦", "೧", "೨", "೩", "೪", "೫", "೬", "೭", "೮", "೯"];

export function toKnDigits(value) {
  return String(value).replace(/\d/g, (d) => KN_DIGITS[Number(d)]);
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * "2026-10-27T00:00:00+00:00" → "2026-10-27".
 *
 * Everything here works on plain calendar dates, never timestamps: a program on
 * 27 October must read as 27 October in Muscat even though the row is stored in
 * UTC. Slicing the string avoids the timezone shifting the day by one.
 */
export const dateOnly = (value) => (value ? String(value).slice(0, 10) : "");

function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * Whole days from today until `iso` (negative = past, 0 = today).
 *
 * `now` is injectable so callers with a date-dependent rule — the diya lamps,
 * the event countdowns — can be tested at a chosen moment instead of only
 * today. Left out, it is simply now.
 */
export function daysUntil(iso, now = new Date()) {
  const target = parseISO(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Is this a real calendar day? "2026-02-30" and "2027-02-29" are not. */
function isRealDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const probe = new Date(y, m - 1, d);
  return probe.getMonth() === m - 1 && probe.getDate() === d;
}

/**
 * The same calendar day in another year: "2026-04-01" + 2027 → "2027-04-01".
 * "" when there is no such day (29 February in a common year) or the value is
 * not a date at all.
 */
export function occurrenceInYear(dateISO, year) {
  const date = dateOnly(dateISO);
  if (!ISO_RE.test(date)) return "";
  const iso = `${year}-${date.slice(5)}`;
  return isRealDate(iso) ? iso : "";
}

/**
 * The occurrence of an annually repeating date that applies now.
 *
 * The Samithi's programs fall on the same day every year — Jnanamrutha on
 * 1 April, Anjaneya Pooje on 18 December — so the year stored with a date is
 * only where it was first set. A date dated this year or earlier resolves to
 * this year's occurrence, which is what keeps the program list, the festival
 * calendar and the lamps correct in January without anyone editing anything.
 *
 * A date the Samithi has already set for a future year is left alone: that is
 * a program scheduled ahead, and the site counts down to that one.
 */
export function annualOccurrence(dateISO, now = new Date()) {
  const date = dateOnly(dateISO);
  if (!ISO_RE.test(date)) return "";
  const year = Number(date.slice(0, 4));
  if (year > now.getFullYear()) return date;
  return occurrenceInYear(date, now.getFullYear()) || date;
}

/** { day, month abbreviation } for the little date tile on event rows. */
export function dateParts(iso, lang) {
  const date = parseISO(iso);
  const day = String(date.getDate());
  const mon = date.toLocaleDateString(lang === "kn" ? "kn-IN" : "en-GB", { month: "short" });
  return { day: lang === "kn" ? toKnDigits(day) : day, mon };
}

/** Human countdown label: "today", "tomorrow", "12 days to go" … or "" when past/unknown. */
export function countdownLabel(iso, t) {
  if (!iso) return "";
  const n = daysUntil(iso);
  if (n < 0) return "";
  if (n === 0) return t.todayLabel;
  if (n === 1) return t.tomorrowLabel;
  return `${n} ${t.daysToGo}`;
}

/** "27 October 2026" (or the Kannada equivalent) for titles/tooltips. */
export function formatFullDate(iso, lang) {
  return parseISO(iso).toLocaleDateString(lang === "kn" ? "kn-IN" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// --- .ics generation -------------------------------------------------------

function escapeICS(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "event";
}

function compactDate(iso) {
  return iso.replace(/-/g, "");
}

function nextDayCompact(iso) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/**
 * Download a single all-day VEVENT for the given ISO date.
 * All-day (VALUE=DATE) avoids inventing event times — venues/TBA stay flexible.
 */
export function downloadIcs({ title, dateISO, venue, description }) {
  if (!dateISO || typeof document === "undefined") return false;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Omkar Samithi//Programs//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${compactDate(dateISO)}-${slugify(title)}@omkarsamithi`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${compactDate(dateISO)}`,
    `DTEND;VALUE=DATE:${nextDayCompact(dateISO)}`,
    `SUMMARY:${escapeICS(title)}`,
    venue ? `LOCATION:${escapeICS(venue)}` : null,
    description ? `DESCRIPTION:${escapeICS(description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  try {
    const blob = new Blob([lines.join("\r\n") + "\r\n"], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omkar-${slugify(title)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
