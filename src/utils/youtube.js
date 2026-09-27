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
 * Any failure (no network, quota, bad key) resolves to `null` so the
 * curated list stays on screen — the feed can never break the page.
 */

const KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const CHANNEL = import.meta.env.VITE_YOUTUBE_CHANNEL_ID;

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
    `?part=snippet&playlistId=${playlistId}&maxResults=8&key=${KEY}`;

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
          `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
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
