/**
 * Designs the non-colour scales and writes `src/app/scale.css` (V4 §1.5–§1.9, D-199).
 *
 *   node scripts/build-scale.mts            # write
 *   node scripts/build-scale.mts --check    # fail if the committed CSS is stale
 *
 * ## Why this is generated
 *
 * The same argument `build-tokens.mts` makes for colour, applied to everything else that is a
 * number: **a value nobody can compute is a value nobody can check.** A nine-step type scale at
 * ratio 1.2 is nine multiplications — writing them out by hand means nine chances to fat-finger
 * a digit, and no way to tell afterwards that you did. Here the ratio is stated once, the steps
 * derive, and `npm run scale:check` fails when the committed CSS stops matching.
 *
 * It also makes the *deviations* legible. Q101 asked for "modular, hand-adjusted at the
 * extremes"; `OVERRIDES` below is that list, and the generator writes the size it would have
 * produced next to the one it was told to use instead. A hand-written stylesheet cannot show
 * you which of its numbers are the system and which are the exceptions.
 *
 * ## What lives here and what does not
 *
 * This file holds everything that is the **same in every theme**: type, space, radius,
 * breakpoints, motion, icon sizes. Anything that varies per theme is colour or is derived from
 * colour, and belongs in `build-tokens.mts` — elevation is the one that looks like it belongs
 * here and does not, because in dark themes it is a ground-shift and a border while in light
 * themes it is a shadow (DESIGN.md §6). The shadow *names* are declared here so Tailwind emits
 * `shadow-rest` / `shadow-raised` / `shadow-floating` / `shadow-overlay` utilities; the values
 * those names point at are per-theme and come out of the other generator.
 *
 * ## The one thing to know before editing
 *
 * Tailwind v4 reads `@theme` and turns each namespace into utilities. `--text-lg` makes
 * `text-lg`; `--text-lg--line-height` and `--text-lg--letter-spacing` ride along with it, which
 * is what makes "optical tracking per step" (Q106) a property of the scale rather than something
 * every call site has to remember. Renaming a step therefore renames a utility used across the
 * app. Do not rename; adjust.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "src", "app", "scale.css");

/* ===========================================================================================
   TYPE — V4 §1.5 (Q101–Q106)
   =========================================================================================== */

/**
 * Nine steps, and they are deliberately Tailwind's own nine names.
 *
 * The alternative was a fresh vocabulary (`--text-step-0` and friends). It was rejected on a
 * count: `text-xs` through `text-5xl` appear **466 times** across `src/`, and exactly nine
 * distinct names are in use — xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl. Nine steps, nine names
 * already in the codebase. Redefining them means every existing call site becomes
 * scale-correct with no migration, and Milestone A's "every size comes from one place" is true
 * on the day this lands rather than after a 466-site sweep.
 *
 * The cost is that the sizes those names produce all move. That is the point — they were
 * Tailwind's defaults, chosen by someone else for a different typeface.
 */
const STEPS = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"] as const;

/** Q101: minor third. The one number the whole scale comes out of. */
const RATIO = 1.2;

/**
 * `base` is the anchor and it is exactly 1rem.
 *
 * Anchoring at the *bottom* of the scale was tried first and produced `base: 0.99rem`. That is
 * a worse scale for one reason that has nothing to do with typography: `rem` arithmetic
 * everywhere else in the app assumes the root size, and a `base` that is 15.84px makes every
 * hand-checked "16px" measurement off by a sixth of a pixel forever. Anchoring here costs
 * nothing and makes `text-base` mean what it says.
 */
const BASE_INDEX = STEPS.indexOf("base");

