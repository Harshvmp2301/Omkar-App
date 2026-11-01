import { describe, it, expect } from "vitest";
import {
  youtubeEnabled,
  fetchLatestVideos,
  fetchPlaylistItems,
  PROGRAM_PLAYLISTS,
  playlistUrl,
} from "./youtube.js";

/**
 * Zero-config contract (the feed can never break the page): with no owner
 * keys every integration stays fully dormant and resolves to null — the
 * shelves then offer their playlist link on YouTube instead of a list.
 */
describe("youtube feed — zero-config contract", () => {
  it("is disabled when the owner has not added API keys", () => {
    expect(youtubeEnabled).toBe(false);
  });

  it("resolves to null (curated fallback, no network attempted)", async () => {
    await expect(fetchLatestVideos("en")).resolves.toBeNull();
    await expect(fetchLatestVideos("kn")).resolves.toBeNull();
  });

  it("lists no shelf videos without a key", async () => {
    await expect(fetchPlaylistItems("PLXmxYuAwGJsY")).resolves.toBeNull();
  });
});

describe("round 70 — the three shelves and their playlists", () => {
  it("carries exactly the owner's three playlists, in program order", () => {
    expect(PROGRAM_PLAYLISTS.map((p) => p.playlistId)).toEqual([
      "PLXmxYuAwGJsY",
      "PLGceKo2Bb8jM",
      "PLGrL6fhBMhelYAFZeTkJxmprHloDEcg01",
    ]);
  });

  it("links a shelf straight to its playlist on YouTube", () => {
    expect(playlistUrl("PLXmxYuAwGJsY")).toBe(
      "https://www.youtube.com/playlist?list=PLXmxYuAwGJsY"
    );
  });
});
