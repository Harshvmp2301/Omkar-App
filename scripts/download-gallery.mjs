#!/usr/bin/env node
/**
 * Download the 8 gallery photos from the blogspot CDN, optimize them into
 * WebP (max 1600px, quality 82, EXIF stripped) under public/gallery/, and
 * rewrite src/data/content.js to reference the local files — so the app
 * never depends on external hotlinks for core assets.
 *
 * Works as-is for Next.js too: `public/gallery/…` is the same folder in
 * both setups.
 *
 *   npm run gallery:download              # download → WebP → rewrite content.js
 *   node scripts/download-gallery.mjs --dry-run   # show the plan, no network
 *   node scripts/download-gallery.mjs --force     # re-download everything
 *
 * Requires Node 18+ (built-in fetch). For WebP conversion ONE of:
 *   - ImageMagick 7 (`magick`)  … `winget install ImageMagick.ImageMagick`
 *   - ImageMagick 6 (`convert`) … `winget install ImageMagick`  (validated:
 *     on Windows the system NTFS `convert.exe` is rejected automatically)
 *   - libwebp (`cwebp`)         … `winget install libwebp` / `apt install webp`
 * If no converter is found the script still downloads the photos as .jpg
 * (hotlinks are removed regardless) and tells you how to get WebP after.
 *
 * Idempotent: already-downloaded files are skipped, already-rewritten
 * content.js is left untouched; missing local files are re-fetched.
 */

import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "src", "data", "content.js");
const OUT_DIR = join(ROOT, "public", "gallery");
const REFERER = "https://omkarsamithi.blogspot.com/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const FORCE = process.argv.includes("--force");
const DRY = process.argv.includes("--dry-run");
const MAX_W = 1600;
const QUALITY = 82;
const MIN_BYTES = 5000; // smaller than any real photo → error page / 1×1 gif

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

/* ------------------------------------------------------------------ naming */
function nameFor(url) {
  const path = url.split("?")[0];
  const last = decodeURIComponent(path.split("/").pop() || "");
  const m = last.match(/^(.+)\.(jpe?g|png|webp)$/i);
  if (m && m[1] && !/^w\d+/.test(last)) return sanitize(m[1]);
  // img/a/AVvXs…=w640-h480 has no filename → stable token-based name
  const tok = (url.match(/AVvXs[A-Za-z0-9_-]+/) || [""])[0];
  return `imga-${tok.slice(4, 20) || "unknown"}`;
}
const sanitize = (s) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

/** Hi-res candidate first (blogger /s1600/), original URL as fallback. */
function candidates(url) {
  const hi = url
    .replace("/s800/", "/s1600/")
    .replace("/w640-h426/", "/s1600/")
    .replace("/w640-h438/", "/s1600/")
    .replace("=w640-h480", "=s1600")
    .replace("=w640-h438", "=s1600");
  return hi === url ? [url] : [hi, url];
}

