---
updated: 2026-09-09
domain: engineering
stability: volatile
summary: The design system of record — tokens, type, space, motion, and the rules that govern them.
read_when: Changing anything visual, or adding a component.
---

# 2ndMind — Design System

**Status: the system is complete. Milestone A.** Created in V4 Phase 0 (2026-09-06); §3 filled
by Phase 1.1–1.4 (2026-09-07); type, space, surface, motion, icons, the component set and the
gates filled by Phase 1.5–1.12 (2026-09-08). No section is `PENDING` any more except the two
that belong to a later phase and say so.

**Two files are generated and must not be hand-edited.** `src/app/tokens.css` comes from
`scripts/build-tokens.mts` (colour, per theme) and `src/app/scale.css` from
`scripts/build-scale.mts` (everything else that is a number). `npm run tokens` and
`npm run scale` write them; `tokens:check` and `scale:check` fail when they are stale, and the
test suite runs both. Edit a generator, never its output.

Three documents, three jobs:

| File | Answers |
|---|---|
| `context/00_meta/brand_and_voice.md` | *Why* — brand, palette reasoning, the mark |
| **`web/DESIGN.md`** (this) | *What* — the tokens and the rules for using them |
| `web/DECISIONS.md` | *When and how to undo* — dated log, one entry per choice |

Three stylesheets, and which one a value lives in is decided by one question — *does it vary per
theme?*

| File | Holds | Written by |
|---|---|---|
| `src/app/tokens.css` | Colour, elevation, the scrim — everything per theme | `build-tokens.mts` |
| `src/app/scale.css` | Type, space, radius, breakpoints, motion, icons | `build-scale.mts` |
| `src/app/globals.css` | Base layer, the ambient ground, the utilities, print | by hand |

Where a generated file and this document disagree, **the generator is right** and the CSS needs a
`npm run tokens` or `npm run scale`. Where `globals.css` and this document disagree, the CSS is
right and this file needs a commit.

---

## 1. The thesis

> **An instrument, not a document.** Every screen should say what it knows in the fewest
> pixels that can carry it, and every screen you can act on should show you the action before
> it shows you the data.

Every rule below serves it. A change that cannot be argued from it is decoration.

---

## 2. Standing rules

These hold across every token, component and screen. They are the ones broken by accident.

1. **Colour never signals alone.** Every colour signal is doubled with an icon, a word, or a
   weight. A red row and a green row must still be distinguishable in greyscale.
2. **Mono is real data only** — dates, splits, PRs, counts, file paths. Not nav labels, not
   eyebrows, not tab bars. If it is not a number, a date, or a path, it is not mono.
3. **Steel is structural and never interactive.** Nothing clickable is steel.
4. **Peach/amber means attention, and nothing else** (D-196, changed 2026-09-08). It used to
   read "the single warm note — eyebrows and emphasis". That made it decoration and a signal at
   once, and since `--highlight` is hue 70 in *every* theme, the decorative half was pinned to
   orange no matter which theme was applied. Eyebrows take `--primary`. Amber is for stale data,
   an unsent queue, low filament, a missed target.
5. **Every text token clears 4.5:1** against the surface behind it, including the
   tertiary/metadata level. Body text clears 7:1.
6. **No raw hex outside the token file.** Components take colour from tokens, so a theme that
   does not exist yet still works.
7. **Actionable before descriptive.** On any screen you can act on, the control comes above
   the numbers and prose describing it. The one marked `data-first-action` is what the gate
   measures.
8. **No entrance animation above the fold, ever** (D-171 — it cost ~900ms of FCP).
9. **Max one primary button per screen.**
10. **Hover is not an affordance on touch.** Anything revealed only by hover must have a
    non-hover path, or be decorative. See §9.

---

## 3. Colour

Two palettes, one per theme. Reasoning and contrast measurements are in
`brand_and_voice.md` §3; this section is the token contract.

### 3.1 Roles

Every theme defines all of these. A theme missing one fails the token test (V4 §1.12).

