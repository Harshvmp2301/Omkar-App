import { describe, it, expect } from "vitest";
import {
  bloggerEnabled,
  bloggerKeyConfigured,
  bloggerMode,
  bloggerUsingDefault,
  fetchLatestPosts,
  fetchLatestPostsDetailed,
  mapApiPosts,
  mapFeedEntries,
  truncate,
} from "./blogger.js";

/**
 * Zero-config contract, same guarantee as the YouTube feed: the feed is
 * tried by default (so a missing config file can never silently disable it)
 * but must never break the page or throw.
 */
describe("blogger feed — zero-config contract", () => {
  it("uses the built-in Omkar Samithi blog when none is configured", () => {
    expect(bloggerEnabled).toBe(true);
    expect(bloggerUsingDefault).toBe(true);
  });

  it("tries the keyless feed first, not the API", () => {
    expect(bloggerMode).toBe("jsonp");
  });

  it("resolves to null outside a browser (curated fallback, nothing thrown)", async () => {
    // No `document` in the node test environment, so the JSONP loader
    // reports no-document rather than reaching the network.
    await expect(fetchLatestPosts("en")).resolves.toBeNull();
    await expect(fetchLatestPosts("kn")).resolves.toBeNull();
  });
});

/**
 * Blogger's feed shape (trimmed to the fields we read). Parsing must be
 * tolerant — one malformed entry must not sink the whole list.
 */
const FIXTURE = {
  feed: {
    entry: [
      {
        id: { $t: "tag:blogger.com,1999:blog-123.post-456" },
        published: { $t: "2026-03-14T09:30:00.000+04:00" },
        title: { $t: "Omkar Jnanamrutha 2026" },
        content: {
          $t: "<div>Details of the <b>discourse</b> held in Muscat.</div><p>Guided by&nbsp;Sri Anjaneya Swamy.</p>",
        },
        link: [
          { rel: "self", href: "https://www.blogger.com/feeds/1/posts/default/456" },
          { rel: "alternate", href: "https://omkarsamithi.blogspot.com/2026/03/blog-post.html" },
        ],
      },
      {
        id: { $t: "tag:blogger.com,1999:blog-123.post-457" },
        published: { $t: "2024-09-27T18:00:00.000+04:00" },
        title: { $t: "Omkar Naadamrutha 2024" },
        summary: { $t: "A musical evening program held at Muscat." },
        link: [{ rel: "alternate", href: "https://omkarsamithi.blogspot.com/2024/09/naadamrutha.html" }],
      },
      {
        // missing title AND link — must be skipped, not crash
        id: { $t: "tag:blogger.com,1999:blog-123.post-458" },
        published: { $t: "2024-01-01T00:00:00.000Z" },
        link: [],
      },
    ],
  },
};

describe("blogger feed — parsing", () => {
  const posts = mapFeedEntries(FIXTURE.feed, "en");

  it("keeps only entries that have both a title and a link", () => {
    expect(posts).toHaveLength(2);
    expect(posts.map((p) => p.title)).toEqual([
      "Omkar Jnanamrutha 2026",
      "Omkar Naadamrutha 2024",
    ]);
  });

  it("uses the alternate link, never the feed's self link", () => {
    expect(posts[0].url).toBe("https://omkarsamithi.blogspot.com/2026/03/blog-post.html");
    expect(posts.every((p) => !p.url.includes("/feeds/"))).toBe(true);
  });

  it("flattens post HTML and entities into one plain line", () => {
    expect(posts[0].snippet).toBe(
      "Details of the discourse held in Muscat. Guided by Sri Anjaneya Swamy."
    );
    expect(posts[0].snippet).not.toMatch(/[<>]|&nbsp;/);
  });

  it("falls back to `summary` when a post has no `content`", () => {
    expect(posts[1].snippet).toBe("A musical evening program held at Muscat.");
  });

  it("gives every post a stable unique id and a non-empty date", () => {
    const ids = posts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(posts.every((p) => p.id.startsWith("bl-"))).toBe(true);
    expect(posts.every((p) => p.date.length > 0)).toBe(true);
  });

  it("survives a feed with no entries at all", () => {
    expect(mapFeedEntries({}, "en")).toEqual([]);
    expect(mapFeedEntries(undefined, "en")).toEqual([]);
  });
});

