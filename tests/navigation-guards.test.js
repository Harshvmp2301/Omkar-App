import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Information-architecture guards.
 *
 * Three findings from the interface review that are invisible in a screenshot
 * but obvious in use, so they are asserted here:
 *
 *  1. The homepage hero was rendered on EVERY tab, so clicking "Events" landed
 *     you on the homepage's hero and its CTAs before the events existed. The
 *     hero is now Home-only and the other views open on their own heading.
 *  2. Switching tabs kept the old scroll offset, so you arrived in the middle
 *     of the next view (or mid-flight on Home). Each view now starts at its top.
 *  3. Only Home had an <h1>; the other four views started at <h2>, leaving
 *     screen-reader and SEO users without a page heading.
 */

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const code = app
  .split("\n")
  .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
  .join("\n");
const component = (name) =>
  readFileSync(new URL(`../src/components/${name}`, import.meta.url), "utf8");

describe("the hero belongs to Home", () => {
  it("renders the hero only on the hub tab", () => {
    expect(code).toMatch(/tab === "hub" && \(\s*\n\s*<Hero/);
  });

  it("has exactly one hero in the tree, and it is conditional", () => {
    expect((code.match(/<Hero\b/g) || []).length).toBe(1);
  });

  it("docks the mark on views that have no hero", () => {
    // The effect must know whether the centre stage exists at all: no hero
    // means progress 1 (the navbar slot), never a mark hovering over content.
    expect(code).toMatch(/heroModeRef\.current = tab === "hub"/);
    expect(code).toMatch(/const home = heroModeRef\.current/);
    expect(code).toMatch(/if \(!home \|\| reduced\)/);
  });

  it("re-measures when the hero appears or disappears", () => {
    // It used to be queried once per mount, which breaks the moment the hero
    // can unmount. measure() re-queries, and the observer follows it.
    expect(code).toMatch(/const hero = document\.querySelector\("\.hero-content"\)/);
    expect(code).toMatch(/ro\.unobserve\(previousHero\)/);
  });
});

describe("a tab change starts at the top of the new view", () => {
  it("resets the scroll offset on view change", () => {
    expect(code).toMatch(/mainRef\.current\?\.focus\(\{ preventScroll: true \}\);\s*\n\s*window\.scrollTo\(0, 0\);/);
  });

  it("does not move focus and scroll on the very first paint", () => {
    // A deep link (#/gallery) must not be yanked around on load.
    const effect = code.slice(code.indexOf("firstViewFocus.current)"), code.indexOf("window.scrollTo(0, 0)"));
    expect(effect).toMatch(/return undefined;/);
  });
});

describe("every view has one h1", () => {
  const views = [
    ["EventsView.jsx", "t.upcomingPrograms"],
    ["GalleryView.jsx", "t.galleryTitle"],
    ["SevaView.jsx", "t.sevaTitle"],
    ["AboutView.jsx", "t.aboutTitle"],
  ];

  it.each(views)("%s opens on an <h1>", (file, title) => {
    const src = component(file);
    expect(src).toContain(`<h1 className="section-title display">{${title}}</h1>`);
    // …and never a second one
    expect((src.match(/<h1\b/g) || []).length).toBe(1);
  });

  it("keeps the homepage's single h1 in the hero", () => {
    const hero = component("Hero.jsx");
    expect((hero.match(/<h1\b/g) || []).length).toBe(1);
    // no other component may claim an h1 on the home view
    for (const [file] of views) expect(component(file)).not.toMatch(/<h1[^>]*>Oman Karnataka/);
  });

  it("never renders two h1s on the same view", () => {
    // About renders AboutView + two more components; only AboutView has the h1.
    const aboutTab = ["AboutView.jsx", "ContactView.jsx", "Contact.jsx"].map(component).join("\n");
    expect((aboutTab.match(/<h1\b/g) || []).length).toBe(1);
  });
});

describe("the mobile menu behaves like a menu", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  it("stops the page scrolling behind the open drawer", () => {
    expect(css).toMatch(/body:has\(\.nav-drawer\) \{ overflow: hidden; \}/);
  });

  it("lets the drawer itself scroll on a short viewport", () => {
    const block = css.slice(css.indexOf(".nav-drawer {", css.indexOf("body:has(.nav-drawer)")));
    expect(block).toContain("max-height: calc(100dvh");
    expect(block).toContain("overflow-y: auto");
    expect(block).toContain("overscroll-behavior: contain");
  });
});

