/**
 * The Samithi's three programs, defined once.
 *
 * The admin dashboard does not let anyone type an event title: there are three
 * programs, they always pair with the same Kannada name, and a typo in either
 * would show up on the public site. So the choices live here, and both the
 * dropdowns and the public list are built from this one array.
 *
 * `events.test.js` asserts these strings against the curated `eventsList` in
 * src/data/content.js, so the dropdown and the built-in list cannot drift.
 */

import { annualOccurrence, dateOnly, occurrenceInYear } from "./calendar.js";
import { listPublishedEvents, supabaseEnabled } from "./supabase.js";

export const EVENT_TITLES = [
  { en: "Omkar Jnanamrutha", kn: "ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ" },
  { en: "Omkar Naadamrutha", kn: "ಓಂಕಾರ ನಾದಾಮೃತ" },
  { en: "Sri Anjaneya Pooje", kn: "ಶ್ರೀ ಆಂಜನೇಯ ಪೂಜೆ" },
];

/** Every program is held at the temple, so nobody types it. */
export const DEFAULT_VENUE = {
  en: "Sri Krishna Temple, Darsait, Muscat",
  kn: "ಶ್ರೀ ಕೃಷ್ಣ ದೇವಸ್ಥಾನ, ದಾರ್ಸೈಟ್, ಮಸ್ಕತ್",
};

/** Darsait, in the one Kannada spelling the site uses. */
export const DARSAIT_KN = "ದಾರ್ಸೈಟ್";
const DARSAIT_TYPO = "ದಾರ್ಸೈತ್";

/**
 * Fix the town's name in Kannada text that came from the database.
 *
 * The dashboard used to write Darsait with the wrong letter, and that text is
 * still stored in the `location_kn` column of every row saved back then. A
 * row's venue wins over the built-in one, so without this the old spelling
 * walks back onto the Events page no matter what the rest of the site says.
 * Correcting it as the row is read means nobody has to edit rows by hand — and
 * doing it on the way in means fresh rows are clean too.
 *
 * Anything that is not a string (a missing column, for instance) is passed
 * through untouched.
 */
export function correctDarsait(text) {
  if (typeof text !== "string") return text;
  return text.split(DARSAIT_TYPO).join(DARSAIT_KN);
}

export const TITLE_EN = EVENT_TITLES.map((t) => t.en);

/** The Kannada name that belongs to an English title ("" when unknown). */
export function titleKnFor(titleEn) {
  const match = EVENT_TITLES.find((t) => t.en === titleEn);
  return match ? match.kn : "";
}

/**
 * A database row → the shape the public event list already uses
 * ({ id, date, day, mon, title, guest, venue }).
 *
 * Anything the row leaves empty falls back to the Samithi's standing details,
 * so a half-filled row still renders as a complete, correct programme.
 */
export function mapEventRow(row = {}, lang = "en") {
  const kn = lang === "kn";
  const date = dateOnly(row.starts_at);

  return {
    id: row.id || `db-${row.title_en || "event"}`,
    date,
    // Used only when there is no date yet; the row shows "TBA" beside it.
    day: "—",
    mon: "",
    title: correctDarsait((kn ? row.title_kn : row.title_en) || row.title_en || ""),
    // Guest names are stored in the description columns — the dashboard labels
    // the field "Guest" and nothing else writes there.
    guest: correctDarsait((kn ? row.description_kn : row.description_en) || row.description_en || null),
    venue: correctDarsait((kn ? row.location_kn : row.location_en) || DEFAULT_VENUE[kn ? "kn" : "en"]),
  };
}

/**
 * The dashboard's simplified form → a database row.
 *
 * The form only collects a title (from a dropdown), an optional date and the
 * guest names. Everything else the site needs is filled in here:
 *
 *   · the venue is always the temple
 *   · date_label is cleared — an event without a date shows "TBA" on the site
 *     by itself, so there is no label for anyone to type or forget
 *   · the link field is cleared, and ordering is by date
 */
export function eventRowFromForm(form = {}) {
  const titleEn = String(form.title_en || "").trim();
  const titleKn =
    correctDarsait(String(form.title_kn || "").trim()) || titleKnFor(titleEn) || null;
  const guest = (value) => correctDarsait(String(value || "").trim()) || null;

  return {
    title_en: titleEn,
    title_kn: titleKn,
    description_en: guest(form.guest_en),
    description_kn: guest(form.guest_kn),
    starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
    date_label_en: null,
    date_label_kn: null,
    location_en: DEFAULT_VENUE.en,
    location_kn: DEFAULT_VENUE.kn,
    url: null,
    published: Boolean(form.published),
  };
}

/**
 * Published rows for the public site. [] when Supabase is not configured, is
 * unreachable, or is empty — the caller then keeps the curated list, the same
 * contract the video and blog feeds use.
 */
export async function fetchEventRows() {
  if (!supabaseEnabled) return [];

  const { ok, rows } = await listPublishedEvents();
  if (!ok || !Array.isArray(rows)) return [];
  return rows.filter((r) => r && r.title_en);
}

/**
 * The three programmes, with anything maintained in the dashboard laid over
 * the top of them.
 *
 * This is a per-programme merge, not a wholesale swap, and that distinction
 * matters: if the Samithi sets a date for Naadamrutha, the other two
 * programmes must stay on the page exactly as they are. A row only ever
 * replaces the programme it names, and only the details it actually carries —
 * so the guest's name can be filled in this month and changed the next, and
 * nothing is lost in between.
 *
 * The date is the one exception: a row with no date means the Samithi has not
 * announced one, and the site says TBA. It does not fall back to the built-in
 * date, which may be a date that has already passed.
 *
 * Rows whose title is not one of the three (a future year, a new programme)
 * are appended rather than dropped.
 */
