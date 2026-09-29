/**
 * Optional live blog feed — Blogger.
 *
 * EVIDENCE-DRIVEN, and the history matters:
 *   • The public blogspot feed (`/feeds/posts/default?alt=json-in-script`)
 *     was the original implementation. It was believed dead because the
 *     Blogger v2.0 GData API was sunset on 2024-09-30 — but that notice
 *     covers the GData API, not these URLs. Google's own FAQ says:
 *     "We continue to serve feeds for such URLs."
 *     https://support.google.com/blogger/answer/14877110
 *   • Confirmed live in the owner's browser (2026-09-29): this route
 *     returned real posts with no key and no signup.
 *
 * So the keyless feed is tried FIRST, and Blogger API v3 is kept as a
 * fallback for anyone who sets a key — insurance in case the older route
 * is ever withdrawn. Both arrive as JSONP, so neither needs a server.
 *
 *   VITE_BLOGGER_BLOG_URL  defaults to DEFAULT_BLOG_HOST below, so the feed
 *                          works with NO configuration at all. A missing
 *                          .env.local must never silently disable it.
 *   VITE_BLOGGER_MAX       how many posts to show (default 3, newest first)
 *   VITE_BLOGGER_API_KEY   OPTIONAL. Falls back to VITE_YOUTUBE_API_KEY.
 *
 * Never fatal: ANY failure (no network, blocked script, API error, odd
 * shape) resolves to `null` so the curated `t.blogPosts` list stays.
 */

/** Omkar Samithi's blog — the one still updated. Used when nothing is set. */
const DEFAULT_BLOG_HOST = "omkarsamithi.blogspot.com";

const API_KEY =
  import.meta.env.VITE_BLOGGER_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;
const RAW_BLOG = import.meta.env.VITE_BLOGGER_BLOG_URL;
const MAX = Number(import.meta.env.VITE_BLOGGER_MAX) > 0
  ? Number(import.meta.env.VITE_BLOGGER_MAX)
  : 3;

/** Strip protocol, path and trailing slash → bare `blog.blogspot.com` host. */
function normalizeHost(raw) {
  return String(raw || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\/+$/, "");
}

const HOST = normalizeHost(RAW_BLOG) || DEFAULT_BLOG_HOST;

// A hostname with at least one dot and no spaces — accepts blogspot.com and
// custom domains alike, rejects obvious typos in an explicit setting.
const HOST_OK = /^[\w-]+(\.[\w-]+)+$/.test(HOST);

export const bloggerEnabled = Boolean(HOST_OK);

/** True when the built-in blog is in use because nothing was configured. */
export const bloggerUsingDefault = !normalizeHost(RAW_BLOG);

/** True when an API key is available for the v3 fallback route. */
export const bloggerKeyConfigured = Boolean(API_KEY);

/** The route tried first. The v3 API is only a fallback. */
export const bloggerMode = "jsonp";

const POSTS_TTL_MS = 6 * 60 * 60 * 1000;
const BLOGID_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const POSTS_CACHE_KEY = "omkar_blog_posts_v2";
const BLOGID_CACHE_KEY = "omkar_blog_id_v1";
const SNIPPET_CHARS = 140;
const JSONP_TIMEOUT_MS = 12000;

const API_BASE = "https://www.googleapis.com/blogger/v3";

/* ------------------------------------------------------------------ parsing */

function readText(node) {
  return node && typeof node.$t === "string" ? node.$t : "";
}

/** HTML → single-line plain text (both APIs embed full post HTML). */
function plain(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut at a word boundary so snippets never end mid-word. */
export function truncate(text, limit = SNIPPET_CHARS) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function formatDate(iso, lang) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(lang === "kn" ? "kn-IN" : "en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(iso).slice(0, 10);
  }
}

function postFrom(title, url, body, iso, idSeed, lang) {
  const clean = plain(title);
  if (!clean || !url) return null; // skip anything unusable
  return {
    id: `bl-${String(idSeed).replace(/[^\w-]/g, "").slice(-24)}`,
    title: clean,
    snippet: truncate(plain(body)),
    date: formatDate(iso, lang),
    url,
  };
}

/**
 * Blogger API v3 `posts.list` reply → the shape the blog cards render.
 * Exported for tests: pure, no network.
 */
export function mapApiPosts(items, lang = "en") {
  return (items || [])
    .map((item, index) =>
      postFrom(
        item && item.title,
        item && item.url,
        (item && (item.content || item.summary)) || "",
        item && item.published,
        (item && item.id) || index,
        lang
      )
    )
    .filter(Boolean);
}

/**
 * Legacy GData feed reply → the same shape. Kept as the no-key fallback;
 * this endpoint is deprecated, so treat it as best-effort only.
 * Exported for tests.
 */
export function mapFeedEntries(feed, lang = "en") {
  const entries = (feed && feed.entry) || [];
  return entries
    .map((entry, index) => {
      const links = (entry && entry.link) || [];
      const alt = links.find((l) => l && l.rel === "alternate" && l.href);
      const rawId = readText(entry && entry.id) || `${index}`;
      return postFrom(
        readText(entry && entry.title),
        alt ? alt.href : "",
        readText(entry && entry.content) || readText(entry && entry.summary),
        readText(entry && entry.published) || readText(entry && entry.updated),
        rawId,
        lang
      );
    })
    .filter(Boolean);
}

/* ------------------------------------------------------------------- cache */