/**
 * Q101's "hand-adjusted at the extremes", stated as data so the generator can report it.
 *
 * Two adjustments, one at each end, and Q101 permits exactly that.
 *
 * **`5xl` → 3rem.** The geometric top step is 2.986rem; rounding to a flat 48px costs 0.47% and
 * buys a round number at the one size that gets measured by eye against a design.
 *
 * **`xs` → 0.75rem.** The geometric bottom step is 0.6944rem, or 11.11px. It clears the 11px
 * floor §7.1 turns into a gate — but only by 0.11px, and it would have taken the app's smallest
 * text *down* from Tailwind's 12px across 161 call sites, in a codebase whose measured problem
 * (D-190) is that too much of its text is small. Measured both ways with `npm run shots`: at
 * 11.11px the sweep reports **157** sub-12px elements per width against D-190's 68 baseline; at
 * 12px it reports about **53**, which is better than the baseline. The cost is the one number
 * this file cannot hide — the `xs → sm` ratio is 1.111 rather than 1.2. That is the whole price
 * of the bottom step being a size somebody reads rather than a size the ratio produced.
 *
 * **Do not add a middle-of-the-scale override here.** An exception at an end is a decision; an
 * exception in the middle is a scale nobody can predict, and `scale.test.ts` fails on one.
 */
const OVERRIDES: Partial<Record<(typeof STEPS)[number], number>> = {
  xs: 0.75,
  "5xl": 3,
};

/**
 * From this step up, the size is fluid rather than stepped (Q103).
 *
 * `2xl` is the line because it is where display type starts: everything below it is body,
 * secondary and UI text, which Q103 wants stepped so a paragraph does not reflow while the
 * window is dragged. Q104 is the reason the top of the scale is fluid at all — `text-4xl` was
 * "too loud on a phone", and a fluid step is the fix that does not need a `sm:` variant at
 * every heading.
 */
const FLUID_FROM = STEPS.indexOf("2xl");

/** The viewport range a fluid step interpolates across: a small phone to a laptop. */
const FLUID_MIN_VW = 22.5; // 360px — the narrowest width `npm run shots` sweeps
const FLUID_MAX_VW = 80; //   1280px — the widest width it swept before §7.1 adds 1440/1920

/**
 * Optical tracking, in em, linear across the nine steps (Q106).
 *
 * Small text wants air between letters and large text wants none; this is the whole rule, and
 * it is a straight line from +0.01em to −0.03em rather than a table because there is nothing
 * to judge here beyond the two endpoints. Uppercase is a different problem and is not this —
 * see `--tracking-caps` below.
 */
const TRACK_MAX = 0.01; // at `xs`
const TRACK_MIN = -0.03; // at `5xl`

/**
 * Leading, per step. **This one is a table on purpose.**
 *
 * Everything else in this file is a formula because a formula is checkable. Leading is not:
 * the right value depends on the measure, the face, and whether the step is body or display,
 * and every formula tried here produced at least one step that was visibly wrong. A table with
 * a reason beside each row is more honest than a curve fitted to hide that it is a table.
 *
 * These are the **UI** defaults. DESIGN.md §4 sets prose to 1.6 and private UI to 1.45; prose
 * contexts override with `leading-*`, because the same `text-sm` is a form label on one screen
 * and a paragraph on another and only the call site knows which.
 */
const LEADING: Record<(typeof STEPS)[number], { value: number; why: string }> = {
  xs: { value: 1.45, why: "labels and metadata, usually one or two words" },
  sm: { value: 1.5, why: "the private app's dominant body size — 228 call sites" },
  base: { value: 1.55, why: "public prose at its narrowest; §4 widens it to 1.6 in prose" },
  lg: { value: 1.4, why: "card headings and ledes, two or three lines at most" },
  xl: { value: 1.3, why: "section headings — display leading starts tightening here" },
  "2xl": { value: 1.22, why: "first fluid step" },
  "3xl": { value: 1.15, why: "" },
  "4xl": { value: 1.1, why: "page titles" },
  "5xl": { value: 1.05, why: "the hero, one line, never wrapped on desktop" },
};

/** The geometric size of a step, before overrides, in rem. */
function geometric(index: number): number {
  return Math.pow(RATIO, index - BASE_INDEX);
}

/** The size actually shipped, in rem. */
function sized(step: (typeof STEPS)[number], index: number): number {
  return OVERRIDES[step] ?? geometric(index);
}

