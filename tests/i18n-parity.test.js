import { describe, it, expect } from "vitest";
import { translations } from "../src/data/content.js";

const en = translations.en;
const kn = translations.kn;
const enKeys = Object.keys(en);
const knKeys = Object.keys(kn);

describe("bilingual content parity", () => {
  it("has identical key sets in English and Kannada", () => {
    expect([...knKeys].sort()).toEqual([...enKeys].sort());
  });

  // A tripwire against accidental truncation, not a target to grow towards.
  // It was 100 while the Donate tab existed; removing that tab deleted 8
  // donate-only keys from each locale, so the floor moved to match. Parity
  // between the locales is the real guard — this only catches a bad merge
  // that wipes large parts of the dictionary.
  it("guards against accidental truncation (≥95 keys)", () => {
    expect(enKeys.length).toBeGreaterThanOrEqual(95);
    expect(knKeys.length).toBeGreaterThanOrEqual(95);
  });

  it("has no empty string values in either locale", () => {
    for (const [loc, dict] of [
      ["en", en],
      ["kn", kn],
    ]) {
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value === "string") {
          expect(value.trim().length, `${loc}.${key} empty`).toBeGreaterThan(0);
        } else if (Array.isArray(value)) {
          expect(value.length, `${loc}.${key} empty array`).toBeGreaterThan(0);
        } else if (value && typeof value === "object") {
          expect(
            Object.keys(value).length,
            `${loc}.${key} empty object`
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});
