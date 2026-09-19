import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The tests that make the generated scale trustworthy (V4 §1.5–§1.9, §1.12, D-199).
 *
 * `tokens.test.ts` does this job for colour. This is the same job for everything else that is a
 * number, and it has the same three parts:
 *
 *   - **shape** — nine type steps, eight spacing values, four elevation levels, three durations.
 *     A scale with a step missing does not error; it falls back to whatever Tailwind's default
 *     for that name was, which is a plausible number from a different design system.
 *   - **properties** — the ratio actually holds, tracking actually tightens, spacing is actually
 *     on a 4-point grid. These are the claims `DESIGN.md` makes in prose, checked.
 *   - **freshness** — the committed CSS is what the generator produces now.
 *
 * Nothing here hard-codes an expected pixel value. Asserting `--text-lg: 1.2rem` would fail the
 * moment the ratio is deliberately changed, which is a test that punishes the edit it exists to
 * make safe. What is asserted is that the values are *consistent with the rules* — so changing
 * `RATIO` to 1.25 in the generator moves every number here and every test still passes, while a
 * typo in one step does not.
 */

const ROOT = path.join(__dirname, "..", "..", "..", "..");
const CSS = readFileSync(path.join(ROOT, "src", "app", "scale.css"), "utf8");
const GLOBALS = readFileSync(path.join(ROOT, "src", "app", "globals.css"), "utf8");

function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const decl = line.match(/^\s*--([\w-]+):\s*([^;]+);/);
    if (decl) out[decl[1]] = decl[2].trim();
  }
  return out;
}

/** Every `--token: value;` in the file's `@theme` block. */
const TOKENS: Record<string, string> = (() => {
  const block = CSS.match(/@theme\s*\{([\s\S]*?)\n\}/);
  if (!block) throw new Error("no @theme block in scale.css");
  return declarations(block[1]);
})();

/**
 * The space scale, which lives in `:root` rather than `@theme` on purpose (D-219).
 *
 * `--spacing-*` is the namespace Tailwind's `max-w-*` / `w-*` / `min-w-*` consult **before**
 * `--container-*`, so a space step named `sm` or `2xl` silently redefines `max-w-sm` and
 * `max-w-2xl` for the entire app. It did, for a week: `/private/settings` rendered inside a
 * 64px column and five other screens with it, with no error and no failing test.
 */
const SPACE_TOKENS: Record<string, string> = (() => {
  const block = CSS.match(/\n:root\s*\{([\s\S]*?)\n\}/);
  if (!block) throw new Error("no :root block in scale.css");
  return declarations(block[1]);
})();

const STEPS = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"] as const;
const SPACE = ["3xs", "2xs", "xs", "sm", "md", "lg", "xl", "2xl"] as const;
const BREAKPOINTS = [
  ["phone", "sm"],
  ["tablet", "md"],
  ["laptop", "lg"],
  ["desktop", "xl"],
  ["wide", "2xl"],
] as const;

/** The rem value a step resolves to at a wide viewport — a `clamp()`'s third argument. */
function remOf(value: string): number {
  const clamped = value.match(/clamp\([^,]+,[^,]+,\s*([\d.]+)rem\s*\)/);
  if (clamped) return Number(clamped[1]);
  const plain = value.match(/^([\d.]+)rem$/);
  if (!plain) throw new Error(`cannot read a rem value from "${value}"`);
  return Number(plain[1]);
}

