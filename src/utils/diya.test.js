import { describe, expect, it } from "vitest";
import { DIYA_WINDOW_DAYS, anyDiyaLit, diyaLit, litDiyas } from "./diya.js";

const at = (iso) => new Date(`${iso}T12:00:00`);

describe("diyaLit — a lamp lights a month before its program", () => {
  const program = "2026-10-27";

  it("is dark long before the program", () => {
    expect(diyaLit(program, at("2026-01-01"))).toBe(false);
    expect(diyaLit(program, at("2026-09-26"))).toBe(false);
  });

  it("lights exactly 30 days before", () => {
    expect(diyaLit(program, at("2026-09-27"))).toBe(true);
  });

  it("stays lit every day in between", () => {
    for (const day of ["2026-09-28", "2026-10-01", "2026-10-15", "2026-10-26"]) {
      expect(diyaLit(program, at(day)), `on ${day}`).toBe(true);
    }
  });

  it("is lit on the day of the program", () => {
    expect(diyaLit(program, at("2026-10-27"))).toBe(true);
  });

  it("goes dark the day after", () => {
    expect(diyaLit(program, at("2026-10-28"))).toBe(false);
    expect(diyaLit(program, at("2026-11-30"))).toBe(false);
  });

  it("cannot light without a date", () => {
    // A program still to be announced has nothing to count down to.
    expect(diyaLit("", at("2026-01-01"))).toBe(false);
    expect(diyaLit(null, at("2026-01-01"))).toBe(false);
    expect(diyaLit(undefined, at("2026-01-01"))).toBe(false);
  });

  it("ignores any time part, so a UTC timestamp cannot shift the day", () => {
    expect(diyaLit("2026-10-27T00:00:00+00:00", at("2026-09-27"))).toBe(true);
    expect(diyaLit("2026-10-27T00:00:00+00:00", at("2026-09-26"))).toBe(false);
  });

  it("uses a 30-day window", () => {
    expect(DIYA_WINDOW_DAYS).toBe(30);
  });
});

describe("the 2026 season, as the Samithi described it", () => {
  // Jnanamrutha in April, Naadamrutha in October, Anjaneya Pooje in December:
  // the lamps should come on one at a time, in that order, never together.
  const season = [
    { id: "e1", title: "Omkar Jnanamrutha", date: "2026-04-01" },
    { id: "e2", title: "Omkar Naadamrutha", date: "2026-10-02" },
    { id: "e3", title: "Sri Anjaneya Pooje", date: "2026-12-18" },
  ];

  it("has every lamp dark at the start of the year", () => {
    expect(litDiyas(season, at("2026-01-01"))).toEqual([false, false, false]);
    expect(anyDiyaLit(season, at("2026-01-01"))).toBe(false);
  });

  it("lights only the first lamp in March", () => {
    expect(litDiyas(season, at("2026-03-15"))).toEqual([true, false, false]);
  });

  it("lights only the second lamp in September", () => {
    expect(litDiyas(season, at("2026-09-15"))).toEqual([false, true, false]);
  });

  it("has every lamp dark between programs", () => {
    expect(litDiyas(season, at("2026-05-20"))).toEqual([false, false, false]);
    expect(litDiyas(season, at("2026-11-05"))).toEqual([false, false, false]);
  });

  it("lights only the third lamp in December", () => {
    expect(litDiyas(season, at("2026-12-01"))).toEqual([false, false, true]);
  });

  it("has every lamp dark after the last program", () => {
    expect(litDiyas(season, at("2026-12-31"))).toEqual([false, false, false]);
  });

  it("never lights a lamp for a program with no date", () => {
    const undated = [{ id: "e3", title: "Sri Anjaneya Pooje", date: "" }];
    expect(litDiyas(undated, at("2026-12-01"))).toEqual([false]);
  });

  it("copes with an empty list", () => {
    expect(litDiyas([], at("2026-06-01"))).toEqual([]);
  });
});
