import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  daysUntil,
  dueReminders,
  nextSeen,
  seenDatesOf,
} from "../src/utils/reminders.js";
import { translations } from "../src/data/content.js";

const P = (title, date, day, mon) => ({ id: title, title, date, day, mon });
const EVENT = P("Sri Anjaneya Pooje", "2026-12-18", 18, "Dec");

describe("daysUntil counts whole days from today", () => {
  it("is zero on the day itself and one the day before", () => {
    expect(daysUntil("2026-12-18", "2026-12-18")).toBe(0);
    expect(daysUntil("2026-12-18", "2026-12-17")).toBe(1);
    expect(daysUntil("2026-12-18", "2026-12-11")).toBe(7);
  });

  it("goes negative after the date and rejects junk", () => {
    expect(daysUntil("2026-12-18", "2026-12-19")).toBe(-1);
    expect(daysUntil("nonsense", "2026-12-19")).toBeNull();
  });
});

describe("the program windows are exactly today, tomorrow and the last week", () => {
  const kinds = (today) =>
    dueReminders({ todayISO: today, programs: [EVENT] }).map((r) => r.kind);

  it("says today on the day", () => {
    expect(kinds("2026-12-18")).toEqual(["today"]);
  });

  it("says tomorrow once, and never both week and day", () => {
    expect(kinds("2026-12-17")).toEqual(["day"]);
  });

  it("opens the week window at seven days and closes it after", () => {
    expect(kinds("2026-12-11")).toEqual(["week"]);
    expect(kinds("2026-12-16")).toEqual(["week"]);
    expect(kinds("2026-12-10")).toEqual([]);
    expect(kinds("2026-12-19")).toEqual([]);
  });

  it("carries the day count and the program's own labels", () => {
    const [r] = dueReminders({ todayISO: "2026-12-14", programs: [EVENT] });
    expect(r.days).toBe(4);
    expect(r.name).toBe("Sri Anjaneya Pooje");
    expect(r.day).toBe(18);
    expect(r.mon).toBe("Dec");
  });
});

describe("a moved program is news exactly once", () => {
  const moved = { ...EVENT, date: "2026-12-20", day: 20 };

  it("is silent on a first visit: a baseline is not news", () => {
    expect(dueReminders({ todayISO: "2026-10-10", programs: [moved], seen: null })).toEqual([]);
  });

  it("fires when a stored date no longer matches", () => {
    const seen = { dates: { "Sri Anjaneya Pooje": "2026-12-18" } };
    const [r] = dueReminders({ todayISO: "2026-10-10", programs: [moved], seen });
    expect(r.kind).toBe("moved");
    expect(r.id).toBe("moved:Sri Anjaneya Pooje:2026-12-20");
  });

  it("stays quiet when nothing moved, and when the notice was dismissed", () => {
    const seen = { dates: { "Sri Anjaneya Pooje": "2026-12-20" } };
    expect(dueReminders({ todayISO: "2026-10-10", programs: [moved], seen })).toEqual([]);
    const dismissed = {
      dates: { "Sri Anjaneya Pooje": "2026-12-18" },
      dismissed: { "moved:Sri Anjaneya Pooje:2026-12-20": 1 },
    };
    expect(dueReminders({ todayISO: "2026-10-10", programs: [moved], seen: dismissed })).toEqual([]);
  });
});

describe("the blog and the channel announce themselves once per publication", () => {
  const post = { id: "bl-2", title: "Deepavali at the temple" };
  const video = { id: "yt-9", title: "Naadamrutha highlights" };

  it("baselines a first visit without announcing anything", () => {
    expect(dueReminders({ todayISO: "2026-10-10", post, video, seen: null })).toEqual([]);
  });

  it("announces a post or a video this browser has not seen", () => {
    const seen = { blog: "bl-1", video: "yt-8" };
    const due = dueReminders({ todayISO: "2026-10-10", post, video, seen });
    expect(due.map((r) => r.kind)).toEqual(["blog", "video"]);
    expect(due[0].title).toBe("Deepavali at the temple");
  });

  it("stays quiet for a feed it already knows", () => {
    const seen = { blog: "bl-2", video: "yt-9" };
    expect(dueReminders({ todayISO: "2026-10-10", post, video, seen })).toEqual([]);
  });
});

