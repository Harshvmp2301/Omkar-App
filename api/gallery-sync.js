/**
 * The fortnightly blog photograph pull (round 54).
 *
 * WHAT: reads EVERY post of the Samithi's Blogger blogs through the public
 * keyless feed, extracts EVERY image in every post, and stores them in
 * public.gallery_blog_images so the gallery can show the whole photographic
 * life of the community without anyone uploading a file again.
 *
 * WHEN: Vercel Cron calls this on the 1st and 15th of each month (see the
 * `crons` block in vercel.json — "almost once every two weeks", as asked).
 * A person may also call it once, manually, with the same secret, which is
 * how the very first fill happens:
 *
 *   https://omkarsamithi.com/api/gallery-sync?secret=<CRON_SECRET>
 *
 * SECRETS (server-side only, never in the repo, never in chat):
 *   CRON_SECRET                 gates this function; Vercel Cron sends it as
 *                               a Bearer token automatically, a human passes
 *                               it as ?secret=
 *   SUPABASE_SERVICE_ROLE_KEY   writes to the table (bypasses RLS; the table
 *                               has no write policy on purpose)
 *   VITE_SUPABASE_URL           the project URL (public by design)
 *   GALLERY_BLOG_HOSTS          optional comma list; defaults to the two
 *                               Omkar blogs
 *
 * SHAPE OF THE PULL: the legacy GData feed lists every post, but modern
 * Blogger entries carry NO post body — round 54 learned that the hard way
 * when the Samithi's own blog synced zero images while a 2014-era blog
 * synced fine (old entries still embed their HTML). So the feed is used
 * for the post LIST (title, URL, date, thumbnail), and every image is
 * then read from the post's own PAGE, six pages at a time — the page is
 * what a visitor sees, so it is what the gallery shows. Feed bodies and
 * the entry thumbnail are kept as fall-back sources. Images are kept
 * only from Blogger's own image hosts, de-duplicated by URL, and stored
 * twice: tile size (s480) and full size (s1600), the same ladder the
 * bundled gallery photographs use.
 *
 * ONE BLOG BY DEFAULT: omkarsamithi.blogspot.com, the blog the Samithi
 * still writes (round 55, owner's ruling: chuck omkarsandesh). A host
 * that leaves the list leaves the table on the next run — the prune at
 * the end deletes every row whose blog_host is no longer configured.
 *
 * SAFE RE-SYNC: rows are upserted first with a fresh synced_at, THEN the rows
 * of that blog whose stamp is older than this run are deleted — so a visitor
 * never sees an empty gallery mid-sync, and pictures removed from a blog do
 * disappear from the gallery on the next run.
 */

const PAGE_SIZE = 500;
const MAX_PAGES = 2;
/** Post pages fetched at once: polite to Blogger, quick for the cron. */
const PAGE_CONCURRENCY = 6;
const IMAGE_HOSTS =
  /(^|\.)((blogger|lh3|lh4|lh5|lh6)\.googleusercontent\.com|bp\.blogspot\.com|blogspot\.com)$/i;

/**
 * Blogger furniture that must never become a gallery photograph, even if a
 * template ever hides one inside the post body: comment avatars
 * (`/w72-h72-p-k-no-nu/`) and tiny bare header/widget sizes (`=s60` at the
 * end of a URL, `/s60/` as a path segment — two digits, nothing after).
 * The feed entry thumbnails deliberately do NOT match: `/s72-c/` and
 * `/s72-w640-h426-c/` carry a suffix after the size, and those are real
 * content pictures at thumbnail size.
 */
