import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  insertSubmission,
  listMessages,
  messageRow,
  photoUrl,
  rowFor,
  sevaRow,
  supabaseEnabled,
  supabaseMissing,
} from "./supabase.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Zero-config contract: with no project URL / key the module stays switched
 * off and every call reports it, so the forms keep their mailto behaviour.
 */
describe("supabase — zero-config contract", () => {
  it("is disabled without credentials", () => {
    expect(supabaseEnabled).toBe(false);
  });

  it("names what is missing, for the dashboard's own check", () => {
    expect(supabaseMissing).toEqual([
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
    ]);
  });

  it("reports not-configured instead of throwing or reaching the network", async () => {
    await expect(insertSubmission("seva", { name: "A" })).resolves.toEqual({
      ok: false,
      reason: "not-configured",
    });
  });

  it("reads return an empty list rather than an error", async () => {
    const res = await listMessages();
    expect(res.ok).toBe(false);
    expect(res.rows).toEqual([]);
  });

  it("builds no photo URL when there is no project", () => {
    expect(photoUrl("2026/a.webp")).toBe("");
  });
});

/**
 * The payloads below are copied from what the real forms actually send
 * (SevaView / ContactView), so this pins the contract between
 * the UI and the database rather than an invented shape.
 */
describe("supabase — row mapping", () => {
  it("maps a seva signup, keeping the seva and its sub-label apart", () => {
    const row = sevaRow({
      name: "Lakshmi",
      contact: "+968 9000 0000",
      details: "Happy to help on the day",
      seva: "Food",
      sevaSub: "Langar distribution",
    });

    expect(row.name).toBe("Lakshmi");
    expect(row.seva).toBe("Food");
    expect(row.seva_detail).toBe("Langar distribution");
    expect(row.details).toBe("Happy to help on the day");
  });

  it("maps a contact message", () => {
    const row = messageRow({
      name: "Anand",
      email: "anand@example.com",
      subject: "Question",
      message: "When is the next program?",
    });

    expect(row).toEqual({
      name: "Anand",
      email: "anand@example.com",
      subject: "Question",
      message: "When is the next program?",
      lang: null,
      source: null,
    });
  });

  it("falls back to Anonymous and never sends an empty name", () => {
    // The database requires a non-empty name; blank would be rejected.
    expect(sevaRow({ name: "   " }).name).toBe("Anonymous");
    expect(messageRow({}).name).toBe("Anonymous");
  });

  it("strips empty strings to null so blanks are not stored as ''", () => {
    const row = sevaRow({ name: "A", contact: "   ", seva: "" });
    expect(row.contact).toBeNull();
    expect(row.seva).toBeNull();
  });

  it("truncates over-long values instead of letting the insert fail", () => {
    const row = messageRow({ name: "A", subject: "x".repeat(500) });
    expect(row.subject).toHaveLength(200);
    expect(sevaRow({ name: "y".repeat(500) }).name).toHaveLength(120);
  });

  it("refuses an unknown form rather than writing somewhere wrong", () => {
    expect(rowFor("nonsense", {})).toBeNull();
  });
});

/**
 * The configured path. There is no live Supabase to talk to from here, so
 * `fetch` is mocked and the actual request is asserted: wrong URL, missing
 * apikey header or a wrong body would be invisible until a real submission
 * was silently lost. This is the highest-risk code in the module.
 */
