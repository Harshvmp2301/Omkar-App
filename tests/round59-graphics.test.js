import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isKnownGraphic, postsToImageRows } from "../api/gallery-sync.js";

const sync = readFileSync(new URL("../api/gallery-sync.js", import.meta.url), "utf8");

// The two addresses the owner right-clicked out of his gallery (round 59):
// the circular emblem and the red Hanuman clipart.
const EMBLEM =
  "https://blogger.googleusercontent.com/img/a/AVvXsEhGWvUTc87Lk6vByLYNHAjqGQKfxG6v8yKy4_F8jaZypvC_WSf55Xrtv7BcAVB1Ge9AnsPRygklTfO9ZVDtAecQD2FdB-8qrLigzUUnVUE5do6LP1VmoA11TmtN3yTVEeQaVPej9fYVZo0RsrtuQ-Ku9_RTtKB7Unv-fDsepzE7xa57-lY8p-c37C4NEXMA=s480";
const CLIPART =
  "https://blogger.googleusercontent.com/img/a/AVvXsEiCM4efEpKw5L18T3xe3wuRMQ35zhdGOt304cRf6obKr5lO12rbaS9SRbwqT6zwprbiXSvlTI4reTOny6conin95gXKbvLJtM2eulc8lL3s-XVcNw_8r8R8l1StchL6DoZDCx_nTbrTCGYdmMxOHp8BEU1MH_7Xpj-01m5TPs4GY0x4JvsVpt-SkwmhNi8L=s480";
const REAL =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/REAL1/w640-h426/DSC02368.JPG";
// Blogger's feed thumbnail of a body photograph shares its path
const THUMB = REAL.replace("/w640-h426/", "/s72-w640-h426-c/");

function postWith(html, thumb = "") {
  return [
    {
      title: "ಓಂಕಾರ ನಾದಾಮೃತ ೨೦೨೬",
      url: "https://omkarsamithi.blogspot.com/2026/10/blog-post.html",
      published: "2026-10-02T00:00:00Z",
      html,
      thumb,
    },
  ];
}

/* Round 60 revision: the byte probe is GONE — Google's image servers
   answer content-type questions with whatever they negotiate (WebP for a
   real JPEG photograph), and the probe wrongly wiped out every post-2019
   picture. What stays from round 59: the blocklist of the two identified
   graphics, and the compound-thumbnail sharpening. */
describe("round 59 (as revised in round 60) — named graphics, sharp thumbs", () => {
  it("knows the two identified graphics by address, at any size token", () => {
    expect(isKnownGraphic(EMBLEM)).toBe(true);
    expect(isKnownGraphic(CLIPART)).toBe(true);
    expect(isKnownGraphic(EMBLEM.replace("=s480", "=s1600"))).toBe(true);
    expect(isKnownGraphic(REAL)).toBe(false);
  });

  it("drops both identified graphics even though they sit in the body at 480px", async () => {
    const rows = await postsToImageRows(
      postWith(
        `<div class="post-body entry-content"><img src="${EMBLEM}"><img src="${CLIPART}"><img src="${REAL}"></div>`
      ),
      "omkarsamithi.blogspot.com",
      "2026-10-17T00:00:00.000Z",
      async () => ""
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toContain("/s1600/DSC02368.JPG");
  });

  it("stores the compound feed thumbnail at full size, sharp and deduped", async () => {
    // thumb-only post: the crumb normalizes to s1600, not stored as mud
    const solo = await postsToImageRows(
      postWith("", THUMB),
      "omkarsamithi.blogspot.com",
      "2026-10-17T00:00:00.000Z",
      async () => ""
    );
    expect(solo).toHaveLength(1);
    expect(solo[0].url).toContain("/s1600/DSC02368.JPG");
    expect(solo[0].thumb_url).toContain("/s480/DSC02368.JPG");

    // same photo in the body AND as the feed thumb: one row, not two
    const dupes = await postsToImageRows(
      postWith(`<div class="post-body entry-content"><img src="${REAL}"></div>`, THUMB),
      "omkarsamithi.blogspot.com",
      "2026-10-17T00:00:00.000Z",
      async () => ""
    );
    expect(dupes).toHaveLength(1);
    expect(dupes[0].url).toContain("/s1600/DSC02368.JPG");
  });

  it("asks no bytes any more — round 60 removed the probe", () => {
    expect(sync).toContain("if (isKnownGraphic(src)) continue;");
    expect(sync).not.toContain("isPastedGraphic");
    expect(sync).not.toContain("content-type");
    expect(sync).not.toContain("fetchImage");
    // atSize still rewrites Blogger's compound thumbnail token
    expect(sync).toContain("s\\d+-w\\d+-h\\d+");
  });
});
