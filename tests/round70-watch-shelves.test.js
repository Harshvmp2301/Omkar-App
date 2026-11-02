import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { translations } from "../src/data/content.js";

/* Round 70 — the owner's voice ruling, in full: remove festival notes and
   the Omkar Sandesh blog completely ("the whole existence of Omkar Sandesh
   should be neglected while making of this website and PWA"), replace the
   recordings grid with three playlist shelves (one per standing program,
   the owner's own YouTube playlists), put the photographs BELOW that watch
   section, and give the section a name worth reading. These pins hold the
   ruling in place; the behaviour pins live in navigation-guards and
   youtube.test. */

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("round 70 — festival notes and Omkar Sandesh are gone", () => {
  it("drops every dictionary key of the archive band, both languages", () => {
    for (const lang of ["en", "kn"]) {
      const t = translations[lang];
      for (const key of [
        "programsRecordings",
        "fromBlog",
        "festivalNotes",
        "archiveReading",
        "sampleLayout",
        "videos",
        "blogPosts",
        "festivalPosts",
      ]) {
        expect(t[key], `${lang}.${key}`).toBeUndefined();
      }
    }
  });

  it("deletes the blogger integration outright", () => {
    expect(existsSync(new URL("../src/utils/blogger.js", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../src/utils/blogger.test.js", import.meta.url))).toBe(false);
    expect(read("../src/components/ReminderStrip.jsx")).not.toContain("blogger");
  });

  it("keeps no Sandesh address in the structured data", () => {
    const head = read("../index.html");
    expect(head).not.toContain("omkarsamithi.blogspot.com");
    // the feedback blog is a different property and stays
    expect(head).toContain("omkarfeedback.blogspot.com");
  });

  it("keeps the gallery sync — photographs still come from the blog, unseen", () => {
    const sync = read("../api/gallery-sync.js");
    expect(sync).toContain("omkarsamithi.blogspot.com");
  });
});

describe("round 70 — the watch shelves, named and ordered", () => {
  it("names the section in both languages, natively", () => {
    expect(translations.en.watchTitle).toBe("Watch the Programs");
    expect(translations.kn.watchTitle).toBe("ಕಾರ್ಯಕ್ರಮಗಳನ್ನು ವೀಕ್ಷಿಸಿ");
    expect(translations.en.stackKicker).toContain("YouTube");
    expect(translations.kn.stackKicker).toContain("YouTube");
  });

  it("puts the photographs below the watch section on the homepage", () => {
    const hub = read("../src/components/ContentHub.jsx");
    const stacks = read("../src/components/WatchStacks.jsx");
    expect(stacks).toContain('className="section section--watch"');
    expect(hub.indexOf("<WatchStacks")).toBeLessThan(hub.indexOf("<GalleryStrip"));
  });

  it("fans the three newest thumbnails, newest added on top", () => {
    const stacks = read("../src/components/WatchStacks.jsx");
    const css = read("../src/styles.css");
    // shimmering placeholders while the playlist reads…
    expect(stacks).toContain("stack-skeleton");
    // …then exactly three prints, sorted by the date YouTube added them
    expect(stacks).toContain("slice(0, 3)");
    expect(stacks).toContain("localeCompare");
    expect(css).toMatch(/\.stack-photo:nth-child\(1\) \{[^}]*z-index: 3;/);
    // the deck stays inside the card's own box — nothing drools out
    expect(css).toMatch(/\.stack-card \{[^}]*overflow: hidden;/);
    expect(css).not.toContain("bottom: -14px");
    expect(css).toMatch(/\.stack-photo:nth-child\(3\) \{ transform: rotate\(6deg\)/);
  });

  it("opens the dev-only key door in DEV alone, never in production", () => {
    const yt = read("../src/utils/youtube.js");
    expect(yt).toContain("if (!import.meta.env.DEV) return \"\";");
    expect(yt).toContain("sessionStorage");
    expect(yt).toContain("const KEY = ENV_KEY || devKey();");
  });

  it("sends every click to YouTube — no embed, no dialog left behind", () => {
    const vercel = read("../vercel.json");
    const hub = read("../src/components/ContentHub.jsx");
    const stacks = read("../src/components/WatchStacks.jsx");
    expect(vercel).not.toContain("frame-src");
    expect(hub).not.toContain("youtube-nocookie");
    expect(stacks).toContain('target="_blank"');
  });

  it("names the stack words in both languages", () => {
    expect(translations.en.stackKicker).toBe("YouTube playlist");
    expect(translations.kn.stackKicker).toBe("YouTube ಪ್ಲೇಪಟ್ಟಿ");
    // no instruction line under the cards — the cards speak for themselves
    expect(translations.en.stackHint).toBeUndefined();
    expect(read("../src/components/WatchStacks.jsx")).not.toContain("watch-hint");
  });

  it("springs the fan open like the reference — in pure CSS", () => {
    const css = read("../src/styles.css");
    const stacks = read("../src/components/WatchStacks.jsx");
    // the spring overshoot, not an animation library
    expect(css).toContain("cubic-bezier(0.34, 1.56, 0.64, 1)");
    expect(stacks).not.toContain("framer-motion");
    // staggered fan: each print leaves a beat after the one before
    expect(css).toContain("transition-delay: 0.09s;");
    expect(css).toContain("transition-delay: 0.18s;");
    // reduced-motion visitors get a still fan
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.stack-photo \{ transition: none; \}/);
    // the click-maze is gone for good
    expect(stacks).not.toContain("watch-pill");
    expect(stacks).not.toContain("watch-arrow");
    expect(css).not.toContain(".watch-pill");
    expect(css).not.toContain(".stage-slide");
  });

  it("keeps the sub-line short and simple, in both languages", () => {
    expect(translations.en.watchSub.length).toBeLessThan(48);
    expect(translations.kn.watchSub.length).toBeLessThan(48);
  });
});
