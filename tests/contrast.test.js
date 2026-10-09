import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Palette contrast, computed from the stylesheet itself.
 *
 * Why this exists: the light theme shipped bright gold text on a cream ground.
 * Every one of those colours measured between 1.5:1 and 2.4:1 — a WCAG AA
 * failure by a factor of two or three, invisible in a screenshot review and
 * easy to reintroduce by hand. So the numbers are asserted, not eyeballed:
 * this reads the real tokens, resolves the `var()` chains the browser would,
 * and fails if any text colour stops being legible.
 *
 * Dark theme values are unchanged from the approved design (they all pass with
 * room to spare); the light theme routes TEXT through `--gold-text*`, which is
 * deepened, while borders, fills and the lamps keep the bright metal.
 */

// Comments may name the old colours; only declarations are evidence.
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

/* ── a tiny CSS token reader ─────────────────────────────────────────────── */

function declarations(selector) {
  const out = new Map();
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim();
    if (sel !== selector) continue;
    for (const decl of m[2].split(";")) {
      const i = decl.indexOf(":");
      if (i === -1) continue;
      const name = decl.slice(0, i).trim();
      const value = decl.slice(i + 1).trim();
      if (name.startsWith("--")) out.set(name, value);
    }
  }
  return out;
}

// Both `:root` blocks (base palette + the premium-layer tokens) compose the
// dark theme; the light block overrides it.
const dark = new Map([...declarations(":root")]);
for (const [k, v] of declarations(":root")) dark.set(k, v);
const light = new Map([...dark, ...declarations(':root[data-theme="light"]')]);

/** Resolve `var(--x)` chains down to a literal value. */
function resolve(map, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`circular token: ${name}`);
  seen.add(name);
  const raw = map.get(name);
  if (raw === undefined) throw new Error(`token not defined: ${name}`);
  const ref = raw.match(/^var\((--[\w-]+)\)$/);
  if (ref) return resolve(map, ref[1], seen);
  return raw;
}

/* ── WCAG relative luminance / contrast ──────────────────────────────────── */

