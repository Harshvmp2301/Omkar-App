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
  nextEvent,
  rollDates,
  sortedByDate,
  titleKnFor,
  upcomingEvents,
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

describe("rollDates — the same-year view the lamps and calendar use", () => {
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

  it("keeps a date that has already passed in this year — the lamps need it", () => {
    // 8 October 2026: the April programme has happened. Its lamp stays lit to
    // the end of the year (PR #8's rule), and diyaLit() reads the same-year
    // occurrence to work that out — so rollDates must NOT roll it forward.
    // The program LIST is the thing that rolls, and it does not use this
    // function: see upcomingEvents below.
    const rolled = rollDates(curated, at("2026-10-08"));
    expect(rolled.map((e) => e.date)).toEqual(["2026-04-01", "2026-10-02", "2026-12-18"]);
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

describe("upcomingEvents — the list the program rows render", () => {
  const at = (iso) => new Date(`${iso}T12:00:00`);
  const curated = translations.en.eventsList;

  it("keeps a program that is still ahead on this year's date", () => {
    // 7 October 2026: Anjaneya Pooje in December has not happened yet.
    const upcoming = upcomingEvents(curated, at("2026-10-07"));
    expect(upcoming.find((e) => e.title === "Sri Anjaneya Pooje").date).toBe("2026-12-18");
  });

  it("drops a program that has happened instead of inventing next year", () => {
    // The defect this replaces: on 10 October 2026 the list showed Jnanamrutha
    // as 1 April 2027 and Naadamrutha as 2 October 2027 — years nobody had
    // entered — while the dashboard correctly said 01 Apr 2026 / 02 Oct 2026.
    const upcoming = upcomingEvents(curated, at("2026-10-08"));
    expect(upcoming.map((e) => e.title)).toEqual(["Sri Anjaneya Pooje"]);
    expect(upcoming[0].date).toBe("2026-12-18");
  });

  it("counts today as still ahead, so the day itself is not skipped", () => {
    // On the morning of the programme, the row must read "today" rather than
    // jumping a whole year forward.
    const upcoming = upcomingEvents(curated, at("2026-12-18"));
    expect(upcoming.find((e) => e.title === "Sri Anjaneya Pooje").date).toBe("2026-12-18");
    expect(upcoming.find((e) => e.title === "Omkar Jnanamrutha")).toBeUndefined();
  });

  it("shows nothing at all once every stored date is past", () => {
    // 5 January 2027 and the dashboard has not entered the new year's dates
    // yet: the honest answer is an empty list — and one plain line on the
    // page — not April 2027 by arithmetic.
    expect(upcomingEvents(curated, at("2027-01-05"))).toEqual([]);
  });

  it("sorts by next date, so the list reads as what is ahead", () => {
    // Dec 2026 first, then the two 2027 dates — not the stored order.
    const stored = [
      { id: "n", title: "Omkar Naadamrutha", date: "2027-10-02" },
      { id: "a", title: "Sri Anjaneya Pooje", date: "2026-12-18" },
      { id: "j", title: "Omkar Jnanamrutha", date: "2027-04-01" },
    ];
    const upcoming = upcomingEvents(stored, at("2026-10-08"));
    expect(upcoming.map((e) => e.date)).toEqual(["2026-12-18", "2027-04-01", "2027-10-02"]);
    expect(upcoming.map((e) => e.title)).toEqual([
      "Sri Anjaneya Pooje",
      "Omkar Jnanamrutha",
      "Omkar Naadamrutha",
    ]);
  });

  it("never returns a date in the past, on any day of the year", () => {
    for (let day = 1; day <= 28; day += 1) {
      for (const month of ["01", "04", "10", "12"]) {
        const now = at(`2026-${month}-${String(day).padStart(2, "0")}`);
        const today = dateOnly(now.toISOString());
        for (const event of upcomingEvents(curated, now)) {
          expect(event.date >= today).toBe(true);
        }
      }
    }
  });

  it("keeps an undated program undated, at the end of the list", () => {
    const mixed = [
      { id: "x", title: "No date yet", date: "" },
      { id: "e2", title: "Omkar Naadamrutha", date: "2026-10-02" },
      { id: "e3", title: "Sri Anjaneya Pooje", date: "2026-12-18" },
    ];
    const upcoming = upcomingEvents(mixed, at("2026-10-08"));
    expect(upcoming.map((e) => e.title)).toEqual(["Sri Anjaneya Pooje", "No date yet"]);
    expect(upcoming[1].date).toBe("");
  });

  it("leaves a date the Samithi set for a future year alone", () => {
    const upcoming = upcomingEvents([{ id: "x", date: "2028-04-01" }], at("2026-10-08"));
    expect(upcoming[0].date).toBe("2028-04-01");
  });

  it("does not mutate the list it was given", () => {
    const before = JSON.stringify(curated);
    upcomingEvents(curated, at("2026-10-08"));
    expect(JSON.stringify(curated)).toBe(before);
  });

  it("agrees with nextEvent — the homepage and the first row cannot disagree", () => {
    for (const iso of ["2026-10-07", "2026-12-18"]) {
      const featured = nextEvent(curated, at(iso));
      const firstDated = upcomingEvents(curated, at(iso)).find((e) => e.date);
      expect(featured.title).toBe(firstDated.title);
      expect(featured.date).toBe(firstDated.date);
    }
  });

  it("stays empty-handed together with nextEvent when nothing is ahead", () => {
    expect(upcomingEvents(curated, at("2026-12-20")).find((e) => e.date)).toBeUndefined();
    expect(nextEvent(curated, at("2026-12-20"))).toBeNull();
  });

  it("rolls a dashboard date through the merge the same way", () => {
    const rows = [
      { id: "row-1", title_en: "Omkar Naadamrutha", starts_at: "2026-10-02T00:00:00+00:00" },
    ];
    const merged = mergeEvents(curated, rows, "en");
    const upcoming = upcomingEvents(merged, at("2026-10-08"));
    // the dashboard row's own date has passed, so it leaves the public list
    expect(upcoming.find((e) => e.title === "Omkar Naadamrutha")).toBeUndefined();
    expect(upcoming.find((e) => e.title === "Sri Anjaneya Pooje").date).toBe("2026-12-18");
  });
});

describe("sortedByDate — the year's record the Events tab renders", () => {
  const at = (iso) => new Date(`${iso}T12:00:00`);
  void at;

  it("keeps every program, past ones included, at the stored date", () => {
    const stored = [
      { id: "n", title: "Omkar Naadamrutha", date: "2026-10-02" },
      { id: "a", title: "Sri Anjaneya Pooje", date: "2026-12-18" },
      { id: "j", title: "Omkar Jnanamrutha", date: "2026-04-01" },
    ];
    expect(sortedByDate(stored).map((e) => e.date)).toEqual([
      "2026-04-01",
      "2026-10-02",
      "2026-12-18",
    ]);
  });

  it("puts undated programs last, and never rewrites a date", () => {
    const stored = [
      { id: "x", title: "No date yet", date: "" },
      { id: "j", title: "Omkar Jnanamrutha", date: "2025-04-01" },
    ];
    const record = sortedByDate(stored);
    expect(record.map((e) => e.title)).toEqual(["Omkar Jnanamrutha", "No date yet"]);
    expect(record[0].date).toBe("2025-04-01");
  });
});

describe("the record and the upcoming list speak both languages", () => {
  it("carries the Events heading and the Held chip in English and Kannada", () => {
    expect(translations.en.allPrograms).toBeTruthy();
    expect(translations.kn.allPrograms).toBeTruthy();
    expect(translations.en.held).toBeTruthy();
    expect(translations.kn.held).toBeTruthy();
  });
});

describe("the old Darsait spelling that is still stored in the database", () => {
  const typo = "ದಾರ್ಸೈತ್";
  const row = {
    id: "row-1",
    title_en: "Sri Anjaneya Pooje",
    title_kn: "ಶ್ರೀ ಆಂಜನೇಯ ಪೂಜೆ",
    starts_at: "2026-12-18T00:00:00+00:00",
    // Exactly what the dashboard wrote into this column before the spelling
    // was settled — a published row still holding it must not show it.
    location_kn: "ಶ್ರೀ ಕೃಷ್ಣ ದೇವಸ್ಥಾನ, ದಾರ್ಸೈತ್, ಮಸ್ಕತ್",
  };

  it("corrects a venue saved before the spelling was settled", () => {
    expect(mapEventRow(row, "kn").venue).toBe(DEFAULT_VENUE.kn);
  });

  it("corrects it through the merge, so the public card is clean", () => {
    const merged = mergeEvents(translations.kn.eventsList, [row], "kn");
    const anjaneya = merged.find((e) => e.title === "ಶ್ರೀ ಆಂಜನೇಯ ಪೂಜೆ");
    expect(anjaneya.venue).toBe(DEFAULT_VENUE.kn);
    expect(merged.every((e) => !e.venue.includes(typo))).toBe(true);
  });

  it("writes only the correct spelling back, even if it was typed wrong", () => {
    const saved = eventRowFromForm({
      title_en: "Omkar Naadamrutha",
      guest_kn: "ದಾರ್ಸೈತ್ ಬಳಿಯ ಭಕ್ತರು",
    });
    expect(saved.location_kn).toBe(DEFAULT_VENUE.kn);
    expect(saved.description_kn).toBe("ದಾರ್ಸೈಟ್ ಬಳಿಯ ಭಕ್ತರು");
  });

  it("leaves text that has nothing to correct alone, and a missing column too", () => {
    expect(mapEventRow({ ...row, location_kn: null, description_kn: null }, "kn").venue).toBe(
      DEFAULT_VENUE.kn
    );
    expect(mapEventRow({ ...row, title_kn: "ಓಂಕಾರ ನಾದಾಮೃತ" }, "kn").title).toBe(
      "ಓಂಕಾರ ನಾದಾಮೃತ"
    );
  });
});

describe("nextEvent — the program the homepage leads with", () => {
  const curated = translations.en.eventsList;
  const at = (iso) => new Date(`${iso}T12:00:00`);

  it("picks the next program that has not happened yet", () => {
    // 7 October 2026: Jnanamrutha (April) and Naadamrutha (October 2) are
    // behind us, so the Anjaneya Pooje in December is the next one.
    expect(nextEvent(curated, at("2026-10-07")).title).toBe("Sri Anjaneya Pooje");
  });

  it("moves to the next program as the year turns", () => {
    const rolled = rollDates(curated, at("2027-02-01"));
    expect(nextEvent(rolled, at("2027-02-01")).date).toBe("2027-04-01");
  });

  it("steps aside when every stored date is behind the Samithi", () => {
    // 20 December 2026: the year's programmes are done and the dashboard has
    // not entered the next ones. The homepage block hides (null) rather than
    // leading with a year nobody entered.
    expect(nextEvent(curated, at("2026-12-20"))).toBeNull();
  });

  it("never features an undated program while a dated one is ahead", () => {
    const mixed = [
      { id: "x", title: "No date yet", date: "" },
      { id: "e3", title: "Sri Anjaneya Pooje", date: "2026-12-18" },
    ];
    expect(nextEvent(mixed, at("2026-10-07")).title).toBe("Sri Anjaneya Pooje");
  });

  it("still returns something when nothing has a date — it renders as TBA", () => {
    const undated = [{ id: "x", title: "No date yet", date: "" }];
    expect(nextEvent(undated, at("2026-10-07")).title).toBe("No date yet");
    expect(nextEvent([], at("2026-10-07"))).toBeNull();
  });

  it("does not mutate the list it was given", () => {
    const before = JSON.stringify(curated);
    nextEvent(curated, at("2026-12-20"));
    expect(JSON.stringify(curated)).toBe(before);
  });
});
