/**
 * push-send — the notification sender (round 33).
 *
 * The whole "I click Save and everyone knows" chain ends here:
 *
 *   · a program date saved in the dashboard fires a database trigger that
 *     drops a row into push_outbox — no extra click, no extra step;
 *   · a new blog post or YouTube video is noticed here, by polling the same
 *     public feeds the site reads, and comparing against push_feed_state;
 *   · a custom message the owner wrote arrives through the push_custom rpc;
 *   · this function then encrypts each queued message to every stored
 *     subscription (Web Push, VAPID) and marks the queue row sent.
 *
 * Who may call it:
 *   · the scheduled run (pg_cron via supabase.schedule_function) presents the
 *     service-role key and gets mode "full": poll feeds AND deliver;
 *   · a signed-in human (the dashboard, right after Save or Send) presents
 *     their own user JWT and gets mode "send": deliver what is queued, no
 *     feed polling — the cron owns that;
 *   · everyone else gets 401. The platform's own JWT check stays on, so an
 *     anonymous visitor with the anon key cannot reach any of it.
 *
 * Language: a subscription stores the device's language at enable time, so a
 * Kannada phone reads Kannada and an English phone reads English — the same
 * bilingual-equivalence rule the site itself follows.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptPushPayload, vapidJwt } from "./webpush.ts";
import { feedPush, programPush } from "../../../src/utils/push-text.js";

const ENV = Deno.env;
const URL_BASE = String(ENV.get("SUPABASE_URL") || "");
const SERVICE = String(ENV.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const ANON = String(ENV.get("SUPABASE_ANON_KEY") || "");
const VAPID_PRIVATE = String(ENV.get("VAPID_PRIVATE_KEY") || "").trim();
const VAPID_PUBLIC = String(ENV.get("VAPID_PUBLIC_KEY") || "").trim();
const SUBJECT = String(ENV.get("VAPID_SUBJECT") || "mailto:info@omkarsamithi.com");
const BLOG = String(ENV.get("BLOGGER_BLOG_URL") || "").trim().replace(/\/+$/, "");
const YT_KEY = String(ENV.get("YOUTUBE_API_KEY") || "").trim();
const YT_CHANNEL = String(ENV.get("YOUTUBE_CHANNEL_ID") || "").trim();

const db = createClient(URL_BASE, SERVICE);
const authClient = createClient(URL_BASE, ANON);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-cron-token",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

type FeedItem = { id: string; title: string; url: string };

async function pollBlog(): Promise<FeedItem[]> {
  if (!BLOG) return [];
  const res = await fetch(`${BLOG}/feeds/posts/default?alt=json&max-results=5`);
  if (!res.ok) return [];
  const data = await res.json();
  const entries = Array.isArray(data?.feed?.entry) ? data.feed.entry : [];
  return entries
    .map((e: Record<string, unknown>) => {
      const id = (e.id as Record<string, unknown>)?.["$t"] ?? e.id ?? "";
      const title = (e.title as Record<string, unknown>)?.["$t"] ?? "";
      const links = Array.isArray(e.link) ? (e.link as Record<string, unknown>[]) : [];
      const alt = links.find((l) => l.rel === "alternate");
      return { id: String(id), title: String(title), url: String(alt?.href || "/") };
    })
    .filter((it: FeedItem) => it.id && it.title);
}

async function pollVideos(): Promise<FeedItem[]> {
  if (!YT_KEY || !/^UC[\w-]{10,}$/.test(YT_CHANNEL)) return [];
  const url =
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet` +
    `&playlistId=UU${YT_CHANNEL.slice(2)}&maxResults=5&key=${YT_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .map((it: Record<string, unknown>) => {
      const snippet = (it.snippet || {}) as Record<string, unknown>;
      const resourceId = (snippet.resourceId || {}) as Record<string, unknown>;
      const id = String(resourceId.videoId || "");
      return {
        id,
        title: String(snippet.title || ""),
        url: id ? `https://www.youtube.com/watch?v=${id}` : "/",
      };
    })
    .filter((it: FeedItem) => it.id && it.title);
}

/** Notice what is new since the last look; queue at most three per feed. */
async function pollFeed(kind: "blog" | "video"): Promise<number> {
  const items = kind === "blog" ? await pollBlog() : await pollVideos();
  if (items.length === 0) return 0;

  const { data: state } = await db
    .from("push_feed_state")
    .select("last_id")
    .eq("kind", kind)
    .maybeSingle();

  // First ever look: remember where today is, send nothing. Nobody wants
  // five old posts ringing their phone the night the sender goes live.
  if (!state) {
    await db.from("push_feed_state").insert({ kind, last_id: items[0].id });
    return 0;
  }

  const fresh: FeedItem[] = [];
  for (const item of items) {
    if (item.id === state.last_id) break;
    fresh.push(item);
  }
  if (fresh.length === 0) return 0;

  for (const item of fresh.slice(0, 3)) {
    const bodies = feedPush(kind, item.title);
    const { error } = await db.from("push_outbox").insert({
      kind,
      dedupe: item.id,
      data: { url: item.url },
      title_en: bodies.title_en,
      title_kn: bodies.title_kn,
      body_en: bodies.body_en,
      body_kn: bodies.body_kn,
    });
    // A repeat of something already queued hits the partial unique index;
    // that is the dedupe working, not a failure.
    if (error && !/duplicate/i.test(error.message)) throw error;
  }
  await db
    .from("push_feed_state")
    .update({ last_id: items[0].id, updated_at: new Date().toISOString() })
    .eq("kind", kind);
  return Math.min(fresh.length, 3);
}

