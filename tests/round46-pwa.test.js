import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8")
);
const vercel = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");

describe("round 46 — the PWA installs from whichever host serves it", () => {
  it("locks the app identity so manifest edits never churn WebAPKs", () => {
    // Chrome derives the installed app's id from start_url unless the
    // manifest says otherwise; every start_url edit then re-registers
    // the WebAPK and re-runs Play Protect's scan on every phone.
    expect(manifest.id).toBe("/");
  });

  it("keeps start_url and scope relative, so scope always contains the page", () => {
    // A manifest's scope must contain the installing page's origin. Absolute
    // apex URLs made www visits fail Chrome's installability check with
    // "this app cannot be downloaded"; relative URLs resolve against the
    // manifest's own URL and are valid on every host.
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("keeps every icon relative too", () => {
    for (const icon of manifest.icons) {
      expect(icon.src, icon.src).not.toMatch(/^https?:/);
    }
    expect(manifest.icons.length).toBe(4);
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("never adds a hop between www and the apex: an external one already exists", () => {
    // Round 48 shipped a host-conditional 308 from www.omkarsamithi.com to
    // the apex here. An external hop (registrar forwarding / the Vercel
    // domain setup) already sends the apex to www, so the return hop closed
    // a circle — apex -> www -> apex -> www — and every visit died with
    // ERR_TOO_MANY_REDIRECTS. The www/apex relationship is owned by that
    // external layer alone; vercel.json must never add a second, opposing
    // hop. What makes installs work on whichever host ends up serving is
    // the relative manifest above, not a redirect.
    const config = JSON.parse(vercel);
    const hosts = config.redirects.flatMap((rule) =>
      (rule.has ?? [])
        .filter((has) => has.type === "host")
        .map((has) => has.value)
    );
    expect(hosts).not.toContain("www.omkarsamithi.com");
    expect(hosts).not.toContain("omkarsamithi.com");
  });

  it("gives every catch-all redirect a host condition, so no host forwards to itself", () => {
    // An unconditional catch-all redirect is how a self-loop is born: the
    // destination's own host would be forwarded straight back to itself.
    const config = JSON.parse(vercel);
    for (const rule of config.redirects) {
      if (rule.source === "/:path*") {
        expect(rule.has, rule.destination).toEqual(
          expect.arrayContaining([expect.objectContaining({ type: "host" })])
        );
      }
    }
    // the round-41 hop off the Vercel preview host stays
    expect(vercel).toContain('"value": "omkar-app.vercel.app"');
  });
});
