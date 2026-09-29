import { describe, it, expect } from "vitest";
import { youtubeEnabled, fetchLatestVideos } from "./youtube.js";

/**
 * Zero-config contract (audit item A-something: the feed can never break the
 * page): with no owner keys the integration must stay fully dormant and
 * resolve to null so the curated list renders untouched.
 */
describe("youtube feed — zero-config contract", () => {
  it("is disabled when the owner has not added API keys", () => {
    expect(youtubeEnabled).toBe(false);
  });

  it("resolves to null (curated fallback, no network attempted)", async () => {
    await expect(fetchLatestVideos("en")).resolves.toBeNull();
    await expect(fetchLatestVideos("kn")).resolves.toBeNull();
  });
});
