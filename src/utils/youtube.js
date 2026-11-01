/**
 * Optional live uploads feed — YouTube Data API v3.
 *
 * Zero-config by default: with no env keys the app renders the curated
 * `t.videos` list exactly as before. When the site owner adds keys, the
 * channel's latest uploads replace it (localStorage-cached for 6 h to keep
 * quota usage near zero for returning visitors).
 *
 *   VITE_YOUTUBE_API_KEY    Data API v3 key — owner pastes it in Vercel/.env
 *   VITE_YOUTUBE_CHANNEL_ID Channel id starting with UC… (uploads playlist
 *                           is derived UCxxxx → UUxxxx)
 *
 * The newest 3 uploads are shown (LATEST_COUNT below).
 *
 * Any failure (no network, quota, bad key) resolves to `null` so the
 * curated list stays on screen — the feed can never break the page.
 */

const ENV_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

/* DEV-only door (round 70): a dev server has no Vercel env, so the shelves
   would always show their fallback there. In DEV — and ONLY in DEV; Vite
   replaces import.meta.env.DEV with false in production and tree-shakes this
   whole function out — the site owner may hand the page his own key once via
   ?ytKey=… on the URL; it is kept in sessionStorage for that tab alone.
   Nothing is ever stored in the repo, and production reads ENV_KEY only. */
function devKey() {
  if (!import.meta.env.DEV) return "";
  try {
    const given = new URLSearchParams(window.location.search).get("ytKey");
    if (given) sessionStorage.setItem("omkar_dev_yt_key", given);
    return sessionStorage.getItem("omkar_dev_yt_key") || "";
  } catch {
    return ""; // no window / no storage (tests, private mode) — stay dormant
  }
}

const KEY = ENV_KEY || devKey();
const CHANNEL = import.meta.env.VITE_YOUTUBE_CHANNEL_ID;

/** The owner spec: show only the newest uploads, not the whole back catalogue. */
const LATEST_COUNT = 3;

const TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_KEY = "omkar_yt_uploads_v1";

export const youtubeEnabled = Boolean(
  KEY && CHANNEL && /^UC[\w-]{10,}$/.test(CHANNEL)
);

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.videos) || !data.videos.length) return null;
    if (Date.now() - (data.ts || 0) > TTL_MS) return null;
    return data.videos;
  } catch {
    return null; // storage unavailable (private mode) — just refetch
  }
}

function writeCache(videos) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), videos }));
  } catch {
    /* ignore */
  }
}

export async function fetchLatestVideos(lang = "en") {
  if (!youtubeEnabled) return null;

  const cached = readCache();
  if (cached) return cached;

  const playlistId = `UU${CHANNEL.slice(2)}`;
  const endpoint =
    `https://www.googleapis.com/youtube/v3/playlistItems` +
    `?part=snippet&playlistId=${playlistId}&maxResults=${LATEST_COUNT}&key=${KEY}`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`youtube http ${res.status}`);
    const data = await res.json();
    const videos = (data.items || [])
      .map((item) => {
        const s = item && item.snippet;
        const videoId = s && s.resourceId && s.resourceId.videoId;
        if (!videoId || !s.title) return null;
        const thumbs = s.thumbnails || {};
        const thumb =
          (thumbs.maxres || thumbs.high || thumbs.medium || thumbs.default || {}).url ||
          `https://i.ytimg.com/vi_webp/${videoId}/hqdefault.webp`;
        let date = "";
        if (s.publishedAt) {
          try {
            date = new Date(s.publishedAt).toLocaleDateString(
              lang === "kn" ? "kn-IN" : "en-IN",
              { day: "2-digit", month: "short", year: "numeric" }
            );
          } catch {
            date = s.publishedAt.slice(0, 10);
          }
        }
        return {
          id: `yt-${videoId}`,
          title: s.title,
          date,
          tag: s.liveBroadcastContent === "live" ? "LIVE" : "YouTube",
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail: thumb,
        };
      })
      .filter((v) => v && v.title && v.url);

    if (!videos.length) return null;
    writeCache(videos);
    return videos;
  } catch {
    return null; // curated fallback stays — never a broken state
  }
}

/* Round 70 — the recordings grid became three shelves, one per standing
   program, each backed by the playlist the owner keeps on the channel:
   open a shelf and its videos list in place; every video and the shelf's
   own link go to YouTube. Same contract as the uploads feed: no key, no
   network, quota or a bad key resolves to null and the shelf offers the
   playlist link on YouTube instead — the page can never break. */
export const PROGRAM_PLAYLISTS = [
  { id: "jnanamrutha", playlistId: "PLXmxYuAwGJsY" },
  { id: "nadamrutha", playlistId: "PLGceKo2Bb8jM" },
  { id: "anjaneya", playlistId: "PLGrL6fhBMhelYAFZeTkJxmprHloDEcg01" },
];

export const playlistUrl = (playlistId) =>
  `https://www.youtube.com/playlist?list=${playlistId}`;

const SHELF_MAX = 50;

function shelfCacheKey(playlistId) {
  return `omkar_yt_shelf_${playlistId}_v1`;
}

function readShelfCache(playlistId) {
  try {
    const raw = localStorage.getItem(shelfCacheKey(playlistId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.videos) || !data.videos.length) return null;
    if (Date.now() - (data.ts || 0) > TTL_MS) return null;
    return data.videos;
  } catch {
    return null;
  }
}

function writeShelfCache(playlistId, videos) {
  try {
    localStorage.setItem(shelfCacheKey(playlistId), JSON.stringify({ ts: Date.now(), videos }));
  } catch {
    /* ignore */
  }
}

/** The playlist's videos, playlist order (the owner orders them on YouTube). */
export async function fetchPlaylistItems(playlistId) {
  if (!KEY || !playlistId) return null;

  const cached = readShelfCache(playlistId);
  if (cached) return cached;

  const endpoint =
    `https://www.googleapis.com/youtube/v3/playlistItems` +
    `?part=snippet&maxResults=${SHELF_MAX}&playlistId=${encodeURIComponent(playlistId)}` +
    `&key=${encodeURIComponent(KEY)}`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const json = await res.json();
    const videos = (json.items || [])
      .map((item) => {
        const sn = item.snippet || {};
        const id = sn.resourceId && sn.resourceId.videoId;
        if (!id) return null;
        const thumbs = sn.thumbnails || {};
        return {
          id,
          title: sn.title || "",
          thumbnail:
            (thumbs.medium && thumbs.medium.url) ||
            (thumbs.default && thumbs.default.url) ||
            "",
          // when YouTube added this video to the playlist — the fan's order
          publishedAt: sn.publishedAt || "",
        };
      })
      .filter(Boolean);
    if (!videos.length) return null;
    writeShelfCache(playlistId, videos);
    return videos;
  } catch {
    return null;
  }
}
