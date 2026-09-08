---
updated: 2026-09-06
domain: engineering
stability: volatile
summary: V4 — the UI overhaul. Scoped by 484 questions on 2026-09-06. Eight phases, 241 points. Phase 0 done.
read_when: Working on V4, or deciding what to do next in web/.
---

# 2ndMind — V4: the look

**Scoped 2026-09-06 by 484 questions (`docs/V4_QUESTIONS.md`) plus four follow-ups.**
No hard deadline. Replaces nothing — V1, V2 and V3 all shipped.

## The thesis

> **An instrument, not a document.** Every screen should say what it knows in the fewest
> pixels that can carry it, and every screen you can act on should show you the action before
> it shows you the data.

That sentence is the test. Where a V4 change cannot be argued from it, it is decoration and
does not ship. It comes from your own answers: *instrument* (Q14), *precise and clean* (Q17),
and the one that matters most — **"the point of this project is to list my ideas; too much
read-only text defeats the point"** (Q130).

---

## 0. TLDR

| | |
|---|---|
| **Goal** | The app stops looking like a vault renderer and starts looking like an instrument. Both themes designed, both surfaces coherent, the two worst screens rebuilt. |
| **Scope** | A UI overhaul **plus three features your answers require** — training logging, tags, and a settings screen. §2.1 explains why that is not scope creep. |
| **Budget** | **241 points.** You said 120–140. The gap is real and is §7 R2, not a rounding error. |
| **Order** | Foundations → tokens → **training** → tags → private shell → private screens → brand+public → gates.<br>**Phase 0 done** (2026-09-06). **Phase 1.1–1.4 done** (2026-09-07): colour is finished. Next is 1.5 (type scale). |
| **Milestone A** | End of Phase 1 — every colour, size, space and motion value comes from one place, and a test fails if it does not. |
| **Milestone B** | End of Phase 2 — you log a gym session on the phone, offline, the way Hevy does it. |
| **Milestone C** | End of Phase 5 — the private app is finished. This is the one that matters daily. |
| **Milestone D** | End of Phase 6 — the portfolio is finished. |
| **Done when** | You open the app on a term morning and the first thing you see is the thing you have to do. And a stranger opens victorgusev.com and does not think "student project". |
| **Biggest risk** | Phase 2 is a feature, not a redesign, and it reverses a decision that has been declined twice. §7 R3. |

**Points are difficulty, not schedule** (Q28). One point ≈ one hour of focused work, used to
compare items against each other. Do not plan a calendar from them.

---

## 1. What V4 is, in one paragraph

The bones are good and stay (Q1: refinement). The execution is uneven: colour is one hex value
plus forty scattered `color-mix()` calls, spacing is invented per page, mono type has escaped
from data into decoration, light mode was computed rather than designed, the desktop private
nav is a horizontally scrolling bar on a 1440px screen, and the screen you use most — the
training log — is the one that fights you hardest. V4 fixes the system first, then the screens,
then the portfolio.

---

## 2. What was decided

Every answer is here, grouped. Where an answer contradicts something already built or already
written down, it says so and names the entry. Sixteen contradictions were found; all sixteen
are resolved below.

### 2.1 · Scope — Q12 is overruled by your own answers

**Q12 said "appearance plus interaction feel; no new features."** Eight other answers ask for
features:

| Answer | The feature it requires |
|---|---|
| Q6, Q71, Q73 | A theme **system** — several selectable palettes, not two CSS blocks |
| Q131 | A density toggle, stored |
| Q369, Q370, Q371, Q375 | A real `/private/settings` route |
| Q391 | Hevy-shaped training logging, an exercise database, fuzzy search, AI-add |
| Q409 | A searchable PR table, readable mid-workout |
| Q325 | Sortable projects |
| Q422 | A calendar/agenda view switch |
| Q3 → follow-up | Free tags on any entry |

**Resolution: the specific answers win, Q12 is struck.** V4 is a UI overhaul with a named
feature track. It is recorded this way rather than quietly built, because "no new features" in
the plan and four new tables in the repo is how a plan stops being read.

**Two consequences.** The budget moves (§7 R2), and every feature item below is marked
**[FEATURE]** so the pure-design work can be separated if you ever want to stop early.

### 2.2 · Training — reverses a decision closed twice  **[FEATURE]**

**Q391 asks for:** an exercise database like Hevy's, your own additions to it, fuzzy search, an
"AI ADD" path where you describe a workout and it finds or creates the exercise, and session-
based logging — several exercises and their sets saved as one workout. A separate page is fine.

**What it contradicts.** `docs/SYNC_DESIGN.md` §11.1 asked "does the phone create workouts?",
answered *yes*, then **reversed to no on 2026-08-30** because the parent/child foreign-key
problem cost Phase 1 five hours it did not have. D-159 re-examined it on **2026-09-03** and
declined again, solving the symptom instead: `allEfforts()` unions `workout_sets` with the sets
inside `log_entries`, so quick-logged sets reach the PR board without the phone ever creating a
session. `web/context.md` states the constraint directly: *"`workouts`/`workout_sets` are
pull-only, mirrored by the server's `id` rather than a client key, which is safe only while the
phone cannot create one. Making them writable means giving them a client key first."*

