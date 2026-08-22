import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Native replacement for vite-tsconfig-paths; resolves the "@/*" alias.
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    // The first `beforeEach` in each database test file boots PGlite (Postgres in WASM) and
    // runs every migration. Three such files run in parallel workers, and under that load the
    // first hook has been measured at ~16s — comfortably past vitest's 10s default, which
    // showed up as three "Hook timed out" failures that passed on a re-run. Raised rather
    // than masked: subsequent hooks are a TRUNCATE and take milliseconds.
    hookTimeout: 30_000,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
