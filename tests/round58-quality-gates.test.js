import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  declaredSize,
  isLogoFile,
  MIN_SOURCE_PX,
  postsToImageRows,
} from "../api/gallery-sync.js";

const sync = readFileSync(new URL("../api/gallery-sync.js", import.meta.url), "utf8");

const REAL_1 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/REAL1/w640-h426/DSC02368.JPG";
const REAL_2 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/REAL2/w640-h426/DSC02369.JPG";
const LOGO_IN_BODY =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/EMB/s1600/Omkar%20Logo%20Final%20Transparent.png";
const MUD_IN_BODY =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/SMALL/w200-h150/thumb-old.jpg";
// Blogger's feed thumbnail of a body photograph shares its path
const THUMB = REAL_1.replace("/w640-h426/", "/s72-w640-h426-c/");

describe("round 58 — the quality gates", () => {
  it("reads the pixels a Blogger URL declares", () => {
    expect(declaredSize(REAL_1)).toBe(426);
    expect(declaredSize("https://x/img/s1600/a.jpg")).toBe(1600);
    expect(declaredSize("https://x/img/a/AV=s60")).toBe(60);
    expect(declaredSize("https://x/img/a/AV=s600")).toBe(600);
    expect(declaredSize(THUMB)).toBe(426); // w-h branch wins over s72
    expect(declaredSize("https://x/img/a/AV=s72-c/b.jpg")).toBe(72);
    expect(declaredSize("https://x/img/plain-name.jpg")).toBeNull();
  });

  it("knows the Samithi's mark by its filename, wherever it hides", () => {
    expect(
      isLogoFile("https://blogger.googleusercontent.com/img/b/R29/s220/Omkar%20Logo%20Final%20Transparent.png")
    ).toBe(true);
    expect(isLogoFile(LOGO_IN_BODY)).toBe(true);
    expect(isLogoFile(REAL_1)).toBe(false);
    expect(isLogoFile(THUMB)).toBe(false);
  });

  it("keeps real photographs and drops logo, mud and avatars from the body", async () => {
    const body =
      '<div class="post-body entry-content">' +
      `<img src="${LOGO_IN_BODY}">` +
      `<img src="${MUD_IN_BODY}">` +
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
    expect(urls[0]).toContain("/s1600/DSC02368.JPG");
    expect(urls[1]).toContain("/s1600/DSC02369.JPG");
    // since round 59 the compound feed thumbnail (s72-w640-h426-c of
    // DSC02368.JPG) normalizes to /s1600/DSC02368.JPG and DEDUPES against
    // the same photograph's body row — no second, blurry tile
    expect(rows).toHaveLength(2);
    for (const u of urls) {
      expect(u).not.toContain("Logo");
      expect(u).not.toContain("w200-h150");
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

  it("is wired into the sync at the documented floor", () => {
    expect(sync).toContain("export const MIN_SOURCE_PX = 400");
    expect(MIN_SOURCE_PX).toBe(400);
    expect(sync).toContain("if (isLogoFile(src)) continue;");
    expect(sync).toContain("if (size !== null && size < MIN_SOURCE_PX) continue;");
  });
});