describe("the archive reads as curated, not as a CMS listing", () => {
  const hub = component("ContentHub.jsx");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("leads with recordings as the featured resource", () => {
    // The recordings section keeps the full section head…
    expect(hub).toMatch(/<h2 className="section-title display">\{t\.programsRecordings\}<\/h2>/);
    // …and appears before the secondary material.
    expect(hub.indexOf("programsRecordings")).toBeLessThan(hub.indexOf("archiveReading"));
  });

  it("gives blog + festival notes ONE heading, not two more section heads", () => {
    expect(hub).toMatch(/<h2 className="section-title display">\{t\.archiveReading\}<\/h2>/);
    // the two lists are labelled as sub-sections instead
    expect((hub.match(/<h3 className="archive-label">/g) || []).length).toBe(2);
    expect(hub).toContain("{t.fromBlog}");
    expect(hub).toContain("{t.festivalNotes}");
  });

  it("lays them out as a secondary two-column band", () => {
    expect(hub).toContain('className="archive-columns"');
    expect(css).toMatch(/\.archive-columns \{[^}]*grid-template-columns: 1fr;/);
    expect(css).toMatch(/@media \(min-width: 900px\)/);
    expect(css).toMatch(/\.archive-label \{/);
  });

  it("keeps every archive link and its content", () => {
    // no content was dropped to make the layout nicer
    expect(hub).toContain("blogPosts.map");
    expect(hub).toContain("festivalPosts.map");
    expect(hub).toContain("videos.map");
  });
});

describe("the voices are visible, readable tiles", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const block = css.slice(css.indexOf(".voices-name {"), css.indexOf(".voices-note"));

  it("gives every name a visible container again", () => {
    // The roll-of-honour treatment (bare names, dot separators) is what the
    // owner's screenshots show as unreadable: with nothing else on the line the
    // dots looked like debris. The tiles are back — and they are the thing that
    // makes the block read as a list of people.
    expect(block).toMatch(/border: 1px solid var\(--line\)/);
    expect(block).toMatch(/background: var\(--panel\)/);
    expect(block).toMatch(/border-radius: var\(--r-pill\)/);
  });

  it("carries the separation in the GAP, not in a character", () => {
    // The old `::after` dot sat inside each name, so a wrapped flex line ended
    // with a stray "·" — the "hanging dots" in the report.
    expect(css).not.toMatch(/\.voices-name:not\(:last-child\)::after/);
    expect(css).not.toMatch(/content: "·"/);
    expect(css).toMatch(/\.voices-names \{[^}]*gap:/);
  });

  it("keeps the list semantics and the centring", () => {
    const voices = component("Voices.jsx");
    expect(voices).toContain('<ul className="voices-names">');
    expect(voices).toContain("<li key={p.id}");
    expect(css).toMatch(/\.voices-names \{[^}]*justify-content: center/);
  });
});

describe("the header can never be overprinted by the wordmark", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("lets the wordmark shrink and ellipsise instead of sliding under the icons", () => {
    // The owner's screenshot: "OMKAR SAMITHI" running beneath the theme and
    // language buttons, because neither the text nor its group could shrink.
    // Every `.wordmark` rule that can apply must be able to truncate — the
    // responsive ones included, or a breakpoint could reintroduce the overflow.
    const rules = [...css.matchAll(/\.wordmark \{[^}]*\}/g)].map((m) => m[0]);
    expect(rules.length).toBeGreaterThanOrEqual(3);
    for (const rule of rules) {
      if (rule.includes("white-space: nowrap")) {
        expect(rule, rule).toMatch(/overflow: hidden/);
        expect(rule, rule).toMatch(/text-overflow: ellipsis/);
        expect(rule, rule).toMatch(/min-width: 0/);
      }
    }
    expect(rules.some((r) => /min-width: 0/.test(r) && /text-overflow: ellipsis/.test(r))).toBe(true);
  });

  it("keeps the action buttons their full size and the left group shrinkable", () => {
    expect(css).toMatch(/\.header-actions \{ flex: 0 0 auto; \}/);
    expect(css).toMatch(/\.header-left \{[^}]*min-width: 0/);
  });
});

