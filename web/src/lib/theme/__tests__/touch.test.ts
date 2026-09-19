import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Motion and touch (V4 §5.3, Q193–Q200).
 *
 * These assert **stylesheet facts**, which is unusual and is the point. Three of §5.3's answers
 * are implemented as single CSS rules that reach the whole app rather than as props on
 * components, and that is what makes them hold for code nobody has written yet. The failure
 * mode they are exposed to is therefore not "a component regressed" — it is "somebody tidied
 * the stylesheet", which no component test would notice.
 *
 * `scale.test.ts` reads `globals.css` the same way and for the same reason.
 */

const ROOT = path.join(process.cwd(), "src", "app");
const GLOBALS = readFileSync(path.join(ROOT, "globals.css"), "utf8");

describe("a visible press on every control (Q195, Q196)", () => {
  it("is a base rule, not 66 call sites", () => {
    // An audit found 66 hand-rolled buttons across 40 files with no pressed state against 21
    // that remembered the utility. Editing the 66 would have fixed the 66 and left the 67th.
    expect(GLOBALS).toMatch(/button:not\(:disabled\):not\(\[data-no-press\]\):active/);
    expect(GLOBALS).toMatch(/transform:\s*scale\(0?\.97\)/);
  });

  it("does not press a control that cannot act", () => {
    // A disabled button that depresses says the tap did something. `:not(:disabled)` is the
    // whole of it, and it is easy to drop while simplifying the selector.
    expect(GLOBALS).toContain("button:not(:disabled)");
  });

  it("keeps a designed alternative under reduced motion (Q207)", () => {
    // Someone who asked for less motion still has to know the tap registered, so the feedback
    // becomes a ground shift rather than nothing at all. The blanket 0.01ms collapse above it
    // would otherwise leave the press invisible.
    const reduced = GLOBALS.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n/,
    )?.[0];
    expect(reduced).toBeDefined();
    expect(reduced).toContain("data-no-press");
    expect(reduced).toMatch(/transform:\s*none/);
  });

  it("leaves an opt-out, so the rule never has to be weakened for one control", () => {
    expect(GLOBALS).toContain("[data-no-press]");
  });
});

describe("hover on touch (Q193, Q194)", () => {
  it("offers a capability variant rather than a width proxy", () => {
    // Tailwind v4 already wraps every `hover:` in `@media (hover:hover)`, so Q193 needed no
    // call-site changes at all. What it cannot express is hidden-until-hovered, where `hover:`
    // being inert is precisely the bug: the reveal never fires and the control is unreachable.
    expect(GLOBALS).toContain("@custom-variant can-hover (@media (hover: hover))");
  });

  it("has no hidden-until-hovered control gated on a screen width", () => {
    // A touch tablet is over 640px and has no mouse, so `sm:opacity-0 sm:group-hover:…` made
    // two delete buttons invisible with no way to reveal them — and `log-console`'s row has no
    // swipe to fall back on, so its entries could not be removed at all.
    const walked = walkTsx(path.join(process.cwd(), "src", "components", "site"));
    const offenders = walked.filter(
      ({ source }) => /sm:opacity-0/.test(source) && /sm:group-hover:opacity-100/.test(source),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });
});

function walkTsx(dir: string): { file: string; source: string }[] {
  const out: { file: string; source: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") out.push(...walkTsx(full));
    } else if (entry.name.endsWith(".tsx")) {
      out.push({ file: path.relative(process.cwd(), full), source: readFileSync(full, "utf8") });
    }
  }
  return out;
}