/* --------------------------------------------------------------- converter */
function detectConverter() {
  const probes = [
    { bin: "magick", args: ["-version"], ok: (o) => /ImageMagick/i.test(o), kind: "imagemagick" },
    { bin: "cwebp", args: [], ok: (o) => /cwebp|libwebp/i.test(o), kind: "cwebp" },
    // IM6's `convert` — output must say ImageMagick (rejects Windows'
    // System32\convert.exe, which prints a FAT→NTFS message instead).
    { bin: "convert", args: ["-version"], ok: (o) => /ImageMagick/i.test(o), kind: "imagemagick6" },
  ];
  for (const p of probes) {
    try {
      const r = spawnSync(p.bin, p.args, { encoding: "utf8", timeout: 8000 });
      const out = `${r.stdout || ""}${r.stderr || ""}`;
      if (!r.error && p.ok(out)) return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

function convert(converter, src, out) {
  let r;
  if (converter.kind === "cwebp") {
    r = spawnSync(converter.bin, ["-q", String(QUALITY), "-metadata", "none", "-resize", String(MAX_W), "0", src, "-o", out], {
      encoding: "utf8",
      timeout: 60000,
    });
    if (r.status !== 0) {
      // older cwebp builds: skip the resize, still emit WebP
      r = spawnSync(converter.bin, ["-q", String(QUALITY), "-metadata", "none", src, "-o", out], {
        encoding: "utf8",
        timeout: 60000,
      });
    }
  } else {
    const im = converter.kind === "imagemagick" ? "magick" : "convert";
    r = spawnSync(
      im,
      [src, "-auto-orient", "-resize", `${MAX_W}x${MAX_W}>`, "-strip", "-quality", String(QUALITY), out],
      { encoding: "utf8", timeout: 60000 }
    );
  }
  return r && r.status === 0;
}

/* ---------------------------------------------------------------- download */
/** Undici wraps the real network error in `cause` — surface it. */
function errMsg(e) {
  if (!e) return "unknown error";
  const c = e.cause;
  if (c) return `${e.message} (${c.message || c.code || c.name || "cause"})`;
  return e.message || String(e);
}

async function fetchBytes(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: REFERER, Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new Error(`network: ${errMsg(e)}`);
  }
  if (!res.ok) throw new Error(`http ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < MIN_BYTES) throw new Error(`too small (${buf.length} B) — error page?`);
  const magic = buf.subarray(0, 12);
  const isJpg = magic[0] === 0xff && magic[1] === 0xd8;
  const isPng = magic[0] === 0x89 && magic[1] === 0x50;
  const isWebp = magic.toString("latin1", 0, 4) === "RIFF" && magic.toString("latin1", 8, 12) === "WEBP";
  if (!isJpg && !isPng && !isWebp) throw new Error("not an image (bad magic bytes)");
  return buf;
}

async function downloadWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fetchBytes(url);
    } catch (e) {
      lastErr = e;
      if (i < attempts) await sleep(700 * i);
    }
  }
  throw lastErr;
}

/* -------------------------------------------------------------------- main */
const content0 = await readFile(CONTENT, "utf8");
const seen = new Set();
const tasks = [];
for (const m of content0.matchAll(/src:\s*"(https:\/\/blogger\.googleusercontent\.com\/[^"]+)"/g)) {
  if (!seen.has(m[1])) {
    seen.add(m[1]);
    tasks.push(m[1]);
  }
}
const localRefs = [...content0.matchAll(/src:\s*"\/gallery\/([^"]+)"/g)].map((m) => m[1]);

console.log(`Found ${tasks.length} hotlinked gallery photo(s); ${localRefs.length} already local ref(s).`);

// Verify existing local refs are actually on disk (heals partial runs).
const missingExisting = [];
for (const f of new Set(localRefs)) {
  try {
    await stat(join(OUT_DIR, f));
  } catch {
    missingExisting.push(f);
  }
}
if (missingExisting.length) console.log(`⚠ local file(s) missing on disk: ${missingExisting.join(", ")} — re-run will not recover these (sources already rewritten); restore from backup or git.`);

if (DRY) {
  console.log("\n[dry-run] plan (no network, no writes):");
  for (const url of tasks) {
    const name = nameFor(url);
    const [hi] = candidates(url);
    console.log(`  ${name}.webp  ←  ${hi}${hi !== url ? `   (fallback: ${url})` : ""}`);
  }
  console.log("\n[dry-run] nothing was changed.");
  process.exit(0);
}

if (!tasks.length) {
  console.log("No hotlinked photos left — gallery is fully local. ✓");
  process.exit(0);
}

const converter = detectConverter();
if (converter) {
  console.log(`Converter: ${converter.bin} (${converter.kind}) → WebP q${QUALITY}, max ${MAX_W}px`);
} else {
  console.log("⚠ No WebP converter found (ImageMagick magick/convert or cwebp).");
  console.log("  Photos will be saved as .jpg so hotlinks are removed anyway.");
  console.log("  For WebP install one of:");
  console.log("    winget install ImageMagick.ImageMagick   (Windows)");
  console.log("    sudo apt install webp                    (Debian/Ubuntu)");
  console.log("  then re-run with --force to convert.");
}

await mkdir(OUT_DIR, { recursive: true });
const tmp = await mkdtemp(join(tmpdir(), "omkar-gallery-"));
const usedNames = new Set(tasks.map(nameFor));
const results = [];
let failures = 0;
let content = content0;

try {
  let idx = 0;
  for (const url of tasks) {
    idx += 1;
    const name = nameFor(url);
    const ext = converter ? "webp" : "jpg";
    const outFile = join(OUT_DIR, `${name}.${ext}`);

    // Skip if already downloaded (unless --force)
    if (!FORCE) {
      try {
        const s = await stat(outFile);
        if (s.size > MIN_BYTES) {
          results.push({ name: `${name}.${ext}`, size: s.size, note: "already on disk" });
          content = content.split(url).join(`/gallery/${name}.${ext}`);
          continue;
        }
      } catch {
        /* not there — download */
      }
    }

    const chain = candidates(url);
    let bytes = null;
    let used = null;
    let err = null;
    for (const candidate of chain) {
      try {
        bytes = await downloadWithRetry(candidate);
        used = candidate;
        break;
      } catch (e) {
        err = `${candidate} → ${e.message}`;
      }
    }

    if (!bytes) {
      failures += 1;
      results.push({ name, size: 0, note: `FAILED: ${err}` });
      process.stdout.write(`[${idx}/${tasks.length}] ${name}: FAILED (${err})\n`);
      continue;
    }

    const rawPath = join(tmp, `${name}.bin`);
    await writeFile(rawPath, bytes);

    let finalPath = outFile;
    let ok = false;
    if (converter) {
      ok = convert(converter, rawPath, outFile);
      if (!ok) {
        console.log(`  conversion failed for ${name} — keeping .jpg`);
      }
    }
    if (!ok) {
      finalPath = join(OUT_DIR, `${name}.jpg`);
      await writeFile(finalPath, bytes);
    }

    const size = (await stat(finalPath)).size;
    const fileName = `${name}.${finalPath.endsWith(".webp") ? "webp" : "jpg"}`;
    const note = `${kb(bytes.length)} ${used !== url ? "(hi-res) " : ""}→ ${fileName} ${kb(size)}`;
    results.push({ name: fileName, size, note });
    process.stdout.write(`[${idx}/${tasks.length}] ${name}: ${note}\n`);

    content = content.split(url).join(`/gallery/${fileName}`);
    await sleep(250); // be polite to the CDN
  }

  if (content !== content0) {
    await writeFile(CONTENT, content, "utf8");
    console.log(`\n✓ src/data/content.js rewritten — gallery now points at /gallery/.`);
  } else {
    console.log("\ncontent.js already local — unchanged.");
  }

  console.log("\nSummary:");
  for (const r of results) console.log(`  ${r.name.padEnd(28)} ${r.note}`);
  if (failures) {
    console.log(`\n${failures} photo(s) failed — re-run to retry (successful ones are skipped).`);
    process.exitCode = 1;
  } else {
    console.log("\nAll gallery photos are local. ✓");
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}
