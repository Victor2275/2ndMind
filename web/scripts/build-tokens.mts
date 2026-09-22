/**
 * Designs the theme palettes and writes `src/app/tokens.css` (V4 §1.1–§1.4, D-194).
 *
 *   node scripts/build-tokens.mts            # write
 *   node scripts/build-tokens.mts --check    # fail if the committed CSS is stale
 *
 * ## Why this exists rather than hand-written CSS
 *
 * Every colour in every theme is **solved for a contrast ratio**, not chosen and then checked.
 * `#09A1A1` was named as this project's primary accent for six weeks while being 2.94:1 on
 * paper — unusable for text — and nothing about looking at it said so. Here a token is declared
 * as "teal, at whatever lightness clears 5.4:1 on a card", and the number comes out of the
 * solver. Contrast stops being something you remember to verify.
 *
 * The CSS is generated and committed. `--check` runs in CI and in the test suite, so the two
 * cannot drift; edit this file, never `tokens.css`.
 *
 * ## The two rules that produce the values
 *
 * **Text solves against the worst ground.** Body, muted and faint text appear on all three
 * grounds, so they are solved against the least favourable: `raised` on a dark theme,
 * `background` on a light one. Solving against the page ground alone is exactly how a faint grey
 * passed at 4.61:1 and then sat on a card at 4.07:1.
 *
 * **Accents solve against `surface`.** They live on cards almost everywhere. Holding them to
 * `raised` as well drove the magenta to `#e981bc`, a pale pink — the opposite of the "less
 * saturated, warmer" that was asked for. `raised` is popovers; accents are reported there, not
 * failed there.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  contrast,
  fitToGamut,
  formatOklch,
  lightnessForContrast,
  oklchToHex,
  parseOklch,
  type Oklch,
} from "../src/lib/theme/color.ts";
// Which theme owns the bare `:root` block is the registry's call, not this script's. It was a
// literal in both files until the default moved to Carbon, and the way that fails is silent:
// change one and the app ships a default whose palette belongs to a different theme.
import { DEFAULT_THEME } from "../src/lib/theme/registry.ts";

/**
 * The colour as the stylesheet will actually contain it.
 *
 * `formatOklch` rounds to 4 decimal places, so the value written to CSS is not bit-identical to
 * the one the solver returned. Everything downstream — the hex in the comment, the contrast
 * ratio beside it, the swatch literals in `lib/theme/registry.ts` — has to describe the *shipped*
 * colour, not the one before rounding, or the documentation is off by a channel and the test
 * that compares them fails for a reason that looks like a typo.
 *
 * Round-tripping through the formatter is the whole fix: format, parse back, use that.
 */
function asShipped(color: Oklch): Oklch {
  return parseOklch(formatOklch(color)) ?? color;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "src", "app", "tokens.css");

type Seed = { c: number; h: number; target: number };

type Spec = {
  id: string;
  label: string;
  scheme: "dark" | "light";
  /** One line on why this theme exists, written into the CSS. */
  note: string;
  /** [background, surface, raised]. Dark schemes lighten; light schemes lighten too. */
  grounds: [Oklch, Oklch, Oklch];
  seeds: Record<string, Seed>;
};

/* Hues, in OKLCH degrees.
   350 magenta (the V2 accent) · 194 teal · 250 steel · 70 peach/amber · 155 green · 25 red. */
const H = { magenta: 346, teal: 194, steel: 250, amber: 70, green: 155, red: 25 } as const;

