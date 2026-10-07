import { describe, expect, it } from "vitest";
import { directionsUrl } from "./venue.js";
import { translations } from "../data/content.js";

describe("directionsUrl — a venue name into a maps link", () => {
  it("searches for exactly the venue the site shows", () => {
    const venue = translations.en.eventsList[0].venue;
    expect(directionsUrl(venue)).toBe(
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(venue)
    );
  });

  it("carries the Kannada venue through unchanged", () => {
    const venue = translations.kn.eventsList[0].venue;
    const url = directionsUrl(venue);
    expect(url).toContain(encodeURIComponent(venue));
  });

  it("trims stray whitespace rather than searching for it", () => {
    expect(directionsUrl("  Sri Krishna Temple, Darsait, Muscat  ")).toBe(
      directionsUrl("Sri Krishna Temple, Darsait, Muscat")
    );
  });

  it("returns nothing for an empty venue, so no dead button is rendered", () => {
    expect(directionsUrl("")).toBe("");
    expect(directionsUrl("   ")).toBe("");
    expect(directionsUrl(null)).toBe("");
    expect(directionsUrl(undefined)).toBe("");
  });

  it("never invents an address — the link contains only what was passed in", () => {
    const url = directionsUrl("Sri Krishna Temple, Darsait, Muscat");
    const query = decodeURIComponent(url.split("query=")[1]);
    expect(query).toBe("Sri Krishna Temple, Darsait, Muscat");
  });
});