/** Round for CSS. Four places is past the point any renderer can tell the difference. */
const r = (n: number) => String(Number(n.toFixed(4)));

/**
 * A `clamp()` that walks from the step below at 360px to the full size at 1280px.
 *
 * The floor is deliberately the previous step rather than an invented number: it means a fluid
 * heading on a phone is exactly the size the step below it would have been, so the scale still
 * reads as the scale at every width.
 *
 * It reads that step's **shipped** size rather than dividing by `RATIO`. The two are the same
 * number everywhere except above a hand-adjusted step, and that is precisely where the
 * difference matters: `5xl` is rounded up to 3rem, so `3 / 1.2` is 2.5rem while `4xl` actually
 * ships at 2.4883rem. Dividing would have put the phone-width hero 0.5% above a step that
 * exists, which is not a step and not the step below — a value belonging to nothing, of the kind
 * this whole file exists to stop. `scale.test.ts` pins it.
 */
function fluid(index: number): string {
  const max = sized(STEPS[index], index);
  const min = sized(STEPS[index - 1], index - 1);
  const slopeVw = ((max - min) / (FLUID_MAX_VW - FLUID_MIN_VW)) * 100;
  const intercept = min - ((max - min) / (FLUID_MAX_VW - FLUID_MIN_VW)) * FLUID_MIN_VW;
  return `clamp(${r(min)}rem, ${r(intercept)}rem + ${r(slopeVw)}vw, ${r(max)}rem)`;
}

/* ===========================================================================================
   SPACE — V4 §1.7 (Q127, Q137)
   =========================================================================================== */

/**
 * Eight values, every one a multiple of 4px (Q127 "restricted subset of eight", Q137 "4-point").
 *
 * Tailwind's numeric spacing utilities (`p-3`, `gap-5`, …) still exist and still work — they
 * cannot be removed without editing every layout in the app, and doing that is not what §1.7
 * is worth. What this buys is a **named** vocabulary that new code and every reworked component
 * uses, so the reason for a gap is in its name rather than in whichever number looked right
 * that afternoon. DESIGN.md §5 carries the rule; this is the list.
 *
 * The jump from 16 to 24 and again to 48 is intentional: an even 4-8-12-16-20-24-28-32 ramp has
 * eight values and no opinion, and the gaps that actually recur in this app are "inside a
 * control", "inside a card", "between cards" and "between sections".
 */
const SPACE: Array<[name: string, px: number, why: string]> = [
  ["3xs", 4, "hairline gap — icon to its own label"],
  ["2xs", 8, "inside a control"],
  ["xs", 12, "between rows of a list"],
  ["sm", 16, "inside a card — the default padding of the md card size"],
  ["md", 24, "between cards in a grid"],
  ["lg", 32, "inside a large card, and between a heading and its content"],
  ["xl", 48, "between sections on a private screen"],
  ["2xl", 64, "between sections on the public site, which breathes more"],
];

/* ===========================================================================================
   RADIUS — V4 §1.7 (Q152)
   =========================================================================================== */

/**
 * Radius scales with the size of the thing (Q152).
 *
 * `--radius` and its `sm`/`md`/`lg`/`xl`/`2xl`… multipliers already existed in `globals.css`
 * and nothing used them, which is the usual fate of a scale with no names attached to real
 * objects. These are those names. The multipliers are kept as they were so nothing that does
 * reach for `rounded-lg` changes underneath it.
 *
 * Square corners are a deliberate absence: tables and the resume sheet have none (DESIGN.md
 * §6), so there is no token for them — `rounded-none` says it better than `--radius-flat`.
 */
const RADIUS: Array<[name: string, multiplier: number, why: string]> = [
  ["control", 0.6, "buttons, inputs, chips that are not pills"],
  ["card", 1.0, "the base — a card, a panel, a menu"],
  ["panel", 1.4, "large surfaces: the sheet body, a modal"],
  ["sheet", 1.8, "the bottom sheet's top corners, where the radius reads as a handle"],
];

