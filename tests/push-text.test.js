import { describe, expect, it } from "vitest";
import {
  anyClientOpen,
  customPush,
  feedPush,
  formatPushDate,
  programPush,
} from "../src/utils/push-text.js";
import { translations } from "../src/data/content.js";

/* The phone pop-up and the quiet in-tab line must tell the same news in the
   same words — these tests pin the push bodies against the strip strings in
   content.js, in both languages. */

describe("push notification wording", () => {
  const data = {
    title_en: "Omkar Jnanamrutha",
    title_kn: "ಓಂಕರ ಜ್ಞಾನಾಮೃತ",
    starts_at: "2026-12-07",
  };

  it("reads a date the way the site does, in both languages", () => {
    expect(formatPushDate("2026-12-07", "en")).toBe("7 December 2026");
    const kn = formatPushDate("2026-12-07", "kn");
    expect(kn).toContain("ಡಿಸೆಂಬರ್");
    expect(kn).toContain("2026");
    expect(formatPushDate("", "en")).toBe("");
    expect(formatPushDate("nonsense", "en")).toBe("");
  });

  it("says what the in-tab moved line says, in both languages", () => {
    const push = programPush(data);
    const dateEn = formatPushDate(data.starts_at, "en");
    expect(push.body_en).toBe(
      translations.en.remindMoved.replaceAll("{name}", data.title_en).replaceAll("{date}", dateEn)
    );
    const dateKn = formatPushDate(data.starts_at, "kn");
    expect(push.body_kn).toBe(
      translations.kn.remindMoved.replaceAll("{name}", data.title_kn).replaceAll("{date}", dateKn)
    );
  });

  it("announces a dateless save instead of staying silent", () => {
    const push = programPush({ title_en: "Omkar Naadamrutha", starts_at: null });
    expect(push.body_en).toBe("Omkar Naadamrutha: date to be announced");
    expect(push.body_kn).toContain("ದಿನಾಂಕ ಘೋಷಿಸಲಾಗುವುದು");
  });

  it("says what the in-tab blog and video lines say, in both languages", () => {
    expect(feedPush("blog", "Diwali at the temple").body_en).toBe(
      translations.en.remindBlog.replaceAll("{title}", "Diwali at the temple")
    );
    expect(feedPush("blog", "Diwali at the temple").body_kn).toBe(
      translations.kn.remindBlog.replaceAll("{title}", "Diwali at the temple")
    );
    expect(feedPush("video", "Naadamrutha 2026").body_en).toBe(
      translations.en.remindVideo.replaceAll("{title}", "Naadamrutha 2026")
    );
    expect(feedPush("video", "Naadamrutha 2026").body_kn).toBe(
      translations.kn.remindVideo.replaceAll("{title}", "Naadamrutha 2026")
    );
  });

  it("carries a custom message exactly as written, trimmed", () => {
    const push = customPush({ body_en: "  Gathering on Sunday  ", body_kn: " ಭಾನುವಾರ ಸಭೆ " });
    expect(push.body_en).toBe("Gathering on Sunday");
    expect(push.body_kn).toBe("ಭಾನುವಾರ ಸಭೆ");
    expect(push.title_en).toBe("Omkar Samithi");
    expect(push.title_kn).toBe("ಓಂಕರ ಸಮಿತಿ");
  });
});

describe("the service worker's restraint", () => {
  it("stays quiet while any window of the site is in front of the visitor", () => {
    expect(anyClientOpen([{ focused: true, visibilityState: "hidden" }])).toBe(true);
    expect(anyClientOpen([{ focused: false, visibilityState: "visible" }])).toBe(true);
    expect(anyClientOpen([{ focused: false, visibilityState: "hidden" }])).toBe(false);
    expect(anyClientOpen([])).toBe(false);
  });

  it("is the same rule the service worker runs inline", async () => {
    const fs = await import("node:fs/promises");
    const sw = await fs.readFile(new URL("../public/sw.js", import.meta.url), "utf8");
    const text = await fs.readFile(new URL("../src/utils/push-text.js", import.meta.url), "utf8");
    const rule = "c.focused || c.visibilityState === \"visible\"";
    expect(sw).toContain(rule);
    expect(text).toContain(rule);
  });
});
