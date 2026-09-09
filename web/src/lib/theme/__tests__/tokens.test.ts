import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { contrast, oklchToHex, parseOklch } from "@/lib/theme/color";
import { THEMES, THEME_IDS, DEFAULT_THEME, schemeFor } from "@/lib/theme/registry";

/**
 * The tests that make a generated palette trustworthy (V4 §1.12, D-194).
 *
 * Three separate jobs, and they fail for different reasons:
 *
 *   - **completeness** — every theme defines every token. A theme missing one does not error,
 *     it inherits whatever `:root` happened to set, which is the *default theme's* value. So a
 *     half-written light theme renders one magenta token on a teal page and looks like a design
 *     choice.
 *   - **contrast** — every text token clears its floor on every ground it can sit on. This is
 *     the check that would have caught `#09A1A1` being named as an accent it cannot serve.
 *   - **freshness** — the committed CSS matches what the generator produces now.
 */

const ROOT = path.join(__dirname, "..", "..", "..", "..");
const CSS = readFileSync(path.join(ROOT, "src", "app", "tokens.css"), "utf8");

/** Every `--token: value` inside one theme's block. */
function blockFor(id: string): Record<string, string> {
  const selector =
    id === DEFAULT_THEME ? `:root,\\s*\\[data-theme="${id}"\\]` : `\\[data-theme="${id}"\\]`;
  const match = CSS.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`no block in tokens.css for theme "${id}"`);

  const tokens: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const decl = line.match(/^\s*--([\w-]+):\s*([^;]+);/);
    if (decl) tokens[decl[1]] = decl[2].trim();
  }
  return tokens;
}

const BLOCKS = Object.fromEntries(THEME_IDS.map((id) => [id, blockFor(id)]));

