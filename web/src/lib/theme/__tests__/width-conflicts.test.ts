import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Two width utilities on one element (D-219).
 *
 * ## The bug this exists for
 *
 * A component declares a shared look for its controls:
 *
 *     const FIELD = "w-full rounded-md border …";
 *
 * and then one call site wants a narrower one:
 *
 *     <select className={`${FIELD} w-24`}>
 *
 * That reads like an override and is not one. `w-full` and `w-24` have identical specificity, so
 * the winner is whichever Tailwind emits later in the stylesheet — nothing to do with the order
 * they appear in the attribute. `w-full` won. The select took the entire row, the two number
 * inputs beside it computed to **zero pixels**, their labels overprinted each other, and the
 * delete button sat ninety-two pixels off the right edge of the phone.
 *
 * It survived review because the class names read correctly, and it survived the test suite
 * because jsdom does not lay out: every element there is zero-width already, so a broken row and
 * a correct one are indistinguishable. The only things that see it are a real browser
 * (`scripts/diag-widths.mjs`) and this file.
 *
 * ## What is checked
 *
 * Any local `const` whose string value contains a width utility, used in a template literal that
 * adds another width. That is the exact shape of the three occurrences found on 2026-09-09 — in
 * `session-logger.tsx`, `log-form.tsx` and `workout-log-form.tsx` — and the fix in every case was
 * the same: take the width out of the shared constant so a call site states it once.
 *
 * Deliberately narrow. It does not try to understand Tailwind's cascade in general; it catches
 * the composition pattern that produced the bug, and says what to do instead.
 */

const ROOT = path.join(__dirname, "..", "..", "..");
const WIDTH = /(?:^|\s)(w-\S+|min-w-\S+|max-w-\S+)(?=\s|$)/;

function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourcesUnder(full));
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Block and line comments removed, so a note *about* the bug is not read as the bug. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** `const NAME = "…"` and `const NAME = \`…\`` declarations, as a map of name to value. */
function constants(source: string): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /^const ([A-Z][A-Z0-9_]*) =\s*(?:\n\s*)?["`]([^"`]*)["`];/gm;
  for (const match of source.matchAll(pattern)) found.set(match[1], match[2]);
  return found;
}

describe("width utilities", () => {
  /**
   * The scan proves it is scanning.
   *
   * A source-grep guard that quietly stops matching — a renamed directory, a `const` written a
   * new way — passes for ever and protects nothing. This asserts the machinery still finds real
   * class constants and real interpolations of them, so a green result above means "checked and
   * clean" rather than "found nothing to check".
   */
  it("is actually reading the components", () => {
    const files = sourcesUnder(path.join(ROOT, "components"));
    expect(files.length).toBeGreaterThan(40);

    const withConstants = files.filter(
      (file) => constants(withoutComments(readFileSync(file, "utf8"))).size > 0,
    );
    expect(withConstants.length).toBeGreaterThan(5);

    const interpolations = files.flatMap((file) => [
      ...withoutComments(readFileSync(file, "utf8")).matchAll(/\$\{([A-Z][A-Z0-9_]*)\}([^`]*)`/g),
    ]);
    expect(interpolations.length).toBeGreaterThan(10);
  });

  it("are never set twice on one element", () => {
    const offenders: string[] = [];

    for (const file of [
      ...sourcesUnder(path.join(ROOT, "components")),
      ...sourcesUnder(path.join(ROOT, "app")),
    ]) {
      // Comments first. Several files in this codebase quote the old broken line in the note
      // explaining why it was fixed, and a guard that fails on its own documentation is a guard
      // that gets deleted.
      const source = withoutComments(readFileSync(file, "utf8"));
      const declared = constants(source);
      if (declared.size === 0) continue;

      // Every `${CONST} …extra classes…` interpolation in the file.
      for (const use of source.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}([^`]*)`/g)) {
        const base = declared.get(use[1]);
        if (!base || !WIDTH.test(` ${base} `)) continue;

        const extra = use[2];
        if (!WIDTH.test(extra)) continue;

        const which = `${WIDTH.exec(` ${base} `)![1]} + ${WIDTH.exec(extra)![1]}`;
        offenders.push(`${path.relative(ROOT, file)}: ${use[1]} carries a width — ${which}`);
      }
    }

    expect(
      offenders,
      `these set width twice on one element, and the winner is decided by Tailwind's emit order, not by the class attribute. Take the width out of the shared constant. See D-219.\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
