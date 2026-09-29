/**
 * Address bar → view.
 *
 * The site routes on the fragment ("#/gallery"), which is fine on its own but
 * collides with the Google sign-in callback: Supabase returns the session in
 * the fragment too ("#access_token=…"), and the two can arrive together. This
 * is the single place that decides, so the rule can be tested without a
 * browser — see route.test.js.
 *
 * Precedence, in order:
 *   1. a real nav tab in the fragment — an explicit click always wins, so
 *      "Back to site" (#/hub) leaves the dashboard
 *   2. #/admin — the dashboard, reached directly
 *   3. ?admin=1 — where sign-in returns to (src/admin/client.js)
 *   4. any leftover callback in the URL — stay on the dashboard while the
 *      auth SDK finishes digesting it
 *   5. otherwise the hub
 */

export const TABS = ["hub", "events", "gallery", "about", "seva"];

export function tabFromHash(location = typeof window !== "undefined" ? window.location : null) {
  if (!location) return "hub";

  const hash = location.hash || "";
  const search = location.search || "";

  // "#/gallery" → "gallery". Splitting on the auth markers copes with a
  // callback the SDK has not cleaned out of the fragment yet, e.g.
  // "#/admin#access_token=…".
  const h = hash.replace(/^#\/?/, "").split(/[?#&]/)[0];

  if (TABS.includes(h)) return h;
  if (h === "admin") return "admin"; // dashboard — not a public nav tab
  if (h === "contact") return "about"; // legacy deep-link: Contact merged into About
  // "donate" is a retired deep-link: it falls through to the hub rather than
  // landing on a dead route. The Samithi does not accept donations.

  if (new URLSearchParams(search).get("admin") === "1") return "admin";

  if (/[?#&](access_token|code|error_description)=/.test(`${search}${hash}`)) return "admin";

  return "hub";
}