**This is now reversed, deliberately, for the third answer.** The design does not need
rediscovering: **`SYNC_DESIGN.md` §4a is it**, written and never built. A workout create is a
single aggregate op carrying the session and all its sets, applied in one transaction. §4a's own
note says reverting §11.1 is the only other change needed.

**Placement:** its own phase, immediately after tokens (your follow-up answer). Not first,
because it would be styled twice; not last, because you would spend the whole term logging
training the way you do now.

### 2.3 · Tags — the answer to your actual complaint  **[FEATURE]**

**Q3, your strongest complaint:** information with no existing category is hard to organise
after logging. A recipe you want to try has nowhere to go.

Nothing in the other 483 answers addresses this, and no amount of visual work will:
`lib/log/categories.ts` is a **fixed code-level list**, and `fileEntry` can only move a note
*into* a category that already exists (D-164). Adding a kind of thing currently requires a
commit.

**Resolution: free tags on any entry** (follow-up answer). Any log entry, note or task takes
arbitrary tags; filing from the unsorted pile becomes tagging rather than choosing from a closed
list; tags are browsable and filterable. One column, one input, one filter — and it never needs
code again to hold a new kind of thing.

User-defined *categories* (with their own fields, forms, validation and summary lines) are
scoped to V5, once you have seen which tags you actually reuse. §6 records why.

### 2.4 · Colour — light mode is the teal palette

**The contradiction:** Q6 keeps magenta as primary; Q78 says light mode should use **teal**;
Q79 and Q84 keep magenta-derived values in light. All three cannot hold.

**Resolution (follow-up answer): two full palettes, one per theme.**

| Theme | Accent | Ground | Source |
|---|---|---|---|
| **Dark** | Magenta `#d94f93`, re-tuned slightly less saturated and warmer (Q48, Q49) | Near-black carrying the magenta hue, three levels (Q55, Q56) | D-002, V2 |
| **Light** | Teal `#09A1A1`, darkened for contrast on paper | Warm paper carrying a teal tint (Q77, Q78) | The original six swatches |

**This dissolves Q47.** `brand_and_voice.md` has said teal leads since 2026-08-20 and looked
stale for six weeks. It is not stale — it is **the light theme's specification**, and Phase 0
rewrites it to say so. Steel, pale blue, rose and peach come back into play as the light
palette's structural and chart colours, which is what they were chosen for.

**Everything else in §3–§4 stands:** three grounds, two muted foregrounds, a success green, a
warning colour, destructive shifted toward orange-red so it does not read as the magenta accent,
a dedicated focus colour that survives on a filled button, styled selection and desktop
scrollbars, colour never signalling alone (Q72).

### 2.5 · Themes are a registry, not two blocks

Q6 ("let me explore other themes in a settings mode"), Q71 (a high-contrast dark variant) and
Q73 ("build out several themes to try, then I will determine my favourite") together mean the
current architecture — a `:root` block and a `.dark` block — cannot hold V4.

**Decision: themes become data.** A registry of named palettes, each a complete token set, one
of which is applied. Consequences that are easy to miss:

- **Q469's token test** must assert completeness across *every* theme, not two.
- **Q464's theme sweep** in `npm run shots` becomes *N* × pages. Cap N or cap the swept pages.
- **Public and private differ** (Q76): public offers light/dark/system only (Q87, Q88); the full
  picker lives in private settings. A recruiter does not need your colour experiments.
- Ships with **five**: dark-magenta (default), light-teal, high-contrast dark, and two
  experimental slots for you to fill and judge.

### 2.6 · Typography, space, surface

Settled and uncontested: keep all three faces, add none (Q94, Q99, Q100). Bricolage gets more
range and its variable axis actually used (Q92, Q93). **Mono is restricted to real data** and
leaves nav labels, eyebrows and the tab bar (Q96, Q97) — the body face, tracked, replaces it
(Q98). Nine-step modular 1.2 scale, fluid for display and stepped for body (Q101–Q103). Uppercase
cut by roughly half and tracking dropped to 0.12em (Q116, Q117). No italics, ever (Q118).
Headings never coloured — colour goes on the eyebrow (Q119).

Three documented widths (prose / content / wide), a restricted eight-value spacing vocabulary on
a 4-point grid, card size classes rather than per-instance padding, `auto-fit` grids, a named
breakpoint set that reconciles the two competing definitions of "phone" (Q124–Q150). A four-level
elevation scale expressed as ground-shift + border in dark and shadow in light (Q156, Q157).
The ambient gradient stays and is redesigned; the grain stays in dark and goes in light
(Q161–Q164).

### 2.7 · Motion

