import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, beforeAll } from "vitest";
import EventsView from "../src/components/EventsView.jsx";
import { translations } from "../src/data/content.js";
import { eventRowFromForm, mapEventRow } from "../src/utils/events.js";
import { TABS, tabFromHash } from "../src/utils/route.js";

/* Round 66 — the client's rulings, pinned:
   1. SEVA IS GONE — the tab, the view, the invite card, the admin section,
      the dictionary keys, the form mapper. Nothing seva survives anywhere
      a visitor or an admin can reach; the old deep link falls home.
   2. EVENTS ARE FREE — the dashboard adds events, renames them in both
      languages, and sets a time of day that rides beside the date on every
      public surface that prints the date.
   3. THE INSTALLED APP IS "OMKAR SAMITHI" — manifest short_name and the iOS
      home-screen label, not the bare "Omkar" the phone launcher showed. */

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

beforeAll(() => {
  globalThis.document = {
    documentElement: {
      lang: "en",
      getAttribute: () => "dark",
      setAttribute() {},
      style: { setProperty() {} },
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.window = {
    location: { hash: "", href: "http://localhost/" },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {},
    scrollY: 0,
  };
});

describe("round 66 · seva is gone, wholly", () => {
  it("leaves no seva view, invite card or admin section in the tree", () => {
    expect(existsSync(new URL("../src/components/SevaView.jsx", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../src/components/SevaInvite.jsx", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../src/admin/views/SevaAdmin.jsx", import.meta.url))).toBe(false);
  });

  it("drops the tab, the route and the dictionary keys, both languages", () => {
    expect(TABS).not.toContain("seva");
    expect(tabFromHash("#/seva")).toBe("hub");
    expect(translations.en.sevaTab).toBeUndefined();
    expect(translations.kn.sevaTab).toBeUndefined();
    const content = read("../src/data/content.js");
    expect(content).not.toContain("sevaCards");
    expect(content).not.toContain("registerSeva");
  });

  it("keeps no seva mapper or signup reader in the supabase layer", () => {
    const sup = read("../src/utils/supabase.js");
    expect(sup).not.toContain("sevaRow");
    expect(sup).not.toContain("listSevaSignups");
    expect(sup).not.toContain("seva_signups");
  });

  it("shows no seva in the shell: nav, footer or app body", () => {
    for (const f of ["../src/App.jsx", "../src/components/Header.jsx", "../src/components/ContentHub.jsx"]) {
      expect(read(f), f).not.toMatch(/seva/i);
    }
  });
});

describe("round 66 · events are free: add, rename, time", () => {
  const admin = read("../src/admin/views/EventsAdmin.jsx");

  it("offers an add-event card and free names in both languages", () => {
    expect(admin).toContain("+ Add event");
    expect(admin).toContain("Name (English)");
    expect(admin).toContain("Name (Kannada)");
  });

  it("carries a time-of-day field into the stored row", () => {
    expect(admin).toContain("Time of day (shown beside the date)");
    expect(eventRowFromForm({ title_en: "X", time_text: " 6:30 PM " }).time_text).toBe("6:30 PM");
    expect(eventRowFromForm({ title_en: "X", time_text: "   " }).time_text).toBeNull();
    expect(eventRowFromForm({ title_en: "X" }).time_text).toBeNull();
  });

  it("hands the time to every public surface that prints the date", () => {
    expect(mapEventRow({ title_en: "X", time_text: "ಸಂಜೆ 6:30" }).time).toBe("ಸಂಜೆ 6:30");
    expect(mapEventRow({ title_en: "X" }).time).toBe("");
    const html = renderToStaticMarkup(
      <EventsView
        t={translations.en}
        lang="en"
        events={[{ id: "x", title: "Omkar Dashamotsava", date: "2026-11-01", time: "6:30 PM", venue: "v" }]}
        notify={{}}
        onToggleNotify={() => {}}
        flash={() => {}}
      />
    );
    expect(html).toContain("6:30 PM");
    for (const f of ["../src/components/NextProgram.jsx"]) {
      expect(read(f), f).toContain("e.time");
    }
  });
});

describe("round 66 · the installed app wears the full name", () => {
  it("names the PWA Omkar Samithi, manifest and iOS label alike", () => {
    const manifest = JSON.parse(read("../public/manifest.webmanifest"));
    expect(manifest.short_name).toBe("Omkar Samithi");
    expect(manifest.name).toBe("Omkar Samithi");
    expect(read("../index.html")).toContain(
      'name="apple-mobile-web-app-title" content="Omkar Samithi"'
    );
  });
});
