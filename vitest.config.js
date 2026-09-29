import { defineConfig } from "vitest/config";

// Standalone config: unit tests are pure Node (no React transform needed),
// and keeping vitest out of vite.config.js means the dev server never
// restarts when tests change.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}", "tests/**/*.test.{js,jsx}"],
  },
});
