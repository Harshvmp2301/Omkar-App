import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Round-35 guards — three failures the owner's own phone reported, pinned so
 * none of them can walk back in:
 *
 *  1. The open panel painted UNDER the flying hero mark (logo z 1200, panel
 *     z 71), so the big Omkar seal sat on top of the panel's text. The panel
 *     is a modal door: nothing decorative outranks it.
 *  2. A push that arrives while the site is open is suppressed as an OS
 *     notification (round 33's rule) and handed to the window as an
 *     "omkar:push" message — which NOTHING listened to, so the message
 *     vanished and an owner staring at his open app concluded the sender was
 *     dead. The window now listens and shows the quiet line.
 *  3. The bell never changed when notifications were enabled, and the admin
 *     "Send" line said "Sent — every subscribed device has it now" before
 *     reading the sender's reply at all. The bell now rings when a
 *     subscription exists, and the note carries the sender's own counts plus
 *     a fingerprint of the key it signed with, compared against the key the
 *     site subscribed with — the one mismatch no phone can ever report.
 */

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const styles = read("../src/styles.css");
const app = read("../src/App.jsx");
const header = read("../src/components/Header.jsx");
const panel = read("../src/components/NotifyPanel.jsx");
const pushAdmin = read("../src/admin/views/PushAdmin.jsx");
const sender = read("../supabase/functions/push-send/index.ts");
const sw = read("../public/sw.js");

/** The z-index a selector's rule sets (comments inside the brace included). */
const zOf = (sel) => {
  const m = styles.match(new RegExp(`\\.${sel}\\s*\\{[^}]*?z-index:\\s*(\\d+)`));
  return m ? Number(m[1]) : null;
};

describe("round 35: the panel outranks everything decorative", () => {
  it("paints scrim and panel above the flying logo and the header", () => {
    const logo = zOf("app-logo");
    const scrim = zOf("notify-scrim");
    const panelZ = zOf("notify-panel");
    expect(logo).toBe(1200); // the mark's rank is standing design, untouched
    expect(scrim).toBeGreaterThan(logo);
    expect(panelZ).toBeGreaterThan(scrim);
  });

  it("still yields to the lightbox, the toast and the skip link", () => {
    expect(zOf("notify-panel")).toBeLessThan(zOf("lightbox"));
    expect(zOf("lightbox")).toBeLessThan(zOf("toast"));
  });
});

describe("round 35: a push that arrives while open is told in the tab", () => {
  it("keeps the service worker's hand-off message", () => {
    expect(sw).toContain('type: "omkar:push"');
  });

  it("has a listener for it in the app, and a strip to show it on", () => {
    expect(app).toContain('d.type !== "omkar:push"');
    expect(app).toContain('className="push-inline"');
    expect(app).toContain('navigator.serviceWorker.addEventListener("message", onMessage)');
    expect(styles).toContain(".push-inline {");
  });

  it("parks the push line one rank above the reminder line", () => {
    expect(zOf("push-inline")).toBeGreaterThan(zOf("remind-strip"));
  });
});

describe("round 35: the bell wears its state", () => {
  it("swaps to the ringing bell when this device is subscribed", () => {
    expect(header).toContain("BellRing");
    expect(header).toMatch(/pushOn \? <BellRing/);
    expect(header).toContain('pushOn ? "on" : ""');
  });

  it("re-reads its state the moment the panel changes it", () => {
    expect(header).toContain('window.addEventListener("omkar:pushchange", read)');
    expect(panel).toContain('new Event("omkar:pushchange")');
  });
});

describe("round 35: the send line is the sender's answer, not a courtesy", () => {
  it("never claims success before reading the reply", () => {
    expect(pushAdmin).not.toContain("Sent — every subscribed device has it now.");
    expect(pushAdmin).toContain("const { data, error: fnErr } = await supabase.functions.invoke");
    expect(pushAdmin).toContain("d.failed");
    expect(pushAdmin).toContain("!d.subscriptions");
  });

  it("compares the sender's key fingerprint with the site's own key", () => {
    expect(pushAdmin).toContain("d.senderKey");
    expect(pushAdmin).toContain("siteKey.startsWith(senderKey)");
  });

  it("has a sender that reports refusals, gone devices and its own key", () => {
    expect(sender).toContain("senderKey: VAPID_PUBLIC.slice(0, 12)");
    expect(sender).toContain("errors,");
    expect(sender).toContain("gone,");
    expect(sender).toMatch(/if \(errors\.length < 6\) errors\.push/);
  });
});