describe("the header wordmark steps down by what fits, and is never cut mid-word", () => {
  // The owner's phones read "OMKAR S…": beside four controls a 390px screen
  // leaves the wordmark 85px and the whole name needs 129px. Rather than truncate,
  // it steps down — the whole name, its first word, nothing — at widths measured
  // in a real browser with the real typefaces.
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const header = readFileSync(new URL("../src/components/Header.jsx", import.meta.url), "utf8");

  // MEASURED (Chromium, Cinzel / Noto Sans Kannada, 0.85rem, 0.05em tracking).
  // Re-measure these if the header's controls or the wordmark's type change.
  const NEED = { en: { full: 129.2, lead: 58.2 }, kn: { full: 85.8, lead: 44 } };
  const ROOM = (width, lang) => width - (lang === "en" ? 305 : 320); // what the four controls leave

  const queries = [...css.matchAll(/@media \(max-width: ([\d.]+)em\) \{\s*([^{}]+)\{([^{}]*)\}\s*\}/g)].map((m) => ({
    px: Number(m[1]) * 16,
    selector: m[2].trim(),
    body: m[3],
  }));
  const tailQuery = queries.find((q) => q.selector === ".wordmark-tail");
  const noneQuery = queries.find((q) => q.selector === ".wordmark");

  it("splits the translated name into a lead word and a tail, inventing no text", () => {
    expect(header).toMatch(/const \[nameLead, \.\.\.nameRest\] = t\.appName\.split\(" "\);/);
    expect(header).toMatch(/<span className="wordmark-tail"> \{nameRest\.join\(" "\)\}<\/span>/);
    // still decorative: the logo's alt text and the menu's label carry the name
    expect(header).toMatch(/<div className="wordmark display" aria-hidden="true">/);
  });

  it("hides the tail from 439px down and the whole wordmark from 374px down", () => {
    expect(tailQuery, "a max-width query must hide .wordmark-tail").toBeTruthy();
    expect(noneQuery, "a max-width query must hide .wordmark").toBeTruthy();
    expect(tailQuery.body).toMatch(/display: none/);
    expect(noneQuery.body).toMatch(/display: none/);
    expect(tailQuery.px).toBe(439);
    expect(noneQuery.px).toBe(374);
    expect(noneQuery.px).toBeLessThan(tailQuery.px);
  });

  it("writes the steps in em, so they move with the visitor's text size", () => {
    expect(css).toMatch(/@media \(max-width: 27\.4375em\)/);
    expect(css).toMatch(/@media \(max-width: 23\.375em\)/);
  });

  it("never shows a step that does not fit — in either language, at every phone width", () => {
    expect(tailQuery && noneQuery).toBeTruthy();
    for (let width = 320; width <= 767; width += 1) {
      const state = width <= noneQuery.px ? "none" : width <= tailQuery.px ? "lead" : "full";
      if (state === "none") continue;
      for (const lang of ["en", "kn"]) {
        // 640px and up the header has more room and a bigger wordmark: out of scope
        // of this model, which covers the phone header (<= 600px).
        if (width > 600) continue;
        const spare = ROOM(width, lang) - NEED[lang][state];
        expect(spare, `${lang} ${state} at ${width}px`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("would NOT fit without the steps — that is the defect this replaces", () => {
    // The whole English name on a 390px screen: 85px of room for 129px of text.
    expect(ROOM(390, "en")).toBeLessThan(NEED.en.full);
    expect(ROOM(412, "en")).toBeLessThan(NEED.en.full);
    // ...and the first word alone fits where the whole name does not.
    expect(ROOM(390, "en")).toBeGreaterThan(NEED.en.lead);
  });

  it("keeps the ellipsis as the last line of defence", () => {
    const rules = [...css.matchAll(/\.wordmark \{[^}]*\}/g)].map((m) => m[0]);
    expect(rules.some((r) => /text-overflow: ellipsis/.test(r) && /overflow: hidden/.test(r))).toBe(true);
  });
});

describe("Kannada is legible in the small labels", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("raises and de-tracks the footer headings when the document is Kannada", () => {
    // ಅನ್ವೇಷಿಸಿ / ಸಂಪರ್ಕ at 0.66rem with 0.2em tracking — the owner could not
    // read them. Kannada has no upper case and sets wider than Latin.
    expect(css).toMatch(/:root\[lang="kn"\] \.footer-col-title \{[^}]*font-size: 0\.86rem/);
    expect(css).toMatch(/:root\[lang="kn"\] \.footer-col-title \{[^}]*letter-spacing: 0\.05em/);
    expect(css).toMatch(/:root\[lang="kn"\] \.footer-link/);
  });

  it("does not touch the English sizes", () => {
    // The un-scoped rule keeps its own values; only `:root[lang="kn"]` overrides.
    const base = css.slice(
      css.lastIndexOf("\n.footer-col-title {"),
      css.lastIndexOf("\n.footer-col-title {") + 220
    );
    expect(base).toMatch(/font-size: 0\.66rem/);
    expect(base).toMatch(/letter-spacing: 0\.2em/);
  });
});

describe("the logo is served at the resolution it is drawn at", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  it("offers a 2x source, because the mark is drawn at 220 CSS px", () => {
    // A 220px file on a 2x/3x screen is upscaled at the most prominent element.
    expect(app).toMatch(/srcSet="\/omkar-logo\.png 220w, \/icon-512\.png 512w"/);
    expect(app).toMatch(/sizes="220px"/);
  });

  it("keeps the plain src for browsers without srcset support", () => {
    expect(app).toMatch(/src="\/omkar-logo\.png"/);
  });

  it("both candidates are the same artwork, so nothing shifts", () => {
    // 220x220 and 512x512: same square aspect, same framing (checked
    // pixel-wise in the audit). The geometry reads naturalWidth/Height, so a
    // mismatch here would move or resize the mark.
    const png = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url));
    const dims = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    expect(dims(png("omkar-logo.png"))).toEqual([220, 220]);
    expect(dims(png("icon-512.png"))).toEqual([512, 512]);
  });

  it("hands a retina screen the same pixels as WebP, not a 334 kB PNG", () => {
    // The 512 PNG is the app icon: 334 kB for a mark drawn at 220 CSS px. The
    // phones that complained about jitter are exactly the screens that pick
    // the 512 candidate, so they get the WebP twin (50 kB) instead. Same
    // widths, same sizes — only the format differs.
    expect(app).toContain('type="image/webp"');
    expect(app).toMatch(/srcSet="\/omkar-logo-220\.webp 220w, \/omkar-logo-512\.webp 512w"/);
    expect(app).toContain("<picture>");
  });

  it("keeps the PNG pair as the fallback, at the same widths", () => {
    // Both lists carry the same 220w/512w candidates and the same sizes, so a
    // browser without WebP selects the same entry by width and the mark's
    // rendered size cannot differ between formats.
    const webp = app.slice(app.indexOf("<picture>"), app.indexOf("</picture>"));
    expect(webp).toMatch(/srcSet="\/omkar-logo\.png 220w, \/icon-512\.png 512w"/);
    expect(webp).toMatch(/src="\/omkar-logo\.png"/);
    expect((webp.match(/sizes="220px"/g) || []).length).toBe(2);
  });

  it("preloads that exact list from index.html, and the two cannot drift", () => {
    // The mark is rendered by the bundle, so without the hint the fetch cannot
    // start until React has run. The preload must name the same candidates as
    // the <picture>; a mismatch would download twice.
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const list = "/omkar-logo-220.webp 220w, /omkar-logo-512.webp 512w";
    expect(html).toContain(`imagesrcset="${list}"`);
    expect(html).toContain('imagesizes="220px"');
    expect(html).toContain('rel="preload"');
    expect(app).toContain(`srcSet="${list}"`);
  });

  it("ships the twins as real WebP at the right size, and lighter than the PNG", () => {
    // Magic number, canvas size and weight — the three things a wrong file
    // (a renamed PNG, an icon export at another size) would fail.
    const read = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url));
    const webpDims = (buf) => {
      expect(buf.subarray(0, 4).toString("latin1")).toBe("RIFF");
      expect(buf.subarray(8, 12).toString("latin1")).toBe("WEBP");
      // Lossy WebP with alpha is wrapped in an extended-format VP8X chunk,
      // whose canvas size is stored 24-bit little-endian, minus one.
      expect(buf.subarray(12, 16).toString("latin1")).toBe("VP8X");
      return [
        buf.readUIntLE(24, 3) + 1,
        buf.readUIntLE(27, 3) + 1,
      ];
    };
    const pairs = [
      ["omkar-logo-220.webp", "omkar-logo.png", [220, 220]],
      ["omkar-logo-512.webp", "icon-512.png", [512, 512]],
    ];
    for (const [webp, png, dims] of pairs) {
      const w = read(webp);
      expect(webpDims(w)).toEqual(dims);
      // a WebP that is not actually smaller would be pure extra weight
      expect(w.length).toBeLessThan(read(png).length);
    }
  });

  it("precaches the twins, so the first offline visit still shows the mark", () => {
    const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
    expect(sw).toContain('"/omkar-logo-220.webp"');
    expect(sw).toContain('"/omkar-logo-512.webp"');
    expect(sw).toContain('"/omkar-logo.png"'); // the fallback stays too
  });
});

