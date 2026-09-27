/**
 * Unified form submission handler (donate / seva / contact).
 *
 * Owner-configured endpoint (Formspree, Google Apps Script, SheetDB — any
 * CORS-enabled JSON webhook):
 *
 *   VITE_FORM_ENDPOINT=https://…
 *
 * With no endpoint the handler reports `no-endpoint` and each form keeps
 * its existing mailto flow byte-for-byte — the default site works with
 * zero configuration. With an endpoint, payloads POST as JSON; on any
 * failure the caller falls back to mailto so a message is never lost.
 *
 * Payload envelope: { form, lang, page, submittedAt, …fields }
 * Secrets stay in Vercel / .env.local — never in chat or the repo.
 */

const ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT;

export const formEndpointConfigured = Boolean(ENDPOINT);

const TIMEOUT_MS = 12000;

export async function submitForm({ form, lang, payload = {} }) {
  if (!ENDPOINT) return { ok: false, reason: "no-endpoint" };

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
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
        page: typeof window !== "undefined" ? window.location.href : "",
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