/* ===========================================================================================
   BREAKPOINTS — V4 §1.7 (Q143, Q144)
   =========================================================================================== */

/**
 * One set, under two spellings, and a test that pins them together.
 *
 * Q143's complaint is real: the app mixes `sm:`, `min-[380px]:`, a raw `@media (width < 40rem)`
 * and `lg:`. Two of those four are gone after §1.7 — `min-[380px]` had two call sites and both
 * are now `phone:`, and the raw media queries in `globals.css` are the nav switch, which cannot
 * use a custom property because CSS does not allow one in a media condition.
 *
 * That last constraint is why `PHONE_REM` is exported in a comment the test reads: the literal
 * `40rem` has to appear in `globals.css` by hand, so a test asserts the two agree rather than
 * hoping. See `scale.test.ts`.
 *
 * Tailwind's `sm`/`md`/`lg`/`xl` are redeclared here at **identical values** rather than
 * removed. Removing them is a 400-call-site edit for no behaviour change; redeclaring them
 * means both spellings are defined in this file, so "one set" is true of the source even though
 * two names reach it.
 */
const PHONE_REM = 40;
const BREAKPOINTS: Array<[name: string, rem: number, alias: string | null, why: string]> = [
  // Reinstated 2026-09-10 for V4 item 6.3 (D-216), and it is not a reversal of §1.7. What §1.7
  // objected to was `min-[380px]` as an *arbitrary* value written at two call sites; the line
  // itself is real, and Q42 asks for it by name — under it the wordmark is dropped and the mark
  // stands alone, because the nav wins the space fight against a nine-character name at 360px.
  // Naming it is what makes "one set, under two spellings" true of this line too.
  ["cramped", 23.75, null, "Q42 — the wordmark drops and the mark stands alone below this"],
  ["phone", PHONE_REM, "sm", "the line the app already uses: nav switch, ambient drift"],
  ["tablet", 48, "md", "Q143 — tablet gets its own treatment, not desktop's"],
  ["laptop", 64, "lg", "the sidebar's natural width appears here"],
  ["desktop", 80, "xl", "the width `npm run shots` treats as desktop"],
  ["wide", 96, "2xl", "§7.1 adds a 1440 sweep; this is the step above it"],
];

/* ===========================================================================================
   MOTION — V4 §1.8 (Q185–Q189)
   =========================================================================================== */

const DURATIONS: Array<[name: string, ms: number, why: string]> = [
  ["fast", 150, "Q185 — hover, focus, toggle, and the press state"],
  ["medium", 250, "Q186 — a panel or sheet opening"],
  ["slow", 350, "Q187 — a route or a full overlay"],
];

/**
 * Three curves (Q188). Standard is kept exactly as it was (Q189) — it is on every transition in
 * the app already and changing it would be a redesign disguised as a token.
 *
 * Entrance decelerates and exit accelerates, which is the standard asymmetry: a thing arriving
 * should settle, a thing leaving should get out of the way.
 */
const EASINGS: Array<[name: string, curve: string, why: string]> = [
  ["standard", "cubic-bezier(0.22, 0.72, 0.28, 1)", "Q189 — unchanged, and already everywhere"],
  ["entrance", "cubic-bezier(0, 0, 0.2, 1)", "decelerate: arrives fast, settles"],
  ["exit", "cubic-bezier(0.4, 0, 1, 1)", "accelerate: leaves without being watched"],
];

/* ===========================================================================================
   ICONS — V4 §1.9 (Q213, Q214)
   =========================================================================================== */

/**
 * Three sizes (Q214), and they are `rem` rather than `px` so they scale with OS text size —
 * §7.4 audits the app for exactly this, and an icon set frozen in pixels beside text that grows
 * is the thing that audit is going to find.
 */
const ICONS: Array<[name: string, rem: number, why: string]> = [
  ["sm", 1, "16px — inline with `xs`/`sm` text"],
  ["md", 1.25, "20px — the default, and what the tab bar uses"],
  ["lg", 1.5, "24px — a lone icon carrying a whole control"],
];

