import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Round-37 guards — the owner's surgery on the bell panel, and the last
 * window that never listened.
 *
 *  1. The panel is now the state line and the button. The intro paragraph,
 *     the four-bullet promise list, the quiet-rule footnote and the
 *     "Done — this device will hear from the app itself" sentence are gone;
 *     the state line flipping to "Notifications are on for this device" is
 *     the done. What may remain beside state+button is diagnostic only:
 *     a failure carrying the database's words, the unsupported line, the
 *     busy line, and the installed-app gate line.
 *  2. The admin dashboard is an open window too: a push suppressed there
 *     (the owner's standing rule) is handed to the window, and until round
 *     37 nothing in the admin tree read it — so a send made from the
 *     owner's own laptop vanished in front of his eyes. The admin bar now
 *     carries the same quiet line as the public site.
 */

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const panel = read("../src/components/NotifyPanel.jsx");
const content = read("../src/data/content.js");
const styles = read("../src/styles.css");
const adminApp = read("../src/admin/AdminApp.jsx");

describe("round 37: the panel is the state line and the button", () => {
  it("no longer renders the intro, the promise list or the footnote", () => {
    expect(panel).not.toContain("alerts-intro");
    expect(panel).not.toContain("alerts-list");
    expect(panel).not.toContain("alerts-quiet");
    expect(styles).not.toContain(".alerts-intro");
    expect(styles).not.toContain(".alerts-list");
  });

  it("no longer promises 'Done —' or 'off for this device' in words", () => {
    expect(panel).not.toContain("t.alertsOn");
    expect(panel).not.toContain("t.alertsOff");
    expect(content).not.toContain("alertsOn:");
    expect(content).not.toContain("alertsOff:");
    expect(content).not.toContain("alertsIntro:");
    expect(content).not.toContain("alertsQuiet:");
    expect(content).not.toContain("alertsItem");
  });

  it("keeps the state line, both buttons and the testing-phase diagnostics", () => {
    expect(panel).toContain("t.alertsStatusOn");
    expect(panel).toContain("t.alertsEnable");
    expect(panel).toContain("t.alertsDisable");
    expect(panel).toContain("saved.reason");
    expect(panel).toContain("t.alertsInstallHint");
    // The round-34/35 contracts survive the surgery untouched.
    expect(panel).toContain('new Event("omkar:pushchange")');
    expect(panel).toContain('aria-labelledby="notify-title"');
  });
});

describe("round 37: the dashboard listens like the site does", () => {
  it("reads the service worker's hand-off in the admin tree", () => {
    expect(adminApp).toContain('d.type !== "omkar:push"');
    expect(adminApp).toContain('className="push-inline"');
    expect(adminApp).toContain("navigator.serviceWorker.addEventListener(\"message\", onMessage)");
  });

  it("hangs the strip off the sticky admin bar's own bottom edge", () => {
    expect(styles).toContain(".admin-bar .push-inline {");
  });
});
