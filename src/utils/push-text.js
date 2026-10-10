/**
 * The words a push notification carries — one module, two readers.
 *
 * The Supabase Edge Function (supabase/functions/push-send) formats every
 * outgoing notification with these functions, and the tests compare them
 * against the in-tab reminder strings, so a phone pop-up and the quiet line
 * under the header can never disagree about how the same news reads. The
 * module is dependency-free on purpose: Deno imports it straight from the
 * edge function, Vite imports it into the bundle, vitest imports it in Node.
 *
 * Dates are formatted with Intl (en-GB / kn-IN), exactly like the rest of
 * the site, so Kannada month names come from the same ICU data everywhere.
 */

/** "18 December 2026" / "18 ಡಿಸೆಂಬರ್ 2026"; "" when there is no date. */
export function formatPushDate(iso, lang = "en") {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "kn" ? "kn-IN" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const SITE_EN = "Omkar Samithi";
const SITE_KN = "ಓಂಕರ ಸಮಿತಿ";

/**
 * A program date was set or moved. Same sentence shape as the in-tab
 * "moved" line: "{name} now on {date}" / "{name} ಈಗ {date}". A row saved
 * with no date yet announces itself as to-be-announced rather than staying
 * silent, because "we removed the date" is also news.
 */
export function programPush(data = {}) {
  const nameEn = data.title_en || SITE_EN;
  const nameKn = data.title_kn || data.title_en || SITE_KN;
  const en = formatPushDate(data.starts_at, "en");
  const kn = formatPushDate(data.starts_at, "kn");
  return {
    title_en: nameEn,
    title_kn: nameKn,
    body_en: en ? `${nameEn} now on ${en}` : `${nameEn}: date to be announced`,
    body_kn: kn ? `${nameKn} ಈಗ ${kn}` : `${nameKn}: ದಿನಾಂಕ ಘೋಷಿಸಲಾಗುವುದು`,
  };
}

/**
 * A new blog post or YouTube video. Identical wording to the in-tab strip
 * (remindBlog / remindVideo), which the tests pin against content.js.
 */
export function feedPush(kind, title = "") {
  if (kind === "blog") {
    return {
      title_en: SITE_EN,
      title_kn: SITE_KN,
      body_en: `New on the blog: ${title}`,
      body_kn: `ಹೊಸ ಬರಹ: ${title}`,
    };
  }
  return {
    title_en: SITE_EN,
    title_kn: SITE_KN,
    body_en: `New video: ${title}`,
    body_kn: `ಹೊಸ ವಿಡಿಯೋ: ${title}`,
  };
}

/** A message the Samithi wrote itself: the text is the notification. */
export function customPush({ body_en = "", body_kn = "" } = {}) {
  return {
    title_en: SITE_EN,
    title_kn: SITE_KN,
    body_en: String(body_en).trim(),
    body_kn: String(body_kn).trim(),
  };
}

/**
 * Should the service worker raise a pop-up at all? A visitor sitting on the
 * site is already being told by the quiet line under the header — ringing
 * their phone on top of that is the nuisance the owner ruled out. The same
 * three-line rule lives inline in public/sw.js (which cannot import); the
 * tests read both and fail if they drift apart.
 */
export function anyClientOpen(clients = []) {
  return clients.some((c) => c.focused || c.visibilityState === "visible");
}
