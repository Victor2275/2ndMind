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
  type Oklch,
} from "../src/lib/theme/color.ts";

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
    note: "The default. V2's identity, re-tuned: less saturated, warmer, and three grounds instead of two.",
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
    note: "Experimental. A hueless near-black: nothing in the grounds carries an accent hue, which is what exposes any component assuming a tinted surface.",
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
  const tokens: Record<string, Oklch> = { background, surface, raised };
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
    tokens[name] = solved;
  }

  /* Derived. Borders and the muted/accent grounds are steps off a ground rather than solved
     colours: they are never text, so a contrast target would be inventing a requirement. */
  const step = (base: Oklch, delta: number): Oklch =>
    fitToGamut({ ...base, l: Math.max(0, Math.min(1, base.l + delta)) });

  const borderDelta = spec.scheme === "dark" ? 0.09 : -0.075;
  tokens.border = step(surface, borderDelta);
  tokens.input = tokens.border;
  tokens.muted = step(surface, spec.scheme === "dark" ? 0.015 : -0.012);
  tokens.accent = raised;
  tokens["accent-foreground"] = tokens.foreground;

  tokens["primary-foreground"] = onFill(tokens.primary, spec.scheme);
  tokens["secondary-foreground"] = onFill(tokens.secondary, spec.scheme);
  tokens["destructive-foreground"] = onFill(tokens.destructive, spec.scheme);
  tokens["success-foreground"] = onFill(tokens.success, spec.scheme);
  tokens["warning-foreground"] = onFill(tokens.warning, spec.scheme);

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
    return [stop, fitToGamut({ l, c: primary.c * Math.max(0.15, bell), h: primary.h })] as [
      number,
      Oklch,
    ];
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
      s.id === "dark-magenta"
        ? `:root:not([data-theme]) *, [data-theme="${s.id}"] *`
        : `[data-theme="${s.id}"] *`,
    )
    .join(", ")}));`,
);
lines.push("");

for (const { spec, tokens } of built) {
  const scheme = spec.scheme;
  const selector =
    spec.id === "dark-magenta"
      ? `:root,\n[data-theme="dark-magenta"]`
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
