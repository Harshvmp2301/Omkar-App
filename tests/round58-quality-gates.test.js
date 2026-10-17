import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isLogoFile, postsToImageRows } from "../api/gallery-sync.js";

const sync = readFileSync(new URL("../api/gallery-sync.js", import.meta.url), "utf8");

const REAL_1 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/REAL1/w640-h426/DSC02368.JPG";
const REAL_2 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/REAL2/w640-h426/DSC02369.JPG";
const LOGO_IN_BODY =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/EMB/s1600/Omkar%20Logo%20Final%20Transparent.png";
const SMALL_IN_BODY =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/SMALL/w200-h150/old-embed.jpg";
// Blogger's feed thumbnail of a body photograph shares its path
const THUMB = REAL_1.replace("/w640-h426/", "/s72-w640-h426-c/");

/* Round 60 revision of the round-58 contract: the owner's ruling is KEEP
   every page image — the 400px quality floor is gone with the byte probe.
   What stays from round 58 is the logo-filename gate. */
describe("round 58 (as revised in round 60) — the logo-filename gate", () => {
  it("knows the Samithi's mark by its filename, wherever it hides", () => {
    expect(
      isLogoFile("https://blogger.googleusercontent.com/img/b/R29/s220/Omkar%20Logo%20Final%20Transparent.png")
    ).toBe(true);
    expect(isLogoFile(LOGO_IN_BODY)).toBe(true);
    expect(isLogoFile(REAL_1)).toBe(false);
    expect(isLogoFile(THUMB)).toBe(false);
  });

  it("drops logo and avatars from the body but KEEPS every other image, small ones included", async () => {
    const body =
      '<div class="post-body entry-content">' +
      `<img src="${LOGO_IN_BODY}">` +
      `<img src="${SMALL_IN_BODY}">` +
      `<img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AV/w72-h72-p-k-no-nu/x.jpg">` +
      `<img src="${REAL_1}">` +
      `<img src="${REAL_2}">` +
      "</div>";
    const rows = await postsToImageRows(
      [
        {
          title: "ಓಂಕಾರ ನಾದಾಮೃತ ೨೦೨೬",
          url: "https://omkarsamithi.blogspot.com/2026/10/blog-post.html",
          published: "2026-10-02T00:00:00Z",
          html: "",
          thumb: THUMB,
        },
      ],
      "omkarsamithi.blogspot.com",
      "2026-10-17T00:00:00.000Z",
      async () => body
    );
    const urls = rows.map((r) => r.url);
    // the small embed is a page image — the owner's ruling keeps it
    expect(urls[0]).toContain("/s1600/old-embed.jpg");
    expect(urls[1]).toContain("/s1600/DSC02368.JPG");
    expect(urls[2]).toContain("/s1600/DSC02369.JPG");
    // the compound feed thumb of DSC02368 normalizes to the same full URL
    // and dedupes against the body row — no second, blurry tile
    expect(rows).toHaveLength(3);
    for (const u of urls) {
      expect(u).not.toContain("Logo");
      expect(u).not.toContain("w72-h72");
    }
  });

  it("trusts URLs that carry no size token at all", async () => {
    const untokened =
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/PLAIN/event-photo.jpg";
    const rows = await postsToImageRows(
      [
        {
          title: "Post",
          url: "https://omkarsamithi.blogspot.com/2026/10/x.html",
          published: "2026-10-02T00:00:00Z",
          html: "",
          thumb: "",
        },
      ],
      "omkarsamithi.blogspot.com",
      "2026-10-17T00:00:00.000Z",
      async () =>
        `<div class="post-body entry-content"><img src="${untokened}"></div>`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe(untokened);
  });

  it("has no pixel floor any more — round 60 removed it", () => {
    expect(sync).toContain("if (isLogoFile(src)) continue;");
    expect(sync).not.toContain("MIN_SOURCE_PX");
    expect(sync).not.toContain("declaredSize");
  });
});
