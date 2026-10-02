/**
 * Panchang — the astronomy behind the festival calendar.
 *
 * The festivals move every year because they follow the moon and the sun, not
 * the Gregorian calendar: Diwali is the new-moon day of a particular lunar
 * month, Ganesh Chaturthi is the fourth day after one. This module computes
 * those days for any year, so the calendar does not have to be rewritten every
 * January.
 *
 * Everything is computed for the sky over Muscat — the Samithi's own horizon —
 * with the Lahiri (Chitrapaksha) ayanamsa, which is what Indian panchangs use.
 * The sun and moon positions follow Meeus, "Astronomical Algorithms", to well
 * under a hundredth of a degree; a tithi is 12° of elongation, so that is
 * minutes of error, not hours.
 *
 * One honest caveat: near a tithi boundary a panchang printed elsewhere can
 * differ by a day, because different panchangs weigh the "which tithi prevails
 * at sunrise" rule differently. The 2026 dates the Samithi already had are
 * checked against this code in festivals.test.js — the day, month and sequence
 * agree.
 *
 * No dependencies, no network: a few dozen lines of series expansions.
 */

const RAD = Math.PI / 180;
const sin = (deg) => Math.sin(deg * RAD);
const cos = (deg) => Math.cos(deg * RAD);
const norm360 = (deg) => ((deg % 360) + 360) % 360;

/** Muscat: where the Samithi is, and the clock the website shows. */
export const MUSCAT = { lat: 23.588, lon: 58.408, tz: 4 };

/** Lahiri (Chitrapaksha) ayanamsa at J2000.0, and its yearly rate. */
const AYANAMSA_J2000 = 23.85297;
const AYANAMSA_RATE = 50.2879 / 3600; // degrees per year
const J2000 = 2451545.0;

// --- calendar ↔ Julian Day -------------------------------------------------

/** Julian Day at 0h UT for a Gregorian calendar date. */
export function julianDay(year, month, day) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524.5
  );
}

