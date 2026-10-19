import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeAll } from "vitest";
import App from "../src/App.jsx";

/* Round 62, the owner's report: the footer "looks odd" and "takes up one
   whole screen on the phone." It did: eleven 44px links stacked under the
   brand, ~800px of footer on a ~740px viewport. The restructure keeps the
   desktop three columns exactly as they are and, below 700px, centres the
   brand, wraps Explore as one text line and Connect as hairline chips.
   These tests pin both halves: the new compact phone rules AND the
   untouched things — desktop grid, iOS safe-area, every link still there. */

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

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

const render = () => renderToStaticMarkup(<App />);

describe("round 62 — the footer stops eating the phone screen", () => {
  // the new rules only, from the Round 62 comment to the end of their media
  // block — nothing after it can masquerade as one of them
  const start = css.indexOf("/* Round 62:");
  const r62 = css.slice(start, css.indexOf("\n}", start));

  it("flows both link columns horizontally on phones, Connect as chips", () => {
    expect(r62).toContain(".footer-col {");
    expect(r62).toContain("flex-direction: row;");
    expect(r62).toContain("flex-wrap: wrap;");
    expect(r62).toContain(".footer-col--connect .footer-link {");
    expect(r62).toContain("border-radius: 999px;");
    // compact but still a real tap target (WCAG 2.5.5 minimum is 24px)
    expect(r62).toContain("min-height: 36px;");
    expect(r62).toContain("text-align: center;");
  });

  it("leaves the desktop footer exactly as it was", () => {
    expect(css).toContain(
      "grid-template-columns: minmax(0, 1.5fr) repeat(2, minmax(0, 1fr));"
    );
    // the un-scoped .footer-col-title keeps the sizes the KN-legibility
    // tests measure (navigation-guards pins the same rule)
    const base = css.slice(
      css.lastIndexOf("\n.footer-col-title {"),
      css.lastIndexOf("\n.footer-col-title {") + 220
    );
    expect(base).toContain("font-size: 0.66rem");
  });

  it("keeps the iOS safe-area padding under the footer", () => {
    expect(css).toContain(
      "padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px))"
    );
  });

  it("still renders every link, with the Connect column marked for the chips", () => {
    const html = render();
    expect(html).toContain('class="footer-col footer-col--connect"');
    expect(html).toContain('aria-label="Explore"');
    for (const href of [
      "mailto:",
      "https://www.youtube.com/@OmkarSamithi",
      "https://www.facebook.com/groups/omkarsamithi/",
      "https://www.instagram.com/omkarsamithi/",
      "https://omkarsamithi.blogspot.com/",
      "https://omkarfeedback.blogspot.com/",
    ]) {
      expect(html).toContain(href);
    }
    // the four Explore buttons survive as buttons
    expect((html.match(/class="footer-link"/g) || []).length).toBeGreaterThanOrEqual(11);
  });
});
