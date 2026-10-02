import { describe, expect, it } from "vitest";
import { translations } from "../data/content.js";
import { FESTIVAL_RULES, festivalDateFor, festivalsForYear } from "./festivals.js";

const en = translations.en.festivalList;
const kn = translations.kn.festivalList;

/**
 * The 28 dates the Samithi already had for 2026, as they were in the site
 * before the calendar started working them out. They are the yardstick: the
 * computed dates have to land on these days, or the calendar has quietly
 * drifted from the panchang the temple follows.
 *
 * One exception, and it is the list that is wrong, not the sky: Jyeshtha
 * Purnima was written down as 16 June 2026, which is a new-moon day — the full
 * moon that month is 29 June. The computed date is the Purnima.
 */
const SAMITHI_2026 = {
  fc1: "2026-01-14", fc2: "2026-01-23", fc3: "2026-02-15", fc4: "2026-03-04",
  fc5: "2026-03-19", fc6: "2026-03-27", fc7: "2026-04-02", fc8: "2026-04-19",
  fc9: "2026-05-01", fc10: "2026-06-29", fc11: "2026-07-16", fc12: "2026-07-29",
  fc13: "2026-08-26", fc14: "2026-08-28", fc15: "2026-09-04", fc16: "2026-09-14",
  fc17: "2026-09-25", fc18: "2026-10-10", fc19: "2026-10-11", fc20: "2026-10-20",
  fc21: "2026-10-29", fc22: "2026-11-06", fc23: "2026-11-08", fc24: "2026-11-10",
  fc25: "2026-11-11", fc26: "2026-11-15", fc27: "2026-11-24", fc28: "2026-12-20",
};

describe("the rules match the festivals on the site", () => {
  it("has a rule for every festival in both languages, and no strays", () => {
    const ids = en.map((f) => f.id);
    expect(ids).toEqual(kn.map((f) => f.id));
    expect(Object.keys(FESTIVAL_RULES).sort()).toEqual([...ids].sort());
  });

  it("keeps the names and notes out of the rules — they live in content.js", () => {
    for (const festival of en) {
      expect(typeof festival.title).toBe("string");
      expect(festival.title.length).toBeGreaterThan(0);
      // The date is computed now; a typed-in one would be a second source of
      // truth, which is exactly what this round removed.
      expect(festival.date).toBeUndefined();
    }
  });
});

describe("the 2026 dates, against the Samithi's own list", () => {
  it("lands on every one of the 28 days", () => {
    const mismatched = en
      .map((f) => [f.id, festivalDateFor(f.id, 2026), SAMITHI_2026[f.id]])
      .filter(([, got, want]) => got !== want);
    expect(mismatched).toEqual([]);
  });

  it("fills every date, with no blanks and no duplicates", () => {
    const dates = festivalsForYear(en, 2026).map((f) => f.date);
    expect(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("keeps them in the order the year runs", () => {
    const dates = festivalsForYear(en, 2026).map((f) => f.date);
    expect(dates).toEqual([...dates].sort());
  });
});

describe("the calendar keeps itself up to date", () => {
  it("dates every festival in 2027 and 2028 without anyone editing a list", () => {
    for (const year of [2027, 2028]) {
      const list = festivalsForYear(en, year);
      expect(list).toHaveLength(28);
      for (const festival of list) {
        expect(festival.date.slice(0, 4), `${festival.id} in ${year}`).toBe(String(year));
      }
      // Same sequence of festivals, different days.
      expect(list.map((f) => f.id)).toEqual(en.map((f) => f.id));
    }
  });

  it("moves the festivals year to year, as the moon and sun do", () => {
    const dates2026 = festivalsForYear(en, 2026).map((f) => f.date);
    const dates2027 = festivalsForYear(en, 2027).map((f) => f.date);
    expect(dates2026).not.toEqual(dates2027);
    // Makar Sankranti is solar, so it stays put; the lunar festivals drift.
    expect(festivalDateFor("fc1", 2027)).toBe("2027-01-14");
    expect(festivalDateFor("fc23", 2027)).not.toBe("2027-11-08");
  });

  it("keeps each festival in its own season", () => {
    const month = (id, year) => Number(festivalDateFor(id, year).slice(5, 7));
    // Deepavali is always in the autumn, never in September or spring.
    for (const year of [2025, 2026, 2027, 2028, 2029]) {
      expect([10, 11], `Deepavali ${year}`).toContain(month("fc23", year));
      expect([9, 10], `Sharad Navratri ${year}`).toContain(month("fc19", year));
      expect([1], `Makar Sankranti ${year}`).toContain(month("fc1", year));
      expect([2, 3], `Maha Shivaratri ${year}`).toContain(month("fc3", year));
      expect([8, 9], `Ganesh Chaturthi ${year}`).toContain(month("fc16", year));
      expect([3, 4], `Ugadi ${year}`).toContain(month("fc5", year));
    }
  });

  it("gives the same answer for both languages", () => {
    expect(festivalsForYear(kn, 2026).map((f) => f.date)).toEqual(
      festivalsForYear(en, 2026).map((f) => f.date)
    );
  });

  it("answers from memory the second time it is asked", () => {
    // The calendar asks on every render; the maths must not run again.
    const first = festivalsForYear(en, 2026);
    expect(festivalsForYear(en, 2026)).toBe(first);
    expect(festivalsForYear(en, 2027)).not.toBe(first);
  });
});
