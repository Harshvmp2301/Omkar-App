/**
 * Unified form submission handler (seva / contact).
 *
 * A submission now has TWO possible destinations, and both are optional:
 *
 *   1. The database  — VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
 *      Saves the submission so the admin dashboard can show it.
 *   2. The notify webhook — VITE_FORM_ENDPOINT (Formspree, Google Apps
 *      Script, SheetDB — any CORS-enabled JSON webhook)
 *      Sends the admin an email about it.
 *
 * They are independent: whichever is configured is attempted, and the
 * submission counts as delivered if EITHER succeeds. That matters — an
 * email provider having a bad day must not throw away a signup that was
 * already safely stored, and vice versa.
 *
 * With nothing configured (the default site) this returns `no-endpoint`
 * exactly as it always did, and each form keeps its existing mailto flow
 * byte-for-byte. On failure the caller still falls back to mailto, so a
 * message is never lost.
 *
 * Payload envelope: { form, lang, page, submittedAt, …fields }
 * Secrets stay in config/.env.local (git-ignored) and in Vercel —
 * never in chat, never committed.
 */

import { insertSubmission, supabaseEnabled } from "./supabase.js";

const ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT;

export const formEndpointConfigured = Boolean(ENDPOINT);

const TIMEOUT_MS = 12000;

const pageUrl = () =>
  typeof window !== "undefined" ? window.location.href : "";

/** POST the notification webhook. Resolves, never throws. */
async function notifyWebhook({ form, lang, payload }) {
  if (!ENDPOINT) return { ok: false, reason: "no-endpoint" };

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        form,
        lang: lang || "en",
        submittedAt: new Date().toISOString(),
        page: pageUrl(),
        ...payload,
      }),
      signal: controller ? controller.signal : undefined,
    });
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Decide what to tell the visitor when nothing succeeded.
 *
 * Preserving `no-endpoint` here is deliberate: it is what tells the forms to
 * say "we've prepared an email for you" (the zero-config behaviour) rather
 * than "something went wrong".
 */
function failureReason(database, webhook) {
  const configured = supabaseEnabled || formEndpointConfigured;
  if (!configured) return "no-endpoint";
  // Something WAS configured, so this is a real failure — report it as one.
  return database.reason !== "not-configured"
    ? database.reason
    : webhook.reason;
}

export async function submitForm({ form, lang, payload = {} }) {
  const meta = { lang, source: pageUrl() };

  // Both attempts run even if the first fails — one destination being down
  // must not stop the other from receiving the submission.
  const database = await insertSubmission(form, payload, meta);
  const webhook = await notifyWebhook({ form, lang, payload });

  if (database.ok || webhook.ok) {
    return { ok: true, saved: database.ok, notified: webhook.ok };
  }

  return {
    ok: false,
    reason: failureReason(database, webhook),
    detail: database.detail,
  };
}
