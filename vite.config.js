import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
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
        name: "force-download-for-transfer",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const u = req.url || "";
            if (u.startsWith("/transfer/") && (u.includes(".bundle") || u.includes(".patch"))) {
              const file = u.split("?")[0].split("/").pop();
              res.setHeader("Content-Disposition", 'attachment; filename="' + file + '"');
            }
            next();
          });
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