/**
 * Blogger API v3 shape (the supported route since the old keyless GData feed
 * was sunset on 2024-09-30). This is what the app now parses by default.
 */
const API_FIXTURE = {
  items: [
    {
      id: "1357924680123456789",
      published: "2026-03-14T09:30:00+04:00",
      url: "https://omkarsamithi.blogspot.com/2026/03/blog-post.html",
      title: "Omkar Jnanamrutha 2026",
      content:
        "<div>Details of the <b>discourse</b> held in Muscat.</div><p>Guided by&nbsp;Sri Anjaneya Swamy.</p>",
    },
    {
      id: "1357924680123456790",
      published: "2024-09-27T18:00:00+04:00",
      url: "https://omkarsamithi.blogspot.com/2024/09/naadamrutha.html",
      title: "Omkar Naadamrutha 2024",
      summary: "A musical evening program held at Muscat.",
    },
    {
      // no title and no url — must be skipped, not crash
      id: "1357924680123456791",
      published: "2024-01-01T00:00:00Z",
    },
  ],
};

describe("blogger API v3 — parsing", () => {
  const posts = mapApiPosts(API_FIXTURE.items, "en");

  it("skips entries with neither a title nor a url", () => {
    expect(posts).toHaveLength(2);
    expect(posts.map((p) => p.title)).toEqual([
      "Omkar Jnanamrutha 2026",
      "Omkar Naadamrutha 2024",
    ]);
  });

  it("uses the post url directly, not a feed link", () => {
    expect(posts[0].url).toBe(
      "https://omkarsamithi.blogspot.com/2026/03/blog-post.html"
    );
    expect(posts.every((p) => !p.url.includes("/feeds/"))).toBe(true);
  });

  it("flattens post HTML and entities into one plain line", () => {
    expect(posts[0].snippet).toBe(
      "Details of the discourse held in Muscat. Guided by Sri Anjaneya Swamy."
    );
    expect(posts[0].snippet).not.toMatch(/[<>]|&nbsp;/);
  });

  it("falls back to `summary` when a post has no `content`", () => {
    expect(posts[1].snippet).toBe("A musical evening program held at Muscat.");
  });

  it("produces the same card shape as the legacy feed parser", () => {
    // Both routes must feed the identical component contract.
    const legacy = mapFeedEntries(FIXTURE.feed, "en");
    const keys = (p) => Object.keys(p).sort();
    expect(keys(posts[0])).toEqual(keys(legacy[0]));
    expect(posts[0]).toMatchObject({
      id: expect.stringMatching(/^bl-/),
      title: expect.any(String),
      snippet: expect.any(String),
      date: expect.any(String),
      url: expect.any(String),
    });
  });

  it("survives an empty or malformed response", () => {
    expect(mapApiPosts([], "en")).toEqual([]);
    expect(mapApiPosts(undefined, "en")).toEqual([]);
    expect(mapApiPosts([null, undefined], "en")).toEqual([]);
  });
});

describe("blogger feed — failure is always reported, never thrown", () => {
  it("reports no-document outside a browser instead of rejecting", async () => {
    const result = await fetchLatestPostsDetailed("en");
    expect(result.ok).toBe(false);
    expect(result.posts).toBeNull();
    expect(result.error).toBe("no-document");
  });

  it("has no API key in the test environment, so v3 is a dormant fallback", () => {
    expect(bloggerKeyConfigured).toBe(false);
  });
});

describe("blogger feed — snippet truncation", () => {
  it("leaves short text alone", () => {
    expect(truncate("Short post", 140)).toBe("Short post");
  });

  it("cuts on a word boundary and marks the elision", () => {
    const long = "word ".repeat(60).trim();
    const out = truncate(long, 140);
    expect(out.length).toBeLessThanOrEqual(141);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/wor…$/); // never mid-word
  });
});
