import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

/** Shorten a secret so it can be identified in the report without exposing it. */
const mask = (value) =>
  !value ? '' : value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : 'set'

export default defineConfig(({ mode }) => {
  // Read from config/ so the diagnostics page can show exactly what the app
  // is seeing. Same folder `envDir` uses for the app itself.
  // Re-read inside the middleware rather than once here: the page's whole job
  // is diagnosing a wrong config, and a stale snapshot would hide the very
  // edit being tested.
  const readEnv = () => loadEnv(mode, join(root, 'config'), 'VITE_')

  const buildDiagnostics = () => {
    const env = readEnv()
    return {
      blogUrl: env.VITE_BLOGGER_BLOG_URL || '',
      // The app falls back to this when nothing is set, so the page mirrors
      // that instead of reporting an empty value that isn't what's used.
      blogDefault: 'omkarsamithi.blogspot.com',
      max: env.VITE_BLOGGER_MAX || '3',
      bloggerKey: mask(env.VITE_BLOGGER_API_KEY),
      youtubeKey: mask(env.VITE_YOUTUBE_API_KEY),
      youtubeChannel: env.VITE_YOUTUBE_CHANNEL_ID || '',
      // The real values drive the tests; the masked ones are only for display.
      rawBloggerKey: env.VITE_BLOGGER_API_KEY || env.VITE_YOUTUBE_API_KEY || '',
      formEndpoint: env.VITE_FORM_ENDPOINT ? 'set' : '',
      supabaseUrl: env.VITE_SUPABASE_URL || '',
      adminEmails: env.VITE_ADMIN_EMAILS ? 'set' : '',
    }
  }

  return {
    // Every key and credential lives in ONE file: config/.env.local
    // (created from config/.env.example — see config/README.md).
    // Pointing Vite's env loader at that folder means credentials never have
    // to be hunted for across code files. On Vercel it makes no difference:
    // the platform's Environment Variables are used instead.
    envDir: 'config',
    plugins: [
      {
        // DEV ONLY: serves the delivery patch (and the notes) straight from the
        // repository root at /transfer/<name>, as a forced download, so the
        // preview itself carries a working download link. configureServer never
        // runs in a production build, and the whitelist below is the whole
        // surface — nothing else in the repo is reachable through it.
        name: "patch-download",
        configureServer(server) {
          const ALLOW = ["omkar-ux-redesign.patch", "TRANSFER-NOTES.md"];
          server.middlewares.use((req, res, next) => {
            const u = (req.url || "").split("?")[0];
            if (!u.startsWith("/transfer/")) return next();
            const name = u.slice("/transfer/".length);
            if (!ALLOW.includes(name)) {
              res.statusCode = 404;
              res.end("not here");
              return;
            }
            readFile(join(root, name))
              .then((buf) => {
                res.setHeader("Content-Type", "application/octet-stream");
                res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
                res.setHeader("Cache-Control", "no-store");
                res.end(buf);
              })
              .catch(() => {
                res.statusCode = 404;
                res.end("missing");
              });
          });
        },
        // DEV ONLY (apply: "serve"): a visible download chip in the corner of
        // the preview, pointing at the endpoint above. The shipped index.html
        // is never touched — a production build has neither the chip nor the
        // endpoint, so nothing about the deployed site changes.
        apply: "serve",
        async transformIndexHtml(html) {
          try {
            const buf = await readFile(join(root, "omkar-ux-redesign.patch"));
            const sha = createHash("sha256").update(buf).digest("hex").slice(0, 8);
            const kb = (buf.length / 1024).toFixed(1);
            const chip =
              `<a id="omkar-patch-chip" href="/transfer/omkar-ux-redesign.patch" ` +
              `title="sha256 ${sha}…" ` +
              `style="position:fixed;right:14px;bottom:14px;z-index:5000;background:#C9972C;` +
              `color:#170B10;font:700 12px/1.2 system-ui,sans-serif;padding:10px 14px;` +
              `border-radius:999px;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.35)">` +
              `&#11015; omkar-ux-redesign.patch &middot; ${kb} kB</a>`;
            return html.replace("</body>", chip + "</body>");
          } catch {
            return html; // no patch at the root: no chip, preview still works
          }
        },
      },
      {
        // Feeds diagnostic — served in DEV ONLY and deliberately kept out of
        // public/, so it is never part of the deployed site. It runs the feed
        // requests in the visitor's own browser and prints a report, which is
        // the only way to see these failures from a sandbox with no network.
        name: "feeds-diagnostics",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = (req.url || "").split("?")[0];
            if (url !== "/diagnostics/feeds.html" && url !== "/diagnostics/") {
              return next();
            }
            try {
              const html = await readFile(
                join(root, "diagnostics", "feeds.html"),
                "utf8"
              );
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              res.end(
                html.replace(
                  "/*__OMKAR_DIAGNOSTICS__*/",
                  JSON.stringify(buildDiagnostics())
                )
              );
            } catch (err) {
              res.statusCode = 500;
              res.end(`diagnostics page unavailable: ${err}`);
            }
          });
        },
      },
      react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      // Allow the sandbox preview host header (no origin allowlist in dev).
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
  }
})