/** Colour tokens every theme must define. Non-colour ones are checked separately. */
const REQUIRED = [
  "background",
  "surface",
  "raised",
  "foreground",
  "muted-foreground",
  "faint-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "highlight",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "muted",
  "accent",
  "accent-foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];

describe("every theme is complete", () => {
  it.each(THEME_IDS)("%s defines every token", (id) => {
    const missing = REQUIRED.filter((token) => !(token in BLOCKS[id]));
    expect(missing).toEqual([]);
  });

  it.each(THEME_IDS)("%s defines the whole primary ramp", (id) => {
    const stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    const missing = stops.filter((stop) => !(`primary-${stop}` in BLOCKS[id]));
    expect(missing).toEqual([]);
  });

  it.each(THEME_IDS)("%s declares its colour-scheme and atmosphere", (id) => {
    expect(BLOCKS[id]["ambient-opacity"]).toBeDefined();
    expect(BLOCKS[id]["grain-opacity"]).toBeDefined();
  });

  it("defines no token that only some themes have", () => {
    // The asymmetric case the `REQUIRED` list cannot catch: a token added to one theme by hand
    // and to no other silently inherits the default theme's value everywhere else.
    const names = THEME_IDS.map((id) => new Set(Object.keys(BLOCKS[id])));
    const union = new Set(names.flatMap((set) => [...set]));
    for (const [index, id] of THEME_IDS.entries()) {
      const missing = [...union].filter((token) => !names[index].has(token));
      expect(missing, `${id} is missing tokens other themes define`).toEqual([]);
    }
  });
});

/**
 * Tokens in a theme block that are deliberately not colours.
 *
 * Kept as an explicit list rather than a pattern. The test below asserts every *other* token
 * parses as `oklch()`, and that assertion is only as good as this list is short — a wildcard
 * here ("anything ending in -opacity", "anything starting with elevation") would let a
 * mistyped colour token slip through by being named to match.
 */
const NON_COLOUR = new Set([
  "ambient-opacity",
  "grain-opacity",
  "elevation-rest",
  "elevation-raised",
  "elevation-floating",
  "elevation-overlay",
  "scrim",
]);

describe("every colour is a real colour", () => {
  it.each(THEME_IDS)("%s uses only parseable oklch()", (id) => {
    const bad = Object.entries(BLOCKS[id])
      .filter(([name]) => !NON_COLOUR.has(name))
      .filter(([, value]) => parseOklch(value) === null)
      .map(([name]) => name);
    expect(bad).toEqual([]);
  });
});

/**
 * Elevation (V4 §1.7, Q156, D-199).
 *
 * Four levels, and they live in `tokens.css` rather than `scale.css` because they are the one
 * non-colour scale that differs per theme: DESIGN.md §6 says elevation is a ground-shift plus a
 * border in dark and a shadow in light. These tests are what stop that sentence and the code
 * from drifting apart — it has happened before, with the `:root`/`.dark` palettes.
 */
describe("elevation", () => {
  const LEVELS = ["rest", "raised", "floating", "overlay"] as const;

  it.each(THEME_IDS)("%s defines all four levels", (id) => {
    for (const level of LEVELS) {
      expect(BLOCKS[id][`elevation-${level}`], `${id} is missing elevation-${level}`).toBeDefined();
    }
  });

  it.each(THEME_IDS)("%s expresses rest as flat", (id) => {
    // Not an oversight. A card at rest is separated by its ground and its own border; the token
    // exists so a component can say "explicitly flat" instead of leaving box-shadow unset.
    expect(BLOCKS[id]["elevation-rest"]).toBe("none");
  });

  it.each(THEME_IDS)("%s builds elevation only out of its own tokens", (id) => {
    // The "no raw hex" rule (§1.12), applied where it is easiest to break: a shadow written as
    // `rgba(0,0,0,.4)` looks fine on the four dark themes and reads as soot on the two light
    // ones. Every value has to come through `var(--…)`.
    for (const level of LEVELS.slice(1)) {
      const value = BLOCKS[id][`elevation-${level}`];
      expect(value, `${id}/${level} should derive from tokens`).toContain("var(--");
      expect(value, `${id}/${level} contains a raw colour`).not.toMatch(
        /#[0-9a-f]{3,8}\b|rgba?\(/i,
      );
    }
  });

  it.each(THEME_IDS)("%s darkens with its scrim rather than lightening", (id) => {
    // A scrim that does not darken is the failure mode that survives review, because it looks
    // correct in whichever scheme it was written in. Dark themes deepen toward their own
    // background; light themes toward their own foreground. Either way the value has to be a
    // mix of a theme token, never a literal black.
    const scrim = BLOCKS[id]["scrim"];
    expect(scrim, `${id} is missing --scrim`).toBeDefined();
    expect(scrim).toContain("var(--");
    expect(scrim).toContain(schemeFor(id) === "dark" ? "var(--background)" : "var(--foreground)");
  });

  it.each(THEME_IDS)("%s uses the mechanism its scheme calls for", (id) => {
    const scheme = schemeFor(id);
    const raised = BLOCKS[id]["elevation-raised"];
    if (scheme === "dark") {
      // Ground-shift plus border: a 1px ring, no offset, no blur.
      expect(raised, `${id} is dark and should elevate with a ring`).toMatch(/^0 0 0 1px /);
    } else {
      // A real shadow: something has to be offset downward.
      expect(raised, `${id} is light and should elevate with a shadow`).toMatch(/0 \d+px/);
    }
  });
});

/**
 * Contrast.
 *
 * Text solves against the worst ground it can sit on — `raised` on a dark theme, `background` on
 * a light one — so that is what it is checked against. Accents are checked on `background` and
 * `surface`, the two they actually appear on; `raised` is popovers and is reported by the
 * generator rather than gated here, because holding an accent to it drives the colour pale.
 */
describe("contrast", () => {
  const hex = (id: string, token: string) => {
    const parsed = parseOklch(BLOCKS[id][token]);
    if (!parsed) throw new Error(`${id}/${token} is not an oklch() value`);
    return oklchToHex(parsed);
  };

  const grounds = (id: string) => ({
    background: hex(id, "background"),
    surface: hex(id, "surface"),
    raised: hex(id, "raised"),
  });

  const scheme = (id: string) => THEMES.find((t) => t.id === id)!.scheme;

  it.each(THEME_IDS)("%s: body text clears AAA on every ground", (id) => {
    const g = grounds(id);
    for (const ground of Object.values(g)) {
      expect(contrast(hex(id, "foreground"), ground)).toBeGreaterThanOrEqual(7);
    }
  });

  it.each(THEME_IDS)("%s: both muted levels clear AA on every ground", (id) => {
    const g = grounds(id);
    // The rule DESIGN.md §3.3 states and that the first light palette broke: a tertiary grey
    // that looks right at 3.9:1 is not a legal text colour.
    for (const token of ["muted-foreground", "faint-foreground"]) {
      for (const [name, ground] of Object.entries(g)) {
        expect(
          contrast(hex(id, token), ground),
          `${id}/${token} on ${name}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(THEME_IDS)("%s: accents clear AA on the page and on a card", (id) => {
    const g = grounds(id);
    for (const token of [
      "primary",
      "secondary",
      "highlight",
      "success",
      "warning",
      "destructive",
      "ring",
    ]) {
      for (const name of ["background", "surface"] as const) {
        expect(
          contrast(hex(id, token), g[name]),
          `${id}/${token} on ${name}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(THEME_IDS)("%s: text on a filled accent clears AA", (id) => {
    for (const role of ["primary", "secondary", "destructive", "success", "warning"]) {
      expect(
        contrast(hex(id, `${role}-foreground`), hex(id, role)),
        `${id}/${role}-foreground on ${role}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(THEME_IDS)("%s: the three grounds are actually distinguishable", (id) => {
    const g = grounds(id);
    // Q55: the old two grounds were "too close to read as distinct layers". Ratios between
    // near-blacks compress badly, so this is a floor, not a target — what it catches is a
    // theme where two grounds are the same colour.
    expect(contrast(g.surface, g.background)).toBeGreaterThan(1.03);
    expect(contrast(g.raised, g.surface)).toBeGreaterThan(1.01);
  });

  it.each(THEME_IDS)("%s: borders are visible against their surface", (id) => {
    const g = grounds(id);
    expect(contrast(hex(id, "border"), g.surface)).toBeGreaterThan(1.15);
  });

  it("the high-contrast theme actually is one", () => {
    const g = grounds("hc-dark");
    for (const token of ["primary", "secondary", "success", "warning", "destructive"]) {
      expect(contrast(hex("hc-dark", token), g.surface), `hc-dark/${token}`).toBeGreaterThanOrEqual(
        7,
      );
    }
  });

  it("dark themes are dark and light themes are light", () => {
    for (const id of THEME_IDS) {
      const l = parseOklch(BLOCKS[id].background)!.l;
      if (scheme(id) === "dark") expect(l, id).toBeLessThan(0.4);
      else expect(l, id).toBeGreaterThan(0.85);
    }
  });
});

describe("the registry and the stylesheet agree", () => {
  it("every registered theme has a block, and every block is registered", () => {
    const inCss = [...CSS.matchAll(/\[data-theme="([\w-]+)"\]/g)].map((m) => m[1]);
    expect([...new Set(inCss)].sort()).toEqual([...THEME_IDS].sort());
  });

  it("every registered swatch colour matches the generated value", () => {
    // Computed from the OKLCH, not read from the hex comment beside it — a comment is not a
    // value, and this is the exact drift `lib/brand.ts` exists to prevent.
    //
    // All three matter. `ground` drives the status bar; `accent` and `foreground` paint the
    // settings picker's swatches, which cannot use `var(--primary)` because a swatch renders a
    // theme that is not the active one — so they are literals, and literals drift.
    for (const theme of THEMES) {
      for (const [field, token] of [
        ["ground", "background"],
        ["accent", "primary"],
        ["foreground", "foreground"],
      ] as const) {
        const parsed = parseOklch(BLOCKS[theme.id][token])!;
        expect(oklchToHex(parsed), `${theme.id}.${field}`).toBe(theme[field]);
      }
    }
  });

  it("the dark variant covers exactly the dark themes", () => {
    // The whole line, not a parenthesised group: the selector contains `:not([data-theme])`,
    // so a `[^)]*` capture stops at that inner bracket and silently reports every theme as
    // absent. The first version of this test failed for exactly that reason.
    const variant = CSS.split("\n").find((line) => line.startsWith("@custom-variant dark")) ?? "";
    expect(variant, "no @custom-variant dark line in tokens.css").not.toBe("");
    for (const theme of THEMES) {
      const mentioned = variant.includes(`[data-theme="${theme.id}"]`);
      expect(mentioned, `${theme.id} in the dark variant`).toBe(theme.scheme === "dark");
    }
  });
});

describe("the committed CSS is what the generator produces", () => {
  it("is not stale", () => {
    // The whole point of generating: hand-edits to tokens.css are silently lost on the next
    // run, so they have to be caught here rather than discovered later.
    expect(() =>
      execFileSync("node", ["scripts/build-tokens.mts", "--check"], {
        cwd: ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
  }, 30_000);
});
