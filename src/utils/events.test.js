import { describe, expect, it } from "vitest";
import { translations } from "../data/content.js";
import { dateOnly } from "./calendar.js";
import {
  DEFAULT_VENUE,
  EVENT_TITLES,
  TITLE_EN,
  eventRowFromForm,
  mapEventRow,
  mergeEvents,
  rollDates,
  titleKnFor,
} from "./events.js";

describe("the three programs", () => {
  it("names them exactly as the site's own list does", () => {
    // The dropdown and the curated list must agree, in both languages, or the
    // site would show one wording and the dashboard another.
    for (const lang of ["en", "kn"]) {
      const curated = translations[lang].eventsList.map((e) => e.title);
      expect(curated).toEqual(EVENT_TITLES.map((t) => t[lang]));
    }
  });

  it("uses the temple as the venue, in both languages", () => {
    expect(DEFAULT_VENUE.en).toBe(translations.en.eventsList[0].venue);
    expect(DEFAULT_VENUE.kn).toBe(translations.kn.eventsList[0].venue);
  });

  it("pairs each English name with its Kannada one", () => {
    expect(titleKnFor("Omkar Jnanamrutha")).toBe("ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ");
    expect(titleKnFor("Sri Anjaneya Pooje")).toBe("ಶ್ರೀ ಆಂಜನೇಯ ಪೂಜೆ");
    expect(titleKnFor("Something else")).toBe("");
  });

  it("offers exactly the three English titles", () => {
    expect(TITLE_EN).toEqual([
      "Omkar Jnanamrutha",
      "Omkar Naadamrutha",
      "Sri Anjaneya Pooje",
    ]);
  });
});

describe("mapEventRow — a database row as the site needs it", () => {
  const row = {
    id: "abc",
    title_en: "Omkar Jnanamrutha",
    title_kn: "ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ",
    description_en: "Smt. Amrutha Naidu",
    description_kn: "ಶ್ರೀಮತಿ ಅಮೃತಾ ನಾಯ್ಡು",
    starts_at: "2026-10-27T00:00:00+00:00",
    location_en: null,
    location_kn: null,
  };

  it("keeps the calendar date exactly as stored, with no timezone drift", () => {
    // 27 October must read as 27 October in Muscat, not slip to the 26th.
    expect(mapEventRow(row, "en").date).toBe("2026-10-27");
  });

  it("picks the language asked for", () => {
    expect(mapEventRow(row, "en").title).toBe("Omkar Jnanamrutha");
    expect(mapEventRow(row, "kn").title).toBe("ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ");
    expect(mapEventRow(row, "kn").guest).toBe("ಶ್ರೀಮತಿ ಅಮೃತಾ ನಾಯ್ಡು");
  });

  it("falls back to English when a Kannada value is missing", () => {
    const partial = { ...row, title_kn: null, description_kn: null };
    expect(mapEventRow(partial, "kn").title).toBe("Omkar Jnanamrutha");
    expect(mapEventRow(partial, "kn").guest).toBe("Smt. Amrutha Naidu");
  });

  it("uses the temple as the venue when the row has none", () => {
    expect(mapEventRow(row, "en").venue).toBe(DEFAULT_VENUE.en);
    expect(mapEventRow(row, "kn").venue).toBe(DEFAULT_VENUE.kn);
  });

  it("leaves the date empty when none is set — the site then shows TBA", () => {
    const undated = mapEventRow({ ...row, starts_at: null }, "en");
    expect(undated.date).toBe("");
    expect(undated.guest).toBe("Smt. Amrutha Naidu");
  });

  it("has no guest when none is named", () => {
    const noGuest = { ...row, description_en: null, description_kn: null };
    expect(mapEventRow(noGuest, "en").guest).toBeNull();
  });
});

describe("eventRowFromForm — the simplified form as a database row", () => {
  const form = {
    title_en: "Omkar Naadamrutha",
    title_kn: "",
    starts_at: "",
    guest_en: "  Sri Rahul Vellal  ",
    guest_kn: "",
    published: true,
  };

  it("fills the Kannada title in from the English one", () => {
    expect(eventRowFromForm(form).title_kn).toBe("ಓಂಕಾರ ನಾದಾಮೃತ");
  });

  it("stores guest names in the description columns, trimmed", () => {
    const row = eventRowFromForm(form);
    expect(row.description_en).toBe("Sri Rahul Vellal");
    expect(row.description_kn).toBeNull();
  });

  it("always sets the temple as the venue, so nobody types it", () => {
    const row = eventRowFromForm(form);
    expect(row.location_en).toBe(DEFAULT_VENUE.en);
    expect(row.location_kn).toBe(DEFAULT_VENUE.kn);
  });

  it("clears the date label — an undated event shows TBA by itself", () => {
    const row = eventRowFromForm(form);
    expect(row.date_label_en).toBeNull();
    expect(row.date_label_kn).toBeNull();
    expect(row.starts_at).toBeNull();
  });

  it("stores a chosen date as a timestamp", () => {
    const row = eventRowFromForm({ ...form, starts_at: "2026-10-27" });
    expect(row.starts_at).toBe("2026-10-27T00:00:00.000Z");
    expect(dateOnly(row.starts_at)).toBe("2026-10-27");
  });

  it("sends no link, and never a sort order to fight over", () => {
    const row = eventRowFromForm({ ...form, url: "https://example.com", sort_order: 9 });
    expect(row.url).toBeNull();
    expect(row.sort_order).toBeUndefined();
  });

  it("keeps the publish choice", () => {
    expect(eventRowFromForm({ ...form, published: false }).published).toBe(false);
    expect(eventRowFromForm({ ...form, published: undefined }).published).toBe(false);
  });
});

