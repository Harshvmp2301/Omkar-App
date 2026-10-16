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
 * SHAPE OF THE PULL: the legacy GData feed serves full post HTML with no key
 * (proven live since round 29's blog work). Pages of 500 posts, two pages per
 * blog — a thousand posts of headroom, far beyond either blog today. Images
 * are kept only from Blogger's own image hosts, de-duplicated by URL, and
 * stored twice: tile size (s480) and full size (s1600), the same ladder the
 * bundled gallery photographs use.
 *
 * SAFE RE-SYNC: rows are upserted first with a fresh synced_at, THEN the rows
 * of that blog whose stamp is older than this run are deleted — so a visitor
 * never sees an empty gallery mid-sync, and pictures removed from a blog do
 * disappear from the gallery on the next run.
 */

const PAGE_SIZE = 500;
const MAX_PAGES = 2;
const IMAGE_HOSTS =
  /(^|\.)((blogger|lh3|lh4|lh5|lh6)\.googleusercontent\.com|bp\.blogspot\.com|blogspot\.com)$/i;

/** s1600 / w400-h300-c / =s640 → the same picture at `size` pixels. */
function atSize(src, size) {
  const out = String(src);
  if (/[?&]s\d+/.test(out) || /=s\d+/.test(out)) {
    return out.replace(/([?&=])s\d+(-c)?/, `$1s${size}`);
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
      });
    }
    if (entries.length < PAGE_SIZE) break;
  }
  return posts;
}

/** Posts → the rows the table stores, newest post first, order kept. */
export function postsToImageRows(posts, host, syncedAt) {
  const rows = [];
  const seen = new Set();
  posts.forEach((post) => {
    extractImageUrls(post.html).forEach((src, pos) => {
      const full = atSize(src, 1600);
      if (seen.has(full)) return;
      seen.add(full);
      rows.push({
        url: full,
        thumb_url: atSize(src, 480),
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

  const hosts = String(
    process.env.GALLERY_BLOG_HOSTS ||
      "omkarsamithi.blogspot.com,omkarsandesh.blogspot.com"
  )
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  const runStartIso = new Date().toISOString();
  const report = [];
  try {
    for (const host of hosts) {
      const posts = await fetchAllPosts(host);
      const rows = postsToImageRows(posts, host, runStartIso);
      const count = await syncHost(baseUrl, serviceKey, host, rows, runStartIso);
      report.push({ host, posts: posts.length, images: count });
    }
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err.message || err), done: report });
  }
  return res.json({ ok: true, blogs: report });
}
