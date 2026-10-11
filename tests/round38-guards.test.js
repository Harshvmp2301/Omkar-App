import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Round-38 guards — a push that reaches a device may never again vanish
 * without leaving its fingerprint.
 *
 * The old handler read event.data.text() INSIDE the catch for a failed
 * .json(); on an undecryptable payload .text() throws as well, the async
 * body rejected, and the device stayed silent while the sender honestly
 * reported "accepted" — exactly the symptom three subscribed devices
 * showed at once. Now every step is guarded, showNotification itself is
 * wrapped, and whichever way the push goes (ring or in-tab hand-off) a
 * receipt {at, mode} is stamped into the "omkar-diag" cache, which the
 * bell panel reads and shows as one testing-phase line: no push yet /
 * reached and told in the tab / reached and rang.
 */

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const sw = read("../public/sw.js");
const panel = read("../src/components/NotifyPanel.jsx");
const content = read("../src/data/content.js");

describe("round 38: the push handler cannot die quietly", () => {
  it("guards the payload fallback inside its own try", () => {
    expect(sw).toContain("data = { body: event.data ? event.data.text() : \"\" };");
    // the inner fallback has its own catch — the old silent rejection is gone
    expect(sw).toMatch(/text\(\) : "" \};\n {4}\} catch \{\n {6}data = \{\};/);
  });

  it("wraps both the hand-off and the notification itself", () => {
    expect(sw).toMatch(/clients\.map\(\(c\) => c\.postMessage[\s\S]{0,220}\} catch \{/);
    expect(sw).toMatch(/showNotification\(title, \{[\s\S]{0,400}\} catch \{/);
  });

  it("stamps a receipt into omkar-diag, and keeps that cache across updates", () => {
    expect(sw).toContain('caches.open("omkar-diag")');
    expect(sw).toContain('mode: open ? "tab" : "ring"');
    expect(sw).toContain('k !== CACHE && k !== "omkar-diag"');
  });
});

describe("round 38: the panel reads the receipt back", () => {
  it("shows exactly one diagnostic line with three possible worlds", () => {
    expect(panel).toContain('caches.open("omkar-diag")');
    expect(panel).toContain("t.pushDiagNone");
    expect(panel).toContain("t.pushDiagTab");
    expect(panel).toContain("t.pushDiagRing");
    expect(panel).toContain('diag.mode === "tab"');
  });

  it("carries the line in both languages", () => {
    for (const key of ["pushDiagNone:", "pushDiagTab:", "pushDiagRing:"]) {
      expect((content.match(new RegExp(key, "g")) || []).length).toBe(2);
    }
    expect(content).toContain("{time}");
  });
});