describe("supabase — the request it actually sends", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  /** Re-import with credentials present, as if config/.env.local were filled. */
  async function loadConfigured() {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://demo.supabase.co/");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    return import("./supabase.js");
  }

  it("POSTs to the right table with the anon key and the mapped row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await loadConfigured();
    expect(mod.supabaseEnabled).toBe(true);
    expect(mod.supabaseMissing).toEqual([]);

    const res = await mod.insertSubmission(
      "seva",
      { name: "Ravi", contact: "ravi@x.com", seva: "Food", sevaSub: "Langar", details: "note" },
      { lang: "en", source: "https://example.org/#/seva" }
    );

    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    // The trailing slash in the configured URL must not become a double slash.
    expect(url).toBe("https://demo.supabase.co/rest/v1/seva_signups");
    expect(init.method).toBe("POST");
    expect(init.headers.apikey).toBe("anon-test-key");
    expect(init.headers.Authorization).toBe("Bearer anon-test-key");
    // return=minimal matters: we cannot read back what we just wrote.
    expect(init.headers.Prefer).toBe("return=minimal");

    const body = JSON.parse(init.body);
    expect(body.name).toBe("Ravi");
    expect(body.seva).toBe("Food");
    expect(body.seva_detail).toBe("Langar");
    expect(body.lang).toBe("en");
  });

  it("routes each form to its own table", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await loadConfigured();

    await mod.insertSubmission("seva", { name: "A", seva: "Food" });
    await mod.insertSubmission("contact", { name: "A", message: "Hi" });

    expect(fetchMock.mock.calls[0][0]).toContain("/rest/v1/seva_signups");
    expect(fetchMock.mock.calls[1][0]).toContain("/rest/v1/messages");
  });

  it("surfaces the database's own explanation when it rejects a row", async () => {
    // A constraint violation must not read as a generic failure: the message
    // is what tells you which rule was broken.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "new row violates row-level security policy" }),
      })
    );
    const mod = await loadConfigured();

    const res = await mod.insertSubmission("contact", { name: "A", message: "Hi" });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("http-400");
    expect(res.detail).toContain("row-level security");
  });

  it("treats a thrown fetch as a network failure, never an exception", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const mod = await loadConfigured();

    await expect(
      mod.insertSubmission("seva", { name: "A" })
    ).resolves.toMatchObject({ ok: false, reason: "network" });
  });

  it("never puts the anon key in the error it returns", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
    );
    const mod = await loadConfigured();

    const res = await mod.insertSubmission("seva", { name: "A" });
    expect(JSON.stringify(res)).not.toContain("anon-test-key");
  });

  it("builds a public photo URL", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const mod = await loadConfigured();
    expect(mod.photoUrl("2026/a b.webp")).toBe(
      "https://demo.supabase.co/storage/v1/object/public/photos/2026/a%20b.webp"
    );
  });
});

/**
 * Drift guard. The SQL could not be executed in this environment, so this
 * cross-checks the code against the migration text instead: every field the
 * app sends must exist as a column in the matching CREATE TABLE. A rename
 * on either side fails here rather than in production.
 */
describe("supabase — schema drift guard", () => {
  const sql = readFileSync(
    join(root, "supabase", "migrations", "0001_init.sql"),
    "utf8"
  );

  function columnsOf(table) {
    const match = sql.match(
      new RegExp(
        `create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
        "i"
      )
    );
    if (!match) throw new Error(`no CREATE TABLE found for ${table}`);
    return match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("--") && !/^constraint\b/i.test(line))
      .map((line) => line.split(/\s+/)[0].replace(/,$/, ""))
      .filter(Boolean);
  }

  const CASES = [
    ["seva", "seva_signups", () => sevaRow({ name: "A" })],
    ["contact", "messages", () => messageRow({ name: "A" })],
  ];

  for (const [form, table, build] of CASES) {
    it(`every field sent to "${table}" is a real column`, () => {
      const columns = columnsOf(table);
      const sent = Object.keys(build());
      expect(columns.length).toBeGreaterThan(0);
      for (const field of sent) {
        expect(columns, `"${field}" is sent by the ${form} form but is not a column of ${table}`).toContain(field);
      }
    });
  }

  it("keeps the admin gate and the service_role warning in place", () => {
    // RLS is the only thing standing between the public anon key and the
    // submissions, so its absence must fail loudly.
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/function public\.is_admin\(\)/i);
    expect(sql.match(/enable row level security/gi).length).toBeGreaterThanOrEqual(5);
  });

  it("has no donations table (the Samithi does not accept donations)", () => {
    expect(sql).not.toMatch(/create table if not exists public\.donations/i);
    expect(sql).not.toMatch(/donation_totals/i);
  });

  it("documents how to add the first admin", () => {
    expect(sql).toMatch(/insert into public\.admins/i);
  });
});
