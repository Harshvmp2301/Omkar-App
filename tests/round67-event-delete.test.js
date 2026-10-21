import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* Round 67 — the owner's ask: "Give the choice to even delete the event
   (added) from the admin page." A stored event must be deletable from its
   card, confirm-first (the Messages page pattern), and the deletion must
   reach the database row the public site reads — not just hide the card.
   An unsaved new card gets a quiet Discard that never touches the db. */

const read = (rel) =>
  readFileSync(new URL(rel, import.meta.url), "utf8");

describe("round 67 — events can be deleted from the dashboard", () => {
  const admin = read("../src/admin/views/EventsAdmin.jsx");

  it("deletes the stored row the public site reads", () => {
    expect(admin).toContain('.from("events").delete().eq("id", card.id)');
  });

  it("confirms first, naming the event, like the Messages page does", () => {
    expect(admin).toContain("window.confirm");
    expect(admin).toContain("This cannot be undone.");
    expect(admin).toContain("It leaves the public site immediately.");
  });

  it("gives every saved card a Delete button, and only saved cards", () => {
    expect(admin).toContain("Delete event");
    expect(admin).toContain("admin-btn--danger");
    // The button lives behind the card.id check — an unsaved card shows the
    // quiet Discard instead, and that branch returns before any confirm or
    // database call.
    expect(admin).toContain("Discard card");
    const discardBranch = admin.indexOf("if (!card.id) {");
    const confirmAt = admin.indexOf("window.confirm");
    expect(discardBranch).toBeGreaterThan(-1);
    expect(confirmAt).toBeGreaterThan(discardBranch);
  });

  it("reports the outcome and refreshes the row list", () => {
    expect(admin).toContain("deleted — it is off the site now.");
    // After the delete the page re-reads the table, so what is on screen is
    // what is stored (the round-32 rule, same as the save path).
    expect(admin.split("fetchRows().then(").length - 1).toBeGreaterThanOrEqual(2);
    // And the round-33 nudge goes out so subscribed devices hear about the
    // changed program list now, not at the next cron tick.
    expect(admin.split('supabase.functions.invoke("push-send")').length - 1).toBe(2);
  });

  it("locks both actions while either is in flight", () => {
    expect(admin).toContain('disabled={saving !== "" || removing !== ""}');
    expect(admin).toContain('"Deleting…"');
  });

  it("keeps the two buttons side by side, styled", () => {
    const styles = read("../src/styles.css");
    expect(styles).toContain(".admin-tile-actions");
    expect(admin).toContain('className="admin-tile-actions"');
  });

  it("says so in the README", () => {
    expect(read("../README.md")).toContain("delete any event (confirm-first");
  });
});
