/**
 * The Samithi's festival dates — worked out, not typed in.
 *
 * The festivals move every year: Diwali is the new-moon day of one particular
 * lunar month, Ganesh Chaturthi is the fourth day after another, Makar
 * Sankranti is the day the sun changes sign. So the dates in the calendar are
 * computed from the sky over Muscat by `panchang.js`, for whatever year is on
 * screen, and nothing needs updating in January.
 *
 * What lives here is the *rule* for each festival, written out the way a
 * panchang states it — which lunar month, which tithi, and which part of the
 * day it is kept in. The names, descriptions and translations stay in
 * `src/data/content.js`, matched up by the same ids (`fc1`…), so the text is
 * still all in one place.
 *
 * The rules were checked against the 28 dates the Samithi already had for
 * 2026: 27 agree to the day, and the one that does not — Jyeshtha Purnima —
 * was listed on a new-moon day, not a full moon. `festivals.test.js` holds
 * both the 2026 table and a few structural checks for later years.
 *
 * If a date ever lands a day away from what the temple observes, the fix is a
 * line in this table, not a new year's list: most often it is the part of the
 * day (`when`) or which of two days the tithi covers (`pick`).
 */

import { festivalDate } from "./panchang.js";

// Tithis, numbered the way a panchang numbers them: 1–15 of the bright
// fortnight, 1–15 of the dark one, with the full moon and new moon named.
const SHUKLA = (n) => n - 1;
const KRISHNA = (n) => n + 14;
const PURNIMA = 14;
const AMAVASYA = 29;

// Rashis (signs), 0 = Mesha (Aries) … 11 = Meena (Pisces).
const MESHA = 0;
const VRISHABHA = 1;
const MITHUNA = 2;
const KARKA = 3;
const SIMHA = 4;
const KANYA = 5;
const TULA = 6;
const VRISCHIKA = 7;
const DHANU = 8;
const MAKARA = 9;
const KUMBHA = 10;
const MEENA = 11;

/**
 * One entry per festival in the calendar. Read them as a panchang reads:
 * "Ganesh Chaturthi: Bhadrapada, Shukla Chaturthi, on the day the tithi covers
 * midday."
 */
export const FESTIVAL_RULES = {
  // The sun enters Makara — kept on the day the entry falls in.
  fc1: { sankranti: MAKARA },
  // Magha, Shukla Panchami.
  fc2: { tithi: SHUKLA(5), rashi: KUMBHA },
  // Magha, Krishna Chaturdashi — a night-long vigil, so kept at midnight.
  fc3: { tithi: KRISHNA(14), rashi: KUMBHA, when: "midnight" },
  // The day after the Phalguna full moon: the morning the colours are played.
  fc4: { tithi: PURNIMA, rashi: MEENA, plusDays: 1 },
  // Chaitra, Shukla Pratipada — the new year.
  fc5: { tithi: SHUKLA(1), rashi: MESHA },
  // Chaitra, Shukla Navami.
  fc6: { tithi: SHUKLA(9), rashi: MESHA },
  // Chaitra Purnima — Anjaneya Swamy's birthday.
  fc7: { tithi: PURNIMA, rashi: MESHA, pick: "last" },
  // Vaishakha, Shukla Tritiya — the tithi often begins after sunrise, so the
  // day is the one it covers at midday.
  fc8: { tithi: SHUKLA(3), rashi: VRISHABHA, when: "midday" },
  // Vaishakha Purnima.
  fc9: { tithi: PURNIMA, rashi: VRISHABHA },
  // Jyeshtha Purnima.
  fc10: { tithi: PURNIMA, rashi: MITHUNA },
  // Ashada, Shukla Dwitiya.
  fc11: { tithi: SHUKLA(2), rashi: KARKA },
  // Ashada Purnima.
  fc12: { tithi: PURNIMA, rashi: KARKA },
  // Thiruvonam (Shravana) while the sun is in Chingam (Simha) — Onam.
  fc13: { nakshatra: 21, month: SIMHA },
  // Shravana Purnima.
  fc14: { tithi: PURNIMA, rashi: SIMHA },
  // Shravana, Krishna Ashtami — Sri Krishna's birth, kept at midnight.
  fc15: { tithi: KRISHNA(8), rashi: SIMHA },
  // Bhadrapada, Shukla Chaturthi — the day the tithi covers midday, as the
  // moonrise rule requires.
  fc16: { tithi: SHUKLA(4), rashi: KANYA, when: "midday" },
  // Bhadrapada, Shukla Chaturdashi.
  fc17: { tithi: SHUKLA(14), rashi: KANYA },
  // Bhadrapada Amavasya — the new moon that ends the month.
  fc18: { tithi: AMAVASYA, rashi: KANYA, pick: "last" },
  // Ashwina, Shukla Pratipada — the nine nights begin.
  fc19: { tithi: SHUKLA(1), rashi: TULA },
  // Ashwina, Shukla Dashami — kept on the day the tithi covers midday.
  fc20: { tithi: SHUKLA(10), rashi: TULA, when: "midday" },
  // Ashwina, Krishna Chaturthi.
  fc21: { tithi: KRISHNA(4), rashi: TULA },
  // Ashwina, Krishna Trayodashi — the first lamps, lit in the evening.
  fc22: { tithi: KRISHNA(13), rashi: TULA, when: "sunset" },
  // Ashwina Amavasya — Lakshmi Puja in the evening, as Deepavali is kept.
  fc23: { tithi: AMAVASYA, rashi: TULA, when: "sunset", pick: "last" },
  // Kartika, Shukla Pratipada.
  fc24: { tithi: SHUKLA(1), rashi: VRISCHIKA },
  // Kartika, Shukla Dwitiya.
  fc25: { tithi: SHUKLA(2), rashi: VRISCHIKA },
  // Kartika, Shukla Shashthi.
  fc26: { tithi: SHUKLA(6), rashi: VRISCHIKA },
  // Kartika Purnima.
  fc27: { tithi: PURNIMA, rashi: VRISCHIKA },
  // Margashirsha, Shukla Ekadashi — the Bhagavad Gita's day.
  fc28: { tithi: SHUKLA(11), rashi: DHANU },
};

/** The date of one festival in one year ("" when a rule has no answer). */
export const festivalDateFor = (id, year) => festivalDate(FESTIVAL_RULES[id], year);

// A catalogue is asked for its years again on every render and every month the
// visitor pages through, and each year costs a few thousand sunrise
// calculations. One answer per catalogue per year is enough.
const dated = new WeakMap();

/** The festival list with `date` filled in for the given year. */
export function festivalsForYear(catalog = [], year = new Date().getFullYear()) {
  let years = dated.get(catalog);
  if (!years) {
    years = new Map();
    dated.set(catalog, years);
  }
  if (years.has(year)) return years.get(year);

  const list = catalog.map((festival) => ({
    ...festival,
    date: festivalDateFor(festival.id, year),
  }));
  years.set(year, list);
  return list;
}
