import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Round-36 guards — the preflight that killed the dashboard's send.
 *
 * The function was provably alive (a plain tab GET answered
 * {"error":"POST only"}) while supabase-js's invoke() died with
 * "Failed to send a request to the Edge Function": a fetch-level death,
 * i.e. the browser itself refused the cross-origin POST because the
 * preflight allow-list never named the extra headers supabase-js decorates
 * every request with (apikey, x-client-info). Two pins:
 *
 *  1. the sender's CORS allow-list names every header the client libraries
 *     actually send, and caches the preflight answer for a day;
 *  2. the dashboard keeps a plain-fetch fallback that sends only the two
 *     headers any allow-list on this function has always named, so no
 *     browser or proxy can ever strand the delivery ask again.
 */

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const sender = read("../supabase/functions/push-send/index.ts");
const pushAdmin = read("../src/admin/views/PushAdmin.jsx");

describe("round 36: the preflight names every header the clients send", () => {
  it("lists apikey and x-client-info beside authorization", () => {
    expect(sender).toContain(
      '"authorization, content-type, x-cron-token, apikey, x-client-info, x-supabase-api-version"'
    );
  });

  it("lets the browser cache the preflight answer", () => {
    expect(sender).toContain('"access-control-max-age": "86400"');
  });
});

describe("round 36: the dashboard has a preflight-safe fallback", () => {
  it("retries with a plain fetch carrying only safe headers", () => {
    expect(pushAdmin).toContain("/functions/v1/push-send");
    expect(pushAdmin).toContain("authorization: `Bearer ${tok}`");
    expect(pushAdmin).toContain('await supabase.auth.getSession()');
  });

  it("reports the sender's HTTP answer verbatim if even that fails", () => {
    expect(pushAdmin).toContain("Queued, but the sender answered HTTP ${r.status}");
  });
});
