import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { postsToImageRows } from "../api/gallery-sync.js";

const root = new URL("..", import.meta.url);
const sync = readFileSync(new URL("api/gallery-sync.js", root), "utf8");

describe("round 55 — one blog, and the images come from the post pages", () => {
  it("pulls only the Samithi's own blog by default", () => {
    expect(sync).toContain(
      'process.env.GALLERY_BLOG_HOSTS || "omkarsamithi.blogspot.com"'
    );
    // omkarsandesh is chucked by the owner's ruling — not even as a default
    expect(sync).not.toContain("omkarsandesh.blogspot.com");
  });

  it("reads each post page, because modern feed entries carry no body", () => {
    expect(sync).toContain("export async function fetchPostPageHtml(url)");
    expect(sync).toContain("const PAGE_CONCURRENCY = 6");
    // since round 57 the page's images are read from the POST BODY only —
    // never from the header, sidebar, profile or comments furniture
    expect(sync).toContain("extractImageUrls(postBodyHtml(pageHtml))");
    // the entry thumbnail stays as a last-resort source
    expect(sync).toContain("entry.media$thumbnail");
  });

  it("drops every row of a blog that leaves the list", () => {
    expect(sync).toContain("blog_host=not.in.");
  });

  it("prefers the page's pictures, then the feed body, then the thumbnail", async () => {
    const rows = await postsToImageRows(
      [
        {
          title: "Post",
          url: "https://omkarsamithi.blogspot.com/2026/10/x.html",
          published: "2026-10-02T00:00:00Z",
          // real photograph sizes: round 58's quality floor drops mud-sized
          // sources, and these fixtures test the preference chain, not mud
          html: '<img src="https://blogger.googleusercontent.com/img/aaa/w640-h426/feed.jpg">',
          thumb: "https://blogger.googleusercontent.com/img/aaa/s640/thumb.jpg",
        },
      ],
      "omkarsamithi.blogspot.com",
      "2026-10-15T00:00:00.000Z",
      async () =>
        '<div class="post-body entry-content">' +
        '<img src="https://blogger.googleusercontent.com/img/aaa/w640-h426/page.jpg">' +
        "</div>"
    );
    expect(rows.map((r) => r.pos)).toEqual([0, 1, 2]);
    expect(rows[0].url).toContain("/s1600/page.jpg");
    expect(rows[1].url).toContain("/s1600/feed.jpg");
    expect(rows[2].url).toContain("/s1600/thumb.jpg");
    expect(rows[0].thumb_url).toContain("/s480/page.jpg");
  });

  it("survives a post page that cannot be fetched", async () => {
    const rows = await postsToImageRows(
      [
        {
          title: "Post",
          url: "https://omkarsamithi.blogspot.com/2026/10/x.html",
          published: "2026-10-02T00:00:00Z",
          html: '<img src="https://blogger.googleusercontent.com/img/aaa/w640-h426/feed.jpg">',
          thumb: "",
        },
      ],
      "omkarsamithi.blogspot.com",
      "2026-10-15T00:00:00.000Z",
      async () => {
        throw new Error("boom");
      }
    );
    // the feed body still delivers its picture
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toContain("/s1600/feed.jpg");
  });
});
