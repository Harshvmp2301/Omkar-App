import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* Round 69 — the owner asked for the README to be brought in line with the
   site as it stands after rounds 66-68. These pins keep it honest: no seva
   in the storage story (the table survives as history only), the dashboard's
   three sections all named, events owned by the dashboard with the file
   keeping only the fallback, and the installed PWA name stated. */

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

describe("round 69 — README matches the app", () => {
  it("tells the storage story without seva", () => {
    expect(readme).not.toContain("Seva signups and contact messages");
    expect(readme).toContain("`seva_signups` table is still in it");
    expect(readme).toContain("nothing reads or writes that table any more");
    expect(readme).not.toContain("cannot read seva signups or messages back");
  });

  it("names all three dashboard sections", () => {
    expect(readme).toContain("- **Messages** —");
    expect(readme).toContain("- **Events** —");
    expect(readme).toContain("- **Push** —");
    expect(readme).toContain("Messages · Events · Push");
  });

  it("says events live in the dashboard, the file keeps the fallback", () => {
    expect(readme).toContain("**Events themselves live in the dashboard**");
    expect(readme).toContain("the curated fallback the public list shows when the database is empty");
  });

  it("states the installed name and the living-list feature", () => {
    expect(readme).toContain("installed as **Omkar Samithi**");
    expect(readme).toContain("**Upcoming programs — a living list**");
  });

  it("shows the tree the repo actually has", () => {
    expect(readme).toContain("AdminApp.jsx");
    expect(readme).toContain("NextProgram.jsx");
    expect(readme).toContain("panchang.js");
    expect(readme).toContain("NotifyPanel.jsx");
  });
});