describe("mergeEvents — the dashboard laid over the curated list", () => {
  const curated = translations.en.eventsList;
  const row = (over = {}) => ({
    id: "row-1",
    title_en: "Omkar Naadamrutha",
    title_kn: "ಓಂಕಾರ ನಾದಾಮೃತ",
    description_en: null,
    description_kn: null,
    starts_at: null,
    location_en: null,
    location_kn: null,
    ...over,
  });

  it("changes nothing when the database is empty", () => {
    expect(mergeEvents(curated, [], "en")).toBe(curated);
    expect(mergeEvents(curated, null, "en")).toBe(curated);
  });

  it("sets one programme's date without disturbing the other two", () => {
    const merged = mergeEvents(curated, [row({ starts_at: "2026-11-15T00:00:00+00:00" })], "en");
    expect(merged).toHaveLength(3);
    expect(merged.find((e) => e.title === "Omkar Naadamrutha").date).toBe("2026-11-15");
    expect(merged.find((e) => e.title === "Omkar Jnanamrutha").date).toBe("2026-04-01");
    expect(merged.find((e) => e.title === "Sri Anjaneya Pooje").date).toBe("2026-12-18");
  });

  it("shows TBA when the date has been cleared in the dashboard", () => {
    // The row is the Samithi's word on the date: no date means it has not been
    // announced, so the site must not resurrect the built-in one.
    const merged = mergeEvents(curated, [row()], "en");
    expect(merged.find((e) => e.title === "Omkar Naadamrutha").date).toBe("");
  });

  it("keeps the curated guest when the row does not name one", () => {
    // The Samithi sets the date this month and the guest's name later.
    const merged = mergeEvents(curated, [row({ starts_at: "2026-11-15T00:00:00+00:00" })], "en");
    const naadamrutha = merged.find((e) => e.title === "Omkar Naadamrutha");
    expect(naadamrutha.guest).toBe("Guest TBA");
  });

  it("takes the new guest name when one is given", () => {
    const merged = mergeEvents(curated, [row({ description_en: "Sri Rahul Vellal" })], "en");
    expect(merged.find((e) => e.title === "Omkar Naadamrutha").guest).toBe("Sri Rahul Vellal");
  });

  it("keeps the curated id, so nobody's reminder is lost", () => {
    const merged = mergeEvents(curated, [row({ starts_at: "2026-11-15T00:00:00+00:00" })], "en");
    expect(merged.find((e) => e.title === "Omkar Naadamrutha").id).toBe("e2");
  });

  it("merges the Kannada list in Kannada", () => {
    const merged = mergeEvents(
      translations.kn.eventsList,
      [row({ starts_at: "2026-11-15T00:00:00+00:00", description_kn: "ಶ್ರೀ ರಾಹುಲ್ ವೆಲ್ಲಾಲ್" })],
      "kn"
    );
    const found = merged.find((e) => e.title === "ಓಂಕಾರ ನಾದಾಮೃತ");
    expect(found.date).toBe("2026-11-15");
    expect(found.guest).toBe("ಶ್ರೀ ರಾಹುಲ್ ವೆಲ್ಲಾಲ್");
  });

  it("appends a programme it does not recognise rather than dropping it", () => {
    const merged = mergeEvents(curated, [row({ title_en: "Omkar Jnanamrutha 2027" })], "en");
    expect(merged).toHaveLength(4);
    expect(merged[3].title).toBe("Omkar Jnanamrutha 2027");
  });

  it("shows TBA for a programme that has no date anywhere", () => {
    const merged = mergeEvents(curated, [row()], "en");
    const blank = mergeEvents(
      [{ id: "x", date: "", day: "—", mon: "", title: "Omkar Naadamrutha", guest: null, venue: "V" }],
      [row()],
      "en"
    );
    expect(merged.find((e) => e.title === "Omkar Naadamrutha").date).toBe("");
    expect(blank[0].date).toBe("");
  });
});

describe("rollDates — the programs repeat every year", () => {
  const at = (iso) => new Date(`${iso}T12:00:00`);
  const curated = translations.en.eventsList;

  it("moves stored dates onto this year's occurrence", () => {
    const rolled = rollDates(curated, at("2027-02-01"));
    expect(rolled.map((e) => e.date)).toEqual(["2027-04-01", "2027-10-02", "2027-12-18"]);
  });

  it("leaves this year's dates exactly as they are", () => {
    const rolled = rollDates(curated, at("2026-06-01"));
    expect(rolled.map((e) => e.date)).toEqual(curated.map((e) => e.date));
  });

  it("keeps a program with no date empty — TBA stays TBA", () => {
    const rolled = rollDates([{ id: "x", date: "" }], at("2027-02-01"));
    expect(rolled[0].date).toBe("");
  });

  it("leaves a date the Samithi set for a future year alone", () => {
    const rolled = rollDates([{ id: "x", date: "2028-04-01" }], at("2027-02-01"));
    expect(rolled[0].date).toBe("2028-04-01");
  });

  it("rolls a dashboard date the same way the built-in list rolls", () => {
    const rows = [{ id: "row-1", title_en: "Omkar Naadamrutha", starts_at: "2026-11-15T00:00:00+00:00" }];
    const merged = rollDates(mergeEvents(curated, rows, "en"), at("2027-02-01"));
    expect(merged.find((e) => e.title === "Omkar Naadamrutha").date).toBe("2027-11-15");
  });
});