Three utilities become five (Q174). `card-scan` keeps the sweep and **loses the lift** (Q176,
Q177). `link-wipe` narrows to navigation and footer (Q179). Stagger moves from inline
`animationDelay` to CSS (Q180). No entrance animation above the fold, ever — D-171 measured
900ms of delayed FCP (Q181). Three durations (150/250/350ms) and three easings (Q185–Q189).

**The single biggest miss on the phone is pressed states** (Q195): a visible press within 100ms
on every tap, even when the action is slow (Q196). Haptics on swipe-complete and save only
(Q197). `prefers-reduced-motion` gets *designed* opacity-only alternatives rather than the
current blanket 0.01ms collapse (Q207).

### 2.8 · Private app — shell and screens

Desktop nav becomes a **collapsible sidebar** with persisted state (Q360–Q363); the two nav
components stay separate, as D-132 decided (Q358). Your Q258 note — *"the top bar is scrolling.
This is an indication of too much going on there"* — is the reason: eight routes in a scrolling
mono row at 1440px. The sidebar fixes the presentation. **Whether nine routes is the right number
is not answered and is in §8.**

`PageHeader` collapses into the nav on phones, where it currently costs ~110px above the first
action on every screen (Q132, Q133). Tab bar keeps its five items, gains filled active icons and
an outbox badge (Q364, Q367, Q287). A real `/private/settings` holds the theme picker, density
toggle, push, install, **manual sync** and sign-out — your rule: *anything that affects the
website and is not used regularly goes in settings* (Q369–Q371, Q375).

Screens: Today keeps its measured order (Q376) with summaries collapsed (Q378). Athletics leads
with the adjusted split against the sub-2:00 goal as a gauge (Q406, Q407) and gets a record board
(Q409). Academics renders the audit as a progress structure and marks *unverifiable* distinctly
from *failing*, which D-187 built in logic and never showed (Q415, Q417). Work becomes a kanban
(Q419). Calendar is an agenda with a month strip **and a view switch** (Q422). Hobbies gets real
spool levels and colour swatches (Q424, Q425).

**Q130 is a standing instruction across all of these:** where a screen is currently a wall of
read-only prose, it becomes structured and actionable. That is the thesis, applied.

### 2.9 · Public site

Brand mark, SVG favicon with light/dark variants, a padded maskable PWA icon, a designed splash,
a tracked wordmark, and per-page OG images generated with `next/og` (Q31–Q46). About gets a
taller hero, a prose paragraph, a second CTA and a refined timeline with a date gutter
(Q305–Q321). Projects gets URL-backed filters, sorting, three columns above 1280px and a
two-column featured card (Q322–Q330). Case studies get a persistent TOC, an opening summary
block, hand-authored SVG diagrams, and — your words — **"clean if someone views it, including
hiding missing information"** (Q331–Q340). The resume screen stops being the print sheet on a
dark background and becomes a document on a designed surface, with a visible variant switcher
and the PDF as the primary action (Q347–Q356). **The print block is frozen** (Q123, Q355).

### 2.10 · Contradictions found, and their resolutions

| # | Contradiction | Resolution |
|---|---|---|
| C1 | Q12 "no new features" vs eight feature answers | Q12 struck; §2.1 |
| C2 | Q391 vs `SYNC_DESIGN` §11.1 (closed 08-30) and D-159 (declined 09-03) | Reversed deliberately; §4a is the design; §2.2 |
| C3 | Q78 teal vs Q6/Q79/Q84 magenta in light | Two palettes, one per theme; §2.4 |
| C4 | Q47 — `brand_and_voice.md` looked stale | It is the light theme's spec; rewritten in Phase 0 |
| C5 | Q25 public-last vs peak application season (§7 R1) | Your call, kept, logged as an accepted risk |
| C6 | Q6/Q71/Q73 vs the two-block CSS architecture | Theme registry; §2.5 |
| C7 | Q112 — 8.8px text passing a 12px gate | **Possibly a live bug.** Investigated in Phase 0, not assumed |
| C8 | Q305 "order is right" vs Q309/Q321 adding blocks | Insertion, not reorder |
| C9 | Q315 keeps the spotlight glow vs Q176/Q177 "subtler" | Different components; allowed, noted |
| C10 | Q130 vs a pure visual pass | Prose→structure is a standing instruction, §2.8 |
| C11 | Q258 "too much going on" vs keeping nine routes | Presentation fixed; the count is open, §8 |
| C12 | Q375 "(the Match the ...)" is garbled | §8 |
| C13 | Q402 unanswered vs Q391 and tags both needing edit | §8 |
| C14 | Q373 defers search to V5 vs Q448 wanting a search shortcut | Shortcut waits for the feature |
| C15 | Q31 five pillars vs Q32/Q33 representational at 16px | Five objects cannot read at 16px. One object is the mark; the five-pillar lockup lives on the splash and OG image. §8 confirms which object |
| C16 | Q465 no pixel-diff vs Q29 before/after shots | Compatible: record, do not gate |

