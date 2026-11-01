import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, beforeAll } from "vitest";
import App from "../src/App.jsx";
import { translations } from "../src/data/content.js";

/* Round 61 added the Samithi's blog and its Instagram to the footer.
   Round 70 retired the blog completely — the owner's ruling: "the whole
   existence of Omkar Sandesh should be neglected while making of this
   website and PWA." The Instagram link (round 61's other half) stays; the
   Sandesh blog leaves the footer, the structured data and the dictionary,
   and this test now guards both facts. The separate FEEDBACK blog
   (omkarfeedback.blogspot.com) is a different property and stays. */

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

describe("round 61 — the footer links to the Samithi's Instagram", () => {
  it("carries the Instagram link in the rendered footer, opening in a new tab", () => {
    const html = render();
    const instaHref = 'href="https://www.instagram.com/omkarsamithi/"';
    expect(html).toContain(instaHref);
    const idx = html.indexOf(instaHref);
    const around = html.slice(Math.max(0, idx - 300), idx + 1200);
    expect(around).toContain('class="footer-link"');
    expect(around).toContain('target="_blank"');
    expect(around).toContain('rel="noreferrer"');
    // brand names stay untranslated, like YouTube and Facebook
    expect(around).toContain("Instagram");
  });

  it("keeps the feedback blog and reads socials before it", () => {
    const html = render();
    expect(html).toContain('href="https://omkarfeedback.blogspot.com/"');
    const facebook = html.indexOf('href="https://www.facebook.com/groups/omkarsamithi/"');
    const instagram = html.indexOf('href="https://www.instagram.com/omkarsamithi/"');
    const feedback = html.indexOf('href="https://omkarfeedback.blogspot.com/"');
    expect(facebook).toBeLessThan(instagram);
    expect(instagram).toBeLessThan(feedback);
  });
});

describe("round 70 — Omkar Sandesh has left the building", () => {
  it("no footer link, no dictionary key, no structured-data mention", () => {
    const html = render();
    expect(html).not.toContain("omkarsamithi.blogspot.com");
    expect(translations.en.footerBlog).toBeUndefined();
    expect(translations.kn.footerBlog).toBeUndefined();
  });
});
