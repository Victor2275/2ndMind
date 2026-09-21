import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The accessibility preferences, and the `px` audit — V4 §7.4 (Q451–Q454), D-311.
 *
 * Two different jobs in one file, because they are the same job at two scales: the app has to
 * answer what the OS asks it, and it has to be *able* to, which for text scaling means owning
 * no absolute font sizes.
 *
 * Neither of these is visible in a screenshot. `npm run shots` renders one set of preferences —
 * whatever this machine is set to — so a `prefers-contrast` block that was deleted, or a `px`
 * font size that crept into a component, would sweep clean and stay broken until someone with
 * that setting opened the app. That someone is Victor, on a phone, and the whole point of §7 is
 * that he should not be the gate.
 */

const ROOT = path.join(__dirname, "..", "..", "..", "..");
const GLOBALS = readFileSync(path.join(ROOT, "src", "app", "globals.css"), "utf8");
const SCALE = readFileSync(path.join(ROOT, "src", "app", "scale.css"), "utf8");

/** Every source file, the same walk `no-raw-hex.test.ts` uses. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** A `@media (...)` block's body, by the feature it tests. */
function mediaBlock(css: string, feature: string): string | null {
  const start = css.indexOf(`@media (${feature}`);
  if (start < 0) return null;
  let depth = 0;
  let i = css.indexOf("{", start);
  const from = i;
  for (; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(from + 1, i);
    }
  }
  return null;
}

describe("the OS preferences are answered", () => {
  it.each([
    ["prefers-contrast: more", "Q451"],
    ["prefers-reduced-transparency: reduce", "Q452"],
    ["forced-colors: active", "Q453"],
    ["prefers-reduced-motion: reduce", "Q207"],
  ])("handles %s (%s)", (feature) => {
    expect(mediaBlock(GLOBALS, feature)).not.toBeNull();
  });

  it("answers reduced transparency by removing blur, not by removing the scrims", () => {
    const block = mediaBlock(GLOBALS, "prefers-reduced-transparency") ?? "";

    // The bars go opaque and every blur goes. What must *not* appear is a rule flattening
    // `bg-scrim`: a scrim is translucent as its function, and an opaque one is a new screen.
    expect(block).toContain("backdrop-filter: none");
    expect(block).toContain("--background");
    expect(block).toContain("--card");
    expect(block).not.toContain("bg-scrim");
  });

  it("collapses the tertiary text level to the middle one, never to the foreground", () => {
    const block = mediaBlock(GLOBALS, "prefers-contrast") ?? "";

    // Flattening three levels into one destroys the hierarchy that says what to read first,
    // which is its own accessibility loss. Two levels survive; three do not.
    expect(block).toContain("--faint-foreground: var(--muted-foreground)");
    expect(block).not.toContain("--faint-foreground: var(--foreground)");
  });

  it("uses system colours under forced-colors, and never opts out of them", () => {
    const block = mediaBlock(GLOBALS, "forced-colors") ?? "";

    expect(block).toContain("Highlight");
    expect(block).toContain("CanvasText");
    // The escape hatch that would let any element ignore the forced palette. The charts have
    // the only real claim to it and get a text alternative instead (Q450, D-312) — so if this
    // ever appears, that trade was quietly reversed.
    expect(block).not.toContain("forced-color-adjust");
  });
});

describe("the px audit (Q454)", () => {
  /**
   * Font size must scale with the OS text setting, which means every size is a `rem`.
   *
   * `px` is not banned outright and should not be: a 1px border, a 2px focus ring and a 9999px
   * pill radius are all correct as absolute lengths — they are not text and they should not
   * grow when text does. What must never be absolute is a **font size**, a **line height** or
   * a **breakpoint**, because each of those is a promise about text.
   */
  it("declares no font size in px anywhere in the stylesheets", () => {
    for (const [name, css] of [
      ["globals.css", GLOBALS],
      ["scale.css", SCALE],
    ] as const) {
      // Comments carry px equivalents on purpose ("xs: 12.00px"), so they are stripped first
      // rather than matched and excused.
      const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
      const found = [...code.matchAll(/font-size:\s*[^;]*?(\d[\d.]*)px/g)].map((m) => m[0]);
      expect([name, found]).toEqual([name, []]);
    }
  });

  it("sizes every step of the type scale in rem", () => {
    const steps = [...SCALE.matchAll(/--text-([\w-]+):\s*([^;]+);/g)];
    expect(steps.length).toBeGreaterThan(0);

    for (const [, step, value] of steps) {
      // `clamp()` is allowed and used by the fluid steps, so the assertion is that no absolute
      // px length appears anywhere in the value, not that it starts with a number.
      expect([step, /\d\s*px/.test(value)]).toEqual([step, false]);
    }
  });

  it("expresses every breakpoint in rem, so the layout moves with the text size too", () => {
    const steps = [...SCALE.matchAll(/--breakpoint-([\w-]+):\s*([^;]+);/g)];
    expect(steps.length).toBeGreaterThan(0);

    for (const [, step, value] of steps) {
      expect([step, value.trim().endsWith("rem")]).toEqual([step, true]);
    }
  });

  it("uses no arbitrary px font size in any component", () => {
    // An arbitrary pixel value inside a `text-` utility is the spelling that gets past every
    // check above, because it lives in a className rather than in a stylesheet. Measured
    // 2026-09-21: zero call sites, and this is what keeps it that way.
    //
    // The example is described rather than written out, because this walk reads every file
    // under `src` and that includes this one — spelling it literally made the test fail on
    // its own comment the first time it ran.
    const offenders: string[] = [];

    for (const file of walk(path.join(ROOT, "src"))) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\btext-\[[\d.]+px\]/g)) {
        offenders.push(`${path.relative(ROOT, file)}: ${match[0]}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