describe("the program rows show the next occurrence, never the past one", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  it("derives the programme list through upcomingEvents", () => {
    // The defect: rollDates() answers "which day is this programme in THIS
    // year", so on 8 October 2026 the rows still said 1 April and 2 October —
    // both already past — under the heading "Upcoming Programs".
    expect(app).toMatch(/upcomingEvents\(events\)/);
    expect(app).toMatch(/import \{[^}]*upcomingEvents[^}]*\} from "\.\/utils\/events\.js"/);
  });

  it("hands that list to the program rows, the homepage blocks and the calendar", () => {
    // ContentHub carries the homepage program blocks, EventsView carries the
    // rows and the calendar. Both must get the rolled list.
    expect(app).toMatch(/<ContentHub[\s\S]{0,180}events=\{programs\}/);
    expect(app).toMatch(/<EventsView[\s\S]{0,180}events=\{programs\}/);
  });

  it("gives the Seva page the same list, so it cannot print a past year", () => {
    // Third surface found by reading the owner's screenshots: the Seva page's
    // "Our Yearly Programs" chips printed the curated list verbatim — on
    // 8 October 2026 they still said "1 April 2026" and "2 October 2026".
    expect(app).toMatch(/<SevaView[\s\S]{0,160}events=\{programs\}/);
    const view = readFileSync(new URL("../src/components/SevaView.jsx", import.meta.url), "utf8");
    expect(view).toContain("const programs =");
    expect(view).toContain("programs.map((e) => (");
    // and no longer maps the raw curated list into the chips
    expect(view).not.toMatch(/\{t\.eventsList\.map/);
  });

  it("keeps the same-year list for the lamps, which need a lit past programme", () => {
    // PR #8's rule: a lamp stays lit from a month before its programme until
    // New Year, so after the April programme the lamp is still burning. Feeding
    // the lamps the rolled list would put it out early.
    expect(app).toMatch(/<Hero[\s\S]{0,120}events=\{events\}/);
    const diya = readFileSync(new URL("../src/utils/events.js", import.meta.url), "utf8");
    expect(diya).toMatch(/export function rollDates/);
    expect(diya).toMatch(/This is what the LAMPS render/);
  });

  it("never sends a row an event it must hide, so reminders cannot fire for a past day", () => {
    // toggleNotify fires the "upcoming program" notification straight away.
    // With the rows rolled forward there is no past date left to tap.
    const utils = readFileSync(new URL("../src/utils/events.js", import.meta.url), "utf8");
    const body = utils.slice(utils.indexOf("export function upcomingEvents"));
    expect(body).toContain("if (thisYear && thisYear >= today) return thisYear;");
    expect(body).toContain("return occurrenceInYear(date, year + 1);");
  });
});

