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
    ["EventsView.jsx", "t.allPrograms"],
    ["GalleryView.jsx", "t.galleryTitle"],
    ["SevaView.jsx", "t.sevaTitle"],
    ["AboutView.jsx", "t.aboutTitle"],
    ["AlertsView.jsx", "t.alertsTitle"],
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

describe("the festival calendar fits a phone", () => {
  // The owner's screenshot: "Omkar Naadamruth" cut mid-word. Measured in a real
  // browser it was worse — a plain `1fr` track takes its minimum from its CONTENT,
  // so one long chip widened its own column and starved the rest (72/23/110/23/
  // 65/23/88px inside a 348px wrapper on a 390px phone), and the calendar's
  // overflow: hidden sliced the Saturday column clean off. With a zero track
  // minimum the seven columns are equal and the chips' own ellipsis truncates.
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const grid = css.slice(css.indexOf(".cal-grid {"), css.indexOf("}", css.indexOf(".cal-grid {")));
  const cell = css.slice(css.indexOf(".cal-cell {"), css.indexOf("}", css.indexOf(".cal-cell {")));
  const chipRules = [...css.matchAll(/\.cal-chip \{[^}]*\}/g)].map((m) => m[0]).join("\n");

  it("gives the seven tracks a zero minimum, so no chip can widen its column", () => {
    expect(grid).toMatch(/grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
    expect(grid).not.toMatch(/repeat\(7, 1fr\)/);
  });

  it("lets the cells shrink with their track", () => {
    expect(cell).toMatch(/min-width: 0/);
  });

  it("truncates a long name with an ellipsis, never a hard slice", () => {
    expect(chipRules).toMatch(/overflow: hidden/);
    expect(chipRules).toMatch(/text-overflow: ellipsis/);
    expect(chipRules).toMatch(/white-space: nowrap/);
  });

  it("keeps the full name in the DOM and in a tooltip", () => {
    const cal = readFileSync(new URL("../src/components/FestivalCalendar.jsx", import.meta.url), "utf8");
    expect(cal).toMatch(/title=\{`\$\{it\.title\}/);
    expect(cal).toMatch(/>\s*\{it\.title\}\s*</);
  });
});

describe("Kannada display type uses the loaded Kannada webfont", () => {
  // The wordmark, eyebrows, buttons and headings set in --font-display used to
  // fall through to whatever serif the DEVICE has — a different face from the
  // body, and empty boxes on a phone with no Kannada system font. Cinzel has no
  // Kannada glyphs, so Kannada now takes Noto Sans Kannada; Latin keeps Cinzel.
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  it("lists the webfont between Cinzel and the generic serif", () => {
    expect(css).toMatch(/--font-display: 'Cinzel', 'Noto Sans Kannada', serif;/);
  });

  it("routes every element through the two tokens — no hardcoded family", () => {
    // Seven rules hardcoded 'Cinzel', serif or 'Karla', sans-serif (the primary
    // button, festival titles, calendar chips, captions, form fields, seva
    // cards). A hardcoded stack skips the token, so its Kannada fell through to
    // the device — tofu on a phone with no Kannada system font. The tokens are
    // the single place the faces are named.
    expect(css).not.toMatch(/font-family: '(Cinzel|Karla)'/);
  });
});

describe("the viewer hint speaks touch as well as keys", () => {
  // It read "Use ← → keys or click to browse · Esc to close" on phones, which
  // have neither keys nor a mouse. Both languages now lead with the gesture a
  // phone has, and keep the keyboard path for desktops.
  const content = readFileSync(new URL("../src/data/content.js", import.meta.url), "utf8");
  const en = content.match(/lightboxHint: "([^"]*)",/g).join("\n");
  it("leads with swipe and arrows in English, and drops the keys-only wording", () => {
    expect(en).toMatch(/Swipe or use the arrows to browse/);
    expect(en).not.toMatch(/keys or click/);
  });
  it("mirrors it in Kannada", () => {
    expect(en).toMatch(/ಸ್ವೈಪ್ ಅಥವಾ ಬಾಣಗಳಿಂದ ಬ್ರೌಸ್ ಮಾಡಿ/);
    expect(en).not.toMatch(/ಕೀಗಳನ್ನು/);
  });
});

describe("short phones get the CTA row onto the first screen", () => {
  // On a phone around 745px tall the (already single) row of hero buttons sat
  // 15-40px below the fold: the mark's reserved clearance plus the copy is
  // taller than the viewport. The mark's size and centre are untouchable, so
  // the recoverable height is spacing — margins and padding only, phones only,
  // short viewports only.
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const at = css.indexOf("@media (max-width: 700px) and (max-height: 790px)");
  const rule = at === -1 ? "" : css.slice(at, css.indexOf("}", css.indexOf(".hero-ctas", at)) + 1);

  it("exists, and tightens only spacing", () => {
    expect(at, "the short-phone media query must exist").toBeGreaterThan(-1);
    expect(rule).toMatch(/\.hero \{ padding-bottom: 14px; \}/);
    expect(rule).toMatch(/\.hero-ctas \{ margin-top: 10px; gap: 8px; \}/);
  });

  it("never touches the mark", () => {
    expect(rule).not.toMatch(/app-logo|clamp\(88px/);
  });

  it("leaves tall phones, tablets and desktops alone", () => {
    expect(rule).not.toMatch(/min-width/);
    // the base rule (the one carrying the flex row) keeps its full spacing
    expect(css).toMatch(/\.hero-ctas \{[^}]*margin-top: 18px/);
  });
});

describe("the header wordmark keeps the whole name on phones", () => {
  // Round 23 stepped the name down to its first word beside the four controls
  // ("OMKAR" instead of "OMKAR SAMITHI") because one line needs ~129px and a 390px
  // phone offers ~85px. The owner read that as the name losing half of itself —
  // rightly. Two lines cost nothing: the header row is 44px tall for the buttons
  // and two 0.8rem lines are ~30px, so the header keeps ONE row and its height
  // (measured 65px at every width, both languages). Below 360px even two lines
  // cannot fit, so there the wordmark yields to the logo and the menu label.
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const header = readFileSync(new URL("../src/components/Header.jsx", import.meta.url), "utf8");
  const band = (px) => {
    const em = String(parseFloat((px / 16).toFixed(4)));
    const at = css.indexOf(`@media (max-width: ${em}em)`);
    if (at === -1) return "";
    return css.slice(at, css.indexOf("}", css.indexOf("}", at) + 1) + 1);
  };
  const wrapBand = band(439);
  const smallBand = band(374);
  const hideBand = band(359);

  it("renders the translated name whole — no lead/tail split left behind", () => {
    expect(header).not.toMatch(/wordmark-tail/);
    expect(header).not.toMatch(/nameLead/);
    expect(header).toMatch(/<div className="wordmark display" aria-hidden="true">\s*\{t\.appName\}\s*<\/div>/);
  });

  it("wraps to two lines on phones instead of truncating or dropping a word", () => {
    expect(wrapBand, "the 439px band must exist").toContain(".header-left .wordmark");
    expect(wrapBand).toMatch(/white-space: normal/);
    expect(wrapBand).toMatch(/overflow: visible/);
    expect(wrapBand).toMatch(/text-overflow: clip/);
    expect(wrapBand).not.toMatch(/nowrap/);
    expect(wrapBand).not.toMatch(/ellipsis/);
    expect(wrapBand).not.toMatch(/display: none/);
  });

  it("uses the higher-specificity selector, or the 600px nowrap rule would win", () => {
    // the <=600px rule sets .header-left .wordmark { white-space: nowrap }; a
    // plainer .wordmark here loses that tie on every phone and silently reverts
    // to one truncated line (this exact regression was caught in the browser).
    expect(wrapBand).toMatch(/\.header-left \.wordmark \{/);
  });

  it("steps the type down once more before it gives up entirely", () => {
    expect(smallBand).toMatch(/\.header-left \.wordmark \{ font-size: 0\.72rem; \}/);
    expect(hideBand).toMatch(/\.header-left \.wordmark \{ display: none; \}/);
  });

  it("keeps the ellipsis only as the desktop last line of defence", () => {
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

describe("the program rows show stored dates — never the past, never an invented year", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  it("derives the programme list through upcomingEvents", () => {
    // The defect: rollDates() answers "which day is this programme in THIS
    // year", so on 8 October 2026 the rows still said 1 April and 2 October —
    // both already past — under the heading "Upcoming Programs".
    expect(app).toMatch(/upcomingEvents\(events\)/);
    expect(app).toMatch(/import \{[^}]*upcomingEvents[^}]*\} from "\.\/utils\/events\.js"/);
  });

  it("hands the upcoming list to the homepage, the bells and the reminder line", () => {
    // ContentHub carries the homepage program blocks; the bells and the
    // reminder line must never attach to a date that has passed.
    expect(app).toMatch(/<ContentHub[\s\S]{0,180}events=\{programs\}/);
    expect(app).toMatch(/<ReminderStrip[\s\S]{0,120}programs=\{programs\}/);
  });

  it("gives the Events tab and the Seva chips the year's record, stored dates", () => {
    // Round 31: a visitor who wants to check when a PAST program was finds it
    // on the Events page, marked "Held", at the date the dashboard stores —
    // and the Seva page's chips read the same stored list.
    expect(app).toMatch(/<EventsView[\s\S]{0,180}events=\{yearList\}/);
    expect(app).toMatch(/<SevaView[\s\S]{0,160}events=\{yearList\}/);
    expect(app).toMatch(/const yearList = useMemo\(\(\) => sortedByDate\(events\)/);
  });

  it("feeds the lamps their own same-year view, not the record", () => {
    expect(app).toMatch(/<Hero[\s\S]{0,120}events=\{lamps\}/);
    expect(app).toMatch(/const lamps = useMemo\(\(\) => rollDates\(events\)/);
  });

  it("gives the Seva page the stored list, so its chips match the dashboard", () => {
    // Third surface found by reading the owner's screenshots: the Seva page's
    // "Our Yearly Programs" chips printed the curated list verbatim — on
    // 8 October 2026 they still said "1 April 2026" and "2 October 2026".
    expect(app).toMatch(/<SevaView[\s\S]{0,160}events=\{yearList\}/);
    const view = readFileSync(new URL("../src/components/SevaView.jsx", import.meta.url), "utf8");
    expect(view).toContain("const programs =");
    expect(view).toContain("programs.map((e) => (");
    // and no longer maps the raw curated list into the chips
    expect(view).not.toMatch(/\{t\.eventsList\.map/);
  });

  it("keeps the same-year list for the lamps, which need a lit past programme", () => {
    // PR #8's rule: a lamp stays lit from a month before its programme until
    // New Year, so after the April programme the lamp is still burning.
    const diya = readFileSync(new URL("../src/utils/events.js", import.meta.url), "utf8");
    expect(diya).toMatch(/export function rollDates/);
    expect(diya).toMatch(/This is what the LAMPS render/);
  });

  it("never sends a row a year nobody entered, so reminders cannot fire for one", () => {
    // toggleNotify fires the "upcoming program" notification straight away,
    // and the reminder line counts down to programs[0]: both must only ever
    // see dates the dashboard actually stores.
    const utils = readFileSync(new URL("../src/utils/events.js", import.meta.url), "utf8");
    const body = utils.slice(
      utils.indexOf("export function upcomingEvents"),
      utils.indexOf("export function nextEvent")
    );
    expect(body).not.toContain("occurrenceInYear");
    expect(body).toContain("dateOnly(event.date) >= today");
    // the lamps keep their same-year view, and only the lamps
    expect(utils).toMatch(/export function rollDates/);
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

describe("very short phones trade the duplicated eyebrow for the fold", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const hero = readFileSync(new URL("../src/components/Hero.jsx", import.meta.url), "utf8");
  const bandStart = css.indexOf("@media (max-width: 700px) and (max-height: 46.5em)");
  const band = bandStart === -1 ? "" : css.slice(bandStart, css.indexOf("\n}", bandStart));

  it("has a band for phones up to 744px tall, the measured hole", () => {
    expect(bandStart).toBeGreaterThan(-1);
    expect(band).toContain("max-height: 46.5em");
  });

  it("steps the eyebrow aside there, because the header already says the name", () => {
    expect(band).toContain(".hero .hero-eyebrow { display: none; }");
  });

  it("tightens only spacing inside the band", () => {
    expect(band).toContain(".hero { padding-bottom: 10px; }");
    expect(band).toContain(".hero h1 { margin: 4px 0 2px; }");
    expect(band).toContain(".hero .hero-line { margin-top: 4px; line-height: 1.5; }");
    expect(band).toContain(".hero-ctas { margin-top: 8px; }");
  });

  it("never touches the mark, its centre or the type scale inside the band", () => {
    expect(band).not.toContain(".app-logo");
    expect(band).not.toContain("clamp(");
    expect(band).not.toContain("font-size");
    expect(band).not.toContain("transform");
  });

  it("keeps the eyebrow everywhere the band does not match", () => {
    // the base rule still paints it on tall phones, tablets and desktops ...
    expect(css).toMatch(/\.hero \.hero-eyebrow \{\n\s*margin: 0 0 8px;/);
    // ... and the markup still carries it, so nothing is removed from the page
    expect(hero).toContain('className="hero-eyebrow display"');
  });

  it("leaves the round-24 short-phone band exactly as it was", () => {
    const r24 = css.slice(css.indexOf("@media (max-width: 700px) and (max-height: 790px)"));
    expect(r24.slice(0, r24.indexOf("\n}"))).toContain("padding-bottom: 14px");
  });
});

describe("the dashboard's events section is three fixed tiles, update-only", () => {
  const admin = readFileSync(new URL("../src/admin/views/EventsAdmin.jsx", import.meta.url), "utf8");

  it("builds one tile per program from the single source of names", () => {
    expect(admin).toContain('import { EVENT_TITLES, eventRowFromForm }');
    expect(admin).toContain("EVENT_TITLES.map(");
  });

  it("lets the admin update dates and guests, and nothing else", () => {
    expect(admin).toContain('type="date"');
    expect(admin).toContain("guest_en");
    expect(admin).toContain("guest_kn");
    // no way to add, rename or delete a program from the dashboard
    expect(admin).not.toContain(".delete(");
    expect(admin).not.toContain("<select");
  });

  it("gives the Anjaneya Pooje tile the date alone", () => {
    expect(admin).toContain('const WITH_GUEST = new Set(["Omkar Jnanamrutha", "Omkar Naadamrutha"]);');
    expect(admin).toContain("WITH_GUEST.has(en)");
  });

  it("updates the stored row when there is one, inserts it the first time", () => {
    expect(admin).toContain('? await supabase.from("events").update(payload).eq("id", row.id)');
    expect(admin).toContain(': await supabase.from("events").insert(payload)');
  });

  it("wires round 33: public opt-in tab, sender invoke, custom block", () => {
    // The installed-app opt-in is a first-class tab, not an admin favour.
    expect(readFileSync(new URL("../src/utils/route.js", import.meta.url), "utf8"))
      .toContain('"alerts"');
    expect(app).toContain("AlertsView");
    expect(readFileSync(new URL("../src/components/Header.jsx", import.meta.url), "utf8"))
      .toContain("t.alertsTab");
    // Save and custom-send both ask the edge function to deliver now.
    expect(admin).toContain('supabase.functions.invoke("push-send")');
    const pushAdmin = readFileSync(new URL("../src/admin/views/PushAdmin.jsx", import.meta.url), "utf8");
    expect(pushAdmin).toContain('supabase.rpc("push_custom"');
    expect(pushAdmin).toContain("Send to everyone");
    // The sender itself lives in the repo, reading the queue and the subs.
    const sender = readFileSync(new URL("../supabase/functions/push-send/index.ts", import.meta.url), "utf8");
    expect(sender).toContain("push_outbox");
    expect(sender).toContain("push_subscriptions");
    expect(sender).toContain("pollFeed");
    // Kannada parity for the new public page.
    const content = readFileSync(new URL("../src/data/content.js", import.meta.url), "utf8");
    expect(content).toContain('alertsTab: "ಸೂಚನೆಗಳು"');
  });

  it("edits exactly the row the public site reads, and publishes it", () => {
    // Round 32: the public fetch is published=eq.true ordered by starts_at, so
    // a tile that ignores `published` can save into invisibility — which is
    // exactly what happened to the owner's 7 December save.
    expect(admin).toContain("(b.published === true) - (a.published === true)");
    expect(admin).toContain("published: true,");
    expect(admin).toContain("stored rows carry this program's name");
  });
});