async function deliver(
  sub: { endpoint: string; p256dh: string; auth: string },
  title: string,
  body: string,
  url: string
): Promise<"ok" | "gone" | string> {
  const { jwt } = await vapidJwt({
    endpoint: sub.endpoint,
    subject: SUBJECT,
    privateB64url: VAPID_PRIVATE,
    publicB64url: VAPID_PUBLIC,
  });
  const { payload } = await encryptPushPayload(JSON.stringify({ title, body, url, tag: "omkar" }), sub);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: payload as BufferSource,
  });
  if (res.status === 404 || res.status === 410) {
    // The browser forgot this subscription; forget it too.
    await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    return "gone";
  }
  return res.ok ? "ok" : `http-${res.status}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const cronGiven = req.headers.get("x-cron-token") || "";
  const cronSecret = String(ENV.get("CRON_TOKEN") || "");

  let mode: "" | "send" | "full" = "";
  if (bearer && SERVICE && bearer === SERVICE) mode = "full"; // the cron
  else if (cronSecret && cronGiven === cronSecret) mode = "full";
  else if (bearer) {
    const { error } = await authClient.auth.getUser(bearer);
    if (!error) mode = "send"; // a signed-in human, right after Save or Send
  }
  if (!mode) return json({ error: "unauthorized" }, 401);
  if (!VAPID_PRIVATE || !VAPID_PUBLIC) {
    return json({ error: "VAPID keys missing from the function secrets" }, 500);
  }

  let enqueued = 0;
  if (mode === "full") {
    enqueued += await pollFeed("blog");
    enqueued += await pollFeed("video");
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: pending }, { data: subs }] = await Promise.all([
    db
      .from("push_outbox")
      .select("*")
      .is("sent_at", null)
      .gt("created_at", weekAgo)
      .order("id", { ascending: true })
      .limit(25),
    db.from("push_subscriptions").select("endpoint, p256dh, auth, lang"),
  ]);

  const list = subs || [];
  let delivered = 0;
  let failed = 0;

  for (const row of pending || []) {
    const bodies = row.body_en
      ? { title_en: row.title_en, title_kn: row.title_kn, body_en: row.body_en, body_kn: row.body_kn }
      : programPush(row.data || {});
    const url = row.kind === "program" ? "/#/events" : String(row.data?.url || "/");

    if (list.length === 0) {
      await db
        .from("push_outbox")
        .update({ sent_at: new Date().toISOString(), error: "no subscriptions" })
        .eq("id", row.id);
      continue;
    }

    let rowFailed = 0;
    const results = await Promise.all(
      list.map((sub) => {
        const kn = String(sub.lang || "en").startsWith("kn");
        return deliver(
          sub,
          kn ? bodies.title_kn : bodies.title_en,
          kn ? bodies.body_kn : bodies.body_en,
          url
        ).catch((err) => String((err && err.message) || err));
      })
    );
    for (const r of results) {
      if (r === "ok" || r === "gone") delivered += 1;
      else {
        rowFailed += 1;
        failed += 1;
      }
    }
    await db
      .from("push_outbox")
      .update({
        sent_at: new Date().toISOString(),
        error: rowFailed ? `${rowFailed} of ${list.length} failed` : null,
      })
      .eq("id", row.id);
  }

  return json({
    mode,
    enqueued,
    queued: (pending || []).length,
    subscriptions: list.length,
    delivered,
    failed,
  });
});
