import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { timeCompactFromText, icsLines } from "../src/utils/calendar.js";
import { mergeEvents } from "../src/utils/events.js";

/* Round 68 — the owner's screenshot showed the truth the r66 pins missed:
   the saved time sat in the dashboard but never reached the public card.
   Two fixes, both pinned here:
   1. mergeEvents must carry the row's time onto the merged program entry —
      the Events page, the homepage bar and the clock chip all read `time`
      off exactly that object.
   2. The Add-to-Calendar file must carry the time: a readable time makes the
      .ics a timed event (floating temple-local time, two hours long); no
      readable time keeps the whole-day entry it always was. */

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("round 68 — the stored time reaches the card", () => {
  it("mergeEvents keeps the row's time of day on the merged entry", () => {
    const curated = [
      { id: "p3", date: "2026-12-18", day: "—", mon: "", title: "Sri Anjaneya Pooje", guest: null, venue: "temple" },
    ];
    const rows = [
      {
        id: 7,
        title_en: "Sri Anjaneya Pooje",
        title_kn: "ಶ್ರೀ ಆಂಜನೇಯ ಪೂಜೆ",
        starts_at: "2026-12-18T00:00:00+00:00",
        time_text: "10:00 AM / ಬೆಳಿಗ್ಗೆ, 10:00",
        published: true,
      },
    ];
    const merged = mergeEvents(curated, rows, "en");
    expect(merged[0].time).toBe("10:00 AM / ಬೆಳಿಗ್ಗೆ, 10:00");
  });

  it("the public card renders that time with its clock chip", () => {
    const view = read("../src/components/EventsView.jsx");
    expect(view).toContain("{e.time && (");
    // and hands it to the calendar file
    expect(view).toContain("timeText: e.time,");
    expect(read("../src/components/NextProgram.jsx")).toContain("timeText: featured.time,");
  });
});

describe("round 68 — a readable time becomes a timed .ics entry", () => {
  it("reads the dashboard's free text in every shape the committee types", () => {
    expect(timeCompactFromText("10:00 AM / ಬೆಳಿಗ್ಗೆ, 10:00")).toBe("1000");
    expect(timeCompactFromText("6:30 PM")).toBe("1830");
    expect(timeCompactFromText("ಸಂಜೆ 6:30")).toBe("1830");
    expect(timeCompactFromText("ಬೆಳಿಗ್ಗೆ 11")).toBe("1100");
    expect(timeCompactFromText("ರಾತ್ರಿ 8:15")).toBe("2015");
    expect(timeCompactFromText("18:45")).toBe("1845");
    expect(timeCompactFromText("12:00 AM")).toBe("0000");
    expect(timeCompactFromText("12:30 PM")).toBe("1230");
    // nothing readable → whole-day event, as always
    expect(timeCompactFromText("")).toBe("");
    expect(timeCompactFromText("TBA")).toBe("");
    expect(timeCompactFromText("25:99")).toBe("");
  });

  it("writes DTSTART/DTEND with the time when there is one", () => {
    const lines = icsLines({
      title: "Sri Anjaneya Pooje",
      dateISO: "2026-12-18",
      venue: "Sri Krishna Temple, Darsait, Muscat",
      description: "Omkar Samithi",
      timeText: "10:00 AM / ಬೆಳಿಗ್ಗೆ, 10:00",
      dtstamp: "20261021T000000Z",
    });
    expect(lines).toContain("DTSTART:20261218T100000");
    expect(lines).toContain("DTEND:20261218T120000");
    expect(lines.join("\r\n")).not.toContain("VALUE=DATE");
  });

  it("keeps the whole-day entry when the time is empty or unreadable", () => {
    for (const timeText of ["", "TBA"]) {
      const lines = icsLines({
        title: "Omkar Naadamrutha",
        dateISO: "2026-10-02",
        venue: "temple",
        description: "",
        timeText,
        dtstamp: "20261021T000000Z",
      });
      expect(lines).toContain("DTSTART;VALUE=DATE:20261002");
      expect(lines).toContain("DTEND;VALUE=DATE:20261003");
    }
  });

  it("caps a late start inside the same day", () => {
    const lines = icsLines({
      title: "Late",
      dateISO: "2026-12-18",
      venue: "",
      description: "",
      timeText: "11:30 PM",
      dtstamp: "20261021T000000Z",
    });
    expect(lines).toContain("DTSTART:20261218T233000");
    expect(lines).toContain("DTEND:20261218T235900");
  });
});