/** Q213. lucide ships 2, which is heavy beside Instrument Sans at these sizes. */
const ICON_STROKE = 1.75;

/* ===========================================================================================
   EMIT
   =========================================================================================== */

const lines: string[] = [
  "/*",
  " * GENERATED by scripts/build-scale.mts — do not edit.",
  " *",
  " * Type, space, radius, breakpoints, motion and icon sizes. Everything here is identical in",
  " * every theme; anything that varies per theme is in `tokens.css`, from the other generator.",
  " *",
  " * `npm run scale:check` fails if this file is stale, and the test suite runs that check.",
  " *",
  ` * Written ${new Date().toISOString().slice(0, 10)}.`,
  " */",
  "",
  "@theme {",
];

/* --- type ------------------------------------------------------------------------------- */
lines.push(
  `  /* ---- Type · nine steps, modular ${RATIO}, anchored at base = 1rem (V4 §1.5) ----`,
  "   *",
  "   * Each step carries its own leading and tracking, so `text-lg` is a complete typographic",
  "   * decision rather than a size that still needs two more classes. Prose overrides leading",
  "   * with `leading-*`; nothing should override tracking. */",
);
for (const [i, step] of STEPS.entries()) {
  const value = sized(step, i);
  const geo = geometric(i);
  const isFluid = i >= FLUID_FROM;
  const px = (value * 16).toFixed(2);
  const override = OVERRIDES[step] !== undefined;
  const note = override
    ? `${px}px · hand-adjusted from ${(geo * 16).toFixed(2)}px (Q101)`
    : `${px}px${isFluid ? ` at ${FLUID_MAX_VW}rem, ${((value / RATIO) * 16).toFixed(2)}px at ${FLUID_MIN_VW}rem` : ""}`;
  const track = TRACK_MAX + ((TRACK_MIN - TRACK_MAX) * i) / (STEPS.length - 1);
  lines.push(
    "",
    `  /* ${step}: ${note}${LEADING[step].why ? ` — ${LEADING[step].why}` : ""} */`,
    `  --text-${step}: ${isFluid ? fluid(i) : `${r(value)}rem`};`,
    `  --text-${step}--line-height: ${LEADING[step].value};`,
    `  --text-${step}--letter-spacing: ${r(track)}em;`,
  );
}

/**
 * Uppercase is tracked as a property of being uppercase, not of being small (Q116, Q117).
 *
 * 0.12em, down from the 0.16–0.18em scattered through the app today. This is a separate token
 * from the per-step tracking above because an uppercase label at `xs` needs both: the step's
 * optical tracking is for lowercase text at that size, and caps need more on top of it.
 */
lines.push(
  "",
  "  /* ---- Uppercase tracking (V4 §1.6, Q117) ----",
  "   * One value, replacing 0.14/0.16/0.18em picked per call site. Used by the `eyebrow`",
  "   * utility and by anything else that sets `uppercase`. */",
  "  --tracking-caps: 0.12em;",
);

/* --- radius ----------------------------------------------------------------------------- */
lines.push("", "  /* ---- Radius · scales with the size of the thing (V4 §1.7, Q152) ---- */");
for (const [name, multiplier, why] of RADIUS) {
  lines.push(`  --radius-${name}: calc(var(--radius) * ${multiplier});  /* ${why} */`);
}
lines.push("  --radius-pill: 9999px;  /* chips and badges only — DESIGN.md §6 */");

/* --- elevation -------------------------------------------------------------------------- */
lines.push(
  "",
  "  /* ---- Elevation · four levels (V4 §1.7, Q156) ----",
  "   *",
  "   * The names live here so Tailwind emits `shadow-rest` … `shadow-overlay`. The values do",
  "   * not: elevation is a ground-shift plus a border in dark themes and a real shadow in light",
  "   * ones (DESIGN.md §6), so `--elevation-*` is written per theme by `build-tokens.mts`. */",
  "  --shadow-rest: var(--elevation-rest);",
  "  --shadow-raised: var(--elevation-raised);",
  "  --shadow-floating: var(--elevation-floating);",
  "  --shadow-overlay: var(--elevation-overlay);",
);