| Token | Role |
|---|---|
| `--background` | Page ground |
| `--surface` | Card / panel ground |
| `--raised` | The level above a card — **new in V4**, replaces ad-hoc `bg-accent/70` |
| `--foreground` | Body text |
| `--muted-foreground` | Secondary text |
| `--faint-foreground` | Tertiary / metadata — **new in V4**. Still clears 4.5:1 |
| `--primary` / `--primary-foreground` | Lead accent, and text on a filled accent |
| `--secondary` / `--secondary-foreground` | Steel. Structure and data |
| `--highlight` | Attention — stale, waiting, running low. **Never decoration** (D-196) |
| `--success` | **New in V4** — completion, met targets |
| `--warning` | **New in V4** — attention, not failure |
| `--destructive` | Failure and deletion. Shifted toward orange-red so it is not read as the magenta accent |
| `--border` / `--input` | Lines |
| `--ring` | Focus. **A dedicated value**, not the primary — it has to survive on a filled primary button |
| `--chart-1` … `--chart-5` | Categorical series. A separate ramp handles ordered data |

**Done (V4 §1.1, D-194).** Values live in `src/app/tokens.css`, **generated** by
`scripts/build-tokens.mts`. Every colour is *solved for a contrast ratio* rather than chosen and
then checked — declare "teal, at whatever lightness clears 5.4:1 on a card" and the solver
returns it. Edit the generator, never the CSS; `npm run tokens` writes it and
`npm run tokens:check` fails when it is stale.

Two rules produce the values, and they differ because the tokens are used differently:

- **Text solves against the worst ground** — `raised` on a dark theme, `background` on a light
  one. Solving against the page ground alone is how a faint grey passed at 4.61:1 and then sat
  on a card at 4.07:1.
- **Accents solve against `surface`**, the card they are on almost everywhere. Holding them to
  `raised` too drove the magenta to `#e981bc`, a pale pink.

The **50–950 primary ramp** exists as the deterministic replacement for `bg-primary/10` and the
~300 other opacity utilities: compositing an accent over a card gives a different colour on
every ground, a ramp step is the same colour everywhere. **Migrated screen by screen**, not in
one pass — the utilities still work.

*(The plan said "forty scattered `color-mix()` calls". There were nine. The scattering was in
the opacity utilities all along.)*

### 3.2 Themes

**Done (V4 §1.2, D-194).** Five themes ship, listed in `src/lib/theme/registry.ts`:

| id | Scheme | Ground | What it is |
|---|---|---|---|
| `dark-magenta` | dark | `#12090d` | V2's identity, re-tuned |
| `light-teal` | light | `#eef4f4` | The light theme. Teal on warm paper |
| `hc-dark` | dark | `#030303` | Every colour clears 7.5:1. Also what `prefers-contrast: more` selects |
| `carbon` | dark | `#0e0e0e` | **The default.** Hueless near-black, cyan accent |
| `steel-light` | light | `#f2f5f8` | Experimental. Steel as the accent — a deliberate test of the "steel is never interactive" rule |

**One attribute.** `next-themes` writes `data-theme` on `<html>` and nothing else. Tailwind's
`dark:` variant is a selector list over the dark-family themes, **generated into `tokens.css`**,
so adding a theme is one spec in the generator plus one registry entry — no component edits.

A runtime `data-scheme` attribute was the first design and was dropped: a second pre-hydration
script alongside next-themes' can land a frame late, and every `dark:` utility then renders its
light branch on a dark ground. Anything that varies by *scheme* rather than by theme — the
ambient pools, the grain — is a **token** (`--ambient-opacity`, `--grain-opacity`), which is
right on the first painted frame.

`enableSystem` resolves the OS preference to the literal strings `light` and `dark`, so those
two themes are *named* that and mapped onto their ids by next-themes' `value` prop.

Public offers light / dark / system and is **pinned to `DEFAULT_THEME`** — Carbon since D-197,
so the portfolio is hueless black with a cyan accent — with a toggle that lifts the pin for the
current visit only, never writing to storage, so a visitor cannot change Victor's app (D-184,
extended by Q87). The full five-theme picker lives in private settings (Phase 4.4).

---

## 4. Typography

Three faces, self-hosted in `src/app/fonts/`. **Do not add a fourth.**

| Role | Face | Weights |
|---|---|---|
| Display | Bricolage Grotesque (variable 200–800) | Headings only |
| Body | Instrument Sans | 400 / 500 / 600 |
| Data | IBM Plex Mono | 400 / 500 / 600 |

