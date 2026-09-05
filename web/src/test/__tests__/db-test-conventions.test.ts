import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The two rules that keep `vitest.config.ts`'s `db` project honest.
 *
 * That project exists because booting PGlite costs ~5.9s against 0.7s to migrate it, so ten
 * files each booting their own simultaneously is what made `npm test` fail 7 of 1077 on a
 * loaded laptop while every one of those files passed alone. The fix runs them together in one
 * process with `isolate: false`, which buys one boot instead of ten and costs the guarantee
 * that files cannot see each other's module state.
 *
 * Both halves of that trade are assumptions about files that do not exist yet:
 *
 * 1. A **new** database test named `foo.test.ts` rather than `foo.db.test.ts` lands in the
 *    `unit` project and boots its own PGlite in parallel again. Nothing fails; the suite just
 *    gets slower and flakier, which is how it got here.
 * 2. A `*.db.test.ts` file that mocks a module, installs fake timers or writes `process.env`
 *    leaks that into the nine files sharing its process. That failure is worse than slow — it
 *    is order-dependent, and it looks like a bug in whichever file happens to run next.
 *
 * So both are checked rather than written in a comment. Discovery, not a hand-listed set: the
 * same reason `src/test/pg.ts` finds its tables by reading the migrations.
 */

const SRC = path.join(process.cwd(), "src");

/**
 * This file is skipped by its own scan, and it failed on its first run for exactly that reason:
 * the patterns below are written out in its source, so a text search finds them here first.
 * Named by `import.meta.url` rather than by a string, so renaming the file cannot silently turn
 * the exemption into a hole.
 */
const SELF = fileURLToPath(import.meta.url);

function testFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return testFiles(full);
    return /\.(test|spec)\.tsx?$/.test(e.name) ? [full] : [];
  });
}

const FILES = testFiles(SRC)
  .filter((file) => path.resolve(file) !== path.resolve(SELF))
  .map((file) => ({
    file,
    rel: path.relative(SRC, file).replace(/\\/g, "/"),
    isDb: file.endsWith(".db.test.ts"),
    source: fs.readFileSync(file, "utf8"),
  }));

describe("database test conventions", () => {
  it("finds the suite, so nothing below can pass by looking at an empty list", () => {
    expect(FILES.length).toBeGreaterThan(50);
    expect(FILES.filter((f) => f.isDb).length).toBeGreaterThan(5);
  });

  it("names every test that boots a database *.db.test.ts", () => {
    // Either route to a PGlite instance: the shared harness, or constructing one directly.
    const boots = FILES.filter(
      (f) => /from "@\/test\/pg"/.test(f.source) || /\bPGlite\b/.test(f.source),
    );

    expect(boots.length).toBeGreaterThan(5);
    expect(boots.filter((f) => !f.isDb).map((f) => f.rel)).toEqual([]);
  });

  it("keeps shared-process state out of the files that share a process", () => {
    const offenders = FILES.filter((f) => f.isDb).flatMap((f) => {
      const reasons = [
        [/\bvi\.mock\s*\(/, "vi.mock"],
        [/useFakeTimers\s*\(/, "fake timers"],
        [/process\.env\.\w+\s*=/, "process.env assignment"],
        [/vi\.stubEnv\s*\(/, "vi.stubEnv"],
        [/vi\.stubGlobal\s*\(/, "vi.stubGlobal"],
      ] as const;
      return reasons
        .filter(([pattern]) => pattern.test(f.source))
        .map(([, name]) => `${f.rel} uses ${name}`);
    });

    // If a database test genuinely needs one of these, the answer is to give that file back its
    // isolation — move it out of the group and let it pay for its own boot — not to relax this.
    expect(offenders).toEqual([]);
  });
});
