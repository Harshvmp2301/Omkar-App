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

import { annualOccurrence, dateOnly } from "./calendar.js";
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
    title: (kn ? row.title_kn : row.title_en) || row.title_en || "",
    // Guest names are stored in the description columns — the dashboard labels
    // the field "Guest" and nothing else writes there.
    guest: (kn ? row.description_kn : row.description_en) || row.description_en || null,
    venue: (kn ? row.location_kn : row.location_en) || DEFAULT_VENUE[kn ? "kn" : "en"],
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
  const titleKn = String(form.title_kn || "").trim() || titleKnFor(titleEn) || null;
  const guest = (value) => String(value || "").trim() || null;

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
 * Move every program's date onto its occurrence in the current year.
 *
 * The Samithi's programs repeat every year, so the year in a stored date is
 * only a starting point: set 1 April once and the site shows 1 April next year
 * too, without anyone opening the dashboard in January. The lamps follow the
 * same dates through diya.js, so the list, the calendar and the lamps all move
 * together. A date already set for a future year is left where it is.
 */
export function rollDates(events = [], now = new Date()) {
  return events.map((event) => {
    const date = annualOccurrence(event.date, now);
    return date === event.date ? event : { ...event, date };
  });
}

/** The list the public Events page shows. */
export async function loadEvents(curated = [], lang = "en", now = new Date()) {
  const rows = await fetchEventRows();
  return rollDates(mergeEvents(curated, rows, lang), now);
}