export function mergeEvents(curated = [], rows = [], lang = "en") {
  if (!Array.isArray(rows) || rows.length === 0) return curated;

  const byTitle = new Map();
  for (const row of rows) {
    const kn = lang === "kn";
    const key = (kn ? row.title_kn : row.title_en) || row.title_en;
    if (key) byTitle.set(key, row);
  }

  const merged = curated.map((entry) => {
    const row = byTitle.get(entry.title);
    if (!row) return entry;
    byTitle.delete(entry.title);

    const live = mapEventRow(row, lang);
    return {
      // Keep the curated id: the reminder bells are stored per id in
      // localStorage, so a new id would silently forget someone's reminder.
      id: entry.id,
      // The row decides the date — empty means TBA, not a fallback.
      date: live.date,
      day: "—",
      mon: "",
      title: live.title || entry.title,
      guest: live.guest || entry.guest,
      venue: live.venue || entry.venue,
    };
  });

  for (const row of byTitle.values()) merged.push(mapEventRow(row, lang));
  return merged;
}

/**
 * Move every program's date onto its occurrence in the current year — the
 * same-year view, past dates included.
 *
 * The Samithi's programs repeat every year, so the year in a stored date is
 * only a starting point: set 1 April once and the site shows 1 April next year
 * too, without anyone opening the dashboard in January. A date already set for
 * a future year is left where it is.
 *
 * This is what the LAMPS render (through diya.js, a lamp stays lit to year end
 * after its programme has finished) and what the panchang calendar pages
 * through. It is deliberately NOT what the program rows render: those use
 * `upcomingEvents`, so a programme that has already happened this year can
 * never be presented as upcoming.
 */
export function rollDates(events = [], now = new Date()) {
  return events.map((event) => {
    const date = annualOccurrence(event.date, now);
    return date === event.date ? event : { ...event, date };
  });
}

/**
 * Every program at its NEXT occurrence — today or later — in date order.
 *
 * This is the list the program rows, the homepage blocks and the festival
 * calendar render, and it answers one question: when is this program next?
 *
 * `rollDates` below answers a different question — "what date does this
 * programme fall on in the year we are in?" — and the two must not be
 * confused. The lamps need `rollDates`: a lamp stays lit after its programme
 * has finished, until New Year, so the April programme is still April once it
 * is behind us. A list headed "Upcoming Programs" cannot use that: on 8
 * October 2026 it showed the April and the 2 October programmes, both of them
 * already past, above countdowns that no longer existed.
 *
 * So: a programme whose day has passed this year moves to next year's
 * occurrence, a programme dated today stays today (the day itself is still
 * ahead of the visitor), a date the Samithi set for a future year is already
 * the next occurrence and is left alone, and the result is sorted by date so
 * the list reads as a calendar of what is ahead.
 *
 * Sorting is stable: programmes sharing a date keep their existing order, and
 * an undated programme (TBA) has no place in time, so it keeps its order at
 * the end and still renders as TBA, exactly as before.
 */
export function upcomingEvents(events = [], now = new Date()) {
  const list = Array.isArray(events) ? events : [];
  const today = dateOnly(now.toISOString());
  const year = now.getFullYear();

  /** The next occurrence of one stored date: today or later, never earlier. */
  const nextOccurrence = (dateISO) => {
    const date = dateOnly(dateISO);
    // A date already set for a future year is the next occurrence as written.
    if (Number(date.slice(0, 4)) > year) return date;
    const thisYear = occurrenceInYear(date, year);
    if (thisYear && thisYear >= today) return thisYear;
    return occurrenceInYear(date, year + 1);
  };

  return list
    .map((event, index) => {
      const rolled = event && event.date ? nextOccurrence(event.date) : "";
      const item = rolled && rolled !== event.date ? { ...event, date: rolled } : event;
      return { item, index };
    })
    .sort((a, b) => {
      const left = a.item && a.item.date;
      const right = b.item && b.item.date;
      if (left && right) {
        if (left === right) return a.index - b.index;
        return left < right ? -1 : 1;
      }
      if (left) return -1;
      if (right) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/**
 * The one program to put in front of a visitor: the next dated one.
 *
 * The homepage leads with a single featured program, and "next" has to mean
 * next — a program that finished yesterday must not be the headline. Dates
 * repeat annually, so a program whose day has already passed this year is
 * counted into next year rather than dropped: after Anjaneya Pooje in
 * December, the featured program becomes April's Jnanamrutha.
 *
 * It is the first dated programme of `upcomingEvents`, which is sorted, so the
 * featured card and the first row of the list can never disagree about what is
 * next. A program with no date is never featured (there is no date to act on),
 * and when nothing has a date at all the first program is returned so the
 * caller still has something to show — it renders as TBA, exactly like the
 * list.
 */
export function nextEvent(events = [], now = new Date()) {
  const list = Array.isArray(events) ? events : [];
  return upcomingEvents(list, now).find((e) => e && e.date) || list[0] || null;
}

/**
 * The public programme list, from the database to the page: the Samithi's
 * published rows laid over the curated list, dated in the year we are in.
 * App derives the two views it needs from this — `upcomingEvents` for the
 * programme rows and the homepage, this same-year list for the lamps.
 */
export async function loadEvents(curated = [], lang = "en", now = new Date()) {
  const rows = await fetchEventRows();
  return rollDates(mergeEvents(curated, rows, lang), now);
}