/* --- breakpoints ------------------------------------------------------------------------ */
lines.push(
  "",
  "  /* ---- Breakpoints · one set, two spellings (V4 §1.7, Q143/Q144) ----",
  "   *",
  "   * The named half is what new code uses. Tailwind's letters are redeclared at the same",
  "   * values because 400+ call sites spell them that way; a test pins each pair together, so",
  "   * they cannot drift into being two sets. */",
);
for (const [name, rem, alias, why] of BREAKPOINTS) {
  lines.push(`  --breakpoint-${name}: ${rem}rem;  /* ${rem * 16}px — ${why} */`);
  if (alias) lines.push(`  --breakpoint-${alias}: ${rem}rem;  /* = ${name} */`);
}

/* --- motion ----------------------------------------------------------------------------- */
lines.push(
  "",
  "  /* ---- Motion · three durations, three easings (V4 §1.8, Q185–Q189) ----",
  "   *",
  "   * `--ease-*` is one of Tailwind's namespaces, so `ease-standard` and friends are generated",
  "   * from these declarations. `--duration-*` is **not** a namespace — Tailwind's `duration-*`",
  "   * utility takes a bare number — so the three named durations get explicit `@utility` blocks",
  "   * below. Without them `duration-fast` is silently no CSS at all, which is the same class of",
  "   * failure as an interpolated class name: the element still renders, just untransitioned. */",
);
for (const [name, ms, why] of DURATIONS) {
  lines.push(`  --duration-${name}: ${ms}ms;  /* ${why} */`);
}
for (const [name, curve, why] of EASINGS) {
  lines.push(`  --ease-${name}: ${curve};  /* ${why} */`);
}

/* --- icons ------------------------------------------------------------------------------ */
lines.push("", "  /* ---- Icons (V4 §1.9, Q213/Q214) ---- */");
for (const [name, rem, why] of ICONS) {
  lines.push(`  --icon-${name}: ${rem}rem;  /* ${why} */`);
}
lines.push(`  --icon-stroke: ${ICON_STROKE};  /* Q213 — lucide ships 2 */`);

lines.push("}", "");

/**
 * Space — declared outside `@theme`, and that is the whole point (D-219).
 *
 * These eight values used to sit in the `@theme` block above with the rest of the scale, which
 * looked right and was wrong. `--spacing-*` is one of Tailwind's namespaces, and it is the
 * namespace `max-w-*`, `w-*`, `min-w-*` and `basis-*` consult **before** `--container-*`. So
 * declaring `--spacing-sm: 1rem` did not merely add a `p-sm` utility — it silently redefined
 * `max-w-sm` from Tailwind's 24rem to 1rem, `max-w-2xl` from 42rem to 4rem, and so on for every
 * name this scale happens to share with a container size.
 *
 * The damage was invisible in code review and total on screen: `/private/settings` rendered its
 * entire content inside a 64-pixel column, one word per line, and the "update available" notice,
 * the sign-in card, the register card and both error screens were the same shape. Nothing threw,
 * no test failed, and the class names all read correctly.
 *
 * Here in `:root` the values are unchanged and `var(--spacing-md)` still resolves everywhere, so
 * DESIGN.md §5 stays true and the vocabulary survives — what is given up is Tailwind emitting
 * `p-sm` / `gap-md` utilities from them, which had **zero call sites** in the app at the time
 * this was found. That is the trade: a naming convenience nobody had used, against six screens.
 *
 * To reverse it, move this loop back inside the `@theme` block — and rename the steps first, to
 * anything that is not also a container size, or the six screens break again the same way.
 * `scale.test.ts` fails if `--spacing-*` reappears inside `@theme`.
 */
