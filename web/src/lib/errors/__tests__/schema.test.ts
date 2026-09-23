// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { clean } from "@/lib/errors/report";
import { errorReportSchema } from "@/lib/errors/schema";

/**
 * The `zod` boundary in the error path (V4 §8.4, D-327).
 *
 * `app/layout.tsx` mounts `ErrorWatch` so a stranger's crash on the public portfolio is
 * reported at all. That makes everything `lib/errors/client.ts` imports part of **every public
 * page's bundle** — and until this split, that included `zod`: 64.1KB gzipped, 29% of the
 * 220.7KB the portfolio shipped, on a site that validates nothing at runtime.
 *
 * Nothing about that is visible from a screen, which is why it survived three versions and why
 * it needs a test rather than a convention. The failure mode is silent and additive: someone
 * imports one schema from one client module and the portfolio gets 64KB heavier with no error,
 * no warning and no visual change.
 */

const root = path.join(process.cwd(), "src", "lib", "errors");
const read = (file: string) => readFileSync(path.join(root, `${file}.ts`), "utf8");

/**
 * Import specifiers, from **statements only** — not from anything that merely looks like one.
 *
 * The naive `/from\s+["']([^"']+)["']/g` was written first and immediately reported that
 * `client.ts` imports `"broken again"`. It does not; line 75 is a doc comment reading *for
 * telling "still broken" from "broken again"*. Anchoring to the start of a line is what
 * separates a statement from prose, because a continuation line in a block comment starts
 * with `*`.
 *
 * Worth keeping the story: a scanner whose first run produces a confident, specific, wrong
 * answer is the same failure class as one that silently finds nothing (D-190). Both look like
 * they work.
 */
function importsIn(source: string): string[] {
  const statements = [
    ...source.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+["']([^"']+)["']/gm),
    ...source.matchAll(/^\s*import\s+["']([^"']+)["']/gm),
  ];
  return statements.map((m) => m[1]);
}

/**
 * The modules that reach the browser, and therefore the public bundle.
 *
 * `report.ts` imports nothing at all and `client.ts` imports only `report.ts`, so checking
 * these two sources is currently equivalent to checking the whole reachable graph. **If either
 * ever grows an import, this list stops being sufficient** — the honest fix then is to walk the
 * graph, not to add another filename here and hope.
 */
const CLIENT_REACHABLE = ["report", "client"];

describe("zod stays out of the client-reachable error path", () => {
  for (const file of CLIENT_REACHABLE) {
    it(`${file}.ts does not import zod`, () => {
      expect(importsIn(read(file))).not.toContain("zod");
    });
  }

  it("neither module imports anything that could reach it transitively", () => {
    // The check above is only as good as this assumption. Pin it: both files import from
    // relative siblings or nothing, never from a package that might pull a validator in.
    for (const file of CLIENT_REACHABLE) {
      for (const specifier of importsIn(read(file))) {
        expect(
          specifier.startsWith(".") || specifier.startsWith("@/lib/errors/"),
          `${file}.ts imports "${specifier}", which is outside lib/errors — the sufficiency ` +
            `argument in this file no longer holds. Walk the graph instead of extending the list.`,
        ).toBe(true);
      }
    }
  });

  /**
   * The positive control, and it is not optional.
   *
   * D-190 is the standing lesson here: a checker that silently checks nothing looks exactly
   * like a passing one. `schema.ts` is the module that *should* import zod, so if the regex
   * above cannot find it there, the regex is broken rather than the code being clean.
   */
  it("finds zod where it is supposed to be — the control for the checks above", () => {
    expect(importsIn(read("schema"))).toContain("zod");
  });
});

/**
 * The runtime half of the type-level pin in `schema.ts`.
 *
 * `ErrorReportInput` is hand-written so `report.ts` stays zod-free, so nothing structurally
 * forces schema and type to agree. `schema.ts` pins the shape at compile time; this pins the
 * behaviour the endpoint actually depends on — that every field has a default, so `clean`
 * never receives `undefined`.
 */
describe("the schema still produces what clean expects", () => {
  it("defaults every field, so a bare report parses into a complete one", () => {
    const parsed = errorReportSchema.parse({ source: "browser" });

    expect(parsed).toEqual({
      source: "browser",
      name: "",
      message: "",
      stack: "",
      route: "",
      buildId: "",
      agent: "",
    });
    // The endpoint's actual sequence: parse, then clean. It must not throw on a bare report.
    expect(() => clean(parsed)).not.toThrow();
  });

  it("still rejects an unknown source and an over-long message", () => {
    expect(errorReportSchema.safeParse({ source: "somewhere-else" }).success).toBe(false);
    expect(
      errorReportSchema.safeParse({ source: "browser", message: "x".repeat(5_000) }).success,
    ).toBe(false);
  });
});
