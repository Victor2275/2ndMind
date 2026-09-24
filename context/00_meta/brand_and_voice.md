---
updated: 2026-09-10
domain: meta
stability: stable
summary: Visual identity — five palettes (Carbon is the default), typefaces, logo concept, portfolio links.
read_when: Design, branding, portfolio, or personal-site work.
---

# Brand and Aesthetic

## 1. Personal Identity & Portfolio

- **Persona:** Specialized Robotics Engineer.
- **Site:** https://victorgusev.com — the portfolio and the private second brain are two
  surfaces of the same app (`web/`).
- **Links:**
  - GitHub: [Victor2275](https://github.com/Victor2275)
  - LinkedIn: [victorgusev](https://www.linkedin.com/in/victorgusev/)
  - Resume: generated per variant at `/resume/{swe,ml,robotics}`; PDF at
    `public/assets/resumes/`.

## 2. The design thesis

> **An instrument, not a document.** Every screen should say what it knows in the fewest
> pixels that can carry it, and every screen you can act on should show you the action before
> it shows you the data.

Set during V4 scoping, 2026-09-06 (`docs/V4_PLAN.md`). It is the test a design change is
argued from. *Instrument* is the target adjective; *editorial* is the one furthest from it.

## 3. Colour — two palettes, one per theme

**This section was wrong for six weeks and is not.** From 2026-08-20 until 2026-09-06 this
file named teal `#09A1A1` as the primary accent while the site had been magenta since V2
(`web/DECISIONS.md` D-002), and every session that read this file was misled. The resolution
is not that one of them was wrong — **it is that there are two palettes, and this file was
describing the one that had not been built yet.**

| | **Dark theme** | **Light theme** |
|---|---|---|
| **Lead accent** | Magenta | Teal |
| **Ground** | Near-black carrying the magenta hue | Warm paper carrying the teal hue |
| **Status** | Shipped V2, re-tuned in V4 | Placeholder until V4 §1.4 |

Dark is the default and the one Victor uses. Light is a real, designed theme as of V4 — not
a contrast-computed fallback (`DECISIONS.md` D-184 built the switch and deliberately left the
palette to V4).

**Which dark, though, changed on 2026-09-08 (D-197): the default is now `carbon`, not
`dark-magenta`.** Carbon is a hueless near-black with a cyan accent. That makes magenta the
identity of a theme rather than the identity of the site — the portfolio, the app icon, the
splash screen and the phone's status bar are all Carbon now, because one constant drives all
four. Magenta is still shipped, still solved, and still one tap away in settings; it is simply
no longer what a first-time visitor sees. §3.2 below describes it as a palette, not as the
brand.

### 3.1 The six canonical swatches

Chosen 2026-08-20. All six survive; what changed is which theme each one leads.

| Swatch | Hex | Role |
|---|---|---|
| Teal | `#09A1A1` | **Light theme lead.** Darkened for paper — see 3.3 |
| Rose | `#D396A6` | Dark chart series; light secondary at lower lightness |
| Peach | `#F6C992` | The single warm note. Eyebrows and emphasis only, both themes |
| Slate teal | `#30525C` | Structural surfaces and borders |
| Steel | `#5484A4` | Mid-tone, chart series, structure. **Never interactive** (V4 Q52) |
| Pale blue | `#ACC0D3` | Muted text, chart series |

Magenta `#d94f93` is the seventh, added in V2 for the dark theme and not part of the original
set. Victor asked for "a very dark pink/magenta"; the *grounds* are where the darkness lives,
because the accent itself has to stay legible at body size.

### 3.2 Dark — magenta on near-black

Measured against the page ground `#140a10`:

| Token | Hex | Contrast |
|---|---|---|
| Foreground | `#f2e9ee` | 16.4:1 |
| Primary (magenta) | `#d94f93` | 5.1:1 |
| Secondary (steel) | `#5484a4` | 4.8:1 |
| Highlight (peach) | `#f6c992` | 12.7:1 |
| Muted foreground | `#b6a2ac` | 8.1:1 |

V4 re-tunes these: slightly less saturated and warmer, with the ground split into three levels
rather than two (`V4_PLAN.md` 1.3). The hues do not change.

### 3.3 Light — teal on warm paper

**The canonical teal cannot be used as-is.** `#09A1A1` lands at **2.94:1** on a warm-paper
ground and **3.17:1** on white — below the bar for any text, and for the same reason the
magenta could not be used on white. It is the palette's identity, not a token.

Anchor values, measured against a paper ground of `#f4f7f6`:

| Role | Hex | Contrast | Note |
|---|---|---|---|
| Ground (paper) | `#f4f7f6` | — | Warm paper carrying the teal hue |
| Card | `#ffffff` | — | A step off the ground, not the ground itself |
| Foreground | `#10201f` | 15.6:1 | Clears AAA |
| Primary (teal) | `#0a7474` | 5.2:1 | White on this fill is 5.6:1 |
| Secondary (steel) | `#3d6d8c` | 5.2:1 | |
| Highlight (amber) | `#8a5312` | 5.9:1 | Peach is 1.4:1 on paper — invisible. This is peach's hue at low lightness |
| Muted foreground | `#4d6360` | 6.0:1 | |
| Destructive | `#b0332a` | 5.8:1 | |
| Success | `#1f6b4a` | 6.0:1 | New in V4 |

Two rules that are easy to break here:

1. **Every text token clears 4.5:1**, including the tertiary/metadata level. A "faint" grey
   that looks right at 3.9:1 is not a legal text colour, and V4 adds a test that fails the
   build on it.
2. **Body text clears 7:1** (AAA), which is the foreground token's job, not the accent's.

### 3.4 Rules that hold in both themes

- **Backgrounds are never flat fills.** The ground is painted on `<html>` and `body`'s
  `::before`/`::after` layer drifting radial pools plus an SVG grain over it. The grain is
  dark-theme only — on paper it reads as a dirty screen.
- **Colour never signals alone.** Every colour signal is doubled with an icon, a word, or a
  weight.
- **Peach/amber means attention, and nothing else** (changed 2026-09-08, D-196). It used to be
  spent on eyebrows and emphasis as well. That made it decoration and a signal at the same
  time, so a stale-data warning and a page's kicker were the same colour — and once the ground
  stopped being magenta-tinted, the decorative half read as stray orange that belonged to no
  theme. Eyebrows now take `--primary`, so they carry the theme. Amber is left to the things
  that are actually asking to be looked at: stale data, a queue that has not sent, a filament
  spool running low, a target missed.
- **Steel is structural and never interactive.**
- **`web/src/app/globals.css` is the implementation of record.** These are the decisions; that
  file is the truth. If they disagree, the CSS is right and this file needs a commit.

### 3.5 Themes are a registry, not two blocks

As of V4 the palette is data, not a `:root` block and a `.dark` block. Five ship:
carbon (default), dark-magenta, light-teal, high-contrast dark, and steel-light. The public
site offers light/dark/system only; the full picker is in the private app's settings.

The default is named once, in `web/src/lib/theme/registry.ts`, and everything else derives from
it — the `:root` block in the generated CSS, the icon ground, the manifest, the status bar and
the theme the portfolio is pinned to. Moving it is a one-line change; the reason it is safe is
that nothing else carries a copy.

## 4. Typography

Three faces, self-hosted in `web/src/app/fonts/` so a build never needs the network. **Do not
add a fourth.**

| Role | Face | Used for |
|---|---|---|
| Display | Bricolage Grotesque (variable, 200–800) | Headings. V4 gives it more range and actually uses the axis |
| Body | Instrument Sans (400/500/600) | Everything read as prose or UI |
| Data | IBM Plex Mono (400/500/600) | **Real data only** — dates, splits, PRs, file paths, counts |

**Mono is not decoration.** It had crept into nav labels, eyebrows and the tab bar; V4 evicts
it from all three (`V4_PLAN.md` 1.6). If it is not a number, a date, or a path, it is not mono.

No italics in either face, and the files are deliberately not loaded.

## 5. The mark

**Concept:** the pillars of the 2ndMind — 3D printing, baking, robotics, dragon boat, and
computer science.

**Form:** representational, non-letterform, monochrome, taking its colour from context.
Designed at **16px first** and scaled up, because the favicon is the constraint that decides
whether it works.

**Settled 2026-09-10 (V4 item 6.1, `web/DECISIONS.md` D-346):** the mark is **the brain**, and it
is the drawing that has shipped since V3 — `web/public/icons/brain.svg`, now on its fifth
revision. The V4 plan asked "which object is the mark" without noticing there already was one.

What changed is the colour, not the geometry. The mark is **monochrome and takes its colour from
context**: the silhouette is `currentColor`, and the folds are knocked out of the alpha rather
than painted, so a groove shows whatever sits behind it. Over the launcher tile that *is* the tile
colour, and it cannot drift from it — which it had, twice.

The **five-pillar lockup lives on the OG card** (D-349), which is where there is room for it.

Where it goes, all of it live as of 2026-09-10: the favicon (`src/app/icon.svg`, with its own
`prefers-color-scheme` branch, plus a real `.ico` of three raster frames), the maskable PWA icon
(padded — the favicon's geometry does not survive Android's mask), the Apple touch icon, the
notification badge, and the site header, where it has replaced the magenta dot. The wordmark is
"Victor Gusev" set in the display face, tracked tight; below the `cramped` breakpoint (380px) the
mark stands alone.

**The `.ico` had never been the mark.** Until 2026-09-10 it was a 25,931-byte file dated the day
the repo was created, which no script here had ever written — the icon pipeline was built in V3
and never included it. `npm run icons` writes every one of these now.

**One thing left to judge:** at exactly 16 device pixels the folds are widened to survive the
raster, and read closer to a crown than a brain. Only 1x displays see that frame; HiDPI takes the
32px one, which is unambiguous (D-348).
