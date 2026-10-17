import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  isKnownGraphic,
  isPastedGraphic,
  postsToImageRows,
} from "../api/gallery-sync.js";

const sync = readFileSync(new URL("../api/gallery-sync.js", import.meta.url), "utf8");

// The two addresses the owner right-clicked out of his gallery (round 59):
// the circular emblem and the red Hanuman clipart.
const EMBLEM =
  "https://blogger.googleusercontent.com/img/a/AVvXsEhGWvUTc87Lk6vByLYNHAjqGQKfxG6v8yKy4_F8jaZypvC_WSf55Xrtv7BcAVB1Ge9AnsPRygklTfO9ZVDtAecQD2FdB-8qrLigzUUnVUE5do6LP1VmoA11TmtN3yTVEeQaVPej9fYVZo0RsrtuQ-Ku9_RTtKB7Unv-fDsepzE7xa57-lY8p-c37C4NEXMA=s480";
const CLIPART =
  "https://blogger.googleusercontent.com/img/a/AVvXsEiCM4efEpKw5L18T3xe3wuRMQ35zhdGOt304cRf6obKr5lO12rbaS9SRbwqT6zwprbiXSvlTI4reTOny6conin95gXKbvLJtM2eulc8lL3s-XVcNw_8r8R8l1StchL6DoZDCx_nTbrTCGYdmMxOHp8BEU1MH_7Xpj-01m5TPs4GY0x4JvsVpt-SkwmhNi8L=s480";
const NAMELESS =
  "https://blogger.googleusercontent.com/img/a/AVvXsEhBRANDNEWpastedgraphicnotyetknownXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX=s480";
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

const neverFetch = async () => {
  throw new Error("no network in tests");
};

function imageResponse(type, ok = true) {
  return { ok, headers: { get: (h) => (h === "content-type" ? type : null) } };
}

describe("round 59 — the graphics the owner pasted, and the muddy thumb", () => {
  it("knows the two identified graphics by address, at any size token", () => {
    expect(isKnownGraphic(EMBLEM)).toBe(true);
    expect(isKnownGraphic(CLIPART)).toBe(true);
    expect(isKnownGraphic(EMBLEM.replace("=s480", "=s1600"))).toBe(true);
    expect(isKnownGraphic(REAL)).toBe(false);
    expect(isKnownGraphic(NAMELESS)).toBe(false);
  });

  it("drops both identified graphics even though they sit in the body at 480px", async () => {
    const rows = await postsToImageRows(
      postWith(
        `<div class="post-body entry-content"><img src="${EMBLEM}"><img src="${CLIPART}"><img src="${REAL}"></div>`
      ),
      "omkarsamithi.blogspot.com",
      "2026-10-17T00:00:00.000Z",
      async () => "",
      neverFetch
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toContain("/s1600/DSC02368.JPG");
  });

  it("asks the bytes of a nameless new-editor URL: PNG is a graphic, JPEG is a photograph", async () => {
    const probes = [];
    const pngOnce = async (url) => {
      probes.push(url);
      return imageResponse("image/png");
    };
    const rows = await postsToImageRows(
      postWith(`<div class="post-body entry-content"><img src="${NAMELESS}"></div>`),
      "omkarsamithi.blogspot.com",
      "2026-10-17T00:00:00.000Z",
      async () => "",
      pngOnce
    );
    expect(rows).toHaveLength(0);
    // probed at the 3KB size, never the full one
    expect(probes).toHaveLength(1);
    expect(probes[0]).toBe(NAMELESS.replace("=s480", "=s72"));

    const jpeg = async () => imageResponse("image/jpeg");
    const kept = await postsToImageRows(
      postWith(`<div class="post-body entry-content"><img src="${NAMELESS}"></div>`),
      "omkarsamithi.blogspot.com",
      "2026-10-17T00:00:00.000Z",
      async () => "",
      jpeg
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].url).toBe(NAMELESS.replace("=s480", "=s1600"));
  });

  it("never probes old-shaped URLs, and keeps a nameless one on any doubt", async () => {
    let calls = 0;
    const spy = async () => {
      calls += 1;
      return imageResponse("image/png");
    };
    // old shape: filename in the path — the name and size gates suffice
    expect(await isPastedGraphic(REAL, spy)).toBe(false);
    expect(await isPastedGraphic(THUMB, spy)).toBe(false);
    expect(calls).toBe(0);
    // doubt: fetch throws, response not ok, or content-type missing → KEEP
    expect(await isPastedGraphic(NAMELESS, neverFetch)).toBe(false);
    expect(await isPastedGraphic(NAMELESS, async () => imageResponse("image/png", false))).toBe(false);
    expect(await isPastedGraphic(NAMELESS, async () => ({ ok: true, headers: { get: () => "" } }))).toBe(false);
    expect(await isPastedGraphic(NAMELESS, async () => imageResponse("image/gif"))).toBe(true);
  });

  it("stores the compound feed thumbnail at full size, sharp and deduped", async () => {
    // thumb-only post: the crumb normalizes to s1600, not stored as mud
    const solo = await postsToImageRows(
      postWith("", THUMB),
      "omkarsamithi.blogspot.com",
      "2026-10-17T00:00:00.000Z",
      async () => "",
      neverFetch
    );
    expect(solo).toHaveLength(1);
    expect(solo[0].url).toContain("/s1600/DSC02368.JPG");
    expect(solo[0].thumb_url).toContain("/s480/DSC02368.JPG");

    // same photo in the body AND as the feed thumb: one row, not two
    const dupes = await postsToImageRows(
      postWith(`<div class="post-body entry-content"><img src="${REAL}"></div>`, THUMB),
      "omkarsamithi.blogspot.com",
      "2026-10-17T00:00:00.000Z",
      async () => "",
      neverFetch
    );
    expect(dupes).toHaveLength(1);
    expect(dupes[0].url).toContain("/s1600/DSC02368.JPG");
  });

  it("is wired into the sync loop", () => {
    expect(sync).toContain("if (isKnownGraphic(src)) continue;");
    expect(sync).toContain("if (await isPastedGraphic(src, fetchImage)) continue;");
    expect(sync).toContain("fetchImage = fetch");
    // atSize rewrites Blogger's compound thumbnail token
    expect(sync).toContain("s\\d+-w\\d+-h\\d+");
  });
});
