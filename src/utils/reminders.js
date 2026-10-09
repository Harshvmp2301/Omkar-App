/**
 * The in-tab reminder engine (round 28).
 *
 * The Samithi asked for three notices per program — when a program is
 * updated, one week before, and one day before — plus a notice when the
 * blog or the YouTube channel publishes. The agreed split: a visitor with
 * a browser tab open gets these IN THE TAB (this file); the installed PWA
 * gets real push later, from a server, on top of the same three triggers.
 *
 * Everything here is pure: dates and "what this browser last saw" go in,
 * an ordered list of due reminders comes out. No clock is read inside the
 * engine — the caller passes today — so every window can be tested exactly.
 *
 * Two families of reminder:
 *  - date-driven (today / tomorrow / this week): recomputed on every load
 *    while the window is open, so a visitor who opens the site any day in
 *    the last week still hears about the program;
 *  - delta-driven (program moved, new post, new video): fire ONCE per
 *    change, against the snapshot this browser stored last time.
 */

import { dateOnly } from "./calendar.js";

export const SEEN_KEY = "omkar:seen";
const DAY_MS = 86400000;

/** Whole days from today to a date (0 = today, 1 = tomorrow). Null if junk. */
export function daysUntil(dateISO, todayISO) {
  const a = Date.parse(`${dateOnly(dateISO)}T00:00:00Z`);
  const b = Date.parse(`${dateOnly(todayISO)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / DAY_MS);
}

/** program list -> { title: dateISO }, the snapshot deltas are measured on. */
export function seenDatesOf(programs = []) {
  const map = {};
  for (const p of programs) if (p && p.title) map[p.title] = dateOnly(p.date);
  return map;
}

/**
 * What is due, in the order it should be spoken: the program itself first
 * (soonest window wins), then a moved program, then the blog, then YouTube.
 *
 * `seen` is the stored snapshot; `dismissed` lives inside it. A reminder id
 * carries everything that identifies the notice (kind, subject, date), so
 * dismissing "Omkar Naadamrutha, tomorrow" never hides next year's.
 */
export function dueReminders({
  todayISO,
  programs = [],
  post = null,
  video = null,
  seen = null,
}) {
  const store = seen && typeof seen === "object" ? seen : {};
  const seenDates = store.dates && typeof store.dates === "object" ? store.dates : {};
  const dismissed = store.dismissed && typeof store.dismissed === "object" ? store.dismissed : {};
  const due = [];
  const add = (r) => {
    if (!dismissed[r.id]) due.push(r);
  };

  const next = programs[0]; // upcomingEvents hands them over soonest-first
  if (next && next.title) {
    const when = dateOnly(next.date);
    const base = { name: next.title, date: when, day: next.day, mon: next.mon };
    const d = daysUntil(when, todayISO);
    if (d === 0) add({ ...base, id: `today:${next.title}:${when}`, kind: "today", priority: 0 });
    else if (d === 1) add({ ...base, id: `day:${next.title}:${when}`, kind: "day", priority: 1 });
    else if (d !== null && d >= 2 && d <= 7) {
      add({ ...base, id: `week:${next.title}:${when}`, kind: "week", priority: 2, days: d });
    }
  }

  for (const p of programs) {
    if (!p || !p.title) continue;
    const before = seenDates[p.title];
    const now = dateOnly(p.date);
    // "before" missing means this browser never saw the old date: a first
    // visit is a baseline, not news.
    if (before && before !== now) {
      add({
        id: `moved:${p.title}:${now}`,
        kind: "moved",
        priority: 3,
        name: p.title,
        date: now,
        day: p.day,
        mon: p.mon,
      });
    }
  }

  if (post && post.id && store.blog && store.blog !== post.id) {
    add({ id: `blog:${post.id}`, kind: "blog", priority: 4, title: post.title });
  }
  if (video && video.id && store.video && store.video !== video.id) {
    add({ id: `video:${video.id}`, kind: "video", priority: 5, title: video.title });
  }

  due.sort((a, b) => a.priority - b.priority);
  return due;
}

/** The snapshot to store AFTER computing what is due: today becomes the baseline. */
export function nextSeen({ programs = [], post = null, video = null, seen = null }) {
  const store = seen && typeof seen === "object" ? seen : {};
  return {
    dates: seenDatesOf(programs),
    blog: post && post.id ? post.id : store.blog || "",
    video: video && video.id ? video.id : store.video || "",
    dismissed: store.dismissed && typeof store.dismissed === "object" ? store.dismissed : {},
  };
}

/* ---------------------------------------------------------------- storage */

export function readSeen() {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // private mode, storage blocked — reminders simply start fresh
  }
}

export function writeSeen(seen) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* nothing to do: the notice still shows for this session */
  }
}
