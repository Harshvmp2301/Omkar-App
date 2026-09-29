/**
 * Supabase client for the admin dashboard — loaded LAZILY.
 *
 * The public site deliberately does not use the supabase-js SDK (it only
 * needs to insert a row; see src/utils/supabase.js). Here we do need it, for
 * sign-in sessions, token refresh and Storage uploads.
 *
 * Everything in src/admin/ is reached through a dynamic import from the
 * router, so this SDK and the whole dashboard land in a separate chunk that a
 * normal visitor never downloads. `npm run build` shows it as its own file.
 */

let clientPromise = null;

const URL_BASE = String(import.meta.env.VITE_SUPABASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
const ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const adminConfigured = Boolean(URL_BASE && ANON_KEY);

/** Which variables are missing, so the dashboard can say so plainly. */
export const adminMissing = [
  !URL_BASE ? "VITE_SUPABASE_URL" : null,
  !ANON_KEY ? "VITE_SUPABASE_ANON_KEY" : null,
].filter(Boolean);

/** Resolve the shared client, importing the SDK on first use. */
export function getSupabase() {
  if (!adminConfigured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(URL_BASE, ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Google sends the session back in the URL fragment, which the
          // SDK reads automatically. This keeps the hash clean afterwards.
          detectSessionInUrl: true,
        },
      })
    );
  }
  return clientPromise;
}

/** Sign in with Google, returning to the dashboard afterwards. */
export async function signInWithGoogle() {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, reason: "not-configured" };

  // Come back to ?admin=1, NOT to #/admin.
  //
  // Supabase appends the result of the sign-in to this URL — with the implicit
  // flow it adds "#access_token=…" to the fragment. If we asked to return to
  // "#/admin" the browser would receive "…/#/admin#access_token=…", which is
  // not a route the app can read and would drop the visitor on the hub page
  // with no dashboard. A query marker survives both flows cleanly and is read
  // by tabFromHash() in src/App.jsx.
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?admin=1`
      : undefined;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  return error ? { ok: false, reason: error.message } : { ok: true };
}

export async function signOut() {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

/**
 * Is the signed-in person on the allowlist?
 *
 * The admins table only exposes a row to an admin (RLS), so a signed-in
 * non-admin gets an empty list. That is why "no data" and "not an admin"
 * look alike — this check exists to tell them apart, and to give the person
 * a clear message instead of a mysteriously empty dashboard.
 *
 * VITE_ADMIN_EMAILS is only used to show a friendlier message before the
 * database round-trip. It is NOT the security boundary: the allowlist in the
 * database is what actually decides.
 */
export async function checkAdmin(session) {
  const email = String(session?.user?.email || "").toLowerCase();
  if (!email) return { isAdmin: false, reason: "no-email" };

  const supabase = await getSupabase();
  if (!supabase) return { isAdmin: false, reason: "not-configured" };

  const { data, error } = await supabase
    .from("admins")
    .select("email")
    .limit(1);

  if (error) return { isAdmin: false, reason: error.message };
  if (Array.isArray(data) && data.length > 0) return { isAdmin: true };

  // The read returned nothing: either not an admin, or the allowlist is
  // empty. Both need the same fix — add the address to public.admins.
  return { isAdmin: false, reason: "not-listed" };
}
