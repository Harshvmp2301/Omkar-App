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

  it("guards against accidental truncation (≥100 keys)", () => {
    expect(enKeys.length).toBeGreaterThanOrEqual(100);
    expect(knKeys.length).toBeGreaterThanOrEqual(100);
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