function hexToRgb(hex) {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_TOKENS = [
  "--ivory",
  "--muted",
  "--gold-text",
  "--gold-text-bright",
  "--gold-text-hot",
  "--display-grad-from",
  "--display-grad-to",
];

describe.each([
  ["dark", dark],
  ["light", light],
])("%s theme contrast (WCAG 2.1 AA)", (themeName, tokens) => {
  const bg = resolve(tokens, "--bg");

  it("has a resolvable ground colour", () => {
    expect(bg).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(TEXT_TOKENS)("%s is legible on the ground", (token) => {
    const ratio = contrast(resolve(tokens, token), bg);
    expect(ratio, `${token} on ${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the label on gold fills legible", () => {
    const ratio = contrast(resolve(tokens, "--on-gold"), resolve(tokens, "--gold"));
    expect(ratio, `--on-gold on --gold is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("separates body text from its muted sibling by design, not accident", () => {
    // Not a rule, just a sanity check that the two are distinct colours
    expect(resolve(tokens, "--ivory")).not.toBe(resolve(tokens, "--muted"));
  });
});

describe.each([
  ["dark", dark],
  ["light", light],
])("%s theme: text on every surface it is painted on", (themeName, tokens) => {
  // Cards, fields and the drawer are lighter/darker than the ground, so a
  // colour that passes on the page can still fail inside a panel.
  const surfaces = ["--bg", "--panel", "--panel-light", "--field"];

  it.each(surfaces)("%s carries legible text", (surface) => {
    const bg = resolve(tokens, surface);
    for (const token of ["--ivory", "--muted", "--gold-text", "--gold-text-bright"]) {
      const ratio = contrast(resolve(tokens, token), bg);
      expect(ratio, `${token} on ${surface} (${bg}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("gold is two jobs, and they are two tokens", () => {
  const code = css;

  it("never paints text with the decorative gold", () => {
    // `color: var(--gold)` / `--gold-bright` / `--gold-hot` / `--gold-deep` is
    // the bug this whole file guards: on cream those measure 1.5–3.3:1.
    expect(code).not.toMatch(/(?:^|[\s;{])color:\s*var\(--gold\)/m);
    expect(code).not.toMatch(/(?:^|[\s;{])color:\s*var\(--gold-bright\)/m);
    expect(code).not.toMatch(/(?:^|[\s;{])color:\s*var\(--gold-hot\)/m);
    expect(code).not.toMatch(/(?:^|[\s;{])color:\s*var\(--gold-deep\)/m);
  });

  it("routes text through the text tokens instead", () => {
    const uses = (code.match(/color:\s*var\(--gold-text/g) || []).length;
    expect(uses).toBeGreaterThan(40);
  });

  it("keeps the bright gold for decoration", () => {
    // If this drops to zero the accents were flattened to the text colour.
    expect((code.match(/border-color:\s*var\(--gold(-bright)?\)/g) || []).length).toBeGreaterThan(8);
  });

  it("keeps the light theme deeper than the dark one, not brighter", () => {
    // On a light ground the text gold must be DARKER than the ground; on a
    // dark ground it must be lighter. This is the direction the fix depends on.
    const lightGold = luminance(resolve(light, "--gold-text"));
    const darkGold = luminance(resolve(dark, "--gold-text"));
    expect(lightGold).toBeLessThan(luminance(resolve(light, "--bg")));
    expect(darkGold).toBeGreaterThan(luminance(resolve(dark, "--bg")));
  });
});

/* ── the focus ring ──────────────────────────────────────────────────────── */
/**
 * A focus ring is not decoration, it is the only thing telling a keyboard user
 * where they are, so SC 1.4.11 (non-text contrast) applies: 3:1 against
 * whatever the ring is drawn on. The light theme shipped the bright metal
 * (#DCB849) here, which measures 1.79:1 on the cream ground and 1.10:1 on a
 * gold-filled button — an indicator that was effectively invisible. These
 * assertions are what stop it coming back.
 */
describe.each([
  ["dark", dark],
  ["light", light],
])("%s theme: the focus ring is visible (WCAG 2.1 SC 1.4.11)", (themeName, tokens) => {
  const ring = resolve(tokens, "--focus-ring");

  it("is a real colour", () => {
    expect(ring).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(["--bg", "--panel", "--panel-light", "--field"])(
    "clears 3:1 on %s",
    (surface) => {
      const bg = resolve(tokens, surface);
      const ratio = contrast(ring, bg);
      expect(ratio, `--focus-ring on ${surface} (${bg}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  );

});

describe("the light focus ring also survives a gold-filled control", () => {
  // The ring is drawn outside the element (outline-offset), so its real
  // backdrop is the page or a card. This covers the remaining case — a
  // gold-filled control sitting on gold — for the LIGHT theme, which is the one
  // that was wrong. The dark theme's ring is deliberately unchanged (its bright
  // metal is 10.4:1 on the ground and it is the approved appearance), so no new
  // constraint is placed on it here.
  it("clears 3:1 on --gold", () => {
    const ratio = contrast(resolve(light, "--focus-ring"), resolve(light, "--gold"));
    expect(ratio, `--focus-ring on --gold is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });
});

describe("the focus ring is a token, and the old one cannot come back", () => {
  it("draws every focus ring from --focus-ring", () => {
    const rings = css.match(/outline:\s*2px solid var\((--[\w-]+)\)/g) || [];
    expect(rings.length).toBeGreaterThanOrEqual(2);
    for (const rule of rings) expect(rule).toContain("var(--focus-ring)");
  });

  it("leaves no focus ring on the decorative bright gold", () => {
    // The regression: `outline: 2px solid var(--gold-bright)` is 1.79:1 on
    // cream, and it was the ONLY indicator there was.
    expect(css).not.toMatch(/outline:\s*2px solid var\(--gold-bright\)/);
  });

  it("keeps the light ring off the colour that failed", () => {
    expect(resolve(light, "--focus-ring").toLowerCase()).not.toBe("#dcb849");
    expect(contrast("#DCB849", resolve(light, "--bg"))).toBeLessThan(3); // the reason it went
  });

  it("keeps the dark ring exactly as it was — the change is light-theme only", () => {
    expect(resolve(dark, "--focus-ring")).toBe(resolve(dark, "--gold-bright"));
  });

  it("stays a two-pixel ring, not a hairline", () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus-ring\)/);
  });
});