---

## 3. The build

Eight phases. **Each ends with the app in a coherent state** — stopping after any phase leaves
something shippable, which is the whole reason for this ordering.

### Phase 0 · Say what is true — **8 pts** — ✅ **DONE 2026-09-06**

Nothing renders differently. This existed because three documents described a codebase that had
drifted away from them, and every phase below is read against those documents.

| # | Item | Pts | Result |
|---|---|---:|---|
| 0.1 | Rewrite `brand_and_voice.md`: teal is the **light** palette, magenta the **dark** one | 2 | ✅ Done. Contrast measured, not asserted — `#09A1A1` is **2.94:1 on paper** and cannot carry text, so the light token is that hue darkened to `#0a7474` (5.2:1) |
| 0.2 | Rewrite `web/context.md` §Theme for the registry | 1 | ✅ Done. Found **two further staleness bugs**: it said the dark palette lives in `:root` with `.dark` mirroring it (D-184 inverted this), and that `<html>` carries a hardcoded `dark` class (`next-themes` replaced it) |
| 0.3 | Create `web/DESIGN.md`, referenced from the routing table | 1 | ✅ Done. Routing table in `CLAUDE.md`/`AGENTS.md` gained rows for `DESIGN.md` and this plan |
| 0.4 | Investigate the 8.8px text passing a 12px gate | 2 | ✅ Done — **the prediction was wrong and the truth is worse.** D-190 |
| 0.5 | Audit hover-only affordances | 1 | ✅ Done. **2 real faults**, 3 already correct, 3 acceptable. D-191 |
| 0.6 | Measure the ambient layer's paint cost | 1 | ✅ Harness built (`npm run paint`, D-193) and run. **Both deltas came back below the noise floor** — the layer's cost is not measurable here. The Samsung number is still owed and is the only one that can settle it — §8 |

**Three findings the plan did not predict**, all from running the code rather than reading it:

1. **The text-size and tap-target checks were never gates** (D-190). The selector was never the
   problem — it finds the small text and prints it. Nothing sums the column. Measured live:
   **68 sub-12px elements and 13–16 sub-40px tap targets at every width, exit code 0.** And the
   private loop never asks either question at all, which is why the 8.8px tab bar has never been
   measured by anything.
2. **Seventeen of nineteen vendored shadcn components are imported by nothing** (D-192). Only
   `badge` and `button` are used.
3. **There is no toast system** (D-192). `sonner` is a dependency, its wrapper exists, no
   `<Toaster />` is mounted and `toast()` is never called. Four V4 answers (Q265–Q268) assume
   toasts exist. They do not.

Findings 2 and 3 move points between phases — see 1.10 and 5.2. The total does not change.

**Baseline recorded 2026-09-06** (`npm run shots`, dev server, all four widths):

| | |
|---|---|
| Horizontal overflow | 0 everywhere — the one gate that works, passing |
| Sub-12px text, public | 68 per width (home 11, projects 24, project-detail 28, resume 5) |
| Sub-40px tap targets, public | 13–16 per width |
| First action, phone | today 208px · log 205px · academics 266px · calendar 297–362px · athletics 342px |
| Signed-in header | fits at all widths; name 46px at 360, 97px at desktop |

Athletics at 342px and calendar at 362px are the two closest to the 500px limit and are the
first to break when Phase 5 adds anything above the fold.

**Ambient layer, 2026-09-06** (`npm run paint`, 2 pairs of 5s, headed):

| | on | off | delta | noise |
|---|---|---|---|---|
| Desktop 1280, drift ON | 123.65 ms/s | 119.65 ms/s | +4.00 | ±6.93 |
| Phone proxy 390 @ x6, drift OFF | 31.58 ms/s | 32.12 ms/s | −0.54 | ±0.82 |

**Both deltas are inside the noise.** This changes an argument in §1.4: **do not redesign the
ambient layer for performance.** D-179 disabled the drift below 40rem on a first-principles
cost argument, and nothing measurable on this machine supports it — which does not clear the
Samsung, where a mobile GPU, a tiled renderer, thermal throttling and OLED draw all exist and
none of them are reproduced here. Redesign the layer because the gradients were placed by eye
once (Q162). That reason needs no measurement.

---

### Phase 1 · Tokens and primitives — **40 pts** — ◐ **1.1–1.4 done 2026-09-07**

The system. Every screen depends on it, which is why it is first (Q471), and why a period of
half-migrated screens is acceptable (Q472).