No italics — the files are deliberately not loaded.

### The scale — **done (V4 §1.5, D-199)**

Nine steps, modular **1.2**, anchored at `base = 1rem`. **Generated** by
`scripts/build-scale.mts` into `src/app/scale.css` — edit the generator, never the CSS;
`npm run scale` writes it and `npm run scale:check` fails when it is stale.

It redefines Tailwind's own nine size names rather than adding a tenth vocabulary. Those nine
are exactly the nine in use across 466 call sites, so every existing `text-sm` became
scale-correct with no migration. Each step carries its own leading and tracking, which is what
makes `text-lg` a complete typographic decision rather than a size that still needs two more
classes.

| Step | Size | Leading | Tracking | |
|---|---|---|---|---|
| `text-5xl` | 48.00px | 1.05 | −0.030em | fluid · hand-adjusted from 47.77px |
| `text-4xl` | 39.81px | 1.10 | −0.025em | fluid |
| `text-3xl` | 33.18px | 1.15 | −0.020em | fluid |
| `text-2xl` | 27.65px | 1.22 | −0.015em | fluid |
| `text-xl` | 23.04px | 1.30 | −0.010em | stepped |
| `text-lg` | 19.20px | 1.40 | −0.005em | stepped |
| `text-base` | 16.00px | 1.55 | 0 | stepped · **the anchor** |
| `text-sm` | 13.33px | 1.50 | +0.005em | stepped · 228 call sites |
| `text-xs` | 12.00px | 1.45 | +0.010em | stepped · hand-adjusted from 11.11px |

Five things that are load-bearing:

- **`base` is exactly 1rem.** Not a typographic argument — `rem` arithmetic everywhere else
  assumes the root size, and anchoring at the bottom of the scale gave `0.99rem`, putting every
  hand-checked "16px" measurement permanently off by a sixth of a pixel.
- **Two hand-adjustments, one at each end** (Q101 permits exactly that). `5xl` rounds up to a
  flat 48px. `xs` is lifted from the geometric 11.11px to **12px** — it cleared §7.1's coming
  11px gate either way, but only by 0.11px, while taking the app's smallest text *down* from
  Tailwind's default across 161 call sites, in a codebase whose measured problem is that too
  much of its text is small. Measured with `npm run shots`: **157** sub-12px elements per width
  at 11.11px against a 68 baseline, **53** at 12px.
- **The cost of that is the one number the generator cannot hide:** `xs → sm` is 1.111, not 1.2.
  `scale.test.ts` excludes exactly the pairs touching an adjusted step and separately asserts
  that adjustments only ever happen at the two ends.
- **`2xl` and up are fluid**, floored at *the step below*, so the scale still reads as the scale
  at 360px. The floor reads the previous step's shipped size, not `size ÷ ratio` — above the
  adjusted `5xl` those differ, and dividing produced a value belonging to no step at all.
- **Leading is a table, not a formula.** Every curve tried had at least one visibly wrong step,
  and the generator says so rather than fitting one to hide it. These are the **UI** defaults;
  prose overrides with `leading-*`, because the same `text-sm` is a form label on one screen and
  a paragraph on another.

### Mono — **evicted from four surfaces (V4 §1.6, D-198)**

Mono has left nav labels, eyebrows, the tab bar and panel meta. **246 occurrences → 186**, and
53 eyebrow call sites across 30 files collapsed onto one utility.

Use **`eyebrow`** for the small tracked uppercase label. It sets the body face, `--text-xs`,
weight 500 and `--tracking-caps`. It deliberately sets **no colour**: the same shape is
`--primary` above a page title (D-196) and `--muted-foreground` on a stat label, so baking one
in would either re-break D-196 or force every stat label to override it.

It replaced six sizes and six trackings for one idea — `text-[0.55rem]` through `text-[0.65rem]`,
tracked anywhere from `0.1em` to `0.18em`. The tab bar's 8.8px labels, which D-190 found were
never measured by anything, are part of that and are now 12px.

**The remaining 186 are an audit, not a backlog to clear blindly.** Most are correct: dates,
splits, PRs, counts and paths *are* data. Judge them screen by screen in Phases 4–6, the way §3.1
handles the ~300 opacity utilities. Heaviest first:

