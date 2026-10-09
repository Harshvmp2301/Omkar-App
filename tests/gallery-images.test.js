import { readFileSync, existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translations } from "../src/data/content.js";
import {
  GALLERY_SIZES,
  GALLERY_SOURCES,
  gallerySrcSet,
  galleryVariantHref,
} from "../src/utils/gallery.js";

/**
 * The gallery's responsive sources, checked against the files themselves.
 *
 * The bundled photographs were 1600x1067 originals painted into tiles around
 * 270px wide, and 1.28 MB of image for eight pictures. The fix is a width
 * ladder per photograph (see GALLERY_SOURCES), and a ladder that drifts out of
 * step with the files on disk is worse than no ladder at all: a missing
 * candidate is a broken tile, and a mis-declared width makes the browser pick
 * the wrong one. So every claim the manifest makes is decoded and measured
 * here, not trusted.
 */

const asset = (src) => new URL(`../public${src}`, import.meta.url);
const read = (src) => readFileSync(asset(src));

/** Container dimensions of a WebP, whatever variant of the format it uses. */
function webpSize(buf) {
  expect(buf.subarray(0, 4).toString("latin1")).toBe("RIFF");
  expect(buf.subarray(8, 12).toString("latin1")).toBe("WEBP");
  const chunk = buf.subarray(12, 16).toString("latin1");
  const u16 = (o) => buf.readUInt16LE(o);
  const u24 = (o) => buf.readUIntLE(o, 3);
  if (chunk === "VP8X") return [u24(24) + 1, u24(27) + 1]; // extended (alpha)
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  if (chunk === "VP8 ") return [u16(26) & 0x3fff, u16(28) & 0x3fff]; // lossy
  throw new Error(`unknown WebP chunk: ${chunk}`);
}

const curatedSrcs = () =>
  translations.en.galleryItems.filter((p) => p.src.startsWith("/gallery/")).map((p) => p.src);

describe("every bundled photograph has the variants the manifest promises", () => {
  it("covers each photograph the site ships", () => {
    // A new picture added to content.js without a ladder would download the
    // original into a 270px tile — this fails instead.
    for (const src of curatedSrcs()) expect(GALLERY_SOURCES[src], `${src} is not in GALLERY_SOURCES`).toBeTruthy();
  });

  it.each(Object.entries(GALLERY_SOURCES))(
    "%s: the file exists, at the width declared, in the source's aspect ratio",
    (src, entry) => {
      expect(existsSync(asset(src)), `${src} missing on disk`).toBe(true);
      const [fullW, fullH] = webpSize(read(src));
      expect([fullW, fullH]).toEqual([entry.full, expect.any(Number)]);
      const ratio = fullW / fullH;

      for (const width of entry.tiles) {
        const href = galleryVariantHref(src, width);
        expect(existsSync(asset(href)), `${href} missing on disk`).toBe(true);
        const [w, h] = webpSize(read(href));
        expect(w, `${href} decodes to ${w}px, declared ${width}px`).toBe(width);
        // object-fit: cover crops to the container, so a stretched variant
        // would silently reframe the photograph.
        expect(Math.abs(w / h - ratio)).toBeLessThan(0.01);
        // A resized copy that is not smaller than the original is pure weight.
        // (Three of the eight are 800px and 640px originals: their ladder ends
        // at the original itself, which is where a candidate IS the source.)
        if (href !== src) {
          expect(statSync(asset(href)).size).toBeLessThan(statSync(asset(src)).size);
        } else {
          expect(width).toBe(entry.full);
        }
      }

      // The widest tile candidate must still cover the largest place a tile is
      // painted, or the biggest screens would blur.
      expect(Math.max(...entry.tiles)).toBeGreaterThanOrEqual(480);
      // …and the lightbox keeps a bigger source than any tile.
      expect(entry.full).toBeGreaterThanOrEqual(Math.max(...entry.tiles));
    }
  );

  it("names variants by the one convention the helper uses", () => {
    expect(galleryVariantHref("/gallery/F28A5437.webp", 480)).toBe("/gallery/F28A5437-480.webp");
    // A source whose own name ends in a dash: the rule still just appends.
    expect(galleryVariantHref("/gallery/imga-sEhySs0wHN7Rj2P-.webp", 480)).toBe(
      "/gallery/imga-sEhySs0wHN7Rj2P--480.webp"
    );
    // At or above the original's width the original itself is the candidate.
    expect(galleryVariantHref("/gallery/Blog-6.webp", 800)).toBe("/gallery/Blog-6.webp");
  });
});

