---
updated: 2026-09-18
domain: engineering
stability: volatile
summary: V4 — the UI overhaul. Scoped by 484 questions on 2026-09-06. Ten phases, 454 points, 378 done. Phases 0, 1, N, 2, 2+, 2++, 3, 4 and 6 done (Milestones A, B and D); Phase 5 is next.
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
does not ship. It comes from your own answers: _instrument_ (Q14), _precise and clean_ (Q17),
and the one that matters most — **"the point of this project is to list my ideas; too much
read-only text defeats the point"** (Q130).

---

## 0. TLDR

|                  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**         | The app stops looking like a vault renderer and starts looking like an instrument. Both themes designed, both surfaces coherent, the two worst screens rebuilt.                                                                                                                                                                                                                                                                                                  |
| **Scope**        | A UI overhaul **plus three features your answers require** — training logging, tags, and a settings screen. §2.1 explains why that is not scope creep. Plus **Phase N**, a bug found during V4 and not UI work at all.                                                                                                                                                                                                                                           |
| **Budget**       | **454 points** (311 + Phase 2++'s 119, plus §2.12's 13 and §2.13's 11). You said 120–140. The gap is real, it is §7 R2, and Phase 2++ widened it deliberately: it is larger than Phase 2 (45) and Phase 5 (50) together, and it is the phase that answers what Victor actually asked for after using Phase 2. **378 done** — §4 has the authoritative table. |
| **Order**        | Foundations → tokens → **degraded network** → training → tags → private shell → private screens → brand+public → gates.<br>**Phase 0 done** (2026-09-06). **Phase 1 done** (2026-09-08) — **Milestone A**. **Settings (4.4) done** (2026-09-08). **Phase N done** (2026-09-08). **Phase 2 done** (2026-09-09) — **Milestone B**. **Phase 2+ done** (2026-09-09). **§2.12 done**. **Phase 2++ done** (2026-09-10) — the figure, the audit, the browser, the logger, routines, and Phase 5.6 pulled forward whole. **§2.13 done** (2026-09-10). **Phase 6 done** (2026-09-10) — **Milestone D**, taken out of order because the portfolio was otherwise untouched through peak application season (§7 R1). **7.2 done with it** (D-223): the projects grid's client boundary fell out of moving its filter into the URL. **Phase 3 done** (2026-09-13) — tags. **Phase 4 done** (2026-09-18) — the sidebar, the phone title bar, the tab bar, the glyph, two columns, and the accessibility floor.<br>Next: **Phase 5**, the private screens — **Milestone C**. N9 still parked. |
| **Milestone A**  | End of Phase 1 — every colour, size, space and motion value comes from one place, and a test fails if it does not.                                                                                                                                                                                                                                                                                                                                               |
| **Milestone B**  | End of Phase 2 — you log a gym session on the phone, offline, the way Hevy does it.                                                                                                                                                                                                                                                                                                                                                                              |
| **Milestone C**  | End of Phase 5 — the private app is finished. This is the one that matters daily.                                                                                                                                                                                                                                                                                                                                                                                |
| **Milestone D**  | End of Phase 6 — the portfolio is finished. ✅ **Reached 2026-09-10.** |
| **Done when**    | You open the app on a term morning and the first thing you see is the thing you have to do. And a stranger opens victorgusev.com and does not think "student project".                                                                                                                                                                                                                                                                                           |
| **Biggest risk** | ~~Phase 2 is a feature, not a redesign, and it reverses a decision declined twice.~~ **Spent, and it held** — see §7 R3. The largest remaining risk is R7: Q130 — "too much read-only text defeats the point" — is the hardest thing here to verify, and Phase 5 is where it is either answered or missed. |

**Points are difficulty, not schedule** (Q28). One point ≈ one hour of focused work, used to
compare items against each other. Do not plan a calendar from them.

---

## 1. What V4 is, in one paragraph

The bones are good and stay (Q1: refinement). The execution is uneven: colour was one hex value
plus a handful of `color-mix()` calls (the plan guessed forty; there were **nine** — the real
scattering was ~300 opacity utilities), spacing is invented per page, mono type has escaped from
data into decoration, light mode was computed rather than designed, the desktop private nav is a
horizontally scrolling bar on a 1440px screen, and the screen you use most — the training log —
is the one that fights you hardest. V4 fixes the system first, then the screens, then the
portfolio.

**Colour is now done** (§1.1–1.4, 2026-09-07): five themes, every value solved for a contrast
ratio by a generator rather than picked by eye. Phase N was added on 2026-09-08 and is the one
item here that is not about how the app looks.

---

## 2. What was decided

Every answer is here, grouped. Where an answer contradicts something already built or already
written down, it says so and names the entry. Sixteen contradictions were found; all sixteen
are resolved below.

### 2.1 · Scope — Q12 is overruled by your own answers

**Q12 said "appearance plus interaction feel; no new features."** Eight other answers ask for
features:

| Answer                 | The feature it requires                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| Q6, Q71, Q73           | A theme **system** — several selectable palettes, not two CSS blocks     |
| Q131                   | A density toggle, stored                                                 |
| Q369, Q370, Q371, Q375 | A real `/private/settings` route                                         |
| Q391                   | Hevy-shaped training logging, an exercise database, fuzzy search, AI-add |
| Q409                   | A searchable PR table, readable mid-workout                              |
| Q325                   | Sortable projects                                                        |
| Q422                   | A calendar/agenda view switch                                            |
| Q3 → follow-up         | Free tags on any entry                                                   |

**Resolution: the specific answers win, Q12 is struck.** V4 is a UI overhaul with a named
feature track. It is recorded this way rather than quietly built, because "no new features" in
the plan and four new tables in the repo is how a plan stops being read.

**Two consequences.** The budget moves (§7 R2), and every feature item below is marked
**[FEATURE]** so the pure-design work can be separated if you ever want to stop early.

### 2.2 · Training — reverses a decision closed twice **[FEATURE]**

**Q391 asks for:** an exercise database like Hevy's, your own additions to it, fuzzy search, an
"AI ADD" path where you describe a workout and it finds or creates the exercise, and session-
based logging — several exercises and their sets saved as one workout. A separate page is fine.

**What it contradicts.** `docs/SYNC_DESIGN.md` §11.1 asked "does the phone create workouts?",
answered _yes_, then **reversed to no on 2026-08-30** because the parent/child foreign-key
problem cost Phase 1 five hours it did not have. D-159 re-examined it on **2026-09-03** and
declined again, solving the symptom instead: `allEfforts()` unions `workout_sets` with the sets
inside `log_entries`, so quick-logged sets reach the PR board without the phone ever creating a
session. `web/context.md` states the constraint directly: _"`workouts`/`workout_sets` are
pull-only, mirrored by the server's `id` rather than a client key, which is safe only while the
phone cannot create one. Making them writable means giving them a client key first."_

**This is now reversed, deliberately, for the third answer.** The design does not need
rediscovering: **`SYNC_DESIGN.md` §4a is it**, written and never built. A workout create is a
single aggregate op carrying the session and all its sets, applied in one transaction. §4a's own
note says reverting §11.1 is the only other change needed.

**Placement:** its own phase, immediately after tokens (your follow-up answer). Not first,
because it would be styled twice; not last, because you would spend the whole term logging
training the way you do now.

### 2.3 · Tags — the answer to your actual complaint **[FEATURE]**

**Q3, your strongest complaint:** information with no existing category is hard to organise
after logging. A recipe you want to try has nowhere to go.

Nothing in the other 483 answers addresses this, and no amount of visual work will:
`lib/log/categories.ts` is a **fixed code-level list**, and `fileEntry` can only move a note
_into_ a category that already exists (D-164). Adding a kind of thing currently requires a
commit.

**Resolution: free tags on any entry** (follow-up answer). Any log entry, note or task takes
arbitrary tags; filing from the unsorted pile becomes tagging rather than choosing from a closed
list; tags are browsable and filterable. One column, one input, one filter — and it never needs
code again to hold a new kind of thing.

User-defined _categories_ (with their own fields, forms, validation and summary lines) are
scoped to V5, once you have seen which tags you actually reuse. §6 records why.

### 2.4 · Colour — light mode is the teal palette

**The contradiction:** Q6 keeps magenta as primary; Q78 says light mode should use **teal**;
Q79 and Q84 keep magenta-derived values in light. All three cannot hold.

**Resolution (follow-up answer): two full palettes, one per theme.**

| Theme     | Accent                                                                    | Ground                                                       | Source                    |
| --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------- |
| **Dark**  | Magenta `#d94f93`, re-tuned slightly less saturated and warmer (Q48, Q49) | Near-black carrying the magenta hue, three levels (Q55, Q56) | D-002, V2                 |
| **Light** | Teal `#09A1A1`, darkened for contrast on paper                            | Warm paper carrying a teal tint (Q77, Q78)                   | The original six swatches |

**This dissolves Q47.** `brand_and_voice.md` has said teal leads since 2026-08-20 and looked
stale for six weeks. It is not stale — it is **the light theme's specification**, and Phase 0
rewrites it to say so. Steel, pale blue, rose and peach come back into play as the light
palette's structural and chart colours, which is what they were chosen for.

**Everything else in §3–§4 stands:** three grounds, two muted foregrounds, a success green, a
warning colour, destructive shifted toward orange-red so it does not read as the magenta accent,
a dedicated focus colour that survives on a filled button, styled selection and desktop
scrollbars, colour never signalling alone (Q72).

**Amended 2026-09-08, twice, both on Victor's instruction:**

- **The default dark theme is `carbon`, not `dark-magenta`** (D-197). Magenta is still shipped
  and still solved; it is now the identity of a _theme_ rather than of the site. The table above
  describes the palettes correctly — what changed is which one opens by default, and that one
  constant also drives the public portfolio's pin, the app icon, the splash screen and the
  status bar.
- **Amber is a signal and never decoration** (D-196). The eyebrow used `--highlight`, which is
  hue 70 in all five themes because it is the warning hue — so those labels were pinned to
  orange regardless of theme. They take `--primary` now. This retires the old
  `brand_and_voice.md` rule "amber is spent on eyebrows and emphasis"; the rule was the bug.
  Carbon made it visible rather than causing it.

### 2.5 · Themes are a registry, not two blocks

Q6 ("let me explore other themes in a settings mode"), Q71 (a high-contrast dark variant) and
Q73 ("build out several themes to try, then I will determine my favourite") together mean the
current architecture — a `:root` block and a `.dark` block — cannot hold V4.

**Decision: themes become data.** A registry of named palettes, each a complete token set, one
of which is applied. Consequences that are easy to miss:

- **Q469's token test** must assert completeness across _every_ theme, not two.
- **Q464's theme sweep** in `npm run shots` becomes _N_ × pages. Cap N or cap the swept pages.
- **Public and private differ** (Q76): public offers light/dark/system only (Q87, Q88); the full
  picker lives in private settings. A recruiter does not need your colour experiments.
- Ships with **five**: carbon (**the default** since 2026-09-08, D-197), dark-magenta,
  light-teal, high-contrast dark, and steel-light. Carbon and steel-light shipped as the two
  experimental slots; one of them has since been promoted, which is what the slots were for.

The default is named **once**, in `web/src/lib/theme/registry.ts`. Everything derives from it —
the `:root` block in the generated CSS, the icon ground, the manifest, the status bar, and the
theme the public site is pinned to. It was two literals in two files until D-197, and the way
that fails is silent.

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
(Q197). `prefers-reduced-motion` gets _designed_ opacity-only alternatives rather than the
current blanket 0.01ms collapse (Q207).

### 2.8 · Private app — shell and screens

Desktop nav becomes a **collapsible sidebar** with persisted state (Q360–Q363); the two nav
components stay separate, as D-132 decided (Q358). Your Q258 note — _"the top bar is scrolling.
This is an indication of too much going on there"_ — is the reason: eight routes in a scrolling
mono row at 1440px. The sidebar fixes the presentation. **Whether nine routes is the right number
is not answered and is in §8.**

`PageHeader` collapses into the nav on phones, where it currently costs ~110px above the first
action on every screen (Q132, Q133). Tab bar keeps its five items, gains filled active icons and
an outbox badge (Q364, Q367, Q287). A real `/private/settings` holds the theme picker, density
toggle, push, install, **manual sync** and sign-out — your rule: _anything that affects the
website and is not used regularly goes in settings_ (Q369–Q371, Q375).

Screens: Today keeps its measured order (Q376) with summaries collapsed (Q378). Athletics leads
with the adjusted split against the sub-2:00 goal as a gauge (Q406, Q407) and gets a record board
(Q409). Academics renders the audit as a progress structure and marks _unverifiable_ distinctly
from _failing_, which D-187 built in logic and never showed (Q415, Q417). Work becomes a kanban
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

| #   | Contradiction                                                         | Resolution                                                                                                                                      |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Q12 "no new features" vs eight feature answers                        | Q12 struck; §2.1                                                                                                                                |
| C2  | Q391 vs `SYNC_DESIGN` §11.1 (closed 08-30) and D-159 (declined 09-03) | Reversed deliberately; §4a is the design; §2.2                                                                                                  |
| C3  | Q78 teal vs Q6/Q79/Q84 magenta in light                               | Two palettes, one per theme; §2.4                                                                                                               |
| C4  | Q47 — `brand_and_voice.md` looked stale                               | It is the light theme's spec; rewritten in Phase 0                                                                                              |
| C5  | Q25 public-last vs peak application season (§7 R1)                    | Your call, kept, logged as an accepted risk                                                                                                     |
| C6  | Q6/Q71/Q73 vs the two-block CSS architecture                          | Theme registry; §2.5                                                                                                                            |
| C7  | Q112 — 8.8px text passing a 12px gate                                 | **Possibly a live bug.** Investigated in Phase 0, not assumed                                                                                   |
| C8  | Q305 "order is right" vs Q309/Q321 adding blocks                      | Insertion, not reorder                                                                                                                          |
| C9  | Q315 keeps the spotlight glow vs Q176/Q177 "subtler"                  | Different components; allowed, noted                                                                                                            |
| C10 | Q130 vs a pure visual pass                                            | Prose→structure is a standing instruction, §2.8                                                                                                 |
| C11 | Q258 "too much going on" vs keeping nine routes                       | Presentation fixed; the count is open, §8                                                                                                       |
| C12 | Q375 "(the Match the ...)" is garbled                                 | ✅ **Closed 2026-09-08.** It was naming the theme toggle, whose `system` option is labelled "Match the phone". Both are in settings now (D-195) |
| C13 | Q402 unanswered vs Q391 and tags both needing edit                    | §8                                                                                                                                              |
| C14 | Q373 defers search to V5 vs Q448 wanting a search shortcut            | Shortcut waits for the feature                                                                                                                  |
| C15 | Q31 five pillars vs Q32/Q33 representational at 16px                  | Five objects cannot read at 16px. One object is the mark; the five-pillar lockup lives on the splash and OG image. §8 confirms which object     |
| C16 | Q465 no pixel-diff vs Q29 before/after shots                          | Compatible: record, do not gate                                                                                                                 |

---

## 3. The build

Nine phases. **Each ends with the app in a coherent state** — stopping after any phase leaves
something shippable, which is the whole reason for this ordering.

---

### Phase N · Degraded network — **45 pts** — ✅ **DONE 2026-09-08**

**Not UI work, and not in the original 484 questions.** It is here because it was found during
V4 and because every screen Phases 5–7 build is a screen this bug hangs.

Reported from plane wifi: the app freezes when the connection is bad but not gone. The cause is
one sentence — **no network call the browser makes has a deadline.** `fetch()` has no default
timeout, so a request that connects and then stalls waits indefinitely. The whole offline story
is `try/catch`, and a `catch` only fires on a rejection, so every fallback in the app is
unreachable in exactly the condition it was written for. `navigator.onLine` is `true` on plane
wifi, so the one signal the app consults actively lies.

**The full diagnosis and the item-by-item plan are in [`DEGRADED_NETWORK.md`](DEGRADED_NETWORK.md).**
Summary of the eight items:

| #   | Item                                                                                 |     Pts | Result                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------ | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N1  | One deadline helper — `fetchWithDeadline`, budgets as named constants                |       3 | ✅ `lib/net/deadline.ts`. The worker keeps its own copy — it cannot import — and a test fails if the two drift (D-204)                                                 |
| N2  | The service worker races the network; stop retrying stalls                           |       8 | ✅ Plus stale-while-revalidate for anything precached, which is safe because the cache name carries the build id (D-205)                                               |
| N3  | Intercept RSC navigations — **the tab-tap freeze**, currently not intercepted at all |       5 | ✅ **And the framework assumption was verified, not trusted** — Next really does fall back to a hard navigation. No `location.href` escape hatch needed (D-210)        |
| N4  | Sync cannot wedge — a stalled flush currently disables "Send now" until reload       |       3 | ✅ Deadline on `httpPoster`, watchdog on the mutex, and `online` no longer swallowed by backoff (D-209)                                                                |
| N5  | Writes stop depending on the network — watchdog now, outbox-always later             |       3 | ✅ **The plan's wording was false in the live app and was changed** (D-206). The implementation also had to avoid `setState` inside a `<form>` (D-207) — see §7 R5     |
| N6  | Stop prefetching into a stalled pipe — HTTP/2 shares one TCP connection              |       3 | ✅ Gated on evidence, so a good connection keeps its instant tab transitions                                                                                          |
| N7  | A reachability signal the app owns, said out loud once and quietly                   |       5 | ✅ Derived from real request outcomes; never probes. The worker tells the page why it is the fallback, since a hard navigation throws that knowledge away (D-208)      |
| N8  | A degraded-network e2e profile, so it cannot come back                               |       5 | ✅ `npm run e2e:degraded`. Stalls requests rather than throttling them, because a service worker is its own CDP target (D-210)                                         |
| N9  | **Every write through the outbox** — the deferred half of N5                          |      13 | ⏸ Not started, by Victor's call. Deferred because it touches every form and Phase 2 rebuilds one                                                                      |

**Measured after the fact:** a stalled tab tap reaches a usable screen in **~6.1s** — the 3s RSC
deadline plus the 3s navigation deadline — a direct navigation falls back in **~3.1s**, and a
precached public page opens in **~90ms** without touching the network. Every one of those was
unbounded before.

**Three bugs were found by running it rather than reading it**, and each had passed every unit
test that existed: the slow-save notice would have re-enabled the save button mid-POST (D-207),
the app went silent the moment it landed on the fallback screen (D-208), and `online` was being
swallowed by the sync backoff (D-209).

**Ends with:** a bad connection changes how fast the app is, never whether it works. ✅

---

### Phase 0 · Say what is true — **8 pts** — ✅ **DONE 2026-09-06**

Nothing renders differently. This existed because three documents described a codebase that had
drifted away from them, and every phase below is read against those documents.

| #   | Item                                                                                  | Pts | Result                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------- | --: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 | Rewrite `brand_and_voice.md`: teal is the **light** palette, magenta the **dark** one |   2 | ✅ Done. Contrast measured, not asserted — `#09A1A1` is **2.94:1 on paper** and cannot carry text, so the light token is that hue darkened to `#0a7474` (5.2:1)                                                            |
| 0.2 | Rewrite `web/context.md` §Theme for the registry                                      |   1 | ✅ Done. Found **two further staleness bugs**: it said the dark palette lives in `:root` with `.dark` mirroring it (D-184 inverted this), and that `<html>` carries a hardcoded `dark` class (`next-themes` replaced it)   |
| 0.3 | Create `web/DESIGN.md`, referenced from the routing table                             |   1 | ✅ Done. Routing table in `CLAUDE.md`/`AGENTS.md` gained rows for `DESIGN.md` and this plan                                                                                                                                |
| 0.4 | Investigate the 8.8px text passing a 12px gate                                        |   2 | ✅ Done — **the prediction was wrong and the truth is worse.** D-190                                                                                                                                                       |
| 0.5 | Audit hover-only affordances                                                          |   1 | ✅ Done. **2 real faults**, 3 already correct, 3 acceptable. D-191                                                                                                                                                         |
| 0.6 | Measure the ambient layer's paint cost                                                |   1 | ✅ Harness built (`npm run paint`, D-193) and run. **Both deltas came back below the noise floor** — the layer's cost is not measurable here. The Samsung number is still owed and is the only one that can settle it — §8 |

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

|                              |                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Horizontal overflow          | 0 everywhere — the one gate that works, passing                                  |
| Sub-12px text, public        | 68 per width (home 11, projects 24, project-detail 28, resume 5)                 |
| Sub-40px tap targets, public | 13–16 per width                                                                  |
| First action, phone          | today 208px · log 205px · academics 266px · calendar 297–362px · athletics 342px |
| Signed-in header             | fits at all widths; name 46px at 360, 97px at desktop                            |

Athletics at 342px and calendar at 362px are the two closest to the 500px limit and are the
first to break when Phase 5 adds anything above the fold.

**Ambient layer, 2026-09-06** (`npm run paint`, 2 pairs of 5s, headed):

|                                 | on          | off         | delta | noise |
| ------------------------------- | ----------- | ----------- | ----- | ----- |
| Desktop 1280, drift ON          | 123.65 ms/s | 119.65 ms/s | +4.00 | ±6.93 |
| Phone proxy 390 @ x6, drift OFF | 31.58 ms/s  | 32.12 ms/s  | −0.54 | ±0.82 |

**Both deltas are inside the noise.** This changes an argument in §1.4: **do not redesign the
ambient layer for performance.** D-179 disabled the drift below 40rem on a first-principles
cost argument, and nothing measurable on this machine supports it — which does not clear the
Samsung, where a mobile GPU, a tiled renderer, thermal throttling and OLED draw all exist and
none of them are reproduced here. Redesign the layer because the gradients were placed by eye
once (Q162). That reason needs no measurement.

---

### Phase 1 · Tokens and primitives — **40 pts** — ✅ **DONE 2026-09-08** · **Milestone A**

The system. Every screen depends on it, which is why it is first (Q471), and why a period of
half-migrated screens is acceptable (Q472).

| #    | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Pts |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --: |
| 1.1  | ✅ **Done.** Tokens in OKLCH, **generated** from contrast targets by `scripts/build-tokens.mts` — a token is declared as "teal, at whatever clears 5.4:1 on a card" and the solver returns it. Three grounds, two muted levels, success/warning, dedicated ring, 50–950 ramp. _The plan said forty `color-mix()` calls; there were nine — the scattering was in ~300 opacity utilities, which still work and migrate screen by screen_                                                                   |   6 |
| 1.2  | ✅ **Done.** Five themes: dark-magenta, light-teal, hc-dark, and two experimental — `carbon` (hueless near-black) and `steel-light` (steel as accent, a deliberate test of the "steel is never interactive" rule). `data-theme` only; the `dark:` variant is a **generated** selector list, verified in the production bundle. _2026-09-08: `carbon` was promoted to the default (D-197) — the experiment worked. The generator now reads the default from the registry instead of hard-coding it twice_ |   5 |
| 1.3  | ✅ **Done.** Chroma 0.17 → 0.145, hue 356 → 346, primary `#d36da8` at 5.22:1. Three grounds with a wider step than the old pair                                                                                                                                                                                                                                                                                                                                                                          |   3 |
| 1.4  | ✅ **Done.** Teal on warm paper, primary `#007777` at 5.26:1. Grain off and pools at 0.45 — as **tokens**, not scheme selectors, so they are right on the first painted frame. _Shadow-based elevation is component work and lands with §4/§5_                                                                                                                                                                                                                                                           |   5 |
| 1.5  | ✅ **Done.** Nine steps, modular 1.2, anchored at `base = 1rem`, **generated** by `scripts/build-scale.mts` into `src/app/scale.css` — same generated-and-checked pattern as the palettes. It redefines **Tailwind's own nine names**, which are exactly the nine in use across 466 call sites, so every existing `text-sm` became scale-correct with no migration. Two hand-adjustments, both at the ends (Q101): `5xl` → 48px, and `xs` lifted from 11.11px to **12px** so the app's smallest text stopped shrinking — measured, that moved `npm run shots` from 157 sub-12px elements per width to **53**, against a 68 baseline |   4 |
| 1.6  | ✅ **Done.** Mono left nav, eyebrows, the tab bar and panel meta. **246 occurrences → 186**, and **53 eyebrow call sites across 30 files** collapsed onto one `@utility eyebrow` — they had drifted to six sizes and six trackings for one idea. The tab bar's 8.8px labels (D-190) are 12px. The remaining 186 are an **audit** in `DESIGN.md` §4, judged screen by screen in Phases 4–6, because most of them are dates and splits and are correct |   3 |
| 1.7  | ✅ **Done.** Eight spacing values, all multiples of 4px. Four named radii scaling with the size of the thing. Four elevation levels — **per theme**, because DESIGN.md §6 makes elevation a ground-shift plus a border in dark and a shadow in light, so `scale.css` publishes the names and `build-tokens.mts` writes the values. One breakpoint set under two spellings with a test pinning each pair; `min-[380px]` is gone. A `--scrim` token came out of it (see 1.10) |   4 |
| 1.8  | ✅ **Done.** Three durations, three easings, `card-scan` lost its 3px lift, the stagger moved from six inline `animationDelay` styles to a container `rise-stagger` utility. The two new utilities are **`press`** (the sub-100ms tap feedback DESIGN.md §9 calls the app's biggest gap on a phone) and **`shimmer`** (the loading sweep Phase 5.1's skeletons need); both are named by later phases, so neither is speculative |   3 |
| 1.9  | ✅ **Done.** `icon-sm`/`md`/`lg` at 16/20/24, in `rem` so they scale with OS text size. Stroke 1.75 set **once**, on the class lucide already emits — it renders `stroke-width` as an SVG presentation attribute and CSS outranks one, so it reached every icon without a call site passing a prop |   1 |
| 1.10 | ✅ **Done.** Ten unused components deleted, nine kept (the two in use plus seven named by Phase 3/4/5 items), all hand-reworked at the V4 tokens, and `ui/*.tsx` removed from `.prettierignore` — the directory is ours now. `tw-animate-css` dropped; its only four call sites were in the delete set. **One real bug fell out:** `sheet.tsx` scrimmed with `bg-black/10`, which does nothing over a near-black ground, so the sheet opened undimmed on three of five themes — now a per-theme `--scrim`. **And `form.tsx` never existed** — no commit in this repo's history contains it; the three documents claiming otherwise were corrected (D-200) |   2 |
| 1.11 | ✅ **Done.** All **five** themes side by side in one browser, not two — `tokens.css` scopes palettes with a bare `[data-theme]` attribute selector, so the attribute on a `<section>` re-declares the palette for its subtree. Not in the nav (C11 is still open); swept by `npm run shots` |   2 |
| 1.12 | ✅ **Done.** **126 tests** across three files: `tokens.test.ts` (82 — colour, elevation, the scrim), `scale.test.ts` (39 — asserts *properties*, not pixel values, so changing `RATIO` moves every number and every test still passes), and the **no-raw-hex lint** that was `PENDING` (5, with a positive control, because a scanner that reports nothing looks identical to a broken one) |   2 |

**Milestone A reached 2026-09-08.** Every colour, size, space and motion value comes from one
place, and a test fails if it does not. Two generators, two checked stylesheets, 126 tests.

**Three things this phase found that the plan did not predict**, all from running the code:

1. **`form.tsx` has never existed** in this repo or its history, while three documents said it
   did and one of them told a future editor to protect it. `src/lib/log/form.ts` is a different
   module in a different directory. D-200.
2. **The vendored `sheet.tsx` opened with no scrim on three of the five themes.** `bg-black/10`
   darkens paper and does nothing over a near-black ground. It had no callers, so nobody would
   have seen it until Phase 4.3 shipped the tab-bar sheet. D-200.
3. **Two Tailwind failure modes that produce no error.** An interpolated class name
   (`` `text-${step}` ``) generates nothing because Tailwind scans text rather than evaluating
   code; and `--duration-*` is not a namespace, so `duration-fast` was no CSS at all until three
   `@utility` blocks were generated for it. In both cases the element renders and the style is
   simply absent. Check a new utility in `.next/static/chunks/*.css` before trusting it.

**Measured after, with `npm run shots` (exit 0):** 0 horizontal overflow at any width, 0 resume
variants over one page, every private page 200. Sub-12px elements went **68 → 53** per width and
`/private/athletics`, the screen closest to the fold limit, improved from 342px to **335px**.

---

### Phase 2 · Training, end to end — **45 pts** **[FEATURE]** — ✅ **DONE 2026-09-09** · **Milestone B**

Its own phase because it is a feature, not a redesign. §2.2 has the reversal; `SYNC_DESIGN.md`
§4a has the design.

| #   | Item                                                                                                                                                                                                             | Pts |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --: |
| 2.1 | **`exercises` table** — a seeded catalogue plus your own additions, with muscle group and modality so the session form knows which fields to ask for                                                             |   6 |
| 2.2 | **Fuzzy search** over the catalogue. Client-side, so it works offline — the whole point                                                                                                                          |   4 |
| 2.3 | **"AI ADD"** — describe a workout, it finds the match or creates the exercise. Reuses `lib/ai/gemini.ts`. **It proposes; you confirm.** Same rule D-186 set for voice: the model cannot save                     |   5 |
| 2.4 | **`SYNC_DESIGN` §4a — the aggregate op.** `workouts` gains a client key; a session and all its sets are one outbox entry applied in one transaction. Reverses §11.1                                              |  10 |
| 2.5 | **Session logging screen** — exercise → sets, numbered (Q399), duplicate-last-set (Q400), running totals (Q398), three taps per set (Q392). Its own route, which you said is fine                                |   8 |
| 2.6 | **PR board + searchable PR table** (Q409), including **PRs visible while logging** — the reason the table exists                                                                                                 |   5 |
| 2.7 | **Reconcile with D-159.** `allEfforts()` currently unions two sources. With sessions writable, decide whether quick-log training stays or folds in. **Do not add a third reader** — that is D-159's whole design |   3 |
| 2.8 | **Tests:** PGlite against the committed migrations, sync round-trip, offline e2e. The 1,240 count may not drop (Q470)                                                                                            |   4 |

**Ends with (Milestone B):** you log a gym session on the phone, offline, and it syncs. ✅
**Proven, not argued:** `npm run e2e` logs a session with no network, finds "Bench Press" by
typing `bnch` into the mirrored catalogue, queues it as **one op with no separate set ops**,
reconnects, and watches it land in real Neon with both sets pointing at a foreign key the phone
never saw — 185×5 and 175×8.

**Two things were found by running it rather than reading it:**

1. **The aggregate op had no atomicity on the driver that actually runs it** (D-212). Production
   uses `neon-http`, which has no transactions; PGlite, which every database test uses, does. The
   op passed sixteen tests and 500'd on the first real session. The whole argument for §4a is
   that no partial session can exist, and there was no atomic primitive at all.
2. **Retiring the log category silently removed the only way to record a weigh-in from the
   phone** (D-215). `bodyweightLbs` was a field on it. Two tests caught it by suddenly having no
   field to read; the field followed the feature onto the session screen.

---

### Phase 2+ · The catalogue gets pictures — **12 pts** — ✅ **done 2026-09-09**

Parked on 2026-09-09 in the morning, unparked the same afternoon: Victor sent the reference art
and asked for it while reporting the Phase 2 bugs below. The shape changed on the way through, and
the change is the interesting part.

| #    | Item                                                                                                                                                   | Pts | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --: | ------ |
| 2.9  | **A muscle diagram**, front and back, one inline SVG with a path group per region, highlighted from the exercise's own `muscles` array                   |   5 | ✅ done |
| 2.10 | **A written how-to per movement** — two sentences: setup, execution, the usual mistake. *Replaces* the demonstration clips                              |   5 | ✅ done |
| 2.11 | **Offline behaviour for both** — nothing to do. Both are in the bundle, so there is no request to make and no asset to cache                             |   2 | ✅ n/a  |

**2.10 changed, and the reason was not technical.** There is no lawfully reusable set of 164
demonstration clips: the ones that exist belong to the apps that made them — including the
reference file — and the openly-licensed collections are stills whose naming does not match this
catalogue. Victor's call was to drop the clips and take a written description instead (D-223).
That is not a consolation prize. Text costs no request and no storage, so it retires 2.11
outright; it is searchable; and it can say the thing a loop cannot — **what usually goes wrong**,
which is the half of a demonstration that changes the next set.

**2.9 is one drawing, not 164.** Licensing was the smaller half of the argument. Per-exercise art
— generated or commissioned — is 164 chances for the picture to disagree with the data beside it,
and no test can read a picture. One SVG highlighted from the `muscles` array cannot say something
the catalogue does not (D-222). The paths are original: the reference is stock art, and a trace of
it would have been a derivative of it.

**What it cost.** `muscles` was empty on all 45 erg, water and conditioning entries, with a note
saying it "means little" there. True while it was a grouping key; false the moment a figure is
drawn from it, because an empty array renders as *we do not know* rather than *whole body*. Those
were tagged and reseeded. Mobility, stretching and foam rolling stay blank on purpose.

---

### §2.12 · Four things Victor found in Phase 2 — **13 pts** — ✅ **done 2026-09-09**

Reported after the first real use of the session screen on the phone. Not a phase in the original
plan; it is here because three of the four were shipped defects and the fourth was older and
worse than the feature that surfaced it.

| #     | What he reported                          | What it actually was                                                                                              | Pts |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --: |
| 2.12a | "Training does not appear on computer"    | The desktop nav never got a Train entry, and the athletics page still pointed at the retired quick-log tab (D-225)  |   2 |
| 2.12b | "Bodyweight should not be every workout"  | Correct. It moved to its own quick-log category, and the session form stopped asking (D-221)                        |   3 |
| 2.12c | "Adding sets is messed up on the phone"   | **Two bugs stacked.** A width collision in the set row (D-220), on top of a token collision breaking six unrelated screens (D-219) |   5 |
| 2.12d | "There is no database of exercises"       | There was — 165 rows. The screen read only the synced mirror, and the pull is paged at 100 (D-224)                  |   3 |

**2.12c is the one worth reading twice.** The set row's own bug was a shared class constant
carrying `w-full` composed with a call site adding `w-24` — same specificity, so the winner is
Tailwind's emit order, not the class attribute. `w-full` won: the select took the whole row, both
number inputs computed to **zero pixels**, and the delete button sat 92px off the edge.

Underneath it was something older. `--spacing-*` is the namespace `max-w-*` consults **before**
`--container-*`, so the named space scale added in §1.7 had silently redefined `max-w-sm`,
`max-w-md`, `max-w-xl` and `max-w-2xl` for the whole app. `/private/settings` had been rendering
its entire content inside a **64-pixel column**, one word per line — and so had both error
screens, the offline screen, the sign-in card, the register card and the update notice.

**Why no test saw any of it.** jsdom does not lay out. Every element there is zero pixels wide, so
a row where five controls fit and a row where two have collapsed to nothing are the same DOM, and
a 64-pixel column is indistinguishable from a 672-pixel one. `scripts/diag-widths.mjs` is the
answer — a real browser at 390px, reporting anything wider than the box holding it — and
`width-conflicts.test.ts` and `scale.test.ts` are the two guards that keep each cause from coming
back.


---

### Phase 2++ · Training, properly — **119 pts** **[FEATURE]** — ✅ **done 2026-09-10**

Scoped by sixty questions on 2026-09-09, after Victor used Phase 2 and asked for the *product*
rather than the mechanism. His summary of the screen: *"ugly / doesn't feel like an app."* His
audit request: *"2k erg and 5k erg both exist, which doesn't make sense."* The reference
throughout is Hevy. It absorbs Phase 5.6 whole.

| #   | Stage                                                                                                                                                      | Pts | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --: | ------ |
| 1   | **The figure**, redrawn at reference fidelity — striated bellies, a prime-mover/assist split, two detail levels, tappable regions; vocabulary 15 → 21 (D-226, D-227) |  13 | ✅ done |
| 2   | **Schema and sync** — a dozen columns on `exercises`, three on `workout_sets`, `exercise_notes` on `workouts`, `routines` + `routine_exercises`, and the name-collision fix (D-228, D-229, D-230) |  18 | ✅ done |
| 3   | **Catalogue v2 and the rename** — 164 → 139, `Movement (Equipment)`, the erg and water collapses, and the one-shot rewrite of logged history (D-231, D-232, D-233) |  20 | ✅ done |
| 4   | **The exercise browser** — list, detail, create, edit, archive-then-delete, alias search, AI-assist on the create form                                       |  18 | ✅ done |
| 5   | **The logger** — previous-set ghosts, tick-to-complete, a rest timer, multi-select picking in a sheet, per-set and per-exercise notes, a table above 64rem   |  16 | ✅ done |
| 6   | **Routines** — saved from a finished session, started pre-filled with the weights it was saved at                                                             |  14 | ✅ done |
| 7   | **The dashboard** — Phase 5.6 pulled forward whole, plus the weekly muscle figure; nav consolidates to one Training area (D-234, D-235)                       |  12 | ✅ done |
| 8   | **Gates, tests, docs** — the new routes in both browser gates, offline create-and-edit in the e2e, and this (D-236)                                          |   8 | ✅ done |

**The audit found more than the example did.** "2k erg and 5k erg" do not literally exist; what
did was `Erg 500m · 1000m · 2000m · 5000m · 6000m · 10000m · Half Marathon · 1/4/20/30/60 Minutes
· Intervals ×4`, four `Paddle` distances and four Ski/Bike variants — **31 of 164 rows were a
distance parameter encoded in a name string**, with an empty `distance_m` column beside them.
They collapse to three erg names and four water ones, and the parameter moves onto the set.
`prs.ts` was already bucketing erg records by exercise *and* rounded distance, so per-distance
PRs survived the collapse with no new code.

**One bug found by reading, not by failing.** `exercises` was unique on both `name` and
`client_id` while a create only conflicted on `client_id`, so two devices adding the same name
raised a raw unique violation — not an `UnknownParentError`, therefore uncaught — which 500'd the
whole batch and left every entity queued behind it retrying forever. A permanent sync wedge from
an index that protected nothing (D-228).

**Two things the gates caught that nothing else would have.** `npm run shots` found Today's fold
gate measuring the wrong element the afternoon the rehab mirror shipped — 1583px against a 500px
limit, with the capture box not having moved (D-235). And `npm run e2e` found that the exercise
browser did not exist offline: everything under it was, but any `/private/athletics/*` path that
was not `/log` fell through to the record board (D-236). "The data layer is offline" and "the
screen is reachable" are different claims, and only the end-to-end run could tell them apart.

**The rename was the only irreversible act, and it turned out to be free.** `--check` reported
**zero** matching sets — no training had been logged through the new logger yet — so the dry run
that R3 asked for turned a belief into a number before anything was written.
`workout_sets.exercise_before_v2` keeps the original string for one release regardless.

---

### §2.13 · The picker on a phone, and a figure that can be licensed — **11 pts** — ✅ **done 2026-09-10**

Reported after the first real use of Phase 2++ on the phone, same shape as §2.12: not in the
original plan, here because one of the two was a shipped defect and the other was an offer worth
taking.

| #     | What he reported                                       | What it actually was                                                                                                             | Pts |
| ----- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --: |
| 2.13a | "the exercise picker opens a sidebar, hard to use"     | Three faults: the search box scrolled away with the list, a drawer gesture for something that is not navigation, and a footer under the keyboard (D-237) |   5 |
| 2.13b | "I searched 'erg' and it was at the bottom of the list" | Not the matcher. The grouping re-bucketed the ranked results and `full body` sorts into `Other`, dead last (D-238)                  |   2 |
| 2.13c | "use the body SVGs from these two repos"               | Neither has a licence. A properly MIT-licensed upstream did, and it is better art than the hand-drawn figure (D-239)                |   4 |

**2.13a is the one worth reading twice.** The complaint named the animation, but the fault under
it was structural: the search box lived *inside* the scrolling region, so the single control that
would take you to any of a hundred and forty rows in one move was itself forty rows away. A fixed
header is the whole fix; the full-screen panel, the chips and the keyboard inset are what make it
sit right on a phone once it is fixed. Verified in a real browser at 390px by
`scripts/diag-picker.mjs`, which measures the three things jsdom cannot see — that the panel fills
the viewport, that the search box is still on screen after 1200px of scrolling, and that the Add
button is above the fold.

**2.13b was ranking thrown away by layout.** `searchExercises` had ranked `Row (Erg)` near the
top and the group buckets discarded that ordering before it reached the screen. Grouping is for
browsing and ranking is for searching; a query now decides which is in force.

**2.13c is a licence question first.** Both repositories Victor found ship the same unlicensed
SVG pair — no `LICENSE` file means all rights reserved — and both are coarser than this vault's
20-region vocabulary. Looking for the same art *with* a licence found
react-native-body-highlighter (MIT), which is better than either, covers 15 of the 20 regions
outright, and needed five regions drawn by hand. D-222 is untouched: one drawing, highlighted
from the catalogue. D-226 — that a careful hand could reach reference fidelity — is reversed.

---

### Phase 3 · Tags — **12 pts** **[FEATURE]** — ✅ **done 2026-09-13**

The answer to Q3. Small, and it fixes the complaint you led with.

| #   | Item                                                                                                                                      | Pts | Result |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | --: | ------ |
| 3.1 | Tags on log entries, notes and tasks. One migration                                                                                       |   3 | ✅ `tags: text[]` on both `logEntries` and `tasks` (D-248), `drizzle/0013_tags.sql`. "Notes" needed nothing separate — a note is `log_entries` with `category = "note"` |
| 3.2 | Tag input with existing-tag suggestions; tags render as tokens, matching the chip language (Q255)                                         |   3 | ✅ `components/site/tag-input.tsx` — same pill shape as `ChipRow`'s recent-value chips in `log-form.tsx`, one hidden `<input name="tags">` per committed tag, a `<datalist>` for suggestions |
| 3.3 | **Filing from the unsorted pile becomes tagging** — swipe right, choose from a sheet (Q396), no longer limited to the fixed category list |   3 | ✅ Two doors, not one: `fileEntry` gained an optional `tags` argument (files *and* tags in one call), and a new `tagEntry`/`tagLogEntry` tags with **no category change at all** — the actual fix for "fits none of the five tabs," since it needs no category to be chosen at all. Both are additive; D-164's one-way-door guard on `category` is untouched |
| 3.4 | Browse and filter by tag                                                                                                                  |   2 | ✅ `?tag=` on `/private/log` (mirrors `?q=` search), a tag browser listing every distinct tag, tag chips on log entries and tasks linking into it. `listEntries`/`listTasks` take a `tag` option (`@>` on the array column) |
| 3.5 | Sync entity registration + tests                                                                                                          |   1 | ✅ **No entity registered — there wasn't one to add.** `log_entry`/`task` are already writable; `tags` went on their existing `PAYLOADS`/`WRITERS` entries in `protocol.ts`/`apply.ts` (D-248). 50 new tests |

**Two things worth reading twice.** First, §3.3 as scoped described one door (filing gains a
tag option); building it surfaced that the *other* door — tagging with no filing at all — is
what actually answers Q3, since "a recipe I want to try" has nowhere to go precisely because
every existing path demands a category first. Second, the vocabulary is intentionally **not**
one shared table: `allTags` and `allTaskTags` are two separate `unnest` queries because
`lib/log/queries.ts` and `lib/tasks/queries.ts` do not import each other, and normalising tag
text the same way (`lib/log/tags.ts`) buys the convergence a shared table would, for a tenth
the machinery (D-249).

**Ends with:** a recipe you want to try has somewhere to go without a commit. ✅

---

### Phase 4 · The private shell — **28 pts** — ✅ **done 2026-09-18**

Navigation, chrome, settings. Everything that wraps a screen rather than being one.
Decisions **D-251 to D-258**. Eight questions were put to Victor before any of it was written;
his answers are recorded inside the items below rather than as a separate list.

| #   | Item                                                                                                                                                                                                                                                                                                                                     | Pts |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --: |
| 4.1 | ✅ **Desktop sidebar** — grouped **Daily** / **Areas**, collapsible, persisted, icon-only below `laptop` whatever the preference says. Width is now three named tokens assigned by route (D-252), not one number. **Nothing merged**: C11 stays open, because a cramped bar is not evidence about how many routes there should be |   6 |
| 4.2 | ✅ **`PageHeader` is a title bar on phones** — eyebrow and lede dropped, **actions kept** (several are `data-first-action`). Measured at 390px: Today 334→297, Athletics 392→235, Calendar 293→179                                                                                                                                  |   3 |
| 4.3 | ✅ **Tab bar** — icons filled at 20% when active (solid turns `CalendarDays` into a rectangle), outbox dot on More plus a count on the row inside, grabber, and a real drag with two snap points and flick detection (`lib/ui/sheet-drag.ts`)                                                                                       |   4 |
| 4.4 | ✅ **Done 2026-09-08** (pulled forward, D-195). Theme picker (switch + five), push, install, manual sync, passkey, public site, sign-out, deployed commit. Both navigations gave the controls up rather than copying them. **Density toggle deferred** — §1.7 has not defined the spacing vocabulary, so it would have nothing to switch |   6 |
| 4.5 | ✅ **Connection/sync glyph**, sidebar footer and phone title bar. It took the quiet queue state off the floating pill, which now speaks only for `stale`, `failed` and a poor connection. One publisher, three readers (`lib/sync/status.ts`)                                                                                        |   2 |
| 4.6 | ✅ **Two-column desktop** — Today (`1fr + 22rem`, act left / read right) and Academics (even, work left / standing right). **Athletics was not re-gridded**: Phase 2++ Stage 7 already built it `lg:grid-cols-2` throughout, so what it gets here is the 80rem column                                                               |   4 |
| 4.7 | ✅ **Part** — skip links (three layouts), landmarks (19 nested `<main>`s removed), and a `:where()` focus-visible floor. **Heading-order was not audited mechanically and focus order has no test**; both move to §7.4                                                                                                              |   3 |

**Ended with:** a shell that does not embarrass itself at 1440px. ✅

**Found while doing it**, none of it scoped:

- **`hidden sm:block` does not work in this app**, and `Stat`'s hint had been spelled that way
  since V1 — so the gloss under every stat number was most likely invisible on desktop as well as
  on a phone. The nav switch was hand-written in V3 precisely because of this (a base utility and
  its own variant both setting `display` resolve to the base at every width); nobody went back
  for the other call sites. Fixed in `page-shell.tsx`; **five remain** — `agenda.tsx`,
  `case-study-toc.tsx`, `private-link.tsx`, `session-logger.tsx`, `task-list.tsx` — and they need
  a `laptop` equivalent of the utility, so they are §7.4's.
- **Nineteen private pages each rendered their own `<main>`.** Harmless until the layout owned
  the column; two nested landmarks the moment it did. Q445's audit therefore happened here.
- **The glyph exposed a gap in `SyncRunner`**: the summary was published only *after* a flush, so
  a failed run left the indicator reading "Checking sync" forever. Invisible while the pill was
  the only reader — a pill that says nothing looks like a pill that has not been computed.
- **`npm run shots` reports 8 private faults on this machine**, and they are environmental: the
  local database is behind the Phase 3 migration, so `/private/log` and `/private/academics`
  render their failure branch and neither draws its `data-first-action` element. Reproduced on an
  unmodified tree before being dismissed. `npm run db:migrate` clears it.

---

### Phase 5 · The private screens — **50 pts**

Milestone C. The phase that changes your day.

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                            | Pts |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --: |
| 5.1 | **Shared states** — one "as of" staleness component used everywhere (Q285, Q286, Q241); empty states that name and offer the action that fills them (Q275, Q277); exact-shape skeletons (Q279); designed error boundary, 404, and the "database is behind this build" state (Q283, Q291, Q292); queued vs failed made unmissable (Q289)                                                         |   8 |
| 5.2 | **Forms pass** — 48px touch targets, labels above, never placeholder-as-label, blur validation, sticky save on long forms, dirty indicator, chips as tokens, the four shortcut kinds made visually distinct (Q245–Q256).<br>**Includes building the toast system** (D-192): mount a `Toaster`, wire the first `toast()`, then style it. Q265–Q268 were scoped as a styling pass and are a build |  10 |
| 5.3 | **Motion and touch pass** — pressed states within 100ms everywhere, redesigned swipe reveals (colour then icon), designed pull-to-refresh, haptics on swipe-complete and save, hover stripped on touch (Q193–Q200)                                                                                                                                                                              |   6 |
| 5.4 | **Today** — capture box made the loudest thing, domain icons on tasks, overdue loud but not red, completed collapsed, summaries collapsed and quieter, agenda with a "now" marker, archive moved to the log (Q376–Q390)                                                                                                                                                                         |   6 |
| 5.5 | **Log (non-training tabs)** — last-used category, drafts surviving restart, today's entries below the form, marked search results (Q393, Q394, Q401, Q404)                                                                                                                                                                                                                                      |   5 |
| 5.6 | ~~**Athletics**~~ — ✅ **absorbed by Phase 2++ Stage 7** (2026-09-10): the gauge, the heatmap, the rehab mirror and the reworked record board all shipped there, plus a weekly muscle figure the original item did not ask for (Q405–Q414)                                                                                                                                                                                         |   6 |
| 5.7 | **Academics** — audit as a progress structure, planner as a board on desktop and table on phone, **unverifiable marked distinctly from failing** (Q415–Q418)                                                                                                                                                                                                                                    |   5 |
| 5.8 | **Work, Calendar, Hobbies, Sync** — kanban pipeline, agenda + month strip + view switch, Google/vault provenance, spool levels and colour swatches, per-item sync reasons designed (Q419–Q428)                                                                                                                                                                                                  |   6 |
| 5.9 | **Charts** — the one number above every chart, near-sparklines on phone and full axes on desktop, the sub-2:00 goal line drawn, tap-to-pin instead of tooltips, tables restructured to cards under 40rem, mount animation off (Q227–Q242)                                                                                                                                                       |   6 |

Throughout: **Q130 applies.** Where a panel is read-only prose, it becomes structured.

**Ends with (Milestone C):** the private app is finished.

---

### Phase 6 · Brand and the public site — **36 pts** — ✅ **DONE 2026-09-10** · **Milestone D**

Taken out of order. §7 R1 recorded the portfolio staying untouched through peak application
season as an accepted risk on 2026-09-06; on 2026-09-10 Victor reversed that and asked for the
whole phase, which is the escape hatch R1 said would stay open. Decisions **D-215 to D-231**.

**Item 7.2 fell out with it** (D-223): moving the projects filter into the URL is what lets the
grid stop being a Client Component, so the two were one change rather than two.

**Found while doing it**, none of which was scoped:

- `favicon.ico` was 25,931 bytes dated the day the repo was created. **The tab icon had never
  been the mark** — it was never part of the icon pipeline, which was written in V3.
- The mark was still a **magenta gradient** two days after D-197 made carbon the default, and
  its folds were cut in `#140a10`, the *magenta* theme's ground. `badge-icon.test.ts` actively
  pinned the mark magenta, so the test agreed with the bug.
- The About hero's contact links joined their class array with `""` instead of `" "`, so
  `transition-colors` and `text-primary` were concatenated and **both were dropped** — since V1.
- `parseSort` used `in`, which walks the prototype chain, so `?sort=constructor` validated.
- **No project in the vault has a single dated `## Updates` entry** (D-230). `/now` is in the
  main navigation and its whole subject is motion; it renders two summaries and stops. Content,
  not code, and the cheapest high-value thing Victor can do before applications.

| #   | Item                                                                                                                                                                                                                                                       | Pts |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --: |
| 6.1 | **The mark** — representational, non-letterform, monochrome, designed at 16px first. §8 settles which object (C15)                                                                                                                                         |   5 |
| 6.2 | **Icon set** — SVG favicon with light/dark variants, padded maskable PWA icon, designed splash, shortcut icons, push badge (Q38–Q40, Q435, Q436)                                                                                                           |   4 |
| 6.3 | **Wordmark + OG images** — tracked display face, mark-only under 380px, per-project and generic OG generated with `next/og`, typographic (Q41–Q45)                                                                                                         |   5 |
| 6.4 | **About** — taller hero, positioning line below the name, a prose paragraph, second CTA, facts as a line on phone and cards above, refined timeline with a desktop date gutter, portrait larger and square with the bloom replaced (Q305–Q321, Q218, Q219) |   6 |
| 6.5 | **Projects** — URL-backed filters, sorting, three columns above 1280px, featured two-column card, whole-card click affordance, restyled status badges, image lightbox (Q322–Q330, Q223)                                                                    |   5 |
| 6.6 | **Case studies** — persistent TOC, opening summary block, hidden-when-missing sections, styled code blocks, next-project link, distinct updates timeline, prominent repo/demo links (Q331–Q340)                                                            |   5 |
| 6.7 | **Hand-authored SVG diagrams**, themed with CSS variables — your highest-value public visual (Q224, Q225)                                                                                                                                                  |   4 |
| 6.8 | **`/now` + resume screen** — airier `/now` leading with the most recent update; resume as a document on a designed surface, variant switcher, PDF as primary action, reflowed on phone. **Print block untouched** (Q341–Q357)                              |   5 |
| 6.9 | **Public chrome** — footer theme toggle, build date, repo link, external-link glyph, case-study reading progress, `PrivateLink` de-emphasised (Q293–Q304)                                                                                                  |   3 |

**Ends with (Milestone D):** the portfolio is finished. ✅

---

### Phase 7 · Gates, performance, review — **22 pts**

The work that stops V4 decaying the way V1's resume did before D-077.

| #   | Item                                                                                                                                                                                                                                  | Pts |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --: |
| 7.1 | **`npm run shots` extensions** — 44px tap targets, 11px text floor with a data-attribute allowlist, contrast sweep, theme sweep (capped), widths 1440 and 1920, tightened fold thresholds (Q441, Q113, Q463, Q464, Q466, Q467)        |   6 |
| 7.2 | **Bundle gate** + drop `ProjectGrid`'s client boundary now the filter is URL state (Q460, Q461)                                                                                                                                       |   3 |
| 7.3 | **Performance** — LCP under 1.5s on a mid-range phone over 4G, public JS under 90KB gzipped, ambient paint cost re-measured against Phase 0's number (Q457–Q459, Q462)                                                                |   4 |
| 7.4 | **Accessibility** — `prefers-contrast`, `prefers-reduced-transparency`, `forced-colors`, a `px` audit for OS text scaling, a live region for async saves, chart text alternatives, focus-order test on the log form (Q442, Q449–Q454) |   4 |
| 7.5 | **Before/after screenshot compare mode** in `.shots/` — recorded, not gated (Q29, Q465)                                                                                                                                               |   2 |
| 7.6 | **Two review rounds** — `npm run freeze` snapshot, notes to `web/SITE-REVIEW.md`, as on 2026-08-29 (Q480, Q481)                                                                                                                       |   3 |

**Ends with:** V4 cannot rot silently.

---

## 4. Ordered summary

| Phase | What                                                |     Pts | Feature?               |
| ----- | --------------------------------------------------- | ------: | ---------------------- |
| 0     | Say what is true — docs, and the 8.8px gate mystery |       8 | ✅ done                |
| 1     | Tokens, themes, type, space, motion, primitives     |      40 | ✅ done · Milestone A  |
| **N** | **Degraded network — the plane-wifi freeze**        |  **45** | ✅ done                |
| 2     | Training, end to end                                |      45 | ✅ done · Milestone B  |
| 2+    | The catalogue gets pictures — diagram, written how-to |      12 | ✅ done                |
| 2.12  | Four bugs Victor found — one older than Phase 2      |      13 | ✅ done                |
| 2++   | **Training, properly** — the figure, the audit, the browser, the logger, routines, the dashboard | **119** | ✅ done |
| N9    | Every write through the outbox — deferred from N5   |      13 | ⏸ parked (§7 R5)       |
| 3     | Tags                                                |      12 | ✅ done **[FEATURE]**  |
| 4     | The private shell — sidebar, settings, tab bar      |      28 | ✅ done · 4.7 part     |
| 5     | The private screens                                 |      50 | part · 5.6 absorbed    |
| 6     | Brand and the public site                           |      36 | ✅ done · Milestone D  |
| 7     | Gates, performance, review                          |      22 | part · 7.2 done        |
| 2.13  | The picker on a phone, and licensed art             |      11 | ✅ done                |
|       | **Total**                                           | **454** |                        |

**454, not 286.** Five rows were promoted out of footnotes or added after use rather than
invented: N9 is the 13-point half of N5 the plan always carried as "3 (+13)", Phase 2+ is the
diagram and the descriptions Victor asked for alongside 2.1, §2.12 is the four defects he found
on first use, §2.13 is the three he found next, and **Phase 2++ is what he asked for after using
the thing §2.12 fixed** — which is not scope creep either, it is the difference between a
mechanism and a product becoming visible.

**378 points are done** (0, 1, N, 2, 2+, §2.12, 2++, §2.13, 3, **4**, 5.6, 6 and 7.2). **76 remain,
63 of them unparked** (N9's 13 points are still parked, §7 R5).

Phase 4's 4.7 is the one item counted as done that left something behind: the heading-order audit
and the focus-order test moved into §7.4, which is where an accessibility gate belongs and which
already carries 4 points for it. Nothing was dropped, and no points were moved with it — §7.4
was always going to have to look at the whole app rather than the shell.

**The arithmetic was wrong in four places until 2026-09-10**, and is recorded here rather than
quietly fixed: the total was stated as 316 in the frontmatter, 454 in §0 and 443 in this table
(which was missing §2.13's row entirely), and the done figure as 293, 282, 299 and 286 in four
different sections. Every site now derives from this table.

Phase 2++ alone is larger than Phase 2 and Phase 5 combined. That is recorded rather than
litigated: every stage boundary in it was a coherent stopping point, and none of them were taken.

Pure design work, with both feature phases, the settings screen and the whole of Phase N removed:
**~178 pts.**

**Where Phase N sits is a judgement, not a fact.** It is placed after Phase 1 because Phase 1 is
the system everything else is built on and 1.1–1.4 are already in. It is placed _before_ Phases
2–7 because a screen that hangs is worse than a screen that is not yet beautiful, and Phases 5–7
are all screens this bug hangs. Moving it is a one-line change to this table — but the 16 points
that remove the freeze (N2+N3+N4) are worth doing before anything else regardless.

---

## 5. Rules carried forward

Unchanged by V4 and easy to break while redesigning:

1. **Public routes never import a private loader** and never read a non-whitelisted field.
2. **The vault is written through the GitHub Contents API**, never `fs.writeFile`.
3. **Nothing sensitive in a `"use client"` component** — they compile into unauthenticated chunks.
4. **`/cached` stays static and holds no server data.** Making it dynamic silently kills offline.
5. **The print stylesheet is frozen** (Q123, Q355). The resume page-count gate stays (Q468).
6. **`local-lock.tsx` is built and unmounted** (D-158). Do not delete it while tidying.
7. **1,848 tests is a floor, not a target** (Q470). It was recorded as 582 until Phase 0 re-measured it, 1,240 until Phase 1, 1,409 until Phase N, 1,755 until Phase 3 added tag tests, and 1,805 until Phase 4 added the sidebar, glyph, content-width and sheet-drag suites — re-state the number whenever it moves, or the floor stops being one.
8. **Every decision gets a `DECISIONS.md` entry**, continuing from D-190 (Q477, Q478).
9. **Lands on main, screen by screen** (Q25, Q479). Inconsistency is acceptable on private only (Q26).
10. **Colour never signals alone** (Q72).

---

## 6. Deliberately not in V4

| Not doing                                         | Why                                                                                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **User-defined categories** with their own fields | Categories drive forms, validation, summary lines and the search index from code. Making them data is a V5-sized change. Tags (Phase 3) fix the complaint for a tenth of the cost — revisit once you know which tags you reuse |
| **Global private search**                         | Your call (Q373): once the app is more built out. V5                                                                                                                                                                           |
| **The search keyboard shortcut**                  | Two of the three shortcuts ship (capture, log); search waits for the feature (C14)                                                                                                                                             |
| **A fourth typeface**                             | Q99, Q100                                                                                                                                                                                                                      |
| **Page transitions, View Transitions API**        | Q183, Q184                                                                                                                                                                                                                     |
| **A spring/physics library**                      | Q190 — $0 budget                                                                                                                                                                                                               |
| **Pixel-diff visual regression**                  | Q465 — a pixel baseline for a design in flux is a full-time job                                                                                                                                                                |
| **A `/uses` or colophon page**                    | Q300 — the case studies carry it                                                                                                                                                                                               |
| **Route-reactive ambient gradient**               | Q163 — every navigation would read as a repaint                                                                                                                                                                                |
| **Emoji, illustration, placeholder imagery**      | Q217, Q226, Q276                                                                                                                                                                                                               |
| **Replacing recharts**                            | Q227 — revisit only if the bundle gate catches it                                                                                                                                                                              |

---

## 7. Risks, stated plainly

**R1 · The portfolio stays as it is through peak application season.** ✅ **Spent — the hatch was
taken, and wider than it was drawn.** Recorded as accepted on 2026-09-06; on 2026-09-10 Victor
reversed it and asked for the whole of Phase 6 rather than the 11-point 6.4 + 6.8 escape hatch.
All nine items shipped the same day, along with 7.2.

What that bought, in the terms R1 was written in: link previews exist at all (they had been
declared since V1 with no image behind them), the tab icon is Victor's for the first time, the
About page leads with a claim instead of an enrolment fact, the resume page offers the PDF as its
primary action, and four case studies now show how the thing works rather than what it looked
like. The remaining gap is content, not code — see D-230.

**R2 · The budget is out by ~310 points.** You said 120–140; the total is **454** and **378 is
done** — it was 241 until Phase N was inserted on 2026-09-08, and the four separate arithmetics
this section used to disagree with are reconciled in §4. Not a padding problem: it is Phase 2 (45) plus Phase 3 (12)
plus the settings screen plus Phase N (45), none of which were UI work when you set the number,
and Phase N is not UI work at all. Two readings are left, and the third has expired: take the
63 unparked points and finish V4; or move what remains of Phase 5's feature-shaped work to V5.
"Stop after Phase 5 with the portfolio untouched" is gone — the portfolio was finished on
2026-09-10 and the shell on 2026-09-18. **Every phase boundary is a coherent stopping point** — that is why they
are ordered this way. No recommendation here; it is a priorities call, not an engineering one.

The one part I would not trade away is the 16 points inside Phase N that stop the freeze. That
is a bug, not scope.

**R3 · Phase 2 reverses a decision that has been declined twice** — 2026-08-30 on cost, and again
2026-09-03 when D-159 found a cheaper way to the same PR board. It is being reversed a third time
because §4a's design is already written and the cheap path does not give you sessions. **The
danger is the sync surface**, not the UI: `workouts` gains a client key, and D-169's mirror
currently keys on the server id precisely because the phone cannot create one. Get 2.4 wrong and
you lose a workout that only ever existed on the phone. Build 2.4 before 2.5, and test it against
PGlite and offline e2e before any of it is styled.

**R4 · Five themes is five times the surface.** Every contrast test, theme sweep and screenshot
multiplies. Cap the swept pages, or cap the themes at three plus two unswept experimental slots.

**R5 · A half-migrated app for the length of Phase 1.** ✅ **Spent, and it cost less than
budgeted.** Redefining Tailwind's own nine type names rather than inventing a tenth vocabulary
meant 466 call sites became scale-correct on the day the scale landed, so the half-migrated
window closed immediately for type. What genuinely remains half-migrated is narrower and is
written down rather than implied: the ~300 opacity utilities (§3.1), 186 `font-mono` call sites
(`DESIGN.md` §4), the `size-4`/`size-5` icon call sites, and the app's own `p-6`/`p-5`/`p-4`
padding. All four migrate screen by screen in Phases 4–6, and none of them renders incorrectly
in the meantime.

**R6 · The 8.8px gate (C7) may be a real hole.** If `npm run shots` has not been checking text
size the way the docs claim, other rules in the same sweep deserve the same suspicion before
Phase 7 builds four more on top of them.

**R7 · Q130 is the hardest item to verify.** "Too much read-only text defeats the point" cannot
be measured by a gate. It is the standing instruction across Phase 5 and the thing most likely to
be quietly skipped, because turning prose into structure is slower than restyling prose.

---

## 8. Blocked on Victor

Small, and none of it blocks Phase 1 or Phase N.

1. ~~**Q402 — are log entries editable after saving?**~~ ✅ **Answered 2026-09-08: yes, editable,
   with its own guard.** Not reusing D-164's — that one exists precisely so `fileEntry` can only
   move an entry _out_ of the unsorted pile, and a general edit path is a different permission.
   Phase 2 builds it; edits become ordinary sync ops, last-write-wins by HLC like every other
   write.
2. ~~**C15 — the mark cannot be five things at 16px.**~~ ✅ **Answered 2026-09-10: the brain stays,
   and goes monochrome.** The question was asked against a codebase that already had a shipped
   mark — `brain.svg`, its fourth drawing, with D-145/D-148/D-151/D-203 behind it — which §8 did
   not notice. So 6.1 became a re-colouring rather than a redrawing (D-215), and the five-pillar
   lockup now lives on the OG card, which is exactly where this entry said it would (D-218).
   **Still open, and Victor's call:** at exactly 16 device pixels the widened folds read closer to
   a crown than a brain. Only 1x displays are affected — HiDPI takes the 32px frame, which is
   unambiguous (D-217).
3. **C11 — is nine private routes the right number?** Your Q258 note says the scrolling bar
   indicates "too much going on there". The sidebar fixes the presentation; it does not answer
   whether any two of Today / Now / Log / Athletics / Academics / Work / Calendar / Hobbies / Sync
   should merge.
4. **`steel-light` still needs judging.** Half-answered: `carbon` was looked at and promoted to
   the default on 2026-09-08, which is exactly what the experimental slots were for. Steel is the
   one nobody has spent a minute on. It is correct — every ratio is solved and tested — but
   correct is not the same as good, and carrying a theme you never pick costs a column in every
   contrast test and theme sweep (R4). The kitchen-sink page (§1.11) is where that judgement
   happens; until then it is one tap away in settings.
5. **The Samsung paint number** (§0.6). `npm run paint` gives a desktop and a throttled-proxy
   figure; the real one needs the phone. Procedure is printed by the script — `chrome://inspect`,
   port-forward 3000, record six idle seconds of Rendering + Painting with the layer on and off.
   Ten minutes, and it is the number V4 §1.4's redesign gets held to.
6. **Q482 — does anyone review the public site but you?** Affects how Phase 7's review rounds are
   run, nothing else.
7. **R2 — which reading of the budget?** The total is **454** and **378 is done**, so the question
   has narrowed to the 63 unparked points left: the rest of Phase 5 (44) and the rest of Phase 7
   (19). "Stop after Phase 5 with the portfolio untouched" is no longer one of the readings —
   the portfolio is finished, and so is the shell.
