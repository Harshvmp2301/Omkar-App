/**
 * Supabase data layer — stores form submissions in the database.
 *
 * Deliberately built on plain `fetch` against Supabase's REST (PostgREST)
 * endpoint rather than the supabase-js SDK. The public website only ever
 * needs to INSERT a row, and shipping a whole SDK to every visitor to do
 * that would bloat the bundle for no benefit. The admin dashboard, which
 * needs sign-in sessions and file uploads, uses the SDK instead — and loads
 * it lazily, so public visitors never download it.
 *
 *   VITE_SUPABASE_URL       https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY  the "anon" / publishable key
 *
 * ⛔ NEVER the service_role key. It ignores every rule in the database and
 *    would hand your seva signups and messages to anyone who views the page
 *    source. The anon key is safe precisely because the schema's Row Level
 *    Security refuses to let it READ these tables — it may only add rows.
 *
 * Zero-config and never fatal: with no URL/key this module stays switched
 * off and every call reports `not-configured`, so the forms keep their
 * existing mailto behaviour. Any network or server error resolves rather
 * than throws, so a database problem can never lose a visitor's message
 * without the caller being told.
 */

const URL_BASE = String(import.meta.env.VITE_SUPABASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
const KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

const URL_OK = /^https?:\/\/[^\s]+$/i.test(URL_BASE);

export const supabaseEnabled = Boolean(URL_OK && KEY);

/** Which environment variables are missing, for the dashboard's own check. */
export const supabaseMissing = [
  !URL_OK ? "VITE_SUPABASE_URL" : null,
  !KEY ? "VITE_SUPABASE_ANON_KEY" : null,
].filter(Boolean);

const TIMEOUT_MS = 12000;

/* ----------------------------------------------------------------- mapping */
/* Pure functions, exported for tests. Field names mirror exactly what each
   form sends — see the payloads in SevaView / ContactView. */

function trimOrNull(value, max = 4000) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function baseRow(meta = {}) {
  return {
    lang: trimOrNull(meta.lang, 8),
    source: trimOrNull(meta.source, 500),
  };
}

export function sevaRow(payload = {}, meta = {}) {
  return {
    ...baseRow(meta),
    name: trimOrNull(payload.name, 120) || "Anonymous",
    contact: trimOrNull(payload.contact, 160),
    seva: trimOrNull(payload.seva, 120),
    seva_detail: trimOrNull(payload.sevaSub, 200),
    details: trimOrNull(payload.details || payload.body),
  };
}

export function messageRow(payload = {}, meta = {}) {
  return {
    ...baseRow(meta),
    name: trimOrNull(payload.name, 120) || "Anonymous",
    email: trimOrNull(payload.email, 200),
    subject: trimOrNull(payload.subject, 200),
    message: trimOrNull(payload.message || payload.body, 8000) || "(no message)",
  };
}

const TABLE_FOR = {
  seva: "seva_signups",
  contact: "messages",
};

const MAPPER_FOR = {
  seva: sevaRow,
  contact: messageRow,
};

/** Build the row a given form would store — used by tests and diagnostics. */
export function rowFor(form, payload, meta) {
  const mapper = MAPPER_FOR[form];
  return mapper ? mapper(payload, meta) : null;
}

/* ------------------------------------------------------------------ insert */

export async function insertSubmission(form, payload = {}, meta = {}) {
  const table = TABLE_FOR[form];
  const row = rowFor(form, payload, meta);
  if (!table || !row) return { ok: false, reason: "unknown-form" };
  if (!supabaseEnabled) return { ok: false, reason: "not-configured" };

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

  try {
    const res = await fetch(`${URL_BASE}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        // Ask for nothing back: we have no permission to read the row we
        // just wrote, and wanting it back would turn a success into an error.
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      signal: controller ? controller.signal : undefined,
    });

    if (res.ok) return { ok: true };

    // Supabase explains rejections in the body (a constraint, a policy).
    // It is safe to surface: it never contains the key.
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message || body?.hint || body?.error || "";
    } catch {
      /* non-JSON error body — the status is enough */
    }
    return { ok: false, reason: `http-${res.status}`, detail: detail || undefined };
  } catch (err) {
    const aborted = err && err.name === "AbortError";
    return { ok: false, reason: aborted ? "timeout" : "network" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ------------------------------------------------------------ admin reads */
/* Used by the dashboard once someone is signed in. The anon key alone gets
   nothing back — Row Level Security returns an empty list for non-admins,
   which is why a failed sign-in looks like "no data" rather than an error. */

function authHeaders(accessToken) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${accessToken || KEY}`,
    "Content-Type": "application/json",
  };
}

async function selectRows(table, { accessToken, query = "", limit = 200 } = {}) {
  if (!supabaseEnabled) return { ok: false, reason: "not-configured", rows: [] };

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

  try {
    const search = query ? `?${query}&limit=${limit}` : `?select=*&limit=${limit}`;
    const res = await fetch(`${URL_BASE}/rest/v1/${table}${search}`, {
      headers: authHeaders(accessToken),
      signal: controller ? controller.signal : undefined,
    });
    if (!res.ok) return { ok: false, reason: `http-${res.status}`, rows: [] };
    const rows = await res.json();
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  } catch (err) {
    const aborted = err && err.name === "AbortError";
    return { ok: false, reason: aborted ? "timeout" : "network", rows: [] };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const listSevaSignups = (opts) =>
  selectRows("seva_signups", { query: "select=*&order=created_at.desc", ...opts });

export const listMessages = (opts) =>
  selectRows("messages", { query: "select=*&order=created_at.desc", ...opts });

/** Public content — readable with the anon key alone. */
export const listPublishedPhotos = (opts) =>
  selectRows("photos", {
    query: "select=*&published=eq.true&order=sort_order.asc,created_at.desc",
    ...opts,
  });

export const listPublishedEvents = (opts) =>
  selectRows("events", {
    query: "select=*&published=eq.true&order=sort_order.asc,starts_at.asc",
    ...opts,
  });

/** Build the public URL for a file stored in the photos bucket. */
export function photoUrl(storagePath) {
  if (!supabaseEnabled || !storagePath) return "";
  return `${URL_BASE}/storage/v1/object/public/photos/${String(storagePath)
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/* ------------------------------------------------------- push subscriptions */

/**
 * Store (or refresh) one device's push subscription, round 29.
 *
 * Same insert-only posture as the forms: the anon key may add a row and
 * update its own endpoint's keys, and nothing else — the table's Row Level
 * Security (see TRANSFER-NOTES for the exact SQL) refuses reads and refuses
 * every other table. `resolution=merge-duplicates` makes a re-subscribe from
 * the same device update its row instead of failing on the unique endpoint.
 */
export async function savePushSubscription({ endpoint, p256dh, auth }) {
  if (!supabaseEnabled) return { ok: false, reason: "not-configured" };
  if (!endpoint || !p256dh || !auth) return { ok: false, reason: "bad-subscription" };
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/push_subscriptions`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        endpoint,
        p256dh,
        auth,
        // Round 33: the sender writes to each device in that device's own
        // language, so the subscription remembers it at enable time.
        lang: String(
          typeof navigator !== "undefined" ? navigator.language || "" : ""
        )
          .toLowerCase()
          .startsWith("kn")
          ? "kn"
          : "en",
        updated_at: new Date().toISOString(),
      }),
    });
    if (res.ok) return { ok: true };
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message || body?.hint || body?.error || "";
    } catch {
      /* the status is enough */
    }
    return { ok: false, reason: `http-${res.status}`, detail: detail || undefined };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Forget a device (the admin panel's "Disable"): delete by exact endpoint. */
export async function deletePushSubscription(endpoint) {
  if (!supabaseEnabled) return { ok: false, reason: "not-configured" };
  if (!endpoint) return { ok: false, reason: "bad-subscription" };
  try {
    const res = await fetch(
      `${URL_BASE}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      {
        method: "DELETE",
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      }
    );
    return res.ok ? { ok: true } : { ok: false, reason: `http-${res.status}` };
  } catch {
    return { ok: false, reason: "network" };
  }
}