/** Accents, shared in shape across themes. `target` is against `surface`. */
function accents(
  primary: Seed,
  secondary: Seed,
  over: "dark" | "light",
  /** A floor every accent must clear. The high-contrast theme raises it; otherwise unset. */
  floor = 0,
): Record<string, Seed> {
  // Light grounds need a little headroom: an accent solved to 5.0 on a white card lands near
  // 4.6 on the paper ground behind it, which clears AA but only just.
  const lift = over === "light" ? 0.4 : 0;
  const at = (base: number) => Math.max(base + lift, floor);
  return {
    primary: { ...primary, target: at(primary.target) },
    secondary: { ...secondary, target: at(secondary.target) },
    highlight: { c: 0.1, h: H.amber, target: at(over === "dark" ? 7.8 : 5.0) },
    success: { c: 0.095, h: H.green, target: at(5.0) },
    warning: { c: 0.11, h: H.amber, target: at(over === "dark" ? 6.0 : 5.0) },
    destructive: { c: 0.15, h: H.red, target: at(5.0) },
    ring: { c: primary.c * 0.9, h: primary.h, target: at(over === "dark" ? 7.0 : 5.5) },
  };
}

const TEXT_DARK = {
  foreground: { c: 0.012, h: H.magenta, target: 13 },
  "muted-foreground": { c: 0.014, h: H.magenta, target: 7 },
  "faint-foreground": { c: 0.014, h: H.magenta, target: 4.6 },
};

const SPECS: Spec[] = [
  {
    id: "dark-magenta",
    label: "Magenta",
    scheme: "dark",
    note: "V2's identity, re-tuned: less saturated, warmer, and three grounds instead of two.",
    grounds: [
      { l: 0.155, c: 0.016, h: 350 },
      { l: 0.235, c: 0.021, h: 350 },
      { l: 0.285, c: 0.026, h: 350 },
    ],
    seeds: {
      ...TEXT_DARK,
      // 0.17 -> 0.145 chroma and 356 -> 346 hue: the "slightly less saturated, and warmer" of Q49.
      ...accents(
        { c: 0.145, h: H.magenta, target: 5.2 },
        { c: 0.07, h: H.steel, target: 5.0 },
        "dark",
      ),
    },
  },
  {
    id: "light-teal",
    label: "Teal",
    scheme: "light",
    note: "Teal on warm paper — the vault's original six swatches. #09A1A1 itself is 2.94:1 here and cannot carry text, so the token is that hue taken down.",
    // Light elevation is shadow, not colour (Q80), so these lighten gently and stay close.
    grounds: [
      { l: 0.963, c: 0.007, h: H.teal },
      { l: 0.992, c: 0.003, h: H.teal },
      { l: 1.0, c: 0.0, h: H.teal },
    ],
    seeds: {
      foreground: { c: 0.02, h: 200, target: 14 },
      "muted-foreground": { c: 0.018, h: 200, target: 6 },
      "faint-foreground": { c: 0.018, h: 200, target: 4.6 },
      ...accents(
        { c: 0.1, h: H.teal, target: 5.2 },
        { c: 0.075, h: H.steel, target: 5.0 },
        "light",
      ),
    },
  },
  {
    id: "hc-dark",
    label: "High contrast",
    scheme: "dark",
    note: "For a phone in sunlight. Also what `prefers-contrast: more` selects when nothing else has been chosen.",
    grounds: [
      { l: 0.1, c: 0.0, h: 0 },
      { l: 0.19, c: 0.0, h: 0 },
      { l: 0.27, c: 0.0, h: 0 },
    ],
    seeds: {
      // 15, not 18: white on the `raised` ground is ~16:1, so a higher target is unreachable
      // rather than ambitious, and the solver says so instead of silently clamping.
      foreground: { c: 0.0, h: 0, target: 15 },
      "muted-foreground": { c: 0.0, h: 0, target: 9 },
      "faint-foreground": { c: 0.0, h: 0, target: 6.5 },
      // Every accent clears 7.5:1, not just the two named ones — a "high contrast" theme whose
      // destructive red sits at 5:1 is not one.
      ...accents(
        { c: 0.15, h: H.magenta, target: 7.5 },
        { c: 0.08, h: H.steel, target: 7.5 },
        "dark",
        7.5,
      ),
    },
  },
  {
    id: "carbon",
    label: "Carbon",
    scheme: "dark",
    note: "The default. A hueless near-black: nothing in the grounds carries an accent hue, so any component that assumes a tinted surface shows itself immediately.",
    grounds: [
      { l: 0.165, c: 0.0, h: 0 },
      { l: 0.245, c: 0.0, h: 0 },
      { l: 0.295, c: 0.0, h: 0 },
    ],
    seeds: {
      foreground: { c: 0.0, h: 0, target: 13 },
      "muted-foreground": { c: 0.0, h: 0, target: 7 },
      "faint-foreground": { c: 0.0, h: 0, target: 4.6 },
      ...accents({ c: 0.13, h: 200, target: 6.0 }, { c: 0.05, h: H.steel, target: 5.0 }, "dark"),
    },
  },
  {
    id: "steel-light",
    label: "Steel",
    scheme: "light",
    note: "Experimental, and a deliberate test of a rule: steel is documented as structural and never interactive. This makes it the accent to find out whether that holds.",
    grounds: [
      { l: 0.968, c: 0.005, h: H.steel },
      { l: 0.994, c: 0.002, h: H.steel },
      { l: 1.0, c: 0.0, h: H.steel },
    ],
    seeds: {
      foreground: { c: 0.018, h: H.steel, target: 14 },
      "muted-foreground": { c: 0.016, h: H.steel, target: 6 },
      "faint-foreground": { c: 0.016, h: H.steel, target: 4.6 },
      ...accents(
        { c: 0.09, h: H.steel, target: 5.2 },
        { c: 0.08, h: H.teal, target: 5.0 },
        "light",
      ),
    },
  },
];