describe("the type scale", () => {
  it("has exactly nine steps", () => {
    const declared = Object.keys(TOKENS).filter((t) => /^text-[\w]+$/.test(t));
    expect(declared.sort()).toEqual(STEPS.map((s) => `text-${s}`).sort());
  });

  it.each(STEPS)("%s carries its own leading and tracking", (step) => {
    // The point of putting these on the step rather than at the call site (Q106): `text-lg` is a
    // complete typographic decision. If one goes missing, that step silently inherits the
    // element's leading and the scale stops being a scale.
    expect(TOKENS[`text-${step}`], `--text-${step} missing`).toBeDefined();
    expect(TOKENS[`text-${step}--line-height`], `${step} has no leading`).toBeDefined();
    expect(TOKENS[`text-${step}--letter-spacing`], `${step} has no tracking`).toBeDefined();
  });

  it("anchors base at exactly 1rem", () => {
    // `rem` arithmetic across the app assumes the root size. See the note on BASE_INDEX.
    expect(TOKENS["text-base"]).toBe("1rem");
  });

  /** Steps whose shipped size is off the pure geometric progression — the hand-adjustments. */
  const adjusted = (() => {
    const sizes = STEPS.map((s) => remOf(TOKENS[`text-${s}`]));
    const base = sizes[STEPS.indexOf("base")];
    return new Set(
      STEPS.filter(
        (_, i) => Math.abs(sizes[i] / (base * 1.2 ** (i - STEPS.indexOf("base"))) - 1) > 0.001,
      ),
    );
  })();

  it("holds its ratio between every pair of unadjusted steps", () => {
    // Read out of the file rather than hard-coded, so changing RATIO in the generator moves this
    // with it. Pairs touching a hand-adjusted extreme are excluded by construction and covered
    // by the two tests below — `xs → sm` is 1.111 on purpose, because `xs` was lifted to 12px so
    // the app's smallest text stopped shrinking (D-199).
    const sizes = STEPS.map((s) => remOf(TOKENS[`text-${s}`]));
    for (let i = 1; i < STEPS.length; i += 1) {
      if (adjusted.has(STEPS[i]) || adjusted.has(STEPS[i - 1])) continue;
      expect(sizes[i] / sizes[i - 1], `${STEPS[i - 1]} → ${STEPS[i]} is off the scale`).toBeCloseTo(
        1.2,
        2,
      );
    }
  });

  it("adjusts at most one step at each end and none in between", () => {
    // Q101 permits a hand-adjustment "at the extremes". The middle of the scale is where an
    // override stops being a decision and starts being a scale nobody can predict.
    //
    // This is also what stops the exclusion list in the test above from quietly growing until
    // the ratio check covers nothing: every step it skips has to be an end.
    expect([...adjusted].every((s) => s === STEPS[0] || s === STEPS[STEPS.length - 1])).toBe(true);
  });

  it("never lets the smallest step fall below 12px", () => {
    // Two floors, and this asserts the higher one.
    //
    // §7.1 turns an 11px text floor into a gate, and the pure geometric bottom step (11.11px)
    // would have cleared it — by 0.11px, while taking the app's smallest text *down* from
    // Tailwind's 12px across 161 call sites. In a codebase whose measured problem is that too
    // much of its text is small (D-190), clearing a gate by a rounding error is not the same as
    // being right. Measured: 157 sub-12px elements per width at 11.11px, ~53 at 12px, against a
    // 68 baseline. So `xs` is hand-adjusted up, and 12px is the number to defend.
    expect(remOf(TOKENS["text-xs"]) * 16).toBeGreaterThanOrEqual(12);
  });

  it("tightens tracking as the step grows", () => {
    const track = STEPS.map((s) => Number(TOKENS[`text-${s}--letter-spacing`].replace("em", "")));
    for (const [i, value] of track.slice(1).entries()) {
      expect(value, `tracking does not tighten at ${STEPS[i + 1]}`).toBeLessThan(track[i]);
    }
  });

  it("makes display steps fluid and body steps stepped", () => {
    // Q103. A paragraph that reflows while the window is dragged is the thing being avoided.
    for (const step of ["xs", "sm", "base", "lg", "xl"]) {
      expect(TOKENS[`text-${step}`], `${step} should be stepped`).not.toContain("clamp(");
    }
    for (const step of ["2xl", "3xl", "4xl", "5xl"]) {
      expect(TOKENS[`text-${step}`], `${step} should be fluid`).toContain("clamp(");
    }
  });

  it("floors each fluid step at the step below it", () => {
    // So the scale still reads as the scale on a phone, rather than collapsing to an invented
    // minimum that belongs to no step.
    for (const [i, step] of STEPS.entries()) {
      const value = TOKENS[`text-${step}`];
      if (!value.includes("clamp(")) continue;
      const min = Number(value.match(/clamp\(\s*([\d.]+)rem/)![1]);
      expect(min, `${step}'s floor is not the step below`).toBeCloseTo(
        remOf(TOKENS[`text-${STEPS[i - 1]}`]),
        2,
      );
    }
  });

  it("gives uppercase one tracking value", () => {
    // Q117: 0.12em, replacing the 0.14/0.16/0.18em picked per call site before §1.6.
    expect(TOKENS["tracking-caps"]).toBe("0.12em");
  });
});

describe("the spacing vocabulary", () => {
  it("has exactly eight values", () => {
    const declared = Object.keys(SPACE_TOKENS).filter((t) => t.startsWith("spacing-"));
    expect(declared.sort()).toEqual(SPACE.map((s) => `spacing-${s}`).sort());
  });

  it("puts every value on the 4-point grid", () => {
    // Q137. A 4-point grid with a 6px value in it is not a grid, it is a suggestion.
    for (const name of SPACE) {
      const px = Number(SPACE_TOKENS[`spacing-${name}`].replace("rem", "")) * 16;
      expect(px % 4, `--spacing-${name} is ${px}px, off the 4-point grid`).toBe(0);
    }
  });

  it("increases monotonically", () => {
    const px = SPACE.map((s) => Number(SPACE_TOKENS[`spacing-${s}`].replace("rem", "")) * 16);
    for (const [i, value] of px.slice(1).entries()) {
      expect(value, `--spacing-${SPACE[i + 1]} is not larger than the step below`).toBeGreaterThan(
        px[i],
      );
    }
  });

  /**
   * The guard for D-219, and the one assertion in this file that is about damage rather than
   * design.
   *
   * `@theme { --spacing-2xl: 4rem }` reads as "name the 64px step". What it also does is hand
   * `max-w-2xl` a new value, because `--spacing-*` is consulted before `--container-*`, and
   * `max-w-2xl` is how `/private/settings`, the update notice, the sign-in card, the register
   * card and both error screens set their width. All six rendered inside a 64px column, with
   * every class name reading correctly and no test failing.
   *
   * It is written as "no `--spacing-*` in `@theme` at all" rather than as a list of the names
   * that collide, because that list is Tailwind's and can grow in a minor release — and the
   * next collision would be as silent as this one.
   */
  it("stays out of the @theme block, where it would redefine max-w-*", () => {
    const shadowed = Object.keys(TOKENS).filter((t) => t.startsWith("spacing-"));
    expect(
      shadowed,
      `--${shadowed[0]} in @theme silently redefines max-w-${shadowed[0]?.slice(8)}. See D-219.`,
    ).toEqual([]);
  });
});

describe("radius and elevation", () => {
  it("scales radius with the size of the thing", () => {
    // Q152. Each named radius is a multiplier of `--radius`, so the base moves them together.
    const named = ["control", "card", "panel", "sheet"];
    const multipliers = named.map((n) => {
      const m = TOKENS[`radius-${n}`].match(/calc\(var\(--radius\)\s*\*\s*([\d.]+)\)/);
      expect(m, `--radius-${n} is not a multiple of --radius`).not.toBeNull();
      return Number(m![1]);
    });
    for (const [i, value] of multipliers.slice(1).entries()) {
      expect(value, `--radius-${named[i + 1]} is not looser than the one below`).toBeGreaterThan(
        multipliers[i],
      );
    }
    expect(TOKENS["radius-pill"]).toBe("9999px");
  });

  it("names four elevation levels and points them at the per-theme values", () => {
    // The names live in scale.css and the values in tokens.css, because elevation is the one
    // non-colour scale that differs per scheme (DESIGN.md §6). If this indirection is ever
    // flattened, `shadow-raised` becomes one shadow for five themes.
    for (const level of ["rest", "raised", "floating", "overlay"]) {
      expect(TOKENS[`shadow-${level}`]).toBe(`var(--elevation-${level})`);
    }
  });
});

describe("breakpoints", () => {
  it.each(BREAKPOINTS)("%s and its Tailwind alias %s are the same number", (name, alias) => {
    // Q143's complaint was two definitions of "phone". Both spellings are declared in the
    // generator so this test can pin them; there is no second set of numbers to drift.
    expect(TOKENS[`breakpoint-${name}`]).toBe(TOKENS[`breakpoint-${alias}`]);
  });

  it("matches every hand-written media query in globals.css to a named breakpoint", () => {
    // CSS does not allow a custom property in a media condition, so `globals.css` has to spell
    // these out by hand — `40rem` for the nav switch and the ambient drift, `64rem` for the
    // sidebar rail (§4.1). This is the only thing that can notice if one of them is changed
    // and the token it stands for is not.
    //
    // It was pinned to `phone` alone until §4.1, which was right while every literal in the
    // file meant the same line. Asserting membership rather than equality keeps the property
    // that matters — **no unnamed breakpoint in this stylesheet** — while letting a second
    // named one exist.
    const named = new Set(
      Object.entries(TOKENS)
        .filter(([token]) => token.startsWith("breakpoint-"))
        .map(([, value]) => value),
    );
    const queries = [...GLOBALS.matchAll(/@media\s*\(width\s*[<>]=?\s*([\d.]+rem)\)/g)].map(
      (m) => m[1],
    );
    expect(queries.length, "globals.css should still carry the nav-switch queries").toBeGreaterThan(
      0,
    );
    for (const value of queries) expect([value, named.has(value)]).toEqual([value, true]);

    // Both lines the file is known to need, named explicitly so deleting one is a failure
    // rather than a silently smaller set.
    expect(queries).toContain(TOKENS["breakpoint-phone"]);
    expect(queries).toContain(TOKENS["breakpoint-laptop"]);
  });

  it("publishes the three content widths and a utility for each (§4.1)", () => {
    // DESIGN.md §5 has specified prose / content / wide since §1.7 and marked them "still to
    // build". They are deliberately in `:root` rather than `@theme`, for D-219's reason:
    // `--container-*` is the namespace `max-w-*` reads, and a step named `prose` there would
    // replace Tailwind's own `max-w-prose` for the whole app.
    for (const [name, rem] of [
      ["prose", "42rem"],
      ["content", "64rem"],
      ["wide", "80rem"],
    ]) {
      expect(CSS).toContain(`--width-${name}: ${rem};`);
      expect(CSS).toContain(`@utility width-${name} {`);
    }
    const theme = CSS.slice(CSS.indexOf("@theme"), CSS.indexOf("/* ---- Space"));
    expect(theme).not.toContain("--width-");
  });
});

describe("motion", () => {
  it("declares three durations and three easings", () => {
    // Q185–Q189. Three of each, and no fourth: a fourth duration is how "150ms-ish" comes back.
    expect(
      Object.keys(TOKENS)
        .filter((t) => t.startsWith("duration-"))
        .sort(),
    ).toEqual(["duration-fast", "duration-medium", "duration-slow"]);
    expect(
      Object.keys(TOKENS)
        .filter((t) => t.startsWith("ease-"))
        .sort(),
    ).toEqual(["ease-entrance", "ease-exit", "ease-standard"]);
  });

  it("keeps the standard curve exactly as it was", () => {
    // Q189 kept it deliberately: it is on every transition in the app, and changing it here
    // would be a redesign arriving disguised as a token.
    expect(TOKENS["ease-standard"]).toBe("cubic-bezier(0.22, 0.72, 0.28, 1)");
  });

  it("generates a utility for each named duration", () => {
    // `--duration-*` is not one of Tailwind's namespaces, so without these blocks `duration-fast`
    // is no CSS at all — and an untransitioned element looks like a design choice.
    for (const name of ["fast", "medium", "slow"]) {
      expect(CSS).toContain(`@utility duration-${name} {`);
    }
  });

  it("has taken the lift out of card-scan", () => {
    // Q176/Q177: the sweep alone is the idea. The lift was one of four simultaneous effects.
    const cardScan = GLOBALS.match(/@utility card-scan \{[\s\S]*?\n\}/)![0];
    expect(cardScan).not.toContain("translateY");
  });

  it("drives the stagger from CSS rather than inline styles", () => {
    // Q180. Six call sites set `style={{ animationDelay }}` by hand before §1.8.
    expect(GLOBALS).toContain("@utility rise-stagger");
    expect(GLOBALS).toMatch(/nth-child\(n \+ 10\)/);
  });

  it("defines the two new utilities §1.8 adds", () => {
    for (const utility of ["press", "shimmer"]) {
      expect(GLOBALS, `@utility ${utility} is missing`).toContain(`@utility ${utility} {`);
    }
  });

  it("gives the press a non-transform alternative under reduced motion", () => {
    // Q207's principle, applied to the one utility §1.8 adds: someone who asked for less motion
    // still has to know the tap registered, so the feedback becomes a ground shift.
    const reduced = GLOBALS.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n/)![0];
    expect(reduced).toContain(".press:active");
  });
});

describe("icons", () => {
  it("tokenises three sizes at 16, 20 and 24", () => {
    // Q214, in rem rather than px so they scale with OS text size — §7.4 audits for exactly that.
    expect(TOKENS["icon-sm"]).toBe("1rem");
    expect(TOKENS["icon-md"]).toBe("1.25rem");
    expect(TOKENS["icon-lg"]).toBe("1.5rem");
  });

  it("sets the stroke once, on the class lucide already emits", () => {
    // Q213. lucide renders stroke-width as an SVG presentation attribute and CSS outranks one,
    // so this reaches every icon in the app without a single call site passing a prop.
    expect(TOKENS["icon-stroke"]).toBe("1.75");
    expect(CSS).toMatch(/\.lucide\s*\{\s*stroke-width:\s*var\(--icon-stroke\);/);
  });
});

describe("freshness", () => {
  it("has not drifted from the generator", () => {
    // The same guarantee `tokens:check` gives colour. Without it, an edit to scale.css survives
    // until the next `npm run dev`, which silently reverts it.
    expect(() =>
      execFileSync("node", ["scripts/build-scale.mts", "--check"], { cwd: ROOT }),
    ).not.toThrow();
  });
});