| # | Item | Pts |
|---|---|---:|
| 1.1 | ✅ **Done.** Tokens in OKLCH, **generated** from contrast targets by `scripts/build-tokens.mts` — a token is declared as "teal, at whatever clears 5.4:1 on a card" and the solver returns it. Three grounds, two muted levels, success/warning, dedicated ring, 50–950 ramp. *The plan said forty `color-mix()` calls; there were nine — the scattering was in ~300 opacity utilities, which still work and migrate screen by screen* | 6 |
| 1.2 | ✅ **Done.** Five themes: dark-magenta, light-teal, hc-dark, and two experimental — `carbon` (hueless near-black) and `steel-light` (steel as accent, a deliberate test of the "steel is never interactive" rule). `data-theme` only; the `dark:` variant is a **generated** selector list, verified in the production bundle | 5 |
| 1.3 | ✅ **Done.** Chroma 0.17 → 0.145, hue 356 → 346, primary `#d36da8` at 5.22:1. Three grounds with a wider step than the old pair | 3 |
| 1.4 | ✅ **Done.** Teal on warm paper, primary `#007777` at 5.26:1. Grain off and pools at 0.45 — as **tokens**, not scheme selectors, so they are right on the first painted frame. *Shadow-based elevation is component work and lands with §4/§5* | 5 |
| 1.5 | **Type scale** — nine steps, modular 1.2, fluid display / stepped body, optical tracking per step (Q101–Q106) | 4 |
| 1.6 | **Mono eviction** — mono leaves nav, eyebrows, tab bar, panel meta. Body face, tracked, replaces it (Q96–Q98, Q111) | 3 |
| 1.7 | **Space, radius, elevation, breakpoints** — eight-value spacing vocabulary on 4pt, radius scaling with size, four elevation levels, one named breakpoint set reconciling the two "phone" definitions (Q127, Q137, Q143, Q144, Q152, Q156) | 4 |
| 1.8 | **Motion tokens** — three durations, three easings, `card-scan` loses its lift, stagger moves to CSS, two new utilities (Q174–Q189) | 3 |
| 1.9 | **Icon tokens** — sizes 16/20/24, stroke 1.75 (Q213, Q214) | 1 |
| 1.10 | **Rework `components/ui/` by hand** at the new tokens — **two files, not nineteen** (D-192): only `badge` and `button` are imported anywhere. Decide the other seventeen file by file: keep as the base for a V4 form control, or delete. **`form.tsx` is hand-authored and must survive** (Q473, Q474). Drop `tw-animate-css` if unused after (Q475) | 2 |
| 1.11 | **`/private/kitchen-sink`** — every component, every state, every theme, one page (Q24) | 2 |
| 1.12 | ◐ **Mostly done.** 57 tests: completeness (including the asymmetric case), contrast on every ground, registry/stylesheet agreement, staleness. **The "no raw hex" lint is still to write** — it has to land with the pass that removes the literals | 2 |

**Ends with (Milestone A):** every colour, size, space and motion value comes from one place,
and a test fails if it does not.

---

### Phase 2 · Training, end to end — **45 pts**  **[FEATURE]**

Its own phase because it is a feature, not a redesign. §2.2 has the reversal; `SYNC_DESIGN.md`
§4a has the design.

| # | Item | Pts |
|---|---|---:|
| 2.1 | **`exercises` table** — a seeded catalogue plus your own additions, with muscle group and modality so the session form knows which fields to ask for | 6 |
| 2.2 | **Fuzzy search** over the catalogue. Client-side, so it works offline — the whole point | 4 |
| 2.3 | **"AI ADD"** — describe a workout, it finds the match or creates the exercise. Reuses `lib/ai/gemini.ts`. **It proposes; you confirm.** Same rule D-186 set for voice: the model cannot save | 5 |
| 2.4 | **`SYNC_DESIGN` §4a — the aggregate op.** `workouts` gains a client key; a session and all its sets are one outbox entry applied in one transaction. Reverses §11.1 | 10 |
| 2.5 | **Session logging screen** — exercise → sets, numbered (Q399), duplicate-last-set (Q400), running totals (Q398), three taps per set (Q392). Its own route, which you said is fine | 8 |
| 2.6 | **PR board + searchable PR table** (Q409), including **PRs visible while logging** — the reason the table exists | 5 |
| 2.7 | **Reconcile with D-159.** `allEfforts()` currently unions two sources. With sessions writable, decide whether quick-log training stays or folds in. **Do not add a third reader** — that is D-159's whole design | 3 |
| 2.8 | **Tests:** PGlite against the committed migrations, sync round-trip, offline e2e. The 1,240 count may not drop (Q470) | 4 |

**Ends with (Milestone B):** you log a gym session on the phone, offline, and it syncs.

---

### Phase 3 · Tags — **12 pts**  **[FEATURE]**

The answer to Q3. Small, and it fixes the complaint you led with.

| # | Item | Pts |
|---|---|---:|
| 3.1 | Tags on log entries, notes and tasks. One migration | 3 |
| 3.2 | Tag input with existing-tag suggestions; tags render as tokens, matching the chip language (Q255) | 3 |
| 3.3 | **Filing from the unsorted pile becomes tagging** — swipe right, choose from a sheet (Q396), no longer limited to the fixed category list | 3 |
| 3.4 | Browse and filter by tag | 2 |
| 3.5 | Sync entity registration + tests | 1 |