const TEXT_ROLES = new Set(["foreground", "muted-foreground", "faint-foreground"]);

/** Text that sits on a filled accent. Picks whichever end of the scale clears more. */
function onFill(fill: Oklch, scheme: "dark" | "light"): Oklch {
  const fillHex = oklchToHex(fill);
  const light = fitToGamut({ l: 0.99, c: 0.008, h: fill.h });
  const dark = fitToGamut({ l: scheme === "dark" ? 0.16 : 0.19, c: 0.02, h: fill.h });
  return contrast(oklchToHex(light), fillHex) >= contrast(oklchToHex(dark), fillHex) ? light : dark;
}

type Built = { spec: Spec; tokens: Record<string, Oklch>; warnings: string[] };

function build(spec: Spec): Built {
  const [background, surface, raised] = spec.grounds;
  const worst = spec.scheme === "dark" ? raised : background;
  const tokens: Record<string, Oklch> = {
    background: asShipped(background),
    surface: asShipped(surface),
    raised: asShipped(raised),
  };
  const warnings: string[] = [];

  for (const [name, seed] of Object.entries(spec.seeds)) {
    const against = TEXT_ROLES.has(name) ? worst : surface;
    const solved = lightnessForContrast(
      { c: seed.c, h: seed.h },
      oklchToHex(against),
      seed.target,
      spec.scheme === "dark" ? "up" : "down",
    );
    if (!solved) {
      warnings.push(`${spec.id}/${name}: cannot reach ${seed.target}:1 at chroma ${seed.c}`);
      continue;
    }
    tokens[name] = asShipped(solved);
  }

  /* Derived. Borders and the muted/accent grounds are steps off a ground rather than solved
     colours: they are never text, so a contrast target would be inventing a requirement. */
  const step = (base: Oklch, delta: number): Oklch =>
    asShipped(fitToGamut({ ...base, l: Math.max(0, Math.min(1, base.l + delta)) }));

  const borderDelta = spec.scheme === "dark" ? 0.09 : -0.075;
  tokens.border = step(surface, borderDelta);
  tokens.input = tokens.border;
  tokens.muted = step(surface, spec.scheme === "dark" ? 0.015 : -0.012);
  tokens.accent = raised;
  tokens["accent-foreground"] = tokens.foreground;

  tokens["primary-foreground"] = asShipped(onFill(tokens.primary, spec.scheme));
  tokens["secondary-foreground"] = asShipped(onFill(tokens.secondary, spec.scheme));
  tokens["destructive-foreground"] = asShipped(onFill(tokens.destructive, spec.scheme));
  tokens["success-foreground"] = asShipped(onFill(tokens.success, spec.scheme));
  tokens["warning-foreground"] = asShipped(onFill(tokens.warning, spec.scheme));

  /* shadcn compatibility. `card`/`popover`/`sidebar` are the vendored components' names for
     grounds this system already has; aliasing them keeps badge.tsx and button.tsx working
     without a second set of values that can drift. */
  tokens.card = surface;
  tokens["card-foreground"] = tokens.foreground;
  tokens.popover = raised;
  tokens["popover-foreground"] = tokens.foreground;
  tokens.sidebar = surface;
  tokens["sidebar-foreground"] = tokens.foreground;
  tokens["sidebar-primary"] = tokens.primary;
  tokens["sidebar-primary-foreground"] = tokens["primary-foreground"];
  tokens["sidebar-accent"] = raised;
  tokens["sidebar-accent-foreground"] = tokens.foreground;
  tokens["sidebar-border"] = tokens.border;
  tokens["sidebar-ring"] = tokens.ring;

  /* Charts run warm -> cool -> warm across the family so a multi-series plot reads as one set.
     Categorical only; ordered data gets its own ramp (DESIGN.md §10). */
  tokens["chart-1"] = tokens.primary;
  tokens["chart-2"] = tokens.secondary;
  tokens["chart-3"] = tokens.success;
  tokens["chart-4"] = tokens.highlight;
  tokens["chart-5"] = tokens["faint-foreground"];

  return { spec, tokens, warnings };
}