describe("due reminders speak in order of urgency", () => {
  it("puts the program first, then a move, then the blog, then the channel", () => {
    const programs = [EVENT, { ...EVENT, id: "x", title: "Omkar Naadamrutha", date: "2027-10-02" }];
    const seen = {
      dates: { "Omkar Naadamrutha": "2027-10-09" },
      blog: "bl-1",
      video: "yt-8",
    };
    const due = dueReminders({
      todayISO: "2026-12-18",
      programs,
      post: { id: "bl-2", title: "p" },
      video: { id: "yt-9", title: "v" },
      seen,
    });
    expect(due.map((r) => r.kind)).toEqual(["today", "moved", "blog", "video"]);
  });
});

describe("the stored snapshot becomes tomorrow's baseline", () => {
  it("records every program date and keeps what it is not given", () => {
    const seen = { blog: "bl-2", video: "yt-9", dismissed: { "blog:bl-1": 1 } };
    const next = nextSeen({ programs: [EVENT], post: null, video: null, seen });
    expect(next.dates).toEqual({ "Sri Anjaneya Pooje": "2026-12-18" });
    expect(next.blog).toBe("bl-2");
    expect(next.video).toBe("yt-9");
    expect(next.dismissed).toEqual({ "blog:bl-1": 1 });
  });

  it("adopts the freshest post and video ids", () => {
    const next = nextSeen({
      programs: [EVENT],
      post: { id: "bl-3" },
      video: { id: "yt-4" },
      seen: null,
    });
    expect(next.blog).toBe("bl-3");
    expect(next.video).toBe("yt-4");
    expect(seenDatesOf([EVENT])).toEqual({ "Sri Anjaneya Pooje": "2026-12-18" });
  });
});

describe("the reminder line speaks both languages, word for word", () => {
  const KEYS = [
    "remindToday",
    "remindDay",
    "remindWeek",
    "remindMoved",
    "remindBlog",
    "remindVideo",
    "remindDismiss",
  ];
  const placeholders = (s) => (String(s).match(/\{[a-z]+\}/g) || []).sort();

  it("carries every key in English and Kannada", () => {
    for (const k of KEYS) {
      expect(translations.en[k], `en.${k}`).toBeTruthy();
      expect(translations.kn[k], `kn.${k}`).toBeTruthy();
    }
  });

  it("fills the same blanks in both languages", () => {
    for (const k of KEYS) {
      expect(placeholders(translations.kn[k]), k).toEqual(placeholders(translations.en[k]));
    }
  });
});

describe("the strip is quiet machinery", () => {
  const strip = readFileSync(new URL("../src/components/ReminderStrip.jsx", import.meta.url), "utf8");
  const engine = readFileSync(new URL("../src/utils/reminders.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  it("announces itself to screen readers and labels its dismiss button", () => {
    expect(strip).toContain('role="status"');
    expect(strip).toContain("aria-label={t.remindDismiss}");
  });

  it("lets a preview pretend it is any day, in DEV only", () => {
    expect(strip).toContain("import.meta.env.DEV");
    expect(strip).toContain("remindDay");
  });

  it("reads no clock and opens no connection of its own", () => {
    expect(engine).not.toMatch(/new Date\(/);
    expect(engine).not.toMatch(/Date\.now/);
    expect(engine).not.toMatch(/\bfetch\(/);
    expect(strip).not.toMatch(/\bfetch\(/);
  });

  it("sits in the flow between the header and the view, nowhere else", () => {
    const at = (s) => app.indexOf(s);
    expect(at("<ReminderStrip")).toBeGreaterThan(at("<Header"));
    expect(at("<ReminderStrip")).toBeLessThan(at("<main"));
    const rule = css.slice(css.indexOf(".remind-strip {"), css.indexOf(".remind-dot"));
    // out of flow, under the sticky header: it must cost the fold nothing
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("top: var(--header-h, 80px)");
    expect(rule).toContain("var(--panel)");
    expect(rule).toContain("var(--muted)");
  });
});
