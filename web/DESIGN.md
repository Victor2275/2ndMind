---
updated: 2026-09-06
domain: engineering
stability: volatile
summary: The design system of record — tokens, type, space, motion, and the rules that govern them.
read_when: Changing anything visual, or adding a component.
---

# 2ndMind — Design System

**Status: skeleton.** Created in V4 Phase 0 (2026-09-06). The sections marked
**`PENDING §1.x`** are filled by V4 Phase 1 and are empty on purpose — an invented value here
would be worse than a gap, because the gap is honest and a wrong number gets copied.

Three documents, three jobs:

| File | Answers |
|---|---|
| `context/00_meta/brand_and_voice.md` | *Why* — brand, palette reasoning, the mark |
| **`web/DESIGN.md`** (this) | *What* — the tokens and the rules for using them |
| `web/DECISIONS.md` | *When and how to undo* — dated log, one entry per choice |

`src/app/globals.css` is the implementation. Where it and this file disagree, **the CSS is
right and this file needs a commit.**

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

`PENDING §1.1` — the OKLCH values, and the 50–950 primary ramp that replaces the scattered
`color-mix(in oklab, …)` calls.

### 3.2 Themes

`PENDING §1.2` — the registry. Five ship: dark-magenta (default), light-teal,
high-contrast-dark, and two experimental slots.

Public offers light / dark / system. The full picker lives in private settings.

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

`PENDING §1.12` — the token tests: completeness across every theme, contrast over every pair,
and no raw hex outside the token file.

`PENDING §7.1` — the extended sweep: 44px targets, an 11px text floor with a data-attribute
allowlist, a contrast sweep, a theme sweep, and the 1440 / 1920 widths.
