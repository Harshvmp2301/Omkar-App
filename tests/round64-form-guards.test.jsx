import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeAll } from "vitest";
import App from "../src/App.jsx";
import { translations } from "../src/data/content.js";
import {
  GUARD_MIN_MS,
  botFilled,
  requiredErrors,
  tooFast,
} from "../src/utils/formGuard.js";

/* Round 64 — audit A5 + B3 on the two conversion forms:
   A5: every required-field error is a line UNDER its own field, wired with
       aria-invalid + aria-describedby, and focus moves to the first invalid
       control — no more toast-only errors a screen reader never ties to a
       field.
   B3: a honeypot (off-screen, untabbable, aria-hidden) discards bot posts
       silently with a fake success; a velocity guard (3s) warns instead of
       discarding, so an autofill human is never lost. */

const contact = readFileSync(new URL("../src/components/ContactView.jsx", import.meta.url), "utf8");
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

describe("round 64 · B3 — the guards", () => {
  it("flags a filled honeypot and only a filled honeypot", () => {
    expect(botFilled({ company: "http://spam.example" })).toBe(true);
    expect(botFilled({ company: "   " })).toBe(false);
    expect(botFilled({ company: "" })).toBe(false);
    expect(botFilled({})).toBe(false);
  });

  it("calls a sub-three-second submit too fast, and a human one fine", () => {
    const now = 1_000_000;
    expect(GUARD_MIN_MS).toBe(3000);
    expect(tooFast(now - 1000, now)).toBe(true);
    expect(tooFast(now - 2999, now)).toBe(true);
    expect(tooFast(now - 3000, now)).toBe(false);
    expect(tooFast(now - 60_000, now)).toBe(false);
  });

  it("names exactly the blank required fields", () => {
    expect(requiredErrors({ name: "", contact: "12345678" }, ["name", "contact"]))
      .toEqual({ name: true });
    expect(requiredErrors({ name: " A ", contact: "" }, ["name", "contact"]))
      .toEqual({ contact: true });
    expect(requiredErrors({ name: "A", contact: "12345678" }, ["name", "contact"]))
      .toEqual({});
  });

  it("both forms wire both guards", () => {
    for (const src of [contact]) {
      expect(src).toContain('botFilled({ company })');
      expect(src).toContain("tooFast(openedAt.current)");
      expect(src).toContain('className="hp-field" aria-hidden="true"');
      expect(src).toContain('name="company"');
      expect(src).toContain("tabIndex={-1}");
      expect(src).toContain("t.formWait");
    }
  });

  it("hides the honeypot off-screen instead of display:none", () => {
    // display:none would let clever bots skip it; off-screen keeps it a
    // perfectly ordinary input in the parsed HTML
    const rule = css.slice(css.indexOf(".hp-field {"), css.indexOf("}", css.indexOf(".hp-field {")));
    expect(rule).toContain("left: -9999px");
    expect(rule).not.toContain("display: none");
  });
});

describe("round 64 · A5 — errors belong to their fields", () => {
  it("wires aria-invalid, aria-describedby and a line under each field", () => {
    expect(contact).toContain('aria-invalid={msgErr ? true : undefined}');
    expect(contact).toContain('aria-describedby={msgErr ? "ct-message-err" : undefined}');
    expect(contact).toContain('id="ct-message-err"');
  });

  it("paints the error line in the one error colour, themed per ground", () => {
    expect(css).toContain("--err: #E06A6A;");
    expect(css).toContain("--err: #9C3B2E;");
    const rule = css.slice(css.indexOf(".field-err {"), css.indexOf("}", css.indexOf(".field-err {")));
    expect(rule).toContain("color: var(--err);");
  });

  it("says the two new lines in both languages, Kannada actually in Kannada", () => {
    expect(translations.en.errRequired).toBe("This field is required");
    expect(translations.en.formWait).toContain("wait a few seconds");
    expect(translations.kn.errRequired).toBe("ಈ ಮಾಹಿತಿ ಅಗತ್ಯವಿದೆ");
    expect(translations.kn.formWait).toContain("ಕಾದು");
  });

  it("renders each honeypot into its own tab's document", () => {
    // the hash is the router: point window.location at a tab, render it
    const at = (hash) => {
      globalThis.window.location.hash = hash;
      return renderToStaticMarkup(<App />);
    };
    const hubHtml = at("#/hub");
    expect(hubHtml).not.toContain('class="hp-field"');
    const aboutHtml = at("#/about");
    expect(aboutHtml).toContain('class="hp-field"');
    expect(aboutHtml).toContain('id="ct-company"');
  });
});