/* --- the primary ramp -------------------------------------------------------------------
   50–950, so the ~300 `bg-primary/10`-style opacity utilities scattered through the app have a
   deterministic replacement. Compositing an accent at 10% over a card gives a different colour
   on every ground; a ramp step is the same colour everywhere, which is the whole point. */
function ramp(primary: Oklch, scheme: "dark" | "light"): Array<[number, Oklch]> {
  const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  // The ramp runs light-to-dark by number in both schemes, the way every other design system
  // does. What changes is where the accent itself sits on it.
  return STOPS.map((stop) => {
    const t = stop / 1000;
    const l = 0.97 - t * 0.82;
    // Chroma peaks in the middle: the extremes are near-white and near-black, which cannot hold
    // saturation without leaving gamut.
    const bell = 1 - Math.abs(t - 0.5) * 1.6;
    return [
      stop,
      asShipped(fitToGamut({ l, c: primary.c * Math.max(0.15, bell), h: primary.h })),
    ] as [number, Oklch];
  });
}

const built = SPECS.map(build);
const allWarnings = built.flatMap((b) => b.warnings);

const lines: string[] = [
  "/*",
  " * GENERATED by scripts/build-tokens.mts — do not edit.",
  " *",
  " * Every value is solved for a contrast ratio rather than chosen and checked; the script has",
  " * the two rules that produce them. `npm run tokens:check` fails if this file is stale, and",
  " * the test suite runs that check.",
  " *",
  ` * Written ${new Date().toISOString().slice(0, 10)}.`,
  " */",
  "",
];

/* The `dark:` variant's selector list, generated.
 *
 * This is the one place a new theme has to reach outside its own block, so it is written by the
 * generator rather than maintained by hand. The alternative — a `data-scheme` attribute set at
 * runtime — needs a second pre-hydration script alongside next-themes', and a mistimed one
 * renders every `dark:` utility's light branch on a dark ground for a frame. A generated
 * selector list cannot be out of date and cannot be forgotten. */
lines.push("/* Generated: every dark-family theme. Adding one updates this automatically. */");
lines.push(
  `@custom-variant dark (&:is(${SPECS.filter((s) => s.scheme === "dark")
    .map((s) =>
      s.id === DEFAULT_THEME
        ? `:root:not([data-theme]) *, [data-theme="${s.id}"] *`
        : `[data-theme="${s.id}"] *`,
    )
    .join(", ")}));`,
);
lines.push("");

