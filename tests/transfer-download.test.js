import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The preview carries its own download link: a dev-only middleware serves the
 * delivery patch from the repository root at /transfer/<name>, and a dev-only
 * transform puts a visible chip in the corner of the page. Both must stay dev
 * only — the deployed site must ship neither the endpoint nor the chip — and
 * the endpoint must stay a whitelist, not a window into the repo.
 */
const config = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
const shippedHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("the preview's download link is dev-only and whitelisted", () => {
  it("serves only the named files, as forced downloads", () => {
    expect(config).toMatch(/name: "patch-download"/);
    expect(config).toMatch(
      /const ALLOW = \["omkar-ux-redesign\.patch", "TRANSFER-NOTES\.md"\];/
    );
    expect(config).toMatch(/if \(!ALLOW\.includes\(name\)\)/);
    expect(config).toMatch(/Content-Disposition", `attachment; filename="\$\{name\}"`/);
  });

  it("refuses every other path under /transfer/", () => {
    // the whitelist is the whole surface: the file read takes ONLY the
    // whitelist-checked name, never the raw request path
    expect(config).toMatch(/readFile\(join\(root, name\)\)/);
    expect(config).not.toMatch(/readFile\(join\(root, [a-z]+\.split/);
    expect(config).toMatch(/res\.statusCode = 404/);
  });

  it("injects the chip only while serving, never into a build", () => {
    expect(config).toMatch(/apply: "serve",\s*async transformIndexHtml/);
    expect(config).toMatch(/id="omkar-patch-chip"/);
    expect(config).toMatch(/href="\/transfer\/omkar-ux-redesign\.patch"/);
  });

  it("leaves the shipped index.html clean", () => {
    expect(shippedHtml).not.toMatch(/omkar-patch-chip/);
    expect(shippedHtml).not.toMatch(/\/transfer\//);
    expect(shippedHtml).not.toMatch(/omkar-ux-redesign\.patch/);
  });

  it("labels the chip with the patch's own size and checksum prefix", () => {
    // the chip reads the file at request time, so what it advertises is what
    // it serves — a stale copy cannot present itself as the new one
    expect(config).toMatch(/createHash\("sha256"\)\.update\(buf\)/);
    expect(config).toMatch(/buf\.length \/ 1024/);
  });
});
