import { describe, expect, it } from "vitest";
import {
  MUSCAT,
  ayanamsa,
  elongation,
  isoFromJulianDay,
  julianDay,
  lunarMonths,
  nextNewMoon,
  sunRashi,
  sunriseJD,
  sunsetJD,
  tithiAtSunrise,
  tithiIndex,
} from "./panchang.js";

describe("the sky over Muscat", () => {
  it("puts the sun's clock right", () => {
    // Sunrise in Muscat: earliest in June, latest in December — and the day is
    // long in June and short in December. A sanity check on the whole chain of
    // sun position, refraction and transit.
    const june = sunriseJD(2026, 6, 21);
    const december = sunriseJD(2026, 12, 21);
    expect(june).toBeLessThan(december);

    const juneHours = (sunsetJD(2026, 6, 21) - june) * 24;
    const decHours = (sunsetJD(2026, 12, 21) - december) * 24;
    expect(juneHours).toBeGreaterThan(13);
    expect(decHours).toBeLessThan(11);
    expect(decHours).toBeGreaterThan(10.5);
  });

  it("keeps the calendar day of a sunrise, whatever clock the visitor has", () => {
    // Everything is done in Julian Days for Muscat, so the date does not
    // depend on where the browser is.
    expect(MUSCAT.tz).toBe(4);
    expect(isoFromJulianDay(sunriseJD(2026, 6, 21))).toBe("2026-06-21");
    expect(isoFromJulianDay(sunriseJD(2026, 12, 21))).toBe("2026-12-21");
  });

  it("uses the Lahiri ayanamsa the Indian panchangs use", () => {
    // About 24°14′ in the 2020s, growing by roughly 50 seconds of arc a year.
    const now = ayanamsa(julianDay(2026, 1, 1));
    expect(now).toBeGreaterThan(24.1);
    expect(now).toBeLessThan(24.4);
    expect(ayanamsa(julianDay(2036, 1, 1))).toBeGreaterThan(now);
  });

  it("finds the same new moons the eclipse tables do", () => {
    // 17 February 2026: annular solar eclipse — a new moon.
    expect(isoFromJulianDay(nextNewMoon(julianDay(2026, 2, 1)))).toBe("2026-02-17");
    // 12 August 2026: total solar eclipse — a new moon.
    expect(isoFromJulianDay(nextNewMoon(julianDay(2026, 8, 1)))).toBe("2026-08-12");
  });

  it("has a full moon on 3 March 2026, the night of the total lunar eclipse", () => {
    expect(elongation(sunriseJD(2026, 3, 3))).toBeGreaterThan(168);
    expect(tithiAtSunrise(2026, 3, 3)).toBe(14); // Purnima
    expect(tithiAtSunrise(2026, 3, 4)).toBe(15); // Krishna Pratipada
  });

  it("puts the Makara sankranti during 14 January 2026", () => {
    // Makar Sankranti is kept on the day the sun changes sign — which is not
    // the same as the day it has already changed by sunrise.
    expect(sunRashi(sunriseJD(2026, 1, 14))).toBe(8); // Dhanu at sunrise
    expect(sunRashi(sunriseJD(2026, 1, 15))).toBe(9); // Makara by the next
  });

  it("numbers the tithis the way a panchang does", () => {
    // Diwali 2026 is the amavasya of Ashwina: the new moon falls on 9 November,
    // and the evening the lamps are lit is the 8th.
    expect(tithiIndex(sunriseJD(2026, 11, 8))).toBe(28);
    expect(tithiIndex(sunriseJD(2026, 11, 9))).toBe(29); // Amavasya
  });
});

describe("lunar months", () => {
  it("names each month after the solar month whose sankranti falls in it", () => {
    const months = lunarMonths(2026).filter((m) => m.startDate >= "2026-01-01");
    expect(months.length).toBeGreaterThan(10);
    for (const month of months) {
      if (month.adhika) continue;
      expect(month.sankrantis, `${month.startDate}`).toContain(month.rashi);
    }
  });

  it("finds the Adhika Jyeshtha of 2026 — the extra month, 17 May to 15 June", () => {
    const extra = lunarMonths(2026).filter((m) => m.adhika);
    expect(extra).toHaveLength(1);
    expect(extra[0].startDate).toBe("2026-05-17");
    expect(extra[0].endDate).toBe("2026-06-15");
    // And it carries the name of the month that follows it.
    expect(extra[0].rashi).toBe(2); // Mithuna — Jyeshtha
  });

  it("gives a year without an extra month none", () => {
    expect(lunarMonths(2027).filter((m) => m.adhika)).toHaveLength(0);
  });
});