| Count | File | Likely verdict |
|---|---|---|
| 14 | `app/private/athletics/page.tsx` | mostly splits and dates — keep |
| 10 | `components/site/log-form.tsx` | field labels — **evict in §5.2** |
| 9 | `components/site/training-panels.tsx` | sets and weights — keep |
| 8 | `components/site/course-planner.tsx` | unit counts and grades — mixed |
| 7 | `task-list`, `log-console`, `filament-panel`, `resume/[variant]` | mixed |
| 6 | `printer-panel`, `chart` | axes and printer state — keep |
| ≤5 | 49 further files | judge in place |

The 53 sub-12px elements `npm run shots` still reports are the *other* half of the same job —
arbitrary sizes at 9.9px, 10.4px and 11.2px on `/projects`, `/projects/[slug]` and the resume
screen that are not eyebrows and were left for §6.5, §6.6 and §6.8.

Settled now:
- Line length: **58ch** for prose.
- Line height: **1.6** public prose, **1.45** private UI.
- Uppercase tracking: **0.12em**, and uppercase used roughly half as much as it is today.
- `text-wrap: balance` on headings, `pretty` on ledes.
- Tabular figures anywhere a number can change in place — automatic inside `Stat`, tables and
  charts rather than applied by hand.

---

## 5. Space and layout

### The spacing vocabulary — **done (V4 §1.7, D-199; narrowed by D-219)**

Eight values, every one a multiple of 4px (Q127, Q137). Generated into `scale.css`, and read as
`var(--spacing-md)` — **not** as `p-md` or `gap-md`, which is the part that changed.

| Token | | Use |
|---|---|---|
| `--spacing-3xs` | 4px | hairline gap — an icon to its own label |
| `--spacing-2xs` | 8px | inside a control |
| `--spacing-xs` | 12px | between rows of a list |
| `--spacing-sm` | 16px | inside a card — the padding of the `md` card size |
| `--spacing-md` | 24px | between cards in a grid |
| `--spacing-lg` | 32px | inside a large card, and heading to content |
| `--spacing-xl` | 48px | between sections on a private screen |
| `--spacing-2xl` | 64px | between sections on the public site, which breathes more |

The jumps from 16→24 and 32→48 are deliberate. An even 4-8-12-16-20-24-28-32 ramp has eight
values and no opinion; the gaps that actually recur here are "inside a control", "inside a card",
"between cards" and "between sections".

**These are custom properties, not Tailwind utilities — and that is a correction (D-219).**
They were declared inside `@theme`, which generated `p-sm` / `gap-md` and friends. It also did
something nobody intended: `--spacing-*` is the namespace Tailwind's `max-w-*`, `w-*` and
`min-w-*` consult **before** `--container-*`, so naming a space step `sm` or `2xl` silently
redefined `max-w-sm` and `max-w-2xl` for the whole app — `max-w-2xl` went from 42rem to 4rem.
`/private/settings` rendered its entire content inside a 64-pixel column, and so did five other
screens, with every class name reading correctly and no test failing.

They now live in a `:root` block. The values and the vocabulary are unchanged and
`var(--spacing-md)` still resolves everywhere; what is given up is the generated utilities, which
had **zero call sites**. `scale.test.ts` fails if any `--spacing-*` reappears inside `@theme`.

**Tailwind's numeric utilities still work.** `p-3` and `gap-5` cannot be removed without editing
every layout in the app, and doing that is not what §1.7 is worth. What the vocabulary buys is
that new code and every reworked component say *why* a gap is the size it is — as
`gap-[var(--spacing-md)]` where it matters, or as a comment. §7.1 is where a gate could be added.

**Two width utilities on one element is the related trap.** A shared class constant carrying
`w-full` composed with a call site adding `w-24` is not an override: same specificity, so the
winner is Tailwind's emit order. Keep the width out of the shared constant.
`width-conflicts.test.ts` enforces it; `scripts/diag-widths.mjs` measures the result in a real
browser, because jsdom reports every element as zero pixels wide and cannot see any of this.

### Breakpoints — **done (V4 §1.7, D-199)**

One set, under two spellings, with a test pinning each pair.