**Ends with:** a recipe you want to try has somewhere to go without a commit.

---

### Phase 4 · The private shell — **28 pts**

Navigation, chrome, settings. Everything that wraps a screen rather than being one.

| # | Item | Pts |
|---|---|---:|
| 4.1 | **Desktop sidebar** — collapsible to icons, state persisted, content width widened (Q360–Q363). Kills the scrolling row (Q359) | 6 |
| 4.2 | **`PageHeader` collapses into the nav on phones**; compact title bar (Q132, Q133, Q372) | 3 |
| 4.3 | **Tab bar** — filled active icons, outbox badge, sheet grabber, partial-height sheet draggable to full (Q367, Q287, Q172, Q173) | 4 |
| 4.4 | ✅ **Done 2026-09-08** (pulled forward, D-195). Theme picker (switch + five), push, install, manual sync, passkey, public site, sign-out, deployed commit. Both navigations gave the controls up rather than copying them. **Density toggle deferred** — §1.7 has not defined the spacing vocabulary, so it would have nothing to switch | 6 |
| 4.5 | **Connection/sync glyph** in the header, persistent (Q375) | 2 |
| 4.6 | **Two-column desktop** for Today, Athletics, Academics (Q150) | 4 |
| 4.7 | Skip links, landmarks, heading-order audit, focus state on every interactive element including cards (Q443–Q447) | 3 |

**Ends with:** the app has a shell that does not embarrass itself at 1440px.

---

### Phase 5 · The private screens — **50 pts**

Milestone C. The phase that changes your day.

| # | Item | Pts |
|---|---|---:|
| 5.1 | **Shared states** — one "as of" staleness component used everywhere (Q285, Q286, Q241); empty states that name and offer the action that fills them (Q275, Q277); exact-shape skeletons (Q279); designed error boundary, 404, and the "database is behind this build" state (Q283, Q291, Q292); queued vs failed made unmissable (Q289) | 8 |
| 5.2 | **Forms pass** — 48px touch targets, labels above, never placeholder-as-label, blur validation, sticky save on long forms, dirty indicator, chips as tokens, the four shortcut kinds made visually distinct (Q245–Q256).<br>**Includes building the toast system** (D-192): mount a `Toaster`, wire the first `toast()`, then style it. Q265–Q268 were scoped as a styling pass and are a build | 10 |
| 5.3 | **Motion and touch pass** — pressed states within 100ms everywhere, redesigned swipe reveals (colour then icon), designed pull-to-refresh, haptics on swipe-complete and save, hover stripped on touch (Q193–Q200) | 6 |
| 5.4 | **Today** — capture box made the loudest thing, domain icons on tasks, overdue loud but not red, completed collapsed, summaries collapsed and quieter, agenda with a "now" marker, archive moved to the log (Q376–Q390) | 6 |
| 5.5 | **Log (non-training tabs)** — last-used category, drafts surviving restart, today's entries below the form, marked search results (Q393, Q394, Q401, Q404) | 5 |
| 5.6 | **Athletics** — the adjusted split against sub-2:00 as a gauge, heatmap over the session list, rehab checklist mirrored to Today when incomplete, a parse miss that *reads* as a parse miss (Q405–Q414) | 6 |
| 5.7 | **Academics** — audit as a progress structure, planner as a board on desktop and table on phone, **unverifiable marked distinctly from failing** (Q415–Q418) | 5 |
| 5.8 | **Work, Calendar, Hobbies, Sync** — kanban pipeline, agenda + month strip + view switch, Google/vault provenance, spool levels and colour swatches, per-item sync reasons designed (Q419–Q428) | 6 |
| 5.9 | **Charts** — the one number above every chart, near-sparklines on phone and full axes on desktop, the sub-2:00 goal line drawn, tap-to-pin instead of tooltips, tables restructured to cards under 40rem, mount animation off (Q227–Q242) | 6 |

Throughout: **Q130 applies.** Where a panel is read-only prose, it becomes structured.

**Ends with (Milestone C):** the private app is finished.

---

### Phase 6 · Brand and the public site — **36 pts**

Milestone D.