lines.push(
  "/* ---- Space · eight values, all multiples of 4px (V4 §1.7, Q127/Q137) ----",
  " *",
  " * Deliberately NOT in `@theme` — see the note in `scripts/build-scale.mts` and D-219.",
  " * `--spacing-*` is the namespace `max-w-*` reads first, so naming a space step `sm` or `2xl`",
  " * overwrites `max-w-sm` and `max-w-2xl` for the whole app. Use these as `var(--spacing-md)`. */",
  ":root {",
);
for (const [name, px, why] of SPACE) {
  lines.push(`  --spacing-${name}: ${r(px / 16)}rem;  /* ${px}px — ${why} */`);
}
lines.push("}", "");

/**
 * Icon size utilities.
 *
 * `--icon-*` is not one of Tailwind's namespaces, so `@theme` alone publishes the custom
 * properties but generates no classes. Three `@utility` blocks are cheaper than
 * `size-[var(--icon-md)]` at every call site, and they set `flex-shrink` because an icon in a
 * flex row beside a long label is the one place SVGs squash.
 */
for (const [name] of ICONS) {
  lines.push(
    `@utility icon-${name} {`,
    `  width: var(--icon-${name});`,
    `  height: var(--icon-${name});`,
    "  flex-shrink: 0;",
    "}",
    "",
  );
}

/**
 * Named duration utilities.
 *
 * Tailwind v4's `duration-*` utility resolves a bare number (`duration-150`) or an arbitrary
 * value; there is no `--duration-*` theme namespace to hang names off. These three blocks are
 * what make `duration-fast` mean something. Writing `duration-150` at call sites instead would
 * work and is exactly what §1.8 is replacing: three magic numbers scattered through the app
 * rather than three names that can be re-timed in one place.
 */
lines.push("/* Named durations — see the note in the `@theme` block above. */");
for (const [name] of DURATIONS) {
  lines.push(
    `@utility duration-${name} {`,
    `  transition-duration: var(--duration-${name});`,
    "}",
    "",
  );
}

/**
 * The stroke width, applied once.
 *
 * lucide-react renders `stroke-width` as an SVG **presentation attribute**, and CSS beats a
 * presentation attribute in the cascade — so one rule on the class lucide already puts on every
 * icon is the whole of Q213. The alternative was passing `strokeWidth={1.75}` to every icon in
 * the app and remembering to on every new one.
 */
lines.push(
  "/* Q213, applied once. lucide sets stroke-width as a presentation attribute, which CSS",
  " * outranks — so this reaches every icon without touching a call site. */",
  ".lucide {",
  `  stroke-width: var(--icon-stroke);`,
  "}",
  "",
);

const css = lines.join("\n");

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  // The date line changes every day and means nothing; compare everything else.
  const strip = (s: string) => s.replace(/^ \* Written \d{4}-\d{2}-\d{2}\.$/m, "");
  if (strip(current) !== strip(css)) {
    console.error("scale.css is stale. Run: npm run scale");
    process.exit(1);
  }
  console.log("scale.css is up to date.");
} else {
  writeFileSync(OUT, css, "utf8");
  console.log(`Wrote ${OUT}\n`);
  console.log(`  Type — ${STEPS.length} steps, ratio ${RATIO}, base = 1rem`);
  for (const [i, step] of STEPS.entries()) {
    const value = sized(step, i);
    const flags = [
      i >= FLUID_FROM ? "fluid" : "stepped",
      OVERRIDES[step] !== undefined ? "hand-adjusted" : "",
    ]
      .filter(Boolean)
      .join(", ");
    console.log(
      `    text-${step.padEnd(5)} ${(value * 16).toFixed(2).padStart(6)}px   lh ${LEADING[step].value}   ${flags}`,
    );
  }
  console.log(`\n  Space — ${SPACE.length} values: ${SPACE.map(([, px]) => px).join(", ")}px`);
  console.log(`  Breakpoints — ${BREAKPOINTS.map(([n, rem]) => `${n} ${rem * 16}`).join(", ")}px`);
}