| Name | | Tailwind alias |
|---|---|---|
| `phone` | 40rem / 640px | `sm` |
| `tablet` | 48rem / 768px | `md` |
| `laptop` | 64rem / 1024px | `lg` |
| `desktop` | 80rem / 1280px | `xl` |
| `wide` | 96rem / 1536px | `2xl` |

Q143's complaint was four spellings of the same idea. Two are gone: `min-[380px]` had two call
sites and both are now `phone:`. The letters are redeclared in the generator at identical values
rather than removed, because removing them is a 400-call-site edit for no behaviour change —
both spellings are therefore defined in one file, and `scale.test.ts` asserts each pair agrees.

**The one thing that cannot be a token.** CSS does not allow a custom property in a media
condition, so `globals.css` spells `40rem` out by hand for the nav switch and the ambient drift.
`scale.test.ts` reads every `@media (width …)` in that file and asserts it equals
`--breakpoint-phone`. Do not "tidy" that test away — it is the only thing that notices when one
of the two literals is changed and the other is not.

Settled now:

- **Three content widths**, named: prose / content / wide. The private app is narrower than
  the public site; a form at 64rem is unreadable. *(Still to build.)*
- **Card size vocabulary** — `sm` / `md` / `lg`, done in `ui/card.tsx` (§1.10). `md` is the
  default and its padding is `--spacing-sm`. The app's own `p-6` / `p-5` / `p-4` call sites
  migrate in Phases 4–6.
- **Grids use `auto-fit` / `minmax`**, not fixed breakpoint column counts.
- Safe-area insets on the bottom bar, and left/right in landscape.

---

## 6. Surface and depth

### Elevation — **done (V4 §1.7, D-199)**

Four levels (Q156), used as `shadow-rest` / `shadow-raised` / `shadow-floating` /
`shadow-overlay`.

| Level | Dark schemes | Light schemes | Use |
|---|---|---|---|
| `rest` | `none` | `none` | A card at rest. Separated by its ground, not by a shadow. |
| `raised` | 1px ring | `0 1px 2px` | A card, a panel, anything above the page. |
| `floating` | ring + soft drop | two-layer shadow | A toast, a popover, a menu. |
| `overlay` | ring + deep drop | two-layer shadow | A sheet or a modal. |

**The names are in `scale.css` and the values are in `tokens.css`, per theme.** This is the one
non-colour scale that is not the same in every theme, because elevation is a ground-shift plus a
border in dark and a real shadow in light — the main structural difference between the two
schemes. Do not flatten the indirection: `shadow-raised` would become one shadow for five themes.

Every value is `color-mix`ed from the theme's own tokens, never written as a literal, so a new
theme gets a correct elevation scale for nothing. `tokens.test.ts` asserts that per theme, and
asserts that dark themes elevate with a ring and light themes with an offset.

**`rest` is `none` on purpose and is not a gap.** The token exists so a component can say
"explicitly flat" rather than leaving `box-shadow` unset.

### The scrim — **new (V4 §1.10, D-200)**

`--scrim`, per theme, used as `bg-scrim`. Behind a sheet or a modal.

It is here because it is the one token where getting the scheme wrong is invisible in review. A
scrim has to *darken*. `bg-black/10` — which is what the vendored `sheet.tsx` shipped with —
darkens paper and does nothing at all over a near-black ground, where the thing it is dimming is
already darker than the scrim. Dark themes deepen toward their own background; light themes
toward their own foreground; a test per theme asserts the direction.

### Radius — **done (V4 §1.7, D-199)**

Base is `0.625rem` and it **scales with the size of the thing** (Q152), which the multipliers
always allowed and nothing used until these names existed.

| Token | | Use |
|---|---|---|
| `rounded-control` | ×0.6 | buttons, inputs, chips that are not pills |
| `rounded-card` | ×1.0 | a card, a panel, a menu |
| `rounded-panel` | ×1.4 | large surfaces: a sheet body, a modal |
| `rounded-sheet` | ×1.8 | a bottom sheet's top corners, where the radius reads as a handle |
| `rounded-pill` | 9999px | chips and badges only |

