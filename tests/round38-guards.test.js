import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Round-38 guards — a push that reaches a device may never again vanish
 * without a trace in the handler itself.
 *
 * The old handler read event.data.text() INSIDE the catch for a failed
 * .json(); on an undecryptable payload .text() throws as well, the async
 * body rejected, and the device stayed silent while the sender honestly
 * reported "accepted". Every step is now guarded and showNotification is
 * wrapped. The testing-phase receipt (the "omkar-diag" stamp and the bell
 * panel's diagnostic line) was removed at full launch in round 40 — the
 * guards below are the part that stays forever.
 */

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const sw = read("../public/sw.js");

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
});
