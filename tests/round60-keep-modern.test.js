import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { postsToImageRows } from "../api/gallery-sync.js";

const sync = readFileSync(new URL("../api/gallery-sync.js", import.meta.url), "utf8");

/* The round-59 wipe, as the owner reported it: "only 2019-and-below
   images remain, around 300; the 2026 ones I used to see are gone."
   Post-2019 Blogger posts embed their photographs in the nameless
   /img/a/AV…=sNNN shape, and round 59's byte probe judged every one of
   them a pasted graphic (Google serves a real JPEG as WebP when it feels
   like it). Round 60's contract: KEEP every page image; the ONLY things
   out are the furniture slice (round 57), avatars and tiny border sizes
   (JUNK_URL), logo-named files, and the two graphics the owner named by
   address. This test is the regression guard for the wipe. */

const MODERN_1 =
  "https://blogger.googleusercontent.com/img/a/AVvXsEiMODERN-one-hash-hash-hash=s640";
const MODERN_2 =
  "https://blogger.googleusercontent.com/img/a/AVvXsEhMODERN-two-hash-hash-hash=s1600";
const MODERN_SMALL =
  "https://blogger.googleusercontent.com/img/a/AVvXsEjMODERN-three-hash-hash=s320";
const OLD_SHAPE =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/OLD/w640-h426/DSC02368.JPG";
const AVATAR =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AV1/w72-h72-p-k-no-nu/DSC_8083.JPG";
const LOGO =
  "https://blogger.googleusercontent.com/img/a/AVvXsEhG-logo-hash-hash=s1600/Omkar%20Logo%20Final%20Transparent.png";
const EMBLEM =
  "https://blogger.googleusercontent.com/img/a/AVvXsEhGWvUTc87Lk6vByLYNHAjqGQKfxG6v8yKy4_F8jaZypvC_WSf55Xrtv7BcAVB1Ge9AnsPRygklTfO9ZVDtAecQD2FdB-8qrLigzUUnVUE5do6LP1VmoA11TmtN3yTVEeQaVPej9fYVZo0RsrtuQ-Ku9_RTtKB7Unv-fDsepzE7xa57-lY8p-c37C4NEXMA=s480";

function rowsFor(bodyHtml) {
  return postsToImageRows(
    [
      {
        title: "ಓಂಕಾರ ನಾದಾಮೃತ ೨೦೨೬",
        url: "https://omkarsamithi.blogspot.com/2026/10/blog-post.html",
        published: "2026-10-02T00:00:00Z",
        html: "",
        thumb: "",
      },
    ],
    "omkarsamithi.blogspot.com",
    "2026-10-17T00:00:00.000Z",
    async () => bodyHtml
  );
}

describe("round 60 — every modern photograph comes home", () => {
  it("keeps ALL post-2019 nameless-shape photographs, at any declared size", async () => {
    const rows = await rowsFor(
      `<div class="post-body entry-content">` +
        `<img src="${MODERN_1}"><img src="${MODERN_2}"><img src="${MODERN_SMALL}">` +
        `</div>`
    );
    expect(rows.map((r) => r.url)).toEqual([
      MODERN_1.replace("=s640", "=s1600"),
      MODERN_2,
      MODERN_SMALL.replace("=s320", "=s1600"),
    ]);
  });

  it("keeps old-shape photographs beside them, and still drops only the named junk", async () => {
    const rows = await rowsFor(
      `<div class="post-body entry-content">` +
        `<img src="${OLD_SHAPE}"><img src="${MODERN_1}">` +
        `<img src="${AVATAR}"><img src="${LOGO}"><img src="${EMBLEM}">` +
        `</div>`
    );
    const urls = rows.map((r) => r.url);
    expect(urls).toEqual([
      OLD_SHAPE.replace("/w640-h426/", "/s1600/"),
      MODERN_1.replace("=s640", "=s1600"),
    ]);
    for (const u of urls) {
      expect(u).not.toContain("w72-h72");
      expect(u).not.toContain("Logo");
      expect(u).not.toContain("AVvXsEhGWvUTc87");
    }
  });

  it("carries no format probe and no pixel floor in the source", () => {
    expect(sync).not.toContain("isPastedGraphic");
    expect(sync).not.toContain("MIN_SOURCE_PX");
    expect(sync).not.toContain("declaredSize");
    expect(sync).toContain("if (JUNK_URL.test(src)) continue;");
    expect(sync).toContain("if (isLogoFile(src)) continue;");
    expect(sync).toContain("if (isKnownGraphic(src)) continue;");
  });
});