Tables and the resume sheet are square, and there is deliberately no token for that —
`rounded-none` says it better than `--radius-flat` would.
- **Cards carry a ground-shift at rest, a border on hover and focus.**
- Translucency over the ambient layer stays, at one standardised opacity.
- `backdrop-blur` on the header, tab bar and sheet overlay — **and nowhere else.** It is the
  most expensive thing on the phone.
- **Panels do not nest.**

---

## 7. Motion

**Done (V4 §1.8, D-199).** Three durations, three easings, five utilities.

| Utility | Class | What it is |
|---|---|---|
| `card-scan` | existing | The sweep, **without the 3px lift** (Q176, Q177). |
| `link-wipe` | existing | Underline growing from the leading edge. Navigation and footer only. |
| `rise` | existing | The reveal. No delay of its own any more. |
| `rise-stagger` | **new** | On a *container*: its children arrive in sequence, from CSS. |
| `press` | **new** | A 0.97 scale on `:active`, at `fast`, with no delay. |
| `shimmer` | **new** | The loading sweep. Reuses `card-scan`'s `sweep` keyframe. |

**`press` is the one that matters.** §9 calls the missing pressed state the single biggest gap
in the app on a phone, and the requirement — visible feedback inside 100ms — is why it is driven
by `:active` rather than React state: a state round-trip through a server action is exactly the
slow path it compensates for. §5.3 is what puts it on every control.

**The stagger moved out of inline styles** (Q180). Six call sites set `style={{ animationDelay }}`
by hand, four computing it from a map index. Now the container declares the sequence and the
children say nothing. It is ten `nth-child` rules rather than a formula because CSS has no
arithmetic there; the tenth child and beyond share a delay, which is correct rather than a
limitation — past ~600ms a reveal stops reading as a sequence and starts reading as a slow page.
The two bespoke 200ms/240ms delays on below-the-fold sections were dropped rather than ported:
they staggered two things that are never on screen together.

Durations and easings are tokens, so `duration-fast` and `ease-standard` are the spelling —
not `duration-150`.

| Scale | Token | Duration | Used for |
|---|---|---|---|
| Small | `duration-fast` | 150ms | Hover, focus, toggle, the press |
| Medium | `duration-medium` | 250ms | Panel, sheet |
| Large | `duration-slow` | 350ms | Route, overlay |

⚠️ **`--duration-*` is not a Tailwind namespace.** Three explicit `@utility` blocks in
`scale.css` are what make `duration-fast` mean anything; without them it compiles to no CSS and
the element renders untransitioned, looking like a design choice. `--ease-*` *is* a namespace and
needs no such help.

Three easings — standard, entrance, exit. Standard stays
`cubic-bezier(0.22, 0.72, 0.28, 1)`.

Existing utilities: `card-scan` (keeps the sweep, **loses the 3px lift**), `link-wipe`
(navigation and footer only — in prose it is noise), `rise` (stagger, driven from CSS rather
than inline `animationDelay`).

Nothing springs. No physics library.

`prefers-reduced-motion` gets **designed opacity-only alternatives**, not the current blanket
collapse to 0.01ms. The ambient drift stops under it, and below 40rem for battery (D-179).

---

## 8. Icons

lucide-react. **Done (V4 §1.9, D-199).**

| Utility | | Use |
|---|---|---|
| `icon-sm` | 16px | inline with `xs` / `sm` text |
| `icon-md` | 20px | the default, and what the tab bar uses |
| `icon-lg` | 24px | a lone icon carrying a whole control |

Sizes are `rem`, not `px`, so they grow with OS text size — §7.4 audits the app for exactly
that, and an icon set frozen in pixels beside text that scales is what that audit would find.
They are `@utility` blocks rather than theme values because `--icon-*` is not a Tailwind
namespace, and each sets `flex-shrink: 0` — an icon in a flex row beside a long label is the one
place SVGs squash.

**Stroke 1.75, set once** (Q213 — lucide ships 2, which is heavy against Instrument Sans).
`.lucide { stroke-width: var(--icon-stroke) }` in `scale.css` is the whole of it: lucide renders
`stroke-width` as an SVG *presentation attribute*, and CSS outranks one in the cascade, so this
reaches every icon in the app without a single call site passing a prop.

