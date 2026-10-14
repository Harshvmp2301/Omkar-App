import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const gs = readFileSync(new URL("../config/apps-script.gs", import.meta.url), "utf8");
const readme = readFileSync(new URL("../config/README.md", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/admin/client.js", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/0001_init.sql", import.meta.url),
  "utf8"
);

describe("round 53 — the Samithi's own address is an admin address", () => {
  it("sends form notifications to the Samithi, not to a placeholder", () => {
    expect(gs).toContain("var ADMIN_EMAIL = 'omkarsamithi@gmail.com';");
    expect(gs).not.toContain("REPLACE-WITH-ADMIN-EMAIL");
  });

  it("keeps the readme honest about the address being set", () => {
    expect(readme).toContain("omkarsamithi@gmail.com");
    expect(readme).not.toContain("Change `ADMIN_EMAIL` at the top to the Samithi's email address.");
  });

  it("keeps the security boundary where it belongs: the database allowlist", () => {
    // The dashboard gate is a row in public.admins, read through RLS. The
    // VITE_ADMIN_EMAILS env var is only a friendlier pre-round-trip hint;
    // if anyone ever makes it the boundary, adding an admin would become a
    // redeploy instead of one database row.
    expect(client).toContain('.from("admins")');
    expect(client).toContain("It is NOT the security boundary");
  });

  it("keeps the add-an-admin insert idempotent in the migration's example", () => {
    expect(migration).toContain("on conflict (email) do nothing");
  });
});