describe("the srcset a tile is given", () => {
  it("lists ascending candidates, the original last among them never the first", () => {
    const srcset = gallerySrcSet("/gallery/F28A5437.webp");
    expect(srcset).toBe("/gallery/F28A5437-480.webp 480w, /gallery/F28A5437-900.webp 900w");
    const widths = srcset.split(",").map((c) => Number(c.trim().split(" ")[1].replace("w", "")));
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(new Set(widths).size).toBe(widths.length);
  });

  it("keeps a tile off the 1600px original", () => {
    // The whole point: no tile candidate may be the full-size file, or a 3x
    // phone asks for it again.
    for (const [src, entry] of Object.entries(GALLERY_SOURCES)) {
      const srcset = gallerySrcSet(src);
      if (entry.tiles.length && Math.max(...entry.tiles) < entry.full) {
        expect(srcset).not.toContain(`${src} ${entry.full}w`);
      }
      for (const candidate of srcset.split(",")) {
        expect(candidate.trim()).toMatch(/\.webp \d+w$/);
      }
    }
  });

  it("offers nothing for an uploaded photograph, so it keeps its plain src", () => {
    // Dashboard uploads have no generated variants. Returning a srcset of
    // non-existent files would break them.
    const uploaded = "https://example.supabase.co/storage/v1/object/public/photos/x.webp";
    expect(gallerySrcSet(uploaded)).toBeUndefined();
    expect(galleryVariantHref(uploaded, 480)).toBe(uploaded);
  });

  it("keeps every sizes hint in step with the box it describes", () => {
    // The desktop hint must not exceed the widest candidate (blur), and the
    // phone hint must be small enough to prefer a candidate over the original.
    for (const [name, sizes] of Object.entries(GALLERY_SIZES)) {
      expect(sizes, name).toMatch(/vw|px/);
      const desktop = sizes.match(/\(min-width: 940px\) (\d+)px/);
      expect(desktop, `${name} has no desktop width`).toBeTruthy();
      expect(Number(desktop[1])).toBeLessThanOrEqual(900);
    }
    expect(GALLERY_SIZES.stripLead).toContain("calc(100vw - 40px)");
    expect(GALLERY_SIZES.stripSmall).toContain("calc(50vw - 26px)");
  });
});

describe("the tiles use the ladder, and the lightbox uses the original", () => {
  const strip = readFileSync(new URL("../src/components/GalleryStrip.jsx", import.meta.url), "utf8");
  const view = readFileSync(new URL("../src/components/GalleryView.jsx", import.meta.url), "utf8");

  it("gives every homepage strip tile a srcset and a size", () => {
    expect(strip).toContain("srcSet={gallerySrcSet(item.src)}");
    expect(strip).toMatch(/sizes=\{[^}]*GALLERY_SIZES\.stripLead[^}]*GALLERY_SIZES\.stripSmall[^}]*\}/);
  });

  it("gives every gallery card a srcset and a size", () => {
    expect(view).toContain("srcSet={gallerySrcSet(item.src)}");
    expect(view).toContain("sizes={GALLERY_SIZES.tile}");
  });

  it("leaves the lightbox on the full source, with no srcset", () => {
    // The lightbox opens one photograph at a time, deliberately — that is the
    // right moment to spend the bytes on the original.
    const figure = view.slice(view.indexOf("lightbox-figure"), view.indexOf("figcaption"));
    expect(figure).toContain("src={open.src}");
    expect(figure).not.toContain("srcSet");
  });

  it("keeps alt text on both surfaces, and the strip's labelled button", () => {
    expect(view).toContain("alt={labelFor(item)}");
    expect(view).toContain("alt={labelFor(open)}");
    expect(strip).toContain('alt=""');
    expect(strip).toContain("aria-label={item.caption || t.photoLabel}");
  });

  it("keeps the box sized by CSS, so a smaller candidate cannot shift the layout", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.gallery-card img \{[^}]*aspect-ratio: 3 \/ 2/);
    expect(css).toMatch(/\.strip-lead img \{ aspect-ratio: 16 \/ 10; \}/);
    expect(css).toMatch(/\.strip-small img \{ aspect-ratio: 16 \/ 10; \}/);
  });

  it("does not preload a gallery photograph, so nothing is fetched twice", () => {
    // The only image preload on the page is the mark (see index.html); a
    // preloaded tile plus its srcset would be two requests for one picture.
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    expect(html).toContain('rel="preload"');
    expect(html).not.toContain("gallery/");
  });

  it("keeps every bundled photograph below the fold and lazy", () => {
    expect(view).toContain('loading="lazy"');
    expect(strip).toContain('loading="lazy"');
  });
});

