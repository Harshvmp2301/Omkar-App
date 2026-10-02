import { describe, expect, it } from "vitest";
import { DIYA_WINDOW_DAYS, anyDiyaLit, diyaLit, litDiyas } from "./diya.js";

const at = (iso) => new Date(`${iso}T12:00:00`);

describe("diyaLit — a lamp lights a month before its program and stays lit", () => {
  const program = "2026-10-02";

  it("is dark long before the program", () => {
    expect(diyaLit(program, at("2026-01-01"))).toBe(false);
    expect(diyaLit(program, at("2026-09-01"))).toBe(false);
  });

  it("lights exactly 30 days before", () => {
    expect(diyaLit(program, at("2026-09-02"))).toBe(true);
  });

  it("stays lit every day in between", () => {
    for (const day of ["2026-09-03", "2026-09-20", "2026-10-01"]) {
      expect(diyaLit(program, at(day)), `on ${day}`).toBe(true);
    }
  });

  it("is lit on the day of the program", () => {
    expect(diyaLit(program, at("2026-10-02"))).toBe(true);
  });

  it("stays lit after the program — a finished program is not snuffed out", () => {
    expect(diyaLit(program, at("2026-10-03"))).toBe(true);
    expect(diyaLit(program, at("2026-11-15"))).toBe(true);
    expect(diyaLit(program, at("2026-12-31"))).toBe(true);
  });

  it("goes dark on the first day of the new year", () => {
    expect(diyaLit(program, at("2027-01-01"))).toBe(false);
  });

  it("rolls to next year's occurrence by itself", () => {
    // Nobody edits the dashboard in January — the stored date still says 2026.
    expect(diyaLit(program, at("2027-09-01"))).toBe(false);
    expect(diyaLit(program, at("2027-09-02"))).toBe(true);
    expect(diyaLit(program, at("2028-10-02"))).toBe(true);
  });

  it("follows a date the Samithi has set for a future year", () => {
    const nextYear = "2027-04-01";
    expect(diyaLit(nextYear, at("2026-12-20"))).toBe(false);
    expect(diyaLit(nextYear, at("2027-03-01"))).toBe(false);
    expect(diyaLit(nextYear, at("2027-03-02"))).toBe(true);
  });

  it("cannot light without a date", () => {
    // A program still to be announced has nothing to count down to.
    expect(diyaLit("", at("2026-01-01"))).toBe(false);
    expect(diyaLit(null, at("2026-01-01"))).toBe(false);
    expect(diyaLit(undefined, at("2026-01-01"))).toBe(false);
  });

  it("ignores any time part, so a UTC timestamp cannot shift the day", () => {
    expect(diyaLit("2026-10-02T00:00:00+00:00", at("2026-09-02"))).toBe(true);
    expect(diyaLit("2026-10-02T00:00:00+00:00", at("2026-09-01"))).toBe(false);
  });

  it("uses a 30-day window", () => {
    expect(DIYA_WINDOW_DAYS).toBe(30);
  });
});

describe("the 2026 season, as the Samithi described it", () => {
  // Jnanamrutha in April, Naadamrutha in October, Anjaneya Pooje in December.
  // Each lamp joins the others a month before its own program, and nothing
  // puts it out until New Year — so the row gets brighter as the year goes on.
  const season = [
    { id: "e1", title: "Omkar Jnanamrutha", date: "2026-04-01" },
    { id: "e2", title: "Omkar Naadamrutha", date: "2026-10-02" },
    { id: "e3", title: "Sri Anjaneya Pooje", date: "2026-12-18" },
  ];
  const litCount = (iso) => litDiyas(season, at(iso)).filter(Boolean).length;

  it("has every lamp dark at the start of the year", () => {
    expect(litDiyas(season, at("2026-01-01"))).toEqual([false, false, false]);
    expect(anyDiyaLit(season, at("2026-01-01"))).toBe(false);
  });

  it("lights only the first lamp in March", () => {
    expect(litDiyas(season, at("2026-03-15"))).toEqual([true, false, false]);
  });

  it("keeps the first lamp lit after its program is over", () => {
    expect(litDiyas(season, at("2026-05-20"))).toEqual([true, false, false]);
  });

  it("has two lamps burning once the autumn program is a month away", () => {
    expect(litDiyas(season, at("2026-09-15"))).toEqual([true, true, false]);
  });

  it("leaves the third lamp dark until its own month", () => {
    expect(litDiyas(season, at("2026-11-01"))).toEqual([true, true, false]);
  });

  it("has all three lit in December", () => {
    expect(litDiyas(season, at("2026-12-01"))).toEqual([true, true, true]);
  });

  it("keeps all three lit until the end of the year", () => {
    expect(litDiyas(season, at("2026-12-31"))).toEqual([true, true, true]);
  });

  it("goes dark again on New Year's Day, with the dates untouched", () => {
    // The stored dates still say 2026 — the roll happens by itself.
    expect(litDiyas(season, at("2027-01-01"))).toEqual([false, false, false]);
    expect(anyDiyaLit(season, at("2027-01-01"))).toBe(false);
  });

  it("starts again the next spring", () => {
    expect(litDiyas(season, at("2027-04-01"))).toEqual([true, false, false]);
  });

  it("grows the row one lamp at a time through the year", () => {
    expect(litCount("2026-01-01")).toBe(0);
    expect(litCount("2026-03-15")).toBe(1);
    expect(litCount("2026-09-15")).toBe(2);
    expect(litCount("2026-12-01")).toBe(3);
    expect(litCount("2027-01-01")).toBe(0);
  });

  it("never lights a lamp for a program with no date", () => {
    const undated = [{ id: "e3", title: "Sri Anjaneya Pooje", date: "" }];
    expect(litDiyas(undated, at("2026-12-01"))).toEqual([false]);
  });

  it("copes with an empty list", () => {
    expect(litDiyas([], at("2026-06-01"))).toEqual([]);
  });
});