| # | Item | Pts |
|---|---|---:|
| 6.1 | **The mark** — representational, non-letterform, monochrome, designed at 16px first. §8 settles which object (C15) | 5 |
| 6.2 | **Icon set** — SVG favicon with light/dark variants, padded maskable PWA icon, designed splash, shortcut icons, push badge (Q38–Q40, Q435, Q436) | 4 |
| 6.3 | **Wordmark + OG images** — tracked display face, mark-only under 380px, per-project and generic OG generated with `next/og`, typographic (Q41–Q45) | 5 |
| 6.4 | **About** — taller hero, positioning line below the name, a prose paragraph, second CTA, facts as a line on phone and cards above, refined timeline with a desktop date gutter, portrait larger and square with the bloom replaced (Q305–Q321, Q218, Q219) | 6 |
| 6.5 | **Projects** — URL-backed filters, sorting, three columns above 1280px, featured two-column card, whole-card click affordance, restyled status badges, image lightbox (Q322–Q330, Q223) | 5 |
| 6.6 | **Case studies** — persistent TOC, opening summary block, hidden-when-missing sections, styled code blocks, next-project link, distinct updates timeline, prominent repo/demo links (Q331–Q340) | 5 |
| 6.7 | **Hand-authored SVG diagrams**, themed with CSS variables — your highest-value public visual (Q224, Q225) | 4 |
| 6.8 | **`/now` + resume screen** — airier `/now` leading with the most recent update; resume as a document on a designed surface, variant switcher, PDF as primary action, reflowed on phone. **Print block untouched** (Q341–Q357) | 5 |
| 6.9 | **Public chrome** — footer theme toggle, build date, repo link, external-link glyph, case-study reading progress, `PrivateLink` de-emphasised (Q293–Q304) | 3 |

**Ends with (Milestone D):** the portfolio is finished.

---

### Phase 7 · Gates, performance, review — **22 pts**

The work that stops V4 decaying the way V1's resume did before D-077.

| # | Item | Pts |
|---|---|---:|
| 7.1 | **`npm run shots` extensions** — 44px tap targets, 11px text floor with a data-attribute allowlist, contrast sweep, theme sweep (capped), widths 1440 and 1920, tightened fold thresholds (Q441, Q113, Q463, Q464, Q466, Q467) | 6 |
| 7.2 | **Bundle gate** + drop `ProjectGrid`'s client boundary now the filter is URL state (Q460, Q461) | 3 |
| 7.3 | **Performance** — LCP under 1.5s on a mid-range phone over 4G, public JS under 90KB gzipped, ambient paint cost re-measured against Phase 0's number (Q457–Q459, Q462) | 4 |
| 7.4 | **Accessibility** — `prefers-contrast`, `prefers-reduced-transparency`, `forced-colors`, a `px` audit for OS text scaling, a live region for async saves, chart text alternatives, focus-order test on the log form (Q442, Q449–Q454) | 4 |
| 7.5 | **Before/after screenshot compare mode** in `.shots/` — recorded, not gated (Q29, Q465) | 2 |
| 7.6 | **Two review rounds** — `npm run freeze` snapshot, notes to `web/SITE-REVIEW.md`, as on 2026-08-29 (Q480, Q481) | 3 |

**Ends with:** V4 cannot rot silently.

---

## 4. Ordered summary

| Phase | What | Pts | Feature? |
|---|---|---:|---|
| 0 | Say what is true — docs, and the 8.8px gate mystery | 8 | ✅ done |
| 1 | Tokens, themes, type, space, motion, primitives | 40 | ◐ 1.1–1.4 done |
| 2 | Training, end to end | 45 | **[FEATURE]** |
| 3 | Tags | 12 | **[FEATURE]** |
| 4 | The private shell — sidebar, settings, tab bar | 28 | part · 4.4 done |
| 5 | The private screens | 50 | |
| 6 | Brand and the public site | 36 | |
| 7 | Gates, performance, review | 22 | |
| | **Total** | **241** | |

Pure design work, with both feature phases and the settings screen removed: **~178 pts.**

---

## 5. Rules carried forward

Unchanged by V4 and easy to break while redesigning:

1. **Public routes never import a private loader** and never read a non-whitelisted field.
2. **The vault is written through the GitHub Contents API**, never `fs.writeFile`.
3. **Nothing sensitive in a `"use client"` component** — they compile into unauthenticated chunks.
4. **`/cached` stays static and holds no server data.** Making it dynamic silently kills offline.
5. **The print stylesheet is frozen** (Q123, Q355). The resume page-count gate stays (Q468).
6. **`local-lock.tsx` is built and unmounted** (D-158). Do not delete it while tidying.
7. **1,240 tests is a floor, not a target** (Q470). It was recorded as 582 until Phase 0 re-measured it — re-state the number whenever it moves, or the floor stops being one.
8. **Every decision gets a `DECISIONS.md` entry**, continuing from D-190 (Q477, Q478).
9. **Lands on main, screen by screen** (Q25, Q479). Inconsistency is acceptable on private only (Q26).
10. **Colour never signals alone** (Q72).

---

## 6. Deliberately not in V4

| Not doing | Why |
|---|---|
| **User-defined categories** with their own fields | Categories drive forms, validation, summary lines and the search index from code. Making them data is a V5-sized change. Tags (Phase 3) fix the complaint for a tenth of the cost — revisit once you know which tags you reuse |
| **Global private search** | Your call (Q373): once the app is more built out. V5 |
| **The search keyboard shortcut** | Two of the three shortcuts ship (capture, log); search waits for the feature (C14) |
| **A fourth typeface** | Q99, Q100 |
| **Page transitions, View Transitions API** | Q183, Q184 |
| **A spring/physics library** | Q190 — $0 budget |
| **Pixel-diff visual regression** | Q465 — a pixel baseline for a design in flux is a full-time job |
| **A `/uses` or colophon page** | Q300 — the case studies carry it |
| **Route-reactive ambient gradient** | Q163 — every navigation would read as a repaint |
| **Emoji, illustration, placeholder imagery** | Q217, Q226, Q276 |
| **Replacing recharts** | Q227 — revisit only if the bundle gate catches it |

