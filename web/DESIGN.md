---
updated: 2026-09-07
domain: engineering
stability: volatile
summary: The design system of record — tokens, type, space, motion, and the rules that govern them.
read_when: Changing anything visual, or adding a component.
---

# 2ndMind — Design System

**Status: colour is done; type, space, surface and motion are not.** Created in V4 Phase 0
(2026-09-06); §3 filled by Phase 1.1–1.4 (2026-09-07). Sections still marked **`PENDING §1.x`**
are empty on purpose — an invented value here would be worse than a gap, because the gap is
honest and a wrong number gets copied.

Three documents, three jobs:

| File | Answers |
|---|---|
| `context/00_meta/brand_and_voice.md` | *Why* — brand, palette reasoning, the mark |
| **`web/DESIGN.md`** (this) | *What* — the tokens and the rules for using them |
| `web/DECISIONS.md` | *When and how to undo* — dated log, one entry per choice |

`src/app/tokens.css` (generated) holds the colour values and `src/app/globals.css` everything
else. Where they and this file disagree, **the CSS is right and this file needs a commit** — and
for colour, the generator is right and the CSS needs a `npm run tokens`.

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
4. **Peach/amber is the single warm note** — eyebrows and emphasis, never structure.
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
| `--highlight` | The warm note |
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
| `dark-magenta` | dark | `#12090d` | The default. V2's identity, re-tuned |
| `light-teal` | light | `#eef4f4` | The light theme. Teal on warm paper |
| `hc-dark` | dark | `#030303` | Every colour clears 7.5:1. Also what `prefers-contrast: more` selects |
| `carbon` | dark | `#0e0e0e` | Experimental. Hueless near-black, cyan accent |
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

Public offers light / dark / system and is **pinned dark** with a toggle that lifts the pin for
the current visit only — never writing to storage, so a visitor cannot change Victor's app
(D-184, extended by Q87). The full five-theme picker lives in private settings (Phase 4.4).

---

## 4. Typography

Three faces, self-hosted in `src/app/fonts/`. **Do not add a fourth.**

| Role | Face | Weights |
|---|---|---|
| Display | Bricolage Grotesque (variable 200–800) | Headings only |
| Body | Instrument Sans | 400 / 500 / 600 |
| Data | IBM Plex Mono | 400 / 500 / 600 |

No italics — the files are deliberately not loaded.

`PENDING §1.5` — the nine-step scale (modular 1.2, fluid for display, stepped for body) and
the optical tracking per step.

`PENDING §1.6` — the mono eviction list: every call site where mono is currently decoration.

Settled now:
- Line length: **58ch** for prose.
- Line height: **1.6** public prose, **1.45** private UI.
- Uppercase tracking: **0.12em**, and uppercase used roughly half as much as it is today.
- `text-wrap: balance` on headings, `pretty` on ledes.
- Tabular figures anywhere a number can change in place — automatic inside `Stat`, tables and
  charts rather than applied by hand.

---

## 5. Space and layout

`PENDING §1.7` — the eight-value spacing vocabulary on a 4-point grid.

Settled now:

- **Three content widths**, named: prose / content / wide. The private app is narrower than
  the public site; a form at 64rem is unreadable.
- **One breakpoint set.** `40rem` is the line that defines "phone" and it gets a token name —
  the app currently mixes `sm:`, `min-[380px]:`, a raw `@media (width < 40rem)` and `lg:`.
  Tablet (768–1024) gets its own treatment rather than falling to desktop.
- **Card size vocabulary** (sm / md / lg) rather than per-instance padding. `p-6`, `p-5` and
  `p-4` are all in use today with no rule behind the choice.
- **Grids use `auto-fit` / `minmax`**, not fixed breakpoint column counts.
- Safe-area insets on the bottom bar, and left/right in landscape.

---

## 6. Surface and depth

`PENDING §1.7` — the four-level elevation scale.

Settled now:

- Elevation is **ground-shift plus border in dark, shadow in light.** That is the main
  structural difference between the two themes.
- Radius base is `0.625rem` and **scales with the size of the thing** — small controls tighter,
  large surfaces looser. Tables and the resume sheet are square. Pills are for chips and
  badges only.
- **Cards carry a ground-shift at rest, a border on hover and focus.**
- Translucency over the ambient layer stays, at one standardised opacity.
- `backdrop-blur` on the header, tab bar and sheet overlay — **and nowhere else.** It is the
  most expensive thing on the phone.
- **Panels do not nest.**

---

## 7. Motion

`PENDING §1.8` — the two new utilities.

Settled now:

| Scale | Duration | Used for |
|---|---|---|
| Small | 150ms | Hover, focus, toggle |
| Medium | 250ms | Panel, sheet |
| Large | 350ms | Route, overlay |

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

lucide-react. Stroke **1.75** — the default 2 is heavy against this type.

Sizes are tokenised at 16 / 20 / 24. Icons appear without labels **only in the tab bar**, and
only with an `aria-label`. Three custom icons are drawn to lucide's grid: dragon boat,
filament spool, erg.

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

**Mostly done (V4 §1.12, D-194)** — `src/lib/theme/__tests__/tokens.test.ts`, 57 tests:

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

`PENDING` — the "no raw hex outside the token file" lint. Not yet written: there are still raw
hex literals in components, and the rule has to land with the pass that removes them.

`PENDING §7.1` — the extended sweep: 44px targets, an 11px text floor with a data-attribute
allowlist, a contrast sweep, a theme sweep, and the 1440 / 1920 widths.
