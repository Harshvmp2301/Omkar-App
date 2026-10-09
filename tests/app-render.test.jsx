import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, beforeAll } from "vitest";
import App from "../src/App.jsx";
import { translations } from "../src/data/content.js";

/**
 * The WHOLE app, rendered for real — header, hero, every view, footer — in both
 * languages.
 *
 * There is no browser here, so this is the closest thing to looking at the
 * page: React's own renderer produces the markup a visitor would receive.
 * Effects do not run (no scroll listener, no observers), so this is the static
 * document, not the animated result — but it catches the things that break a
 * page for real: a crashed render, a raw `undefined` on screen, a heading
 * hierarchy that skips a level, a missing landmark, or a language whose copy
 * was never finished.
 */

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
  // Node's navigator is read-only; only the SW registration reads it, and that
  // lives in an effect, which never runs here.
});

const render = () => renderToStaticMarkup(<App />);

function headings(html) {
  return [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => ({
    level: Number(m[1]),
    text: m[2].replace(/<[^>]*>/g, "").trim(),
  }));
}

describe("the whole app renders", () => {
  it("renders without throwing", () => {
    expect(() => render()).not.toThrow();
  });

  it("produces a real document, not an empty shell", () => {
    const html = render();
    expect(html.length).toBeGreaterThan(3000);
    expect(html).toContain('class="header"');
    expect(html).toContain('class="footer"');
    expect(html).toContain('id="main"');
    expect(html).toContain('class="app-logo"');
    expect(html).toContain('class="skip-link"');
  });

  it("keeps the landmarks a screen reader navigates by", () => {
    const html = render();
    expect((html.match(/<header\b/g) || []).length).toBe(1);
    expect((html.match(/<main\b/g) || []).length).toBe(1);
    expect((html.match(/<footer\b/g) || []).length).toBe(1);
    expect(html).toMatch(/<nav[^>]+aria-label="Primary"/);
    expect(html).toMatch(/<main[^>]+aria-label=/);
  });

  it("never leaks a raw value onto the page", () => {
    const html = render();
    expect(html).not.toMatch(/\bundefined\b/);
    expect(html).not.toMatch(/\bNaN\b/);
    expect(html).not.toMatch(/\[object Object\]/);
  });
});