for (const { spec, tokens } of built) {
  const scheme = spec.scheme;
  /**
   * **`:root:not([data-theme])`, never a bare `:root`** — V4 §7.1, D-322.
   *
   * The default theme owns the fallback block, for the page that has not chosen one yet. It
   * was written as a bare `:root`, and that shipped a bug that made three of the five themes
   * do nothing at all.
   *
   * `:root` and `[data-theme="light-teal"]` have the *same* specificity — one pseudo-class
   * against one attribute selector, (0,1,0) either way — so the cascade falls through to
   * source order, and the default's block is emitted in registry order rather than first. Any
   * theme defined *above* the default therefore lost to it on every page, whatever the
   * attribute said: `dark-magenta`, `light-teal` and `hc-dark` all rendered as `carbon`, while
   * `steel-light` worked purely because it happens to sit below it in the registry.
   *
   * Qualifying the fallback makes it order-independent: it matches only when no theme has been
   * chosen, which is what "the default" was always supposed to mean. `tokens.test.ts` pins it,
   * because this failed silently and looked exactly like a theme picker that worked.
   */
  const selector =
    spec.id === DEFAULT_THEME
      ? `:root:not([data-theme]),\n[data-theme="${spec.id}"]`
      : `[data-theme="${spec.id}"]`;

  lines.push(`/* ${spec.label} (${spec.id}) — ${scheme}`);
  lines.push(` * ${spec.note} */`);
  lines.push(`${selector} {`);
  lines.push(`  color-scheme: ${scheme};`);
  /* The ambient pools and the grain are theme values, not scheme overrides. As selectors they
     needed a `[data-scheme]` attribute that does not exist until hydration; as tokens they are
     correct on the first painted frame. The grain dithers banding in wide radial fills on 8-bit
     displays, which is a dark-ground problem — on paper the same texture reads as a dirty
     screen (Q82), so light themes set it to zero. */
  lines.push(`  --ambient-opacity: ${scheme === "dark" ? "1" : "0.45"};`);
  lines.push(`  --grain-opacity: ${scheme === "dark" ? "0.04" : "0"};`);

  /* Elevation, four levels (V4 §1.7, Q156). Here rather than in `build-scale.mts` because it is
     the one non-colour scale that is not the same in every theme: DESIGN.md §6 says elevation
     is a ground-shift plus a border in dark and a shadow in light, and that is the main
     structural difference between the two schemes.

     Every value is `color-mix`ed from this theme's own tokens rather than written as a literal,
     so a shadow carries the theme's hue and a new theme gets a correct elevation scale for
     free. `scale.css` publishes the names (`shadow-rest` … `shadow-overlay`); these are what
     the names point at.

     `rest` is `none` in both schemes on purpose, and it is not a gap. A card at rest is
     separated by its ground (`--surface` against `--background`) and its own border — that is
     what "ground-shift" means. The token exists so the scale has four names and so a component
     can say `shadow-rest` to mean "explicitly flat" rather than leaving the property unset. */
  const shade = (pct: number) =>
    scheme === "dark"
      ? `color-mix(in oklab, var(--background) ${pct}%, transparent)`
      : `color-mix(in oklab, var(--foreground) ${pct}%, transparent)`;
  const ring = (pct: number) =>
    `0 0 0 1px color-mix(in oklab, var(--foreground) ${pct}%, var(--border))`;
  const elevation: Record<string, string> =
    scheme === "dark"
      ? {
          rest: "none",
          raised: ring(10),
          floating: `${ring(16)}, 0 10px 28px -14px ${shade(70)}`,
          overlay: `${ring(22)}, 0 22px 54px -22px ${shade(85)}`,
        }
      : {
          rest: "none",
          raised: `0 1px 2px ${shade(6)}`,
          floating: `0 1px 2px ${shade(5)}, 0 8px 24px -16px ${shade(28)}`,
          overlay: `0 2px 4px ${shade(6)}, 0 24px 48px -24px ${shade(35)}`,
        };
  for (const [level, value] of Object.entries(elevation)) {
    lines.push(`  --elevation-${level}: ${value};`);
  }

  /* The scrim behind a sheet or a modal. Per theme for the same reason elevation is, and it is
     the one token where getting the scheme wrong is *invisible in review*: a scrim has to
     darken, and `bg-black/10` — which is what the vendored sheet shipped with — does darken on
     paper and does nothing at all on a near-black ground, where the thing it is supposed to be
     dimming is already darker than the scrim. So dark themes deepen toward their own background
     and light themes toward their own foreground. */
  lines.push(
    `  --scrim: ${
      scheme === "dark"
        ? "color-mix(in oklab, var(--background) 72%, transparent)"
        : "color-mix(in oklab, var(--foreground) 22%, transparent)"
    };`,
  );

  const bgHex = oklchToHex(tokens.background);
  const surfaceHex = oklchToHex(tokens.surface);
  for (const [name, value] of Object.entries(tokens)) {
    const hex = oklchToHex(value);
    const against = TEXT_ROLES.has(name) ? bgHex : surfaceHex;
    const ratio = contrast(hex, against);
    const annotate = TEXT_ROLES.has(name) || name in spec.seeds;
    lines.push(
      `  --${name}: ${formatOklch(value)};` +
        (annotate ? `  /* ${hex} · ${ratio.toFixed(2)}:1 */` : `  /* ${hex} */`),
    );
  }

  for (const [stop, value] of ramp(tokens.primary, scheme)) {
    lines.push(`  --primary-${stop}: ${formatOklch(value)};  /* ${oklchToHex(value)} */`);
  }

  lines.push("}");
  lines.push("");
}

