import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

const read = (rel) => readFileSync(join(root, rel), "utf8");

/**
 * Repo-relative path, always with forward slashes.
 *
 * Comparing raw paths would make this test pass on macOS and Linux and fail on
 * Windows, where separators are backslashes — which is exactly what happened
 * the first time it ran on a Windows machine.
 */
const relativePosix = (abs) => relative(root, abs).split(sep).join("/");

describe("public bundle stays free of the admin SDK", () => {
  const sources = walk(join(root, "src"));

  it("imports @supabase/supabase-js ONLY from src/admin/client.js", () => {
    const importers = sources.filter((f) =>
      /@supabase\/supabase-js/.test(readFileSync(f, "utf8"))
    );
    expect(importers.map(relativePosix)).toEqual(["src/admin/client.js"]);
  });

  it("loads that SDK dynamically, so it cannot enter the initial chunk", () => {
    const client = read("src/admin/client.js");
    // A static `import ... from` here would pull ~214 kB into the public
    // bundle. Only a dynamic import() keeps it in its own chunk.
    expect(client).toMatch(/import\(\s*["']@supabase\/supabase-js["']\s*\)/);
    expect(client).not.toMatch(/^import[^\n]*from\s*["']@supabase\/supabase-js/m);
  });

  it("reaches the dashboard through a lazy dynamic import", () => {
    const app = read("src/App.jsx");
    expect(app).toMatch(/lazy\(\(\)\s*=>\s*import\(\s*["'][^"']*admin\/AdminApp\.jsx["']\s*\)\)/);
    expect(app).not.toMatch(/^import\s+AdminApp\s+from/m);
  });

  it("keeps the data layer separate from the SDK", () => {
    // The public write path is plain fetch on purpose (see the module docs).
    const dataLayer = read("src/utils/supabase.js");
    expect(dataLayer).not.toMatch(/@supabase\/supabase-js/);
    expect(dataLayer).toMatch(/fetch\(/);
  });
});

describe("donations stay removed", () => {
  it("has no donate tab in the header or the router", () => {
    expect(read("src/components/Header.jsx")).not.toMatch(/donateTab|id:\s*["']donate["']/);
    expect(read("src/App.jsx")).not.toMatch(/DonateView|donateTab/);
  });

  it("has no donation keys in either locale", () => {
    const content = read("src/data/content.js");
    for (const key of [
      "donateTab",
      "donateTitle",
      "donateSub",
      "donateDisclaimer",
      "purposeLabel",
      "purposes",
      "amountLabel",
      "proceedPayment",
    ]) {
      expect(content, `${key} is back in content.js`).not.toContain(`${key}:`);
    }
  });

  it("has no donations table in the schema", () => {
    const sql = read("supabase/migrations/0001_init.sql");
    expect(sql).not.toMatch(/create table if not exists public\.donations/i);
  });

  it("no longer has a DonateView component", () => {
    expect(() => statSync(join(root, "src/components/DonateView.jsx"))).toThrow();
  });

  it("still routes a retired #/donate deep-link somewhere safe", () => {
    // Old bookmarks must not land on a dead route. Routing moved out of
    // App.jsx into src/utils/route.js, where route.test.js now exercises the
    // behaviour directly (tabFromHash("#/donate") === "hub"); this keeps the
    // intent visible in the source too.
    expect(read("src/utils/route.js")).toMatch(/retired deep-link/);
    expect(read("src/App.jsx")).toMatch(/tabFromHash/);
  });
});