const JUNK_URL = /\/w\d+-h\d+-p-k-no-nu\/|[=/]s\d{1,2}([/?#]|$)/i;

/**
 * The Samithi's own mark, by whatever name it travels under — the profile
 * photo and any copy of it pasted into a post body are files whose name
 * says logo (Omkar%20Logo%20Final%20Transparent.png). A photograph of the
 * printed emblem at an event keeps a photograph's name and stays.
 */
export function isLogoFile(src) {
  try {
    return /logo/i.test(decodeURIComponent(new URL(src).pathname));
  } catch {
    return /logo/i.test(src);
  }
}

/**
 * The two pasted graphics the owner right-clicked out of the gallery
 * (round 59): the circular Samithi emblem and the red Hanuman clipart.
 * New-editor Blogger URLs (`/img/a/AV…=s480`) carry a hash instead of a
 * filename and look exactly like an ordinary embedded photograph — so
 * these two are named outright. A blocklist cannot guess, but it never
 * misses. Any future pasted graphic gets added here by its address, the
 * same way (round 60: the owner's ruling is to KEEP every other page
 * image — guessing which ones "look like graphics" wiped out every
 * post-2019 photograph, because Google's servers answer format questions
 * with whatever they feel like serving, WebP included).
 */
const KNOWN_GRAPHIC_HASHES = [
  "AVvXsEhGWvUTc87Lk6vByLYNHAjqGQKfxG6v8yKy4_F8jaZypvC_WSf55Xrtv7BcAVB1Ge9AnsPRygklTfO9ZVDtAecQD2FdB-8qrLigzUUnVUE5do6LP1VmoA11TmtN3yTVEeQaVPej9fYVZo0RsrtuQ-Ku9_RTtKB7Unv-fDsepzE7xa57-lY8p-c37C4NEXMA",
  "AVvXsEiCM4efEpKw5L18T3xe3wuRMQ35zhdGOt304cRf6obKr5lO12rbaS9SRbwqT6zwprbiXSvlTI4reTOny6conin95gXKbvLJtM2eulc8lL3s-XVcNw_8r8R8l1StchL6DoZDCx_nTbrTCGYdmMxOHp8BEU1MH_7Xpj-01m5TPs4GY0x4JvsVpt-SkwmhNi8L",
];

/** True for the two graphics the owner identified by address. */
export function isKnownGraphic(src) {
  const s = String(src);
  return KNOWN_GRAPHIC_HASHES.some((h) => s.includes(h));
}

/** s1600 / w400-h300-c / =s640 → the same picture at `size` pixels. */
function atSize(src, size) {
  const out = String(src);
  if (/[?&]s\d+/.test(out) || /=s\d+/.test(out)) {
    return out.replace(/([?&=])s\d+(-c)?/, `$1s${size}`);
  }
  // Blogger's compound feed thumbnails (`/s72-w640-h426-c/`) declare two
  // sizes at once; left alone, the stored tile kept the 72px crumb and
  // painted as mud (round 59). Rewrite the whole token so the row stores
  // the real size — which also dedupes the crumb against the same
  // photograph's body URL.
  if (/\/s\d+-w\d+-h\d+(-c)?\//.test(out)) {
    return out.replace(/\/s\d+-w\d+-h\d+(-c)?\//, `/s${size}/`);
  }
  if (/\/(s\d+|w\d+-h\d+)(-c)?\//.test(out)) {
    return out.replace(/\/(s\d+|w\d+-h\d+)(-c)?\//, `/s${size}/`);
  }
  return out;
}

/** Every Blogger-hosted <img src> in one post's HTML, in document order. */
export function extractImageUrls(html) {
  const found = [];
  const re = /<img[^>]*\ssrc=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(String(html || "")))) {
    const src = m[1].trim();
    if (!/^https?:\/\//i.test(src)) continue;
    let host;
    try {
      host = new URL(src).hostname;
    } catch {
      continue;
    }
    if (!IMAGE_HOSTS.test(host)) continue;
    // Blogger's 1x1 spacers and emotion icons are not photographs
    if (/\/(spacer|icon|emoticon)s?\//i.test(src)) continue;
    if (!found.includes(src)) found.push(src);
  }
  return found;
}

/**
 * The post's OWN HTML — the only part of the page whose photographs belong
 * in the gallery. The owner's ruling (round 57): the blog's header logo
 * (`Header1_headerimg`), sidebar widgets (`Image1_img`), the profile photo
 * (`class="profile-img"` — on this blog, the Omkar logo again) and the 72px
 * comment avatars were all being pulled in as "photographs". Every one of
 * them lives OUTSIDE the post body. Blogger wraps each post in
 * `class="post-body entry-content"` and closes it before the
 * `class="post-footer…"` block, so the body is the slice between those two
 * markers. With either marker missing this returns "" — the run then falls
 * back to the feed content and the entry thumbnail rather than guessing and
 * dragging page furniture into the table.
 */
export function postBodyHtml(pageHtml) {
  const page = String(pageHtml || "");
  const startM = page.match(
    /class=["'][^"']*(?:post-body|entry-content)[^"']*["']/
  );
  if (!startM) return "";
  const start = startM.index;
  const footerM = page.slice(start).match(/class=["'][^"']*post-footer/);
  return footerM ? page.slice(start, start + footerM.index) : page.slice(start);
}

/** One page of the keyless feed. Plain fetch: this runs on a server. */
async function fetchFeedPage(host, startIndex) {
  const url =
    `https://${host}/feeds/posts/default` +
    `?alt=json&max-results=${PAGE_SIZE}&start-index=${startIndex}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`feed ${res.status} for ${host}`);
  const data = await res.json();
  return (data && data.feed && data.feed.entry) || [];
}

/** Every post of one blog: { title, url, published, html }[]. */
async function fetchAllPosts(host) {
  const posts = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const entries = await fetchFeedPage(host, page * PAGE_SIZE + 1);
    for (const entry of entries) {
      const links = (entry && entry.link) || [];
      const alt = links.find((l) => l && l.rel === "alternate" && l.href);
      posts.push({
        title: (entry.title && entry.title.$t) || "",
        url: alt ? alt.href : "",
        published: (entry.published && entry.published.$t) || "",
        html: (entry.content && entry.content.$t) || "",
        thumb: (entry.media$thumbnail && entry.media$thumbnail.url) || "",
      });
    }
    if (entries.length < PAGE_SIZE) break;
  }
  return posts;
}

/** The HTML of one post page; "" when the page cannot be fetched. The page
 *  is the primary image source: modern feed entries carry no post body. */
export async function fetchPostPageHtml(url) {
  try {
    const res = await fetch(url, { headers: { accept: "text/html" } });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/** Run an async fn over items, at most `size` at a time, keeping order. */
async function inChunks(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    const wave = await Promise.all(items.slice(i, i + size).map(fn));
    out.push(...wave);
  }
  return out;
}

/**
 * Posts → the rows the table stores, newest post first, order kept.
 * Round 55: images come from each post's PAGE first (the feed body is
 * empty on modern Blogger) — and since round 57 only from INSIDE the post
 * body, never from the page's header, sidebar, profile or comments
 * furniture — then the feed body, then the entry thumbnail, de-duplicated
 * across the whole blog by full-size URL.
 * `fetchPage` is injectable so tests never touch the network.
 */
export async function postsToImageRows(
  posts,
  host,
  syncedAt,
  fetchPage = fetchPostPageHtml
) {
  const perPost = await inChunks(posts, PAGE_CONCURRENCY, async (post) => {
    // A post page that refuses to load must cost one post its page
    // images, never the whole sync.
    let pageHtml = "";
    try {
      pageHtml = post.url ? await fetchPage(post.url) : "";
    } catch {
      pageHtml = "";
    }
    const urls = [];
    for (const src of [
      ...extractImageUrls(postBodyHtml(pageHtml)),
      ...extractImageUrls(post.html),
      ...(post.thumb ? [post.thumb] : []),
    ]) {
      // Second sieve (round 60 — the owner's ruling): KEEP every page
      // image; remove only the Blogger junk — comment avatars and tiny
      // border sizes, the Samithi's logo file, and the two graphics the
      // owner identified by address. Nothing is judged by declared pixel
      // size or by asking the bytes what format they are: post-2019
      // photographs ride the nameless /img/a/AV… shape, and both of those
      // "clever" gates wrongly wiped them out.
      if (JUNK_URL.test(src)) continue;
      if (isLogoFile(src)) continue;
      if (isKnownGraphic(src)) continue;
      const full = atSize(src, 1600);
      if (!urls.some((u) => u.full === full)) urls.push({ src, full });
    }
    return urls;
  });

  const rows = [];
  const seen = new Set();
  perPost.forEach((urls, p) => {
    const post = posts[p];
    urls.forEach((u, pos) => {
      if (seen.has(u.full)) return;
      seen.add(u.full);
      rows.push({
        url: u.full,
        thumb_url: atSize(u.src, 480),
        blog_host: host,
        post_title: post.title,
        post_url: post.url,
        published_at: post.published || syncedAt,
        pos,
        synced_at: syncedAt,
      });
    });
  });
  return rows;
}

function supabaseHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

/** Upsert in chunks, then drop this blog's rows the run did not see. */
async function syncHost(baseUrl, serviceKey, host, rows, runStartIso) {
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const res = await fetch(
      `${baseUrl}/rest/v1/gallery_blog_images?on_conflict=url`,
      {
        method: "POST",
        headers: {
          ...supabaseHeaders(serviceKey),
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(chunk),
      }
    );
    if (!res.ok) throw new Error(`upsert ${res.status}: ${await res.text()}`);
  }
  const gone = await fetch(
    `${baseUrl}/rest/v1/gallery_blog_images` +
      `?blog_host=eq.${encodeURIComponent(host)}` +
      `&synced_at=lt.${encodeURIComponent(runStartIso)}`,
    { method: "DELETE", headers: supabaseHeaders(serviceKey) }
  );
  if (!gone.ok) throw new Error(`prune ${gone.status}: ${await gone.text()}`);
  return rows.length;
}

export default async function handler(req, res) {
  // Round 63: a manual trigger may carry the secret in its query string.
  // No copy of ANY response from this endpoint — the 401s included — may
  // be stored by a browser cache, a proxy or a service worker, and none
  // is reusable: every run must hit this function and Supabase live.
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const secret = process.env.CRON_SECRET || "";
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const queried = String(req.query.secret || "");
  if (!secret || (bearer !== secret && queried !== secret)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const baseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!baseUrl || !serviceKey) {
    return res.status(500).json({ ok: false, error: "supabase-not-configured" });
  }

  // Round 55, the owner's ruling: the Samithi's own blog only. The 2014-era
  // omkarsandesh blog is chucked; its rows leave the table on this run's
  // final prune, because a host absent from this list loses every row.
  const hosts = String(
    process.env.GALLERY_BLOG_HOSTS || "omkarsamithi.blogspot.com"
  )
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  const runStartIso = new Date().toISOString();
  const report = [];
  try {
    for (const host of hosts) {
      const posts = await fetchAllPosts(host);
      const rows = await postsToImageRows(posts, host, runStartIso);
      const count = await syncHost(baseUrl, serviceKey, host, rows, runStartIso);
      report.push({ host, posts: posts.length, images: count });
    }
    // A blog that left the list leaves the gallery: drop every row whose
    // host is no longer configured (this is how omkarsandesh departed).
    const goneHosts = await fetch(
      `${baseUrl}/rest/v1/gallery_blog_images` +
        `?blog_host=not.in.(${hosts.map((h) => `"${h}"`).join(",")})`,
      { method: "DELETE", headers: supabaseHeaders(serviceKey) }
    );
    if (!goneHosts.ok) {
      throw new Error(`prune-hosts ${goneHosts.status}: ${await goneHosts.text()}`);
    }
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err.message || err), done: report });
  }
  return res.json({ ok: true, blogs: report });
}
