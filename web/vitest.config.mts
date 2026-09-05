import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

/** Vite-level configuration. Projects do not inherit the root's, so both spread this. */
const vite = {
  plugins: [react()],
  resolve: {
    // Native replacement for vite-tsconfig-paths; resolves the "@/*" alias.
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
};

/** Test options every project shares. */
const shared = {
  environment: "jsdom",
  setupFiles: ["./vitest.setup.ts"],
  globals: true,
};

/**
 * Database tests are named `*.db.test.ts` and run in one process, together.
 *
 * Booting PGlite — Postgres compiled to WASM — costs **~5.9s**; replaying all seven migrations
 * into it costs **0.7s**. Measured 2026-09-05, and the ratio is the whole point: the expensive
 * thing is the boot, not the schema. There are nine database test files, and under the default
 * one-worker-per-file each paid that boot simultaneously. On this laptop seven of them then
 * exceeded a 30s `beforeEach` and `npm test` failed 7 of 1077 while every one of those files
 * passed when run alone.
 *
 * `hookTimeout` had already been raised once for this, from 10s to 30s, when there were
 * **three** such files. Raising it a third time treats the symptom: the number that has to grow
 * is the count of simultaneous WASM boots, and it grows every time a table gets a test.
 *
 * `fileParallelism: false` plus `isolate: false` runs all nine in a single process with a shared
 * module registry, so `src/test/pg.ts`'s per-module singleton is reached by every file and
 * **PGlite boots once for the whole group** rather than nine times. Sharing a process is safe
 * here and is checked rather than assumed: `no-shared-state.test.ts` fails if a `*.db.test.ts`
 * file ever introduces `vi.mock`, fake timers or `process.env` writes, which are the three ways
 * dropping isolation bites. The tables are already emptied per test by `resetTestDb`.
 *
 * They also run under `node` rather than `jsdom`. None of them touches the DOM — the four that
 * appeared to were test names containing the word "window" — and the environment is a real cost:
 * the failing run spent 384s of its 115s wall clock setting up environments. `describe.db.test.ts`
 * already declared `@vitest-environment node` for this reason and now gets it from the project.
 * The group drops `setupFiles` with it, since that file only registers jest-dom matchers and no
 * database test uses one.
 *
 * The 30s timeout stays. One cold boot is ~6s, and the margin is for a loaded machine — but it
 * is now protecting a single boot instead of scaling with the file count.
 */
export default defineConfig({
  ...vite,
  test: {
    projects: [
      {
        ...vite,
        test: {
          ...shared,
          name: "unit",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: [...configDefaults.exclude, "**/*.db.test.*"],
          // Two projects with different worker counts have to say which runs first, or vitest
          // refuses to schedule them at all. Unit first: it is the larger group and the one a
          // failure is most likely to come from.
          sequence: { groupOrder: 0 },
        },
      },
      {
        ...vite,
        test: {
          name: "db",
          globals: true,
          environment: "node",
          include: ["src/**/*.db.test.ts"],
          fileParallelism: false,
          isolate: false,
          hookTimeout: 30_000,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