---

## 7. Risks, stated plainly

**R1 · The portfolio stays as it is through peak application season.** `internship_pipeline.md`
targets five applications a day during peak Fall for Summer 2027 roles. Today is 2026-09-06;
that season is now through roughly November. Phase 6 is sixth. **You were shown this and chose
private-first anyway** (follow-up answer), so it is recorded as accepted, not as an oversight.
The escape hatch is cheap and stays open: items **6.4 (About)** and **6.8 (resume screen)** are
the two pages a recruiter actually opens, cost 11 pts together, and can be lifted out of Phase 6
and run immediately after Phase 1 without disturbing anything else.

**R2 · The budget is out by ~100 points.** You said 120–140; this is 241. Not a padding problem —
it is Phase 2 (45) plus Phase 3 (12) plus the settings screen, none of which were UI work when
you set the number. Three honest readings: the number moves to ~240; or the feature phases move
to V5 and V4 is ~178; or you stop after Phase 5 with the private app finished and the portfolio
untouched. **Every phase boundary is a coherent stopping point** — that is why they are ordered
this way. No recommendation here; it is a priorities call, not an engineering one.

**R3 · Phase 2 reverses a decision that has been declined twice** — 2026-08-30 on cost, and again
2026-09-03 when D-159 found a cheaper way to the same PR board. It is being reversed a third time
because §4a's design is already written and the cheap path does not give you sessions. **The
danger is the sync surface**, not the UI: `workouts` gains a client key, and D-169's mirror
currently keys on the server id precisely because the phone cannot create one. Get 2.4 wrong and
you lose a workout that only ever existed on the phone. Build 2.4 before 2.5, and test it against
PGlite and offline e2e before any of it is styled.

**R4 · Five themes is five times the surface.** Every contrast test, theme sweep and screenshot
multiplies. Cap the swept pages, or cap the themes at three plus two unswept experimental slots.

**R5 · A half-migrated app for the length of Phase 1.** Accepted (Q472), private-only (Q26).
It is longer than it sounds: 42 points before any screen looks finished.

**R6 · The 8.8px gate (C7) may be a real hole.** If `npm run shots` has not been checking text
size the way the docs claim, other rules in the same sweep deserve the same suspicion before
Phase 7 builds four more on top of them.

**R7 · Q130 is the hardest item to verify.** "Too much read-only text defeats the point" cannot
be measured by a gate. It is the standing instruction across Phase 5 and the thing most likely to
be quietly skipped, because turning prose into structure is slower than restyling prose.

---

## 8. Blocked on Victor

Small, and none of it blocks Phase 0 or Phase 1.

1. **Q375 is garbled** — *"I do not like the manual sync being in more. It should be in settings
   (the Match the ...)"*. Manual sync moving to settings is built either way. What did the
   parenthesis mean?
2. **Q402 — are log entries editable after saving?** Left at "no default". Phase 2's session
   logging and Phase 3's tags both effectively need it (you will mistype a weight). Confirm, and
   note that D-164's guard exists precisely so `fileEntry` can only move an entry *out* of the
   unsorted pile — a general edit path needs its own guard.
3. **C15 — the mark cannot be five things at 16px.** Q31 wants all five pillars; Q32/Q33 want one
   representational object legible at favicon size. Which single object is the mark? The five-pillar
   lockup then lives on the splash and OG image, where it has room.
4. **C11 — is nine private routes the right number?** Your Q258 note says the scrolling bar
   indicates "too much going on there". The sidebar fixes the presentation; it does not answer
   whether any two of Today / Now / Log / Athletics / Academics / Work / Calendar / Hobbies / Sync
   should merge.
5. **The five themes need looking at.** They are correct — every ratio is solved and tested —
   but correct is not the same as good, and `carbon` and `steel-light` exist specifically for you
   to judge. The kitchen-sink page (§1.11) is where that happens; until then they can be switched
   from the theme toggle.
6. **The Samsung paint number** (§0.6). `npm run paint` gives a desktop and a throttled-proxy
   figure; the real one needs the phone. Procedure is printed by the script — `chrome://inspect`,
   port-forward 3000, record six idle seconds of Rendering + Painting with the layer on and off.
   Ten minutes, and it is the number V4 §1.4's redesign gets held to.
7. **Q482 — does anyone review the public site but you?** Affects how Phase 7's review rounds are
   run, nothing else.
8. **R2 — which reading of the budget?** ~240 points, or features to V5, or stop after Phase 5.
   Answerable later; Phases 0 and 1 are common to all three.