/* `prefers-contrast: more` selects the high-contrast palette when the viewer has not chosen a
   theme themselves (Q71 + Q451 as one thing). `:root:not([data-theme])` is what makes it a
   default rather than an override — an explicit choice always wins. */
const hc = built.find((b) => b.spec.id === "hc-dark");
if (hc) {
  lines.push("/* An OS asking for more contrast gets the high-contrast palette, unless a theme");
  lines.push(" * has been chosen explicitly — an explicit choice always wins. */");
  lines.push("@media (prefers-contrast: more) {");
  lines.push("  :root:not([data-theme]) {");
  lines.push("    color-scheme: dark;");
  for (const [name, value] of Object.entries(hc.tokens)) {
    lines.push(`    --${name}: ${formatOklch(value)};`);
  }
  lines.push("  }");
  lines.push("}");
  lines.push("");
}

const css = lines.join("\n");

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  // The date line changes every day and means nothing; compare everything else.
  const strip = (s: string) => s.replace(/^ \* Written \d{4}-\d{2}-\d{2}\.$/m, "");
  if (strip(current) !== strip(css)) {
    console.error("tokens.css is stale. Run: npm run tokens");
    process.exit(1);
  }
  console.log("tokens.css is up to date.");
} else {
  writeFileSync(OUT, css, "utf8");
  console.log(`Wrote ${OUT}`);
  for (const { spec, tokens } of built) {
    const bg = oklchToHex(tokens.background);
    const surface = oklchToHex(tokens.surface);
    console.log(`\n  ${spec.label} (${spec.id}, ${spec.scheme})  bg ${bg}  surface ${surface}`);
    for (const name of Object.keys(spec.seeds)) {
      if (!tokens[name]) continue;
      const hex = oklchToHex(tokens[name]);
      const against = TEXT_ROLES.has(name) ? bg : surface;
      console.log(`    ${name.padEnd(18)} ${hex}  ${contrast(hex, against).toFixed(2)}:1`);
    }
  }
}

if (allWarnings.length > 0) {
  console.error("\nUnreachable targets:");
  for (const w of allWarnings) console.error(`  ${w}`);
  process.exit(1);
}
