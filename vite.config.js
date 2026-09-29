import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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
})
