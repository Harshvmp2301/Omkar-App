import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  toKnDigits,
  daysUntil,
  dateParts,
  countdownLabel,
  formatFullDate,
  downloadIcs,
} from "./calendar.js";

/** Local-time ISO (YYYY-MM-DD) for a Date — same convention the app uses. */
const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("toKnDigits", () => {
  it("maps ASCII digits to Kannada numerals", () => {
    expect(toKnDigits("2026")).toBe("೨೦೨೬");
  });
  it("leaves non-digits untouched", () => {
    expect(toKnDigits("Oct 5!")).toBe("Oct ೫!");
  });
});

describe("daysUntil", () => {
  it("is 0 for today, ±1 for neighbours", () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    expect(daysUntil(isoOf(today))).toBe(0);
    expect(daysUntil(isoOf(tomorrow))).toBe(1);
    expect(daysUntil(isoOf(yesterday))).toBe(-1);
  });
});

describe("dateParts", () => {
  it("splits an ISO date into day + month abbreviation (en)", () => {
    const { day, mon } = dateParts("2026-11-08", "en");
    expect(day).toBe("8");
    expect(mon).toBe("Nov");
  });
  it("renders the day in Kannada numerals for kn", () => {
    expect(dateParts("2026-11-08", "kn").day).toBe("೮");
  });
});

describe("countdownLabel", () => {
  const t = {
    todayLabel: "Today",
    tomorrowLabel: "Tomorrow",
    daysToGo: "days to go",
  };
  const shift = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return isoOf(d);
  };

  it("uses the dedicated labels for today and tomorrow", () => {
    expect(countdownLabel(shift(0), t)).toBe("Today");
    expect(countdownLabel(shift(1), t)).toBe("Tomorrow");
  });
  it("counts days to go", () => {
    expect(countdownLabel(shift(5), t)).toBe("5 days to go");
  });
  it("is empty for past dates and missing ISO", () => {
    expect(countdownLabel(shift(-3), t)).toBe("");
    expect(countdownLabel("", t)).toBe("");
  });
});

describe("formatFullDate", () => {
  it("formats English long dates as '8 November 2026'", () => {
    expect(formatFullDate("2026-11-08", "en")).toBe("8 November 2026");
  });
  it("produces a non-empty Kannada rendering", () => {
    const kn = formatFullDate("2026-11-08", "kn");
    expect(typeof kn).toBe("string");
    expect(kn.length).toBeGreaterThan(0);
  });
});

// --- downloadIcs ------------------------------------------------------------

describe("downloadIcs — guards", () => {
  it("returns false without a date", () => {
    expect(downloadIcs({ title: "No date" })).toBe(false);
  });
  it("returns false when there is no DOM (SSR/worker safety)", () => {
    // node test env has no `document` — exactly the branch under test.
    expect(downloadIcs({ title: "x", dateISO: "2026-01-01" })).toBe(false);
  });
});

describe("downloadIcs — .ics generation", () => {
  let capturedBlob = null;
  let clickedAnchor = null;
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    capturedBlob = null;
    clickedAnchor = null;
    global.document = {
      createElement: () => {
        const el = {
          href: "",
          download: "",
          click() {
            clickedAnchor = this;
          },
          remove() {},
        };
        return el;
      },
      body: { appendChild() {} },
    };
    URL.createObjectURL = (blob) => {
      capturedBlob = blob;
      return "blob:omkar-test";
    };
    URL.revokeObjectURL = () => {};
  });

  afterEach(() => {
    delete global.document;
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });

  it("emits a valid all-day VEVENT with escaping, slug UID and CRLF endings", async () => {
    const ok = downloadIcs({
      title: "Guru Purnima; Upakrama, Day 1",
      dateISO: "2026-07-29",
      venue: "Muscat, Oman",
      description: "Line1\nLine2",
    });

    expect(ok).toBe(true);
    expect(capturedBlob).toBeTruthy();
    const text = await capturedBlob.text();

    expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(text).toContain("VERSION:2.0");
    expect(text).toContain("DTSTART;VALUE=DATE:20260729");
    expect(text).toContain("DTEND;VALUE=DATE:20260730");
    expect(text).toContain("UID:20260729-guru-purnima-upakrama-day-1@omkarsamithi");
    // ; and , must be ICS-escaped inside SUMMARY/LOCATION
    expect(text).toContain("SUMMARY:Guru Purnima\\; Upakrama\\, Day 1");
    expect(text).toContain("LOCATION:Muscat\\, Oman");
    // newlines flatten to literal \n sequences
    expect(text).toContain("DESCRIPTION:Line1\\nLine2");
    expect(text).toMatch(/^DTSTAMP:\d{8}T\d{6}Z\r?$/m);
    expect(clickedAnchor.download).toBe("omkar-guru-purnima-upakrama-day-1.ics");
  });

  it("rolls DTEND across a year boundary", async () => {
    downloadIcs({ title: "Year End", dateISO: "2026-12-31" });
    const text = await capturedBlob.text();
    expect(text).toContain("DTSTART;VALUE=DATE:20261231");
    expect(text).toContain("DTEND;VALUE=DATE:20270101");
  });

  it("omits LOCATION/DESCRIPTION when not provided", async () => {
    downloadIcs({ title: "Bare", dateISO: "2026-10-11" });
    const text = await capturedBlob.text();
    expect(text).not.toContain("LOCATION:");
    expect(text).not.toContain("DESCRIPTION:");
    expect(text).toContain("SUMMARY:Bare");
  });
});