describe("the lightbox can never open as an empty panel", () => {
  const view = readFileSync(new URL("../src/components/GalleryView.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("shows the already-cached 480px variant while the full source arrives", () => {
    // A slow connection really does leave a 330kB original in flight for a
    // while, and the panel used to be empty until it arrived — so this stays.
    // It was NOT the cause of the report it was first written for ("a
    // translucent maroon panel with a close cross and nothing else"): that was
    // the viewer being laid out against the whole page, which the next
    // describe guards. The placeholder is a file the grid has already
    // downloaded, so it costs no extra request.
    expect(view).toContain("galleryVariantHref(open.src, 480)");
    expect(view).toMatch(/backgroundImage: `url\(\$\{galleryVariantHref\(open\.src, 480\)\}\)`/);
    expect(css).toMatch(/\.lightbox-figure img \{[^}]*background-size: contain/);
    expect(css).toMatch(/\.lightbox-figure img \{[^}]*background-color: var\(--panel\)/);
  });

  it("gives the panel a minimum box, so it cannot collapse to nothing", () => {
    expect(css).toMatch(/\.lightbox-figure img \{[^}]*min-width: 220px/);
    expect(css).toMatch(/\.lightbox-figure img \{[^}]*min-height: 150px/);
  });

  it("offers a retry instead of a dead end, and clears a stale failure", () => {
    expect(view).toContain("lightbox-retry");
    expect(view).toMatch(/setFailed\(\(m\) => \(m\[item\.src\] \? \{ \.\.\.m, \[item\.src\]: false \} : m\)\)/);
    expect(view).toContain("key={`${open.src}-${retry}`}");
    expect(readFileSync(new URL("../src/data/content.js", import.meta.url), "utf8")).toMatch(
      /tryAgain: "Try again"/
    );
  });

  it("keeps the entrance animation off under reduced motion", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]{0,900}lightbox-figure img \{ animation: none !important; \}/);
  });
});

describe("the lightbox is laid out against the screen, not the page", () => {
  // THE cause of "a translucent maroon panel with a close cross and nothing
  // else", found by opening the page in a real engine: <main class="view"> ran
  // its entrance animation with `animation-fill-mode: both`, which keeps the
  // animation's END STATE applied for good — and the end state of a transform
  // animation is an identity matrix, not `none`. An ancestor with any transform
  // is the containing block for `position: fixed` descendants, so the viewer
  // (a fixed overlay inside <main>) was sized and positioned against the PAGE:
  // 2,495px tall on a phone, photo and arrows far below the fold, only the close
  // button in view — and, being trapped in <main>'s stacking context, painted
  // UNDER the header and the logo. Measured on every phone profile and on a
  // desktop window, light and dark.
  const view = readFileSync(new URL("../src/components/GalleryView.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
  const rule = (sel) => rules.find((r) => r.sel === sel)?.body ?? "";

  it("does not let the view's entrance animation leave a transform behind", () => {
    const body = rule(".view");
    expect(body).toMatch(/animation:\s*viewIn [^;]*\bbackwards\b/);
    expect(body).not.toMatch(/\b(both|forwards)\b/);
  });

  it("keeps no fill-forwards animation on any wrapper of the page's content", () => {
    // Anything that holds an animation's end state holds its transform with it.
    for (const sel of [".view", "main", ".app", ".section", "body", "#root"]) {
      expect(rule(sel), `${sel} must not hold an animation's end state`).not.toMatch(
        /animation[^;]*\b(both|forwards)\b/
      );
    }
  });

  it("renders the viewer into <body> through a portal, whatever its ancestors do", () => {
    expect(view).toMatch(/import \{ createPortal \} from "react-dom";/);
    expect(view).toMatch(/createPortal\(\s*<div\s+ref=\{lightboxRef\}\s+className="lightbox"/);
    expect(view).toMatch(/document\.body\s*\)\}/);
  });

  it("sets its own type, because outside .app it inherits none", () => {
    const body = rule(".lightbox");
    expect(body).toMatch(/font-family:\s*var\(--font-body\)/);
    expect(body).toMatch(/color:\s*var\(--ivory\)/);
  });

  it("stays above the header and the mark", () => {
    const z = (sel) => Number((rule(sel).match(/z-index:\s*(\d+)/) || [])[1]);
    expect(z(".lightbox")).toBeGreaterThan(z(".header"));
    expect(z(".lightbox")).toBeGreaterThan(z(".app-logo"));
  });

  it("is a full-screen fixed overlay", () => {
    const body = rule(".lightbox");
    expect(body).toMatch(/position:\s*fixed/);
    expect(body).toMatch(/inset:\s*0/);
  });
});

describe("the Seva Om mark is a real glyph, not an emoji", () => {
  const view = readFileSync(new URL("../src/components/SevaView.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("no longer uses the platform emoji that Android draws as a purple tile", () => {
    // Comments may name the emoji it replaced; only the JSX is evidence.
    const jsx = view.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(jsx).not.toContain("🕉");
  });

  it("draws the mark as SVG text that inherits the page's colour", () => {
    expect(view).toContain("ಓಂ");
    expect(view).toMatch(/<svg className="om-mark"/);
    expect(css).toMatch(/\.om-mark \{[^}]*color: var\(--gold-text-bright\)/);
    expect(css).toMatch(/\.om-mark \{[^}]*width: 1\.05em/);
  });
});