/** The calendar date a Julian Day falls on. */
export function ymdFromJulianDay(jd) {
  const z = Math.floor(jd + 0.5);
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const a = z + 1 + alpha - Math.floor(alpha / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { year, month, day };
}

const pad = (n) => String(n).padStart(2, "0");

/** The date, as the site writes dates: "2026-11-08". */
export function isoFromJulianDay(jd, tz = MUSCAT.tz) {
  const { year, month, day } = ymdFromJulianDay(jd + tz / 24);
  return `${year}-${pad(month)}-${pad(day)}`;
}

// --- the sun and the moon -------------------------------------------------

/** Apparent longitude of the sun, in degrees (Meeus ch. 25). */
export function sunLongitude(jd) {
  const t = (jd - J2000) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(m) +
    (0.019993 - 0.000101 * t) * sin(2 * m) +
    0.000289 * sin(3 * m);
  const omega = 125.04 - 1934.136 * t;
  return norm360(l0 + c - 0.00569 - 0.00478 * sin(omega));
}

/**
 * The moon's main longitude terms (Meeus ch. 47), as
 * [coefficient, D, M, M', F] in units of a millionth of a degree. The power of
 * E that applies to a term is the number of M's in it.
 */
const MOON_TERMS = [
  [6288774, 0, 0, 1, 0], [1274027, 2, 0, -1, 0], [658314, 2, 0, 0, 0],
  [213618, 0, 0, 2, 0], [-185116, 0, 1, 0, 0], [-114332, 0, 0, 0, 2],
  [58793, 2, 0, -2, 0], [57066, 2, -1, -1, 0], [53322, 2, 0, 1, 0],
  [45758, 2, -1, 0, 0], [-40923, 0, 1, -1, 0], [-34720, 1, 0, 0, 0],
  [-30383, 0, 1, 1, 0], [15327, 2, 0, 0, -2], [-12528, 0, 0, 1, 2],
  [10980, 0, 0, 1, -2], [10675, 4, 0, -1, 0], [10034, 0, 0, 3, 0],
  [8548, 4, 0, -2, 0], [-7888, 2, 1, -1, 0], [-6766, 2, 1, 0, 0],
  [-5163, 1, 0, -1, 0], [4987, 1, 1, 0, 0], [4036, 2, -1, 1, 0],
  [3994, 2, 0, 2, 0], [3861, 4, 0, 0, 0], [3665, 2, 0, -3, 0],
  [-2689, 0, 1, -2, 0], [-2602, 2, 0, -1, 2], [2390, 2, -1, -2, 0],
  [-2348, 1, 0, 1, 0], [2236, 2, -2, 0, 0], [-2120, 0, 1, 2, 0],
  [-2069, 0, 2, 0, 0], [2048, 2, -2, -1, 0], [-1773, 2, 0, 1, -2],
  [-1595, 2, 0, 0, 2], [1215, 4, -1, -1, 0], [-1110, 0, 0, 2, 2],
  [-892, 3, 0, -1, 0], [-810, 2, 1, 1, 0], [759, 4, -1, -2, 0],
  [-713, 0, 2, -1, 0], [-700, 2, 2, -1, 0], [691, 2, 1, -2, 0],
  [596, 2, -1, 0, -2], [549, 4, 0, 1, 0], [537, 0, 0, 4, 0],
  [520, 4, -1, 0, 0], [-487, 0, 1, -3, 0], [-399, 1, 1, -1, 0],
  [-381, 0, 0, 4, -2], [351, 0, 0, 2, -2], [-340, 3, 0, -2, 0],
  [330, 2, 1, 0, -2], [327, 4, -1, -1, -2], [-323, 2, -1, 2, 0],
  [299, 1, 1, 1, 0], [294, 2, 0, 3, 0],
];

/** The moon's longitude in degrees (Meeus ch. 47, truncated). */
export function moonLongitude(jd) {
  const t = (jd - J2000) / 36525;
  const lp = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t +
    (t * t * t) / 538841 - (t * t * t * t) / 65194000;
  const d = 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t +
    (t * t * t) / 545868 - (t * t * t * t) / 113065000;
  const m = 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t +
    (t * t * t) / 24490000;
  const mp = 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t +
    (t * t * t) / 69699 - (t * t * t * t) / 14712000;
  const f = 93.272095 + 483202.0175233 * t - 0.0036539 * t * t -
    (t * t * t) / 3526000 + (t * t * t * t) / 863310000;

  const e = 1 - 0.002516 * t - 0.0000074 * t * t;
  let sum = 0;
  for (const [coef, cd, cm, cmp, cf] of MOON_TERMS) {
    const arg = cd * d + cm * m + cmp * mp + cf * f;
    const ecc = Math.abs(cm) === 0 ? 1 : Math.abs(cm) === 1 ? e : e * e;
    sum += coef * ecc * sin(arg);
  }
  // The two additive terms that matter, and the nutation the sun shares.
  const a1 = 119.75 + 131.849 * t;
  const a2 = 53.09 + 479264.29 * t;
  const omega = 125.04 - 1934.136 * t;
  sum += 3958 * sin(a1) + 1962 * sin(lp - f) + 318 * sin(a2);

  return norm360(lp + sum / 1000000 - 0.00478 * sin(omega));
}

/** Lahiri ayanamsa: the gap between the tropical and Indian zodiacs. */
export const ayanamsa = (jd) => AYANAMSA_J2000 + ((jd - J2000) / 365.25) * AYANAMSA_RATE;

/** The sun's longitude in the Indian (sidereal) zodiac — what rashis use. */
export const sunSidereal = (jd) => norm360(sunLongitude(jd) - ayanamsa(jd));

/** How far the moon has moved ahead of the sun: 0° new moon, 180° full moon. */
export const elongation = (jd) => norm360(moonLongitude(jd) - sunLongitude(jd));

/**
 * Tithi, as panchangs number it: 0–29. 0–14 are the bright fortnight
 * (Pratipada … Purnima), 15–29 the dark one, and 29 is Amavasya, the new moon.
 * The difference is the same in either zodiac, so no ayanamsa is needed here.
 */
export const tithiIndex = (jd) => Math.floor(elongation(jd) / 12) % 30;

/** Nakshatra, 0–26, from Ashwini. Thiruvonam is Shravana, 21. */
export const nakshatraIndex = (jd) =>
  Math.floor(norm360(moonLongitude(jd) - ayanamsa(jd)) / (360 / 27)) % 27;

/** Rashi of the sun, 0 = Mesha (Aries) … 11 = Meena (Pisces). */
export const sunRashi = (jd) => Math.floor(sunSidereal(jd) / 30) % 12;

// --- sunrise --------------------------------------------------------------

/** The sun's declination and the equation of time (minutes) at an instant. */
function sunPosition(jd) {
  const t = (jd - J2000) / 36525;
  const l0 = norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(m) +
    (0.019993 - 0.000101 * t) * sin(2 * m) +
    0.000289 * sin(3 * m);
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + c - 0.00569 - 0.00478 * sin(omega);
  const eps0 =
    23 + 26 / 60 + 21.448 / 3600 -
    (46.815 * t + 0.00059 * t * t - 0.001813 * t * t * t) / 3600;
  const eps = eps0 + 0.00256 * cos(omega);
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime =
    (4 *
      (y * sin(2 * l0) -
        2 * e * sin(m) +
        4 * e * y * sin(m) * cos(2 * l0) -
        0.5 * y * y * sin(4 * l0) -
        1.25 * e * e * sin(2 * m))) /
    RAD;
  const dec = Math.asin(sin(eps) * sin(lambda)) / RAD;
  return { dec, eqTime };
}

const HORIZON = -0.833; // refraction + the sun's own half-disc

/**
 * The same sunrise is asked for again and again — by the tithi of one festival,
 * then the next — and a year of festival maths is a few thousand sun positions.
 * They do not change, so they are remembered.
 */
const memoCache = new Map();

function memo(key, compute) {
  const hit = memoCache.get(key);
  if (hit !== undefined) return hit;
  if (memoCache.size > 4000) memoCache.clear();
  const value = compute();
  memoCache.set(key, value);
  return value;
}

const placeKey = (place) => `${place.lat},${place.lon},${place.tz}`;

/** Sunrise and sunset over Muscat, as Julian Days. */
function riseOrSet(year, month, day, rising, place = MUSCAT) {
  const jd0 = julianDay(year, month, day);
  let hours = 6;
  for (let i = 0; i < 3; i += 1) {
    const { dec, eqTime } = sunPosition(jd0 + hours / 24);
    const transit = 12 - place.lon / 15 - eqTime / 60; // local solar noon, UT
    const cosH =
      (sin(HORIZON) - sin(place.lat) * sin(dec)) / (cos(place.lat) * cos(dec));
    const h = Math.acos(Math.min(1, Math.max(-1, cosH))) / RAD / 15; // hours
    hours = rising ? transit - h : transit + h;
  }
  return jd0 + hours / 24;
}

/**
 * Sunrise over Muscat, as a Julian Day — computed three times over so the
 * sun's own drift during the night is accounted for.
 */
export const sunriseJD = (year, month, day, place = MUSCAT) =>
  memo(`rise:${year}-${month}-${day}@${placeKey(place)}`, () =>
    riseOrSet(year, month, day, true, place)
  );

/** Sunset over Muscat, as a Julian Day. */
export const sunsetJD = (year, month, day, place = MUSCAT) =>
  memo(`set:${year}-${month}-${day}@${placeKey(place)}`, () =>
    riseOrSet(year, month, day, false, place)
  );

/** Which tithi is running at sunrise on this date — how a panchang names a day. */
export const tithiAtSunrise = (year, month, day, place = MUSCAT) =>
  tithiIndex(sunriseJD(year, month, day, place));

const isoOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** A calendar date walked forward by whole days, via Julian Days. */
function addDays(year, month, day, days) {
  const { year: y, month: m, day: d } = ymdFromJulianDay(julianDay(year, month, day) + days);
  return { year: y, month: m, day: d };
}

// --- sankrantis -----------------------------------------------------------

/**
 * The instant the sun enters a rashi — a sankranti. Bisection on the sun's
 * sidereal longitude: it climbs steadily, so the crossing of a 30° boundary is
 * a single well-behaved root.
 */
export function sankrantiJD(rashi, fromJD) {
  const f = (jd) => {
    let d = sunSidereal(jd) - rashi * 30;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  };
  let lo = fromJD;
  let hi = fromJD + 1;
  for (let guard = 0; guard < 400 && f(hi) < 0; guard += 1) {
    lo = hi;
    hi += 1;
  }
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The instant of the new moon after `jd`. The elongation climbs steadily from
 * 0° to 360° and wraps, so the crossing is a single well-behaved root.
 */
export function nextNewMoon(jd) {
  const f = (x) => elongation(x);
  let lo = jd;
  let hi = jd + 1;
  while (hi - lo < 32 && f(hi) > f(lo)) {
    lo = hi;
    hi += 1;
  }
  // lo is the last day before the wrap, hi the first after.
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) > f(lo)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The lunar months around a year, as a panchang names them.
 *
 * An amanta month runs from one new moon to the next, and takes the name of
 * the rashi whose sankranti falls inside it. Every few years a month contains
 * no sankranti at all — an intercalary (adhika) month. It carries the name of
 * the month that follows it, so an Adhika Shravana is followed by the nija
 * (true) Shravana, and a festival belongs to the nija one.
 */
export function lunarMonths(year) {
  return memo(`months:${year}`, () => buildLunarMonths(year));
}

function buildLunarMonths(year) {
  const months = [];
  let nm = nextNewMoon(julianDay(year - 1, 11, 1));
  for (let i = 0; i < 18; i += 1) {
    const next = nextNewMoon(nm + 1);
    months.push({
      start: nm,
      end: next,
      startDate: isoFromJulianDay(nm),
      endDate: isoFromJulianDay(next),
      sankrantis: [],
      adhika: false,
      rashi: null,
    });
    nm = next;
  }

  // Which rashis does the sun enter during each month?
  for (const month of months) {
    let previous = sunRashi(month.start + 0.001);
    for (let jd = month.start + 0.25; jd < month.end; jd += 0.25) {
      const rashi = sunRashi(jd);
      if (rashi !== previous) {
        month.sankrantis.push(rashi);
        previous = rashi;
      }
    }
  }

  // A month with no sankranti is adhika, and takes the next month's name.
  for (let i = months.length - 1; i >= 0; i -= 1) {
    const month = months[i];
    if (month.sankrantis.length) {
      month.rashi = month.sankrantis[month.sankrantis.length - 1];
    } else {
      month.adhika = true;
      month.rashi = months[i + 1] ? months[i + 1].rashi : null;
    }
  }
  return months;
}

// --- the day a festival falls on -----------------------------------------

/**
 * When in the day a tithi is looked for — how many hours after sunrise. Which
 * one applies is a matter of tradition, and the Samithi's own list settles it:
 * most festivals are kept on the day the tithi is running at sunrise, but
 * Diwali and Dhanteras are evening festivals, Shivaratri is kept overnight,
 * and Akshaya Tritiya and Vijayadashami are kept on the day the tithi covers
 * midday, even when sunrise still belongs to the previous one.
 */
const SAMPLE = {
  sunrise: (date) => sunriseJD(date.year, date.month, date.day),
  midday: (date) => {
    const rise = sunriseJD(date.year, date.month, date.day);
    return rise + (sunsetJD(date.year, date.month, date.day) - rise) / 2;
  },
  // Pradosh kaal — the first hours of the evening, when lamps are lit.
  sunset: (date) => sunsetJD(date.year, date.month, date.day) + 0.75 / 24,
  // Nishita kaal — the midnight that follows the day, when Shivaratri is kept.
  midnight: (date) =>
    julianDay(date.year, date.month, date.day) + 1 - MUSCAT.tz / 24,
};

/** Is `tithi` running at the given point of the day on this date? */
function tithiOnDay(date, tithi, when = "sunrise") {
  return tithiIndex((SAMPLE[when] || SAMPLE.sunrise)(date)) === tithi;
}

/**
 * The instant a tithi begins, at or after `fromJD` — the elongation reaching
 * its starting edge. Tithis run 12° apart, so this is a single root.
 */
export function tithiStartJD(tithi, fromJD) {
  if (tithi === 0) return nextNewMoon(fromJD - 1);

  const target = tithi * 12;
  // Close to the crossing the difference is small, so wrapping it to ±180°
  // says plainly which side we are on.
  const diff = (jd) => {
    let d = elongation(jd) - target;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  };

  const anchor = nextNewMoon(fromJD - 1);
  let lo = anchor + ((tithi - 1) / 30) * 29.53;
  let hi = anchor + ((tithi + 1) / 30) * 29.53;
  for (let guard = 0; guard < 12 && diff(lo) > 0; guard += 1) lo -= 0.5;
  for (let guard = 0; guard < 24 && diff(hi) < 0; guard += 1) hi += 0.5;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (diff(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The day a tithi falls on when it never touches a sunrise.
 *
 * A tithi that begins and ends between one sunrise and the next — a kshaya
 * tithi, which happens once or twice a year — still has a day: the one it
 * begins in. Vasant Panchami 2025 and Ganesh Chaturthi 2027 are both kept on
 * such a day.
 */
function skippedTithiDay(month, tithi) {
  // The month begins at a new moon, so a few hours in the elongation is just
  // past 0 and every tithi of the month lies ahead.
  const start = tithi === 0 ? month.start : tithiStartJD(tithi, month.start + 0.25);
  if (start < month.start || start >= month.end) return "";
  const date = ymdFromJulianDay(start);
  // Walk back to sunrise of the day the tithi began in.
  let cursor = date;
  while (true) {
    const before = addDays(cursor.year, cursor.month, cursor.day, -1);
    if (sunriseJD(before.year, before.month, before.day) > start) cursor = before;
    else return isoOf(cursor.year, cursor.month, cursor.day);
  }
}

/**
 * The lunar month a festival belongs to: the one whose sankranti into `rashi`
 * falls inside it — the nija (true) month, not an intercalary copy of it.
 */
function monthsForRashi(year, rashi) {
  const months = lunarMonths(year);
  const nija = months.filter(
    (month) => month.rashi === rashi && month.sankrantis.includes(rashi)
  );
  const any = months.filter((month) => month.rashi === rashi);
  return nija.length ? nija : any;
}

/**
 * Resolve a festival rule to a date in the given year.
 *
 * Rules, in the words the panchang uses:
 *   · `tithi` + `rashi`  — that tithi of the lunar month named by that rashi
 *                          (Ganesh Chaturthi: fourth day of Bhadrapada).
 *   · `sankranti`        — the day the sun enters that rashi (Makar Sankranti).
 *   · `nakshatra` + `month` — that nakshatra while the sun is in a solar month
 *                          (Onam: Thiruvonam in Chingam).
 *
 * `when` picks the point of the day the tithi must cover, `pick` settles a day
 * the tithi covers twice ("first" by default — "last" for the new-moon days,
 * which belong to the month they end), and `plusDays` moves a festival whose
 * celebration falls the day after the tithi — Holi, which is played the
 * morning after the Purnima night.
 */
export function festivalDate(rule, year) {
  if (!rule) return "";

  if (Number.isInteger(rule.sankranti)) {
    // Sankranti is an instant, and the day it is kept runs sunrise to sunrise.
    const jd = sankrantiJD(rule.sankranti, julianDay(year, 1, 1) - 2);
    let cursor = ymdFromJulianDay(jd - 1);
    for (let guard = 0; guard < 4; guard += 1) {
      const start = sunriseJD(cursor.year, cursor.month, cursor.day);
      const next = addDays(cursor.year, cursor.month, cursor.day, 1);
      if (jd >= start && jd < sunriseJD(next.year, next.month, next.day)) {
        return isoOf(cursor.year, cursor.month, cursor.day);
      }
      cursor = jd < start ? addDays(cursor.year, cursor.month, cursor.day, -1) : next;
    }
    return "";
  }

  if (Number.isInteger(rule.nakshatra) && Number.isInteger(rule.month)) {
    let cursor = { year, month: 1, day: 1 };
    for (let guard = 0; guard < 370; guard += 1) {
      const jd = sunriseJD(cursor.year, cursor.month, cursor.day);
      if (sunRashi(jd) === rule.month && nakshatraIndex(jd) === rule.nakshatra) {
        return isoOf(cursor.year, cursor.month, cursor.day);
      }
      cursor = addDays(cursor.year, cursor.month, cursor.day, 1);
    }
    return "";
  }

  if (Number.isInteger(rule.tithi) && Number.isInteger(rule.rashi)) {
    const found = [];
    for (const month of monthsForRashi(year, rule.rashi)) {
      const days = [];
      let cursor = ymdFromJulianDay(month.start + 0.5);
      // A lunar month's days are the days that begin (at sunrise) inside it:
      // the amavasya day that the month starts on belongs to the month before.
      for (;;) {
        const rise = sunriseJD(cursor.year, cursor.month, cursor.day);
        if (rise >= month.end) break;
        if (rise >= month.start && tithiOnDay(cursor, rule.tithi, rule.when)) {
          days.push(isoOf(cursor.year, cursor.month, cursor.day));
        }
        cursor = addDays(cursor.year, cursor.month, cursor.day, 1);
      }
      if (!days.length) {
        const skipped = skippedTithiDay(month, rule.tithi);
        if (skipped && skipped.slice(0, 4) === String(year)) found.push(skipped);
        continue;
      }
      const day = rule.pick === "last" ? days[days.length - 1] : days[0];
      if (day.slice(0, 4) === String(year)) found.push(day);
    }
    if (!found.length) return "";
    const day = found[0];
    if (!rule.plusDays) return day;
    const [y, m, d] = day.split("-").map(Number);
    const moved = addDays(y, m, d, rule.plusDays);
    return isoOf(moved.year, moved.month, moved.day);
  }

  return "";
}
