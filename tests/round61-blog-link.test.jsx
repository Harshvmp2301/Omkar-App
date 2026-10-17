import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, beforeAll } from "vitest";
import App from "../src/App.jsx";
import { translations } from "../src/data/content.js";

/* Round 61, the owner's requests: "add a link to their blogspot" and
   "also add this: instagram.com/omkarsamithi" — the Samithi's own blog,
   the source of every gallery photograph, and its Instagram both get
   footer links beside YouTube/Facebook and ahead of the separate
   feedback blog. Brand names (Instagram) stay untranslated like
   YouTube/Facebook; the blog label has its Kannada mirror, as every
   KN/EN change requires. */

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

describe("round 61 — the footer links to the Samithi's blog and Instagram", () => {
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

  it("carries the blog link in the rendered footer, opening in a new tab", () => {
    const html = render();
    const homeHref = 'href="https://omkarsamithi.blogspot.com/"';
    expect(html).toContain(homeHref);
    // the anchor is a footer link with the same new-tab manners as its siblings
    const idx = html.indexOf(homeHref);
    // generous window: React emits the svg icon between the anchor's
    // attributes and its text label
    const around = html.slice(Math.max(0, idx - 300), idx + 1200);
    expect(around).toContain('class="footer-link"');
    expect(around).toContain('target="_blank"');
    expect(around).toContain('rel="noreferrer"');
    // the rendered label is the dictionary's own
    expect(around).toContain(translations.en.footerBlog);
  });

  it("keeps the feedback blog too, and reads socials before blogs", () => {
    const html = render();
    expect(html).toContain('href="https://omkarfeedback.blogspot.com/"');
    const facebook = html.indexOf('href="https://www.facebook.com/groups/omkarsamithi/"');
    const instagram = html.indexOf('href="https://www.instagram.com/omkarsamithi/"');
    const blog = html.indexOf('href="https://omkarsamithi.blogspot.com/"');
    const feedback = html.indexOf('href="https://omkarfeedback.blogspot.com/"');
    expect(facebook).toBeLessThan(instagram);
    expect(instagram).toBeLessThan(blog);
    expect(blog).toBeLessThan(feedback);
  });

  it("labels the link in both languages — identical keys, native text", () => {
    expect(translations.en.footerBlog).toBe("Blog");
    expect(translations.kn.footerBlog).toBe("ಬ್ಲಾಗ್");
  });
});
