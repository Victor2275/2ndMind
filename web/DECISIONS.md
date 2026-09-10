---
updated: 2026-09-10
domain: engineering
stability: volatile
summary: Dated log of design and architecture decisions for the web app, each with its reason and how to reverse it.
read_when: Before changing anything that looks deliberate, or when Victor wants something undone.
---

# Decision Log

Every non-obvious choice, why it was made, and **how to undo it**. Victor reviews the site
and reverses things; this file exists so reversing is a lookup, not an archaeology dig.

Newest first. When a decision is reversed, do not delete the entry — move it to
[Reversed](#reversed) with a note. The history of what was tried and rejected is the
useful part.

---

## 2026-09-10 · V4 Phase 6 — brand and the public site

Item 6.1 and 6.2. Started because the portfolio is untouched through peak application season
(V4 §7 R1), which was accepted as a risk on 2026-09-06 and revisited on 2026-09-10.

---

### D-216 · `cramped` (380px) is a named breakpoint again

**Decision.** `--breakpoint-cramped: 23.75rem` joins the set in `build-scale.mts`. The header
wordmark is hidden below it and the mark stands alone (Q42).

**Why this is not a reversal of §1.7.** §1.7 removed `min-[380px]:` from two call sites and
recorded the removal as part of collapsing four breakpoint spellings into one set. What it
objected to was an **arbitrary value written inline**, not the line itself — and Q42 asks for
that line by name. Naming it is what makes "one set, under two spellings" true here too; leaving
it out would have meant either an arbitrary utility (the thing §1.7 removed) or hiding the name
at `phone:` (640px), which takes the site's identity off every phone.

**How to reverse.** Drop the `cramped` row from `BREAKPOINTS`, run `npm run scale`, and change
the two `cramped:` utilities in `site-header.tsx` to always-on.

### D-215 · The mark is monochrome, and its folds are holes rather than paint

**Decision.** `brain.svg` is redrawn a fifth time. The geometry is untouched — same blob, same
six grooves, same wander. What changed is that the silhouette is now `currentColor` instead of a
magenta gradient, and the folds are **knocked out of the alpha** by a luminance mask instead of
being stroked in the ground colour.

**Why, beyond Q35 asking for it.** Two bugs were live and neither was visible on a laptop:

1. **The folds were cut in `#140a10`** — the *magenta* theme's ground. D-197 made carbon the
   default on 2026-09-08 and moved the tile to `#0e0e0e`; the drawing did not follow. For two
   days the launcher icon had warm-tinted grooves on a hueless tile.
2. **The mark was still magenta.** D-197 says "the app icon, the splash screen and the phone's
   status bar are all Carbon now, because one constant drives all four". That was true of the
   *ground* and false of the mark, and `badge-icon.test.ts` actively pinned the mark magenta as
   its positive control — so the test agreed with the bug.

Both are now structurally impossible rather than merely fixed. A groove is transparent, so over
the tile it *is* the tile colour and cannot drift from it; the mark's colour is set once, by
whatever contains it, and appears nowhere in the drawing.

**What it simplified.** D-203's badge no longer needs a special drawing. The two CSS rules in
`render-icons.mjs` that recoloured the paths — and their dependence on the mark's internal
structure — are gone; the badge is the mark with no tile behind it and `color: #fff`. D-203's
assertion still holds and is now stronger, because the alpha knockout is a property of the mark
everywhere rather than of one rendered variant.

**What replaced the magenta assertion.** `icon-192.png` is now checked against
`themeById(DEFAULT_THEME).accent` rather than against a colour named in the test, so the next
default-theme change fails until the icons are re-rendered. That is precisely the failure that
did not happen on 2026-09-08.

**How to reverse.** Restore the `<linearGradient>` and the `stroke="#140a10"` group from git,
put `BADGE` back in `render-icons.mjs`, and drop the three colour tests. The mark stops
following the theme with it.

### D-217 · The favicon is generated, and it was never the mark before

**Decision.** `scripts/render-icons.mjs` now also writes `src/app/icon.svg` (vector, with its
own `prefers-color-scheme` branch), `src/app/apple-icon.png`, `src/app/favicon.ico` (three PNG
frames, hand-packed), and three lucide shortcut glyphs.

**What was found.** `src/app/favicon.ico` was 25,931 bytes, dated the day the repo was created,
and no script in this project had ever written it — the mark was drawn in V3, months later, and
the `.ico` was never part of that pipeline. The tab icon has never been Victor's.

**Why an `.ico` at all, given `icon.svg`.** Browsers request `/favicon.ico` on their own whether
or not a link tag points at one. Deleting it would serve a 404; leaving it would serve a stock
icon beside the real one. Packing three PNG frames into an ICO container is a header and three
16-byte entries, so it needs no encoder dependency.

**The one place the drawing is adjusted for its size.** The `.ico` frames widen the fold stroke
as they shrink — 18 → 21/26/40 viewBox units at 48/32/16px. At 16px a stroke of 18 units is
0.56 device pixels, below one pixel, so the grooves grey out instead of cutting and the mark
arrives as the striped blob D-148 named. The count and the wander are unchanged, which is what
identifies it; only the width moves. This does not reopen D-203's refusal to simplify the badge
— nothing is removed here.

**Still marginal at 16px**, and recorded as such: the widened folds read closer to a crown than
a brain at exactly 16 device pixels. On any HiDPI display the browser takes the 32px frame for a
16px slot, and that one is unambiguous, so this only affects 1x screens. Victor's call whether
to spend more on it.

**How to reverse.** Delete the `faviconSvg`, `ico` and `GLYPHS` blocks from the renderer, restore
the old `favicon.ico` from git, and repoint the manifest's three shortcuts at `icon-192.png`.

---

## 2026-09-10 · The picker on a phone, and a figure that can be licensed

Two corrections after using Phase 2++ on the phone it was built for.

---

### D-237 · The exercise picker is a full screen with a fixed header, not a drawer

**Decision.** The picker `SheetContent` moves from `side="right"` to a new `side="fullscreen"`:
the whole viewport on a phone, rising from the bottom, and the same right-hand panel it always
was from `sm` up. Inside it, the search box and the filters sit in a **fixed header** and the
add/create controls in a **fixed footer**; only the rows scroll. `ExerciseList` splits into
`useExerciseSections` + `ExerciseFilterBar` + `ExerciseRows` so both screens still share one set
of filtering rules.

**Why.** Victor: *"it opens a sidebar, which is hard to use."* Three separate faults under that:

1. **The search box scrolled away.** It was inside the scrolling region, so forty rows into a
   hundred-and-forty-row list the one control that would have got you there in a single move was
   off-screen. This is the whole of the complaint, and nothing else on the list mattered as much.
2. **The gesture was wrong.** A panel sliding in from the right edge is what a navigation drawer
   does. This is not navigation, and on a phone it was full-width anyway, so the animation
   promised a drawer and delivered a screen.
3. **The footer sat under the keyboard.** A phone keyboard shrinks the *visual* viewport and
   leaves the *layout* viewport — what `fixed` is measured against — alone, so "Add 3 exercises"
   vanished the instant you tapped the name field.

**Four things came with it.**

- **Filters are chips, not `<select>`.** A native select on iOS opens a full-height wheel over
  the list you are trying to filter. Chips also show what the options are without being opened.
  Only groups and equipment that actually occur get a chip — a filter that leads to an empty list
  is a dead end you had to tap to discover.
- **The keyboard is measured, not assumed.** `lib/keyboard-inset.ts` reads `visualViewport` and
  the panel takes the covered strip as `padding-bottom`, which re-lays the flex column out inside
  what is left. The alternative, `interactive-widget=resizes-content` on the viewport meta, is
  app-wide: it would change the bottom tab bar's behaviour on every screen to fix one panel.
- **The create block folds away.** A field, two buttons and sometimes a suggestion card is ~120px
  of a phone screen held permanently for the rare movement that is not among the hundred and
  forty already listed. Those pixels are two more rows. It unfolds itself when a search returns
  nothing, which is the one moment it is certainly what you want.
- **`bg-background`, not `bg-popover`.** At full-screen size this is a screen rather than an
  overlay, and the sticky group headings are painted in `background` — a popover-coloured panel
  behind them showed every heading as a visible band.

**How to reverse.** `side="right"` on the `SheetContent` in `session-logger.tsx` and put
`ExerciseFilterBar` back inside the scroller. `side="fullscreen"` in `ui/sheet.tsx` is a new
variant and harms nothing left in place. Keep the split in `exercise-list.tsx` either way — the
browser page's behaviour is unchanged by it.

---

### D-238 · A search abandons the grouping — the "erg" bug

**Decision.** With a query present the list is **one flat section in score order**. Muscle-group
sections come back the moment the box is cleared. Recently performed movements get a small
ranking boost, and the picker (not the browser) opens with a "Recent" section of eight.

**Why.** Victor: *"when I searched 'erg', it was at the bottom of the list."* He was right and
the cause was not the matcher. `searchExercises` had already ranked `Row (Erg)` near the top;
`ExerciseList` then threw that ranking away by re-bucketing rows into muscle groups, which paint
in the fixed `GROUPS` order. `Row (Erg)` is tagged `full body`, which has no coarse group, so it
landed in `Other` — dead last — however well it had scored.

The fix is not a better group order. **Grouping is for browsing and ranking is for searching**,
and no single order honours both. So the query decides which one is in force.

**Why the history boost is small.** The tiers top out at +12 against a `score` that pays +50 for
an exact prefix. History breaks ties; it does not overturn matches. A boost large enough to lift
a weak match above a strong one would mean typing a movement's full name and watching something
else sit above it, which reads as the search being broken rather than as being helpful. Recency
rather than frequency, because a training block is a handful of movements repeated for weeks and
frequency would still be promoting last cycle's lifts a month after they stopped being what you
do.

**How to reverse.** Return the `query.length > 0` branch of `useExerciseSections` to the grouping
path, and drop the `boost` argument at its call site. `searchExercises`'s fourth parameter is
optional and inert without it.

---

### D-239 · The body figure's geometry is licensed art, not hand-drawn — D-226 reversed

**Decision.** The ~250 hand-drawn paths in `muscle-map.tsx` are replaced by the SVG geometry of
**react-native-body-highlighter** v3.2.0, MIT, in `lib/athletics/body-paths.ts`, with the licence
reproduced in `NOTICE` at the repository root. Five regions the upstream has no path for —
front `lats` and `hip flexors`, back `back`, `rotator cuff` and `abductors` — are original
additions placed against the measured bounding boxes of the parts they sit between.

**Why D-222 still survives, and D-226 does not.** D-222 is *one drawing computed from the data
cannot disagree with the data, where a hundred and forty pictures can*. Nothing here touches
that: the highlight is still computed from the same `muscles` array the search chips and the
record grouping use. D-226 was the narrower claim that a careful hand could reach reference
fidelity in a day. It could not, quite, and it no longer has to — this is a proper anatomical
illustration whose licence simply permits use.

**Why not the two repositories Victor found.** `diabeatz96/FalseStory` and `wathmal/MMM-Hevy`
both ship the same `body-front.svg` / `body-back.svg` pair and **neither has a licence file**,
which means all rights reserved. They are also coarser than this vault's vocabulary — about 12
front and 7 back regions against 20 — so adopting them would have cost regions as well as
permission. The MIT upstream was found by looking for the same thing with a licence attached.

**Two mappings that are decisions, not renames.** Upstream's `upper-back` is drawn as the lat V,
so it is `lats` here — calling it `back` would light the wrong shape for the 23 catalogue entries
tagged `lats`, which is most of the pulling movements. Upstream's back-view `deltoids` is the
posterior head, so it is `rear delts`; the front-view one is `shoulders`. That is exactly the
split D-227 made in the vocabulary, arrived at independently.

**What `detail="simple"` now means.** It was "bellies without striation seams". It is now
"silhouette plus the worked regions only" — about a dozen paths instead of a hundred and sixty.
What the picture *says* is unchanged, because what it says is which regions are lit; what goes is
resting anatomy nobody can resolve at 40px, and with it the cost of drawing it once per row of a
scrolling catalogue. `onRegionTap` forces full detail, since a region that is not drawn cannot be
tapped.

**What it cost.** ~58KB of path data in the client bundle, against roughly 20KB of hand-drawn
paths before. It is bundled, cached and offline like everything else on this screen.

**How to reverse.** `git revert` this commit; the previous `muscle-map.tsx` is self-contained and
has no other dependency. Delete `body-paths.ts` and the `react-native-body-highlighter` section
of `NOTICE` together — the notice is a licence obligation for as long as the paths are here, and
for no longer.

---

## 2026-09-10 · V4 Phase 2++ — training, as a product

Phase 2 shipped the mechanism: a session logs offline and lands in Neon. Using it produced a
different verdict — *"the screen is ugly / doesn't feel like an app"* — and an audit request:
*"2k erg and 5k erg both exist, which doesn't make sense."* Sixty questions on 2026-09-09 scoped
the answer; this is what was built, in eight stages, with Hevy as the reference throughout.

Every entry below names what it reverses.

---

### D-226 · The figure is redrawn at reference fidelity, and D-222 is **not** reversed

**Decision.** `muscle-map.tsx` is rewritten — more anatomical sub-shapes per region, a generated
striation overlay, and a `detail` prop so a 40px glyph in a scrolling list does not pay for
texture nobody can see. Highlighting splits in two: `--primary` for the prime mover and
`--primary-300` for the assist, against Victor's reference image's red and pink.

**Why D-222 survives.** Its argument was never about fidelity — it was that *one drawing computed
from the data cannot disagree with the data*, where a hundred and forty pictures can, and no test
can read a picture. That is unchanged. What changed is that the drawing got better.

**Why the accent ramp rather than red and pink.** Literal hex would need a `no-raw-hex`
exemption and would be wrong the moment the theme changes. The ramp is generated and
contrast-solved per theme, so this is correct in all five with no exemption.

**How to reverse.** `git revert` the Stage 1 commit. The vocabulary in `lib/athletics/muscles.ts`
is a separate concern and worth keeping either way.

---

### D-227 · The muscle vocabulary grows 15 → 21, and `core` becomes a synonym

**Decision.** `MUSCLES` moves out of `catalogue.ts` into `lib/athletics/muscles.ts` and grows:
`core` splits into `abs` and `obliques`, `shoulders` sheds `rear delts`, and `rotator cuff`,
`adductors`, `abductors` and `hip flexors` are added.

**Why.** The old list was a grouping key with a diagram pencilled in against it. A figure that
means to look anatomical needs regions a sit-up and a Russian twist do not share. It also fixed a
live mis-tag: `Hip Adduction` was labelled `quads` because the vocabulary had nothing better.

**Why `core` stays.** Stage 1 shipped before the catalogue was re-tagged, and a vocabulary change
that blanks every figure for a release is a worse trade than one deprecated name. `expand()`
turns it into `abs` + `obliques`.

**How to reverse.** Delete the six added names and restore `core` as a first-class region; the
figure keeps a shape for it either way.

---

### D-228 · `exercises.name` stops being unique, because uniqueness caused a sync wedge

**Decision.** The unique index on `exercises.name` is dropped. `apply.ts`'s exercise writer
instead converges same-named live rows to one survivor — highest `updated_hlc`, compared
`COLLATE "C"` to match `hlc.ts`'s plain byte compare — after every write.

**Why.** The index protected nothing: `workout_sets.exercise` stores the *string*, never a
foreign key, so two rows sharing a name split no history. What it did do was refuse the second
insert when two devices added the same name — a raw Postgres unique violation, which is not an
`UnknownParentError`, so `applyOps` never caught it. The route 500'd, the whole batch died, and
**every other entity queued behind it retried forever**. A permanent sync wedge, from an index
that bought nothing.

**How to reverse.** Restore the unique index and delete the convergence statement — and expect
the wedge back the first time two devices invent the same movement.

---

### D-229 · A routine op is replace-all, unlike a workout's

**Decision.** `routines` + `routine_exercises` sync as one aggregate op like `workouts`
(`SYNC_DESIGN.md` §4a), with one difference: the op carries the routine's **whole** line list and
the server tombstones every live line not in it. Each line gets a fresh `clientId` on every save.

**Why.** Reordering and removing lines is the normal edit to a template — you save a routine, you
do not append to one. Under replace-all the writer never has to decide whether line three is "the
same line" as before, and a reorder is simply a different list. A workout's sets are the opposite
case: they accumulate one at a time and are corrected in place, which is why that aggregate
upserts and does not replace.

**How to reverse.** Match lines by a stable id and diff them. That is more code and one more
thing to get wrong on a screen where the whole list is rewritten on every save anyway.

---

### D-230 · `piece_type` is a new column, **not** a new `set_type`

**Decision.** `workout_sets` gains `piece_type` — `"steady"`, `"interval"`, `"warmup"`,
`"race"` — alongside the existing `set_type`.

**Why.** They answer different questions. `set_type` answers *does this count*, and
`isWorkingSet` in `prs.ts` is a **deny-list defaulting to true**: anything it does not know about
counts toward a PR. Adding `"technical"` or `"race"` there would have silently entered a light
technical paddle onto the record board. `piece_type` answers *what was the intent*, and nothing
ranks on it.

**How to reverse.** Drop the column and accept that the collapsed erg and water entries lose the
distinction that used to live in their names.

---

### D-231 · How-to text moves from a code map to a database column — reverses D-223's shape

**Decision.** `lib/athletics/how-to.ts` is deleted. Its text is folded into `catalogue.ts` as a
field per entry and seeded into `exercises.how_to`, which the exercise detail page can edit.

**Why.** D-223's argument — *text beats a demonstration clip, because it costs no request, works
with no signal, is searchable, and can say what usually goes wrong* — is unchanged and is why the
text still exists. What changed is where it lives. As a static map keyed by name it could not be
edited without a deploy, and a rename broke the link silently. As a column it is editable from
the screen that shows it, and `seed_key` rather than `name` is what the seed matches on, so a
rename cannot break it again.

**How to reverse.** Move the strings back into a map and delete the column. The seed script would
need to stop writing it.

---

### D-232 · Seeded exercises become editable, and `user_edited_fields` is what makes that safe

**Decision.** Every catalogue row is editable, seeded ones included. Each edit records which
fields a person changed. `scripts/seed-exercises.mts` respects that list **per column**, and
`mergeCatalogue` lets the mirror win for any row carrying one.

**Why.** This is the reversal the whole phase turns on, and the comment it broke said so out
loud: *"Nothing in the app can edit a seeded entry, so the bundle is the only writer of those
rows."* That premise is what made bundle-always-wins correct. Shipping the old merge unchanged
would have made every edit vanish on reload — correct in Postgres, correct in the mirror,
invisible on screen — which is the worst shape a bug can have.

**How to reverse.** Make seeded rows read-only again and the merge can go back to
bundle-always-wins. The column can stay; it costs nothing when nothing writes it.

---

### D-233 · The catalogue is renamed once, and history is rewritten with it

**Decision.** 164 entries become 139. Every name becomes `Movement (Equipment)`. 22 erg rows
collapse to 3, 9 water rows to 4, and the bodyweight and standing-machine calf raises to one.
`scripts/rename-exercises.mts` rewrites `workout_sets.exercise` to match, and
`workout_sets.exercise_before_v2` keeps the original string for one release.

**Why.** Victor's example understated it: 31 of the 164 rows were a distance or duration
parameter encoded in a name string, with an empty `distance_m` column sitting beside them. The
distance now lives on the set, where `prs.ts` was **already** bucketing erg records by exercise
and rounded distance — so per-distance PRs survived the collapse without a line of new code.

**Why it is safe to have done at all.** The dry run reported **zero** matching sets: no training
had been logged through the new logger yet. R3 in the plan called this out as "believed
near-empty", and the `--check` run is what turned the belief into a number before anything was
written.

**How to reverse.** Within one release: `update workout_sets set exercise = exercise_before_v2
where exercise_before_v2 is not null`, then revert the Stage 3 commit. After that column is
dropped, the map in `renames.ts` is the only record and reversal means running it backwards.

---

### D-234 · Nine private nav entries become eight — C-11, answered

**Decision.** **Train** and **Athletics** merge into one **Training** entry pointing at the
logger, with Log / Exercises / Records / History as in-page tabs (`training-tabs.tsx`). Training
history moves to a route of its own.

**Why.** Two of nine top-level items were spent on one subject, in a bar that already scrolls
sideways at 1440px, and C-11 has asked whether nine is the right number since 2026-09-06. They
are one area. Splitting history out also takes a list that grows without bound off a page whose
job is the summary of that list.

**Note.** D-225 added the Train entry six weeks — one day — earlier, and it was right then: the
logger was unreachable on a laptop. It is reachable now as the Training entry's own destination,
so nothing regressed. `except` is kept in `private-nav.tsx`, unused, because the situation it
solves recurs the moment any section grows a page with its own entry.

**How to reverse.** Split the entry back in two and delete the tabs.

---

### D-235 · A mirrored panel must not claim the page's `data-first-action`

**Decision.** `RehabChecklist` takes `firstAction`, default true. The copy mirrored onto Today
passes `false`.

**Why.** Found by `npm run shots` the same afternoon the mirror shipped: Today's fold gate
reported the first action at **1583px** against a 500px limit, and the capture box had not moved
at all. Two elements carrying the marker means the gate measures whichever it finds last — a
passing check quietly becoming a check about the wrong element, which is the same class of
failure as a test that has stopped testing anything.

**How to reverse.** Drop the prop and put the marker back on both — and watch the gate start
lying again.

---

### D-236 · The offline shell learns the exercise routes, because "offline throughout" was half true

**Decision.** `cached-app.tsx` gains `exercises` and `exercise` views, mounting the same
`ExerciseBrowser` and `ExerciseDetail` the live routes do.

**Why.** Everything underneath was already offline — the catalogue is bundled, the mirror is
IndexedDB, and every write goes through the outbox — but the *screen* was not: any
`/private/athletics/*` path that was not `/log` fell through to the record board. `npm run e2e`
navigated to an exercise's page with no signal and got Training. The data layer being offline is
not the same claim as the screen being reachable, and only the end-to-end run could tell them
apart.

**How to reverse.** Delete the two routing lines; the views fall back to the record board.

---

## 2026-09-09 (later) · Four things Victor found, and one of them was not about training

Reported after using Phase 2 on the phone for the first time: training was invisible on a
computer, the session form asked for a bodyweight every session, adding a set was unusable on a
phone, and searching the catalogue found nothing. Three had a single cause each. The third turned
out to have **two** causes stacked on top of each other, and the deeper one had nothing to do with
the session screen — it had been quietly breaking six unrelated screens since the design system
landed.

Every one of them was invisible to the 1,522-test suite, and for the same structural reason:
**jsdom does not lay out.** Every element there is zero pixels wide, so a row where five controls
fit and a row where two of them have collapsed to nothing are the same DOM.
`scripts/diag-widths.mjs` is the answer — a real browser, at 390 pixels, reporting anything wider
than the box holding it.

Also here: the muscle diagram (2.9) and, in place of the demonstration clips 2.10 asked for, a
written description of every movement.

### D-225 · Two navigations over one set of routes, and only one of them knew about Train

**Decision.** `private-nav.tsx` gains a **Train** entry pointing at `/private/athletics/log`, and
Athletics gains an `except` so it does not light up on the logger's route. The stale card on
`/private/athletics` now points there too, and the logger is capped at `max-w-2xl` so it is a
form on a laptop rather than a stretched phone screen.

**Why it was missing.** D-132 made the phone tab bar and the desktop nav two components over one
set of routes, "deliberate duplication". Phase 2 added the session logger to the tab bar and not
to the other one — so above 40rem the single most-used write screen in the app was reachable
only by typing the URL. The card that should have pointed at it still said training was logged
from `/private/log`, which had been true until 2.7 retired that tab.

**The general lesson, which is D-132's cost coming due.** Duplicated navigation does not fail
loudly; it fails by one copy quietly not mentioning a feature. Unifying them is still not worth
doing three weeks before term, but a route added to one and not the other is now a known failure
mode rather than a surprise.

**How to reverse.** Remove the entry. The tab bar is unaffected.

### D-224 · The catalogue comes from the bundle first and the device second

**Decision.** The session logger seeds its exercise list from `CATALOGUE`, the module the seed
script inserts from, and merges the synced `exercises` mirror over the top by name — with the
**bundle winning** any name they share. It also re-reads the mirror on `SYNC_DONE_EVENT` rather
than only at mount.

**The bug.** Searching `bnch` on the phone found nothing. The screen read the mirror and only the
mirror, so the whole feature depended on a completed sync pull — and the catalogue is 165 rows
while the pull is paged at 100. A device that had synced once held three quarters of it, and
Bench Press happened to be in the quarter that had not arrived. There was no error state: the
search box simply came up empty, and the only way forward was to type the name in by hand, which
is what Victor did.

**Why the bundle is the right floor.** `CATALOGUE` is already in the client chunk and is the file
the seed inserts from, so the two cannot disagree. That makes all 164 movements available on
first paint, before any network, on a device that has never synced. The mirror then carries the
only rows the seed does not know: one you added, or one AI-add proposed.

**Why the bundle wins a collision.** The opposite of the obvious ordering, and it matters as soon
as the seed changes: after D-222 reseeded 42 entries with muscle tags, a device that synced
earlier still holds those rows with an empty array, and mirror-wins would let the stale copy
blank the diagram on the newest build. Nothing in the app edits a seeded entry, so the bundle is
its only writer.

**The second half.** Reading once at mount was its own bug even with a complete mirror: a page
opened while the first pull was in flight held the store's contents *at that instant* for the
whole visit — and on a phone, opening the screen and the first sync are the same second.

**How to reverse.** Drop the `CATALOGUE` import and read `localCatalogue` alone; the search works
identically on a device that has fully synced.

### D-223 · A written how-to per movement, instead of the demonstration clips

**Decision.** 2.10 asked for a short looping clip per exercise, the way Hevy shows them. There
will be none. `lib/athletics/how-to.ts` carries two sentences for each of the 164 seeded
movements instead — setup, execution, and the mistake people usually make.

**Why not clips.** There is no lawfully reusable set of 164 of them. The ones that exist belong
to the apps that made them, including the reference file in the repo root; the openly-licensed
collections are stills, and their naming does not match this catalogue. Victor's call, given
that: drop the clips and take text.

**Why the text is better than a consolation prize.** It costs no request and no storage, so the
gym-basement screen still works with nothing in the cache — which retires 2.11 outright, since
there is now nothing to make offline. It is searchable. And it can say the thing a loop cannot:
*what usually goes wrong*, which is the half of a demonstration that changes the next set.

**Why a static map and not a column.** `exercises` is a synced table; this is keyed by the same
name. A description you add is a diff rather than a migration plus a reseed plus a pull on every
device, and a movement Victor types in himself simply has none — which is correct, because
nobody has written one. `how-to.test.ts` fails if a catalogue name has no entry, so the two
cannot drift.

**How to reverse.** Delete the module and the panel in `session-logger.tsx`; the diagram stands
on its own.

### D-222 · One drawing, highlighted from the catalogue — not one image per exercise

**Decision.** `components/site/muscle-map.tsx` is a single inline SVG of a front and back figure
with a path group per muscle region. An exercise's `muscles` array decides what is lit.

**Why not an image per exercise.** Licensing is the smaller half. **164 images drift.** Generated
or commissioned per movement, each is a chance for the picture to disagree with the data beside
it, and no test can read a picture. Here the highlight is computed from the same array the search
chips and the record grouping use, so the diagram cannot say something the catalogue does not.
It also costs no request, needs no cache, scales to any size, and themes with the app.

**Original geometry, not a trace.** The reference Victor supplied is stock anatomical art. A
trace of it would have been a derivative of it — the same licensing problem in a different file
format — so every path here is drawn from scratch. Regions are several shapes each rather than
one, which is what makes the figure read as muscle rather than as a body divided into boxes.

**What it cost.** `muscles` was previously empty for erg, water and conditioning entries, with a
note saying it "means little" there — true while it was only a grouping key, false the moment a
figure was drawn from it, because an empty array renders as *we do not know* rather than as
*whole body*. Those 45 entries were given real tags and reseeded. Mobility, stretching and foam
rolling stay blank, because nothing is being loaded and the blank figure is honest.

**How to reverse.** Delete the component and the two call sites. The muscle names stay useful as
text either way.

### D-221 · The weigh-in is a quick-log category — its third home, and the reason for each move

**Decision.** `bodyweightLbs` is gone from `SessionInput` and from the session form. It is a
category in the quick log now, key `weight`, with the number and a sticky "when" — morning,
post-training, evening. `/private/log` also gains a link into the session logger, so the centre
button still leads to training in two taps.

**Why it moved off the session.** Victor's objection, and it is about behaviour rather than
schema: **a session form with a bodyweight field asks for a bodyweight every session.** A
measurement requested when there is nothing to measure is either skipped or typed carelessly —
and this number is the second input to every weight-adjusted erg split, so a careless value is
worse than a missing one, because it reads as real.

**Why it was there at all.** It rode along on the quick log's Training tab, and D-215 caught its
disappearance when Phase 2.7 retired that tab. Moving it to the session screen kept it reachable,
which was the right fix to the wrong shape of the problem.

**What did not change.** `takeBodyweight` still lifts the number out into a `bodyweight_entries`
row before the entry is stored — one copy of the figure the charts and the adjusted table read,
exactly as D-159 required. The *context* stays on the entry, because the weight table is one row
per day and has nowhere to put "fasted, before training".

**How to reverse.** Delete the `weight` category and put the field back on `SessionInput`; the
writer path is unchanged either way.

### D-220 · A set is a card with its controls stacked, not a row of five

**Decision.** The session logger's set row is a small card: a numbered header with a delete, the
value fields in a two-column grid at full width, and the set type as a row of chips underneath.

**Why.** The previous version put the index, every value field, a four-option `<select>` and a
delete button on one flex line. Even with D-219 fixed that is five controls in 324 pixels, and an
erg piece asks for three value fields rather than two — it was never going to fit. Measured
after: every control is at least 40 pixels wide and nothing leaves the row.

**Chips rather than a select.** Four options is few enough to show, and a native `<select>` on
Android is a full-screen modal for a choice that is "normal" nineteen times in twenty. One tap
instead of three.

**How to reverse.** The old single-row markup is in this file's git history at `0eb0443`.

### D-219 · The space scale leaves `@theme`, because it was silently redefining `max-w-*`

**Decision.** `scripts/build-scale.mts` emits the eight space tokens into a `:root` block instead
of the `@theme` block. Values unchanged; `var(--spacing-md)` still resolves everywhere.

**What was happening.** `--spacing-*` is one of Tailwind's namespaces, and it is the one
`max-w-*`, `w-*` and `min-w-*` consult **before** `--container-*`. So `--spacing-2xl: 4rem` did
not merely name the 64-pixel step — it redefined `max-w-2xl` for the entire app, from 42rem to
4rem. Same for `sm`, `md`, `xl` and the rest.

**What it broke.** `/private/settings` rendered its whole content inside a **64-pixel column**,
one word per line. So did both error screens, the offline screen, the sign-in card, the register
card, and the "update available" notice. Six screens, with every class name reading correctly,
nothing thrown, and no failing test — because jsdom reports every element as zero-width and
cannot tell a 64-pixel column from a 672-pixel one.

**Why this direction and not renaming.** The named steps were meant to produce `p-sm` / `gap-md`
utilities. Those had **zero call sites** in the app. The trade is a naming convenience nobody had
used against six screens, which is not a close call.

**Two guards.** `scale.test.ts` fails if any `--spacing-*` reappears inside `@theme` — written
as "none at all" rather than as a list of colliding names, because that list is Tailwind's and
can grow in a minor release. And `width-conflicts.test.ts` catches the related pattern that broke
the set row: a shared class constant carrying `w-full` composed with a call site adding `w-24`,
where the winner is decided by Tailwind's emit order rather than by the class attribute. That one
appeared three times — in the session logger, the quick log's distance field, and the old
workout form — and the fix in each was the same: take the width out of the shared constant.

**How to reverse.** Move the loop back inside the `@theme` block in the generator — and rename
the steps first, to anything that is not also a container size, or the six screens break again.

---

## 2026-09-09 · V4 Phase 2 — training, end to end

**Milestone B.** You log a gym session on the phone, offline, and it syncs — proven end to end
against real Neon by `npm run e2e`, not argued for. This is the phase that reverses
`SYNC_DESIGN.md` §11.1, a decision that had been declined twice on cost (2026-08-30, and again
on 2026-09-03 as D-159).

Two of the entries below record things found by **running** it: the aggregate op had no atomicity
on the driver that actually runs it (D-212), and retiring the log category silently removed the
only way to record a weigh-in from the phone (D-215).

### D-218 · "AI add" proposes a catalogue entry, and prefers matching to creating

**Decision.** `POST /api/exercises/suggest` takes a description and returns either an existing
catalogue name or a proposed new entry. It never writes. Adding is a separate tap, through
`addExercise`, which is the only writer.

**Why it cannot save.** The same rule D-186 set for voice: a model that can write to a training
log is a model that can quietly invent a personal record. Every number a model produces here is
looked at by a person before it becomes a row.

**Why matching comes first.** The most common true answer is that the movement is already there
under a name you did not think of — "incline press" is "Incline Bench Press". A model that only
ever created would fill the catalogue with near-duplicates, and a near-duplicate is worse than a
missing entry: it splits a lift's history in two, so the record board shows a lower best for
both halves. The existing names are given to the model, and a `match` naming something not in
that list is discarded as a hallucination — the failure it is most prone to, having just been
shown a list and asked to pick from it.

**Visible offline, and honest.** Victor's call. Hiding the button when the connection drops would
make the one screen designed for a gym basement change shape depending on the signal, which is a
worse surprise than a message.

**How to reverse.** Delete the route and the button; fuzzy search and typing a name by hand are
the whole workflow without it.

### D-217 · Log entries are editable, with a guard that is deliberately not `fileEntry`'s

**Decision.** `editEntry` changes an entry's note and fields. It **cannot change its category** —
the category is read from the stored row and the signature has no room for one.

**Why.** Q402 sat at "no default" until 2026-09-08 and was answered yes: you will mistype a
weight. But `fileEntry` is deliberately one-way — it can only move a note *out* of the unsorted
pile, so a mistyped id cannot recategorise a real entry — and an edit path that accepted a
category would be a second, much wider door to exactly what the first door carefully restricts.
Reusing that guard was the tempting move and the wrong one; the two operations protect different
things.

**A retired category is still editable.** An old training entry has to stay correctable even
though no new one can be created (D-215). Retirement closes the *create* door, not the record.

**`search_text` is recomputed.** Leaving it would make an edited entry findable by the words it
used to contain and not by the ones on screen — which reads as search being broken.

**How to reverse.** Delete `editEntry` and `updateLogEntry`.

### D-216 · A session is written to the outbox, never through a Server Action

**Decision.** `saveSession` enqueues and returns. There is no server-action path for training,
online or off.

**Why this is possible here and nowhere else.** The aggregate op carries its own identity, the
server assigns the foreign key, and a re-send is an upsert — so writing locally and letting the
ordinary flush deliver it is not a degraded mode, it is the same result a moment later. Every
other write in the app needs two paths and `lib/offline/write.ts` to keep them in step.

**Three things it buys.** The screen behaves identically in a gym basement and at a desk. It has
no honesty problem — unlike D-206's case, this one *can* promise the entry is on the device,
because it is. And one path cannot drift from the other, which is the lesson of D-159's union
applied a level up.

**The cost, stated.** A session is not in Postgres the instant you tap save. Nothing reads it
from there in that instant: the screen renders from the local store, which already has it.

**How to reverse.** Add a Server Action that calls `logWorkout` and branch on connectivity —
and inherit the two-paths problem that argument was avoiding.

### D-215 · Training folds into sessions; the `athletics` log category is retired

**Decision.** The quick log's Training tab is gone. Training is logged at
`/private/athletics/log`, where a set belongs to a workout rather than sitting inside a log
entry's JSON. `allEfforts()` drops from two readers to one. The launcher shortcut and the tab
bar's Train action point at the logger.

**Why fold rather than keep both.** Victor's call, and it closes D-159. That union existed for
exactly one reason — the phone could not create a `workout` row — and Phase 2 removed the
reason. Item 2.7 said *do not add a third reader*; the answer turned out to be one.

**Retired, not deleted.** `summarise` and `searchTextFor` are given a category key and a blob of
JSON, and with no definition to match they fall back to the bare note — so deleting it would
silently strip every old training entry of its exercise and sets in the timeline and in search.
Retirement also shuts the create door: `writableCategoryByKey` will not return it, so the two
ways of recording a lift cannot start diverging again.

**What it quietly broke, and how that was found.** `bodyweightLbs` was a field on that category,
so retiring it **removed the only way to log a weigh-in from the phone**. Nothing said so; two
tests in `offline/write.test.ts` failed because they suddenly had no field to read. The field
followed the feature onto the session screen, and a weight can still be recorded on its own
without a session. Worth remembering as the shape of the risk in any fold: the capability that
disappears is the one that was riding along.

**The tab bar gained `section`.** Train points at the logger and stands for everything under
`/private/athletics`, so standing on the records page still lights it. Without that, a tab goes
dark on a page inside its own section, which reads as being lost.

**How to reverse.** Move the definition back into `CATEGORIES` and restore `loggedEfforts` in
`athletics/queries.ts`.

### D-214 · Two search implementations, on purpose

**Decision.** `lib/athletics/exercise-search.ts` is fuzzy and ranked. `lib/offline/search.ts`
stays prefix-matching. They are not merged.

**Why.** They want opposite things. The log search is over prose you wrote and are recalling, so
`run` finds `running` and `ran` does not — fuzzy matching there turns every query into a hundred
weak hits. The catalogue is a closed list of ~164 names you are trying to *reach*, one-handed,
mid-set: you type `bnch` and the right row has to be first.

**Ranking is what makes fuzzy usable.** A fuzzy matcher without it is worse than a prefix one,
because `press` matching thirty movements in arbitrary order is thirty rows to read.

**The contiguous-substring bonus was added after a real miss.** `row` ranked "Rope Pushdown"
above "Barbell Row" — r, o and w do appear in that order and the `r` even starts a word, so every
other signal pointed the wrong way. Subsequence matching is what makes typos recoverable and also
what makes coincidences score; the fix is not to stop matching them but to rank them below the
case where the letters are together.

**How to reverse.** Delete the module and use `matches()` from the log search; typing `bnch`
stops working.

### D-213 · The exercise catalogue is a seeded, synced table

**Decision.** `exercises`, ~164 rows, written by `npm run db:seed-exercises` from
`lib/athletics/catalogue.ts`. Mirrored to the phone like every other table.

**Why a table and not a constant.** The phone can add to it — that is what "AI add" and typing a
new movement do — so it has to be a row that syncs. Seeding it from a file rather than a
migration keeps one copy of the list, readable from both the seed script and the client bundle.

**Why curated rather than derived.** The obvious move was to seed from the exercise names already
in the database. Measured on 2026-09-08: **one distinct name**, because training had been logged
as free text. Deriving would have produced a catalogue with one row in it.

**`modality` is the load-bearing column.** It decides what the session form asks for — weight and
reps for a lift, distance, time and stroke rate for an erg piece. Asking for all six every time
is what made the old form slow, and Q392 asks for three taps per set.

**A set stores the exercise *name*, not a foreign key.** Deliberate: `workout_sets.exercise` is
free text and every Hevy import writes names this table has never seen, so a foreign key would
make importing a CSV fail on a movement nobody had catalogued. The catalogue assists entry; it
does not police history.

**The seed never touches what you added.** Rows whose `source` is not `seed` are left alone, and
a name gone from the seed is not deleted — by then `workout_sets` rows point at it as free text.

**How to reverse.** Drop the table and the script; the picker becomes a plain text field.

### D-212 · The aggregate op needs an atomic primitive the production driver actually has

**Decision.** `atomically()` in `lib/sync/apply.ts` prefers `db.batch` and falls back to
`db.transaction`. The session's foreign key is a **sub-select**, not a value read back with
`RETURNING`.

**Why — and this is the one worth reading.** Production runs `drizzle-orm/neon-http`, a stateless
HTTP driver with **no transaction support**: `db.transaction()` throws on it outright. PGlite,
which every database test uses, supports transactions perfectly well. So the aggregate op passed
sixteen database tests and **500'd on the first real session**. Found by `npm run e2e`: a session
logged offline, reconnected, and the outbox came back with `server returned 500`.

That mattered more than an ordinary bug. The entire argument for §4a's aggregate op is that **no
partial session can exist**, and on the driver that actually runs it there was no atomic
primitive at all — it was a session write that usually completed, which is a different and much
worse thing than the one the design promised.

**Why the foreign key changed shape.** `batch` sends every statement in one request wrapped in
`BEGIN`/`COMMIT` server-side, which is genuinely atomic — but a batch can depend on an earlier
statement's *effect*, not its *result*. Reading the parent's id back with `RETURNING` would have
made the aggregate impossible to send as one unit. As a sub-select, the dependency becomes one
the database resolves inside the same transaction.

**How it is guarded.** Three tests hand `applyOps` a handle shaped like neon-http — it has
`batch`, and its `transaction` throws — so the branch production takes is the branch that gets
exercised. The lesson generalises: **a test database that is more capable than the production one
will pass things production cannot do.**

**How to reverse.** Use `db.transaction` unconditionally and move to `drizzle-orm/neon-serverless`,
which pools over WebSockets and does support transactions.

### D-211 · Workouts are writable, and a session travels as one aggregate op

**Decision.** `workouts`, `workout_sets` and `exercises` gain `client_id` and join `WRITABLE`. A
session and all its sets are **one outbox op**, applied in one atomic unit, with the server
assigning the foreign key. `SYNC_DESIGN.md` §4a is built; §11.1 is reversed.

**Why it was deferred twice, and why it is not any more.** `workout_sets.workout_id` is an integer
foreign key to a `serial`, and offline that number does not exist — so a set created on the phone
has nothing to point at. That cost was declined on 2026-08-30, and again on 2026-09-03 (D-159),
which solved the symptom instead by reading sets out of log entries. Q391 asked for real session
logging, so the cause finally had to be addressed.

**Why an aggregate and not the alternatives.** §4a lists three ways out. Sets carrying a
`parent_client_id` resolved at apply time works, but makes the child op ordering-dependent on the
parent and §5's per-`clientId` block does not cover that — a failed parent would let orphaned
children through. Extending the block rule to cover parent ids fixes the orphan and adds a
dependency graph to the outbox for one relationship. Sending them as one operation has no
ordering to get wrong, no orphan to guard against, and matches how the data is produced: you
finish a session and save it once.

**Identity moved first.** `identityOf` addressed workouts by the server's `id`, which was safe
only because they were pull-only, and said so: *"if they ever become writable, this case has to
move to a client-generated key first."* This is that move.

**After creation, sets are independent.** Editing one set is its own op keyed by that set's
client id, so fixing a typo in set three does not resend the session — and cannot overwrite an
edit made on the laptop in between with whatever the screen happened to hold.

**How to reverse.** Remove the three entities from `WRITABLE`; the phone goes back to pull-only
and the session screen has nowhere to write.

---

## 2026-09-08 · V4 Phase N — the degraded network, and the notification badge

The plane-wifi freeze, diagnosed in `docs/DEGRADED_NETWORK.md` and built here — **Phase N
complete**, N1 through N8, with the 13-point outbox-always half of N5 deliberately deferred to
N9. The badge is not part of that and is only in this section because it was reported the same
day.

Three of these entries record things found by *running* the app rather than reading it: D-207
(the notice would have re-enabled the save button mid-POST), D-208 (the app went silent the moment
it landed on the fallback) and D-209 (`online` was swallowed by backoff). All three passed every
unit test that existed at the time they were written.

### D-210 · The degraded network is its own e2e suite, and it stalls requests rather than throttling them

**Decision.** `npm run e2e:degraded` (`scripts/e2e-degraded.mjs`). It builds, starts a production
server, and drives a real Chromium through a connection that is **connected and answering
nothing**. The setup both suites need moved to `scripts/lib/e2e.mjs`.

**Why a second suite rather than a phase of the existing one.** `e2e-offline.mjs` stages a
connection that is *off*, and every check in it passed on the build that froze on plane wifi. The
two conditions fail in opposite ways: offline rejects, so every `catch` runs; degraded never
settles, so none of them do. Keeping them apart also keeps this one free of the offline suite's
database writes — it writes nothing and needs no teardown.

**Why route interception rather than `Network.emulateNetworkConditions`.** Network emulation is
applied to a **target**, and a service worker is its own target. Throttling the page throttles the
page's own fetches and leaves every request the worker makes running at full speed. The first
version of this file did exactly that and reported the app working beautifully — the worker was
quietly on a perfect connection while the page beside it was on a terrible one. `context.route`
with `serviceWorkers: "allow"` covers both, and a handler that never resolves is a more faithful
stall than any latency figure.

**What it settled.** N3 rests on undocumented framework behaviour — that a rejected RSC fetch makes
the App Router perform a hard navigation. `DEGRADED_NETWORK.md` said to verify that rather than
trust it. **It holds:** Next logs _"Failed to fetch RSC payload … Falling back to browser
navigation"_, and a stalled tab tap reaches a usable screen in **~6.1s**, which is the 3s RSC
deadline plus the 3s navigation deadline — the number the design predicts. A direct navigation
falls back in ~3.1s; a precached public page opens in ~90ms without touching the network. **No
explicit `location.href` fallback is needed.** If that check ever fails, that is the change to
make.

**The bound is 20s and deliberately loose.** It is not measuring how fast the fallback is, it is
measuring that one exists — the value before Phase N was infinity. A tight bound would fail on a
busy laptop and teach everyone to ignore the suite.

**How to reverse.** Delete the script and the `e2e:degraded` entry in `package.json`.

### D-209 · `online` clears the sync backoff

**Decision.** `SyncRunner`'s `online` handler resets `nextAttemptRef` before running. The
foreground trigger still respects the delay.

**Why.** Backoff exists to stop the app hammering a network that is not working. `online` is the
one event that says _that has changed_, which makes the remaining delay stale evidence about a
connection that no longer exists. Without this the reconnect trigger is swallowed whenever the
last attempt failed inside the backoff window, and the queue waits for the next foreground —
which, on a phone in a pocket, may be hours.

**Found by running the suite, not by reading the code.** `npm run e2e` reached "back online" with
one op held, dispatched `online`, and watched nothing happen; a manual "Send now" a moment later
emptied the outbox at once. That is what identified it as a swallowed trigger rather than a wedged
runner.

**Why only `online`.** Foregrounding the app is not news about the network. A foreground that
ignored the delay would retry a failing batch every time the screen woke up.

**How to reverse.** Drop the `nextAttemptRef.current = 0` line. The guard test in
`sync-runner.test.tsx` fails, which is the point.

### D-208 · The worker tells the page why it is the fallback

**Decision.** When the worker serves the cached shell because a navigation **stalled** — as
opposed to there being no network — it injects `window.__2ndmindNet="degraded"` alongside the
`replaceState` it already writes. `lib/net/reachability.ts` adopts that once, on start.

**Why.** Falling back to the shell is a _hard navigation_: the document is replaced and every
observation `reachability.ts` had made goes with it. So the app arrives on the fallback screen
knowing nothing — `navigator.onLine` says `true`, no request has been made yet — and sits there
looking broken while saying nothing. That is exactly the plane case, and the one place N7's
message is most needed.

**Why the worker and not the page.** By the time the document loads, the worker is the only
component still able to tell a stall from an absent network: it is the thing that caught the
`TimeoutError`. The flag is the only part of that knowledge which survives the reload.

**Why it is not a latch.** Any later request that answers clears it in the ordinary way. It is a
starting point, not a verdict.

**Found by `npm run e2e:degraded`.** Every unit test passed and the fallback worked; the app still
said nothing once it landed. No amount of reading would have shown that.

**How to reverse.** Drop the `marker` in `serveFromCache` and `adoptWorkerVerdict`.

### D-207 · Nothing inside a `<form>` may call `setState` while its action is pending

**Decision.** `SlowSaveNotice` renders once, hidden, and a timer toggles `hidden` through a ref.
No React state.

**Why — and this is the important half.** On **React 19.2.8, a `setState` in any component inside a
`<form>` ends `useFormStatus().pending` for every component reading it, while the action's promise
is still unresolved.** Measured rather than assumed: a sibling that flips one boolean takes a
`disabled={pending}` save button out of its pending state and re-enables it mid-POST.

The obvious implementation of this notice — `useState`, flipped by a timer — would therefore have
shipped a **worse bug than the one it fixes**: at six seconds the notice appears for a frame, the
save button comes back to life while the request is still in flight, and the obvious thing to do
with a re-enabled Save button is press it again. A duplicated entry costs far more than a silent
save.

**How it is guarded.** `slow-save.test.tsx` asserts that the notice becomes visible _and_ that
`pending` is still true afterwards. Verified by mutation: the `useState` version fails exactly that
test and no other.

**Consequence beyond this component.** Anything that later wants to render inside a form while it
is submitting — a progress hint, a spinner with its own state — has the same constraint. Reach for
a ref.

**How to reverse.** There is no reason to. If React changes this behaviour, the guard test simply
keeps passing.

### D-206 · The slow-save notice promises only what is true

**Decision.** A save that has been running for six seconds says _"Still trying — the connection is
slow. Keep this open until it saves."_ It says nothing about the entry being stored on the device.

**Why the plan's wording was rejected.** `DEGRADED_NETWORK.md` §5 N5 proposed _"still trying; this
is saved on the device either way"_. That is true on the cached shell, which writes through the
outbox — and **false in the live app**, where a form under `/private` posts straight to a Server
Action and there is no local copy of anything. The message would have offered a guarantee exactly
where it does not exist, and someone acting on it — closing the app, confident the entry was safe
— would lose the entry. Victor was shown the contradiction and chose the honest, smaller sentence.

**What would make the larger sentence true** is routing every write through the outbox: the
13-point half of N5, deliberately deferred and now **N9** in `V4_PLAN.md`. When it lands, this
wording should change with it.

**Why the button stays disabled.** The plan's phrase "instead of a disabled button" is about the
silence, not the disabling. Re-enabling submit while a POST may still be in flight buys a
duplicate.

**Where it appears.** The four phone write paths: quick log, quick capture, bodyweight, and the
unmounted workout form — the last so that remounting it (D-159) restores a form which behaves like
the rest of the app.

**How to reverse.** Delete `slow-save.tsx` and its four call sites.

### D-205 · Precached pages are served before the network; RSC payloads are never served at all

**Decision.** Two changes in the worker's fetch handler, opposite in shape:

- **Anything precached and not under `/private` is served from the cache first**, with a
  revalidation behind the response.
- **RSC payloads get a deadline and nothing else** — no cache, no retry, and on timeout the
  rejection is allowed through.

**Why stale-while-revalidate is safe here specifically.** The cache name carries `BUILD_ID`, so a
deploy empties it and `precachePublic` refills it; and every public route is statically rendered.
Within one build the cached copy and the network copy are the same bytes, so the round trip could
only ever confirm what is already on disk — and on a stalled connection it costs three seconds of
blank screen to do it. Nothing under `/private` is eligible, because nothing under `/private` is
ever cached (§2.1); that exclusion is now enforced inside `serveFromCache` too, so the invariant is
true by construction rather than by argument.

**Why an RSC payload gets the opposite treatment.** It is a private, per-request render. Nothing on
disk could stand in for one, and a stale payload would render as a stale page — which the previous
version of `sw-navigation.test.ts` correctly refused. What that test got wrong was concluding that
_ignoring_ the request was therefore safe: an ignored request is one with no deadline, and on a
stalled connection it never settled. That was the tab-tap freeze, and it was invisible because the
test asked whether the worker responded rather than what happened when the network did not.

**How to reverse.** Delete the precached branch in `handleNavigation` for the first; delete the
`RSC` branch in the fetch handler for the second, which restores the freeze.

### D-204 · Every network call has a deadline, and the worker's copy of the budgets is pinned to the app's

**Decision.** `src/lib/net/deadline.ts` owns `fetchWithDeadline` and one `BUDGET` table
(navigation 3s, RSC 3s, sync 10s, report 5s, asset 10s). The service worker carries a duplicate of
those numbers, and `sw-deadline.test.ts` fails if the two stop matching.

**Why any of this exists.** `fetch()` has no default timeout. A request that connects and then
stalls never rejects — and the app's entire offline story is `try`/`catch`, so **every fallback in
the codebase was unreachable in exactly the condition it was written for.** The app did not fall
back; it hung. `navigator.onLine` is `true` on plane wifi, so the one signal being consulted was
actively lying about the one case that mattered.

**Why the budgets are generous.** The failure to avoid is turning "slow but working" into
"broken" — a 1s budget on a genuinely slow connection fails requests that would have succeeded.
The fix is falling back _well_, not failing _sooner_. It is also why `sync` gets 10s: a batch of a
hundred ops is legitimately slow, and nobody is watching a flush.

**Why the duplication is allowed.** A service worker is a standalone script with no module graph;
it cannot import the file. That is the one place these numbers can silently drift, so it is checked
rather than argued about — with a positive control, since the test loops over whatever its parser
found and a parser matching nothing would pass while checking nothing.

**A stall and a rejection are kept apart.** `AbortSignal.timeout` rejects with `TimeoutError`, a
caller's own abort with `AbortError`, and `AbortSignal.any` adopts whichever fired. That
distinction decides two things: whether retrying is sensible (D-157's retry is for a _fast_
failure; retrying a stall spends the budget twice for the same fallback), and whether the failure
is evidence about the connection at all — a component unmounting is not.

**How to reverse.** Deleting the module restores the freeze. Tuning a budget means editing both the
module and the worker, which the test will insist on.

### D-203 · The notification badge is an alpha stencil, drawn from the same mark

**Decision.** A fourth icon variant, `public/icons/badge-96.png`: the brain in solid white on
transparent, with the grooves **knocked out of the alpha** rather than painted. Both places that
raise a notification — the worker's `push` listener and `local-alert.ts` — now pass it as
`badge` and keep `icon-192.png` as `icon`.

**Why.** Reported symptom: a white box in the status bar. The cause is not a broken file.
Android discards every colour in a `badge` and paints whatever is left opaque in the system
accent, so it reads the image as a stencil — and `icon-192.png` is a magenta mark on an
**opaque** near-black tile. The tile is the shape it saw. The file was always correct as a
picture and always solid as a mask.

**Why the grooves had to change, not just the colours.** `brain.svg` cuts its folds by stroking
them in the ground colour, which is invisible against the tile and completely opaque. Recolouring
the mark white while leaving that alone would have produced a white blob with no features. The
badge therefore renders through an SVG luminance mask, where the groove strokes are black and
drop out of the alpha entirely. `src/test/png.ts` reads the result: a row across the middle of
the mark must break into more than two separate opaque runs, which is the assertion that would
have failed on every version of this before today.

**Why it is tested by pixels.** This bug is invisible to every other check — the file opens,
decodes, is the right size, and looks like a brain in any viewer. Only the alpha channel tells
the fix from the bug, so the test decodes the PNG (`node:zlib` and ~60 lines, rather than adding
`sharp`) and asserts on it. `icon-192.png` is the positive control: it must still be magenta and
opaque, because the reverse mistake — pointing `icon` at the stencil — would "fix" the status bar
by turning the large icon into a white smear.

**Not simplified for the small size,** deliberately. At 24dp the silhouette is what identifies it
and the grooves are texture; widening them would make the badge a different mark from the
launcher icon, which is the opposite of what was asked for.

**How to reverse.** Point `badge` back at `/icons/icon-192.png` in both files and drop the
`badge-96.png` entry from `scripts/render-icons.mjs`. The white box comes back with it.

## 2026-09-08 · V4 §1.5–§1.12 — the rest of the system

Colour was finished on 2026-09-07 (D-194). This is everything else that is a number: type,
space, radius, elevation, breakpoints, motion, icons, the component set, a gallery to review it
all in, and the lint that was left `PENDING`. **Milestone A.**

### D-202 · "No raw hex" is a test, and it has a positive control

**Decision.** `src/lib/theme/__tests__/no-raw-hex.test.ts` walks `src/`, strips comments and
`url(…)`, and fails on any 3/4/6/8-digit hex literal outside a short allowlist. Four files are
exempt and the print block of `globals.css` is exempt as a region; each exemption carries a
written reason, and a test asserts every reason is longer than 40 characters.

**Why.** DESIGN.md §2 rule 6 has said "no raw hex outside the token file" since Phase 0, and
until now nothing checked it. The rule is what makes five themes possible at all — a component
that names a colour is a component that is wrong in four of them, and reading the line does not
tell you that. §1.12 was left `PENDING` deliberately: a lint written before §1.6 and §1.10
removed the literals would have failed on the day it was written, and a failing test that
everyone learns to ignore is worse than no test.

**Why comments are exempt.** Half the hex in this repo is evidence. `brand.ts` records that the
status bar sat at `#0a161b` for two versions; `build-tokens.mts` records that `#09A1A1` is
2.94:1 on paper. Deleting those to satisfy a regex would delete the reasoning D-194 exists on.

**The positive control matters more than the rule.** D-003's lesson applied to a lint: a scanner
that reports nothing looks identical to a scanner that is broken, and this one has three
independent ways to silently match nothing — the directory walk, the comment-stripping, and the
regex. So three tests hand it input it *must* catch, including the `url(#fade-a1b2)` case, where
an SVG fragment id is four hex characters followed by a hyphen and a naive `\b` pattern matches
it. Verified by injecting `#1e1018` into a real component: it failed, naming the file and line.

**How to reverse.** Delete the file. To exempt something instead, add it to `ALLOWED` with a
reason that names a mechanism which cannot accept `var()` — "it would be annoying to change" is
explicitly not one.

### D-201 · `/private/kitchen-sink` renders all five themes at once, in one browser

**Decision.** A component gallery at `/private/kitchen-sink` (Q24). Every component, every
state, every theme. It is **not** in `PrivateNav`, and it is swept by `npm run shots` as an
ungated page.

**The mechanism, because it is not obvious.** `tokens.css` scopes each palette with
`[data-theme="…"]` — an attribute selector, not `html[data-theme="…"]`. Custom properties
inherit, so putting that attribute on a `<section>` re-declares the entire palette for its
subtree. Five themes therefore render stacked on one page with no iframes, which is a stronger
answer than Q24's "both themes at once" asked for.

Two things a future edit will get wrong. A themed block **must** paint `bg-background
text-foreground` itself — `globals.css` keeps `body` transparent so the ambient layer can sit
between `<html>` and the content, so a nested theme that does not paint its own ground shows the
outer one's. And Tailwind's `dark:` variant is a generated *descendant* selector over the
dark-family themes, so it resolves correctly inside a nested block — this page is the only place
in the app where two schemes are on screen together, so it is where that stays honest.

**Every class name in it is written out in full.** Tailwind finds classes by scanning source
text; it does not evaluate code. `` className={`text-${step}`} `` generates nothing, renders at
the inherited size, and reports no error — the page looks plausible and every caption lies. That
is disqualifying for the one page whose job is to be what you check the scale against, so the
tables carry the literal class as data and accept the duplication.

**Why it is not in the navigation.** `PrivateNav` is already eight items and a scrolling row at
1440px (§4.1), and whether nine private routes is the right number is still open (V4_PLAN §8,
C11). A review tool used a few times per phase does not get to be the ninth.

**How to reverse.** Delete `src/app/private/kitchen-sink/`, `components/site/sheet-demo.tsx`, and
the row in `shots.mjs`.

### D-200 · Ten of nineteen `ui/` components deleted; the nine that stay are ours now

**Decision.** D-192 found that only `badge` and `button` were imported anywhere. Ten components
with no named future caller are deleted: `alert`, `checkbox`, `dialog`, `dropdown-menu`,
`scroll-area`, `select`, `separator`, `table`, `tabs`, `tooltip`. Nine stay — the two in use,
plus `card`, `input`, `label`, `textarea`, `sheet`, `skeleton` and `sonner`, each named by a
Phase 3, 4 or 5 item (the tag input, the forms pass, the tab-bar sheet, exact-shape skeletons,
the toast system). All nine were hand-reworked at the V4 tokens, and `src/components/ui/*.tsx`
was **removed from `.prettierignore`**: the directory is no longer upstream's, so a future
`shadcn add` would overwrite our work rather than merge with it (Q473).

**`tw-animate-css` is gone with them.** Its only four call sites were `dialog`,
`dropdown-menu`, `select` and `tooltip` — all in the delete set. That coupling is worth knowing:
keeping any one of those four would have kept the dependency (Q475).

**One real bug fell out of the rework.** `sheet.tsx` scrimmed with `bg-black/10`. A 10% black
scrim darkens paper and does *nothing* over a near-black ground, so on the three dark themes the
sheet would have opened with no dimming at all. `--scrim` is now a per-theme token, deepening
toward the theme's own background on a dark scheme and its own foreground on a light one, with a
test per theme asserting the direction.

**Also on the record: `form.tsx` never existed.** `.prettierignore` carried
`!src/components/ui/form.tsx`, `context.md` called it "the one file in `ui/` that *is*
formatted", and V4_PLAN §1.10 said it "must survive". Git history has no such file, in any
commit. `src/lib/log/form.ts` is a different thing — form-value coercion for log entries, in
`lib/log/`, never covered by the `src/components/ui/*.tsx` pattern and so already Prettier's.
All three references are deleted. `react-hook-form` and `@hookform/resolvers` stay installed for
the forms pass (§5.2).

**How to reverse.** `npx shadcn@latest add <name>` re-vendors any deleted component, and
re-adding `src/components/ui/*.tsx` to `.prettierignore` restores the old arrangement. The
rework itself is one commit and each file carries a header block listing what changed and why.

### D-199 · The rest of the scale is generated too, from `scripts/build-scale.mts`

**Decision.** `src/app/scale.css` is **generated** and committed, the way `tokens.css` is:
`npm run scale` writes it, `npm run scale:check` fails when it is stale, the test suite runs that
check, and `predev`/`prebuild` run the generator. It holds the nine-step type scale, the eight
spacing values, the named radii, the breakpoint set, the three durations and three easings, and
the icon sizes. **Edit the generator, never the CSS.**

**Why generated rather than hand-written.** The argument is D-194's, applied past colour: *a
value nobody can compute is a value nobody can check.* A nine-step scale at ratio 1.2 is nine
multiplications and nine chances to fat-finger a digit, with nothing afterwards able to tell you
that you did. It also makes the deviations legible — Q101 asked for "modular, hand-adjusted at
the extremes", and the generator prints the size it *would* have produced beside the one it was
told to use. A hand-written stylesheet cannot show which of its numbers are the system and which
are the exceptions.

**The type scale redefines Tailwind's own nine names**, rather than introducing a tenth
vocabulary. `text-xs` … `text-5xl` appear 466 times across `src/` and exactly nine distinct names
are in use — nine steps, nine names already in the codebase. So every existing call site became
scale-correct with no migration, and Milestone A is true on the day it lands rather than after a
466-site sweep. The cost is that every one of those names now produces a different size; that is
the point, since they were another design system's defaults chosen for another typeface.

`base` is the anchor at exactly 1rem. Anchoring at the bottom of the scale was tried first and
gave `base: 0.99rem`, which is worse for a reason that has nothing to do with typography: `rem`
arithmetic across the app assumes the root size, and a 15.84px `base` puts every hand-checked
"16px" measurement permanently off. The bottom step lands at **11.11px**, clearing the 11px floor
§7.1 turns into a gate — clearance, not coincidence, and the generator says so in a comment.

**Elevation and the scrim are the exception and live in `build-tokens.mts` instead.** They look
like they belong here and do not: DESIGN.md §6 makes elevation a ground-shift plus a border in
dark schemes and a real shadow in light ones. `scale.css` publishes the four *names* so Tailwind
emits `shadow-rest` … `shadow-overlay`; the values those names point at are per-theme and every
one is `color-mix`ed from the theme's own tokens, so a new theme gets a correct elevation scale
for nothing.

**Two Tailwind traps, both found by checking the built bundle rather than by reasoning.**
`--duration-*` is not a Tailwind namespace — `duration-fast` compiled to no CSS at all until
three explicit `@utility` blocks were generated for it, and an untransitioned element looks like
a design choice. And `--scrim` needed a `--color-scrim` alias in `@theme inline` before
`bg-scrim` existed. Both are the same failure mode as an interpolated class name: the element
renders, nothing errors, and the style is simply absent.

**One bug the tests caught in the generator itself.** A fluid step's floor is documented as "the
step below". It was computed as `size / RATIO`, which is the same number everywhere *except*
above a hand-adjusted step — `5xl` rounds up to 3rem, so `3 / 1.2` is 2.5rem while `4xl` actually
ships at 2.4883rem. The phone-width hero would have sat 0.5% above a step that exists, belonging
to nothing. It now reads the previous step's shipped size, and `scale.test.ts` pins it.

**How to reverse.** Delete `scripts/build-scale.mts`, `src/app/scale.css`, its two npm scripts
and the `@import` in `globals.css`; every `text-*`, `rounded-*` and `shadow-*` falls back to
Tailwind's defaults. To change the feel instead, edit one constant: `RATIO`, `OVERRIDES`,
`FLUID_FROM`, `SPACE`, `DURATIONS` or `EASINGS`, then `npm run scale`.

### D-198 · Mono is evicted from the four surfaces that are not data, and `eyebrow` is a primitive

**Decision.** DESIGN.md §2 rule 2 — mono is real data only — is enforced on the four surfaces
§1.6 names: nav labels, eyebrows, the tab bar, and panel meta. **246 `font-mono` occurrences
became 185**, and 53 eyebrow call sites across 30 files collapsed onto one `@utility eyebrow`.

**Why it needed a primitive rather than a find-and-replace.** The eyebrow was a copied class
chain and every copy had drifted: `font-mono` at `text-[0.55rem]`, `[0.58rem]`, `[0.6rem]`,
`[0.62rem]` or `[0.65rem]`, tracked at `0.1em`, `0.12em`, `0.14em`, `0.16em`, `0.18em` or
`tracking-wide`. Six sizes and six trackings for one idea. The utility sets the face, the step,
the weight and `--tracking-caps`, and deliberately sets **no colour**: D-196 moved the
page-title eyebrow to `--primary`, and the same shape is a stat label in `--muted-foreground`,
so baking a colour in would either re-break D-196 or force every stat label to override it.

**The size deviates from Q111 by 0.09px, on purpose.** Q111 asked to raise the eyebrow from
0.62rem to 0.7rem. It lands on `--text-xs` — 0.6944rem, 11.11px — which is the raise that was
asked for, landing on a step of the scale instead of becoming a seventh arbitrary value, and
clearing the 11px floor §7.1 gates. **The tab bar's 8.8px labels** — the ones D-190 found were
never measured by anything — go the same way and are now 11.11px.

**The remaining 185 are the audit, not a backlog to clear blindly.** Most are correct: dates,
splits, PRs, counts and file paths *are* mono. DESIGN.md §4 carries the list of files by count so
Phases 4–6 can judge them screen by screen, exactly as §3.1 does for the ~300 opacity utilities.
`npm run shots` covers the risk that a wider face overflows: 0 page/width combinations scroll
sideways after the change, and `/private/athletics` improved from 342px to 335px.

**How to reverse.** `@utility eyebrow` is one block in `globals.css`; adding `font-family:
var(--font-mono)` to it puts mono back on 53 call sites at once.

---

## 2026-09-08 · Carbon is the default, and amber stops being decoration

### D-197 · The default theme is `carbon`, everywhere

**Decision.** `DEFAULT_THEME` in `src/lib/theme/registry.ts` moves from `dark-magenta` to
`carbon` — a hueless near-black with a cyan accent. Victor asked for it directly.

**What that constant actually controls,** because it is more than the app's opening colour and
he confirmed all of it deliberately: the bare `:root` block in the generated CSS (so it is what
anyone who has never chosen a theme sees), the theme the **public portfolio is pinned to** via
`forcedTheme` in `theme-provider.tsx`, `GROUND` in `lib/brand.ts`, and through that the PWA
manifest, the Android splash screen and the Samsung status-bar tint. `scripts/render-icons.mjs`
carries the same value as a literal because it is plain ESM that cannot import, and
`__tests__/brand.test.ts` pins the two together.

So victorgusev.com is no longer magenta. Magenta is still shipped, still contrast-solved, and
still one tap away in settings — it is now the identity of a *theme* rather than of the site.
`context/00_meta/brand_and_voice.md` §3 was rewritten to say so.

**Also changed:** `scripts/build-tokens.mts` had `"dark-magenta"` hard-coded twice — once for
the `:root` block and once for the `@custom-variant dark` selector list. It now imports
`DEFAULT_THEME` from the registry. That is the actual fix here: the default was two literals in
two files, and changing one would have shipped a `:root` palette belonging to a different theme
than the one the app thought was default, with nothing failing.

**How to reverse.** One line: `DEFAULT_THEME = "dark-magenta"` in `registry.ts`, then
`npm run tokens` and `node scripts/render-icons.mjs`. Everything else derives. Nothing about the other four
themes changes.

### D-196 · Amber is a signal, not a kicker

**Decision.** The eyebrow — the small tracked uppercase label above a page title — moves from
`text-highlight` to `text-primary`. Eight places: `page-shell.tsx`'s `PageHeader` (which is
every private page), the homepage's three, both sign-in pages, `/offline` and `/cached`.

**The report.** Victor: "a couple of things are sticking orange in the website, not with the
theme." Correct, and it was deliberate rather than accidental — `brand_and_voice.md` §3.4 said
"peach/amber is spent sparingly — eyebrows and emphasis, never structure", so the eyebrow was
following a written rule.

**Why the rule was wrong.** `--highlight` is hue 70 in **all five** themes, because it is the
semantic warning hue and a warning that changes colour per theme is not a warning. Spending it
on decoration therefore pins one element to amber no matter what theme is applied — which is
invisible on a magenta-tinted ground and obvious the moment the ground is hueless. Carbon made
an existing problem visible rather than creating one. It also meant a stale-data badge and a
page kicker were the same colour, which is what "colour never signals alone" exists to prevent.

`training-panels.tsx` was already using `text-primary` for the same kind of label, so this
makes the codebase agree with itself.

**What keeps amber:** everything genuinely asking for attention — the freshness badge, the
sync badge's stale state, filament running low, a printer needing maintenance, a task due
tomorrow, an out-of-range training flag, and the warning callouts. Those are untouched.

**How to reverse.** `text-primary uppercase` → `text-highlight uppercase` in those eight files,
and restore the §3.4 bullet.

---

## 2026-09-08 · A settings screen, and one home per control

### D-195 · `/private/settings`, and both navigations give up their controls

**Decision.** A settings route, and the theme toggle, push toggle, install button, public-site
link and sign-out **move out** of the phone's More sheet and the desktop nav row rather than
being copied. Manual sync, a passkey link and the deployed commit join them.

**The rule, in Victor's words (Q371):** *anything that affects the website and is not used
regularly.* Everything here meets it. The reason for moving rather than copying is that two
homes for one control is how the two navigations drift apart — which this codebase has already
paid for once, with `PrivateNav` and `PrivateTabBar` maintained as deliberate duplicates
(D-132).

**This closes Q375**, which had been unreadable: *"I do not like the manual sync being in more.
It should be in settings (the Match the ...)"*. "Match the phone" is the theme toggle's label
for `system`, so the parenthesis was naming the other controls in that sheet, not a separate
request. Manual sync is under Sync; the rest is here too.

**The theme picker is a switch and then a list, not a six-item list.** "Match the phone" is a
different *kind* of choice from "use Carbon", and a list that mixes them makes the app changing
colour at sunset look like a bug — nothing on screen says the OS is driving it. With the switch,
the list stays visible while following the phone and marks the theme the OS resolved to, so
"why is it light right now" is answerable from the screen. Turning the switch off keeps whatever
was showing rather than snapping to the default.

**Swatches are painted from literals, not from `var(--primary)`.** A swatch renders a theme that
is *not* the active one, so a custom property resolves to whatever is applied and paints all
five identically. `registry.ts` carries `ground`, `accent` and `foreground` per theme and the
token test pins each against the generated CSS by converting the OKLCH — not by reading the hex
comment beside it.

**Two bugs the work surfaced, both of which fail silently:**

1. **`peer-checked:` only reaches siblings.** It compiles to `.peer:checked ~ &`, so the switch's
   knob nested inside its track never moved. The track and the knob are both siblings of the
   input now.
2. **`setTheme` takes a *name*, not an id.** The switch passed `light-teal` where `light` was
   wanted, which is a no-op with no error anywhere. A test caught it; the component now keeps
   the whole registry entry so the id (for marking the row) and the name (for `setTheme`) cannot
   be confused.

**A generator bug found on the way.** The hex and contrast comments in `tokens.css` were computed
from the *pre-rounded* OKLCH, while the CSS ships a 4-decimal value — so the documentation was
off by a channel from the colour actually rendered, and the registry literals copied from those
comments failed the test. `asShipped()` now round-trips every value through the formatter before
anything is annotated or written. Several tokens moved by one channel; the CSS and its own
comments now describe the same colour.

**Offline keeps a reduced control row.** `/private/settings` is `force-dynamic`, so a failed
navigation to it is served the cached shell — settings genuinely cannot be reached without a
network. The theme is the one control needing no server at all (`localStorage` plus an
attribute), so it stays in the offline More sheet alongside the install button. Push, sign-out
and the public site all need a round trip and were already absent offline.

**Not included: the density toggle.** Q131 asked for one, but §1.7 has not defined the spacing
vocabulary yet, so it would have nothing to switch. A control that visibly does nothing is worse
than a missing one; it lands with §1.7.

**Ungated in `npm run shots`.** Every row on settings is actionable, so there is no single "the
thing you came to do" for the fold check to measure. Gating it would mean picking a control
arbitrarily and then defending the number. It is swept for screenshots and overflow.

**How to reverse.** Delete `app/private/settings/`, `components/site/settings-*.tsx` and
`theme-picker.tsx`; restore the controls row in `private-tabbar.tsx` and the control cluster in
`app/private/layout.tsx` from the commit before this one. `ThemeToggle` is untouched and still
cycles system/light/dark, so the pre-V4 arrangement works as it did.

---

## 2026-09-07 · V4 Phase 1.1–1.4 — colour becomes something you can compute

### D-194 · Palettes are solved for contrast by a generator, not chosen by eye

**Decision.** `src/app/tokens.css` is **generated** by `scripts/build-tokens.mts` and committed.
Five themes, every colour authored in OKLCH and **solved for a target contrast ratio** rather
than picked and then checked. `npm run tokens` writes it, `npm run tokens:check` fails when it
is stale, and a test runs that check.

**Why.** This project has now been bitten twice by a colour nobody could compute. `#09A1A1` sat
in the vault as the named primary accent for six weeks while being **2.94:1 on paper** —
unusable for text — and nothing about looking at it said so. `:root` and `.dark` held the *same*
dark palette for the whole of V1 and V2 because two hand-maintained blocks have no way to
disagree out loud. A generator turns "is this legible" from something you remember to verify
into something that cannot be skipped.

You declare a token as *"teal, at whatever lightness clears 5.4:1 on a card"*; the solver
returns the value. Adding a theme is a spec, not a palette.

**The two rules that produce the values**, and they differ because the tokens are used
differently:

- **Text solves against the worst ground** it can sit on — `raised` on a dark theme,
  `background` on a light one. Solving against the page ground alone is exactly how the first
  pass produced a faint grey at 4.61:1 that sat on a card at **4.07:1**.
- **Accents solve against `surface`**, the card they are on nearly everywhere. Holding them to
  `raised` as well drove the magenta to `#e981bc`, a pale pink — the opposite of the "less
  saturated, warmer" Q49 asked for. A rule that produces the wrong colour is the wrong rule.

**The five themes.**

| id | Scheme | Ground | What it is |
|---|---|---|---|
| `dark-magenta` | dark | `#12090d` | Default. Chroma 0.17 → 0.145 and hue 356 → 346: the Q49 re-tune. Primary `#d36da8` at 5.22:1 |
| `light-teal` | light | `#eef4f4` | Teal on warm paper. Primary `#007777` at 5.26:1 |
| `hc-dark` | dark | `#030303` | Every accent clears 7.5:1, not just the named ones — a "high contrast" theme whose destructive red sits at 5:1 is not one |
| `carbon` | dark | `#0e0e0e` | Experimental. Hueless grounds, so any component assuming a tinted surface shows up |
| `steel-light` | light | `#f2f5f8` | Experimental. Steel as the accent, which DESIGN.md §2 says it must never be — built to find out whether that rule holds |

**Three grounds, not two** (Q55, Q56). `background` / `surface` / `raised`, with a wider step
than the old `#140a10` / `#1e1018` pair. Plus `faint-foreground` as a second muted level that
still clears 4.5:1, and `success` / `warning`, which the app had been signalling with muted grey
and destructive red.

**Two bugs in the colour maths, both of which returned silent wrong answers rather than errors.**
Worth recording because both will come back:

1. **Out-of-gamut was treated as invalid rather than as needing mapping.** OKLCH describes
   colours sRGB cannot show — teal at chroma 0.1 is outside it at every mid lightness — and
   asking for one does not fail, it clamps a channel. The solver rejected every usable teal and
   returned a near-black "accent" at **19.45:1**. `fitToGamut` now reduces chroma until the
   colour fits: hue is what the palette *means* and lightness is what carries contrast, so
   saturation is the one of the three that can give way.
2. **A `[^)]*` regex in the test stopped at the `)` inside `:not([data-theme])`**, so the dark
   variant check reported every theme as absent. The test failed loudly, which is the only
   reason this is a footnote rather than a defect.

**The switching mechanism: `data-theme` only.** `next-themes` writes one attribute. Tailwind's
`dark:` variant is a selector list over the dark-family themes, **generated into `tokens.css`**
by the same script, so adding a theme needs no component edit and no selector anyone has to
remember. Verified in the production bundle: it compiles to
`[data-theme=dark-magenta] *,[data-theme=hc-dark] *,[data-theme=carbon] *`.

A runtime `data-scheme` attribute was the first plan — and was what Victor picked when asked —
but it was dropped on implementation and this is the deviation: setting a second attribute
before first paint needs a second pre-hydration script alongside next-themes', and if it lands a
frame late every `dark:` utility renders its light branch on a dark ground. The generated
selector list delivers the thing the choice was *for* — one edit to add a theme, no silent
failure — without that hazard. Anything genuinely varying by scheme rather than by theme is a
**token** instead (`--ambient-opacity`, `--grain-opacity`), which is right on the first painted
frame.

**`enableSystem` forced a naming compromise.** It resolves the OS preference to the literal
strings `light` and `dark` and will not find a theme called `light-teal`. So the two defaults
are *named* `light` and `dark` and mapped onto their ids by next-themes' `value` prop: storage
holds `dark`, the DOM gets `data-theme="dark-magenta"`.

**The public site is pinned dark, and the pin can now be lifted.** D-184 forced dark on the
portfolio and that still holds as the default. Q87 asked for a footer toggle, which `forcedTheme`
would have rendered inert — and a toggle a visitor presses to no effect is worse than none. The
forced value is now component state: pressing it changes the current visit and **never writes to
storage**, so a visitor's curiosity cannot follow Victor into the private app. That distinction
is D-184's own, kept.

**Light mode gets its own atmosphere.** The ambient pools drop to 0.45 opacity (Q81) and the
grain goes to zero (Q82) — it dithers banding in wide radial fills on dark grounds, and over
paper the same texture reads as a dirty screen.

**What did not change.** The ~300 `bg-primary/10`-style opacity utilities still work and are
untouched. The 50–950 ramp is the deterministic replacement — a ramp step is the same colour on
every ground, where a composite is not — but migrating them is screen-by-screen work in Phases
4–6, not a single pass.

*(The plan claimed "forty scattered `color-mix()` calls". There were **nine**. The scattering was
in the opacity utilities the whole time.)*

**Tests.** `src/lib/theme/__tests__/tokens.test.ts`, 57 of them: completeness per theme
(including the asymmetric case, where a token defined in some themes and not others silently
inherits the default's value), contrast on every ground, registry/stylesheet agreement with
grounds **computed from the OKLCH rather than read from the hex comment beside it**, and a
staleness check. Suite is 1,298 across 87 files, up from 1,240.

**One tsconfig change.** `allowImportingTsExtensions: true`, because the generator imports
`../src/lib/theme/color.ts` with its extension — which is what node needs to run it directly and
what TypeScript rejects by default. Safe because `noEmit` is already on: nothing is compiled, so
an extension that would be wrong in emitted output never reaches any.

**How to reverse.** Delete `scripts/build-tokens.mts`, `src/lib/theme/`, `src/app/tokens.css`
and the `tokens` scripts in `package.json`; restore the `:root` and `.dark` blocks and
`@custom-variant dark (&:is(.dark *))` in `globals.css` from the commit before this one; set
`attribute="class"` in `theme-provider.tsx`. Note that reversing loses the light palette as
well, since the pre-V4 one was contrast-computed rather than designed (D-184) and no longer
exists anywhere else.

---

## 2026-09-06 · V4 Phase 0 — what the docs claimed, and what is actually there

Four entries, all from V4 Phase 0 (`docs/V4_PLAN.md`). Phase 0 renders nothing; it exists
because several documents described a codebase that had drifted away from them, and every V4
phase is read against those documents. Three of the four findings below were not predicted by
the plan — they were found by running the thing rather than reading about it.

### D-190 · `tap<40px` and `text<12px` were never gates, and never covered the private app

**The finding.** `web/context.md` said `npm run shots` "sweeps the public pages at four device
widths reporting horizontal overflow, sub-40px tap targets and sub-12px text… It exits non-zero
on a fault." That reads as three checks. It is one check and two diagnostics.

In `scripts/shots.mjs` the public sweep computes `overflow`, `small` (tap targets) and `tiny`
(text size), prints all three — and then:

```js
const bad = report.overflow > 0;
if (bad) faults += 1;
```

`small` and `tiny` are never added to `faults`. They have never failed a run and never could.
Measured on 2026-09-06 against the live dev server, the public sweep reports **68 sub-12px
elements and 13–16 sub-40px tap targets at every one of the four widths, and exits 0.**

**And the private app is not covered at all.** `PRIVATE_PAGES` runs a different loop: fold
position, session rejection, screenshot. No overflow check, no tap targets, no text size. So
the 0.55rem (8.8px) labels in the tab bar and in `Stat` — the two smallest pieces of type in
the app, on the surface Victor uses daily, on a phone — have never been measured by anything.

**Why this was mis-predicted.** `V4_PLAN.md` §0.4 guessed the sweep's *selector* was missing
the small text. The selector is fine; it finds it and prints it. The gap is that nothing acts
on the number, and that the private loop never asks the question. A gate that reports a fault
in a column nobody sums is indistinguishable from no gate, and it is worse than none, because
`context.md` cited it as coverage.

**What changed now.** Only the documentation. `web/context.md` and `web/DESIGN.md` §10 now
state exactly which four things fail a run — overflow, a resume over one page, a private page
burying or missing its `data-first-action` marker, and a signed-in header that does not fit —
and state that the other two numbers are printed, unenforced, and public-only.

**The fix is V4 §7.1**, not this entry, and deliberately so: raising the floors to 44px and
11px turns 68 existing reports into 68 failures, which is a redesign, not a Phase 0 edit.
Turning the gate on before the design that satisfies it exists would mean committing with
`--no-verify` for the length of V4, which is how a gate gets uninstalled.

**Related:** this is the same class of failure as D-077 (the resume printed at 1.33 pages for
weeks because the only check was looking at it), except one layer up — here there *was* a
check, and it was reporting into a variable nobody read.

**How to reverse.** Nothing to reverse; this is a correction to prose. If §7.1 is later
declined, delete the "V4 §7.1 turns both into real gates" sentence and leave the rest, because
the rest is a true statement about the script either way.

### D-191 · Two things in the app can only be read by hovering

**The audit** (V4 §0.5, Q194). Every hover-only affordance, checked against whether a phone can
reach it. Two faults, and they are both *information*, not decoration:

1. **`rehab-checklist.tsx:106` — the fourteen-day history strip.** Each day is a 10px square
   whose fill encodes done / part-done / not-done, and whose count lives in a `title`
   attribute. The wrapping element is `aria-hidden`. So on a phone there is no hover, no
   screen-reader text, and no visible number: **the value is unreachable by any means.** It
   also breaks the "colour never signals alone" rule, since fill is the only channel left.
2. **`course-planner.tsx:95` — the per-term unit count.** Colour encodes heavy / light / fine,
   and the band that makes the colour meaningful is in a `title`. The code comment above it
   reads *"The band is stated rather than left to be inferred from a colour"* — the intent was
   right and the mechanism cannot deliver it on the device the planner is used on.

**Three that are already correct**, recorded so they are not "fixed" again:

- `log-console.tsx:81` and `task-list.tsx:140` — the delete control is `opacity-100` at base and
  only fades to hover-reveal at `sm:` and up. Correct: visible on a phone, quiet on a desktop.
- `project-grid.tsx:130` — "Read more →" is wrapped in `[@media(hover:hover)]:block`, so on
  touch it does not occupy space at all. This is the pattern the two faults above need.

**Three that are acceptable.** `theme-toggle.tsx`, `push-toggle.tsx` and `voice-entry.tsx` each
carry `title` *and* `aria-label` with the same text. The `title` is redundant rather than
load-bearing — the accessibility tree has the label — and icon-only controls in a dense toolbar
are permitted (V4 Q212, Q273).

**One decorative case, kept deliberately.** `app/page.tsx:147`, the radial glow behind the
spotlighted role, is `opacity-0` until hover. A touch user never sees it. Victor kept it in
Q315; it carries no information, so it is a decoration that desktop gets and phones do not,
which is allowed.

**Not fixed here.** Both faults are fixed in V4 §5.6 (rehab) and §5.7 (planner), where those
components are being rebuilt anyway. Fixing them now means touching a component twice.

**The rule this produced** is now standing, in `web/DESIGN.md` §9: nothing may be reachable
only by hover, and `title` is not a mechanism on a phone — it is invisible there.

**How to reverse.** Not applicable; this is an audit. The rule in DESIGN.md §9 is the reversible
part, and reversing it means accepting that the rehab history is desktop-only.

### D-192 · Seventeen of nineteen vendored shadcn components are unused, and there is no toast system

**The finding.** `src/components/ui/` holds 19 files. Exactly two are imported anywhere:

```
4 × @/components/ui/badge
3 × @/components/ui/button
```

The other seventeen — `alert`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`,
`scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `table`, `tabs`,
`textarea`, `tooltip` — are imported by nothing. Every form control in the app is hand-rolled;
`components/site/skeleton.tsx` duplicates `ui/skeleton.tsx`; the `Panel` collapsible uses native
`<details>` rather than `ui/accordion`-style machinery.

**The part that is a live gap, not just dead weight: there is no toast system.** `sonner` is a
production dependency, `ui/sonner.tsx` wraps its `<Toaster>` — and **no `<Toaster />` is
rendered anywhere in the app, and `toast()` is never called.** Nothing in 2ndMind has ever
shown a toast.

This matters because four V4 answers assume toasts exist: destructive actions are undoable *via
the toast* (Q265), toast styling is customised (Q266), toasts sit above the tab bar on a phone
(Q267), and they carry an undo affordance (Q268). Those were scoped as a styling pass inside
§5.2. They are a build.

**Consequences for the plan**, recorded rather than silently absorbed:

- **§1.10 gets cheaper.** "Rework `components/ui/` by hand at the new tokens" is two files, not
  nineteen. The other seventeen are deleted, not restyled — with the exception noted below.
- **§5.2 gets more expensive.** It has to mount a `Toaster` and wire the first `toast()` call
  before it can style one.
- **The deletion is not free and is not Phase 0's to make.** V4 §5.2 wants proper form controls
  (48px targets, labels above, blur validation), and some of `input` / `label` / `textarea` /
  `select` / `checkbox` are the obvious starting point for those. Deleting them in Phase 0 and
  re-vendoring them in Phase 5 is churn. **They are marked, not removed**, and Phase 1.10
  decides file by file: keep as the base for a V4 control, or delete.
- **`form.tsx` still must survive** — it is hand-authored, the registry never emitted it, and it
  is the one file in `ui/` that is not vendored (D-142).

**How to reverse.** Nothing has been deleted, so there is nothing to undo. If the seventeen are
later removed and one is wanted back, `npx shadcn@latest add <name>` re-vendors it — but it
will arrive at the *old* token names, which is precisely the work §1.10 exists to do.

### D-193 · `npm run paint` measures what the ambient layer costs

**Decision.** A new script, `scripts/paint-cost.mjs`, traces the same page with and without
`body::before`/`::after` and reports the difference in raster and composite time per second.

**Why.** D-179 turned the ambient drift off below 40rem on the argument that a fixed,
full-viewport, continuously-animated layer costs battery and warmth rather than frames. The
argument is sound and was never measured. V4 §1.4 redesigns the layer (Q162), and a redesign
with no baseline can only be argued about — "it feels lighter" is not a finding.

**The first version measured nothing, and did it silently.** Both bugs are worth recording,
because both are the kind that return:

1. **The event names were invented.** `Paint`, `RasterTask` and `CompositeLayers` are what
   DevTools shows in its UI and what every article about tracing uses. They are not what this
   Chromium emits. Dumping the trace showed the real names:
   `RendererRasterWorker`, `RasterDecoderImpl::DoEndRasterCHROMIUM`,
   `ProxyImpl::ScheduledActionDraw`, `DirectRenderer::DrawFrame`. Matching on a name that does
   not exist does not throw — it sums zero, and zero looks like an answer.
2. **Headless Chromium has no GPU raster pipeline.** The desktop run reported `0.00 ms/s` across
   **34,600 trace events**. Headless draws through `DirectRenderer::DrawFrame` with nothing
   behind it, so measuring a GPU cost there measures the absence of a GPU. The script is
   **headed by default**; `--headless` exists for CI and says in its own output that raster will
   read zero.

**And one sample was not enough.** The first phone-proxy run reported the layer *saving*
3.6 ms/s — a negative cost, which is noise with a finding's face on. The script now runs
**alternating pairs** (default three) and reports the **median**, alongside the run-to-run
spread. **If the delta is smaller than the spread it prints `BELOW THE NOISE, do not quote
this`** rather than a number, because a gate that reports unfalsifiable figures is how the
`text<12px` column in D-190 got ignored for months.

**And it hung the first time it was run for real.** With `cc` and `gpu` in the trace config,
`Tracing.dataCollected` delivers roughly ten thousand events a second; retaining all of them
across twelve samples wedged the process — node sat at a constant 12s of CPU for ten minutes
with 28 orphaned browser processes and never returned. Two fixes: **events are filtered inside
the handler** rather than after (a ~99% reduction, since only a handful of names matter), and
`Tracing.end` now waits on a **20-second bounded** promise, because a measurement script that
can block forever is worse than one that reports a short sample.

**Two implementation details that are easy to get wrong.** The kill switch goes in through
`addInitScript`, not `addStyleTag`, or the first frames measured still have the layer up. And
nested trace events double-count: `RasterDecoderImpl::DoEndRasterCHROMIUM::Flush` sits inside
its parent, and `MainFrame.Draw` inside `ProxyImpl::ScheduledActionDraw`. Only the outer name
of each pair is counted.

**The result, 2026-09-06 — and it is a finding.** Two pairs of five seconds, headed,
against the dev server on `/`:

| | ambient on | ambient off | delta | run-to-run spread |
|---|---|---|---|---|
| Desktop 1280, drift ON | 123.65 ms/s | 119.65 ms/s | +4.00 | **6.93** |
| Phone proxy 390, x6, drift OFF | 31.58 ms/s | 32.12 ms/s | −0.54 | **0.82** |

**Both deltas are smaller than the noise, and the script says so rather than printing them as
results.** So on this machine, headed, the ambient layer's cost is **not measurable above
run-to-run variance** — on desktop with the drift running, and on a throttled proxy with it
off.

**What that does and does not license.** It does not prove the layer is free on the Samsung:
none of a mobile GPU, a tiled renderer, thermal throttling or OLED draw is reproduced here, and
those are the actual complaint. What it does mean is that **D-179's premise is unsupported by
everything measurable on this machine**, and that V4 §1.4 must not justify redesigning the
layer on performance grounds unless the phone number says otherwise. Redesign it because the
gradients were placed by eye once (Q162) — that reason stands on its own.

A side observation worth keeping: desktop reports `raster 0.00, draw 123.65` and the throttled
phone proxy reports `raster 30.98, draw 0.60`. They are different pipelines — headed desktop
rasters on the GPU, where the work does not appear under these names at all, while mobile
emulation rasters on the CPU. Comparing the two numbers to each other is meaningless; only
on-vs-off within one row means anything.

**Still owed: the Samsung.** CPU throttling slows script and layout; it does not reproduce a
mobile GPU, a tiled renderer, or thermal behaviour, which is the actual complaint. The script
prints the real-device procedure — `chrome://inspect`, port-forward 3000, six idle seconds of
Rendering + Painting with the layer on and off. That number settles Q462 and is in
`V4_PLAN.md` §8.

**How to reverse.** Delete `scripts/paint-cost.mjs` and the `paint` entry in `package.json`.
Nothing imports it and no gate depends on it.

---

## 2026-09-05 · Round 3 — the things you notice using it

### D-178 · The icon's long-press menu, and the two deep links it needed

**Decision.** Three shortcuts in the manifest: **Log training** →
`/private/log?category=athletics`, **Quick note** → `/private?capture=1`, **End of day** →
`/private/log?category=day`. Each lands in a form rather than on a screen you navigate from.

**Two things had to exist first.** The log page accepted only `?q=`, so a category could not be
addressed at all — `LogConsole` held its tab in `useState` seeded from the first tab, full stop.
It now takes an `initialCategory`, resolved and **validated on the server** so an unknown key
can never reach the state and render a console with no matching tab.

**And the capture box was not where it looked like it was.** Victor picked "Today's capture
box", and the capture box is on `/private/log` in the live app — it is on Today only in the
*offline shell*, which is where he had been looking at it. So the app and its own offline copy
disagreed about where capture lives. Rather than point the shortcut at the log page, the box is
now on Today too, above the task list for the same reason the task list is above the stats
(§3.1): it is the one control on that page that writes. `?capture=1` focuses it, read on the
server so the cursor is in it on first paint.

**Guarded, because nobody re-tests a long-press menu.** These are three URLs in a file nothing
else imports, pointing at parameters two other files parse — rename `athletics` and the
shortcut still installs, still appears, and quietly opens the wrong form. A test resolves each
shortcut's `category` against `TAB_CATEGORIES` and fails if it names one that does not exist.
Verified by renaming the key and watching it go red.

**How to reverse.** Delete the `shortcuts` block. The two deep links are independently useful
and can stay.

### D-179 · The ambient gradient stops moving on phones

**Decision.** `mesh-drift` is disabled below `40rem`. The gradients stay; only the drift stops.

**Why.** It animates `transform` on a fixed, full-viewport layer holding three large radial
fills, forever, on every screen in the app — a composited layer the size of the display being
repainted for as long as the app is open. That is the kind of cost that surfaces as warmth and
battery rather than as jank, so it never gets attributed to the page that caused it. On a screen
this small the whole 38-second drift amounts to a few pixels nobody is watching.

Above the breakpoint it is a laptop on mains power, where it is decoration that costs nothing
that matters. `40rem` is not a new number: it is the line `.nav-mobile` already uses, and two
different definitions of "phone" in one stylesheet is a thing nobody notices until a screen
falls between them.

**This is the whole of §3.4 for now.** The sheet and save transitions in that item are
deliberately left: they are about how the app *looks*, the look is being overhauled in V4, and
building transitions now means building them twice. What is kept is the half that is about the
phone being fast rather than about taste. Narrows D-007, does not reverse it.

**How to reverse.** Delete the media query.

---

## 2026-09-06 · The last two blocked items, unblocked by asking

### D-188 · The resume PDF is offered beside the generated sheet, not instead of it

**Decision.** `Victor_Gusev_Resume.pdf` is copied into `context/assets/resumes/`, synced to
`public/` by the build, and offered as a download on all three variant pages. The generated
resume stays primary.

**This reverses D-138.** §4.4 was specified with *fallback* semantics — an uploaded PDF
replacing the generated resume for that variant. Victor reversed it on 2026-09-06 once the file
was actually in front of him, and the reason is in the dates: the PDF is from **20 August** and
the vault's resume content was updated on the **30th**. An override would have published a
document already ten days behind, drifting further with every project update, with nothing on
screen saying so. The generated sheet is current, matches the site, and is gated at one page by
`npm run shots`.

**One PDF, offered on all three variants**, as a general fallback. A file named for a variant —
`swe.pdf` — wins on that page, so making it specific later is a rename and no code change.

**No upload path, at Victor's call.** PDFs are committed to the vault folder; a resume changes a
few times a year. This is the opposite answer to §5.1's below, and the difference is frequency:
`writeVaultFile` is text-only, and binary support would be real work bought for something that
happens rarely.

**The dangerous part is the folder, not the feature.** Everything under `context/assets/`
becomes a public URL, and the file sitting next to this resume in the vault is a **university
transcript**. So the sync script gained a **per-folder allowlist** rather than a widened global
filter: `resumes/` takes PDFs, the image folders still take images only, and directories are
never followed. Three tests pin that, and all three fail when the filter is widened.

**How to reverse.** Delete `context/assets/resumes/`, the pair in `sync-vault-assets.mjs`, and
the download link. `lib/resume-pdf.ts` returns null with no folder, so nothing else changes.

### D-189 · Filament is entered on the site, which is why §5.1 was never actually blocked

**Decision.** `filament_spools` and `printers` in Postgres, with add, edit and soft-delete on
`/private/hobbies`. Spools sort emptiest-first; the count of what needs reordering is the first
thing on the panel.

**The blocker was a misread.** §5.1 sat blocked on "the inventory in `UPLOADS_NEEDED.md`" for
weeks — a table Victor was supposed to hand over. His answer on 2026-09-06 was that he wants to
add spools **on the site**, which makes the data entry the feature rather than its precondition.
There was nothing to wait for and there never had been.

**Postgres, not the vault** — the opposite of D-187's call for the course plan, one day earlier.
The difference is what the data is: a spool count changes weekly and is a quantity to sort, not a
document to read in five years. Same reasoning D-036 used to move tasks out of the vault.

**Every field is optional except the material.** The upload brief this replaces said *a rough
number now beats an exact one never*, and a form that refuses a spool because its hex is unknown
is exactly how an inventory stops being kept current. An unfilled hex is stored as `null`, not
`""`, so "no colour" is decided once at the boundary rather than on every render.

**An empty spool stays in the list.** "I have no black PLA" is the single most useful thing this
page can say, and filtering zeroes out would remove precisely that. `empty` is its own band
rather than the bottom of `low`, because the two prompt different actions — a purchase and a
plan.

**The colour reaches a stylesheet, so it is an allowlist.** `swatch()` accepts `#rgb` and
`#rrggbb` and nothing else; anything failing renders as a word. An unchecked string interpolated
into a `style` attribute is how a colour field becomes a way to inject CSS. The form uses a
native colour input, so the common path cannot produce a bad value at all — but the check is at
the render, because the form is not the only way a row gets there.

**Four printer states, Victor's own**, confirmed rather than invented: `printing`, `idle`,
`needs maintenance`, `down`. Stored as text so adding a fifth is an edit to one array, not a
migration — and that array lives in its own module with no `server-only`, because the form
renders it and the action validates against it. Leaving it in the query module would have forced
a duplicated vocabulary, which is a vocabulary that drifts.

**How to reverse.** Drop the two panels from `/private/hobbies`; the tables can stay empty.

## 2026-09-06 · The three-year plan, checked against the audit

### D-187 · A course planner that checks, never suggests, and says what it cannot verify

**Decision.** `/private/academics/plan`, desktop-only as §5.2 specified. Five term columns for
the track to June 2028, a textarea each, and a continuously recomputed answer to one question:
**what is still outstanding, and is any term overloaded?**

**A checker, not a suggester.** Victor's call. It never proposes a schedule because it does not
know what is offered when, what the prerequisites are, or what he wants to take — none of which
is in a DARS audit. A draft built from what it *does* know would be confidently wrong in ways
that take longer to unpick than to write from scratch.

**It reads the generated audit rather than changing the generator.** `degree_audit.md` is
markdown written to be read, and this is the first thing that needs to compute with it. Parsing
it keeps one format: the file is regenerated whenever a fresh DARS is saved, and a second format
would be a second thing to get wrong at the moment the first one changed.

**A course counts once.** Double-counting is the whole failure mode of a plan written by hand —
one elective quietly satisfying three lines, and the total coming out four courses short in the
term it is too late to fix. Assigned in two passes, definite claims first, so a requirement whose
list actually names the course is never beaten to it by one whose list was truncated and might
name anything. Both halves checked by breaking them.

**It separates *counts* from *might count*.** The GE lists run past two hundred courses and the
generator truncates them. Rejecting a course because the parser dropped it would be worse than
not checking, so `listNames` has three answers — yes, no, and **cannot tell** — and the screen
renders the third as "might count … the audit's list is truncated, so this is not checked". A
planner that renders a guess as a fact is claiming to know something it does not.

**Stored in the vault, not Postgres.** Victor's call, and the reasoning is lifespan rather than
speed: a document to read in five years and see the history of, not a fast-changing time series.
D-036 moved tasks the other way for a latency this does not have. The cost is a commit per save,
which is right for something touched a few times a year.

**Textareas rather than drag-and-drop**, because the fastest way to move eight courses on a
laptop is to edit text — and because it makes the screen and the committed file the same format,
so a hand-edit in the repo shows up here unchanged. That claim was briefly false: `parsePlan`
required a markdown bullet, so everything typed into the planner parsed as nothing and the
checker never moved. The bullet is now optional, and the empty-term placeholder is excluded so
the fix does not turn `_Nothing planned yet._` into a course.

**Found by the production build, not by the tests:** `PLAN_PATH` was exported from a
`"use server"` module, which may only export async functions. Nothing in a test environment
enforces the Server Actions contract, so 1224 tests passed and the build failed. The constant
now lives with the format.

**How to reverse.** Delete the route, the action, `lib/academics/`, and the link on Academics.
`course_plan.md` is an ordinary vault file and can stay.

## 2026-09-06 · Voice, notifications, light mode, and a searchable log with no signal

### D-186 · Voice entry: rules first, the model second, and it cannot save

**Decision.** A microphone on the Training form. The browser's own `SpeechRecognition` hears it,
a small grammar reads it, and anything the grammar cannot read is offered to Gemini. The result
**fills the form**; the same button that was always there is what saves.

**"Always confirmed before saving" is structural, not remembered.** `VoiceEntry` has no way to
write — its only output is a callback that sets field values. A misheard number therefore costs
a correction, never a wrong record, and that is the only footing on which a transcript belongs
near a log whose whole value is that its numbers can be trusted.

**Rules before the model, and not for cost.** A grammar is **wrong the same way every time**:
mishear it once and you phrase around it forever after. A model is wrong differently each time
and confidently. The grammar is also instant, free, and works with no signal. Gemini exists for
the phrasings nobody anticipated, which is exactly what `parseSpoken` returning `null` means.

**It gives up rather than half-filling.** A partial parse that looks like success is the worst
outcome available: it puts a wrong number in a form somebody is about to confirm because they
trust it. So "bench press 185" — genuinely ambiguous between one rep and an unfinished sentence
— returns nothing rather than inventing a rep count. The model's answer is schema-validated for
the same reason, and a response that does not fit is a refusal rather than a partial fill.

**The kind is read off the numbers when the words do not give it.** The first version gave up on
"2000 metres in 7:12" — no rowing word, so it tried to read a lift, found no weight-for-reps, and
sent to the model a sentence the grammar could read perfectly well. It now falls through to the
distance shape and calls the kind `conditioning` rather than `erg`: a distance and a time is all
that was said, and inferring the machine from Victor's habits would put a fact in the form that
nobody stated.

**Extra sets are added by pressing the add-set button.** "185 for 5, three sets" means the same
set three times, and that button already carries the previous row's values down — so pressing it
twice is exactly right and there is no second copy of the row logic to keep in step. `kind` is
filled first and alone, because it decides which fields the rows even have (D-162): writing a
split before the shape changes writes it into a field about to be unmounted.

**Where the audio goes is on the control.** Chrome streams it to Google to transcribe, the same
way a voice search does. Nothing is stored by this app and nothing about the vault is sent, but
that is a real thing to know rather than a detail, so the button's own label says it.

**Offline it refuses out loud.** Recognition needs the network; §4.3 asked for an explicit
offline state and this is it — disabled, labelled, and the keyboard's own microphone still
works on every field underneath.

**The test's first version failed for a reason worth keeping:** the mock recogniser was an arrow
function, and the component calls it with `new`. Arrow functions are not constructors, so every
case failed in a way that looked like the component being broken.

**How to reverse.** Remove `<VoiceEntry>` from `log-form.tsx`. `lib/voice/parse.ts` and the API
route are then unreferenced and can go with it; `data-add-row` is harmless either way.

### D-185 · Notifications: two scheduled jobs from the server, one raised by the app itself

**Decision.** Web Push, with all three of §4.1's triggers — and they work by three different
mechanisms, which is the thing the plan's one-line description hid.

**Permission is never asked for automatically.** Victor's call. The prompt is a consumable:
Chrome hardens against sites that spend it badly, and on Android a denial is sticky and awkward
enough to reverse that most people never do. A control in *More* that you went looking for
cannot be spent by accident and arrives with the answer already decided.

**Two cron jobs, both silent by default.** `vercel.json` schedules `/api/cron/evening` at 04:00
UTC (21:00 Pacific) and `/api/cron/morning` at 15:00 UTC (08:00 Pacific).

- The evening job sends **only on a day with nothing logged**. A reminder that arrives every
  evening regardless is one you learn to swipe away within a week, at which point it costs
  attention and buys nothing. Its presence is the information.
- The morning job sends **only when something is due**, names up to three and counts the rest.
  A notification is read at a glance on a lock screen; a list of nine is a wall that gets
  dismissed unread. The plan itself flagged this trigger as the one most likely to duplicate
  what Canvas and Google already send, which is exactly why it stays quiet on an empty day.

**The day is computed in `America/Los_Angeles`, not UTC.** The app's canonical zone already —
`athletics/trends.ts` uses it and the calendar feeds publish in it. This matters more than it
looks: the evening job runs at 04:00 UTC, which *is the next day* in UTC, so a naive boundary
would ask "was anything logged today" about tomorrow and stay silent on a day that really was
empty. Derived from formatted parts rather than arithmetic on an offset, because an offset
changes twice a year and the resulting bug is a one-hour window, once, in the dark. Tested on
both sides of a daylight-saving change.

**The cron routes refuse everything when `CRON_SECRET` is unset.** A cron route is a public URL
and "make Victor's phone buzz" is exactly the kind of endpoint that gets found and poked. A
missing secret is a deployment mistake, and the safe reading of a deployment mistake is *nobody
may ring this bell*, not *everybody may*. Checked by breaking it: making it fall open fails a
test.

**The stuck-outbox alert is not a push at all.** The server cannot know — the outbox is on the
phone, and a server that could see it would not need one. The app raises it through the service
worker it already has, which needs no key, no subscription and no network. It fires **only on
ops that have actually failed**, never on merely pending ones: pending is the system working,
and notifying about it would fire on every tunnel and every lift. And it fires only when the
failed count *rises*, remembered across reloads, because the runner flushes on reconnect, on
foreground and whenever anything asks — so one unchanged problem would otherwise produce a
burst.

**Dead subscriptions prune themselves, on exactly two statuses.** 404 and 410 mean *this will
never work again*; a 500, a timeout or a rate limit is the push service having a bad minute.
Getting this wrong in either direction is quietly bad: too eager and a working phone stops being
notified after one blip, too shy and every reinstall leaves a row that fails forever.

**Keys are generated once, by hand.** `npm run push:keys` prints a pair to paste into
`.env.local` and Vercel; nothing is written to disk by that script and nothing generates keys at
runtime. A pair that changed on deploy would invalidate every stored subscription silently, and
the symptom would be notifications simply stopping.

**`sw-template.test.ts` fired for the first time**, capping mentions of `/private` in the worker
at three. The two additions are notification *destinations* — where a tap lands — and never
touch a cache, so the strong assertion (no `/private` in any `cache.put`) still holds unchanged.
The cap was raised to five with all five enumerated, so the next one still has to be justified.

**Still to do by hand, and it will not work until then:** `npm run push:keys`, then paste both
values plus a `CRON_SECRET` into `.env.local` and into Vercel. Without them the toggle renders
nothing and the cron routes refuse.

**How to reverse.** Delete `vercel.json`'s `crons`, the two cron routes, `/api/push/subscribe`,
`lib/push/`, the two handlers in the worker, and the toggle. The `push_subscriptions` table can
stay empty harmlessly.

### D-184 · Light mode: the switch now, the palette in V4

**Decision.** `next-themes` is mounted with `attribute="class"`, `defaultTheme="system"`, and a
three-state toggle in both navigations. `:root` holds a light palette and `.dark` keeps the dark
one — which is exactly what `globals.css` has instructed since V1: *"to add light mode, redefine
`:root` and leave `.dark` alone."*

**Scoped to about a third of the estimate, at Victor's call.** §4.2 was 8h, most of it auditing
every screen in both themes. V4's overhaul explicitly includes the visual style, so the colour
work would be done twice. What shipped is the **mechanism** — provider, toggle, boundary,
browser-chrome colour — with a palette that is correct and deliberately plain. The same argument
that trimmed §3.4.

**The palette is computed, not picked.** Every value was measured against its own ground, because
the colour carrying the identity is the one that fails first on white: `#d94f93` is **3.6:1**
there, under the bar for body text. The light values are the same hues taken down until they
carry — primary 5.4:1, steel 5.3:1, destructive 5.3:1, muted text 6.4:1. The peach is the
interesting one: at **1.4:1** on white it is invisible, so in light mode it is the same hue at a
much lower lightness and reads as amber.

**The portfolio does not follow the phone.** Victor's call: it is a shopfront and should look the
same to everyone, the case-study images were composed against a dark ground, and a reader on a
light laptop would otherwise be shown a palette nobody has looked at. Done with `forcedTheme`,
not `setTheme` — and the distinction is the whole point: `setTheme("dark")` on a public page
would *write* dark into storage, so visiting the portfolio would silently undo the app's setting.
`forcedTheme` overrides what is applied without touching what is stored. The boundary is
`hasPublicChrome`, already the app's one answer to "is this the private app?", including the
offline shell (D-174). Two lists of what counts as private is how they drift apart.

**`theme-color` follows the resolved theme at runtime.** It is static markup, so it was fixed at
the dark ground — a black status bar over a white page. Driven by `resolvedTheme` rather than a
`prefers-color-scheme` media query, which is the obvious alternative and is wrong in a specific
way: the portfolio is *forced* dark, so on a public page with a light OS the query would turn the
chrome white over a page that stayed dark. The **manifest** stays dark, deliberately — it carries
one colour and the splash is a fraction of a second into an app whose icon is dark.

**The toggle has three states, and "system" is one of them** rather than the absence of a choice.
A two-way switch starts somewhere and whichever way it starts is wrong for half the day. Its
label names where a press will take you rather than where you are, which is the ambiguity every
theme toggle has.

**`brand.test.ts` went red on its own**, and its own comment had predicted it: *"keeps this
passing if a light theme adds a third, at which point this test is the thing that will say so out
loud."* It asserted both `--background` declarations equalled the dark ground. Rewritten to the
new truth — each matches its own theme's constant, in order — rather than deleted.

**How to reverse.** Remove `<ThemeProvider>` from the root layout and copy `.dark`'s block back
over `:root`. The toggle then renders a control with nothing behind it, so it goes too.


### D-183 · Offline search is the same box, the same URL, and a stated difference in matching

**Decision.** The log's search box now works with no network. `/private/log?q=…` is answered by
the worker with the offline shell, which reads the term back out of the path it was handed and
searches the local mirror. The shell's log view carries the same plain GET form aimed at the
same URL, so a search can be *started* offline as well as arrived at.

**Nothing new is stored or synced for this.** The server searches `search_text`, a column
denormalised on write so search never has to reach into JSON — and the ordinary pull already
mirrors it. The offline search reads exactly the text the online search reads.

**Where it differs from Postgres, stated rather than hidden.** Postgres stems: `run` matches
`running`, and so does `ran`. Reproducing that means shipping an English stemmer into a bundle
served to a phone. Victor chose **word-beginnings with every term required** instead:

- `run` finds `running` — the common case, which is typing less than the whole word.
- `ran` does **not** find `running`. That is the honest limit, and it is asserted as a test
  rather than left as a comment, because the same box answers both online and off and a silent
  difference in results is the kind of thing that gets acted on.
- `erg piec` finds an entry containing both, in any order and not adjacent.

No stopword list, deliberately: Postgres drops `the` and `a`, and copying somebody else's word
list would still not match while adding a second thing to maintain. "Every term must match" is a
rule that fits in one sentence.

**An empty query matches nothing, not everything** — the same answer the server gives, and the
one that cannot show a person their whole log because they cleared the box.

**Ordered and capped like the server's query**, newest first and fifty, so a result list looks
the same offline as on. Relevance ranking was not chosen: the online search does not do it, and
two orderings for one box is worse than one imperfect one.

**No "you are offline" banner**, at Victor's call. The shell already carries the age of its data
at the top of every view; saying it again per feature is repetition, not honesty.

**How to reverse.** Delete `lib/offline/search.ts`, `searchCachedLog`, and the form and results
block in the shell's log view. The online search is untouched by all of this.

---

### D-182 · The fold marker is opt-in, the gate measures the deepest, and the capture box moved

**Decision.** Three changes that only work together:

1. `data-first-action` is a prop on `TaskList` and `QuickCapture`, off by default, set by the
   caller. Marked: Today's **Due** list, Academics' list, and the capture box **on
   `/private/log`** only.
2. `scripts/shots.mjs` measures the **deepest** marked element rather than the first.
3. The capture box on Today moved **below** the Due list.

**How this was found.** §3.5 put the capture box on Today above the task list. Both carried the
marker, `querySelector` returns the first, and the gate silently switched to measuring the box:
**the number improved from 296px to 227px while the coverage shrank to nothing.** A gate that
can be relieved of its job by putting something above the thing it watches is not a gate — and
this is the same failure D-132 records from the other direction, where the schedule panel pushed
the first task to 936px and the gate never noticed because the page was only measured empty.

**"Deepest" alone was wrong, and the gate said so within a minute.** Applied as it was —
unconditionally, by a shared component rendered four times on Today — it measured the collapsed
Backlog at **1231px** and failed immediately. The rule was right and the marker was meaningless;
fixing either alone produces a worse gate than before. Built, measured, reverted, and rebuilt
with both halves.

**Then the honest number showed the real cost.** With the Due list measured again, the capture
box above it put the first task at **418px on a phone and 495px on a desktop** — five pixels
under the limit D-083 and D-132 exist to defend. One extra line anywhere above would have failed
it. A capture box is worth having on Today; it is not worth 122px above the thing the page is
for. It now sits below the Due list, and Today is back to **296px / 373px** — exactly where it
was before any of this.

The shortcut is unaffected in substance: `?capture=1` still lands on Today with the cursor in
the box, and focusing scrolls it into view. That costs a scroll and no taps.

**How to reverse.** The three parts are separable, but reversing one alone re-creates a gate
that measures the wrong thing — the state this entry exists to record. Reverse all three or
none.

---

### D-180 · Swipe on a row: right completes, left deletes, everywhere

**Decision.** `SwipeRow` wraps task rows and log rows. Right completes a task, left removes it.
A log entry has no "complete", so right resists and springs back rather than doing nothing —
left-is-destructive holds across the whole app, because a rule that changes per screen is not a
rule a thumb can rely on.

**The gesture never replaces the buttons.** They stay, keyboard-reachable, and they are what a
screen reader gets. A gesture with no visible affordance cannot be the only way to do anything.
It also goes through the *same* action dispatch the buttons use — `useActionState`'s dispatch
takes a `FormData` directly — so a swiped delete gets the same undo row a tapped one does. A
second code path for the gesture would have been a second place for a delete to go wrong.

**The undo stays inline; `sonner` stays unmounted.** Victor's call. The bottom of the screen
already carries the tab bar, the sync badge and the update prompt, and a toast would be a fourth
fixed layer over the thumb on the smallest screen. The library has been in `package.json` since
V1 and has never been mounted; this was not the reason to start.

**What makes it usable is not the swipe, it is not stealing the scroll.** Nothing happens until
the finger has moved 12px *and* moved further horizontally than vertically — and once vertical
wins, the row concedes for the rest of the gesture, so a diagonal scroll cannot snag every row
it passes. `touch-action: pan-y` says the same thing to the browser before the first
`pointermove` arrives. Both are asserted; removing the latch makes a test fail.

**Two of these tests were worthless until they were mutated.** "Springs back when a direction has
no handler" passed with the resistance removed, because the row returns to zero on release
either way — an assertion after release cannot see what happened on the way there. It now
measures mid-drag.

### D-181 · Pull down to send

**Decision.** `PullToRefresh` in the private layout — every private screen, not a chosen few.
Pulling past the threshold dispatches the same `SYNC_EVENT` §1.7's retry button uses; nothing in
the component knows how to sync, and nothing in it should.

**Why every screen.** A gesture that works on four screens out of ten is worse than one that
works on none: the four teach you to expect it and the six make you doubt yourself.

**Not on the offline shell**, where it would ask for a flush that cannot happen and spin down to
nothing. The shell sends by itself when signal returns (D-175).

**It stops when the sync stops.** `SyncRunner` now fires `SYNC_DONE_EVENT` when a run finishes,
whatever the outcome, and the indicator listens for it. The alternative — hiding after a fixed
delay — is an animation that lies about whether anything happened.

**`overscroll-behavior-y: contain` on `body`**, because otherwise a pull at the top arms both
this and Chrome's own pull-to-refresh, and Chrome's reloads the page and throws the gesture
away. Standalone installs already suppress the browser's; this is the tab case, which is where
the app gets tried first.

**Found while testing it:** the indicator had `aria-hidden` on its wrapper *and* `role="status"`
inside — so a live "Sending…" was hidden from the accessibility tree. `pointer-events-none` is
what keeps it from eating a tap; `aria-hidden` was doing nothing but suppressing the one part
worth announcing.

**How to reverse.** Remove the component from the layout, and drop `overscroll-behavior-y` if
Chrome's own gesture is wanted back. `SYNC_DONE_EVENT` is harmless on its own.

---

### D-177 · The portfolio precache keeps its images, at phone widths

**Decision.** `warmImages` scrapes `/_next/image` URLs out of each precached page's `srcset` and
caches every candidate up to **1200px wide**. `/_next/image` also joins the cache-first branch,
so anything viewed online is kept too.

**Why.** §2.2's precache took the pages and their scripts and stopped there, so a project page
opened with no signal as **text and empty boxes** — which is not something you show anyone, and
the career-fair scenario in Milestone B is exactly showing someone. Found by §3.7 on its first
run: the offline navigation passed while eleven image requests failed underneath it.

**Why 1200.** Measured rather than picked: all nine `srcset` widths of all fifteen public images
is 128 requests and **2.8MB**; stopping at 1200 is 90 requests and **~1.5MB**. 1200 already
covers a 400px phone at 3× density, and the widths above it exist for a laptop — which is on
wifi. Victor's call between the two.

**Two things that would have made this silently useless.** The URLs are HTML-escaped inside the
attribute, so `&amp;` has to be turned back into `&` or every precached URL is for a different
request than the page will make. And `/_next/image` answers `Vary: Accept`, which the Cache API
honours on lookup — a response fetched with a default `Accept` would never match the browser's
own image request, so the cache would fill with entries that never hit. The fetch now sends a
browser's `Accept` and the lookup passes `ignoreVary`.

Confirmed by the suite rather than by eye: **11 of 11 images render on a project page with the
network off.**

**How to reverse.** Delete `warmImages` and its call, and drop `/_next/image` from the
cache-first branch. The portfolio still opens offline; it just goes back to being unreadable.

---

## 2026-09-05 · The offline round trip has a machine that checks it

### D-176 · `npm run e2e` drives a real browser offline, against a real build and a real database

**Decision.** `scripts/e2e-offline.mjs`, run by `npm run e2e`. Eighteen checks, in the sequence
Victor performed by hand: the worker installs and precaches, the radio goes off, `/private`
navigations are answered with the shell, the portfolio still opens, a Training entry with two
sets is written, the network returns, and **the entry has to reach Postgres exactly once** with
its sets intact. Then the row it created is deleted.

**Why it is not part of `npm test`.** Victor's call, and the arithmetic supports it: the unit
suite finishes in 28 seconds and this takes a build plus a browser. It is a fourth gate, run
deliberately, like `npm run shots`.

**Against a production build, not `next dev`.** The worker precaches by scraping
`/_next/static/…` out of the pages it caches, and dev serves different URLs than a build does.
Run against dev, this would exercise a caching behaviour no phone ever sees — which is the one
thing §3.7 exists to check.

**Against the real database, with teardown by SQL.** The plan deferred this check for weeks
because §1.2 removed hard deletes, so a row written through the app can never be removed
through the app. The resolution is that teardown deletes directly, scoped to the client ids the
run generated, and refuses if any of them fails a uuid check. Verified: the table was at six
rows before and six rows after.

**Four things it found on its first runs, three of which were the suite's own fault.** They are
worth recording because each is a way this kind of test lies:

1. **The tab bar was "missing".** It is `.nav-mobile`, hidden above the phone breakpoint, and
   Playwright defaults to a 1280px viewport. The check was true and meaningless. The context is
   now 390×844, which is what this app is for.
2. **`networkidle` never arrived.** The dashboard registers a worker, starts a sync and asks
   Gemini for a summary, so the network is never quiet — the navigation timed out on a page
   that had rendered fine. It now waits for the worker, which is the real precondition.
3. **A Gemini 503 timed out the run.** The first navigation is now `/private/sync`, which mounts
   the same layout and the same runner without asking an external model anything. **A suite that
   fails when a third party is busy is a suite people learn to re-run.**
4. **`navigator.onLine` lies on the way back up.** Playwright flips the flag before the network
   stack is ready, and specifically the *first POST* after a restore fails even once a GET has
   succeeded. That produced a genuinely failed flush, which put the op into backoff — and since
   nothing retries on a timer, the rest of the run was measuring the backoff rather than the
   feature. The readiness gate is now a request of the same shape as the one under test: an
   empty-ops POST, which sends nothing and asserts the endpoint answers 200.

**It was mutation-tested, which is the only reason it is worth having.** Removing
`<SyncRunner offline />` and rebuilding makes it fail with `attempts: 0, lastError: null` — the
runner never tried — and exit 1. Restored, it passes again.

**How to reverse.** Delete the script, `scripts/lib/session.mjs` (folding `mintSession` back
into `shots.mjs`), and the `e2e` line in `package.json`.

---

## 2026-09-05 · The offline app sends for itself, and its links stop asking a server

Found while building §3.7's test, before the test existed: writing down what the suite would
have to assert forced the question of who flushes the outbox on the shell, and the answer was
nobody.

### D-175 · The cached shell runs its own sync, gated on having something to send

**Decision.** `SyncRunner` takes an `offline` prop and is mounted on `/cached`. In that mode it
returns early unless the outbox has something pending, and its badge is a plain anchor rather
than a `<Link>`.

**Why it was needed.** `SyncRunner` lived only in the private layout, so an entry written with
the radio off sat in the outbox until `/private` was opened — *even after signal returned, and
even though the person was looking at the app.* That is exactly what happened on 2026-09-05:
Victor's airplane-mode entries reached Neon only once he navigated back into the live app. The
shell could write and could not send, which is half a feature.

**Why it could not simply be mounted.** `flush` posts **even with an empty outbox**, on purpose
— that empty POST is how changes made on the laptop reach the phone — and `/cached` is a static
route anyone can open. Mounted unguarded, every stranger loading that URL fires one
authenticated call that 401s, which is the precise reason the component's own comment kept it
off public pages. So `offline` gates the whole run on `pendingCount(db) > 0`: nothing queued,
no request at all, and a device with a queue is by definition one that has signed in.

**What it gives up.** Pull. On the shell it only ever pushes, so the screen keeps showing the
snapshot it had rather than refreshing itself when signal returns. Victor's call, and the
honest one — the snapshot is labelled with its age, and the live app is one tap away.

**And every link on that page is now a document navigation.** `Elsewhere`'s "Try the live app"
was still a `<Link>`, which made the one control whose entire job is *find out whether the
server is back* try to reach it through the router — a client transition that cannot succeed
with no signal and reads as a dead button. `next/link` is now absent from `cached-app.tsx`
entirely, which makes the property structural rather than remembered.

**The test for this took three attempts, and the first two were worthless.** A `<Link>` renders
a plain anchor with the same `href`, so asserting on the tag or the href passes whichever is
used. Asserting that a click is not cancelled also passes both ways, because jsdom has no
router context for `<Link>` to cancel into. Only mocking `next/link` to mark what it renders
distinguishes them — and that assertion is paired with a positive one inside `/private`, so it
cannot pass merely because the mock never applied. Both were confirmed by forcing the anchors
back to `<Link>` and watching them fail. **Two versions of this test would have shipped green
while asserting nothing**, which is the argument for mutating a test before trusting it.

**How to reverse.** Drop the `offline` prop and its two effects, and remove `<SyncRunner />`
from `src/app/cached/page.tsx`. The shell then writes but does not send, as before.

---

## 2026-09-05 · The offline app did not look like the app

The device round found it, which is what the device round is for. Victor, in airplane mode:
*"it takes me to the public page, and doesn't let me go to private, so logging in airplane
mode/offline does not work."*

**The last clause turned out to be wrong, and that is the interesting part.** Logging offline
worked the whole time — he could write an entry and save it. What was broken was that the
screen did not read as the app, so a working feature was reported as a missing one. A test
could not have caught this: every assertion about `/cached` passed, because each was about what
the component renders and none was about what surrounds it.

### D-174 · The offline shell is the private app, and is dressed as it

**Decision.** Four changes, all presentation, none touching the sync or write path.

`hasPublicChrome()` now excludes `/cached` as well as `/private`, so the offline shell no
longer renders the portfolio header and footer. `CachedApp` renders `<PrivateTabBar>` on every
branch — including the two failure branches, since a screen that cannot show its content is
when a way off it matters most. `viewFor()` returns a target rather than a view key, and names
the five screens the phone keeps no copy of instead of silently showing Today. And
`registration.update()` is skipped with the radio off.

**Why the chrome was wrong and not merely untidy.** `/cached` lives outside `/private` for a
reason that has nothing to do with how it looks: everything under `/private` is `force-dynamic`
and calls `requireSession()`, so it cannot be precached, and D-161 moved the shell out to make
it servable at all. The chrome predicate keyed on the path, the path had moved, and the header
came back — carrying the portfolio's nav and none of the app's. The bottom tab bar lives in the
private *layout*, so it was absent for the same reason. **What he saw was the public site's
navigation above his own dashboard**, which is a fair description of "the public page".

**The tab bar takes two new props, and one of them is not cosmetic.** `path` overrides
`usePathname()`, which on this screen is always `/cached` — without it no tab is ever current.
`offline` swaps `<Link>` for a plain anchor: a client transition fetches an RSC payload from a
server that by definition is not reachable here, so every tab would have failed silently in the
one situation the bar exists for. `Elsewhere` in the same file was already a plain `<a>` for
exactly this reason, and the reason had not been generalised. Sign-out is dropped while
offline, because it posts and can only fail.

**Naming the absent screens reverses a fall-through.** Every unrecognised path used to resolve
to Today, so tapping Calendar with no signal showed the dashboard — which reads as the tap
having failed, or worse as Calendar being empty. This is the same argument D-161 already made
for panels inside a view, applied one level up; `Missing` was making it correctly in the views
while the router above it did the opposite. The prefix list is longest-first so
`/private/work/tailor` is not reported as *Work*. `/private` itself still resolves to Today,
because it is the manifest's `start_url` and is how the app is opened.

**A crash report is not a normal outcome.** `registration.update()` fetches `/sw.js`; offline
it rejects, and unhandled it reached the global reporter and filed itself as a crash. Two
arrived from the phone during this very test — a diagnostic system reporting the absence of a
network as a fault, at the moment its output was least affordable. Same `onLine !== false`
guard the worker's retry already uses (D-157), plus a `catch` regardless.

**How to reverse.** Restore the one-line `hasPublicChrome` predicate for the header; drop the
`<PrivateTabBar>` from `CachedApp` and its two props for the navigation; return a bare
`ViewKey` from `viewFor` for the fall-through. The four are independent.

---

## 2026-09-05 · The gate, before the work it is meant to gate

V3 was replanned this day (`docs/V3_PLAN.md` §3.0): everything remaining is pulled onto
Milestone A's date, and nothing new is built until the offline work is proven on a device.
Round 1 is the gates, because Rounds 2–6 are all measured by them — and one of them had stopped
measuring anything.

### D-172 · Database tests are named `*.db.test.ts` and share one process

**Decision.** `npm test` failed 7 of 1077 on Victor's laptop — every failure a 30s `beforeEach`
timeout, every one of those files passing when run alone. `vitest.config.mts` now defines two
projects. `unit` is everything else, unchanged. `db` is `src/**/*.db.test.ts`, running with
`fileParallelism: false`, `isolate: false` and `environment: "node"`, which makes the ten
database files share a single process — and therefore a single `src/test/pg.ts` module instance.
Ten files renamed to carry the suffix.

**Why.** Measured before changing anything: booting PGlite costs **~5.9s**; replaying all seven
migrations into it costs **0.7s**. The expensive thing is the WASM boot, not the schema, and
under one-worker-per-file ten of them were paying it simultaneously. That rules out the two
obvious fixes — caching a migrated dump saves the cheap half, and `loadDataDir` still boots.

`hookTimeout` had already been raised for this once, from 10s to 30s, when there were **three**
such files; the comment recording that is still in the config. Raising it again treats a number
that grows every time a table gets a test. **A flaky gate is worse than a slow one** — the
sentence is already in `src/test/pg.ts`, written in August about this same failure: it teaches
you to re-run rather than to read.

Measured after: **the full suite goes 115s → 33s**, and the ten database files go from seven
timeouts to 235 tests in 11s. Most of the rest came from `node` — those files never touched the
DOM (the four that appeared to had test names containing the word *window*), and jsdom setup was
the single largest line in the old run.

**The cost is that those ten files can now see each other's module state**, so both halves of
the trade are asserted rather than assumed. `src/test/__tests__/db-test-conventions.test.ts`
fails if a test that boots a database is not named `*.db.test.ts` — which would silently put it
back in the parallel group — and fails if a `*.db.test.ts` file introduces `vi.mock`, fake
timers, `stubEnv`, `stubGlobal` or a `process.env` write. Both were checked by breaking them and
watching the right assertion go red. It skips itself, by `import.meta.url` rather than by name,
because its own patterns are written out in its source — which it caught on its first run.

**How to reverse.** Delete the `projects` block and restore a single flat `test` config; the
`.db.test.ts` names are then merely descriptive and the conventions test should go with it. If
one database test genuinely needs mocks or fake timers, the answer is to give *that file* its
isolation back — move it out of the group and let it pay for its own boot — rather than
relaxing the guard for all ten.

### D-173 · `/sprint-review` is retired

**Decision.** `.claude/commands/sprint-review.md` is deleted. Goal editing lives on `/private`,
and the separate `/private/sprint` route it was written against no longer exists. Confirmed by
Victor 2026-09-05, closing the item that had been open in `V3_PLAN.md` §8 since V2.

**What went with it, stated because it was not replaced.** Five of the command's seven steps
are now the app's job. Two are not: appending the closing week to
`context/04_operations/logbook_archive.md`, and running `python scripts/audit_freshness.py`.
The script still exists and still runs; nothing now *prompts* either one. If the logbook stops
being written, that is the cause, and the fix is a smaller command covering only those two
steps rather than restoring this one.

**How to reverse.** `git revert` the deletion. The file is a prompt with no dependencies.

---

## 2026-09-04 · Private navigation read as frozen

Victor reported page switches feel very slow. Measured the deployed site rather than the code:
Vercel puts the function in `iad1` while requests enter at the `hkg1` edge, so even `/signin` —
no database, no API call — costs 400–600ms TTFB before anything else runs. That trip is not
ours to remove before 2026-09-20 (UCLA, `iad1` is ~60ms from there), so both fixes below target
what *is* in reach: making the app look responsive across that latency instead of frozen by it.

### D-171 · The above-the-fold entrance fade is gone; the reveal further down stays

**Decision.** `.rise` is removed from the home hero, the facts grid, and the sign-in card. It
stays on the "Most recent" / "Previous Experience" sections, the two pointer cards, the hobbies
grid, and every `ProjectGrid` card.

**Why.** `.rise` animates `opacity: 0 → 1` over 600ms. A fully transparent frame does not count
as painted, so every element carrying it was invisible until its own animation finished. On the
home page that meant FCP landed at ~1384ms in a session where every asset had already arrived
by ~500ms — roughly 900ms of the page being blank on purpose. On `/signin`, the one page every
expired private session is funnelled through and already the slowest TTFB on the site, the fade
sat on top of that and read as the app hanging rather than the network being slow.

Below the fold, the same animation costs nothing: it plays while the reader is still at the top
of the page, and on `ProjectGrid` specifically it is load-bearing — re-keying the grid on filter
change replays the stagger as feedback for the click, which is a different job than hiding
first paint and is not this decision's target.

**How to reverse.** Add `rise` back to the hero `<section>` ([page.tsx](src/app/page.tsx)), the
facts `<dl>`, and the sign-in card ([signin/page.tsx](src/app/signin/page.tsx)). The keyframes
and utility are untouched in `globals.css`.

---

### D-170 · Dynamic-route prefetches stay warm for 30s

**Decision.** `next.config.ts` sets `experimental.staleTimes.dynamic = 30`.

**Why.** Every `/private/*` route is `force-dynamic` (D-045), and Next's default for a dynamic
route's client-side prefetch cache is 0 seconds — so the `loading.tsx` shell D-045 added, which
qualifies these routes for prefetching at all, was discarded almost immediately. Read a page for
more than an instant and the next tap has nothing to reuse: the skeleton itself has to wait on a
server round trip before it can appear, which is what read as the app freezing rather than
navigating. 30s only extends how long that already-fetched shell — layout plus the loading
placeholder — stays reusable; every Suspense boundary past it still streams fresh data on each
navigation, so nothing here can show stale private content.

**How to reverse.** Delete the `experimental.staleTimes` block from `next.config.ts`.

---

## 2026-08-30 · V3 scoping — the phone

These are **planning** decisions, not decisions about code that exists. V3 turns 2ndMind into
an installed, offline-first app on a Samsung phone. Scope was settled by 44 questions before
anything was built, which is the same order the 2026-08-29 round used and for the same reason:
the expensive mistakes here are architectural, and they are cheapest to argue on paper.

The plan they produce is `docs/V3_PLAN.md`. Where an entry below contradicts something already
built or already written down, it says so and names it.

### D-169 · A workout is addressed by the server's id, and the mirror had never worked

**Decision.** `identityOf` names `workout` and `workout_set` rows by the server's `id`. It had
no case for them at all, so they fell through to the client-UUID branch and it threw — on every
workout row the server sent, on every pull, since §1.2 shipped. **The workout mirror had never
populated once.**

The sync runner caught the throw and carried on, which is what a runner should do and is also
why nobody knew. Found on 2026-09-04 by the error panel D-165 put on the dashboard, on the first
day it had anything to show: *`workout_set row has no clientId` — 11 times, from five routes.*

**Why the server's id is safe here and nowhere else.** `workouts` and `workout_sets` are
pull-only (`SYNC_DESIGN.md` §11.1), so the phone never mints one and there is no window in which
two devices can disagree about what a row is called. Every writable table needs a
client-generated key precisely because a create must survive being retried; these cannot be
created, so they do not. **If they ever become writable this case has to move to a client key
first** — the §4a aggregate op §11.1 defers is the same piece of work.

**What it cost while it was broken.** `panels.ts` re-does the athletics merge client-side, so the
cached athletics screen has been reading an empty workout store: offline, the training page has
been showing quick-logged sets and nothing imported from Hevy. The bug is contemporaneous with
§1.2, so no data was lost — nothing had ever been written to lose.

**The test checks every entity, not this one.** `identityOf` is three lines of `switch`, and
what went wrong was not a wrong branch but a *missing* one. A test naming `workout_set` would
have been written by someone who already knew; a loop over `ENTITIES` catches the next table
added without a case, which is the same mistake one table later.

**How to reverse.** Restore the `default:` fall-through and workouts stop mirroring again. There
is no reason to, but the entry says what the symptom would be: no error on screen, an empty
training page offline, and everything online unaffected.

---

### D-168 · The error panel is one line until you open it

**Decision.** `ErrorPanel` is a `<details>`: a summary line naming the top problem and its
count, with the full list and the "dealt with" buttons behind the disclosure. It shipped three
days ago (D-165) as an open list of cards.

**Why.** On its first real day it had five things to say, and five cards pushed the first task
on `/private` to **936px** — further down than the 791px D-083 was written to fix. A panel
reporting that something is broken had made the working part of the page unreachable. Its
height was unbounded by construction: it grows with however many distinct things are wrong,
which is exactly when the rest of the page matters most.

**What collapsing costs.** A closed thing is read less than an open one, and that is a real
cost, not a rounding error — D-165's whole argument was that a panel nobody reads is worthless.
So the summary line carries the finding rather than a count: `TypeError — workout_set row has
no clientId · 11×`. "5 errors" would have been the version that trades away the point to save
the pixels. It is still first on the page and still in a red border; what moved behind a tap is
the *other four* and the buttons, which are follow-up rather than news.

**Native `<details>`**, not state: no hydration boundary, keyboard-accessible for free, and it
opens before the component's JavaScript has loaded — which matters for a panel whose subject is
things going wrong.

**How to reverse.** Swap `<details>`/`<summary>` back for `<section>` and a heading. D-165's
rule that the panel is absent when nothing is open is untouched by this and must survive any
reversal — that is the half of it that is load-bearing.

---

### D-167 · Actionable content first, on every private screen

**Decision.** V3 §3.1. D-083's rule — the thing you can do above the things that describe it —
applied to the three private screens that had never had it. Measured at 390px, production build:

| | before | after |
|---|---|---|
| `/private` | 936px | **296px** |
| `/private/athletics` | 855px | **342px** |
| `/private/academics` | 541px | **266px** |
| `/private/calendar` | 297px | 297px, unchanged |
| `/private/log` | 205px | 205px, unchanged |

Desktop improved with them: `/private` 891 → 373, athletics 617 → 374.

**`/private`: the schedule moved below the tasks.** D-132 measured the first task at 265px and
the gate has passed ever since — on days with an empty calendar. On a term day the schedule is
six or seven rows and the number was 936px. The gate never caught it because the page was only
ever measured empty, which is the same class of failure as a test that has stopped testing
anything. The schedule is also the wrong kind of content for the top: it is the one thing on
that page that happens whether or not you read about it.

**`/private/academics`: the list before the numbers, and three across.** Straight D-132: "Open"
is the length of the list below it and "Overdue" is a subset of that list, so leading with them
meant scrolling past a summary of the answer to reach the answer. `sm:grid-cols-3` also stacked
them below 640px, spending ~290px of a phone screen on three single digits.

**`/private/athletics`: rehab above the goal card.** The rehab ticks are the only thing on that
page you can *do*; the goal card, nine chart panels and the PR tables are all things to look at.
For a protocol that has to be done daily, 855px is the difference between a habit and a page you
mean to open. The goal card stays above the charts, because it is the piece of reference that
says what the charts are for.

**Two screens were deliberately left alone.** Calendar and the log already passed, and changing
a passing layout to match a pattern is how a measured improvement becomes a preference.

**How to reverse.** Each is one JSX block moved within one file, and each carries a comment
naming the number it was moved for. Reversing any of them should re-run `npm run shots` — if
the number does not go back up, the reason given here was wrong and the entry should say so.

---

### D-166 · The fold check covers every private screen, and a missing marker is a fault

**Decision.** V3 §3.2, **pulled ahead of §3.1** at Victor's call on 2026-09-04. `npm run shots`
sweeps all ten private screens, five of them gated on how far down the first actionable element
sits. The marker is renamed `data-task-list` → `data-first-action`, on the same DOM node so the
numbers stay comparable with D-083's 791px and D-132's 265px.

**Why the order was swapped.** §3.1 is a ten-hour reordering pass and §3.2 is the three hours
that measures it. Doing the pass first meant reordering four screens by opinion against one
screen's worth of measurement — the exact thing V3 §7's "measure, do not assume" was written
after. The swap cost nothing: same total, same design, and §3.1 then had a before-number per
page and a gate that fires if a panel creeps back.

It paid immediately. The first sweep found `/private` at 936px, a regression on the one page
that had been measured, invisible for as long as it took the calendar to have something in it.

**Which element is "the answer" was Victor's call, not an inference:**

| | the marker sits on | |
|---|---|---|
| today | the Due task list | "what do I do now" |
| log | the quick capture box | getting a thought out of your head (D-164) |
| athletics | today's rehab checklist | the only thing on the page you can tick |
| academics | the Outstanding list | already a `TaskList`, so it came for free |
| calendar | today's agenda | "what do I have next" |

**Five screens are ungated because they carry no action at all** — now, work, tailor and hobbies
are vault documents you sit down and read, and sync is a report on a queue. They are still
screenshotted. Gating a page with nothing to reach would either invent an action to satisfy the
gate or teach us to ignore the gate, and both are worse than not measuring.

**A gated page with no marker is its own fault.** Otherwise the check reports nothing and the
page passes by having lost the very thing being measured, which is how a page stops being
checked without anyone noticing. Verified by gating `/private/hobbies`, which has no marker:
exit 1, with the reason named.

**The measurement is settled, not instantaneous.** It reads the number twice half a second
apart until two readings agree. Without that it is a race it loses about half the time: every
private page streams, the boundaries around the schedule and the summaries use
`fallback={null}`, and `networkidle` fires while the response is still open. Measured in one
sweep, same build and same server: **208px at 360 wide and 936px at 390** — the difference being
whether the schedule had arrived. The low number is not a better layout, it is an unfinished
page. A racy gate is worse than no gate: it passes often enough to look healthy and fails often
enough to be dismissed as flaky. The screenshot is taken after settling for the same reason.

**The gate was verified in both directions.** Lowered to 250px it fails with exit 1 on four
pages; restored to 500px it passes with exit 0. A gate that has never fired is not known to be a
gate — D-083's rule, applied to D-083's own gate.

**How to reverse.** Set `gated: false` on every row of `PRIVATE_PAGES` and the sweep becomes
screenshots again. Drop `settledFold` and the numbers become noise; do not drop it without
replacing it with something that waits.

---

### D-165 · Errors go to this app's own endpoint, not to a vendor

**Decision.** V3 §2.4, implementing D-137 — and reversing the *how*. Crash reports POST to
`/api/errors`, land in an `error_reports` table in Neon, and surface on the dashboard. **No
Sentry, no SDK, no third party.** D-137 named this as a drop-in alternative; Victor chose it on
2026-09-04.

**Why the vendor lost.** Sentry's tooling is genuinely better — stack traces, release tracking,
alerting. What it costs here is that a GPA, per-course grades, bodyweight and a phone number are
one bad scrubbing rule away from an external service, and a scrubbing rule that fails does so
silently and in the wrong direction. Nothing leaving the infrastructure removes that failure mode
entirely rather than mitigating it. The tooling gap is real and is worth less than the exposure.

**A crash report is the one payload in this app nobody wrote on purpose.** Every other write is a
person deciding to record something; this one is assembled by machinery out of whatever happened
to be in scope when something broke. So it is **allowlisted, not blocklisted**: a fixed schema, a
cap on every field, and the two free-text ones scrubbed for emails, phone numbers, named secrets
and long opaque tokens. A blocklist is the natural design and fails open, silently.

The scrub runs **twice** — on the device and again on the server. Not redundancy for its own sake:
the client pass means a report held in `localStorage` on a phone that never reconnects is not
sitting there as an unscrubbed copy of something. The server pass exists because the endpoint is
open to anything that can POST, so the client's work is a convenience and not a boundary.

**A real bug, found by a test rather than by reading it.** The email pattern `[\w.+-]+@…` is
quadratic in the length of a run of word characters. Scrubbing *before* truncating meant a 50KB
stack — which a deep recursion really produces — cost about a second of CPU: on an open,
unauthenticated endpoint, a way to burn a core per request, and on the phone, a freeze inside the
error handler at the moment something was already going wrong. Truncate first, then scrub. Pinned
by a test with a wall-clock bound.

**The endpoint accepts unauthenticated requests, deliberately.** The failures worth knowing about
happen where there is no session to check: a worker throwing during `install` runs before anyone
signs in, an error on the public portfolio has no session by definition, and a 401 loop is itself
a thing that needs reporting. Gating it would silence exactly the class of failure D-137
scheduled it for. That cost is paid explicitly — a byte cap before parsing, an allowlist schema, a
crude per-instance rate limit, and rows that are **counted rather than accumulated**.

**Counting is what stops the reporter causing an outage.** A broken selector in a render loop
produces thousands of identical reports in seconds; a row each is how a diagnostics table becomes
the largest thing in the database. One row per fingerprint, upserted — which also makes it correct
under concurrency, where a read-then-insert would lose one of two simultaneous reports.

**The fingerprint ignores numbers, quoted values and the stack.** Numbers and quotes because
`failed at row 41` and `row 42` are one problem. The stack because chunk names are content-hashed,
so including it would make every deploy look like a fresh crop of new errors.

**It always answers 204**, whatever happened. A reporter that can tell a real failure from a
rejected one is a reporter that will retry, and a retry loop inside error reporting turns one
broken thing into an outage.

**Three rules govern the client half**, each a way this could make things worse: never throw
(every call site is already going wrong), never loop (`reporting` guards it), and never lose the
phone's errors — a crash with no signal is the case this was scheduled for and is exactly the case
a naive `fetch` drops. Failures are held in `localStorage`, bounded at twenty, oldest dropped, and
flushed on the next load rather than on the `online` event, which lies.

**The panel is not there most of the time**, and that is the point. Aggregation only helps if a
report is read, and a panel permanently showing "0 errors" stops being read within a week. Same
rule as the unsorted pile (D-164). "Dealt with" hides a row and nothing more — a repeat clears the
flag server-side, which is the only behaviour that makes hiding it safe.

**Three swallowed `catch` blocks now report:** the sync runner's (the phone stops syncing, nothing
on screen changes, the outbox grows for a week), the cached shell's store failure, and the service
worker's install and precache. That last one is the whole argument of D-137 — a failing worker on
a Samsung produces no log anyone will ever read.

**`error_reports` is deliberately not syncable.** No `syncColumns()`, not in `ENTITIES`.
Diagnostics are one-directional and disposable; mirroring them onto the device that produced them
would spend the phone's storage on its own crash log.

**How to reverse.** Remove `<ErrorWatch />` from the root layout and the panel from the dashboard,
and the feature is off while the table stays. To go to Sentry instead, `lib/errors/client.ts` is
the only file that has to change — the schema and the scrubbing are already the right shape for
it, which is the point of keeping them separate.

**Not done.** No alerting: the panel is seen when the dashboard is opened, and nothing pushes.
Deliberate for now — a phone that buzzes about its own crashes is a phone that gets its
notifications turned off — and revisit if something important sits unread for days.

---

### D-165 · Errors go to this app's own endpoint, not to a vendor

**Decision.** V3 §2.4, implementing D-137 — and reversing the *how*. Crash reports POST to
`/api/errors`, land in an `error_reports` table in Neon, and surface on the dashboard. **No
Sentry, no SDK, no third party.** D-137 named this as a drop-in alternative; Victor chose it on
2026-09-04.

**Why the vendor lost.** Sentry's tooling is genuinely better — stack traces, release tracking,
alerting. What it costs here is that a GPA, per-course grades, bodyweight and a phone number are
one bad scrubbing rule away from an external service, and a scrubbing rule that fails does so
silently and in the wrong direction. Nothing leaving the infrastructure removes that failure mode
entirely rather than mitigating it. The tooling gap is real and is worth less than the exposure.

**A crash report is the one payload in this app nobody wrote on purpose.** Every other write is a
person deciding to record something; this one is assembled by machinery out of whatever happened
to be in scope when something broke. So it is **allowlisted, not blocklisted**: a fixed schema, a
cap on every field, and the two free-text ones scrubbed for emails, phone numbers, named secrets
and long opaque tokens. A blocklist is the natural design and fails open, silently.

The scrub runs **twice** — on the device and again on the server. Not redundancy for its own sake:
the client pass means a report held in `localStorage` on a phone that never reconnects is not
sitting there as an unscrubbed copy of something. The server pass exists because the endpoint is
open to anything that can POST, so the client's work is a convenience and not a boundary.

**A real bug, found by a test rather than by reading it.** The email pattern `[\w.+-]+@…` is
quadratic in the length of a run of word characters. Scrubbing *before* truncating meant a 50KB
stack — which a deep recursion really produces — cost about a second of CPU: on an open,
unauthenticated endpoint, a way to burn a core per request, and on the phone, a freeze inside the
error handler at the moment something was already going wrong. Truncate first, then scrub. Pinned
by a test with a wall-clock bound.

**The endpoint accepts unauthenticated requests, deliberately.** The failures worth knowing about
happen where there is no session to check: a worker throwing during `install` runs before anyone
signs in, an error on the public portfolio has no session by definition, and a 401 loop is itself
a thing that needs reporting. Gating it would silence exactly the class of failure D-137
scheduled it for. That cost is paid explicitly — a byte cap before parsing, an allowlist schema, a
crude per-instance rate limit, and rows that are **counted rather than accumulated**.

**Counting is what stops the reporter causing an outage.** A broken selector in a render loop
produces thousands of identical reports in seconds; a row each is how a diagnostics table becomes
the largest thing in the database. One row per fingerprint, upserted — which also makes it correct
under concurrency, where a read-then-insert would lose one of two simultaneous reports.

**The fingerprint ignores numbers, quoted values and the stack.** Numbers and quotes because
`failed at row 41` and `row 42` are one problem. The stack because chunk names are content-hashed,
so including it would make every deploy look like a fresh crop of new errors.

**It always answers 204**, whatever happened. A reporter that can tell a real failure from a
rejected one is a reporter that will retry, and a retry loop inside error reporting turns one
broken thing into an outage.

**Three rules govern the client half**, each a way this could make things worse: never throw
(every call site is already going wrong), never loop (`reporting` guards it), and never lose the
phone's errors — a crash with no signal is the case this was scheduled for and is exactly the case
a naive `fetch` drops. Failures are held in `localStorage`, bounded at twenty, oldest dropped, and
flushed on the next load rather than on the `online` event, which lies.

**The panel is not there most of the time**, and that is the point. Aggregation only helps if a
report is read, and a panel permanently showing "0 errors" stops being read within a week. Same
rule as the unsorted pile (D-164). "Dealt with" hides a row and nothing more — a repeat clears the
flag server-side, which is the only behaviour that makes hiding it safe.

**Three swallowed `catch` blocks now report:** the sync runner's (the phone stops syncing, nothing
on screen changes, the outbox grows for a week), the cached shell's store failure, and the service
worker's install and precache. That last one is the whole argument of D-137 — a failing worker on
a Samsung produces no log anyone will ever read.

**`error_reports` is deliberately not syncable.** No `syncColumns()`, not in `ENTITIES`.
Diagnostics are one-directional and disposable; mirroring them onto the device that produced them
would spend the phone's storage on its own crash log.

**How to reverse.** Remove `<ErrorWatch />` from the root layout and the panel from the dashboard,
and the feature is off while the table stays. To go to Sentry instead, `lib/errors/client.ts` is
the only file that has to change — the schema and the scrubbing are already the right shape for
it, which is the point of keeping them separate.

**Not done.** No alerting: the panel is seen when the dashboard is opened, and nothing pushes.
Deliberate for now — a phone that buzzes about its own crashes is a phone that gets its
notifications turned off — and revisit if something important sits unread for days.

---

### D-164 · A capture box above the tabs, an unsorted pile below it, and tabs that wrap

**Two reports from Victor on 2026-09-05**, both about what is on screen rather than what is
stored.

**The tab row wraps instead of scrolling.** It was one horizontally-scrolling line, which kept it
to a single row of pixels and hid whatever did not fit — on a 360px phone that was the last two
categories, with nothing on screen to say they existed. A tab you cannot see is a tab that does not
get used. Two short rows cost about 30px and hide nothing. The original choice was deliberate and
was simply wrong about which cost mattered.

**A capture box, above the tabs, on every category.** One field, one send button. The whole point is
that it asks nothing: a capture box that wants a category is a filing form, and filing is exactly
the work being deferred — the same reasoning `addInboxNote` already records for tasks.

*Note or task, and it defaults to note.* They go to different places and only the writer knows
which a sentence is — "that stroke cue worked" is a note, "email the coach" is a task with a
checkbox and a due date it may one day need. Note is the default because it is the cheaper mistake:
a note can be filed later, whereas a task nobody meant sits in a list demanding to be ticked. A
task goes to `source: "inbox"`, which is the dashboard's existing triage list, so nothing new was
invented for it.

*It restores what was typed if the save fails.* React blanks a function-action form as soon as the
action returns, success or not. That matters more here than anywhere else in the app: the entire
premise is that a thought is captured before it is lost.

**`note` is a real category that gets no tab.** `Category.capture` marks it. It summarises,
searches and syncs like any other — it simply has no place in the row, because a sixth tab for the
one thing meant to need no choosing would put the choice back. `TAB_CATEGORIES` is what the row
renders; `CATEGORIES` is everything writable.

**The unsorted pile.** Notes wait in their own panel above the form, with a count, and each carries
a one-tap target per category. A select on a phone is a modal wheel, and filing has to cost less
than writing the thing did. Filing keeps the text, moves the category, and **recomputes
`search_text`** — that string carries the category label, so leaving it would make a filed entry
findable under "Note" and not under "Training", which is the opposite of what filing is for.

*The panel disappears completely when empty.* A second inbox is a real cost — another list that can
silently fill up — so it earns its place by being invisible when there is nothing in it and by
never nagging when there is.

*Filing only ever moves an entry out of the pile.* `fileEntry` requires the row to be unsorted.
Without that guard a mistyped id would silently recategorise a real training entry, with no undo —
the log has no edit path anywhere else, and this is not the place to introduce one by accident.

*Unsorted notes are kept out of the Today list*, because the pile sits directly above it and a
duplicated row costs the vertical space this whole change is about. They join it once filed.

**What this deliberately is not.** Filing does not open the form to add fields to a note. The log
has no edit path anywhere — a mistake is deleted and re-logged — and inventing one here would be a
second way to change a stored entry, with different rules from the first. If a note needs numbers,
delete it and log it properly. The pile exists so the thought survives until then, not to become an
editor. **Say so rather than implying otherwise**, and revisit if the pile turns out to fill with
things that wanted structure.

**It works offline**, on `/cached`, through `localCaptureWriter` — both destinations are writable
entities, so both go to the outbox and are sent by the ordinary flush (D-163). Filing happens later,
online, on a screen that needs a server anyway.

**How to reverse.** Delete `components/site/quick-capture.tsx` and its two call sites; drop the
`note` category from `CATEGORIES` (leaving it in `RETIRED_CATEGORIES` so existing notes stay
readable); remove the `Unsorted` panel and `unsortedEntries`/`fileEntry`. The tab row: put
`overflow-x-auto` back in place of `flex-wrap`.

---

### D-163 · The log writes with no signal, and the portfolio opens without one

**Decision.** V3 §2.2, two halves.

**Writing offline.** The cached shell now carries the log form itself — the *same* `LogForm`,
handed a writer that puts the entry into the outbox instead of posting a Server Action. `LogForm`
gained one optional `write` prop; nothing else about it changed, so the set shapes, the chips, the
sticky values and the restore-what-you-typed-on-failure all work identically offline.

*Why injection rather than a branch on `navigator.onLine`.* The component stays ignorant of the
network, which means the offline path is exercised by a test that passes it a function rather than
one that fakes a radio — and it means there is no state in which the form has to decide, mid-submit,
which of two write paths it is on.

*Why the outbox rather than a second send path.* §1.2 built the store and §1.3 built the flush. An
entry enqueued here is sent by exactly the code `roundtrip.test.ts` already runs against real
Postgres. Nothing new had to be trusted, and the join is what `lib/offline/__tests__/write.test.ts`
guards: that the offline writer builds the same row the Server Action would. That failure does not
throw — a field parsed differently, or a missing `searchText` on a `notNull` column, looks saved on
the phone and is rejected days later.

*It reuses the reading half.* `readField`, `readRows` and `takeBodyweight` are the same functions
the action calls. Two parsers for one form is how a field means one thing offline and another
online, with nothing to say so.

**The public precache.** The worker caches every page `/sitemap.xml` names — home, `/now`, the
projects index, every public project, all three resume variants — plus the scripts each needs.

*The list is read, not written.* A hand-maintained array is a second list to keep in step, and it
fails silently: a project ships, nobody adds it, and it is missing from the one device that needed
it. Adding a project now precaches it with no code change. The risk this moves is that the worker
writes to disk whatever a fetched document names, so it filters `/private` explicitly before
writing — belt and braces on top of "the sitemap is public by construction", which is the right
amount of care for the one file in the app that can put private data on disk and leave it there
after sign-out.

*It runs in `activate`, not `install.`* A dozen documents and their assets would hold a new worker
in `installing` for seconds on a phone, delaying the update prompt for pages that are a nicety —
while the two that matter, the offline page and the app shell, are already in from install.

*Assets are cached once, not once per page.* Twelve pages share most of their chunks.

**`/now` already carries its "as of".** The section asked for a visible date on the cached copy;
the page has printed *"Last update <date>"* since D-099, which is the content's own date and
therefore better than a build date. Nothing was added.

**How to reverse.** Offline writing: drop the `write` prop from `LogForm` and delete
`lib/offline/write.ts` — the shell's log view goes back to read-only. Public precache: delete
`precachePublic` and the `SITEMAP_URL` constant; public navigations fall back to the offline page
again.

**Still not done.** The shell's "logged today" list is a snapshot taken once, so an entry written
there does not appear in it until a reload. Deliberate — the panels must not disagree with the
"as of" line above them — and the page says so rather than looking like it lost something.

---

### D-162 · A set shows only the numbers that kind of session has

**Decision.** Row fields are chosen by `kind`: a lift gets weight and reps, an erg piece and a
water session get distance, time and stroke rate, conditioning gets time, distance and reps. Set
type is in every shape. `lift` is the default, so the form opens ready for the common case before
`kind` has been touched.

**Why.** Victor, 2026-09-05: a bench press was offering a distance, a time and a stroke rate. Not
merely untidy — four things to read past on a phone between sets, which is most of the fifteen
seconds §1.6 is built around. The category's own promise is that it can be finished one-handed.

**Keyed off `kind` rather than off the exercise name.** Remembering that "Bench Press" is a lift
was the cleverer option and was declined: it guesses wrong on a new exercise and offers no obvious
way to correct it, whereas `kind` is already the first control in the form and already sticky, so
it costs a decision he was making anyway.

**There is an escape hatch,** because a shape is a good guess and never a rule: *every field*
reveals all of them for this entry. A form that cannot record what actually happened is worse than
one carrying a spare field.

**Hidden fields are unmounted, not hidden with CSS.** A hidden input still posts, so a split typed
into an erg piece and then switched to a lift would arrive on the entry as a number nobody meant —
and this form's whole claim is that its numbers can be trusted. The cost is that switching kind
clears what was typed into a dropped field, which is the right way round.

**An unknown `kind` falls back to the default shape, not to nothing,** so a category that grows a
new kind degrades to a usable form rather than an empty one.

**How to reverse.** Delete `shapes`, `shapeBy`, `defaultShape` and `always` from the Training row
group in `lib/log/categories.ts`. `rowFieldsFor` returns every field when a group declares no
shapes, so the form goes back to showing all of them and nothing else needs touching.

---

### D-161 · The app opens with no signal, at a static route outside /private

**Decision.** A new **static** page at `/cached` renders Today, Training, Academics and the log
out of IndexedDB. The service worker precaches it at install, warms its scripts, and serves it
in place of any `/private` navigation that fails. V3 §2.1.

**Why it could not live under `/private`.** Every route there is `force-dynamic` and calls
`requireSession()`, so rendering one needs a server — which is exactly what is missing when it
is wanted. That is the whole reason §2.1 was not simply "add caching to the dashboard".

**Why serving it without a session check is not a leak.** The HTML holds no data. It is
headings, labels and an empty shell; every value on screen is read from IndexedDB *in the
browser*, and that store exists only on a device that has already signed in and synced. Someone
opening the URL on their own phone gets an empty page. Same reasoning as `SYNC_DESIGN.md` §8
and D-128, and the same reason a Client Component may render private data it must not contain.

**The worker now names `/private`, and that is new.** It reads the path to choose between the
shell and the offline apology. It still never writes a private *response* to the cache — that
would survive sign-out and is real personal data — and `sw-template.test.ts` now pins the
narrower property directly: no `cache.put` may mention a private path.

**Two things that look like details and are not.**

*The shell's scripts are precached too*, scraped out of its own HTML at install. Without that
the feature half-works in the worst way: the HTML is cached and serves, so the page appears,
but React never hydrates — and since everything is read client-side, airplane mode gets a
heading and the word "Reading…" forever. A build manifest is the right answer and is §2.2's
job; the scrape needs no build step and over-caches by a few kilobytes.

*A navigation to `/cached` itself is served the shell*, with its own query untouched. Its view
links are plain navigations, so without this, moving from the offline Today to the offline
Training screen lands on the offline page — the app working right up until you touched it.

**A cached screen must read as cached.** The age of the data is at the top of every view, and
is shown whether that age is two minutes or two weeks; only the tone changes. A dashboard that
looks live and is three days old is worse than none, because it gets acted on.

**What it deliberately does not show**, named on screen rather than left blank: the calendar and
the day's summary (not mirrored — Google and the model both need the network), the degree audit
and course notes (vault markdown, which is §2.2), and **records, charts and the adjusted-split
table**. That last one is the interesting refusal: records are derived from the whole history
(D-025) and only part of that history is mirrored, so a PR board computed here would be wrong
in the one direction that matters — too low — and look authoritative. An empty panel reads as
"nothing on today", which is a different and false claim, so each of these says why it is
missing.

**How to reverse.** Delete `app/cached/`, `components/site/cached-app.tsx`, `lib/offline/`, and
the `SHELL_URL` half of the worker's navigation branch. Nothing else depends on them; the
offline page goes back to catching every failed navigation.

**Not done.** The shell reads and does not write — logging offline still needs the form to have
loaded once. Closing that is §2.2's precached app shell, not this.

---

### D-160 · A stuck entry is held forever, explained in words, and never discarded

**Decision.** V3 §1.7. `/private/sync` lists everything the server has not accepted, says why in
a sentence, and offers one action: send it again. The badge escalates — quiet count, then age
past 24 hours, then a destructive-coloured "not sent" for a rejection — and never fades.

**There is no delete button, and that is the decision.** An entry in that list is the only copy
of something he wrote. The app offering to throw it away, at the exact moment it is being
unhelpful, is how a log stops being trusted — and the log's entire value is that it can be. A
rejected op is held indefinitely and retried only when asked. There is a test that fails if a
button matching /delete|discard|remove/ ever appears on that screen, because a delete button is
the obvious thing for a later change to add to a list of things that will not go away.

**Why the messages are rewritten.** The raw text is Zod's, or Postgres's, or an HTTP status.
None of it is addressed to the person holding the phone, and a screen that prints it is a screen
that gets ignored — which here means an entry that silently never arrives. A validation
rejection now says the server would not accept the contents *and that the copy on the phone is
safe*, which is the fact that actually matters at that moment.

**Failure outranks age in the badge.** A rejected op will still be there next week, so calling
it "waiting" is a claim that gets more wrong the longer it stands.

**The screen reads only IndexedDB**, like the shell above: a page that explains why something
has not been sent must not itself need a connection.

**Verified against the section's own criterion.** `stuck.test.ts` enqueues a malformed entry,
has the server reject it, then relaunches ten times — closing and reopening the database, which
is what a cold start does — and asserts after each that the op is still there, still failed,
still carrying its payload and its reason. Then it requeues and watches it arrive.

**How to reverse.** Remove `/private/sync` and the `MORE` entry pointing at it, and revert the
badge to the plain pending count. `lib/sync/outbox-view.ts` is pure and can stay.

---

### D-159 · One log for training: sets in rows, applications out, and both sources feed the PRs

**Four changes to the quick log**, all from Victor on 2026-09-03 after using it. Taken together
because they are one question — what the log is actually for — and separating them would have
meant four passes over the same file.

**1. Training logs sets, not a set.** His words: *"logging training is weird because it has it
log by individual rep, not by a full set, like it does in the training tab."* The form
collected one weight and one reps, so three sets of bench press were three entries or one
entry recording a third of the work. `Category` gained an optional `rows` group — repeated
fields, addressed as `sets.0.weightLbs` — and Training declares one. The exercise is typed
once; each set is a row under it.

*One entry is one exercise, not one session.* Deliberate: the log is written at the rack
between sets, and a form that wanted a whole session is a form nobody finishes. "Add set"
copies the row above, because the second set is nearly always the first one again.

*Rows are keyed by a generated id, never by index.* Removing the middle of three renumbers the
third, React reuses the removed row's DOM node for it, and the values on screen shuffle up by
one — a silent corruption of a record whose entire value is that its numbers can be trusted.
There is a test that fails if this is changed back.

**2. Those sets count toward the records.** They had to, or the log would be a diary that the
PR board, the e1RM charts, the weekly volume and the bodyweight-adjusted erg table all ignore.
The phone **cannot** create a `workouts` row — `SYNC_DESIGN.md` §11.1 explains why, and
reversing that needs the aggregate op in §4a, roughly ten hours and a migration. So the merge
happens on read instead: `allEfforts()` now unions `workout_sets` with the sets inside
`log_entries`, and every consumer keeps reading `Effort[]` unaware of where a set came from.

Cheaper, and better in one respect: nothing about sync changed, so a set logged in airplane
mode reaches the PR board by exactly the path §1.3 already tested. The cost is that a
quick-logged exercise is not a session — it does not appear under "Recent sessions", which
lists `workouts` rows and therefore Hevy imports.

**3. Bodyweight can be logged from Training, and is stored once.** The field sits on the
Training category but never lands in the entry's `data`: `takeBodyweight` lifts it out and it
goes to `bodyweight_entries`, which is what the weight chart and every adjusted split read. A
second copy in a log entry's JSON is a number that can disagree with the chart and that nothing
would ever reconcile. A rejected weight does not reject the entry — he is standing at a rack,
and losing three sets to a misplaced decimal point is the wrong trade.

**4. Applications is retired; Study is three fields lighter.** Applications are tracked in a
Google Sheet, and logging them in two places meant neither was complete. Study asked for a
kind, a status and a grade — three decisions to record having sat down with a problem set, and
a grade arrives weeks later on a different screen anyway. Course and hours are what get
plotted; the note field every entry already has takes the rest.

**Retired, not deleted.** `work` keeps its definition in `RETIRED_CATEGORIES` because
`summarise` and `searchTextFor` are handed a category key and a blob of JSON — with no
definition to match, every application ever logged would silently lose its company, role and
status from the timeline and from search. `categoryByKey` finds it for reading;
`writableCategoryByKey` does not, which is what stops it coming back through the Server Action.

**The Training tab's own form is unmounted.** Victor: *"quick log should replace it, but logging
should still be possible from the laptop"* — `/private/log` is a normal page and works on both,
so the tab now links to it. `components/site/workout-log-form.tsx` stays in the repo, the same
call as D-158: it is the only way to create a `workouts` row by hand, and keeping it keeps
`logWorkoutAction` referenced rather than an unreachable write endpoint.

**How to reverse.** Each part independently. Sets: delete `rows` from the Training category and
the rows are gone from the form, though entries already written keep theirs and `summarise`
still reads them. The PR merge: delete `loggedEfforts` from `athletics/queries.ts` — nothing
else changes, the sets simply stop counting. Bodyweight: remove the field from the category.
Applications: move the entry from `RETIRED_CATEGORIES` back into `CATEGORIES`. The old workout
form: restore one import and one `<WorkoutLogForm />` in `app/private/athletics/page.tsx`.

**Not done, and worth knowing.** Quick-logged training does not appear under "Recent sessions",
and there is no way to edit a set after saving — the log offers delete and undo, and correcting
a weight means deleting the entry and logging it again.

---

### D-158 · The biometric lock is built and not mounted — one line turns it back on

**Decision.** `<LocalLock>` is removed from `app/private/layout.tsx`. Everything behind it stays:
`components/site/local-lock.tsx`, the ceremony, the local verifier, the credentials route, and
all 46 tests, still green. Re-enabling it is restoring one import and wrapping the return.

**Why.** Victor's words on 2026-09-04: *"I do not like the auth every single time I log in."* The
lock re-locks on every cold start (`sessionStorage` dies with the app, D-154), and a cold start
is most launches on a phone — so the cost was a fingerprint several times a day, permanently.

The benefit it bought was always narrow, and D-154 said so: a **display gate, not a data gate**.
The page's payload has already been sent, §1.2's mirror is unencrypted, and anything past a
casual look defeats it. What it actually defended against was someone picking up an already
unlocked phone — which the phone's own lock screen also defends against, and which is a
low-likelihood event for a device that lives in a pocket. Several fingerprints a day, forever,
against that, is a bad trade. **Removing it is a considered reversal of D-154, not an
abandonment of it**, and it is the reversal D-154 named.

**Why kept rather than deleted.** The work is done and correct — a real signature check against
a cached key, verified against genuine ES256 signatures — and the reason to want it back is
foreseeable: a laptop left in a lab, or a decision to encrypt the mirror (the `prf` version
D-154 sized and declined), which needs exactly this ceremony. Deleting it would mean rebuilding
it. Dead code rots, so the tests stay green and the cost is watching for that, which the suite
does for free.

**How to re-add.** In `app/private/layout.tsx`: restore
`import { LocalLock } from "@/components/site/local-lock";` and wrap the returned fragment in
`<LocalLock>…</LocalLock>` instead of `<>…</>`. Nothing else. To make it less intrusive rather
than absent, raise `AUTO_LOCK_MS` in `lib/auth/lock-state.ts` — the intrusiveness is entirely
that a cold start always locks, so a version that only locks after N hours away is a small
change to `decideLock` and is the middle option if "never" turns out to be too far.

---

### D-157 · The lock arms itself, and the offline page stops claiming there is no signal

Two things reported from the installed app on 2026-09-03. Different code, same shape: **a
failure that presents as an absence**, so there is nothing to investigate and no reason to
suspect anything is wrong.

**"There is no biometric login."** D-154 armed the lock from the sign-in response, which is the
one moment the credential is already in hand. That turned out to be the wrong *only* moment: a
session lasts seven days, so a device signed in before the feature shipped never runs that code
again. And because an unarmed lock **opens** — deliberately, D-154 — there was no lock screen,
no error, and nothing anywhere saying why. The feature was working exactly as written and was
invisible.

**Decision.** `GET /api/auth/local-credentials` returns every enrolled passkey's public half to
a signed-in session, and `LocalLock` asks for it the first time it finds nothing cached and has
signal. Nothing in the response is secret — a credential id and a public key, both public by
definition, which is the same reason they can sit in IndexedDB at all. The session check is
still first: an unauthenticated caller has no business learning which devices are enrolled.
`getSession`, not `requireSession`, because the latter redirects and would deliver an HTML
sign-in page where JSON was expected.

The sign-in path still caches too. It arms sooner and costs nothing.

**"This page needs a signal" — on a phone with signal.** Tapping Log in the installed app landed
on the offline page. Three separate faults, and the third is the one that matters:

- The service worker gave up after **one** attempt. A dropped request on a phone is ordinary —
  a radio handing between cells, wifi associated but not yet authenticated — so one retry is
  most of the fix and costs one request when it is not needed.
- The page **asserted** the cause. It said there was no signal without ever reading
  `navigator.onLine`. Wrong is worse than vague: it sends you looking for a network problem that
  is not there.
- The page was a **dead end**. No retry, no way back, and no indication of what had failed. A
  page shown *because* something went wrong is the worst possible place to leave someone with no
  action.

**Decision.** The worker retries once, then hands over the offline page with the failed path
attached. The page reads the connection before saying anything — `false` is conclusive, `true`
means "something else went wrong", which is a different sentence and a different action — and
carries Retry and a way back to the dashboard. The `?from=` path is validated as same-origin
before Retry uses it: it arrives in a URL on a page anyone can reach, and an absolute URL there
would make the button an open redirect.

**Corrected the next day, twice.** The retry was made conditional on
`self.navigator.onLine !== false`: with the radio off it buys nothing and doubles how long the
screen sits blank before the offline page appears, which is what "auth stalls and never shows
anything" was. And the escape links moved *out* of the client component and into the page's
server output — putting the only way out behind a JavaScript chunk, on the page shown when
something failed to load, made the fix for one bug into a worse one. `<noscript>` does not cover
that: a chunk that fails to *fetch* is not a browser with scripting disabled. **D-158.**

**Tested by executing the worker**, not by reading it. `sw-template.test.ts` asserts on source
text, which is the right tool for "never caches a private route" — a property about what the
file *says* — and the wrong tool for anything about what it *does*. The retry is one line and is
invisible to every other kind of test here, so `sw-navigation.test.ts` loads the worker into a
sandbox with fake globals and runs its fetch handler.

**How to reverse.** Delete the credentials route and the `fetchCredentials` call in `LocalLock`
to go back to arming only at sign-in. Remove the inner `try` in the worker's navigation handler
to go back to one attempt. Neither is load-bearing for anything else.

---

### D-156 · One database-error translator, and it reads the cause chain

**What happened.** `0005_sync_columns` was generated on 2026-08-31 for V3 §1.2 and **never
applied to Neon**. Drizzle went on building every query with `client_id`, `updated_hlc` and
`server_seq`; the database had none of them. Three days later every page touching tasks, the
log, workouts, bodyweight or rehab failed at once, and what it printed was the failed SQL and
its fifteen column names — a message naming everything except the one thing wrong. Applied
2026-09-03 against a database holding six rows, so nothing was lost.

**Why nothing caught it, which is the part worth keeping.** `src/test/pg.ts` builds a fresh
PGlite and applies *every* migration file, so the schema under test is by construction the
schema the code expects. That is the right default and it is also the one arrangement in which
drift cannot occur — the suite was structurally incapable of noticing, and 808 passing tests
said nothing about the database that actually serves.

**A second bug found while writing the test for the first.** Four hand-written `describe(error)`
helpers existed across four `actions.ts` files, each translating *"relation does not exist"*
into "run db:migrate". **Every one of them was dead code.** Drizzle wraps what the driver threw:
its own `message` is the SQL, and the Postgres error — with the SQLSTATE and the sentence that
says what is wrong — hangs off `cause`. Matching on the top-level message never matched, and
nobody noticed because the fallback still printed *something*. Four copies, one bug, four times.

**Decision.** One `describeDbError` in `lib/db/describe.ts`, used by every action and every page
that renders a database failure. It walks the `cause` chain for both message and SQLSTATE, and
separates the three cases that need different fixes:

- **missing table** (42P01) — a fresh clone; migrate.
- **missing column** (42703) — *the database is behind this build*; migrate. This is the case
  none of the four copies had, and it is the one that only appears once you have been shipping
  for a while.
- **missing function** (42883) — a migration's trigger function never ran; migrate. Worth
  naming, because otherwise it reads as a code bug.

Anything else passes through untouched. A connection timeout told to "run db:migrate" would
send him to the one place the answer is not.

**And a way to see it before it bites:** `npm run db:status` lists repo migrations against
applied ones and exits non-zero when any are pending. Deliberately **not** wired into `predev`
or `prebuild` — both would put a network round trip in front of every start and fail on a plane.

**How to reverse.** Delete `lib/db/describe.ts` and restore the local helpers; nothing depends
on it structurally. Do not restore them as four copies. Remove `db:status` from `package.json`
to drop the check.

---

### D-155 · The form remembers context, never measurements — and chips print what they fill

**Decision.** Three shortcuts, all declared per field in `lib/log/categories.ts` rather than
special-cased in the form: `sticky` values pre-filled from the last entry in that category,
`chips` offering recent values as one-tap buttons, and an explicit `keypad` per field.

**The line that matters is which values may come back on their own.** A sticky field is
*context* — which kind of session, which course, where you were. **Never a measurement.** A
stale `kind` is obvious at a glance and costs nothing; a stale weight pre-filled and saved
without looking is a number in the log that reads as measured, and the log's entire value is
that its numbers can be trusted. `sticky.test.ts` asserts this over every category rather than
trusting the one word per field that enforces it, because adding `sticky: true` to a number
field is exactly the change someone makes without thinking.

**Measurements do come back — through a chip, which prints them.** Tapping
"Bench Press · 185 × 5" fills the exercise, the weight and the reps. That is the same data the
sticky rule forbids, and it is fine for one reason: it is a visible choice about a number shown
on the button. A silently pre-filled 185 and a tapped 185 differ only in whether anyone decided
it, which is the whole difference between a convenience and a fabricated record.

**Keypads are declared, not derived from the field type.** Reps wants digits, weight wants a
decimal point, and a duration typed as `2:17` needs the full keyboard because no numeric keypad
on Android offers a colon. Deriving them from `type` gets two of those wrong, and the failure is
invisible on a laptop — it costs a keyboard switch per field, which is most of the fifteen
seconds the section is budgeted against.

**Two smaller calls.**

- **A clipboard button, not a clipboard read.** The Applications `link` is always pasted, but
  reading the clipboard on focus raises a permission prompt nobody asked for and means the app
  looks at the clipboard on every visit to a field that is usually empty. One tap, only when he
  means it.
- **A failed save puts back what was typed.** React blanks a `<form action={fn}>` as soon as
  the action returns, success or not — so before this, a save rejected for a reason outside the
  form (`DATABASE_URL` unset, say) also cost the entry. Fixed while in here; it is the same
  bug class as everything else in this section, which is *the log has to be cheap or it does
  not get written*.

**One design note that is not obvious from the code.** Sticky values are read through
`useSyncExternalStore`, not into state in an effect. `localStorage` cannot be read during SSR,
so anything read at render time differs between the server's HTML and the client's first paint;
a store with an explicit empty server snapshot says that in one place instead of spreading it
across an effect and a cascading re-render. Its `version` is also what remounts the fields after
a save — React's own form reset restores the defaults the inputs were *mounted* with, which
would be the previous sticky values.

**How to reverse.** Remove the field's flag in `categories.ts` — `sticky`, `chips`, `carries`,
`keypad`, `clipboard` are all opt-in and absent means the old behaviour. To drop the whole
feature, remove the `chips` prop from `LogConsole` and the `recentForChips` call in the log
page; nothing else depends on either.

---

### D-154 · Local unlock is a real signature check, in the page — not in the service worker

**Decision.** `/private` sits behind a lock screen that verifies a WebAuthn assertion against a
public key cached on the device, with no network. The ceremony runs in the page, not in the
service worker the plan named. Enrolment is unchanged: the key is handed to the device by
`POST /api/auth/login` after a successful online sign-in, converted from COSE to JWK on the
server so no CBOR parser reaches the client bundle.

**Why not the service worker.** Not a preference — it cannot work there. `navigator.credentials`
is `[Exposed=Window]`: a service worker has no `CredentialsContainer` at all, and the prompt
needs a document and a user gesture besides. What §1.5 was really asking for is that the
*verification* need no server, and that is what this does.

**What it is worth, stated plainly, because it is easy to overrate.** The verifier and the
decision it feeds both run in JavaScript this origin serves, so anyone who can run code in the
origin can skip it. It is a **display gate, not a data gate**: the page's payload has already
been sent, and §1.2's offline mirror sits unencrypted in IndexedDB. What it defends against is
a phone handed over already unlocked — which is the threat this app actually has, the device
lock screen being the primary control. Encrypting the mirror under a key derived from the
authenticator (the WebAuthn `prf` extension) is the version that would be a data gate; it is
much larger than 9h, it changes every read and write in §1.2, and losing the authenticator
would lose the data. Not now, and not without deciding that trade on purpose.

**What the signature check buys over a boolean**, which is the reason it was worth writing:
the lock cannot be opened by anything short of the real authenticator answering a challenge
generated seconds ago. A copied profile directory, a replayed assertion, a stubbed
`navigator.credentials`, and a genuine assertion for another site all fail — each is a named
test in `assertion.test.ts`, signed for real by a real key pair.

**Three smaller calls inside it.**

- **`userVerification: "required"`, not `"preferred"`.** The verifier refuses an assertion
  whose user-verified bit is clear, so asking for less would only produce a prompt that cannot
  succeed. A lock that accepts a bare tap is a button.
- **The unlock lives in `sessionStorage`, and expires after five minutes in the background.**
  `sessionStorage` dies with the app, so a cold start is always locked — which is the case that
  matters most and the one a `localStorage` implementation would quietly get wrong.
- **An unarmed device opens.** With no cached key there is nothing to check a fingerprint
  against, and refusing would strand him outside his own app with no network to fix it from.
  It fails open, says so, and arms on the next online sign-in. Anyone able to clear IndexedDB
  to reach that state could read the mirror directly, so this is not the weak point it looks
  like — but it is a fail-open, and fail-opens get written down.

**One trap worth naming.** Authenticators emit ECDSA signatures DER-encoded; `crypto.subtle`
accepts only raw `r || s`, and handing it the wrong one returns `false` rather than throwing.
Getting that backwards produces a lock that never opens and never says why — indistinguishable
from a wrong fingerprint, on every attempt. The test authenticator in `src/test/webauthn.ts`
signs the way a real one does rather than the way Node does, which is the only reason that trap
is visible in tests at all.

**How to reverse.** Remove `<LocalLock>` from `app/private/layout.tsx` and the app is exactly
as it was; everything else is additive and inert without it. To keep the gate but stop it
nagging, raise `AUTO_LOCK_MS` in `lib/auth/lock-state.ts`. To disarm one device, sign out on
it — that clears the cached key and the unlock together.

---

### D-153 · The flush absorbs every stamp it pulls, and refuses the ones past the drift bound

**Decision.** `flush()` feeds every incoming `updatedHlc` through this device's `HlcClock`
before merging, and persists the result — `absorbStamps` in `lib/sync/engine.ts`. A stamp more
than ten minutes ahead is skipped rather than absorbed; the row still merges.

**Why.** `HlcClock.receive` had been written, documented and tested since §1.2, and **nothing
outside its own unit tests ever called it.** The clock was monotonic but not causal, and the
consequence is silent data loss: a phone five minutes fast writes a row, the laptop pulls it,
the laptop's next edit to that row is stamped five minutes *behind* what is stored, comes back
`stale`, and is discarded — then the next pull overwrites it on screen too. No error is raised
anywhere, on either device. Five minutes is an ordinary phone that has not reached NTP lately,
not a pathological case.

This is the second time in this phase that a gap sat in the *wiring* rather than in either
piece being wired. The unit tests were right, the module was right, and the two were never
connected. Both were found by writing an integration test that could actually fail — §1.4's
`roundtrip.test.ts`, which drives the real IndexedDB outbox against real Postgres — and neither
was findable by reading either file on its own.

**The bound is a trade, and the losing side is real.** A peer more than ten minutes ahead is
refused, because absorbing it would drag this device's stamps forward permanently and poison
every later comparison with every device. The cost is that while that peer stays broken, edits
made *here* to rows it wrote will keep coming back `stale` and being dropped. That is the
better of the two failures — one device losing edits to one peer beats every device's clock
being wrong forever — but it is invisible, so §1.7 should surface "another device's clock is
far ahead" rather than leaving it to be discovered.

**How to reverse.** Delete the `absorbStamps` call in `flush` and the function below it. The
clock-skew test in `roundtrip.test.ts` fails immediately, which is the point. To widen or
narrow the refusal instead, change `MAX_DRIFT_MS` in `lib/sync/hlc.ts` — it is the only
knob, and both tests in that describe block are written against it.

---

### D-152 · The stored HLC is the idempotency key, so there is no table of applied op ids

**Decision.** `POST /api/sync` pushes and pulls in one round trip. An op's outcome is decided by
comparing its HLC against the one stored on the row: **equal is `duplicate`, lower is `stale`,
higher is `applied`**. There is no `applied_ops` table.

**Why this replaces what the spec asked for.** `SYNC_DESIGN.md` §5 wanted `opId` to let the
server say "already applied" distinctly from "applied" — the difference between a working retry
and a silent no-op nobody can debug. That is the right requirement, and the obvious
implementation is a table of seen operation ids, with the garbage collection and the extra
write that implies. The stored HLC gives the same answer for free: stamps are unique per device
and strictly increasing, so **equality is identity**. `opId` still travels, because it is what
the client's outbox and the retry screen address, but the server does not need to remember it.

**Four outcomes mean "stop sending this", one means "failed".** `applied`, `duplicate`, `stale`
and `superseded` are all success from the outbox's point of view; only `rejected` is a failure.
They are kept apart for the retry screen and for debugging a sync that looks stuck, not for
control flow.

**Batches have to be collapsed before they are written.** Two ops in one batch can address the
same row — a create and then an edit. Postgres refuses an `ON CONFLICT DO UPDATE` that would
touch a row twice in one statement (*"cannot affect row a second time"*), so only the
highest-HLC op per row is written and the rest come back `superseded`.

**Push before pull, in that order.** Otherwise a change made on this device does not come back
in the same response, and for one round trip the phone's own write looks like it vanished.

**The route answers 401, not a redirect.** `requireSession()` redirects to `/signin`, and
handing an HTML sign-in page to a background fetch is a terrible failure mode — the client
would parse it as a sync response. `getSession()` plus an explicit 401 is what the failure
taxonomy expects: pause the flush, prompt for sign-in, and do not burn 100 ops against a dead
session. A missing `DATABASE_URL` answers **503, not 500**, so the outbox holds and retries
instead of marking everything permanently failed.

**A bug the tests found, and it would have been near-invisible.** `hasMore` was computed by
comparing the collected rows against the returned ones. Each table is queried with its own
limit, so when a *single* table was the one being truncated, collected and returned were equal
and `hasMore` came back `false` with rows still waiting. The client only flushes again when
told there is more, so those rows would have sat there until some unrelated trigger fired.
Fixed by asking each table for `limit + 1`. **The symptom would have been "sync is slow
sometimes", which is not a bug report anyone can act on.**

**What is verified and what is not.** The server logic is tested against real Postgres (PGlite)
on the committed migration; the client flush is tested against `fake-indexeddb` with `post`
injected, so every branch of the failure taxonomy — offline, dropped socket, 5xx, 429, 401,
4xx, per-op rejection — is a test. The HTTP boundary was checked against a production build:
401 before any parsing, 405 on GET, no information leak. **The full round trip against Neon was
not run**, because it would write test rows into Victor's real log and there are no hard
deletes left to clean them up with. That half of §1.3's done-when is his to close on the phone.

**How to reverse.** Delete `src/app/api/sync/`, `lib/sync/apply.ts`, `lib/sync/engine.ts` and
the `SyncRunner` mount. The store and the outbox keep working — they just stop being drained.

### D-151 · The mark is the 🧠 emoji, not an anatomical brain — **reverses part of D-145 and D-148**

**Decision.** Fourth drawing. `brain.svg` is now shaped like the brain emoji: a rounded lobed
blob at ~1.27 : 1, six wavy grooves, **no brain stem and no cerebellum**.

**What this gives up, stated plainly.** D-145 established a left-facing anatomical profile and
D-148 proportioned it at 1.65 : 1 with a deep Sylvian fissure, a chunky cerebellum and a short
thick stem. The emoji is a different object. It is rounder than the 1.7 : 1 Victor picked, and
it has none of that anatomy. Asked for the emoji, the anatomy goes; both entries stay in the
log because the reasoning in them is what makes this trade legible rather than a drift.

**What actually makes it read as the emoji**, in order of how much each buys:

1. **Wavy grooves.** The single biggest difference and the cheapest. Parallel arcs read as a rib
   cage; a groove that S-bends twice on its way down reads as tissue.
2. **A bumpy outline all the way round.** Not just across the top — the underside is lobed too,
   which is what stops it looking like a bitten circle.
3. **Fewer, heavier cuts.** Six at stroke 18, against thirteen at 13.

**It is better at small sizes, not worse.** D-148 recorded the fold count as sitting at the
legibility ceiling and degrading by 36px. This has ~45 units between neighbours instead of ~33,
which is about 4px of magenta at launcher size, and it holds cleanly at 36. Simplifying for the
emoji happened to buy back the headroom the realism had spent.

**The fingers trap, arriving from the other direction.** D-148's rejected idea was evenly spaced
parallel arcs. Five *wavy* verticals of equal length hit the same wall: the wiggle carries the
shape at 512px and flattens out by 36px, and what is left is five fingers. Lengths now
alternate long/short. **Any set of similar cuts at similar spacing will read as a texture rather
than as a subject, however organic each one is on its own.**

**How to reverse.** `git show` this commit's parent for the anatomical path data, restore
`brain.svg` and the matching `BOX` in `render-icons.mjs`, re-run `node scripts/render-icons.mjs`.
`BOX` must be re-measured on every redraw — that has now caught us three times.

### D-150 · The sync cursor is a trigger-maintained sequence, and every hard delete is gone

**Decision.** Migration `0005_sync_columns.sql` gives all seven syncable tables `updated_hlc`,
`updated_at`, `server_seq` and `deleted_at`; gives `log_entries` and `tasks` a `client_id`; and
adds one `sync_seq` sequence with a `bump_sync_seq` trigger on every table. The three remaining
hard deletes — workouts, bodyweight, rehab — became soft deletes, and every read that touches
those tables now filters tombstones.

**Four columns, four different jobs, and conflating any two is a bug.**

| | What it is | Who writes it |
|---|---|---|
| `updated_hlc` | What last-write-wins compares | the client |
| `updated_at` | A human-readable server-side receipt | the trigger |
| `server_seq` | The pull cursor | the trigger |
| `deleted_at` | The tombstone | the app |

`updated_at` is deliberately **not** what LWW compares. Two clocks, two jobs; conflating them
is how the timezone bug gets in.

**Why the cursor is a sequence and not a timestamp.** Two rows can share a timestamp, and any
clock adjustment reorders history — so a timestamp cursor either skips rows or replays them
forever. One sequence shared across all seven tables, rather than one per table, because the
phone needs *one* watermark and a total order across tables, not seven.

**Why a trigger and not application code.** Application discipline fails silently here. A new
code path that forgets to bump the sequence does not error; the row simply stops reaching the
phone, and nobody notices until data is missing. A trigger cannot be forgotten. It is also the
reason `src/lib/db/__tests__/sync-schema.test.ts` exists and asserts the trigger is installed
on every table by name — the way this breaks is a table added later that nobody wires up.

**Drizzle cannot express either.** `drizzle-kit generate` diffs table definitions and has no
concept of a sequence or a trigger, so `0005` is a generated file with a hand-written head and
tail. The sequence has to be created *before* the ALTERs, because every `server_seq` column
defaults to `nextval('sync_seq')`.

**Hard deletes had to go, and one of them was a real bug in waiting.** `rehab_completions`
toggled by insert-or-*hard*-delete. Offline that is undecidable: the phone un-ticks an item
while the laptop ticks it, and on sync there is no row on one side and a row on the other, with
no way to tell a delete from a row that was never there.

Two smaller traps came out of converting the others:

- **A soft delete does not cascade.** `workout_sets` is `ON DELETE CASCADE` from `workouts`,
  which does nothing for a tombstone — so a deleted session left its sets behind, still
  counting toward PRs. They are now tombstoned explicitly and both sides of the join filter.
- **Filtering a LEFT JOIN's right-hand table in a `WHERE` turns it into an INNER JOIN.** Doing
  that in `recentWorkouts` would have made a session whose sets were all deleted vanish from
  the list instead of showing zero. The filter belongs in the join condition. Both have tests.

**`recordBodyweight` clears the tombstone on upsert.** The natural key means there is no second
row to fall back on: without it, re-recording a deleted day writes the new weight into an
invisible row and the save looks like it silently failed.

**How to reverse.** The migration is additive — every column is nullable or defaulted, and
nothing existing changed shape — so reverting the code without reverting the schema is safe and
leaves unused columns. To reverse the schema too: drop the triggers, the function, the sequence
and the columns, and restore the three hard deletes from this commit's parent.

### D-149 · The private app does not wear the public site's header and footer

**Decision.** `/private` and everything under it renders without `SiteHeader` and `SiteFooter`.
The way back to the portfolio is a **Public site** link in the desktop nav row and in the phone
More sheet. `lib/chrome.ts` holds the one predicate; `PublicChrome` in the root layout applies
it.

**Why.** The private app already has two navigations — the desktop nav row and the phone tab
bar. The public header was a third, stacked above them, pointing at pages the app is not about,
with Victor's own name at the top of a site only he can see. On a phone it cost 56px at the top
of every private screen, which is a feature and a half of the vertical distance D-083 and D-132
were spent reclaiming. The footer was the same problem below the fold, and on a phone it sat
behind the fixed tab bar.

**The header and footer are passed into `PublicChrome` as props**, not imported by it.
`SiteFooter` reads the vault through `publicProfile()` and so must stay a Server Component; a
Client Component cannot call it. React allows server-rendered elements to cross a client
boundary as props, so the client component decides *whether* to render them without knowing
what they are. Making the footer a client component to get the same effect would have pushed a
vault read into the browser bundle.

**No flash.** `usePathname` runs during server rendering too, so a private page never ships the
header and then removes it.

**Why a route group was not used.** `app/(site)/` with its own layout is the idiomatic Next
answer and would keep the public header out of the private bundle entirely. It also means
moving six route directories, three weeks before term, to change where two components render.
The predicate is one file and one test. If the app grows a second private surface, revisit.

**`hasPublicChrome` matches the segment, not the prefix.** `pathname.startsWith("/private")`
also swallows `/privateer` and `/private-beta`. Neither exists; the point is that a route added
later would quietly lose its header, and that is a confusing thing to debug from the symptom.

**How to reverse.** Render `SiteHeader` and `SiteFooter` directly in the root layout again and
delete `PublicChrome`. The `PublicSiteLink` in the two private navigations then becomes
redundant rather than wrong, so it can stay or go independently.

### D-148 · The brain is proportioned like a brain — and three obvious ideas that made it worse

**Decision.** Third drawing of the mark. The cerebrum is now ~1.65 : 1 wide to tall (it was
1.05 : 1), the Sylvian fissure is a deep narrow slot with a blunt temporal lobe below it, the
cerebellum is chunky and tucked *under* the occipital, the stem is short and thick, and the
fold count is 13, up from 7. Level, not tilted — an icon sits in a grid of other icons, and a
tilted mark reads as accidentally rotated.

**Why the previous one failed.** It was a correct side profile that was still essentially
round, and that is the only thing anyone notices. **No amount of interior detail rescues a
silhouette that is the wrong shape** — the fix was proportion, and everything else here is
secondary to it.

**Three things were tried and reverted, all three of them the obvious idea.** They are recorded
because each looked right in the plan and wrong on the screen:

1. **The fissure as a wedge cut into the outline.** Anatomically the Sylvian fissure is
   dramatic, so opening it as a V in the silhouette seems right. It eats the temporal lobe down
   to a thin forward spike and **the whole mark reads as a shrimp.** The fissure has to be deep
   but *narrow* — a heavy stroke in from the front edge — leaving a blunt rounded lobe below.
2. **Evenly spaced parallel folds.** Nine arcs of one length at one angle read as a rib cage or
   a striped shell, not as tissue. Real gyri vary. Alternating long and short cuts did more for
   realism than the count did.
3. **A cerebellum level with the back of the cerebrum.** It hangs off the silhouette as a
   separate striped bean. It belongs inside the cerebrum's footprint, overlapping it.

**Fixing the cerebellum is about its height, not the divide's width.** Sat high, the overlap
with the cerebrum is ~30 units deep, which no sane stroke covers; widening the stroke to chase
that is exactly what makes the two masses read as separated rather than joined. Drop the
cerebellum until the overlap is ~14 and a 24 covers it.

**Fold bases must be checked against the fissure, not just against each other.** The first
draft had eight folds landing on the Sylvian slot, which welded the whole set into one dark
band across the middle of the mark.

**The spacing rule, which is what caps the fold count.** At 48px the mark spans ~35px, so one
screen pixel is ~11 viewBox units. A cut needs ~14 units to read as a line, and the magenta
between two cuts needs ~20 units to survive as magenta. Nothing sits closer than ~33 units
centre to centre. **13 cuts is the ceiling; past that it does not read as more detail, it reads
as grey.**

**Honest limit.** Victor asked for many fine folds *and* said legibility governs when the two
conflict. They do conflict, and legibility won: 13, not the 16+ a photograph would suggest. The
result was checked by downscaling to 36 / 48 / 64 / 96px with no smoothing. It holds at 48 and
above. **At 36px it is degrading** — the folds start to close up. That is the cost of the fold
count and it is a real cost, not a rounding error; if the icon ever needs to work smaller,
folds come out.

**How to reverse.** `git show` this commit for the previous path data, restore `brain.svg` and
the matching `BOX` in `render-icons.mjs`, re-run `node scripts/render-icons.mjs`. The `BOX` must
be re-measured on every redraw or the render floats in dead space — that has now caught us
twice.

### D-147 · One ground colour, pinned by a test

**Decision.** `src/lib/brand.ts` exports `GROUND = "#140a10"`. `manifest.ts`, the root layout's
`viewport.themeColor`, `brain.svg` and `scripts/render-icons.mjs` all take the colour from it,
and `lib/__tests__/brand.test.ts` fails if any of them drifts.

**Why, and this is the uncomfortable part.** There were three different colours in the codebase
claiming to be the app's ground:

| Where | Value | What it painted |
|---|---|---|
| `globals.css` `--background` | `#140a10` | the actual page |
| `manifest.ts` | `#100a0e` | the Android splash screen |
| `layout.tsx` `viewport.themeColor` | `#0a161b` | the Samsung status bar |

`#0a161b` is teal. It is a survivor of the palette **D-002** replaced, and it had been sitting
in the root layout ever since, putting a blue-green status bar above a magenta app. `#100a0e`
was hand-typed while writing the manifest and the icon renderer, and it is close enough to
`#140a10` to pass every review anyone would ever give it on a laptop.

Neither is visible in a screenshot, on a desktop, or in any test that existed. The status bar
only exists on a phone; the splash colour only shows for the ~200ms between tapping the icon
and the first paint. **The one thing that would have caught either is the device check, and the
device check had just been run** — Victor installed the app, confirmed the icon, and reported
back. It caught the drawing and missed both of these, because a person looking at a launch
animation is looking at the drawing.

So the rule this produces is not "check on the device". It is: **a value that only manifests
somewhere you rarely look needs a test, not an inspection.** Four files, one assertion each.

`render-icons.mjs` runs under node rather than the bundler and cannot import a `.ts` module, so
it keeps the literal and the test pins the literal. `layout.tsx` is asserted as source text
rather than by importing it — it calls `next/font/local`, which only exists as a build-time
transform and throws under vitest. That is weaker than an import, and it is enough: the failure
being guarded against is a hex typed in by hand, and reading the source sees a hex.

**How to reverse.** Change `GROUND`, re-run `node scripts/render-icons.mjs`. Nothing else moves.

### D-146 · The service worker is generated with the commit stamped in

**Decision.** `src/lib/pwa/sw-template.js` is the source. `scripts/build-sw.mjs` copies it to
`public/sw.js` on `predev` and `prebuild`, replacing `__BUILD_ID__` with the commit SHA.
`public/sw.js` is generated and gitignored.

**Why this exists at all.** A browser only re-installs a service worker when the script's
*bytes* differ from the copy it holds. Without a per-build stamp the worker file is identical
across every deploy that does not happen to touch it — so `registration.update()` fetches the
same file, fires nothing, and an installed PWA goes on running weeks-old JavaScript against a
current API. That is the exact failure §1.1 names, and it is silent by construction: the app
looks fine, and only misbehaves where the old client and the new server disagree.

Stamping the commit makes every deploy a byte change, which turns "there is a new version" from
something we would have to invent into something the platform tells us for free.

**Two caches, both of which have to be dealt with.** `updateViaCache: "none"` on the
registration covers the browser's own service-worker script cache. The `no-store` header on
`/sw.js` in `next.config.ts` covers the HTTP cache in front of it — `public/` is otherwise
served with a long max-age, which would pin the previous worker for the life of the cache
entry. Doing only one of these looks like it works, because the other cache is usually cold.

**The waiting worker is never skipped automatically.** `install` does not call `skipWaiting()`.
A new worker sits in `waiting` until the user presses Reload, because activating it swaps the
app's code out from under whatever is on screen — and `context.md` requires that a log entry in
progress survives anything the app decides to tell you about itself. The prompt is dismissable;
"Later" postpones without losing the update, since the worker is still waiting on the next load.

**The prompt is not a toast, despite the plan calling it one.** It does not auto-dismiss.
An update notice that disappears on a timer is one the user can miss entirely while typing,
which defeats the purpose of having it.

**Update detection covers both paths.** A worker can install while the page is open
(`updatefound` → `statechange`), or it can have installed during a previous visit and still be
waiting at load time, in which case *no event ever fires* and only `registration.waiting` says
so. Handling only the event is the common bug and produces a prompt that appears once, if you
happen to be looking, and never again. Both paths are tested.

**Reload is driven by `controllerchange`, not by the click.** `skipWaiting()` is asynchronous;
reloading immediately can land back on the old worker and leave the new one waiting, which
reads as a Reload button that does nothing. A guard makes the reload fire once — the failure
worth defending against is a loop, which on a phone looks like an app that will not open.

**What this worker deliberately does not do.** It does not precache the app's own JavaScript
(that needs a build-time manifest of hashed URLs, and is Phase 2). It never writes a private
route into Cache Storage — caching personal data on the device is a decision with its own
threat model, made explicitly in §2.1, not a side effect of the shell landing. And it only ever
handles GET, because Server Actions are POSTs and a replayed mutation is far worse than a
failed one. `lib/pwa/__tests__/sw-template.test.ts` asserts all three by reading the source,
which is blunt but appropriate: what is being defended is a policy, and the way a policy gets
broken is somebody adding a plausible-looking cache rule in six weeks.

**Fallback if git is unavailable** (a tarball with no `.git`): a timestamp. That is worse — it
makes every build a "new version" even when nothing changed — but it is the safe direction to
be wrong in. A spurious update prompt is an annoyance; a missed one is an app running stale
code for a month.

**How to reverse.** Delete `scripts/build-sw.mjs`, drop it from `predev`/`prebuild`, and remove
`<ServiceWorker />` from the root layout. Un-ignoring `public/sw.js` and committing a static
file is the smaller reversal, and costs exactly the update detection this entry is about.

### D-145 · The brain is seen from the side, not from above

**Decision.** `brain.svg` is redrawn as a left-facing profile: cerebrum, cerebellum tucked
under the back, brain stem dropping below. It replaces the top view D-144 shipped. The
silhouette-with-cut-folds technique is unchanged and is the half of D-144 that survives.

**Why.** Victor installed the icon on the Samsung and it worked — the manifest, the install
prompt and the launcher tile were all correct. The shape was the problem: a top view is a
symmetrical lumpy oval, and the outline that people actually recognise as a brain is the side
one. Anatomical correctness was never the point; recognisability at a glance is.

**Facing left**, which is the convention for anatomical profiles, so it reads as intended
without a second look.

**Three drawing rules came out of getting this right**, and they generalise past this icon:

1. _The overlap between two masses has to be cut, not joined._ The cerebellum is drawn
   overlapping the cerebrum and separated by a ground-colour stroke. The stroke must stay
   between the cerebellum's top edge and the cerebrum's underside along its whole length —
   drawn a few units short, a thin magenta crescent leaks through and the cerebellum stops
   reading as tucked-under and starts reading as a blob stuck on.
2. _A cut that follows the outline reads as an outline._ The first back groove ran parallel to
   the occipital edge and isolated a curl of magenta that looked like a stray comma. Redrawn
   to come in across the edge.
3. _Only one cut breaks out of any given edge._ The Sylvian fissure — the long front-to-back
   cut that lifts the temporal lobe, and the single feature that makes a side view legible —
   breaks the front edge. The groove above it now stops short. Two adjacent cuts leaving the
   same edge fray it into fingers.

Cuts are kept ≥30 viewBox units apart centre to centre. At stroke-width 17 that leaves ~13
units of magenta between them, which is about 1.2px once the icon is 48px. Closer than that
and neighbouring folds merge into one blob when the icon is scaled down.

**The gradient is `userSpaceOnUse`.** The mark is three separate paths now, and the SVG default
of `objectBoundingBox` restarts the colour ramp on each one, putting a visible seam where the
stem meets the cerebrum.

**`BOX` in `render-icons.mjs` was re-measured** to `{x:102, y:117, w:315, h:317}`. The profile is
off-centre in both axes because the cerebellum and stem hang bottom-right; the old box was
measured for a drawing that was symmetric about x=256. This has to be redone every time the
mark is redrawn or the render floats in dead space again — the same failure D-144 records.

**How to reverse.** `git show` this commit for the top-view path data, restore `brain.svg` and
the old `BOX`, and re-run `node scripts/render-icons.mjs`. The manifest references files, not
shapes, so nothing else changes.

### D-144 · The app icon is a brain, drawn as a silhouette with the folds cut out

**Amended by D-145:** the mark is now a side profile. Everything below about *technique* still
holds; "only three folds and one central division" described the top view and no longer does.

**Decision.** `public/icons/brain.svg` is the source; `scripts/render-icons.mjs` produces
`icon-192.png`, `icon-512.png` and `maskable-512.png` from it with Playwright, which is already
a dev dependency. Magenta gradient on the near-black ground, per `brand_and_voice.md`.

**Why a silhouette rather than an outline.** The first instinct is a line-drawn brain. At 48px —
which is where a launcher icon actually lives — thin strokes on a dark field disappear into the
background and the mark turns to mush. A solid shape with the folds cut *out* in the ground
colour keeps its outline at any size. Only three folds and one central division: anatomical
detail reads as noise once the icon is small.

**Two variants, and the difference is not cosmetic.** Android crops a `maskable` icon to a
squircle and keeps roughly the inner 80%. The maskable file is therefore full-bleed with the
mark at 58% of the canvas, which looks over-padded on its own and correct once cropped. The
`any` variant is a rounded tile with the mark at 74%. Shipping one file for both purposes gets
the edges shaved off in the launcher.

The first render put the mark at ~55% of the tile because the script scaled the whole canvas
rather than the drawing's bounding box — the brain occupies only the middle ~64% of the
viewBox. Fixed by scaling about the box's own centre. Caught by looking at the PNG, which is
the only way this class of error is ever caught.

**Splash screen: there is no asset.** Android composes it from `name`, `background_color` and
the icon. Both colours are the ground colour from `globals.css`, so the launch screen is
continuous with the app rather than flashing white.

**How to reverse.** Replace `brain.svg` and re-run `node scripts/render-icons.mjs`. The manifest
references files, not shapes, so nothing else changes.

### D-143 · A Tailwind base display utility beats its own responsive variant, so the nav switch is plain CSS

**Decision.** The private app's two navigations are switched by unlayered CSS in `globals.css`
(`.nav-desktop` / `.nav-mobile`), not by `hidden sm:flex`.

**Why.** Both Tailwind spellings fail, in opposite directions. Measured **against a production
build** at four widths:

| Classes | Wanted | Got |
|---|---|---|
| `hidden sm:flex` | `flex` at ≥640px | `none` at 360 / 390 / 768 / 1280 |
| `flex max-sm:hidden` | `none` at <640px | `flex` at 360 / 390 / 768 / 1280 |

The base utility wins both times. Variants are not broken in general — `sm:hidden` on the tab
bar works correctly, because nothing sets `display` on it at base. **The conflict appears only
when a base utility and its own variant set the same property.** Unlayered rules outrank every
`@layer` by specification, so the replacement cannot lose however the layers are ordered.

**The part worth remembering is how nearly this was recorded wrong.** The first diagnosis was
made against `next dev`, which was also reporting `px-5`, `pt-8` and `pb-24` as computing to
`0px` on an element whose classes plainly contained them. Those were **stale dev CSS** and are
completely correct in a production build — `px-5` → 20px, `pb-24` → 96px. Had the entry been
written then, it would have claimed a general Tailwind cascade fault that does not exist, in
the file this project relies on to explain itself.

**Rule this establishes: a CSS finding is not a finding until it reproduces in `npm run build`.**
`next dev` served three utilities as absent that a build applies correctly, and clearing
`.next` fixed only one of them.

**How to reverse.** Delete the two blocks at the foot of `globals.css` and the `nav-desktop` /
`nav-mobile` class names, and put `hidden sm:flex` back — but re-measure against a build first,
because if this is ever fixed upstream the utilities become the simpler option.

### D-142 · Prettier formats hand-written code in `web/`, and nothing else

**Decision.** Three categories are in `.prettierignore` and stay unformatted:

| Excluded | Why |
|---|---|
| `src/components/ui/*.tsx` | Vendored from the shadcn registry |
| `drizzle/` | `drizzle-kit` regenerates it from its own serializer |
| `*.md`, `public/`, lockfile, build output | Prose and generated artefacts |

**Why each one.**

**Vendored components.** These arrive from the registry with 500–1200 character class strings on
one line — they are every long-line outlier in the repo (`sheet.tsx` peaks at 1,190). Formatting
them means every future `shadcn add` produces a diff against *our* formatting instead of a clean
re-vendor. Same principle as not formatting `node_modules`. One deliberate exception:
`form.tsx` is negated back in, because the registry never emitted it and `context.md` already
records that it is hand-authored — it is ours, so Prettier owns it.

**`drizzle/`.** `npm run db:generate` rewrites `meta/*.json` from drizzle-kit's serializer. If
Prettier formats them, the next generate reverts the formatting and `--check` fails on a clean
tree through nobody's fault.

**Markdown.** Default `proseWrap: "preserve"` leaves paragraphs alone but still rewrites tables
and lists — 133KB of pure churn in this file alone, the one most often read to answer "why is
this like this". The concrete case that settles it is `AGENTS.md`: `next dev` rewrites its
`<!-- BEGIN:nextjs-agent-rules -->` block on every run, so a formatted version means the two
tools fight forever and every dev session leaves an uncommitted change.

The vault at `../context/` is outside `web/` and so already out of scope, but it must stay that
way — `scripts/build_indexes.py` parses those files and their formatting is load-bearing.

**One consequence, accepted rather than worked around.** Prettier has no "fill" mode for arrays:
an array that does not fit on one line gets one element per line. The public-field allowlists in
`lib/vault/public.ts` therefore went from compact rows to ~20 lines each. That reads worse in
isolation — and it was left alone anyway, because it means **adding a field to the public
projection is now exactly one line in a diff.** D-114 is the case for that: a field left in a
projection shipped erg splits publicly, and the review signal that would have caught it is
precisely "one new line in the allowlist". A `// prettier-ignore` was considered and rejected;
re-introducing per-site judgement calls is the thing Prettier exists to remove.

**How to reverse.** Delete lines from `.prettierignore` and run `npm run format`. Nothing depends
on any file being unformatted.

### D-141 · Editing the job sheet is dropped from V3

**Decision.** V3_PLAN's §1.3 (12h) does not carry forward. Read-only access, shipped in V2 §7.6,
is all V3 has.

**Why.** The old plan gated it on "use the read-only version for a month first" and then answered
its own question: what is probably wanted is **"mark this one rejected"** — one field on one row,
maybe 3h — not "edit the spreadsheet", which costs a Google Cloud project, a service account or
OAuth flow, a refresh token to store and rotate, write scopes, and an error path for each. The
gate expires around 2026-09-25. It was not selected for V3, and the Sheets app is already on
Victor's phone.

**How to reverse.** The old estimate and reasoning survive in V3_PLAN §5. Revisit after a month
of the read-only view, and size the 3h version first.

### D-140 · V3 keeps full scope and extends the timeline rather than cutting

**Decision.** ~187h of scope against ~188h of budget. Nothing cut. Milestone A (2026-09-18) is a
hard date; every later milestone moves rather than shrinks.

**Why.** The overload was raised explicitly — 173h against 144h on the first sizing, growing to
187h on closer sizing — with a recommendation to cut ~60h and keep 25% slack. Victor's answer was
to extend the timeline and cut nothing. That is his call, and this entry exists so that the
consequence is not a surprise in November: **the date moves, the scope does not.**

The comparison worth keeping: V2 was planned with 34% slack and still needed four revisions.

**How to reverse.** V3_PLAN §7 names the cut order that was offered — voice (~8h), push (~8h),
light mode (~8h), the carried items (~16h). Roughly 40h is recoverable without touching the
offline promise.

### D-139 · The filament page answers "what do I need to reorder"

**Decision.** Inventory-first layout. Spools sorted by how little is left, colour swatches
prominent, low stock at the top. Printers are a secondary panel using Victor's own status
vocabulary rather than an invented taxonomy.

**Why.** The old plan named this as the question that decides the layout, because "which printer
is free right now" and "what do I need to reorder" are different pages and a page that tries to
be both answers neither at a glance. Reorder-first is also the version that is useful on a
phone — standing in a shop, or on a supplier's site.

**How to reverse.** Swap the section order and re-sort. The data model is the same either way,
which is why this is a layout decision and not a schema one.

### D-138 · An uploaded resume PDF is a fallback, not a replacement

**Decision.** The generated resume shows wherever no uploaded PDF exists. Uploads live in
`context/assets/resumes/` and are served the way images are (V2 §7.3).

**Why.** The generated resume is built from the same vault entries as the project and experience
pages, so it **cannot** drift from them. A PDF can, silently — it becomes a second source of
truth for the same bullet points, and the first place that matters is an interview where the
page and the PDF disagree. Fallback keeps one source of truth wherever Victor has not
deliberately overridden it, and it means `/resume/swe` still resolves for someone who guesses
the URL.

It also preserves `npm run shots`'s page-count gate, which has caught two regressions (D-077,
D-115). "Replace" would have retired it.

**How to reverse.** Flip the resolution order for *alongside*, or drop the generated route
entirely for *replace*. Both were offered and declined.

### D-137 · Error aggregation is scheduled in V3, reversing its own deferral

**Decision.** Sentry's free tier with scrubbing rules for vault content, in Phase 2.

**Why.** V3_PLAN already argued this against itself: it is the one unscheduled item whose absence
hides other items' failures. D-085 — `gemini-2.5-flash` retired and every AI call 404ing silently
for an unknown length of time — was found by reading a dev server log by chance while
screenshotting an unrelated page.

What changed is that V3 adds a service worker on a phone. A failing service worker on a Samsung
produces **no log anyone will ever read**. The class of failure that was hard to see on a server
becomes invisible on a device, at the same time as the code handling unsynced user data moves
onto it. The scrubbing rules that blocked it before are still required.

**How to reverse.** Remove the SDK. The alternative offered — errors POSTed to a private endpoint
and counted on the dashboard, no vendor, no scrubbing rules needed — is a drop-in swap.

### D-136 · Prettier

**Decision.** Prettier plus `prettier-plugin-tailwindcss`, with a pre-commit hook. This closes the
`## Style guide — DECISION NEEDED` section standing open in `web/context.md` since V1.

**Why.** It is the boring choice, universal in the React world, and settling it now means V3's
code — the largest addition since V1 — lands formatted rather than being reformatted later in a
diff that buries real changes. The format-only commit stays separate from every functional one.

Biome was the alternative: faster, one binary, but a smaller ecosystem and some
`eslint-config-next` rules have no equivalent — and those rules are the ones catching
Next-specific correctness bugs.

**Implemented 2026-08-30 (V3 §0.2).** `prettier.config.mjs` is Prettier defaults except two
values, and **both were measured, not preferred** — which matters because `ai_directives.md` §6
says tradeoffs get outlined rather than chosen by taste:

- **`printWidth: 100`** (default 80). Measured across `src/**`: p50 25, p90 87, p99 104 — the
  codebase was already written to ~100 columns. At 80 the one-shot pass reflows **2,764 lines**;
  at 100 it reflows **266**. Ten times less churn in the commit whose entire purpose is to be
  ignorable.
- **`endOfLine: "auto"`** (default `"lf"`). `.gitattributes` sets `* text=auto eol=lf` — committed
  LF, checked out native, so the Windows working tree is CRLF (verified: sampled files are 100%
  CRLF). Forcing `"lf"` would pass on this machine and then **fail `--check` on every fresh
  clone**, and since the hook runs `--check`, it would block commits after any checkout. This one
  is a latent trap, not a preference; it is written up here because the failure appears on a
  machine that is not the one where the config was written.

`prettier-plugin-tailwindcss` needs `tailwindStylesheet` rather than v3's `tailwindConfig` —
Tailwind v4 has no JS config, `globals.css` *is* the config. Without it the plugin silently falls
back to default ordering and misses the project's custom utilities (D-005).

**Result:** 91 files reformatted, **615 insertions / 620 deletions — net −5 lines**. Typecheck
clean, 582/582 tests passing, vendored `ui/` untouched, line endings preserved.

**The hook is `.githooks/pre-commit`, not husky.** `core.hooksPath` does husky's entire job, and
husky is a dependency whose purpose is to copy a file into `.git/hooks`. Cost of the trade: git
ignores a hooks directory until told to use it, so **every clone must run
`git config core.hooksPath .githooks` once** — documented in `context.md`. All four paths were
tested rather than assumed: formatted files pass, unformatted files block with a fix hint,
a staged `.md` passes without a spurious "no matching files" error, and a vault-only commit
short-circuits.

Deliberately formatting-only. `npm test`, `npm run typecheck` and `npm run shots` stay the real
gates. A 15-second suite in a pre-commit hook trains you to reach for `--no-verify`, which would
disable the formatting check too.

**Not installed: `eslint-config-prettier`.** The usual reason to add it is to switch off ESLint
formatting rules that fight the formatter. `eslint.config.mjs` extends only
`eslint-config-next/core-web-vitals` and `/typescript`, which are correctness and a11y rules;
nothing conflicted after the format pass. Measured rather than added speculatively — add it if a
future config brings stylistic rules in.

**How to reverse.** Uninstall, delete `prettier.config.mjs` and `.prettierignore`, drop the two
scripts, and `git config --unset core.hooksPath`. The formatting stays until something reformats
it; nothing depends on it.

### D-135 · Light mode ships in V3

**Decision.** `:root` gains a light palette. `.dark` already mirrors it, and `next-themes` is
already installed, so the mechanism is nearly free. The cost is the audit.

**Why.** The real argument is outdoors: an OLED dark UI in direct sun — a career fair, the water,
a walk across campus — is close to unreadable, and V3's whole premise is that this becomes a
phone app used in places a laptop is not. `context.md` already anticipated this: "adding light
mode in V2 means redefining `:root` and nothing else."

The work is not the palette. It is every screen in both themes, and `npm run shots` in both.

**How to reverse.** Remove the light `:root` values and re-hardcode `dark` on `<html>`. The site
has run dark-only since V1 (`brand_and_voice.md`) and reverting costs nothing structural.

### D-134 · Mood and energy become 1–5 fields, reversing a comment in `categories.ts`

**Decision.** Two `number` fields on the End of day category.

**Why.** `categories.ts` currently says: *"Deliberately no mood or energy scale: Victor put that
in V3, and a 1-5 filled in from habit rather than reflection is worse than nothing."* He wants
it anyway, for a series he can plot against training load and erg splits. The objection was
restated when the question was asked and he chose the scale over both a word picker and dropping
it.

**The objection stands and is now a known cost, not a blocker:** habitual 3s are noise, and a
chart of noise looks exactly like a chart of data. If the series turns out to be flat for a
month, that is the signal to reconsider — not a bug.

Everything downstream (form, validation, summary line, search index) generates from the one
array, which is what D-039 promised.

**Implemented 2026-08-30 (V3 §0.4).** A new `scale` field type in `categories.ts`, fixed at
1–5 — configurable maximums were considered and rejected, because two scales with different
ranges cannot be read on one chart and a chart is the only reason to collect these.

**Anchored at the ends, not throughout.** `mood` is *wrecked … great*, `energy` is *empty …
wired*. This is the mitigation for the objection above rather than a withdrawal of it: a number
with a word attached has to be chosen, where a bare 1–5 gets tapped from habit. Anchoring all
five was offered and declined — it costs more width than a 360px screen has.

**Rendered as five tap targets, not a number input.** `inputMode="decimal"` raises a full
numeric keypad to collect one digit out of five, which is three interactions where there should
be one — in the least forgiving context in the app, one-handed and in bed. Radios rather than
buttons so the value reaches `FormData` with no plumbing and arrow keys work. Controlled only so
a `clear` control can exist: without it a mis-tap is unrecoverable, and every field in this form
is optional by design.

**Out of range is dropped, not clamped.** A Server Action is a POST endpoint with a guessable
id, so the range is enforced server-side rather than trusted from the form. Clamping a 9 to a 5
would put a point in the series that nobody chose, and a fabricated point is worse than a
missing one.

`readField` moved from `app/private/log/actions.ts` to `lib/log/form.ts` to make that testable —
a `"use server"` module may only export async functions (AGENTS.md rule 4), so it could not be
reached from a test where it was.

One existing test asserted the *absence* of these fields ("has no mood or energy scale, which
Victor deferred to V3"). It is inverted rather than deleted, so a silent disappearance still
fails. 590 tests, up from 582.

**How to reverse.** Delete the two fields from the array and drop the column. Restore the comment,
which should stay in the file either way as the record of why it was ever absent.

### D-133 · Ambient background drift is static below the mobile breakpoint

**Decision.** The three radial pools and the SVG grain still render on a phone. They stop
animating. Purposeful motion — sheet transitions, save confirmations — is added in their place.

**Why.** A continuously animating background forces GPU compositing forever. On a phone that is
measurable battery drain and a scroll-smoothness cost, for an effect nobody registers on a 6"
screen. In a screenshot the page looks identical.

This **narrows D-007, it does not reverse it.** The ground is still not a flat fill, which was
the point of that decision. Only the animation goes, and only on mobile.

**How to reverse.** Remove the breakpoint guard on the drift keyframes. D-007's original
reasoning is untouched and still applies at desktop widths.

### D-132 · A bottom tab bar on mobile; the desktop nav is untouched

**Decision.** Four tabs plus a centre log action below the mobile breakpoint — Today, Train,
**Log**, School, More. Above the breakpoint, the existing top nav renders unchanged. Two nav
components over one shared route definition.

**Why.** `context.md` requires every write path to sit under three interactions from the
dashboard, and D-083 already established that vertical distance on a phone is the thing that
kills this feature. A horizontally scrolling top nav puts every target in the least reachable
part of a 6.7" screen; a bottom bar puts the log action under the thumb from anywhere.

Sharing one adaptive component was the alternative — cleaner architecture, one file — and it
was declined because it means touching a desktop layout that works, three weeks before term.
The duplication is deliberate and is the cheaper risk.

**Implemented 2026-08-30 (V3 §0.5).** `components/site/private-tabbar.tsx`. Tabs are **Today ·
Train · [Log] · Next · More** — Victor picked Calendar ("Next") over Academics, on the grounds
that "what do I have next" is the on-the-move question and Academics is a sit-down page. More
holds Now, Academics, Work, Hobbies and sign-out in a bottom sheet.

**Measured result: the first task on a phone moved from 356px to 265px**, because the mobile
layout no longer carries the horizontally scrolling nav row at all. D-083 got that number from
791px to 356px; this takes another 91px off it. Desktop is unaffected at 330px, with its nav
intact — verified at four widths against a production build.

Two details that are not obvious:

- **The sheet stores which page it was opened on, not a boolean.** A boolean plus an effect that
  resets it on `pathname` change is what `react-hooks/set-state-in-effect` exists to prevent,
  and it is also worse: it renders one frame with the overlay covering the new page, and never
  fires at all for a back-button navigation. Deriving `moreOpen === (openedAt === pathname)`
  closes it for free in both cases.
- **`env(safe-area-inset-bottom)`** keeps the row clear of Android's gesture pill. Without it
  the bar's lower third is unhittable on a modern Samsung.

The switch itself could not be done in Tailwind — see **D-143**, which is the more important
entry of the two.

**How to reverse.** Delete the mobile nav component and the `nav-desktop` class name. The
desktop nav never changed, so there is nothing to restore.

### D-131 · The phone caches everything, forever, behind the biometric gate

**Decision.** The full history — logs, tasks, workouts, bodyweight, per-course grades — is
replicated to IndexedDB and kept. The biometric unlock (D-128) is the only boundary.

**Why.** With one user this is realistically under 50MB for years, so the eviction policy that
"rolling 90 days" would have required is work with no beneficiary. Never being surprised by a
missing record is worth more than the bytes.

**On the health-data rule.** D-071 says health data may reach the model but may never be
published. V3 adds a third category — it may now be **cached on a device**. Storage is not
publication, and the two remain different acts. What makes this acceptable is that the data is
already on Victor's laptop unencrypted, and Android encrypts app storage at the OS level with
IndexedDB scoped to the origin.

Encrypting the cache behind a PIN was offered (~6h) and declined. So was excluding bodyweight
and grades specifically — which would have removed exactly the numbers you want in a gym.

**How to reverse.** Add a field-level exclusion list to the sync payload, or a cap on rows
retained. Both are additive to the store built in Phase 1.

### D-130 · The public site is precached inside the private app, and the exposure is accepted

**Decision.** Every public route — including all three resume variants with their print layout,
and `/now` — is precached by the same service worker that serves the private app. One install,
one icon. **No portfolio-only lock mode.**

**Why.** The use case is real and was not previously scoped: showing the portfolio to someone
with no signal — a career fair, a plane, a basement conference room. It is `npm run freeze`
(D-106) turned into a precache, and it is cheap because public pages are already statically
generated.

**The cost, stated plainly.** Handing someone the phone to look at your projects puts your GPA,
bodyweight and application pipeline one back-swipe away. A locked show-mode was offered at ~4h
and a second install with its own scope was offered; both were declined in favour of accepting
the risk. This entry exists so that reversing it is a lookup rather than a rediscovery.

The precache is a separate cache key from the private store, so the standing rule that public
routes never import a private loader is unaffected and its test still holds.

**How to reverse.** Either build the show-mode (a locked route scope plus a biometric to leave
it), or split the manifest into two scopes and install them separately.

### D-129 · A failed sync is held and surfaced, never dropped

**Decision.** An entry that fails on the server stays in the outbox. A persistent badge carries
the count, one screen inspects and repairs it, and the warning escalates past 24 hours. Nothing
is discarded after N retries.

**Why.** The alternative — retry with backoff, give up, log it — loses data without telling you.
That is the same shape as D-085, where a silent failure ran for an unknown length of time and
was found by chance. On a phone it would be worse: there is no log to stumble across.

Retrying safely is what forces D-127's client UUIDs. The two decisions are one design.

**Designed 2026-08-30 (V3 §0.3).** Spec in `docs/SYNC_DESIGN.md` §6. Failures are sorted into
five classes, each with different behaviour, because treating them alike is what makes a retry
loop either infinite or silently lossy:

| Class | State | Behaviour | Prevents |
|---|---|---|---|
| Transient — offline, 5xx, timeout | `pending` | Backoff to 5 min, never dropped | Losing a log because the gym has no signal |
| Permanent — 400, zod, schema skew | `failed` | Surfaced, never auto-retried | An infinite retry loop on data that can never succeed |
| Auth — 401 | `pending`, **flush pauses** | Prompt sign-in | Burning 100 ops against a dead session |
| Clock — HLC beyond drift | `failed` | Surfaced | A drifting clock being mistaken for noise |
| Conflict | — | Cannot occur | — (LWW always decides; that is why it was chosen) |

One ordering rule earns its own line: **a failed op blocks later ops on the same `clientId`, and
nothing else.** Skip that and a rejected create is bypassed while its follow-up update lands on
a row that does not exist; block globally instead and one bad row freezes all syncing.

**How to reverse.** Add a drop-after-N policy. Do not do this without the aggregation in D-137
already reporting.

### D-128 · The offline unlock is a WebAuthn assertion verified locally

**Decision.** With no network, the app unlocks by performing a WebAuthn ceremony against the
platform authenticator and verifying the assertion **in the service worker** against the cached
credential public key. Enrolment is unchanged and still happens online against the server.

**Why.** Auth is a server-side ceremony (D-018), so with no signal there is no session and the
whole offline premise fails. Verifying locally is cryptographically sound: the public key is
already on the device after enrolment, and checking a signature against it needs nobody else.

**What it gives up, explicitly.** A locally verified assertion is not the same security property
as a server-verified one — there is no signature counter check against server state, and a
compromised device can be replayed against. A long-lived session with no lock was offered and is
weaker; an encrypted cache behind a PIN was offered and is stronger. This is the middle, chosen
deliberately.

**Designed 2026-08-30 (V3 §0.3).** Spec in `docs/SYNC_DESIGN.md` §8. Credential id and public
key are cached in IndexedDB at the first *online* unlock; offline unlock is
`navigator.credentials.get()` with `userVerification: "required"`, verified locally through
WebCrypto against that key. No cached credential means the app does not open without a network.

*Prevents:* the app being unusable in exactly the places it was built for — a basement gym, a
plane — which is what a server-only ceremony guarantees.

**Three limits written down so nobody later assumes otherwise.** The challenge is generated
locally, so there is no server-side replay protection. The signature counter is not checked,
because platform authenticators report 0 (already noted in D-018) and there is nothing to check.
And IndexedDB is not encrypted (D-131), so a forensic read of the device gets the vault —
encryption was offered at ~6h and declined in favour of the biometric gate. Unlocking offline
grants access to **local data only**; the server re-validates on the next request and 401s an
expired session regardless.

**How to reverse.** Fall back to requiring a server ceremony, and accept that the app does
nothing offline.

### D-127 · Offline creates carry a client UUID; edits are last-write-wins

**Decision.** Every row created on the device gets a UUID generated on the device. Retrying a
create is therefore a no-op rather than a duplicate. Edits and deletes resolve last-write-wins,
tiebroken on a **monotonic client clock**, not `Date.now()`.

**Why.** Victor's first answer was last-write-wins for everything. That is unsafe for creates
over an unreliable link, and it conflicts directly with D-129's hold-and-retry: without an
idempotency key, a retry after a partial failure writes the row twice. D-026 settled the
identical problem for Hevy imports through a derived `external_id` — this is the same principle
applied to a different writer. The objection was raised and the split was chosen deliberately.

The monotonic clock matters for a phone specifically: a device whose clock jumps forward — a
timezone change, an NTP correction after a flight — must not silently win every conflict for the
rest of the day.

**What it accepts.** LWW on edits means a change made on the laptop while the phone sat offline
for a week can still be overwritten. A conflict-resolution screen was offered (~6h) and declined
as over-built for one user with two devices.

**Designed 2026-08-30 (V3 §0.3).** Full spec in `docs/SYNC_DESIGN.md`. Reading the real schema
in `lib/db/schema.ts` changed this decision in three ways that the plan could not see:

**1 · Only four tables need a client id, not all seven.** Three already have natural keys that
make an offline create idempotent for free — `bodyweight_entries` on `measured_on`,
`rehab_completions` on `(completed_on, slug)`, `ai_summaries` on `(kind, period_start)`. Adding
a UUID to those would be ceremony. The four that need one — `log_entries`, `tasks`, `workouts`,
`workout_sets` — need it precisely because two identical rows are *legitimate* there: logging
the same set twice in a session is a real thing to do, so content cannot identify a row.
*Prevents:* a retried create becoming a second bench-press set that inflates a PR.

**2 · `rehab_completions` cannot sync as built, and this was invisible from the plan.** It
toggles by insert-or-**hard delete**. A hard delete leaves nothing to compare, so if the phone
un-ticks an item offline and the laptop ticks it the same evening, there is no row on the phone
and a row on the server — and no way to distinguish "deleted" from "never had it". It needs
`deleted_at`, as do `workouts`, `workout_sets` and `bodyweight_entries`.
*Prevents:* a silently non-deterministic result on every offline checklist toggle.

**3 · The clock is a hybrid logical clock, not `Date.now()`.** Concretely: fly to Taiwan, the
phone's wall clock jumps, and from that moment it wins every conflict for the rest of the day —
including overwriting laptop edits made later in real time. The HLC keeps a counter so a
device's own stamps always increase, drags forward when it sees a newer remote stamp so causality
holds, and **rejects** any stamp more than 10 minutes ahead of physical time rather than clamping
it silently. A rejected stamp is a surfaced sync error, because a drifting clock is a fault.
*Prevents:* one timezone change making a device permanently authoritative.

`updated_at` is added alongside as a human-readable server receipt and is deliberately **not**
what LWW compares. Two clocks, two jobs — conflating them is how the timezone bug gets in.

**How to reverse.** For duplicates: drop the UUID column and dedupe by content hash instead
(offered, and it misses the case where you legitimately log the same set twice). For lost edits:
add the conflict screen — the outbox already carries both versions, so nothing needs
re-plumbing. For the clock: HLC is ~40 lines in one module with no callers outside the outbox;
replacing it with server-stamped arrival order is a contained change, and costs the ability to
say *when* something was logged as opposed to when it was received.

### D-126 · V3 ships as an installed PWA, not a native app

**Decision.** 2ndMind becomes an installable PWA added to the Samsung's home screen. Not
Capacitor, not React Native.

**Why.** One codebase. Every screen already built — Today, log, athletics, academics, calendar,
work — works as-is; a React Native app would have required re-authoring all of them and would
have consumed the entire budget while leaving two frontends to maintain forever. A Capacitor
shell would have kept the codebase but added an Android toolchain on Windows, app signing, and
Digital Asset Links — without which WebAuthn breaks inside the WebView, taking the passkey auth
with it. Both cost real money or real complexity against a **$0 budget**.

**What this permanently rules out inside V3,** all four traded knowingly:

- **A real Android home-screen widget.** Impossible in a PWA. Icon long-press shortcuts are the
  honest substitute.
- **Guaranteed background sync.** Samsung's battery optimizer can suspend a service worker.
  Flush-on-foreground and flush-on-reconnect are what actually work.
- **A Play Store listing** ($25 one-time, not taken).
- **Native gesture physics.**

**How to reverse.** Capacitor wraps the same build with no rewrite — that path stays open and is
the first thing to reach for if background sync proves inadequate in practice. Budget ~15h plus
the assetlinks work.

---

## 2026-08-29 · Offline review round

Victor reviewed a frozen snapshot of the site offline, wrote the case studies, and came back
with a list of changes. These are the decisions that came out of it, answered question by
question before any of it was built.

### D-106 · The site freezes to standalone HTML for offline review

**Decision.** `npm run freeze` (`web/scripts/freeze.mjs`) captures every public route — and,
with a session cookie in `FREEZE_COOKIE`, every private one — into `.frozen/`: one
self-contained HTML file per page, stylesheets and fonts and images inlined as data URIs,
every `<script>` stripped, internal links rewritten to the sibling file so clicking through
works from `file://`.

**Why.** The public site already runs offline under `npm run dev` — that is what self-hosted
fonts bought (D-002). The private side does not: `/private/*` redirects to sign-in, athletics
needs Neon, and several pages read editable files through the GitHub Contents API. A snapshot
sidesteps all three without building an offline mode nobody asked for.

**Why JavaScript is stripped rather than kept.** A frozen page that still tries to hydrate
reaches for chunks that are not there and fails visibly. Stripping it makes the page inert and
faithful. The cost is that buttons and forms do nothing, which is correct for a document whose
purpose is being looked at and annotated.

**How to reverse.** Delete `web/scripts/freeze.mjs`, the `freeze` script in `package.json`,
and the `.frozen/` line in `web/.gitignore`.

### D-107 · Tiers are gone; projects carry an explicit `order`

**Decision.** `tier` is removed from the project schema and replaced with `order`, an integer
ascending. `/projects` renders in that order and its lede is deleted. New projects append by
taking the next number. `project_catalog.md` becomes one table with a `#` column.

**Why.** Two reasons, and only the second is about ordering. Tier published a ranking of his
own work to hiring managers — the lede explicitly said "Tier 1 are the builds worth reading
about in depth", which invites the reader to skip the rest. And the sequence Victor actually
wanted (Proof, Micromouse, 5 Second Rule, Solenoid, TaskAble) is not derivable from tier then
year under any tie-break, so the data had to hold the decision.

**Also changed.** The project card no longer renders tier-1 titles larger, and a test now
asserts every `order` is distinct — a duplicate would silently hand the decision back to the
year tie-break.

**How to reverse.** Restore `tier` in `schemas.ts`, `public.ts`, `load.ts` and
`build_indexes.py`; the old sort was `a.tier - b.tier || b.year - a.year`.

### D-108 · `archived` becomes `done`; Water Bottle Scale is deleted

**Decision.** The project `status` enum is `["active", "done"]`. `water-bottle-scale.md` is
deleted rather than archived.

**Why the rename.** "Archived" reads as shelved or abandoned. These projects are finished, and
the badge on every card said the wrong word about them.

**Why the deletion.** It is superseded, not finished: Smart Bottle is the same idea built
properly, and Victor's own assessment of the 10th-grade version was "pretty lackluster".
Keeping both would put two entries on the site for one idea, the weaker one first by year.

**How to reverse.** `git show HEAD:context/01_engineering/projects/water-bottle-scale.md`.
Note that its case-study sections were placeholder text at deletion.

### D-109 · An ongoing role says "Present" because the vault says it is ongoing

**Decision.** `experienceSchema` gains `ongoing: boolean`. The About page renders "Present"
when it is set, and the real `date_end` when it is not.

**Why this shape.** "Present" was hard-coded in the page once, outlived the fact behind it,
and told every reader that a finished internship was still running — so it was removed and
replaced with the vault's own `date_end`. Dimaag is now genuinely ongoing, so the fix is not
to un-remove the string but to make the claim data: `date_end` stays a real date that nothing
has to parse, and the flag decides what is shown.

**How to reverse.** Drop the field and render `dateEnd` unconditionally.

### D-110 · Tailor becomes a sub-tab of Work

**Decision.** `/private/tailor` moves to `/private/work/tailor`. The top-level nav loses
"Tailor"; a `WorkTabs` sub-nav appears under the Work page header.

**Why.** Victor asked for it, and the reason holds up: Tailor is used a handful of times a
term and sat beside pages opened daily, in a nav that had grown to nine items and stayed one
line only because it scrolls. It is career work and belongs with the career pages.

**How to reverse.** Move the directory back, restore the nav entry, delete `work-tabs.tsx`.
`scripts/shots.mjs` has the route too — it 404'd for one run after the move, which is how the
oversight was caught.

### D-111 · The inbox is a task row, not a notes table

**Decision.** "Jot down random things" is a `tasks` row with `source: "inbox"` — undated,
undomained, captured from a one-field box on Today. It nags on the **age of the oldest item**
(7 days), not on count.

**Why a task.** D-037 made everything actionable one model. The point of jotting something
down is that it will later become actionable, so triage should be an edit to the row it
already is, not a migration between two stores.

**Why age and not count.** Ten things captured this morning is a productive morning; one thing
untriaged for three weeks is the actual problem. A count cannot tell those apart. The list is
also sorted oldest-first, because an inbox sorted newest-first hides its own backlog.

**How to reverse.** Delete `inbox-panel.tsx`, `addInboxNote`, `listInbox`/`staleDays`, and the
Inbox panel on Today. Existing rows stay valid tasks; they would reappear in Backlog once the
`source !== "inbox"` filter goes.

### D-112 · Today has one Goals panel, and the Backlog stays shut

**Decision.** "This week's goals" and "Draft next week" merge into one **Goals** panel, with
drafting nested inside it as a closed `<details>`. Backlog is now closed by default regardless
of size.

**Why.** Victor's words: "it feels weird how there is a this week's goals and draft next
week's goals." As siblings they read as two competing lists of goals rather than one list and
the tool that proposes next week's. And his read of the page overall was that it is too dense,
which a nested disclosure and a closed backlog both answer. Drafting stays closed for the
original reason — each press is a real API call against a ~$10/month budget.

**How to reverse.** Split the panels back apart; the `ProposalReview` component is unchanged.

### D-113 · The DARS audit is parsed into a derived file, never read directly

**Decision.** `scripts/parse_dars.py` turns a saved DARS page into
`context/01_engineering/degree_audit.md`. The private Academics page reads only the derived
file. Raw `DARS*.html` is gitignored.

**Why.** The saved audit carries Victor's student ID, his high school, and every grade he has
ever received, in ~900 KB of page furniture. The site needs one thing from it: which
requirements are unfulfilled and what satisfies them. Deriving that once, locally, means the
identifiers are never in a file the app can read, rather than being present and trusted not to
be rendered.

**And it could not have worked otherwise.** `99_archive/` — where a transcript-shaped document
belongs — is deliberately excluded from the Next.js file trace (D-023). A page reading the raw
audit would work locally and 404 in production, which is the exact failure that exclusion
exists to document.

**One deliberate lossiness.** A GE subgroup's "SELECT FROM" is every qualifying course at
UCLA. Those lists are truncated to ~320 characters with a count of what was dropped; the audit
itself is the place to go for the rest.

**How to reverse.** Delete the script and the derived file, and restore the Academics
`Record` panel as the only vault document on the page.

### D-114 · Pursuits publish bullets only, and feed the tailor library

**Decision.** `facts` and `carryover` are removed from the public pursuit projection.
Pursuit bullets are added to the tailoring bullet library.

**Why removed rather than un-rendered.** Victor asked for the metrics and the italic
carry-over hidden. Public pages are statically generated, so a field left in the projection
ships inside the bundle whether or not anything renders it — and the facts here are erg
splits, which he moved to private in the same round. "Hidden" that still ships is not hidden.

**Why the library grew.** CAD, SolidWorks and 3D printing are real skills that live only in
`pursuits/fabrication.md`, which contributed nothing, so a posting asking for mechanical
design could not be answered with the one thing that answers it. What the model may *say* is
still bounded by the ids it is handed, so this widens the advice without loosening the
guardrail.

**How to reverse.** Restore the two fields to `PublicPursuit`, `PUBLIC_PURSUIT_KEYS` and
`toPublicPursuit`, and the markup on the About page; drop the pursuits loop in
`collectBullets`.

### D-115 · Resume entries may cap their own bullets per variant

**Decision.** `resume_bullets: { <variant>: <n> }` on a project or experience entry overrides
the global cap for that variant.

**Why.** An entry can be worth listing on a variant without being worth three lines on it.
Proof earns a place on the robotics resume for the engineering behind it; a robotics reader
does not need its Socket.io timers.

**Where it ended up.** Only Proof uses it: **2 bullets on robotics**, which was Victor's
instruction ("put Proof on it if it can fit, but with less bullets"), not a page-pressure fix.

An intermediate state is worth recording because it was wrong. MathCounts and Lifeguard were
briefly added to all three variants, which pushed every one onto a second page — caught by
`npm run shots`, not by looking (D-077) — and paid for with caps on Solenoid and TaskAble.
Victor then clarified that those two roles were supplied **as Tailor context, never as resume
content** (D-118). With them off, the variants print at 0.89–0.93 and both caps were removed
again. The lesson is the ordinary one: trimming good content to fit content that should not
have been there produces a worse document than asking.

**How to reverse.** Delete the field from the schemas and the two `??` fallbacks in
`resume.ts`; every entry returns to the global caps. Re-run `npm run shots` after.

### D-116 · The Dimaag paper is published as a placeholder, deliberately

**Decision.** `projects/dimaag-paper.md` exists, is `status: active` so it reaches `/now`, and
says almost nothing: no vehicle class, no algorithm, no architecture, no numbers.
`confidential_scope` in `experience/dimaag.md` is rewritten to name exactly what is and is not
shareable.

**Why.** Victor supplied a detailed technical brief and confirmed it is **internal until
cleared**. The vault's existing boundary covered PPO, Isaac Lab, LiDAR raycasting, sim-to-real
and tracking accuracy; the brief goes well past that and in places contradicts it. Writing any
of it into a public file would have published uncleared material and desynchronised the vault
from its own confidentiality note.

**What is now cleared and changed.** Tracking is **>10 mph**, not >12; the internship is
**ongoing**; the LLM-tooling bullet is cut at Victor's request; the **80% reduction in mean
tracking error** is cleared and is now the strongest claim on the resume.

**How to reverse when clearance lands.** Rewrite `confidential_scope` first, then the project
body, then the bullets — in that order, so the boundary is never behind the content.

### D-117 · Tailor answers posting questions, and never drafts the answer

**Decision.** `/private/work/tailor` gains a second panel: paste one written application
question, get the bullet ids to build the answer from, an angle, and a "do not claim" note.
There is deliberately **no draft field**.

**Why no draft.** A drafted answer is the model's prose submitted under Victor's name. The
resume side already refuses to write a bullet for exactly this reason (D-069 and the id
scheme above it), and an application answer is the same document class with a lower guard on
it. Once a draft box exists, it is the box that gets pasted.

**The failure mode specific to this half.** "Why do you want to work here" invites a model to
assert a motivation Victor never gave, in the first person, on an application. The prompt
forbids it explicitly and a test asserts the prompt still says so.

**Same parser discipline.** `points` are ids from the list handed over; an id it was not given
fails the whole response, for the same reason as the resume side — a fabricated reference is
evidence about everything else in it.

**How to reverse.** Delete `question-form.tsx`, `answerPostingQuestion`, and the
`answerQuestion`/`buildQuestionPrompt`/`parseQuestionResponse` trio in `lib/ai/tailor.ts`.

### D-118 · The Tailor library is vault-wide and ignores `resume_variants`

**Decision.** `collectBullets` reads `publicExperience()`, `publicProjects()` and
`publicPursuits()` directly, instead of unioning `buildResume()` across variants.

**Why.** `resume_variants` decides what gets **printed**; the library decides what the model
may **talk about**. Those are different questions, and building the library from the resume
made them the same one — so MathCounts and Lifeguard could not be both "reachable when a
posting asks about mentoring" and "off the printed page", which is exactly what Victor wanted.
Pursuits had the same problem from the other end: CAD and 3D printing are on no variant.

**What it does not loosen.** The guardrail is the id scheme, not the size of the list. A
wider library means better advice about material that already exists; it does not let the
model say anything it could not say before.

**How to reverse.** Rebuild `collectBullets` from `buildResume(variant)` over
`RESUME_VARIANTS`. Note that doing so silently drops every entry with `resume_variants: []`.

### D-119 · Public pages stop advertising an unfinished write-up

**Decision.** The "Write-up pending" badge on the project grid, the same marker on `/now`,
the banner on a project detail page, and "Active, no write-up yet." are all removed. The
`draft` field stays and still keeps an unwritten entry off every resume variant.

**Why.** Victor: it reads as unprofessional on a public-facing site, and he is right. The
badge was written as an honesty marker for a reader who could see the gap anyway; on a
portfolio it announces a gap to a stranger who had no way to know one existed, and it
captions the page's own emptiness. Honesty about scope is served by publishing only written
sections — `dropUnwritten` already does that — not by labelling the ones that are missing.

**How to reverse.** `git show` this commit for `project-grid.tsx`, `now/page.tsx` and
`projects/[slug]/page.tsx`; the `draft` flag they keyed on is untouched.

### D-120 · The resume variant row is fixed and complete

**Decision.** `/resume/[variant]` renders all three variants in `RESUME_VARIANTS` order —
Robotics, Machine Learning, Software Engineering — with the current one marked
`aria-current` rather than omitted.

**Why.** It previously rendered only the *other* two, so the row re-ordered itself on every
switch and the control moved out from under the cursor mid-click. A tab strip that changes
its own contents is not a tab strip.

**How to reverse.** Restore the `others` filter.

### D-121 · Experience carries an explicit `order`, like projects

**Decision.** `experienceSchema` gains `order`. The About page renders Dimaag, FIRST
Robotics, MathCounts, Lifeguard.

**Why.** Sorting on `date_start` alone put a seasonal lifeguard job (2022) above the FIRST
Robotics software lead (2021-08). Chronologically correct; wrong for a page a hiring manager
reads top-down. Same reasoning as D-107, and a test now asserts the specific inversion that
prompted it.

**How to reverse.** Drop the field and sort on `date_start` descending.

### D-122 · The repo root holds only what belongs at a repo root

**Decision.** Plans move to `docs/` (`V2_PLAN`, `V3_PLAN`, `MIGRATION_PLAN`,
`UPLOADS_NEEDED`, `REVIEW_ROUND_PLAN`), and downloaded source documents move to a gitignored
`private/`. An empty `assets/` is deleted, and `Proof.png` moves from `99_archive/` — where
nothing is served from — into `context/assets/`, which is what the build syncs.

**Why `private/` rather than name patterns alone.** The `DARS*.html` rule works only for
files named that way. A folder that is ignored wholesale is the version that survives the
next document being saved under a different name, and the patterns stay as a second line of
defence.

**Caught while doing it.** `README.md` requires `CLAUDE.md` and `AGENTS.md` to be identical
copies, and the previous round edited only `CLAUDE.md`. Re-synced with `cp`.

**How to reverse.** Move the files back and re-run the reference rewrite in the opposite
direction; every mention was updated in `current_sprint.md`, `DECISIONS.md`, the plans
themselves, and `README.md`.

### D-123 · Any Google Sheets link is accepted, and converted to a CSV endpoint

**Decision.** `normaliseSheetUrl` turns an ordinary `/edit#gid=…` link into
`/export?format=csv&gid=…`, fills in `output=csv` on a publish-to-web link that omitted it,
and passes anything already CSV-shaped — or non-Google — through untouched.

**Why.** The URL Victor will actually paste is the one in his address bar. That link serves an
HTML application behind a login, so the old requirement was "use Publish to web instead" —
correct, and useless, because the document id and the tab id are both sitting in the URL he
already has. Deriving the CSV endpoint is a dozen lines; making him re-navigate a share menu
to produce information the app could compute is a worse trade.

**What it deliberately does not do.** Grant access. The site fetches with no Google
credentials, so the sheet must be readable anonymously whichever URL form is used, and
`fetchSheet` already detects the login page Google returns and says so. That check is what
makes accepting the loose form safe: the failure is legible rather than silent.

**The tradeoff Victor has to make, and it is not symmetric.** Publish-to-web exposes *one
tab*; link-sharing exposes *the whole spreadsheet* to anyone holding the link. Both are
recorded in `docs/UPLOADS_NEEDED.md` §1.2 with publish-to-web recommended, because the
applications sheet is one tab of a document that may hold others.

**How to reverse.** Delete `normaliseSheetUrl` and have `jobSheetUrl` return the raw value.
Nine tests in `lib/jobs/__tests__/load.test.ts` cover the conversions.

### D-124 · AI summaries are stored, and fallback text never is

**Decision.** A new `ai_summaries` table (migration `0004`) holds one row per period per kind,
upserted. The Today page writes the daily and weekly summaries after generating them, and an
"Earlier summaries" panel — closed, fourteen days — reads them back.

**Why.** Victor's condition for the feature was "as long as it logs the summaries somewhere".
Until now they were generated, rendered and lost: the cache held one for a few hours and then
the day was gone. A summary of a day you can no longer reconstruct is the kind worth keeping.

**Why upsert rather than insert.** The daily summary is regenerated as the day fills in. A
plain insert would leave a pile of half-days with no way to tell which described the day as
it ended.

**Why `kind` is in the unique index.** A week is keyed by its first day, which is frequently
also a day with its own summary. Keyed on the date alone, one would silently overwrite the
other — asserted by a test.

**What is deliberately not stored.** Anything with `ok: false`. "Nothing logged yet today" and
the missing-key notice are fallback strings, and months later they are indistinguishable from
a day when nothing actually happened. The write is guarded at the call site *and* in
`recordSummary`, because the check that matters is the one next to the write.

**Why Postgres and not the vault.** It is time-series, one row per period, queried by range —
`web/context.md`'s own rule. It is also model output, and D-080 says nothing AI-driven writes
to the vault in V2; a table keeps that boundary without needing an approval gate on something
Victor never has to accept.

**Failures are never fatal.** A storage error logs and the summary still renders. Losing the
archive copy is not a reason to fail the page it sits on.

**How to reverse.** Drop the table, delete `lib/ai/summaries.ts`, the two `recordSummary`
calls and the archive panel. 13 tests, against real Postgres in PGlite.

### D-125 · The layout gate hid a defect behind the Next dev overlay

**Decision.** `shots.mjs` hides `nextjs-portal` before measuring, and reports small text
grouped by size rather than as a bare count.

**Why the overlay matters.** It is `position: fixed`, so in a full-page screenshot it lands
wherever the viewport happened to be — mid-page, over real content. It was sitting squarely on
a stack badge on the Solenoid case study. `next dev` is the only server these run against, so
the tool built to catch layout defects was covering one up.

**Why the count was not enough.** "28 elements under 12px" reads identically whether it is 28
labels at a deliberate 9.9px or one element at 7px. The breakdown (`5@9.6px 15@9.9px
8@11.2px`) is what turned §1.2b from a worry into a decision.

**What it found.** The project-detail fact cards were `0.6rem` where the identical cards on
the About page are `0.62rem` — the only public page carrying a fourth label size, and the
smallest text on the site, for no recorded reason. Unified; the public floor is now 9.9px.

**How to reverse.** Remove `hideDevOverlay` and the `tinyBy` grouping.

---

## 2026-08-25 · Career tooling

### D-105 · The private link moves to the header, and becomes a lock icon on phones

**Decision.** The `/private` link moves from the footer into the header nav, last. Below `sm` it
renders a lock icon instead of the word; nav padding tightens below 380px. Behaviour is
unchanged — still shown to any browser that has signed in before, still gating nothing.

**Why it moved.** Victor asked for it in the header. D-102 had put it in the footer to avoid
crowding, which was a real constraint dodged rather than solved.

**What the first attempt got wrong, and how it was caught.** Placed first in the nav, the
measurements looked perfect — five items, zero overflow at every width. The screenshot showed
the header reading **"Private About Now Projects Resume"** with *Victor Gusev gone entirely*.
Nothing overflowed because the name is `min-w-0` and simply collapsed to zero. A nav that fits
is not the same as a header that works, and the check only knew about the nav.

Two fixes followed, and the order matters:

1. **The check now measures the name's rendered width**, failing below 40px. It is the only
   thing that would have caught this, and it was added before the layout was touched again.
2. **The link moved last.** Ahead of "About" it also sat where the site's identity belongs — the
   first thing on the portfolio read "Private".

**Why an icon on phones.** Measured: at 360px the four public items leave the name 59px, and the
word "Private" costs ~60px. The lock is ~24px including padding. With `px-1.5` below 380px the
name holds at 46px on a 360px screen and 56px at 390px — truncated, as it already was, but
present. `aria-label="Private"` on the link with `aria-hidden` on the icon means a screen reader
hears the same word at every width.

**Reversing it.** Move `<PrivateLink>` back to `site-footer.tsx` and drop the responsive padding.
The `home-returning-*.png` shots and the header check in `shots.mjs` are worth keeping either
way — they are the only thing that renders the signed-in header at all.

### D-104 · The tailoring model returns bullet ids, never bullet text

**Decision.** Resume tailoring supplies every bullet as `section:slug#index` with its text, and
the model may reply only with ids from that list. An id it was not given **fails the whole
response**. Free-text rationale is allowed and displayed as rationale. Bullet text on screen is
resolved from the vault by id; the model never supplies words that reach the page.

**Why ids and not prose.** Rev 1 of the plan promised "a test proves it cannot introduce a
bullet that is not in the vault". That is only enforceable if the model returns identifiers. If
it returns prose, the check is fuzzy string matching — and a model that helpfully rewrites
"Built a rechargeable scale" as "Engineered a precision instrument" passes any threshold loose
enough to be useful. That is D-069 walking back in through the one feature that touches a
hiring document.

**Why the whole response fails.** A fabricated id is evidence about everything else in that
response. Dropping just the bad id would hide exactly the failure the check exists to catch,
and would leave the surviving advice looking trustworthy. `deprioritise` is checked as
strictly as `emphasise` — advice to drop a bullet that does not exist is still a fabrication,
and a parser that only checked the first list would let it through.

**Bullets come from the union of all three variants,** not from one. *Which variant to send* is
one of the questions being asked; feeding it only the robotics bullets and then asking whether
robotics is right is a question with one possible answer.

**A posting under 80 characters is refused without a model call.** Given a job title alone the
model pattern-matches and recommends whatever sounds adjacent, confidently.

**Reversing it.** Delete `lib/ai/tailor.ts`, `app/private/tailor/` and the nav entry. Nothing
else depends on it — it writes nothing. Tests: `lib/ai/__tests__/tailor.test.ts`, including the
fabricated-id case the plan asked for by name.

### D-103 · `/private/work` reads the applications sheet, and still never writes to it

**Decision.** `/private/work` fetches the published CSV from `JOB_SHEET_CSV_URL`, parses it, and
shows live applications, a high-priority shortlist, and counts by status.

**Why this reverses the page's original refusal.** The page's lede used to say it deliberately
does not duplicate the sheet, because `internship_pipeline.md` asks assistants to leave that
data entry to the Gmail script. That reasoning was about a competing *writer*. Reading is not
duplicating: there is still exactly one source of truth and this is a view of it. Nothing here
writes, and the lede has been rewritten to say so rather than quietly dropped.

**The URL is a credential** — Google's publish-to-web link grants read access to whoever holds
it — so it lives in Vercel and never in the repo, the same treatment `GOOGLE_CALENDAR_KEY` gets.
Errors report status codes, never the URL.

**The export is 179 rows and 173 say "No Application".** Rendered whole it is a wall with the
six rows that matter invisible inside it, so the page shows live applications, the high-priority
rows not yet applied to, and counts. That fact came from parsing Victor's real export; a fixture
I invented would have had a tidy spread of statuses and taught me nothing.

**Headers are matched after stripping case and punctuation.** The sheet is edited by hand —
`Domain / Focus` carries spaces around the slash — and exact matching would turn a cosmetic edit
into an outage. A row with neither company nor role is counted as skipped rather than dropped
silently, so a drifting sheet shows as a visible number.

**A date that is not ISO is blanked, not guessed.** `08/13/2026` is ambiguous, and guessing
wrong misdates a row by up to eleven months with nothing looking wrong.

**Failures degrade to a message.** An unpublished sheet answers `200` with an HTML login page
rather than a `404`, so the body is sniffed for a leading `<`. As in D-086, the cache throws
rather than returns on failure, so a transient outage is not pinned to the page for the full TTL.

**Reversing it.** Unset `JOB_SHEET_CSV_URL` — the panel then explains itself and the rest of the
page is unaffected. Tests: `lib/jobs/__tests__/sheet.test.ts`, parsed against the real export in
`context/99_archive/`, which is a fixture and never a runtime fallback.

### D-102 · The public→private link is a hint with no authority, and a test keeps it that way

**Decision.** Login sets `2m_returning=1` — not `httpOnly`, a year long — and the public footer
renders a `/private` link when it is present. It gates nothing.

**Why a second cookie at all.** The session cookie is `httpOnly` and public pages are statically
generated, so neither the browser nor the server can tell who is asking. A value that decides
only whether a link is drawn is the workable shape.

**Why deliberately not `httpOnly`.** Making it unreadable would suggest it protects something.
Anyone can set it from the console; doing so yields a link and a redirect to `/signin`, because
`/private` calls `requireSession()` regardless.

**The test is a grep, not a unit test.** The hazard is not this module misbehaving — it is a
*new call site* somewhere else in the tree consulting the cookie to decide something real, at
which point it becomes an authentication bypass made of a boolean. So the test walks `src/` and
fails if anything outside an explicit allowlist mentions it. It caught its own test file within
a minute of being written, which is the correct behaviour.

**Cleared on explicit sign-out, not on session expiry.** Signing out on a borrowed machine
should not leave a "Victor signs in here" sign on the public site. An expired session is the
opposite case — that visitor wants the shortcut back to `/signin`.

**In the header nav** — *amended 2026-08-25, at Victor's request.* Originally the footer, on the
reasoning that a fifth item would crowd the bar. That reasoning was right about the constraint
and wrong about the conclusion: see D-105, which moves it and pays the layout cost properly.

**`useSyncExternalStore`, not `useState` + `useEffect`.** Its server snapshot is `false`, so the
prerendered HTML and first client render agree and there is no hydration mismatch — and setting
state from an effect is rejected by the React lint rule, correctly, since this reads an external
source.

**Reversing it.** Delete `lib/auth/returning.ts`, `components/site/private-link.tsx`, the footer
line and the two `store.set`/`store.delete` calls in the login route.

## 2026-08-25 · Proposals

### D-101 · The goal drafter parses the model's output, and drops what it cannot use

**Decision.** `draftSprintGoals` asks for JSON, extracts it by slicing between the first `{` and
the last `}`, parses it with Zod, then drops goals for unknown domains and duplicates within a
domain. A malformed response returns a written message; the raw text is logged, never shown.

**Why.** Model output is untrusted input. `as GoalDraft[]` would push a `{}` into the review UI,
where it renders as an empty row that approves an empty goal — and the fence-wrapping, the extra
sentence of preamble, and the two goals for one domain are all things models do routinely rather
than exceptionally.

Not showing the raw text matters separately: pasting model output into the UI as an app message
is how an injected string reaches the screen looking official. It goes to the server log.

**Uncached, unlike the summaries.** `gemini.ts` caches because `/private` is `force-dynamic` and
would re-summarise an unchanged day on every view. Drafting happens on a button press, and
serving a memoised draft would make pressing the button twice look broken. The panel is
collapsed by default so the button is not pressed out of habit — each press is a real call
against a ~$10/month budget.

**Reversing it.** Delete `lib/ai/goal-drafts.ts` and the `Draft next week` panel; the manual
`GoalsEditor` is untouched and remains the primary way goals are set.

### D-100 · Approval is a typed proposal, not a text diff, and rejection is expressed by absence

**Decision.** A proposal is a list of `{ key, label, before, after, note }`. The review UI ticks
items individually, values are editable before approving, and `applyApprovals` merges approvals
over current state. Nothing is stored between proposing and approving.

**Why not a markdown diff,** which rev 1 of the plan specified: sprint goals are rows in `tasks`
(D-037) and never touch the vault, so the 10h diff UI would have had no V2 caller at all. The
constraint worth building is "nothing writes on a model's say-so", and that is about structure,
not about text.

**Rejection is absence.** An unticked item is not sent, so its current value carries through
untouched. The alternative — sending every item with a decision flag — needs a branch that can
be got wrong; this cannot write a rejected item because it never sees one.

**An approved empty value is a deletion,** not a no-op. Proposing removal of a goal that no
longer makes sense is legitimate, and treating blank as "leave it" would make that unsayable.

**Staleness is checked server-side against live rows.** The `basis` fingerprint is sorted by key
so it does not depend on row order — `replaceGoals` soft-deletes and re-inserts, so ids change
on every save and an order-sensitive fingerprint would mark every proposal stale. The client
returns the basis but it is compared, never trusted: a forged one only skips a warning about the
user's own concurrent edit, and anyone who can post it is signed in and could call `replaceGoals`
directly.

**Nothing is persisted between the two steps.** A proposals table would need a migration, a
lifecycle, and a rule for cleaning up proposals nobody answered — for two events seconds apart
on one screen.

**Reversing it.** Delete `lib/proposals/` and `components/site/proposal-review.tsx`. Tests:
`lib/proposals/__tests__/`, including partial approval against real Postgres.

## 2026-08-25 · The Working page

### D-099 · Updates live in the project's markdown, and `status: active` is what puts a project on `/now`

**Decision.** `/now` renders every project whose frontmatter says `status: active`. Updates are
`### YYYY-MM-DD` entries under a `## Updates` heading in the project's own file, parsed out of
the public body into data.

**Why `status`, not a new list.** The project schema has carried `status: active | archived`
since the beginning. Reusing it means `/now` and `/projects` read one source, so a project cannot
be finished on one page and in progress on the other. A separate "currently working on" list
would allow showing motion on things that will never be portfolio projects — worth having, not
worth guessing at now, and addable later without moving any of this.

**Why the vault, not Postgres.** Updates in a table would make `/now` the first public page
needing a database, turning a static page dynamic for content written weekly. The cost is real
and stated in the UI: publishing is a commit plus a Vercel rebuild, about a minute. For ticking
off a task that trade went the other way — that is D-036 — and the difference is frequency.

**The section is removed from the published body.** Both callers want updates as data: `/now`
shows the latest two, the project page renders all of them as dated entries. Left in the body,
the same text would publish twice — once as raw markdown under a heading, once as entries. A
test asserts no public body still contains an `## Updates` heading.

**First live caller of `writeVaultFile`,** dormant since D-036 and exercised only by its own
tests. Its last-write-wins behaviour and 8s deadline are reachable in production for the first
time. No approval gate: a human writes these, not a model, so D-080 is untouched — nothing
AI-driven writes to the vault in V2.

**Photo prompts, not uploads,** as agreed. The private page names each active project with no
image and the file to edit. `writeVaultFile` is text-only; committing binaries through the
Contents API is its own piece of work.

**Reversing it.** Delete `src/app/now/`, `src/app/private/now/`, and the `updates` field from
`toPublicProject`; the `## Updates` sections then render as ordinary markdown on project pages
and nothing is lost. Remove the two nav entries. Tests:
`src/lib/vault/__tests__/updates.test.ts`.

## 2026-08-25 · The domain

### D-098 · A credential is one indivisible string, and `PASSKEYS` holds every device

**Decision.** `storedCredential()` becomes `storedCredentials()`, returning a list read from a
new `PASSKEYS` variable: entries separated by commas or newlines, each
`label:credentialId:publicKey`. Login offers every enrolled id and verifies against the one the
browser actually asserted; enrolment excludes every enrolled id and returns the **whole** list to
paste back.

**Why.** Victor wants the private side on his phone as well as his laptop, and the account was a
single pair of environment variables.

The alternative — `PASSKEY_CREDENTIAL_IDS` and `PASSKEY_PUBLIC_KEYS` as two parallel lists —
pairs by position. Retiring a device then means deleting the matching entry from both, and
missing one silently binds the wrong key to the wrong id. That fails closed rather than opening a
hole, but it fails as "sign-in stopped working" with nothing to point at. Keeping a credential
atomic makes that state unrepresentable. Colons are safe as a separator because base64url is
`A-Za-z0-9-_`; the id and key are read from the *end* of the entry, so labels may contain colons.

The label is for the human, never the ceremony. Deciding which of two opaque base64 blobs is the
old phone, six months from now, is otherwise guesswork.

Two failure modes shaped the rest:

- **Verifying against the first credential** in the list would have rejected the phone whenever
  the laptop was listed first. The asserted id selects the key. An unknown id returns the same
  opaque `verification failed` as a bad signature, so this is not an oracle for which ids exist.
- **Returning only the new device** — what the old two-variable output did — invites adding the
  phone by overwriting the laptop, which locks you out of the machine you are sitting at.
  Enrolment now returns one variable containing everything.

A malformed entry is skipped with a warning rather than thrown: one typo should cost one device,
not the ability to sign in at all. If none survive, the existing `no passkey enrolled` 503 fires.

`PASSKEY_CREDENTIAL_ID` / `PASSKEY_PUBLIC_KEY` are still read, as one unlabelled credential, and
deduped by id against `PASSKEYS`. That pair is what is deployed and working right now, and this
change must not be the thing that logs Victor out — the migration can happen at his pace.

**The migration hazard, learned the same day.** Keeping the legacy pair readable makes the
migration safe *only if the order is right*: deploy the code that reads `PASSKEYS`, then set it,
then delete the old pair. Done in the other order the site reads neither — the new variable is
invisible to an old build, and the old variables are gone — and it reports `no passkey enrolled`
for every device.

What made that hard to see is that a live session cookie lasts seven days, so one device kept
working and the failure looked per-device rather than total. The check that settles it in
seconds, and which now lives in `REGISTER_PASSKEY.md`:

```bash
curl -s https://victorgusev.com/api/auth/login -H "Origin: https://victorgusev.com"
```

It lists one entry per credential the *deployed* build can see, which is the only number that
matters and is not what Vercel's settings screen shows.

**Reversing it.** Delete `PASSKEYS`, keep the legacy pair; single-device behaviour is unchanged
and still fully tested. Tests: `src/lib/auth/__tests__/credentials.test.ts`.

### D-097 · A relying-party mismatch fails with a sentence, not a DOMException

**Decision.** Both auth routes call `relyingPartyProblem(request.headers.get("origin"))` before
starting a ceremony, and return a 500 naming the offending values when the request origin is
not one the app accepts.

**Why.** The browser's own error is actively misleading. With `NEXT_PUBLIC_SITE_URL` unset in
Vercel, the pre-2026-08-25 `relyingParty()` fell back to `http://localhost:3000`, and enrolling
on the live site produced:

    The RP ID "localhost" is invalid for this domain

That message names a value nobody configured, never mentions the variable that produced it, and
reads like a bug in the site rather than a missing environment variable. It cost a real
debugging session. The replacement says which origin the request came from, what
`NEXT_PUBLIC_SITE_URL` currently is, what the app therefore expects, and what to do.

Two details worth keeping:

- **A missing `Origin` header is not a problem.** Same-origin GETs may omit it, and refusing to
  serve on that would break the ceremony in the name of protecting it.
- **The message is safe to return.** `NEXT_PUBLIC_*` is inlined into client bundles by
  definition, and the request's own origin is known to whoever sent it. Nothing here is secret.

The check runs on *registration* too, and that is the more valuable half: enrolling against the
wrong relying party mints a credential bound to a hostname that will never serve the site, and
the only symptom is a sign-in failing later for reasons that look unrelated.

**How to reverse.** Delete the calls. The ceremonies work identically; only the failure gets
worse.

### D-096 · The canonical URL is the apex, `victorgusev.com`

**Decision.** `NEXT_PUBLIC_SITE_URL` and the three fallbacks in `layout.tsx`, `robots.ts` and
`sitemap.ts` are `https://victorgusev.com`. Vercel serves the apex as primary and redirects
`www` to it. Supersedes D-094, which is in [Reversed](#reversed).

**Why.** Victor's call, 2026-08-25. The bare domain is what he would write on a resume and in
an email signature, and it is one fewer word everywhere it appears. D-094 had chosen `www`
only because that was how the domain happened to be connected — a description of the current
setting rather than a preference, and the wrong thing to enshrine once the preference was
known.

**This cost nothing to reverse, by design.** D-095 had already made `rpID` the apex and
`origins` a list covering both forms, so flipping the primary did not invalidate the passkey
and required no auth change at all. Had D-095 not landed first, this would have been a second
forced re-enrolment. That is the entire value of the list.

**How to reverse.** Flip the primary in Vercel and change `NEXT_PUBLIC_SITE_URL` plus the
three fallbacks back to the `www` form. The passkey survives either direction.

### D-095 · The relying party is the apex, and both origins are accepted

**Decision.** `relyingParty()` returns `rpID` = the apex domain with any `www.` stripped, and
`origins` = a **list** containing the configured origin plus both the apex and `www` forms.
Both auth routes pass the list as `expectedOrigin`.

**Why.** It broke for real. The domain was connected with **`www.victorgusev.com` as the
primary** — the apex 308-redirects to it — while `NEXT_PUBLIC_SITE_URL` was unset and still
falling back to `victorgusev.vercel.app`. The app therefore expected one origin while the
browser sent another, and sign-in on the live site simply failed.

Two separate rules were being conflated by deriving both values from one hostname:

- **`rpID` is a permanent binding.** It may be any registrable-domain suffix of the origin, so
  a credential scoped to `victorgusev.com` works on `www.victorgusev.com` — but not the
  reverse. The apex is therefore strictly better: `www` is a narrower binding that buys
  nothing and breaks if the primary is ever flipped.
- **`origins` must contain the browser's exact origin**, scheme and port included. Which of
  apex and `www` is primary is a Vercel setting changeable in one click, and as a single value
  that click was a lockout.

Together: the passkey now survives apex and `www` being swapped, and only an actual change of
domain forces re-enrolment. Six tests cover it, including that `rpID` never carries a scheme or
port and that `localhost` keeps its port — rebuilding the origin from the hostname would drop
it and break the ceremony in development only.

**How to reverse.** Return `origin: url.origin` and pass it directly. Accept that the primary
hostname and the configured one must then match exactly, forever.

---

## 2026-08-25 · Weekly summary, images, and retiring culinary

### D-093 · Every real model call is logged

**Decision.** `callModel` prints `Gemini call: <model>, <n> chars` on every request that
actually reaches the API.

**Why.** The entire cost story rests on the cache absorbing repeat views, and that was never
observable — a cache that had silently stopped working looked exactly like one that was
working, until the bill arrived. This makes it checkable in ten seconds: load a page twice and
the second load must print nothing.

Measured with it, from a cold cache: three loads of `/private` with unchanged input cost
**zero** calls; changing the prompt cost exactly **one**. That is V2_PLAN §1.5's completion
test — "verified by watching the cache rather than by trusting it" — and it could not have been
satisfied without this line.

The character count is there because prompt length is most of what is paid for.

**How to reverse.** Delete the line. Accept that cache behaviour becomes unobservable again.

### D-092 · The weekly summary is fed days, not entries

**Decision.** `generateWeeklySummary` receives one line per day for seven days, with empty days
included explicitly as "nothing logged". It has its own cache entry and its own tag, and it
short-circuits to zero cost when the whole week is empty.

**Why.** Three reasons, in order of weight:

1. **Cache stability.** Keyed on the prompt, a week of raw entries changes its key every time
   any single entry moves. Days change only when a day changes.
2. **Empty days are the signal.** "Nothing logged" on three days is the most informative thing
   a weekly summary can say. Dropping those rows would make a four-day week indistinguishable
   from a full one, which is exactly the self-flattering summary nobody needs.
3. **Cost.** A week of entries is a few hundred lines against a $10/month budget.

A separate tag from the daily summary matters: a day's log changing must not invalidate the
week, and invalidating the week must not cost a fresh daily call. Sharing one would make each
pay for the other's churn.

**Not verified live.** The weekly path needs real log data, and `.env.local` points at the
production Neon database — seeding fake entries would write into Victor's actual logbook. The
empty-week path and the guards are tested; the populated path gets its first real exercise the
first week he logs something.

**How to reverse.** Pass entries instead of days, and drop the `anything` guard in the page.

### D-091 · `image_fit` decides cover or contain, per project

**Decision.** A new optional frontmatter field, `image_fit: cover | contain`, defaulting to
`cover`. Set to `contain` on `micromouse-simulator`, `taskable` and `solenoid-bit-reader`.

**Why.** The hero box is `aspect-16/9` with `object-cover`, which is right for a photograph and
wrong for everything else. Measured: micromouse is 606×649 (0.93:1), taskable 1428×910 (1.57:1),
solenoid 424×299 (1.42:1) — all taller than 16:9, so `cover` cropped the top and bottom off.
On taskable that removed the "TaskAble (Teacher View)" heading, which is the one thing the
screenshot exists to show. `5SecondRule.png` is 1920×1080 artwork and stays `cover`.

Explicit rather than derived. Reading intrinsic dimensions at build time would work, but it
makes every project page depend on decoding an image to decide something a human knows by
looking — and the rule is not really about the ratio, it is that **a diagram or screenshot is
worth seeing whole and a photograph is worth cropping**.

Solenoid's crop pre-dated all of this and was not a regression; it was fixed anyway, because
leaving one diagram cropped while fixing two others is incoherent.

**How to reverse.** Delete the field from the schema, both projections and both render sites.
Everything returns to `object-cover`.

### D-090 · Project cards size to their own content

**Decision.** `items-start` on the projects grid.

**Why.** A regression introduced by adding images. The grid stretched rows to equal height,
which was invisible while one project of six had an image. With four of six carrying one, a
card without an image was stretched to match its neighbour and opened roughly 200px of void
above its tags — Proof and Water Bottle Scale both looked broken.

Uneven card heights read as a set. A void reads as a missing image.

**How to reverse.** Drop `items-start` and accept equal-height rows.

---

## 2026-08-25 · V2 rev 4 — the cut, and three features that fit inside it

### D-089 · Project updates live in markdown, and `writeVaultFile` finally gets a caller

**Decision.** The Working page's dated updates are stored as entries in each project's own
markdown file, written from `/private` through `writeVaultFile`. Not Postgres.

**Why.** The public site is statically generated and free. Updates in Postgres would make the
Working page the first public page needing a database, turning a static page dynamic for
content that changes weekly. Markdown keeps it static; the cost is that saving an update is a
commit plus a Vercel rebuild, so it appears in about a minute.

That is the right trade *here* and was the wrong one for tasks — D-036 moved those to Postgres
precisely because a commit-and-deploy per save made logging slower than the app it replaced.
The difference is frequency: tasks change many times a day, a project update perhaps weekly.

This makes V2 §7.9 the **first live caller of `writeVaultFile`**, dormant since D-036 and
exercised only by its own tests. A real `409` becomes reachable for the first time, so the
retry has to work. D-080 is unaffected: this is a human writing, not a model, so it needs no
approval gate, and nothing AI-driven writes to the vault in V2.

**How to reverse.** Move updates to a Postgres table and make `/now` dynamic. Expect to revisit
static export assumptions across the public build.

### D-088 · The Working page is built on `status: active`, not a new entity

**Decision.** A project appears on the public `/now` page when its frontmatter says
`status: active`. No new data model. Nav becomes About / Now / Projects / Resume.

**Why.** The schema has carried `status: active | archived` since the beginning. Reusing it
means `/now` and `/projects` cannot disagree — a project cannot be in progress on one page and
finished on another — and it means the page costs 6h instead of 9h.

The alternative, a separate list, buys the ability to show motion on work that will never be a
portfolio project: coursework, this vault, one-off experiments. That is a real gap, but it is
**additive** — a separate list can be added later without moving anything that exists — so
adding it speculatively now would be paying for an option before knowing it is wanted. Recorded
in `docs/V3_PLAN.md` §2.

**How to reverse.** Introduce a `working` entity and read from it instead; `/projects` is
unaffected either way.

### D-087 · Semantic search is cut, and this time it stays cut

**Decision.** Semantic search leaves V2 and moves to `docs/V3_PLAN.md` §2 as recorded-but-unscheduled.
The Working page, the public→private button and read-only job-sheet access take its place.

**Why.** It has now been evaluated three times. Rev 1 cut it on **cost** ($10 of credit). Rev 2
reinstated it when the budget turned out to be $10 *per month*, which removed that objection.
Rev 4 cuts it on **time**, which was always the real constraint: at 12h it was the largest item
in V2 and the only remaining Hard one, and Victor rated it the lowest-frequency capability in
the plan.

The arithmetic is the argument. Three requested features cost 11.5h; semantic search cost 12h.
Trading them left V2 **shorter** than before the features arrived, with slack going from ~19%
to ~34%. Victor offered extra hours to fit everything; they were declined and held in reserve,
because eleven consecutive 6h days ending the day before move-in is how the last week of a
deadline goes wrong.

Nothing had been built, so nothing was wasted.

**How to reverse.** It is intact in `docs/V3_PLAN.md` §2 with its design notes — Postgres vectors,
re-embed only on `updated:` change, hard token ceiling, private-only surface.

---

## 2026-08-25 · Closing out "Today"

### D-086 · A failed summary is not cached, and a missing key never reaches the cache

**Decision.** `cachedSummary` throws when `callModel` returns `ok: false`, and
`generateDailySummary` catches it and turns it back into a message. A missing or placeholder
`GEMINI_API_KEY` is checked *before* the cache and short-circuits, like the empty-day case.

**Why.** `unstable_cache` stores whatever its function returns, and `callModel` deliberately
returns failures as values rather than throwing (so a nice-to-have panel cannot 500 the
dashboard). Composed naively those two correct decisions produce a wrong one: a single 404 or
rate limit pinned "the summary could not be generated" to the dashboard for the full six-hour
TTL, long after the cause had gone. A rejected promise is not stored, so throwing at the cache
boundary means only successes occupy it.

The key check moved out for a second reason: `unstable_cache` needs a Next request context, so
anything behind it cannot be tested outside one — the first version of the test got
`Invariant: incrementalCache missing` and the too-broad catch reported it as a summary
failure. A missing key is a configuration state, not a model failure. There is nothing to
memoise about it.

**How to reverse.** Return the result instead of throwing, and put the key check back inside
`callModel`. Accept that a transient failure sticks for six hours.

### D-085 · `gemini-2.5-flash` is retired; the model id is `gemini-3.6-flash`

**Decision.** `MODEL` is exported from `lib/ai/gemini.ts`, is `gemini-3.6-flash`, and is what
the dashboard panel prints as its `meta`.

**Why.** Every call was returning `404 — "This model models/gemini-2.5-flash is no longer
available to new users"`. The API names its own replacement, which is where the new value came
from. The daily summary had been silently degrading to its fallback string, because
`callModel` catches everything: **a retired model does not fail loudly here.** Found only by
reading the dev server log while screenshotting the page for D-084.

That is also why the panel now prints the live `MODEL` constant rather than a hardcoded
"Gemini 2.5 Flash" label — the label had already drifted from the truth once.

Two tests guard it: one asserts the id still contains `flash` (the budget is ~$10/month), one
asserts it is not the retired string.

**How to reverse.** Change the constant. Nothing else references a model name.

### D-084 · The task list comes before the numbers that describe it

**Decision.** `/private` orders as: schedule (when there are events), the Due list, a compact
three-across stat row, goals, backlog, finished, and the AI summary last. The stats no longer
stack on a phone, and their hints are hidden below `sm`.

**Why.** Feature 3 was "largely built" and had never been reviewed against the question it
exists to answer: *what do I do now*. Measured at 390px, **the first task sat 791px down the
page** — past the fold on any phone. What occupied that space was a failed AI panel (~170px
saying it could not generate a summary) and three stat cards stacked into ~290px to show three
zeros. Two of those three restate what the panels below already say: "Due today" is the length
of the very next list, and "Done today" is the count in "Finished today". So the page opened
with a summary of the answer and put the answer below the fold.

The AI summary moved to the bottom because it answers "how did today go", not "what do I do
now", and because it is the slowest thing on the page — last means the network round trip is
the thing nobody is waiting for. When it fails it now gets one muted line rather than a panel:
still shown, because a silently missing summary is a key nobody notices is broken, but at the
weight the message deserves.

After: **356px.** No panel was deleted and nothing was built — the review was the feature,
exactly as V2_PLAN predicted.

`SkeletonStats` was updated to match the new grid. When the two drifted, three stacked
placeholders collapsing into one row moved the page ~200px under the reader's thumb as the
tasks resolved.

**How to reverse.** Move the blocks back in `app/private/page.tsx`; they are three
independent JSX chunks. Put `sm:grid-cols-3` back on the stat row and the skeleton together.

### D-083 · `shots` signs its own session and gates the fold

**Decision.** `npm run shots` now sweeps `/private` and `/private/log`, minting a session
cookie from `SESSION_SECRET` (loaded via `--env-file-if-exists=.env.local`). It reports how far
down the page the first task sits and **exits non-zero above 500px** on a phone width. Skipped
silently when the secret is absent, or with `SHOTS_PRIVATE=0`.

**Why.** `/private` is the page Victor opens most and the only one he uses on a phone daily,
and it was the one page nothing could see — behind a passkey, so the sweep stopped at the
sign-in screen. That is how 791px survived. The session is an HMAC over a JSON payload, so a
valid cookie can be minted from the same secret the app verifies against; the secret is
already on this machine, the server is this machine, and the minted token lives fifteen
minutes rather than the app's seven days.

500px because a 390×844 phone shows roughly 690px once browser chrome is subtracted. The gate
was verified in both directions — lowered to 300px it fails with exit 1, restored to 500px it
passes with exit 0. A gate that has never fired is not known to be a gate.

The script also reports a redirect to `/signin`, so a rejected cookie cannot silently become a
screenshot of the sign-in page recorded as a healthy layout.

**How to reverse.** Delete the private block and `data-first-action` from `task-list.tsx`
(renamed from `data-task-list` by D-166), and
drop `--env-file-if-exists` from the `shots` script.

---

## 2026-08-25 · The case-study page

### D-082 · Project sections are stored in narrative order, not reordered at render

**Decision.** `scripts/order_case_study_sections.py` puts each project file's sections into
the order a case study reads in — problem, what was built, what did not work, what it
measured, then anything else. Five of six files moved. The renderer then displays them in
file order, with no reordering of its own.

**Why.** Four files opened with `## Architecture` and reached `## The problem` third, because
the D-073 skeleton was appended to files that already had an architecture paragraph. That is
invisible today only because the misplaced sections are all still unwritten and
`dropUnwritten` removes them — it stops being invisible the moment the prose lands, which is
why this ran before Victor writes rather than after.

Reordering in the renderer was the alternative and is worse: the public page would then
disagree with the file, which breaks the one rule this vault runs on. The vault is also read
directly by AI agents, so a file that reads in the wrong order is wrong for them too, not just
for the website.

The script moves whole sections and never edits a line inside one. Verified by comparing the
sorted set of non-blank lines before and after: identical for all six files. It is idempotent,
and `--check` reports drift without writing.

**How to reverse.** Move the sections back by hand; nothing depends on the order but reading.

### D-081 · A case study is styled by role, and the results carry the weight

**Decision.** `CaseStudy` renders a project body by mapping each `##` heading to a role and
giving each role its own treatment. `Measured results` gets the primary magenta, a panel, and
its numbers wrapped in mono; `What did not work` gets the steel secondary and a panel of its
own; the problem and the architecture are plain. Sections carry a mono index and a rule to the
edge. Everything else falls through to plain `Prose` exactly as before.

**Why.** Every section was styled identically, so the one number Victor measured and the one
thing he abandoned looked exactly like a paragraph about the stack. Those are the two sections
an engineer actually reads: results are the payload, and "what did not work" is the section
almost no student portfolio has at all.

Three rules make the half-written states — which is most of the portfolio until the write-ups
land — look deliberate rather than broken:

- **A section keeps its own heading.** The role picks the colour and the container, never the
  wording. `solenoid-bit-reader` still says "Design decisions" and "Results", because D-073
  kept that wording on purpose and a renderer quietly retitling an author's section is an
  editorial act disguised as styling.
- **The index counts sections that are present**, not the role's slot in the skeleton.
  Numbering by role would print `01 03 04` on a half-written project, advertising exactly the
  gap `dropUnwritten` exists to hide.
- **One section is still a case study**, and is rendered without an index — it does not need
  to be told it is the first of one.

Failure is steel, not red. This section is evidence of judgement; colouring it like a warning
would say the opposite.

Number emphasis is opt-in on `Prose` (`numbers`) and used only inside a results panel. `Prose`
also renders experience entries, lab write-ups, the private calendar's rules and every vault
document, and highlighting every figure across those would be noise where it is signal on one
panel. A test asserts the marked-up text is character-identical to the plain text — altering a
measured figure on a portfolio page is the D-069 failure mode with extra steps.

Verified against `solenoid-bit-reader` plus throwaway one-, two- and four-section fixtures at
390px and 1280px, since solenoid alone is one section from complete and cannot show the
partially-filled case. The fixtures were deleted immediately; they were never committed.

**How to reverse.** Put `<Prose>` back in `projects/[slug]/page.tsx` and delete
`case-study.tsx`, `lib/vault/case-study.ts` and the `numbers` prop. Bodies then render as an
undifferentiated run of headings again.

---

## 2026-08-25 · V2 replan and the resume gate

### D-080 · The AI approval gate is over proposals, not over a markdown diff

**Decision.** Feature 6's approval surface reviews a **typed list of changes** — a before and
an after per item, approved or rejected individually — rather than a rendered diff of two
markdown documents. `writeVaultFile` stays dormant through V2; nothing AI-driven writes to the
vault at all.

**Why.** V2_PLAN rev 1 specified a markdown diff and justified building it first because
"draft sprint goals depends entirely on the approval UI". That dependency does not exist.
Sprint goals are Postgres rows: `saveSprintGoals` → `replaceGoals` writes `tasks` rows with
`source='goal'` (`src/app/private/actions.ts:144`). Nothing about goals touches markdown.

Following rev 1 would have spent 10h — the largest single item before the deadline — building
a markdown-diff UI that **no V2 feature calls**: goals write rows, resume tailoring writes
nothing, semantic search reads. It would have shipped a code path exercised only by its own
tests, which is the exact condition (`writeVaultFile` dormant since D-036) the plan named as
its own risk.

The constraint Victor set — *nothing writes on a model's say-so* — is unchanged and is in fact
satisfied more strongly this way, because in V2 the model cannot reach the vault at all.

**How to reverse.** Build the diff view and give `writeVaultFile` a caller. Do it in that
order and only once something genuinely drafts markdown; a writer whose first job is
case-study prose collides with D-073 and needs Victor's explicit sign-off, not an agent's
judgement.

### D-079 · Semantic search is reinstated; the cut line moves to its re-embedding

**Decision.** Feature 6 keeps all four capabilities including semantic search. It stays last
in build order. The declared cut is now, in order: (1) drop incremental re-embedding for
on-demand full re-index, (2) drop the feature.

**Why.** Rev 1 cut it on cost, against "$10 of credits, total, for the life of this". The
budget is **$10 per month**. Cost was the objection, so the cut lapses — but a plan without a
declared cut line decides under pressure, so a new one is named with a dated trigger (V2_PLAN
§2.4). Reinstating 12h is affordable only because D-080 gave back 7h; the two are linked.

**How to reverse.** Take cut 1, then cut 2.

### D-078 · Coursework is four entries, and it is shared by every variant

**Decision.** `coursework:` in `resume_config.md` drops from seven to four — Algorithms and
Complexity, Software Construction, Object-Oriented Design, Linear Algebra. Dropped:
Programming Languages, Discrete Structures, Logic Design.

**Why.** The SWE variant printed at 1.03 pages and coursework is the lowest-signal content on
the sheet. Worth knowing before editing it: this is **one flat list consumed by all three
variants** (`src/lib/resume.ts:126`), so the trim shortened ml and robotics too. That was
acceptable — both had room — but a variant-specific coursework line would need a schema
change, and was judged not worth it for one line of text.

Measured: the trim alone moved swe 1.03 → 1.01, i.e. it recovered ~19px of the ~29px needed.
It did **not** close the gap on its own, which is why D-076 exists.

**How to reverse.** Put the three back. Expect swe to return to 1.01 and check with
`npm run shots`.

### D-077 · The resume's page count is measured, not eyeballed

**Decision.** `npm run shots` measures every resume variant against one printed Letter page
and exits non-zero if any runs over. Two numbers per variant: `pages`, from Chromium's own PDF
writer at Letter/0.5in — the same path as the print dialog Victor actually uses — and `ratio`,
the print-emulated sheet height over one page. A print-media PNG is written alongside the PDF.

**Why.** V2_PLAN rev 1's completion test for the resume was "`shots.mjs` reports every variant
under 1.00 pages". `shots.mjs` could not do that: it measured horizontal overflow, tap targets
and font size, and only ever loaded `/resume/swe`. The plan's own rule is *measure, do not
assume*, and its completion test assumed a measurement that did not exist. The resume printed
at 1.33 pages for weeks for exactly this reason.

`ratio` is there because it is the number that makes an overflow *fixable*: "1.03" says trim a
line, "2 pages" says nothing. Two attempts at measuring it were wrong before the third was
right, and both failure modes are worth remembering — `documentElement.scrollHeight` never
reports less than the viewport, so every variant that fit read exactly 1.00; and `main`
carries `flex-1` inside the layout's flex column, so it is stretched to the viewport whatever
it holds. Both measure the window, not the content. `.resume-sheet` is the only element whose
height is the content's. The fixed version independently reproduced the three figures rev 1
had recorded by hand (1.03 / 0.98 / 0.90), which is what says it is right.

Only `swe` is screenshotted at the four device widths. The three variants are one component
fed different data, so a mobile layout fault appears in all of them identically; what differs
between variants is length, and length is what the new measurement covers.

**How to reverse.** Delete `measureResumes` and its call. Page count returns to being checked
by printing the page and counting.

### D-076 · Bullet leading, not bullet count, closed the last 13px

**Decision.** Print bullet `line-height` 1.26 → 1.20, and `.resume-sheet section` margin-top
0.5rem → 0.375rem. Font sizes are unchanged.

**Why.** After D-078 the SWE sheet still measured 973px against 960 available. Probing where
the height actually went: 17 bullets over 27 rendered lines were 432px — **44% of the page** —
so leading there is worth more than anything else on the sheet, and it costs no content. The
alternative levers were both worse: `main` and `.resume-sheet` padding are already zeroed in
print, and everything else on the page is text Victor wrote.

The 9.6pt floor from the earlier density pass is deliberately untouched. Leading is
whitespace; type size is legibility, and shrinking it further is how a resume starts looking
like it is hiding from its own length.

Result: swe 0.98, ml 0.93, robotics 0.86 — all one page, with headroom rather than sitting at
0.999 where the next added bullet breaks it again.

**How to reverse.** Both values back to 1.26 and 0.5rem. swe returns to two pages.

---

## 2026-08-24 · Mobile and case studies

### D-075 · A hover-only affordance must not occupy space without hover

**Decision.** The "Read more →" hint on a project card is `hidden` and becomes `block` only
under `@media (hover: hover)`.

**Why.** It was `opacity-0` with `group-hover:opacity-100`, which still reserves its box. On a
phone that is roughly 32px of permanently invisible space per card — six cards, no touch user
could ever resolve any of it into text. Opacity hides ink, not layout.

**How to reverse.** Drop the `hidden [@media(hover:hover)]:block` pair and accept the empty space.

### D-074 · Only a real photograph earns a figure

**Decision.** Project cards and detail pages render an image only when one exists. Without one,
a card gets a 1px accent rail instead of a 16:9 generated placeholder.

**Why.** Five of six projects have no photograph, and the generated stand-in cost about 180px
each. Measured, the projects page ran to **6,150px on a 390px phone** — most of it decorative
charts of nothing, above the actual writing. It is now **3,950px**, and the one project that
does have a photograph reads as the strongest by contrast rather than being lost among five
lookalikes.

The `ProjectFigure` placeholder generator is kept, not deleted: it is still the right thing if
a future layout wants a uniform grid.

**How to reverse.** Render `ProjectFigure` unconditionally again.

### D-073 · Case studies are skeletons in the vault, and unwritten sections do not publish

**Decision.** Every project file carries the four sections Victor chose — the problem and its
constraint, architecture, what did not work, measured results. Unwritten ones hold a
`> **To write:** …` prompt. `dropUnwritten` strips those prompts *and* removes any heading left
with nothing under it, so the public page shows only what he has actually written.

**Why.** The write-ups are 24–80 words. A case study needs content, and content that is not
recorded cannot be produced by an agent — the water bottle scale (D-069) is what that looks
like when it goes wrong. So the structure is built and the prose is Victor's to add, in the
file where he already edits.

Publishing an empty `## Measured results` would be worse than having no section: it advertises
a gap. Publishing the prompt itself would be worse again — a portfolio page asking its own
author what he tried that failed.

Two bugs found while building it, both fixed and pinned by tests:
- The prompt matcher caught only the opening line of a blockquote, so the *wrap* of each prompt
  was published as if it were prose. Prompts now run to the end of their quote.
- `water-bottle-scale.md` had a "Still to write up" list that was publishing its own gaps. It
  now uses the same convention as every other file.

`solenoid-bit-reader.md` keeps `## Design decisions` and `## Results` rather than gaining
duplicates: it already answers both questions, with a real measured number.

**How to reverse.** Delete `dropUnwritten` and the skeleton sections. Bodies then publish
verbatim, prompts included.

---

## 2026-08-24 · V2 close-out decisions

### D-072 · A local browser is the only MCP server

**Decision.** `.mcp.json` runs `@playwright/mcp` locally, isolated, at a 1280×900 viewport.
Nothing else is configured.

**Why.** Two of the remaining tasks — resume design and the mobile layout pass — are purely
visual, and until now the site has only ever been verified by grepping built HTML. That caught
fabricated content and privacy leaks, but it cannot answer "does this look right", which is the
actual question for both jobs.

Local matters more than the capability. The repo is private and holds health data; a browser
driven on Victor's own machine sends nothing anywhere. The alternatives considered — Sentry,
Semgrep, Datadog, a Neon MCP — all ship code, telemetry or query results to a third party, and
three of them imply paid tiers against a $0 budget. Sentry alone remains defensible later, and
would need scrubbing rules before it touches the private site.

`--isolated` so no browser profile persists between runs, and no cookie or session from ordinary
browsing is reachable from an automated one.

**How to reverse.** Delete `.mcp.json`. Verification returns to inspecting built output.

### D-071 · The whole log, health included, may be sent to the model

**Decision.** The AI summary sends everything: sprint goals and all six log categories,
athletics and bodyweight among them. Asked directly, Victor chose this over excluding health.

**Why.** It is his data and his call, and a summary that silently omits training is a summary of
a fraction of his day.

**This does not loosen the publication rule, which is unchanged and absolute.** Health data must
never reach a public page. The two are different acts: one sends data to an API under Victor's
own key for a private page only he can see; the other bakes it into a world-readable static
bundle. A future agent reading "everything goes to Google" as licence to publish bodyweight
would be misreading this entry.

Practical consequences worth stating: prompts leave the machine, so anything sent is subject to
Google's retention, and the summary is cached — meaning health-derived text sits in the Next
cache alongside everything else.

**How to reverse.** Filter by category in `AiSummary` before building the prompt. The
`summarise()` output is already per-category, so the filter is one predicate.

### D-070 · Feature 6 gets all four capabilities, summaries first

**Decision.** Read-only summaries, draft-sprint-goals behind an approval diff, resume tailoring,
and semantic search — all four, built in that order, after the public-site work.

**Why.** Victor picked the public site as the priority for the pre-term window: the resume is
what gets him interviews and fall recruiting is imminent, whereas feature 6 is for him alone and
fits the 4h/week he will have during term.

On cost, he judged the $10 sufficient — semantic search will be used rarely and Flash is cheap.
That is a real constraint rather than a guess, so embeddings must be cached and re-embedding
must be incremental, not a full pass on every vault edit.

Draft-sprint-goals is what forces the approval-gated write UI to exist. That gate is
non-negotiable: nothing writes to the vault on a model's say-so.

**How to reverse.** Build only the summaries and drop the rest; nothing else depends on them.

---

## 2026-08-24 · Review of external changes

### D-069 · Nothing on the public site may be inferred, only recorded

**Decision.** Project entries state what Victor has told us and nothing else. Where detail is
missing the file says so under a "Still to write up" heading and carries `draft: true`, which
keeps it on the portfolio but off every resume.

**Why.** The water bottle scale entry was rewritten with invented specifics — an ESP32 (Victor
said Arduino Uno), an HX711 amplifier, "±2g accuracy", a 5-second-window state machine and MQTT
streaming — and marked `draft: false` with `resume_variants: [swe, robotics]`. All of it reached
the built portfolio and two resume pages. Fabricated technical detail on a hiring-facing
document is the worst failure this project can produce: it is discovered in an interview, by
someone asking a follow-up question.

The previous placeholder had listed exactly what needed filling in. Those prompts became the
fabrication — "one measured number: accuracy in millilitres" became "±2g accuracy".

**How to reverse.** Fill the entry in with real detail from Victor, then set `draft: false` and
add resume variants. Do not do it the other way round.

### D-068 · `experience[0]` is "most recent", never "now"

**Decision.** The homepage spotlight is headed "Most recent" and prints the entry's real
`dateEnd`.

**Why.** It was headed "What I'm working on now" with a hard-coded `— Present`. Dimaag.ai's
vault entry says `date_end: 2026-08`, so the public site told every hiring manager that a
finished internship was ongoing — a claim about employment produced by a string literal and an
array index.

The "what I'm working on now" section Victor actually asked for is about current *work* —
2ndMind, coursework — and is still unbuilt. Reusing the experience list for it was not the same
feature.

**How to reverse.** Only with a field that says a role is current, and only driven by data.

### D-067 · The AI summary is cached and reads the live log

**Decision.** `generateDailySummary` wraps the model call in `unstable_cache` (6h TTL, tag
`ai-summary`) keyed on the prompt, and the dashboard feeds it today's `log_entries` rows plus
the sprint goals section — not `logbook_archive.md`.

**Why.** Two defects. The call sat uncached on `/private`, which is `force-dynamic` and the page
Victor opens most, so every load re-summarised an unchanged day against a $10 lifetime credit
budget. And it summarised the *retired* free-text logbook — the thing feature 2 replaced and
Victor asked to rework or delete — so it described a system he stopped using while ignoring
everything he has written since.

Keying the cache on the prompt rather than on time means a real change in goals or log produces
a new summary immediately; only repetition is free.

**How to reverse.** Call `callModel` directly and pass whatever context is wanted.

### D-066 · `app/error.tsx` shows a digest, not a message

**Decision.** The message is rendered only in development; production shows the digest.

**Why.** This boundary sits at the root of `app/`, so it covers the public portfolio. Next
redacts server-thrown messages in production, but anything thrown in a client component arrives
verbatim — and this page is reachable by anyone. A digest locates the real trace in the Vercel
logs and tells a passer-by nothing.

It is deliberately **not** renamed to `global-error.tsx`. That file replaces the root layout,
must render its own `<html>`/`<body>`, and fires only for errors thrown in the layout itself.
Renaming would trade the boundary that catches nearly everything for the one that catches the
rarest case. Both may exist; one may not become the other.

**How to reverse.** Render `error.message` unconditionally, and accept that public visitors see
internal strings.

### D-065 · Structure is parsed, text is edited by offset

**Decision.** `frontmatter.ts` locates sections and bullets with an mdast parse, then edits the
located byte range as text rather than re-printing the tree.

**Why.** This closes a real corruption bug: a `##` inside a fenced code block used to terminate
a section, so replacing an earlier section left a dangling fence and a fake heading behind. A
regex cannot tell that a line is inside a fence. Measured on the old implementation before the
change, so the benefit is established rather than assumed.

Editing by offset, not re-printing, because `mdast` round-tripping normalises whitespace, list
markers and emphasis characters — rewriting parts of a file nobody touched and making every
diff unreadable.

Note what this does *not* do: `setLabelledBullet`, `getLabelledBullet` and `setFrontmatterField`
still use the same regexes as before, now applied inside a narrowed range. The `m`-flag and
CRLF traps therefore still apply, which is why the module header still documents them.

**How to reverse.** The pre-AST implementation is at commit `4fe26eb`. Reverting reintroduces
the code-fence bug.

### D-064 · No client runtime in the root layout without a caller

**Decision.** `<Toaster />` removed from `app/layout.tsx`.

**Why.** It was mounted globally while nothing in the codebase calls `toast()`. That shipped a
client component — and its hydration cost — to every page including the statically generated
public portfolio, for zero functionality. The public site's whole value is arriving as finished
HTML.

**How to reverse.** Add it back at the same time as the first `toast()` call, and preferably in
the private layout rather than the root one.

---

## 2026-08-22 · Athletics depth (feature 5)

### D-063 · The `db:migrate` script loads `.env.local` itself

**Decision.** `node --env-file-if-exists=.env.local ./node_modules/drizzle-kit/bin.cjs migrate`.

**Why.** `drizzle-kit` does not read `.env.local` the way Next does, so `npm run db:migrate`
failed with an empty `url` even with the variable sitting right there in the file. Every
migration therefore needed a remembered incantation, which is exactly the kind of friction
that ends with migrations not being run.

**How to reverse.** Put `"drizzle-kit migrate"` back and set `DATABASE_URL` in the shell first.

### D-062 · The Los Angeles offset is computed, not hard-coded

**Decision.** `zoneOffsetMinutes(now, timeZone)` in `lib/tasks/queries.ts`, replacing the
`const LA_OFFSET_MINUTES = 420` repeated in three pages.

**Why.** 420 is only correct while Los Angeles is on daylight time. It would have gone wrong
on **2026-11-01**, during term — and quietly: "today" would have begun at 11pm the night
before, filing every late-evening task and log entry under tomorrow for the whole of winter.
The new function formats the instant in the zone and reads it back as UTC, which is the only
way to get a real offset without shipping a timezone database.

**How to reverse.** Pass a literal offset to `dayBounds` again. Do not — the constant is wrong
for five months of the year.

### D-061 · Charts are server-rendered SVG, not `recharts`

**Decision.** `components/site/chart.tsx` draws `TrendChart` and `BarChart` by hand. `recharts`
stays unused in `package.json`.

**Why.** These are one `<polyline>` each. Using the library would add a client boundary and a
charting runtime to a page that currently arrives as finished HTML, turning a streamed render
into one that waits for hydration — the exact regression D-045 was written to prevent.

**How to reverse.** `recharts` is already installed; replace the two components. Accept that
the athletics page then ships JavaScript to draw its charts.

### D-060 · Warmup sets count toward volume but never toward a record

**Decision.** `weeklyVolume` deliberately does not apply `isWorkingSet`; `strengthRecords`,
`ergRecords` and `flagSpm` all do.

**Why.** Victor was asked directly and said volume should include warmups — they are load the
body absorbed. A record set by a warmup, though, is not a record. This was V1 finding F10,
where the two rules were inconsistent by accident rather than on purpose; they are now
inconsistent on purpose, which is different, and the test says so.

**How to reverse.** Add `if (!isWorkingSet(effort)) continue;` to `weeklyVolume`.

### D-059 · The rehab checklist is its own table, not `tasks`

**Decision.** `rehab_completions`, keyed `(completed_on, slug)`.

**Why.** D-037 merged everything actionable into `tasks` so there would be one list to read.
Four rehab items every day is ~1,400 rows a year, which would bury the thing D-037 was
protecting. A daily-recurring checklist is a different shape from a to-do: it is never "done",
only "done today".

**How to reverse.** Insert four `tasks` rows a day with `source: "rehab"` and delete this
table. Expect the task list to become unreadable within a fortnight.

### D-058 · Bodyweight is a table, and it is health data

**Decision.** `bodyweight_entries`, one row per day, `date` rather than `timestamp`.

**Why.** It is the second input to every weight-adjusted split on the site, so "the weight
closest to this piece" has to be an indexed lookup rather than a scan through JSONB. `date`
because a weigh-in belongs to a morning, not an instant — storing days as timestamps is what
forces the noon-UTC trick used elsewhere here, and it breaks the first time Victor travels.

One reading per day, upserted: weighing twice in a morning is normal, and two rows would put
two contradictory points on one day of the chart.

**Privacy.** This is the field Victor named as never publishable. No public route imports the
schema, and the built client chunks were scanned — the only hits were the form's own UI copy.

**How to reverse.** Drop the table and delete `adjusted.ts`; the site falls back to raw splits.

### D-057 · Splits are weight-adjusted with Concept2's formula

**Decision.** `factor = (bodyweight_lbs / 270) ^ 0.222`, applied to time.

**Why.** The vault states exactly one athletic goal — "sub-2:00 **weight-adjusted** 500m
split" — so a site showing only raw splits could not answer whether he is close to it. At
215 lb the two differ by about seven seconds.

The direction is worth stating because it is the opposite of the intuitive reading: the
adjustment discounts *lighter* athletes, so **putting on mass makes this goal harder**. Both
the raw and the adjusted line are charted for that reason — an adjusted line alone would let
a lighter month read as a faster month. There is a test pinning the direction specifically.

The number the page leads with is the **required raw split**, because "sub-2:00 adjusted" is
not something anyone can pace to on a monitor and "2:06.2" is.

**How to reverse.** Show `splitPer500S` only and drop the Adjusted column.

### D-056 · The protocol is parsed from the vault, not written in code

**Decision.** SPM targets, the rehab protocol, the weekly split and the goal are read from
`context/02_physical_performance/` at request time by `lib/athletics/protocol.ts`.

**Why.** All four already live in the vault. A copy in TypeScript would drift: Victor edits
the markdown, the site keeps showing last month's programme, and nothing says which is right.
Parsing means editing the vault *is* editing the app — no code change, no deploy.

The cost is that reformatting those files can stop a section parsing. Every parser returns
empty rather than throwing, and every panel says "not found in the vault, from this heading"
rather than rendering an empty box — so a parse miss reads as a parse miss. Tests run against
the real vault files, which is what would actually catch a reformat.

Parsing is line-based, not one large regex: the vault is CRLF, `$` under `m` does not match
before a `\r`, and multi-line patterns have already caused silent bugs in this repo.

**How to reverse.** Hard-code the four structures in `protocol.ts` and delete the vault reads.
The panels stop tracking the vault.

### D-055 · The week's plan is compared to logged sessions coarsely, on purpose

**Decision.** `weekReview` reports whether a day has *any* session, never which planned item
was done. Future days are never "missed".

**Why.** Nothing in the data links a logged workout to a line of the programme. Matching on
the title would mark a rest-day walk as "Team Land Practice, complete" — a confident wrong
answer, which is worse here than an honest coarse one. And a review that shows the whole week
red on a Monday morning is the fastest way to make this view ignored.

**How to reverse.** Match `PlannedDay.items` against workout titles and report per item.
Expect false positives.

---

## 2026-08-21 · V2 scope

### D-054 · Vitest hook timeout raised to 30s

**Decision.** `hookTimeout: 30_000` in `vitest.config.mts`.

**Why.** The first `beforeEach` in each database test file boots PGlite and runs every
migration; three such files run in parallel workers, and under that load the first hook was
measured at ~16s, past vitest's 10s default. It surfaced as three "Hook timed out" failures
that passed on a re-run — the same flakiness D-050 fixed, from a different cause.

Raised rather than masked: the work genuinely takes that long once per file, and every
subsequent hook is a TRUNCATE taking milliseconds. Verified with two consecutive clean runs.

**How to reverse.** Lower it and the suite goes back to failing intermittently on a cold run.

---

### D-053 · The agenda shows the whole feed, unfiltered

**Decision.** `/private/calendar` lists every event in the Google feed. No classification, no
course-code filter.

**Why.** Victor's calendar is one general calendar — 182 events covering classes, practice and
personal life, of which only about 40 carry anything resembling a course code. A regex
deciding what is a "class" would drop a real one the moment it is titled without a code, and a
silently missing class is worse than a cluttered list. Asked, and he chose showing everything.

**How to reverse.** Filter in `Schedule`. If it ever happens, mark rather than hide, so a
misclassification is cosmetic.

---

### D-052 · Canvas import is a button, not a scheduled job

**Decision.** Assignments are pulled into the task table when Victor presses *Import Canvas*.

**Why.** A nightly sync needs a paid tier, which he ruled out. A free-plan cron would also be
the one part of this able to fail silently at 3am with nobody watching — and there is still no
error reporting (finding F6). A button is honest about when the data was last pulled.

The action calls `updateTag("calendar")` before fetching, because otherwise it would re-read
the 15-minute cache and appear to do nothing.

**How to reverse.** Move the body into a route handler and point a cron at it, once something
watches for failures.

---

### D-051 · Calendar comes from private iCal URLs, via ical.js

**Decision.** Both feeds are read from the secret iCal URLs Google Calendar and Canvas publish
(`GOOGLE_CALENDAR_KEY`, `CANVAS_CALENDAR` — Victor's own names, kept rather than renamed to
match the plan). Parsing uses `ical.js`.

**Why.** No OAuth, no consent screen Google must review, no refresh-token rotation, and no
cost — the objection D-034 raised against calendar sync in V1 does not apply to a feed URL.
The URL *is* the credential, so it lives in the environment and never reaches the browser.

`ical.js` rather than something hand-rolled, because the real feed has 37 recurring rules with
`UNTIL`/`BYDAY`, one VTIMEZONE, nested VALARM blocks and 50 all-day entries. A homemade RRULE
expander gets DST wrong, and the symptom is a class that silently stops appearing.

Two details that cost time: `TimezoneService.register` takes `(component, name?)`, not
`(name, component)` — reversed, it type-checks in plain JS and registers nothing, putting
every event seven hours out. And occurrences are capped at 400 per rule, which the real feed
needed: it contains an unbounded monthly recurrence that otherwise expands to 2058.

**Known limitation, not a defect.** As of 2026-08-22 the Canvas feed is empty (211 bytes, zero
events) and Victor's Fall 2026 classes are not yet in Google Calendar — the recurring classes
in the feed are Fall 2025 and have ended. The pipeline is correct and will fill in; the UI says
so rather than looking broken.

**How to reverse.** Unset the variables; every page keeps working without them.

---

### D-050 · One Postgres per test file, truncated between tests

**Decision.** `src/test/pg.ts` builds one PGlite instance per file and `TRUNCATE ... RESTART
IDENTITY CASCADE`s between tests.

**Why.** The first version made a fresh database and re-ran every migration for *each* test.
With three database test files running concurrently it took 88–155s and, once, failed three
tests that passed on a re-run. A suite that is flaky teaches you to ignore red, which is worse
than having no suite. Now **7s**, and deterministic.

The table list is parsed out of the migration SQL rather than hand-written, because a
hand-written list silently stops truncating a table added later.

**How to reverse.** Go back to per-test instances. Do not.

---

### D-049 · Dictation is feature-detected with `useSyncExternalStore`

**Decision.** The dictate button reads support through `useSyncExternalStore` with a server
snapshot of `false`, and renders nothing when the API is absent.

**Why.** Two constraints met at once. `window` does not exist on the server, so detecting
during render would break hydration; setting state in an effect is what the React lint rule
warns about and causes a cascading render. `useSyncExternalStore` is built for exactly this —
external, non-reactive state — and gives a clean server snapshot.

Rendering nothing rather than a disabled button is deliberate: Safari on iOS has no Web Speech
API, and a control that visibly does nothing is worse than no control.

**How to reverse.** Feature-detect however you like, but do not set state in an effect.

---

### D-048 · Log entries are one table with JSONB fields

**Decision.** `log_entries` holds all six categories: a `category`, an `occurredAt`, a `note`,
and per-category fields in `jsonb`. `searchText` is denormalised on write.

**Why.** The alternative was a column per field across every category — mostly nulls, and a
migration every time Victor wants a field changed. D-039 promises that changing fields is
cheap, and a migration per edit is not cheap.

`searchText` is written by `createEntry` rather than by callers, for the same reason
`bumpUpdated` lives in `writeVaultFile`: an entry whose caller forgot would exist but never be
findable again.

Search uses `plainto_tsquery`, not `to_tsquery` — the latter raises a syntax error on a bare
`&`, so a stray character in the search box would 500 the page. A test covers that.

**How to reverse.** Promote hot fields to real columns; the JSONB stays for the rest.

---

### D-047 · Categories are data, and the form is generated from them

**Decision.** `lib/log/categories.ts` declares six categories and their fields. One
`LogForm` renders any of them; the summary line, the search index and the validation all read
the same definitions.

**Why.** Six bespoke forms would be six places to change when Victor edits the fields, and
D-039 committed to that being a one-file edit. Tests assert the structural invariants that
matter — unique field names, options on every select, and **no category longer than eight
fields**, because the constraint from Q16 is that a log must be fillable in fifteen seconds.

Deliberately absent: any mood or energy scale. Victor put that in V3, and a 1–5 filled in from
habit rather than reflection is worse than nothing. A test pins that too.

**How to reverse.** Edit the array. That is the whole point.

---

### D-046 · The freshness walk is memoised at module scope

**Decision.** `loadFreshness` caches the 34-file disk read in a module-level variable.

**Why.** The vault ships inside the serverless bundle, so its contents are fixed for the life
of a deployment — re-reading every file on every request was repeated work with no possible
change to find. Module scope is the right cache: it survives across requests in a warm
function and is discarded automatically when a new deployment starts a new instance, so there
is no invalidation to get wrong. Ages are still computed per call, since those move with the
clock rather than the files.

**How to reverse.** Call `readVaultFiles()` directly; `resetFreshnessCache()` already exists
as the test seam.

---

### D-045 · Loading boundaries and streaming, because the server cannot get faster

**Decision.** A `loading.tsx` under `/private`, and a Suspense boundary around every
database or GitHub read on Today, Work, Academics, Athletics, Calendar and Hobbies.

**Why.** Victor reported it still felt slow after D-042 made the server measurably faster, so
I measured the thing I had not: production. `/signin` — a dynamic page with *no* database and
*no* API call — costs 335–440ms of Vercel function time, against 70ms to connect. That
overhead is not mine to remove, and it is paid on every navigation because every private page
is `force-dynamic`.

The mistake was optimising server time when the problem was that **nothing appeared on screen
while it ran**. With no loading boundary the App Router has nothing to show, so a click left
the old page sitting there and the app read as frozen rather than busy.

Measured after: TTFB 50–110ms across every private page, and the streaming order is verified
in the HTML — the shell and skeleton ship at byte ~6.7k, the content arrives at ~30k.

This also matters most exactly when the app feels worst: Neon's free tier suspends after a
few minutes idle, so the first query after a break is slow. The shell no longer waits for it.

**How to reverse.** Delete `loading.tsx` and unwrap the Suspense boundaries. Do not, unless
the pages stop being `force-dynamic`.

---

### D-044 · The academic tracker's vault implementation is deleted, not kept alongside

**Decision.** `checklist.ts`, its 25 tests, `academic-tracker.tsx`, `tracker.ts`, and the
academics actions are removed. `/private/sprint` and its form go too — goals are edited
inline on Today now.

**Why.** D-037 merged the tracker into the task model. Leaving the vault version in place
would have shipped both, which is the exact failure the merge exists to prevent, and keeping
unused-but-tested modules "in case" is how dead code accumulates. Everything is one `git
show` away if feature 5's rehab checklist wants it back.

**How to reverse.** `git show b069dcb -- web/src/lib/vault/checklist.ts` and friends.

---

### D-043 · Freshness is a badge, not a panel

**Decision.** The dashboard's full-width freshness section is replaced by a chip in the page
header that appears **only when something is stale**, expanding to a list on click.

**Why.** Victor's verdict on V1: it "should be here as an alert that something is not fresh,
almost as a notification. The full bar itself should be removed." The audit is unchanged —
this reverses only the presentation. A permanent list of 34 healthy files is furniture.

**How to reverse.** `freshness-panel.tsx` in git history; the report shape is identical.

---

### D-042 · Vault reads are cached; the write path is not

**Decision.** `readVaultFileCached` wraps reads in `unstable_cache` tagged `vault`, and
`writeVaultFile` calls `updateTag` after committing. Actions keep the uncached reader.

**Why.** Measured: private pages spent 300–800ms on serial GitHub round trips, against 33ms
for the one page making no network call. After caching, best-of-five steady state went
320→69ms (work), 377→32ms (calendar), 761→186ms (academics).

Three specifics worth keeping:
- **`unstable_cache`, not `use cache`.** The directive needs `cacheComponents: true`, which
  changes every dynamic API in the app and conflicts with the `force-dynamic` these pages
  rely on. Deprecated, but the migration is contained to one function.
- **`updateTag`, not `revalidateTag`.** The latter now requires a cache profile, and the
  recommended `"max"` is stale-while-revalidate — which serves the *pre-edit* content on the
  next read, making a save look like it did nothing.
- **The write path must not use the cache.** It needs a live blob SHA; a cached one turns
  last-write-wins into last-write-fails.

**How to reverse.** Call `readVaultFile` directly and delete the tag. Pages get slow again.

---

### D-041 · Every GitHub request has an 8-second deadline

**Decision.** Octokit is constructed with a `fetch` that carries `AbortSignal.timeout`.

**Why.** `fetch` has no default timeout, so a network problem was not a slow page but a hung
one — when the connection dropped mid-session, pages sat for minutes. 5s was the first value
and it fired during ordinary use on a working connection, which is worse than no timeout: it
turns slow into broken. 8s rides out a bad moment and still fails before anyone assumes the
app has died.

**How to reverse.** Remove the custom fetch. Do not, unless something else bounds the wait.

---

### D-040 · The card sweep plays once (reverses half of D-012)

**Decision.** `infinite` becomes `forwards`, and the keyframes drop the 55%-then-hold that
existed only to pause between loops. Duration 0.85s.

**Why.** Victor: "once it does the sweep once it should not repeat it when still hovering."

D-012 said explicitly which half of it must survive a reversal, and that instruction is
followed here: the corrected base transform (resting off-card) and the 260% travel stay,
because those were the bug fix — without them the highlight parks itself over the card and
never exits. Only the looping goes.

**How to reverse.** `forwards` → `infinite` and restore the hold keyframe.

---

### D-039 · Log fields are proposed from the vault, then edited

**Decision.** I draft three or four fields per log category from what the vault already
records — SPM and drag factor for erg work, course and grade for academics — and Victor
strikes out what is wrong.

**Why.** Victor chose this over specifying fields from scratch. Starting from the vault means
the fields match the vocabulary already in use, so a logged erg piece and the PR table talk
about the same quantities.

**How to reverse.** Fields live in one schema module per category; changing them is a
migration, not a rewrite.

---

### D-038 · Voice input is worth building — Android confirmed

**Decision.** Quick-log screens get Web Speech API dictation.

**Why.** I had assumed iPhone and was ready to drop this: Safari on iOS has no Web Speech
API, and the iOS keyboard's own dictation button already covers every text field for free.
Victor logs from Android/Chrome, where the API exists. About an hour of work.

**How to reverse.** Feature-detect and fall back to a plain field — which is also what any
future iPhone would get.

---

### D-037 · Everything actionable is one task model

**Decision.** Sprint goals, the academic tracker, daily to-dos, and Canvas assignments become
rows in one `tasks` table, each with a source and a due date. The homepage filters to today
and this week.

**Why.** V2 was about to ship a fourth place to look for "what should I be doing". Victor
named "too complex to use" as the thing that would make him abandon the project, so four
competing lists is not a style question, it is the failure mode. Nothing is deleted: sprint
goals become tasks tagged as goals, tracker items become tasks with a course.

**Cost.** This partly supersedes D-032, which put tracker items in `current_sprint.md`. Those
rows move to Postgres. The markdown tracker section stays readable but stops being the
editable source.

**How to reverse.** The task source column makes the origin of every row recoverable, so
splitting them back out is a query, not an archaeology exercise.

---

### D-036 · High-frequency writes go to Postgres, not the vault

**Decision.** Anything logged often — daily entries, tasks, workouts — is written to Postgres
and saved immediately. The vault keeps prose that is written rarely and read by AI agents.

**Why.** Finding F2: every vault write is a commit and a deploy, so ticking three boxes was
three commits, three builds, and a plausible route to Vercel's Hobby ceiling. Victor asked
for immediate saves (Q77) and accepted logs living outside the vault (Q76).

**The tension, stated.** Victor also wants the site to create vault files (Q80), which can
never be instant — a GitHub round trip is 1–2 seconds. Resolution: two visibly different
actions. Logging is silent and instant; writing to the vault shows a publishing state,
because it is editing the permanent record.

**Deferred.** Syncing Postgres logs back into vault summaries is V3 by Victor's own call
(Q76).

**How to reverse.** The vault write path is untouched and still used for prose, so reverting
means pointing the log actions back at it and accepting the commit-per-save cost again.

---

## 2026-08-21

### D-035 · Checklist editing lives in its own module, not in `frontmatter.ts`

**Decision.** `lib/vault/checklist.ts` holds the `- [ ]` item reader and writers.
`frontmatter.ts` stays about frontmatter and generic section edits.

**Why.** Checklists are one markdown convention, not a property of every vault file. Keeping
them apart means `frontmatter.ts` does not grow a second vocabulary. Both modules repeat the
same two guards on purpose — `\r?\n` for CRLF files, `(?![\s\S])` rather than `$` for
end-of-input — and each has its own tests for them.

**How to reverse.** Merge the file back; nothing else depends on the split.

---

### D-034 · The Calendar page has no calendar

**Decision.** `/private/calendar` states plainly that live sync is out of scope for V1 and
shows the operating rules from the sprint file instead.

**Why.** Google Calendar reads need an OAuth consent screen Google must review before it
works beyond a test account, plus refresh-token storage and rotation. That is days of work
for a read-only view of an app already open in another tab, and it would be the only part of
2ndMind that can lock itself out without warning. A page that says so is more useful than a
page pretending to be finished.

**How to reverse.** V2 candidate. If it happens, an `.ics` subscription URL is a fraction of
the work of OAuth and covers reading.

---

### D-033 · The Work page is not an application tracker

**Decision.** `/private/work` renders pipeline strategy and career targets. It does not log
or count applications.

**Why.** `internship_pipeline.md` records that a background script already scans Gmail and
maintains a master Google Sheet, and explicitly asks AI assistants to leave that data entry
alone. A second tracker would be a competing source of truth for facts the sheet already
owns — the exact failure this vault exists to prevent.

**How to reverse.** If the sheet is ever retired, this is where its replacement goes.

---

### D-032 · The academic tracker edits the sprint file in place

**Decision.** Tracker items are `- [ ]` rows under `## 3. Academic Tracker` in
`current_sprint.md`. Adding, ticking, and removing each commit that one file. Adding reuses a
blank placeholder row before appending.

**Why.** The tracker already existed there as prose. Moving it to Postgres would split "what
am I working on" across two stores; keeping it in markdown means it still reads correctly
with no site at all, which is the property that makes this a vault and not an app.

A test reads the **real** `current_sprint.md` and asserts the section is found and everything
outside it stays byte-identical, so renaming or re-numbering the heading fails loudly in CI
instead of silently doing nothing in the UI.

**How to reverse.** Point the actions at a different file and heading; the pure functions
take both as parameters.

---

### D-031 · Athletics degrades to an explanation when `DATABASE_URL` is absent

**Decision.** `/private/athletics` renders a short "no database connected" page rather than
throwing. `isDatabaseConfigured()` is a separate function from `db()`.

**Why.** The same shape as D-021, applied before it could bite: the page someone opens to
find out why athletics is broken must not be the page that crashes on it. Verified by
loading the route with the variable unset — 200, self-explaining — and again with the
variable set but the tables missing, which renders the migration hint.

**How to reverse.** Delete `isDatabaseConfigured` and let `db()` throw.

---

### D-030 · Estimated 1RM is capped at 12 reps

**Decision.** `estimateOneRepMax` returns null above 12 reps rather than extrapolating.

**Why.** Epley drifts badly at high rep counts. Uncapped, a set of 20 light reps outranks a
genuine heavy single and sits at the top of the strength board forever — a wrong number that
looks plausible, which is the worst kind.

**How to reverse.** Raise or remove `E1RM_REP_CAP` in `lib/athletics/prs.ts`. A different
formula (Brzycki, Lombardi) would be a better fix than a higher cap.

---

### D-029 · Warmup sets are stored but never ranked

**Decision.** Every set from an import is written, including warmups; `isWorkingSet()`
excludes `warmup` and `drop` from records.

**Why.** Throwing them away at import would be lossy and irreversible — session volume and
history would be wrong forever. Counting them toward a PR would be wrong in the other
direction, and a single mistyped warmup would set a permanent fake record.

**How to reverse.** Change `isWorkingSet` to return true. The data is all still there.

---

### D-028 · The database layer is tested against real Postgres, in WASM

**Decision.** `@electric-sql/pglite` (dev dependency) runs the committed migration SQL and
the real queries in the test suite. Query functions take the handle as a parameter so the
same code runs on PGlite and on Neon.

**Why.** A mocked query builder asserts that the code called the mock, which is worth very
little — it would have accepted the numeric-as-string bug in D-027 without complaint. This
costs nothing, needs no server, and runs offline, which matters for the Taiwan trip.

**Cost.** About 17 seconds of the suite, from spinning up a fresh database per test.

**How to reverse.** Drop the dependency and delete `athletics/__tests__/queries.test.ts`.
Keep the parameter-passing shape regardless; it is good design independent of testing.

---

### D-027 · Numeric columns are declared `mode: "number"`

**Decision.** `numeric("weight_lbs", { …, mode: "number" })` on every numeric column.

**Why.** Postgres `numeric` arrives as a *string* by default in node-postgres, to protect
precision. Under string comparison `"95" > "155"` is true, so a warmup would outrank every
working set and every PR would be quietly wrong. A test asserts `typeof` is number and that
the max of a real stored session is 155.

**How to reverse.** Drop the mode and convert at each call site — but then every comparison
becomes a place to forget.

---

### D-026 · Imports are idempotent through a derived `external_id`

**Decision.** Each imported session gets `hevy:<ISO timestamp>:<title-slug>`, uniquely
indexed. Sets are written only for workouts the insert actually created.

**Why.** A Hevy export is cumulative — every export contains the entire history — so the
natural workflow is re-importing a growing file. Without this, the second import doubles
everything, and the damage shows up only as inflated PRs and volume, with no error anywhere.
The second half matters as much as the first: skipping the workout row but still appending
its sets would duplicate the sets against the original session.

Manual entries leave `external_id` null, and Postgres treats nulls as distinct in a unique
index, so hand-logged sessions never collide.

**How to reverse.** Drop the unique index. Do not, unless imports become one-shot.

---

### D-025 · Personal records are computed on read, never stored

**Decision.** No `records` table. `strengthRecords()` and `ergRecords()` run over every
stored set on each page load.

**Why.** A stored record is a cached answer with no invalidation story: correct a mistyped
weight and the PR keeps reading high forever, silently. At this scale — a few thousand sets
— recomputing is free.

**How to reverse.** Add a materialised table if the set count ever makes this slow. It will
not at one athlete's volume.

---

### D-024 · Training data lives in Postgres, not in the markdown vault

**Decision.** Athletics is the one feature backed by a database (Neon free tier).

**Why.** Everything else in 2ndMind is prose that a human writes and reads. Training data is
tabular and queried *across* rows — "best set of Bench Press at five reps" is a group-by. A
Hevy export is thousands of set rows, which no markdown file should hold. The rest of the
site is unaffected and builds without `DATABASE_URL`.

**Privacy.** Health data is the category that must never be public. No public route imports
`lib/db` or `lib/athletics`, and the public build runs with no database configured at all.

**How to reverse.** Nothing else depends on it; delete the routes, the two lib folders, and
the dependency. The vault's `benchmarks_and_logs.md` remains the hand-written record.

---

### D-023 · `outputFileTracingRoot` is what puts the vault in the serverless bundle

**Decision.** `next.config.ts` sets `outputFileTracingRoot` to the repo root and excludes
`context/99_archive/**`. It sets no `outputFileTracingIncludes`.

**Why.** Measured rather than assumed, because the first version of this config was wrong in
two ways. With no config, **zero** vault markdown files are traced into `/private` — the
freshness widget would have thrown ENOENT in production while working perfectly locally.
Widening the root alone fixes it: Next's analysis of the `readdirSync` in `vault/load.ts`
then pulls the tree in by itself, making the `includes` entries redundant. And an explicit
`include` *beats* an `exclude`, so adding one made the 10 archive files impossible to leave
behind — the build kept shipping superseded resumes and transcripts into the function.

**How to reverse.** Remove both keys and the freshness panel loses its data source in
production only, which is the hardest kind of regression to notice. Verify any change by
reading `.next/server/app/private/page.js.nft.json` and counting traced `.md` files: 34 is
correct, 44 means the archive came along, 0 means it is broken.

---

### D-022 · The freshness audit reads the filesystem, narrowing D-019

**Decision.** `loadFreshness()` walks `context/` on disk. D-019's rule — private pages read
the vault over the GitHub API — still holds for every *editable* file.

**Why.** Freshness inspects 34 files to read one frontmatter field from each. Over the API
that is 34 round trips per dashboard render, against a rate limit, to compute something that
changes once a day.

**Cost, stated plainly.** After a write through the site, the panel shows the pre-edit date
until Vercel redeploys. That self-corrects in a couple of minutes, because a vault write is
a commit and a commit triggers a deploy — but it is a real window where the dashboard and
the vault disagree.

**How to reverse.** Swap `readVaultFiles()` for API reads, and add caching, or the dashboard
becomes unusably slow.

---

### D-020 · Vault writes validate the path before anything else

**Decision.** `assertVaultPath` rejects traversal, backslashes, non-`context/` prefixes, and
non-`.md` files — in that order.

**Why.** A fine-grained PAT with "Contents: read and write" covers **every file in the repo**,
not just the vault. That includes `web/` and `.github/workflows/`. Path validation is the only
thing between a bug in a form handler and an arbitrary repo write, including a workflow file
that would then run with the repo's own permissions. Shape is checked before prefix so a
backslash path reports as traversal rather than as "outside the vault", which would point at
the wrong defect.

**How to reverse.** Don't.

### D-021 · A misconfigured deployment explains itself instead of crashing

**Decision.** `isAuthConfigured()` is separate from `getSession()`, and `/signin` renders a
"Not configured" notice rather than throwing.

**Why.** Found by probing the live deploy: with `SESSION_SECRET` unset, `/signin` returned
**500**. The sign-in page is exactly where someone looks when auth is broken, so it was the
one page that must not be the page that crashes. `/private` was already failing closed
correctly; only the explanation was missing.

**How to reverse.** Don't — but note the rule it encodes: auth failures fail closed, and
configuration failures stay legible.

### D-019 · Private pages read the vault over the API, not the filesystem

**Decision.** `/private/*` fetches vault files through the GitHub Contents API even though
the repo is checked out beside the app.

**Why.** Two reasons. Vercel's runtime filesystem contains only what the build traced, and
dynamically-constructed paths are not traced — so `fs.readFileSync` would work locally and
404 in production. And after a write, the local copy is stale by definition; the API is the
thing that just changed.

**Cost.** Every private page load is a network round trip. Acceptable for one user; if it
ever isn't, cache per-request rather than reverting to the filesystem.

### D-018 · Passkey auth with no database

**Decision.** The enrolled credential lives in two environment variables
(`PASSKEY_CREDENTIAL_ID`, `PASSKEY_PUBLIC_KEY`). Sessions are HMAC-signed cookies built on
Web Crypto. There is no user table and no auth vendor.

> **Amended by D-098 (2026-08-25):** the account is now a *list* — `PASSKEYS`, one
> `label:credentialId:publicKey` entry per device — so more than one device can be signed in.
> The two variables named here are still read as a single unlabelled credential. What this entry
> got right is unchanged and is the reason the amendment was cheap: no database, no vendor,
> credentials in the environment.

**Why.** Following D-006 (Clerk gates passkeys behind $20-25/mo). With exactly one user, the
stored values are not secret — the private key never leaves the authenticator — so a database
buys nothing here. Web Crypto rather than a JWT library because `proxy.ts` may run on an edge
runtime with no Node `crypto`, and an HMAC over JSON is the whole requirement.

**What this design gives up.** Signature counters, which detect a cloned authenticator, need
somewhere to persist. Platform passkeys (Touch ID, Windows Hello) report counter 0 and never
increment, so there is nothing to compare — which is the only reason this works. **A hardware
key that does increment would need real storage.** Rotating or adding a device means
re-running enrolment and pasting new values into Vercel.

**Enrolment is closed by default.** `PASSKEY_REGISTRATION_SECRET` must be both set and
supplied. An open registration endpoint on a deployment with no credential configured would
hand the private site to whoever found it first.

**Enrolment is a page, not a script.** `/signin/register` runs the ceremony through
`@simplewebauthn/browser`. The first draft of this was a console snippet in a markdown file;
that was fragile enough to be a bad answer, and hand-rolling base64url in a copy-pasted
script is exactly where this goes wrong silently. The page 404s when the gate is shut.

**No recovery flow, deliberately.** Lose the device and you re-open the gate and re-enrol.
Since Victor controls the environment variables, that path is always available to him and to
nobody else — which is a better property than any recovery mechanism a single-user app could
offer. Written up in `REGISTER_PASSKEY.md`.

**How to reverse.** Move the credential into Neon (`DATABASE_URL` already exists for
athletics) and store the counter alongside it. The ceremony code does not change.

### D-017 · The resume is generated from the vault, in two languages

**Decision.** `/resume/[variant]` renders from `web/src/lib/resume.ts`; `99_archive/resume.md`
is written by `scripts/build_indexes.py`. Both select entries by each entry's own
`resume_variants` field. A test asserts the two agree.

**Why.** Victor asked for a genuinely generated resume, not a maintained document — bullets
already live in canonical entries and a hand-written copy guarantees drift. The vault must
also stay readable without running the web app, which is why the Python copy exists at all.
The duplication is the cost of that, and the drift test is what makes it safe.

**How to reverse.** Delete `build_resume` from `build_indexes.py` and the
"archived copy agrees with the site" describe block. The site is unaffected.

### D-016 · Print styling, not a PDF library

**Decision.** The PDF comes from the browser's own print dialog, driven by an `@media print`
block. No PDF generation dependency.

**Why.** $0 budget, and browser "Save as PDF" produces **selectable text** — which is what
resume parsers read. A rasterised dark-theme screenshot would be unparseable by the ATS
systems these applications go through. Victor also said he would export the PDF manually.

**Consequences worth knowing.** Everything themed is forced to near-black; muted greys that
read well on `#0a161b` print as illegible haze, so they are darkened to `#333`. Links print
without underlines because the URLs are already spelled out in the contact line.
`.resume-block` sets `break-inside: avoid` so a bullet list is never orphaned from its job
title across a page boundary.

**How to reverse.** Delete the `@media print` block in `globals.css`.

### D-015 · RLC lab dropped from the robotics resume variant

**Decision.** `labs/rlc.md` had `resume_variants: [robotics]`; now `[]`.

**Why.** Consistency with D-014. Having argued that assigned coursework is padding on the
portfolio, leaving it on the resume would be incoherent — and the solenoid project already
covers ESP32 instrumentation, better and with a self-directed result.

**How to reverse.** Put `robotics` back in that file's `resume_variants` and rerun
`python scripts/build_indexes.py`.

### D-014 · Labs cut to one entry, promoted to a project

**Decision.** Four of the five Physics 4BL labs (optics, RLC, sound, resistor/LED) are now
`public: false`. The solenoid bit reader moved to `01_engineering/projects/` as a hardware
project. The `/labs` route and its nav entry are gone.

**Why.** Victor's read was right. Those four are *assigned coursework* — every student in the
course measures an I-V curve and the speed of sound. They demonstrate compliance, not
capability, and on a portfolio they dilute the work that does differentiate. The solenoid lab
is categorically different: a self-directed macro-scale hard-disk-reader analog, 387-turn
coil, op-amp gain staging, calibration matrix, 100% decode accuracy. That is a build, and it
belongs next to the other builds rather than filed under coursework.

A `/labs` index holding one item also reads as an abandoned section, which is worse than no
section.

**How to reverse.** Flip `public: true` on the four lab files, restore `web/src/app/labs/`
from git history (`git show 2699a2a:web/src/app/labs/page.tsx`), and re-add the nav entry in
`site-header.tsx`. The lab entries were never deleted from the vault, so nothing is lost.

**Note.** The four labs stay in the vault deliberately — they are real academic history and
useful context for any AI reading the vault. Only their *publication* changed.

### D-013 · Projects carry a hero image, with a generated placeholder fallback

**Decision.** `image` is an optional project frontmatter field. When absent, `ProjectFigure`
renders a deterministic SVG placeholder derived from the project slug rather than a grey box.

**Why.** Victor has no photography yet but will. A placeholder that is on-palette and varies
per project keeps the grid looking designed in the meantime, and dropping a real file in later
is a one-line frontmatter change with no component edit.

**How to reverse.** Delete the `image` field and render nothing; the grid falls back to the
text-only cards from commit `2699a2a`.

### D-012 · The card sweep loops while hovered

**Decision.** `card-scan`'s highlight sweep repeats on a 2.4s cycle (sweep, then pause)
instead of firing once.

**Why.** Two reasons, one of them a bug fix. The one-shot version ended with the highlight
*parked over the card*: the animation had no fill mode, so on completion the transform
reverted to its base value and left a bright static band sitting on the left of every hovered
card. The keyframes also only travelled to 120% of the bar's own width — about 54% of the
card — so it never actually exited. Base transform now rests off-card and the travel is
260%. Looping is also the thematically right behaviour: a scope refreshes continuously.

**How to reverse.** Drop `infinite` from the animation shorthand in `globals.css` and keep
the corrected keyframes and base transform — those are the bug fix and should not be reverted
independently.

---

## 2026-08-20

### D-011 · Breadth content is its own vault entity, not a projection of the training logs

**Decision.** `context/03_craft_and_creative/pursuits/` holds the portfolio framing of dragon
boat, fabrication, and baking. The public build never reads `benchmarks_and_logs.md` or
`culinary_formulas.md`.

**Why.** Those files hold bodyweight, protein and creatine targets, and a lower-back rehab
protocol. Victor is comfortable storing health data in the cloud; that is not the same as
publishing it to recruiters. A separate entity means the risk is structurally absent rather
than mitigated by an allowlist that someone has to maintain correctly forever.

**How to reverse.** Not recommended. If the breadth section is cut entirely, delete the
`pursuits/` directory, `pursuitSchema`, `loadPursuits`, `publicPursuits`, and the section in
`page.tsx`.

### D-010 · Collaborator names are never published; group size is

**Decision.** `collaborators` is excluded from the public lab projection. The site shows
"N-person group lab" instead.

**Why.** Victor asked for the names to come off. Beyond that, they are private individuals
who did not agree to appear on a public portfolio. Group size stays because silently
presenting group work as solo misrepresents it to exactly the audience the site is for.

**How to reverse.** Add `collaborators` back to `PublicLab`, `toPublicLab`, and
`PUBLIC_LAB_KEYS`, and delete the privacy test in `public.test.ts`. The names were never
removed from frontmatter.

### D-009 · `## Notes` sections are stripped from every public body

**Decision.** `stripInternalSections()` removes the vault's `## Notes` convention from
project, experience, and lab bodies before rendering.

**Why.** Those sections hold relative links into `99_archive` and notes-to-self about
frontmatter. Bodies render verbatim on public pages, so they were being published. Handling
it at the projection layer rather than per-file means the next entry added is covered without
anyone remembering to.

**How to reverse.** Delete the call sites; the function is pure and independently tested.

### D-008 · Palette replaced with Victor's six swatches

**Decision.** Gold/warm-near-black is gone. Teal `#09A1A1` primary, rose `#D396A6`
secondary, peach `#F6C992` as the single warm note, on grounds derived from `#30525C`.

**Why.** Victor supplied the palette and said the gold and the flat background were not to
taste. Only `#30525C` was dark enough to build grounds from, so the page and card colours are
that hue driven down in lightness — this keeps surfaces the same temperature as the accents
instead of fighting them.

**Resolved 2026-08-21.** The supplied image labelled a *pink* swatch `#30525C`, which is a
dark slate teal, so the hex codes were treated as authoritative over the swatch colours.
Victor confirmed the result: "I like the current palette, keep using what is currently
there." The palette is settled — do not reopen it without being asked.

**How to reverse.** `git show a81dee8:web/src/app/globals.css` has the gold palette intact.

### D-007 · The background is not a flat fill

**Decision.** `<html>` paints the base colour; `body::before` layers three drifting radial
pools and `body::after` adds SVG-noise grain.

**Why.** Victor asked for the solid background to go. The grain is not decoration — wide
radial fills band visibly on 8-bit displays, and noise dithers them out.

**Constraint this creates.** `body` must stay background-less. Giving it an opaque background
buries both layers, and the symptom (a flat page) looks like the CSS simply did not apply.

**How to reverse.** Delete the two pseudo-element rules and put `bg-background` back on
`body` in `layout.tsx`.

### D-006 · Auth is self-hosted WebAuthn, not Clerk

**Decision.** `@clerk/nextjs` removed; `@simplewebauthn/server` + `/browser` in.

**Why.** Clerk gates passkeys to its Pro tier at $20-25/mo — recurring, and far outside the
$0 (max $5) budget. There is exactly one user forever, which makes Clerk's real job
(multi-tenant identity, org management, arbitrary sign-up flows) pure overhead.

**How to reverse.** Reinstall `@clerk/nextjs` and accept the subscription, or use Clerk's
free-tier email-code sign-in and give up passkeys.

### D-005 · Motion lives in two custom utilities, not repeated class chains

**Decision.** `card-scan` and `link-wipe` are `@utility` blocks in `globals.css`.

**Why.** The same hover treatment appears on five surfaces. As a Tailwind chain it was ~90
characters repeated per element, and changing the feel meant editing every one. Both collapse
under `prefers-reduced-motion` in one place.

**How to reverse.** Inline the CSS at each call site.

### D-004 · `SiteHeader` is a Client Component

**Decision.** It uses `usePathname` for the active-route indicator.

**Why.** The alternative is threading the pathname from every page. It receives only a name
string, so the RSC payload cost is negligible.

**How to reverse.** Drop the indicator and the `"use client"` directive.

---

## Earlier

### D-003 · Public projections name every field explicitly

Never spread-and-delete. A field added to the vault tomorrow is private by default, and
reaching a public page requires a deliberate edit plus a test update. **Do not "simplify"
this into a spread.** Two real leaks were caught by scanning built output, not by the type
system.

### D-002 · Fonts are self-hosted

`next/font/google` fetches at build time; a meaningful chunk of this project is written in a
car and on a plane. Files came from `@fontsource`.

### D-001 · Monorepo — `web/` inside the vault repo

Vault writes trigger public rebuilds, and other projects can clone and read `context/`
directly, which Victor asked for.

---

## Reversed

### D-094 · The canonical URL is `www` — **reversed 2026-08-25, same day**

Superseded by D-096 within hours, at Victor's request: he wants the bare `victorgusev.com`.

D-094 was not wrong so much as premature. It described how the domain had happened to be
connected — Vercel was serving `www` as primary — and promoted that accident to a decision
before anyone had been asked which they preferred. The lesson is narrow and worth keeping:
*a setting you discovered is not a decision you made.*

It never reached production. `NEXT_PUBLIC_SITE_URL` was unset the whole time it existed, so
the deployed site never advertised the `www` canonical it specified.

The original entry, for the record:

> ### D-094 · The canonical URL is `www`, because that is what is served
>
> **Decision.** The three `NEXT_PUBLIC_SITE_URL` fallbacks in `layout.tsx`, `robots.ts` and
> `sitemap.ts` are `https://www.victorgusev.com`.
>
> **Why.** Vercel is serving `www` as primary and redirecting the apex to it. Canonical URLs,
> the sitemap and Open Graph metadata should name the origin that actually answers, or every
> indexed URL is a redirect hop.
>
> These are *fallbacks*: the environment variable still wins, and setting it in Vercel is what
> actually moves the deployed site. They matter because the fallback is what runs when the
> variable is missing — which is exactly the state the production deployment was in.
>
> **How to reverse.** If the apex is made primary in Vercel instead, change these three strings
> and `NEXT_PUBLIC_SITE_URL` together. Thanks to D-095 the passkey survives that change; nothing
> else does automatically.
