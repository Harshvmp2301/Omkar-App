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
