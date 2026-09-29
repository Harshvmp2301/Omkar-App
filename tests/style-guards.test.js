import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(js|jsx|css)$/.test(entry.name) ? [path] : [];
  });
}

describe("style & structure guards (regression locks)", () => {
  it("styles.css contains no `transition: all` (round-10 binding)", () => {
    const css = readFileSync(join(root, "src/styles.css"), "utf8");
    expect(css).not.toMatch(/transition:\s*all\b/);
  });

  it("no hotlinked Blogger photo URLs remain anywhere in src/", () => {
    // Article/feedback links TO blogspot are fine (Content Hub links out);
    // embedded IMAGES served FROM blogspot hosts are the regression.
    const HOTLINK =
      /(blogspotusercontent|bp\.blogspot)|https?:\/\/[^\s"']*blogspot[^\s"']*\.(?:jpe?g|png|webp|gif)/i;
    const hits = walk(join(root, "src")).filter((file) =>
      HOTLINK.test(readFileSync(file, "utf8"))
    );
    expect(hits).toEqual([]);
  });

  it("index.html advertises the OG share banner with summary_large_image", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).toContain("og-banner.jpg");
    expect(html).toContain("summary_large_image");
    expect(html).toContain('property="og:image"');
  });

  it("PWA manifest icons have space-free paths and a maskable entry", () => {
    const manifest = JSON.parse(
      readFileSync(join(root, "public/manifest.webmanifest"), "utf8")
    );
    const icons = manifest.icons || [];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.src, `icon src "${icon.src}" contains whitespace`).not.toMatch(
        /\s/
      );
    }
    expect(icons.some((icon) => String(icon.purpose || "").includes("maskable"))).toBe(
      true
    );
  });
});