describe("heading hierarchy across the rendered page", () => {
  it("has exactly one h1, and it names the organisation", () => {
    const h1 = headings(render()).filter((h) => h.level === 1);
    expect(h1.length).toBe(1);
    expect(h1[0].text).toBe("Oman Karnataka Aradhana Samithi");
  });

  it("never skips a heading level", () => {
    const list = headings(render());
    expect(list.length).toBeGreaterThan(5);
    let previous = list[0].level;
    for (const { level, text } of list.slice(1)) {
      expect(level, `"${text}" jumps from h${previous} to h${level}`).toBeLessThanOrEqual(previous + 1);
      previous = level;
    }
  });

  it("gives every section that has a heading an id'd heading or a label", () => {
    const html = render();
    // sections labelled by their heading, so the landmark list reads properly
    const labelled = (html.match(/aria-labelledby="[^"]+"/g) || []).length;
    expect(labelled).toBeGreaterThan(2);
  });
});

describe("every tab, rendered in full", () => {
  // The hash is the router, so pointing window.location at a tab renders that
  // tab inside the real shell — header, footer and all. This is where the
  // "hero belongs to Home" rule is checked against the actual document rather
  // than against a line of source.
  const at = (hash) => {
    globalThis.window.location.hash = hash;
    return renderToStaticMarkup(<App />);
  };

  it.each([
    ["#/hub", "hub"],
    ["#/events", "events"],
    ["#/gallery", "gallery"],
    ["#/seva", "seva"],
    ["#/about", "about"],
    ["#/contact", "about (legacy alias)"],
  ])("%s renders", (hash) => {
    expect(() => at(hash)).not.toThrow();
  });

  it("shows the hero on Home, and only on Home", () => {
    expect(at("#/hub")).toContain('class="hero"');
    for (const hash of ["#/events", "#/gallery", "#/seva", "#/about"]) {
      expect(at(hash), `${hash} still shows the homepage hero`).not.toContain('class="hero"');
    }
  });

  it("still renders the mark and the header on every tab", () => {
    for (const hash of ["#/hub", "#/events", "#/gallery", "#/seva", "#/about"]) {
      const html = at(hash);
      expect(html, hash).toContain('class="app-logo"');
      expect(html, hash).toContain('class="header"');
      expect(html, hash).toContain('class="footer"');
    }
  });

  it("gives every tab exactly one h1", () => {
    for (const hash of ["#/hub", "#/events", "#/gallery", "#/seva", "#/about"]) {
      const list = headings(at(hash)).filter((h) => h.level === 1);
      expect(list.length, `${hash} has ${list.length} h1s`).toBe(1);
      expect(list[0].text.length, hash).toBeGreaterThan(2);
    }
  });

  it("never skips a heading level on any tab", () => {
    for (const hash of ["#/hub", "#/events", "#/gallery", "#/seva", "#/about"]) {
      const list = headings(at(hash));
      let previous = list[0].level;
      expect(previous, `${hash} starts at h${previous}`).toBe(1);
      for (const { level, text } of list.slice(1)) {
        expect(level, `${hash}: "${text}" jumps h${previous} → h${level}`).toBeLessThanOrEqual(previous + 1);
        previous = level;
      }
    }
  });

  it("never shows a past date on the Events tab — the whole point of the fix", () => {
    // The defect, as a visitor met it: on 8 October 2026 the page headed
    // "Upcoming Programs" listed 1 April and 2 October as the next programmes.
    // Every date the page prints now comes from upcomingEvents(), so this is
    // checked against the rendered document rather than the helper alone.
    const html = at("#/events");
    // The full date lives in the title attributes (and in the calendar chips).
    const printed = [...html.matchAll(/title="(\d{1,2} [A-Za-z]+ (\d{4}))"/g)].map((m) => m[1]);
    expect(printed.length).toBeGreaterThan(0);

    const parse = (human) => {
      const [day, month, year] = human.split(" ");
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      return Date.UTC(Number(year), months.indexOf(month), Number(day));
    };
    const today = new Date();
    const midnight = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    for (const human of printed) {
      expect(parse(human), `${human} is in the past`).toBeGreaterThanOrEqual(midnight);
    }
  });

  it("prints no past date on the Seva tab either", () => {
    // The chips under "Our Yearly Programs" print a full date WITH the year,
    // so a stale one is unmistakable — which is how the owner's screenshot of
    // 8 October 2026 showed "1 April 2026".
    const html = at("#/seva");
    const months = ["January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December"];
    const printed = [...html.matchAll(/>([0-9]{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4})</g)]
      .map((m) => m[1]);
    expect(printed.length).toBeGreaterThan(0);
    const parse = (human) => {
      const [day, month, year] = human.split(" ");
      return Date.UTC(Number(year), months.indexOf(month), Number(day));
    };
    const today = new Date();
    const midnight = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    for (const human of printed) {
      expect(parse(human), `${human} is in the past`).toBeGreaterThanOrEqual(midnight);
    }
  });

  it("shows the same next programme on the homepage and on the Events tab", () => {
    // The featured card and the first row of the list are the same programme
    // from the same list, so the two pages cannot advertise different dates.
    const hub = at("#/hub").match(/class="feature-date-text"[^>]*>\s*([^<]+?)\s*</)[1];
    const rows = [...at("#/events").matchAll(/class="countdown-chip"[^>]*title="([^"]+)"/g)].map(
      (m) => m[1]
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toBe(hub);
  });

  it("lists the Events rows in the order they happen", () => {
    const rows = [...at("#/events").matchAll(/class="countdown-chip"[^>]*title="([^"]+)"/g)].map(
      (m) => m[1]
    );
    const months = ["January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December"];
    const parse = (human) => {
      const [day, month, year] = human.split(" ");
      return Date.UTC(Number(year), months.indexOf(month), Number(day));
    };
    const times = rows.map(parse);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("starts the homepage list of programmes with the one that is next", () => {
    // "More Programs" must run forward from the featured programme, not from
    // the stored order — otherwise the homepage shows a past programme first.
    const html = at("#/hub");
    const featured = html.match(/class="feature-date-text"[^>]*>\s*([^<]+?)\s*</)[1];
    const others = [...html.matchAll(/class="also-meta"[^>]*>\s*([^<]+?)\s*</g)].map((m) => m[1]);

    const months = ["January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December"];
    const parse = (human) => {
      const [day, month, year] = human.split(" ");
      return Date.UTC(Number(year), months.indexOf(month), Number(day));
    };
    // Announced dates only: an undated programme renders as TBA, not a date.
    // The "also" row may legitimately be EMPTY: round 30 lists only programs
    // whose stored date is still ahead, and late in the year that can be one
    // programme — the featured one — with nothing after it.
    const announced = others.filter((d) => months.some((m) => d.includes(m)));
    const today = new Date();
    const midnight = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    for (const human of [featured, ...announced]) {
      expect(parse(human), `${human} is in the past`).toBeGreaterThanOrEqual(midnight);
    }
    // Ascending: the featured one is the earliest of them all.
    const order = [featured, ...announced].map(parse);
    expect(order[0]).toBe(Math.min(...order));
  });

  it("sends a retired #/donate link home rather than to a dead view", () => {
    const html = at("#/donate");
    expect(html).toContain('class="hero"'); // the hub, not an empty page
  });
});

describe.each([
  ["Kannada", "kn"],
  ["English", "en"],
])("the %s page", (_label, lang) => {
  it("has every string the other language has", () => {
    const en = Object.keys(translations.en);
    const other = Object.keys(translations[lang]);
    expect(other.filter((k) => !en.includes(k))).toEqual([]);
    expect(en.filter((k) => !other.includes(k))).toEqual([]);
  });

  it("renders no untranslated key names", () => {
    const html = renderToStaticMarkup(<App />);
    // A key leaking through would look like "heroCtaPrograms" on the page.
    expect(html).not.toMatch(/>\s*(hero|about|footer|voices|pillar|archive)[A-Z][A-Za-z]+\s*</);
  });

  it("carries the locale's own script where it should", () => {
    const t = translations[lang];
    const html = renderToStaticMarkup(<App />);
    if (lang === "kn") {
      expect(t.heroCtaPrograms).toMatch(/[\u0C80-\u0CFF]/);
      expect(html).toMatch(/[\u0C80-\u0CFF]/); // Kannada glyphs actually rendered
    } else {
      expect(html).toContain("Explore Programs");
    }
  });
});
