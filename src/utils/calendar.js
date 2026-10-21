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
/* Round 68 — read a time of day out of the dashboard's free-text field so the
   .ics file can carry it ("10:00 AM / ಬೆಳಿಗ್ಗೆ, 10:00", "6:30 PM",
   "ಸಂಜೆ 6:30", "18:45"). Returns "HHMM" in 24-hour form, or "" when the text
   holds no readable time — the calendar entry then stays a whole-day event,
   exactly as before.

   Rules, in order: the FIRST clock-like number wins (digits with a colon, or
   digits hugging an am/pm); a meridiem comes from an English am/pm next to
   that number, else from a Kannada day-part word anywhere in the text
   (ಬೆಳಿಗ್ಗೆ morning, ಮಧ್ಯಾಹ್ನ midday, ಸಂಜೆ evening, ರಾತ್ರಿ night); with
   neither, the number is taken as a 24-hour clock. Out-of-range values are
   not a time. */
const KN_DAYPART_PM = ["ಮಧ್ಯಾಹ್ನ", "ಸಂಜೆ", "ರಾತ್ರಿ"];
const KN_DAYPART_AM = ["ಬೆಳಿಗ್ಗೆ"];

export function timeCompactFromText(text) {
  const s = String(text || "");
  if (!s.trim()) return "";

  const clock = s.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
  if (!clock) return "";
  let hour = Number(clock[1]);
  const minute = clock[2] ? Number(clock[2]) : 0;
  let meridiem = (clock[3] || "").toLowerCase();

  if (!meridiem) {
    if (KN_DAYPART_PM.some((w) => s.includes(w))) meridiem = "pm";
    else if (KN_DAYPART_AM.some((w) => s.includes(w))) meridiem = "am";
  }
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return "";
  return pad(hour) + pad(minute);
}

/** The VEVENT lines for one program. Pure, so the round-68 test can read
    them without a browser. With a readable time the event is a timed one
    (two hours long, floating local time — the temple's clock); without, it
    stays the whole-day entry it always was. */
export function icsLines({ title, dateISO, venue, description, timeText, dtstamp }) {
  const hm = timeCompactFromText(timeText);
  const day = compactDate(dateISO);
  let start;
  let end;
  if (hm) {
    const minutes = Number(hm.slice(0, 2)) * 60 + Number(hm.slice(2));
    const endMinutes = Math.min(minutes + 120, 23 * 60 + 59);
    start = `DTSTART:${day}T${hm}00`;
    end = `DTEND:${day}T${pad(Math.floor(endMinutes / 60))}${pad(endMinutes % 60)}00`;
  } else {
    start = `DTSTART;VALUE=DATE:${day}`;
    end = `DTEND;VALUE=DATE:${nextDayCompact(dateISO)}`;
  }
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Omkar Samithi//Programs//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${day}-${slugify(title)}@omkarsamithi`,
    `DTSTAMP:${dtstamp}`,
    start,
    end,
    `SUMMARY:${escapeICS(title)}`,
    venue ? `LOCATION:${escapeICS(venue)}` : null,
    description ? `DESCRIPTION:${escapeICS(description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
}

export function downloadIcs({ title, dateISO, venue, description, timeText }) {
  if (!dateISO || typeof document === "undefined") return false;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = icsLines({ title, dateISO, venue, description, timeText, dtstamp });

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
