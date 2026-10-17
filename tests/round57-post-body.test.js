import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  extractImageUrls,
  postBodyHtml,
  postsToImageRows,
} from "../api/gallery-sync.js";

const sync = readFileSync(new URL("../api/gallery-sync.js", import.meta.url), "utf8");

/* A faithful miniature of the real post page the owner reported (round 57):
   the blog's header logo, a sidebar widget and the profile photo — which on
   this blog is the Omkar logo itself — sit BEFORE the body; the body holds
   two real photographs; the footer and the comments (two 72px avatars) come
   AFTER it. Nothing but the two real photographs may reach the table. */
const HEADER_IMG =
  "https://blogger.googleusercontent.com/img/a/AVvXsEhG-header=s60";
const SIDEBAR_IMG =
  "https://blogger.googleusercontent.com/img/a/AVvXsEiC-sidebar=s600";
const PROFILE_IMG =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/PROF/s220/Omkar%20Logo%20Final%20Transparent.png";
const REAL_1 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/REAL1/w640-h426/DSC02368.JPG";
const REAL_2 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/REAL2/w640-h426/DSC02369.JPG";
const AVATAR_1 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AV1/w72-h72-p-k-no-nu/DSC_8083.JPG";
const AVATAR_2 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AV2/w72-h72-p-k-no-nu/ON2018128.jpg";

const PAGE = [
  `<img alt="Omkar Samithi" id="Header1_headerimg" src="${HEADER_IMG}" style="display: block">`,
  `<img id="Image1_img" src="${SIDEBAR_IMG}" width="300">`,
  `<img alt="My photo" class="profile-img" src="${PROFILE_IMG}" height="80" width="80">`,
  '<div class="post-body entry-content" id="post-body-1">',
  `<img src="${REAL_1}">`,
  "<p>ನೆರೆದಿದ್ದ ಕಲಾಭಿಮಾನಿಗಳೆಲ್ಲರೂ ಮುಖದಲ್ಲಿ ತೃಪ್ತಿಯ ಮಂದಹಾಸ…</p>",
  `<img src="${REAL_2}">`,
  "</div>",
  '<div class="post-footer">',
  `<img src="${AVATAR_1}" border="0">`,
  `<img src="${AVATAR_2}" border="0">`,
  "</div>",
].join("\n");

describe("round 57 — only the post body's photographs are gallery material", () => {
  it("cuts the page down to the post body", () => {
    expect(extractImageUrls(postBodyHtml(PAGE))).toEqual([REAL_1, REAL_2]);
  });

  it("refuses to guess when the markers are missing", () => {
    expect(postBodyHtml("")).toBe("");
    expect(postBodyHtml("<html><body>no markers here</body></html>")).toBe("");
  });

  it("keeps working when the end marker is missing", () => {
    const noFooter = PAGE.slice(0, PAGE.indexOf('<div class="post-footer">'));
    expect(extractImageUrls(postBodyHtml(noFooter))).toEqual([REAL_1, REAL_2]);
  });

  it("stores the body's photographs and nothing else", async () => {
    const thumb =
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/TH/s72-w640-h426-c/DSC02368.JPG";
    const rows = await postsToImageRows(
      [
        {
          title: "ಓಂಕಾರ ನಾದಾಮೃತ ೨೦೨೬",
          url: "https://omkarsamithi.blogspot.com/2026/10/blog-post.html",
          published: "2026-10-02T00:00:00Z",
          html: "",
          thumb,
        },
      ],
      "omkarsamithi.blogspot.com",
      "2026-10-17T00:00:00.000Z",
      async () => PAGE
    );
    const urls = rows.map((r) => r.url);
    // the two real photographs, normalized to full size…
    expect(urls[0]).toContain("/s1600/DSC02368.JPG");
    expect(urls[1]).toContain("/s1600/DSC02369.JPG");
    // …and the feed thumbnail (its s72-w640-h426-c form is a real picture,
    // so the junk sieve must let it through)
    expect(urls).toContain(thumb);
    expect(rows).toHaveLength(3);
    // no logo, no widget, no profile, no avatar — by any of their signatures
    for (const u of urls) {
      expect(u).not.toContain("header=s60");
      expect(u).not.toContain("sidebar=s600");
      expect(u).not.toContain("s220");
      expect(u).not.toContain("w72-h72-p-k-no-nu");
      expect(u).not.toContain("Logo");
    }
    expect(rows[0].thumb_url).toContain("/s480/DSC02368.JPG");
  });

  it("sieves an avatar hidden INSIDE the body too", async () => {
    const trapped = PAGE.replace(
      `<img src="${REAL_2}">`,
      `<img src="${AVATAR_2}"><img src="${REAL_2}">`
    );
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
      async () => trapped
    );
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.url.includes("w72-h72-p-k-no-nu"))).toBe(false);
  });

  it("is wired into the sync", () => {
    expect(sync).toContain("export function postBodyHtml(pageHtml)");
    expect(sync).toContain("extractImageUrls(postBodyHtml(pageHtml))");
    expect(sync).toContain("if (JUNK_URL.test(src)) continue;");
  });
});