**One deliberate exception to the scale:** the 12px glyph inside `Badge`. A badge is 20px tall
and a 16px icon inside it leaves 2px of air and reads as a button.

Icons appear without labels **only in the tab bar**, and only with an `aria-label`. Three custom
icons are drawn to lucide's grid: dragon boat, filament spool, erg.

Migration of the app's own `size-4` / `size-5` call sites happens screen by screen in Phases
4–6, the same way the mono audit and the opacity utilities do. The tab bar is done.

---

## 9. Touch

The private app is used one-handed, on a phone, sometimes with wet hands. That is the design
constraint, not an accessibility footnote.

- **44px minimum tap target** (V4 raises the gate from 40).
- **A visible press within 100ms of every tap**, even when the action is slow. This is the
  single biggest gap in the app today.
- Hover states stripped entirely on touch via `@media (hover: hover)`.
- Haptics on swipe-complete and save only.
- **Nothing may be reachable only by hover.** The audit of current violations is in
  `DECISIONS.md` D-191; the `title` attribute is the main offender, because on a phone it is
  invisible.

---

## 10. What the gates actually check

`npm run shots` is the layout gate. **Four things fail it**: horizontal overflow, a resume over
one page, a private page burying its first action or missing its `data-first-action` marker,
and a signed-in header that does not fit.

**`tap<40px` and `text<12px` are printed but not gated, and are public-only** (D-190). Do not
read a passing run as a statement about either, or about layout on a private screen. V4 §7.1
fixes this.

**Done (V4 §1.12, D-194 and D-199/D-202).** Three test files, **126 tests**:

- `tokens.test.ts` — **82**, colour and elevation (below).
- `scale.test.ts` — **39**, the type/space/radius/breakpoint/motion/icon scales. It asserts
  *properties* rather than pixel values: changing `RATIO` in the generator moves every number
  and every test still passes, while a typo in one step does not.
- `no-raw-hex.test.ts` — **5**, the lint described below.

`tokens.test.ts` covers:

- **completeness** — every theme defines every token, plus the whole ramp. Also the asymmetric
  case: a token defined in *some* themes and not others silently inherits the default theme's
  value, so that is checked too.
- **contrast** — body text clears AAA on all three grounds, both muted levels clear AA on all
  three, accents clear AA on background and surface, text on a filled accent clears AA, the
  three grounds are distinguishable, borders are visible, and the high-contrast theme really is
  one.
- **agreement** — the registry and the stylesheet list the same themes, every registered ground
  matches the generated value *computed from its OKLCH* rather than read from a comment, and the
  `dark:` variant covers exactly the dark themes.
- **freshness** — the committed CSS is what the generator produces now.

- **elevation** — all four levels in every theme, `rest` flat, every value built from `var(--…)`
  and not a literal, and dark themes elevating with a ring while light ones use an offset. Plus
  the scrim, asserted to darken in the direction its scheme needs.

**The "no raw hex" lint — done (D-202).** `no-raw-hex.test.ts` walks `src/`, strips comments and
`url(…)`, and fails on any hex literal outside a short allowlist. Comments are exempt because
half the hex in this repo is *evidence* — `brand.ts` recording that the status bar sat at
`#0a161b` for two versions is the reasoning D-194 rests on. Four files and one region are
exempt, each with a written reason naming a mechanism that cannot accept `var()`:
`tokens.css` and `scale.css` (generated), `registry.ts` (`<meta name="theme-color">` is markup),
`filament-panel.tsx` (`<input type="color">` takes a hex string and nothing else), and the print
block of `globals.css` (frozen — those are ink on paper).

**It has a positive control, and that is the part that matters.** A scanner reporting nothing
looks identical to a broken one, and this has three ways to silently match nothing: the walk,
the comment-stripping and the regex. Three tests hand it input it must catch — including
`url(#fade-a1b2)`, where an SVG fragment id is four hex characters followed by a hyphen and a
naive `\b` pattern matches it.

If it fails: take the colour from a token. Add to `ALLOWED` only when the mechanism genuinely
rejects `var()` — "it would be annoying to change" is explicitly not a reason.

`PENDING §7.1` — the extended sweep: 44px targets, an 11px text floor with a data-attribute
allowlist, a contrast sweep, a theme sweep, and the 1440 / 1920 widths.