function readCache(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || Date.now() - (data.ts || 0) > ttl) return null;
    return data;
  } catch {
    return null; // storage unavailable (private mode) — just refetch
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), ...value }));
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------- jsonp */

/**
 * Load `url` as JSONP. Resolves `{ data, error }` — never rejects, because a
 * Blogger outage must not throw into the component.
 */
function jsonp(url, timeoutMs = JSONP_TIMEOUT_MS) {
  if (typeof document === "undefined" || !document.head) {
    return Promise.resolve({ data: null, error: "no-document" });
  }

  return new Promise((resolve) => {
    const cb = `__omkarBlog${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const script = document.createElement("script");

    // Google normally calls the callback name handed to it, but some
    // responses use the default GData wrapper gdata.io.handleScriptLoaded().
    // Accepting both means a change of wrapper can't silently kill the feed.
    const gdata = (window.gdata = window.gdata || {});
    gdata.io = gdata.io || {};
    const previousHandler = gdata.io.handleScriptLoaded;
    let handledByDefault = false;

    let done = false;
    const finish = (data, error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        delete window[cb];
      } catch {
        window[cb] = undefined;
      }
      if (handledByDefault) {
        gdata.io.handleScriptLoaded = previousHandler;
      } else {
        delete gdata.io.handleScriptLoaded;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
      // A Google API error still arrives as a successful script call, so it
      // has to be detected in the payload rather than by a network failure.
      const apiError =
        data && data.error
          ? `${data.error.code || ""} ${data.error.message || "api error"}`.trim()
          : null;
      resolve({ data: error || apiError ? null : data, error: error || apiError });
    };

    const timer = setTimeout(() => finish(null, "timeout"), timeoutMs);

    window[cb] = (data) => finish(data, null);
    gdata.io.handleScriptLoaded = (data) => {
      handledByDefault = true;
      finish(data, null);
    };
    script.onerror = () => finish(null, "script-load-failed");
    script.src = `${url}&callback=${cb}`;
    document.head.appendChild(script);
  });
}

/* ------------------------------------------------------------------ routes */

/** Blogger API v3: resolve the numeric blog id from the blog's URL once. */
async function resolveBlogId() {
  const cached = readCache(BLOGID_CACHE_KEY, BLOGID_TTL_MS);
  if (cached && cached.host === HOST && cached.id) {
    return { id: cached.id, error: null };
  }

  const url =
    `${API_BASE}/blogs/byurl?url=${encodeURIComponent(`https://${HOST}/`)}` +
    `&key=${API_KEY}`;

  const { data, error } = await jsonp(url);
  if (error) return { id: null, error };
  const id = data && data.id ? String(data.id) : null;
  if (!id) return { id: null, error: "no-blog-id-in-response" };

  writeCache(BLOGID_CACHE_KEY, { host: HOST, id });
  return { id, error: null };
}

/** Blogger API v3 — the supported route. Requires an API key. */
async function loadViaApi(lang) {
  const { id, error } = await resolveBlogId();
  if (error) return { posts: null, error: `byurl: ${error}` };

  const url =
    `${API_BASE}/blogs/${id}/posts?key=${API_KEY}` +
    `&maxResults=${MAX}&fetchBodies=true&orderBy=published`;

  const res = await jsonp(url);
  if (res.error) return { posts: null, error: `posts: ${res.error}` };

  const posts = mapApiPosts(res.data && res.data.items, lang).slice(0, MAX);
  return { posts: posts.length ? posts : null, error: posts.length ? null : "no-items" };
}

/** Deprecated GData feed — no key needed. Best-effort fallback only. */
async function loadViaLegacyFeed(lang) {
  const url =
    `https://${HOST}/feeds/posts/default` +
    `?alt=json-in-script&max-results=${MAX}`;

  const { data, error } = await jsonp(url);
  if (error) return { posts: null, error };

  const posts = mapFeedEntries(data && data.feed, lang).slice(0, MAX);
  return { posts: posts.length ? posts : null, error: posts.length ? null : "no-entries" };
}

/* ------------------------------------------------------------------ public */

/**
 * Full result, including WHY it failed — used by /diagnostics/feeds.html so a
 * failure can be reported instead of guessed at.
 */
export async function fetchLatestPostsDetailed(lang = "en") {
  if (!bloggerEnabled) {
    return { ok: false, posts: null, mode: bloggerMode, error: "not-configured" };
  }

  const cached = readCache(POSTS_CACHE_KEY, POSTS_TTL_MS);
  if (cached && Array.isArray(cached.posts) && cached.posts.length) {
    return { ok: true, posts: cached.posts, mode: "cache", error: null };
  }

  // Keyless feed first: it is proven working in the owner's browser and
  // needs no signup. If it ever fails AND a key is available, try the
  // supported v3 API rather than giving up.
  let result = await loadViaLegacyFeed(lang);
  let mode = bloggerMode;

  if (!result.posts && API_KEY) {
    const api = await loadViaApi(lang);
    if (api.posts) {
      result = api;
      mode = "api-v3";
    } else {
      result = {
        posts: null,
        error: `legacy: ${result.error} | api-v3: ${api.error}`,
      };
    }
  }

  if (!result.posts) {
    return { ok: false, posts: null, mode, error: result.error };
  }

  writeCache(POSTS_CACHE_KEY, { posts: result.posts });
  return { ok: true, posts: result.posts, mode, error: null };
}

/** The app-facing call: posts, or `null` so the curated list stays. */
export async function fetchLatestPosts(lang = "en") {
  const { posts } = await fetchLatestPostsDetailed(lang);
  return posts;
}