describe("the sitemap advertises only what exists", () => {
  const xml = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");

  it("no longer lists the retired donations page", () => {
    // Donations were removed at the owner's request; the sitemap still pointed
    // search engines at a page that no longer exists.
    expect(xml).not.toContain("donate");
  });

  it("lists the root and the four real tabs", () => {
    expect(xml).toContain("https://omkar-app.vercel.app/</loc>");
    for (const tab of ["events", "gallery", "seva", "about"]) {
      expect(xml, tab).toContain(`#/${tab}`);
    }
  });
});

describe("reduced motion switches the flight off entirely", () => {
  it("asks the OS, and listens for a change", () => {
    expect(code).toMatch(/matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
    expect(code).toMatch(/motionQuery\.addEventListener\("change", onMotionChange\)/);
    expect(code).toMatch(/motionQuery\.removeEventListener\("change", onMotionChange\)/);
  });

  it("snaps between the two resting states instead of gliding", () => {
    expect(code).toMatch(/scrollY > 24 \? 1 : 0/);
  });

  it("does not run the eased flight when motion is reduced", () => {
    // the smoothstep lives only in the un-reduced branch
    const snapped = code.slice(
      code.indexOf("if (!home || reduced)"),
      code.indexOf("let p = scrollY / flightPx")
    );
    expect(snapped).not.toMatch(/smoothstep/);
    expect(snapped).not.toMatch(/p \* p \* \(3 - 2 \* p\)/);
  });

  it("keeps the CSS switch for everything CSS animates", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
