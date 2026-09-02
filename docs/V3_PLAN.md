# 2ndMind — V3: the phone

**Rewritten 2026-08-30 · Replaces the 2026-08-25 draft · Ends ~2027-01-03**

V3 was a list of three additive features written against a budget of 4h/week and no deadline.
That document is superseded. Victor's allocation changed to **~2h/day through travel, 6h/day
until term, then ~7h/week**, and the goal changed with it: **2ndMind becomes an app on a
Samsung phone that works with no internet connection and re-syncs when it reconnects.**

The three old items are not deleted. Two of them survive, one is dropped, and §6 records why.

Scope was settled by 44 questions on 2026-08-30. Every answer is in §2. Where an answer
contradicts something already built or already written down, §2 says so and names the entry.

---

## 0. TLDR

| | |
|---|---|
| **Goal** | An installable, offline-first PWA. Log without signal, read without signal, show the portfolio without signal, sync on reconnect. |
| **Delivery** | PWA installed to the home screen. Not Capacitor, not React Native. |
| **Budget** | ~187h across 18h travel + 66h pre-term + ~104h term-time |
| **Milestone A** | **2026-09-18** — installed, logs offline, syncs. The hard date. |
| **Milestone D** | **~2027-01-03** — everything. Not a hard date. |
| **Done when** | The app is on the home screen and two real weeks pass without reaching for the laptop to log. |
| **Biggest risk** | Phase 1 is 65h of work in a 66h window. Named in §7. |

---

## 1. The shape of the time

| Window | Dates | Rate | Hours |
|---|---|---|---:|
| In transit | 2026-08-30 → 09-07 | ~2h/day, partial connection | 18 |
| Pre-term burst | 2026-09-08 → 09-18 | 6h/day | 66 |
| Move-in | 2026-09-19 | — | 0 |
| Fall term | 2026-09-20 → ~2027-01-03 | ~7h/week, taken flexibly | ~104 |
| | | **Total** | **~188** |

Three consequences, stated before the list because they shape every item in it.

**1. The pre-term burst is the whole app.** 66h is the only block in this plan large enough to
build a sync engine. A sync engine assembled in 60-minute term-time fragments will be wrong in
ways that lose data. Everything that must be *correct* lives in Phase 1; everything that must
merely be *nice* lives after it.

**2. Term-time hours are taken in blocks, not daily.** Victor chose ~7h/week flexibly over
1h/day. That is the right call for this work and it is why Phases 2–5 are sized in whole
features rather than in evenings.

**3. The end date grew during sizing, and that is the point.** The first estimate was 173h
ending mid-December. Sizing it item by item produced 187h ending ~2027-01-03. A 14h drift
appeared in one afternoon of closer reading, on a plan nobody has started yet. Every estimate
in this project that was later checked was wrong in a way that mattered — 1.33 pages, 791px, a
retired model. Treat the end date as a direction, and Milestone A as the only real date.

### Travel constraint

Phase 0 runs on partial connection. **Every new dependency installs in one pass, on the first
available connection** (§3.0.1). This is the same reason fonts are self-hosted: a build that
needs the network is a build that fails on a plane.

---

## 2. What was decided, and what it contradicts

44 questions, 2026-08-30. Grouped by what they settle.

### 2.1 · Delivery and platform

| Question | Answer | Consequence |
|---|---|---|
| How does it reach the phone? | **PWA, installed to home screen** | One codebase. No Android toolchain, no APK signing, no Play Store, no Digital Asset Links. $0. |
| Which device? | **Galaxy S-series** | `shots.mjs`'s 360px floor is already correct. No new widths, no fold event to survive. |
| Home-screen identity | **"2ndMind" + custom icon** | Its own mark, distinct from the portfolio. Maskable variants so Samsung's launcher does not crop it. |
| Native widget? | **No** | A PWA cannot publish an Android home-screen widget. Icon long-press shortcuts are the honest substitute. |
| Share target? | **Not selected** | Deferred. Would have pre-filled an Applications entry from a shared job posting. Recorded in §8. |

**What this rules out, permanently, within V3:** background sync that survives Samsung's
battery optimizer with a guarantee, a Play Store listing, native gesture physics, and a real
widget. All four were on the table and all four were traded for one codebase.

### 2.2 · Offline

| Question | Answer |
|---|---|
| What works with zero signal? | **Log + read cached.** Writes queue; reads serve the last sync. |
| Which private screens cache? | **Today, Athletics, Academics + Calendar.** Not Work. |
| Browse the raw vault on the phone? | **No** — only what the existing pages already render. |
| Public site offline? | **Everything public**, including all three resume variants and `/now`. |
| How much history? | **Everything, forever.** Under 50MB for years with one user. |
| Sensitive data at rest? | **Cache all of it, biometric-gated.** |
| Search? | **Full-text, offline.** No embeddings. |
| AI panels offline? | **Show the last stored summary**, with its date attached. |

`Work` was not selected for caching, and that is coherent: `Tailor` needs a model call and
cannot work offline at all, so caching half the page would advertise a capability that is not
there.

### 2.3 · Sync

| Question | Answer |
|---|---|
| Conflict model | **Last-write-wins** on edits and deletes |
| Creates | **Client-generated UUID** — a retried create is a no-op, not a duplicate |
| Failed sync | **Hold + notify.** Nothing is discarded. One screen to inspect, fix, retry. |
| Stale outbox | **Escalating warning** once entries are more than a day old |
| Code updates | **Download in background, toast to reload** |
| Test bar | **The database layer's bar** — real fake-IndexedDB, real outbox code |

**On the create/edit split.** Victor first chose last-write-wins for everything. That conflicts
with holding and retrying a failed write: without an idempotency key, a retry after a partial
failure creates a duplicate row. D-026 settled the identical problem for Hevy imports with a
derived `external_id`. The objection was raised, and the resolution — client UUIDs on creates,
LWW on edits — was chosen deliberately. See **D-127**.

### 2.4 · Auth

| Question | Answer |
|---|---|
| Unlock when offline | **Device biometric** |
| Mechanism | A WebAuthn assertion **verified locally** in the service worker against the cached credential public key |

This is cryptographically sound with no network: the public key is already on the device after
enrolment, and verifying an assertion against it is a local operation. It is not the same
security property as a server-side ceremony — a compromised device can be replayed against —
and that trade is accepted. See **D-128**.

### 2.5 · Logging

| Question | Answer |
|---|---|
| Mood / energy scale | **Yes, 1–5 on End of day** |
| Fast paths (one-handed, <15s) | **Training, Applications, Reading + People** |
| Voice | **Speak a whole entry → parsed → confirm before saving** |
| Photos | **V4.** Explicitly deferred, not forgotten. |
| Fastest entry point | **Icon long-press shortcuts** |

**The mood scale reverses a comment in the code.** `categories.ts` says: *"Deliberately no mood
or energy scale: Victor put that in V3, and a 1-5 filled in from habit rather than reflection is
worse than nothing."* He wants it anyway, for the plottable series against training load. The
objection stands and is now recorded as a known cost rather than a blocker. See **D-134**.

**Voice is online-only.** "Speak a whole entry" needs a model call, so it does not work in the
basement gym that motivates the fast paths. That is why the typed fast paths (§3.1.6) ship in
Phase 1 and voice (§3.4.3) ships in Phase 4 — the offline case is served first, by the thing
that actually works offline.

### 2.6 · Visual and interaction

| Question | Answer |
|---|---|
| Redesign scope | **Adapt, don't redesign.** Palette, fonts and motion utilities survive. |
| Navigation | **Bottom tab bar.** Desktop nav **unchanged**. |
| Density | **Same density, better order** — D-083's fix applied to every screen |
| Motion | **Cut ambient drift on mobile.** Static gradient; purposeful transitions instead. |
| Gestures | **Swipe to complete/delete, pull to refresh, haptics on save** |
| Light mode | **Yes**, with a both-theme audit |

Cutting ambient drift narrows **D-007** ("the background is not a flat fill") rather than
reversing it: the three radial pools and the grain still render, they simply stop animating
below the mobile breakpoint. Same screenshot, no ongoing GPU compositing. See **D-133**.

### 2.7 · Privacy

| Question | Answer |
|---|---|
| Handing the phone over to show the portfolio | **Accept the risk** — no "show" mode, no second install |

This is the one answer worth restating plainly, because it is a decision to accept an exposure
rather than a decision to build something. The whole public site is precached inside the
private app. Handing someone the phone to look at your projects puts your GPA, bodyweight, and
application pipeline one back-swipe away. A locked portfolio-only mode was offered at ~4h and
declined; two separate installs were offered and declined. **D-130** records it so that
reversing it later is a lookup.

### 2.8 · Process

| Question | Answer |
|---|---|
| Formatter | **Prettier** — closes the open `DECISION NEEDED` in `web/context.md` |
| Error aggregation | **Scheduled in V3**, reversing the old plan's deferral |
| Device testing | **Both** — automated offline tests *and* a manual USB checklist |
| Overload | **Keep full scope, extend the timeline.** Nothing cut. |
| Done when | **Installed + two weeks of use without reaching for the laptop** |

---

## 3. The build

Five phases. Ordered, and only Milestone A is date-locked.

---

### Phase 0 · In transit — 2026-08-30 → 09-07 — **18h**

Design and offline-safe work at ~2h/day on partial connection. Nothing here needs a deploy.

> **Phase 0 complete · 2026-08-30 — 18h of 18h.** All six items done, gates green: 590 tests,
> typecheck and lint clean, `npm run shots` passing at four widths, and a production build
> verified rather than a dev server.
>
> Two things came out of it that were not on the list. The sync design found three schema
> problems on paper (§0.3), each of which would otherwise have been a migration discovered
> mid-Phase-1. And the tab bar found a real Tailwind fault (**D-143**) — plus a near-miss where
> a stale `next dev` almost got a fault recorded that does not exist.
>
> **Phase 0 is closed.** The icon was installed on the Samsung on 08-30: the manifest, the
> install prompt and the launcher tile all worked, and the shape was redrawn from a top view to
> a side profile off the back of seeing it there (**D-145**). Nothing is carried forward.
>
> **Next: Phase 1 opens on 09-08.**

#### 0.1 · Install every dependency in one pass — **1h** — ✅ **DONE 2026-08-30**

`prettier`, `prettier-plugin-tailwindcss`, `fake-indexeddb`, `idb`, `web-push`,
`@sentry/nextjs`. Everything else in Phase 0 assumes these are on disk.

Installed in three passes, exit 0, **103 packages added**. `@sentry/nextjs@10.72.0` resolved
cleanly against Next 16.3.1 — no `ERESOLVE`, no `--legacy-peer-deps`, which was the most likely
failure. Vulnerability count held at 4: the same dev-only `drizzle-kit`/esbuild advisories
already recorded under *Known accepted issues*, none new.

**Done when:** ~~`npm ci` succeeds from a cold cache with the network off.~~ ✅ Verified —
`npm ci --dry-run --offline` resolves the full tree from cache. A cold reinstall works on a plane.

**Not yet done, and deliberately:** Sentry is installed but not wired into `next.config.ts`. It
is inert until §2.4, and `npm run build` has not been run against it. No build risk either way,
but it has not been proven through a production build.

#### 0.2 · Prettier — **2h** — ✅ **DONE 2026-08-30**

Closes the standing `DECISION NEEDED` in `web/context.md`, open since V1. Config, one-shot format
pass, and a pre-commit hook. Doing it *before* V3's code lands means V3 ships formatted rather
than being reformatted later in a diff that buries real changes.

**Two config values deviate from Prettier's defaults, both measured rather than preferred**
(D-136):

| Value | Default | Chosen | Because |
|---|---|---|---|
| `printWidth` | 80 | **100** | Codebase p90 is 87, p99 104. At 80 the pass reflows 2,764 lines; at 100, 266. |
| `endOfLine` | `lf` | **`auto`** | `.gitattributes` is `eol=lf`, so Windows checks out CRLF. `lf` would pass here and fail `--check` on every fresh clone — blocking commits through the hook. |

**Result:** 91 files, **615 insertions / 620 deletions, net −5 lines**. Typecheck clean,
582/582 tests passing, vendored `ui/` untouched, CRLF preserved.

Scope is in `.prettierignore` and reasoned in **D-142**: vendored shadcn components, `drizzle/`,
and all markdown are excluded. The markdown exclusion is not squeamishness — `next dev` rewrites
`AGENTS.md`'s agent-rules block on every run, so formatting it makes the two tools fight forever.

The hook is `.githooks/pre-commit` with `core.hooksPath`, **not husky** — husky is a dependency
whose job is to copy a file, and git does that natively. All four paths tested: formatted passes,
unformatted blocks, ignored-file-only passes without a spurious error, vault-only commit
short-circuits.

**Done when:** ~~`npx prettier --check .` exits 0~~ ✅ verified, ~~and the format-only commit is
separate from every functional commit~~ — ⏸ **not committed.** The working tree holds the format
pass plus the V3 planning docs; `main` is the current branch. Committing is Victor's call, and
the format pass must land as its own commit before any V3 code.

**One thing found and not fixed:** `web/README.md` is still untouched `create-next-app`
boilerplate and claims the project uses Geist, which is false — the three faces are self-hosted
(D-002). Out of scope for §0.2. Recorded in §8.

#### 0.3 · Design the sync model, on paper — **3h** — ✅ **DONE 2026-08-30**

The outbox schema, the UUID scheme, the LWW tiebreak rule, the flush triggers, and the failure
states — argued before a line of it exists. The item most likely to be skipped and the one whose
absence costs the most: a sync bug found in November is a bug in code written in a hotel room in
September.

Full spec is **`docs/SYNC_DESIGN.md`**. The decision entries stayed decisions; the schemas,
algorithms and failure tables went into their own document rather than bloating a 133KB log.

**Reading the real schema changed the design in three ways the plan could not see:**

1. **Only four tables need a client id, not seven.** `bodyweight_entries`,
   `rehab_completions` and `ai_summaries` already have natural keys that make an offline create
   idempotent for free. The other four need one precisely because two identical rows are
   *legitimate* there — logging the same set twice in a session is real, so content cannot
   identify a row.
2. **`rehab_completions` cannot sync as built.** It toggles by insert-or-**hard delete**, and a
   hard delete leaves nothing to compare — un-tick on the phone versus tick on the laptop is
   undecidable. It needs a tombstone, as do three other tables.
3. **Almost nothing has an `updated_at`.** Every table has `created_at`; only two have
   `deleted_at`. Last-write-wins needs a modification time, so this is a **migration**, not a
   code change — and one that is far cheaper now than mid-Phase-1.

The clock is a **hybrid logical clock**, not `Date.now()`. The failure it prevents is concrete:
fly to Taiwan, the phone's wall clock jumps, and it wins every conflict for the rest of the day.

`SYNC_DESIGN.md` §10 is the direct input to §1.4 — six test cases were named in the plan, and
reading the schema added three more.

**Done when:** ~~D-127 through D-129 are written, and each names the failure it prevents.~~ ✅
All three carry a **Designed 2026-08-30** block naming what breaks without them.

**Open, and it halves §1.2's migration — see §8:** does the phone create `workouts` at all, or
only `log_entries` that a workout is derived from?

#### 0.4 · Mood and energy on End of day — **2h** — DONE 2026-08-30

A new `scale` field type in `categories.ts`, fixed at 1-5, plus the two fields. Everything
downstream - form, validation, summary line, search index - generates from that one array,
which is what D-039 promised.

**Anchored at the ends** (*wrecked ... great*, *empty ... wired*), which is the mitigation for
the standing objection rather than a withdrawal of it: a number with a word attached has to be
chosen, where a bare 1-5 gets tapped from habit.

Three things that were not in the plan:

- **Five tap targets, not a number input.** A decimal keypad to collect one digit out of five is
  three interactions where there should be one, in the least forgiving context in the app.
- **Out of range is dropped, not clamped.** A Server Action is a POST endpoint with a guessable
  id. Clamping a 9 to a 5 puts a point in the series nobody chose, and a fabricated point is
  worse than a missing one.
- **`readField` moved to `lib/log/form.ts`** so the range check is testable - a `"use server"`
  module may only export async functions, so it could not be reached where it lived.

**Done when:** ~~both fields save, appear in the timeline summary, and the existing 582 tests
still pass.~~ Done - **590 tests**, up from 582. One existing test asserted these fields'
*absence* and was inverted rather than deleted, so a silent disappearance still fails.

#### 0.5 · Bottom tab bar — **7h** — DONE 2026-08-30

Tabs are **Today - Train - [Log] - Next - More**. Victor picked Calendar ("Next") over
Academics: "what do I have next" is the on-the-move question, Academics is a sit-down page.
More holds Now, Academics, Work, Hobbies and sign-out in a bottom sheet.

**Measured result: the first task on a phone moved from 356px to 265px** - the mobile layout no
longer carries the scrolling nav row at all. D-083 took that number from 791px to 356px; this
takes another 91px off. Desktop is unaffected at 330px with its nav intact.

**The switch could not be written in Tailwind.** Both `hidden sm:flex` and `flex max-sm:hidden`
fail, in opposite directions, in a production build - see **D-143**, which is the more important
outcome of this item than the tab bar is.

**Done when:** ~~every private route is reachable in <=2 taps on a 360px viewport, the desktop
layout is byte-identical, and `npm run shots` passes at all four widths.~~ All three verified
against a production build at 360 / 390 / 768 / 1280.

#### 0.6 · Icon, splash, manifest — **3h** — DONE 2026-08-30

A brain **seen from the side**, magenta on near-black. `public/icons/brain.svg` is the source and
`scripts/render-icons.mjs` renders the PNGs with Playwright, which was already a dev dependency
- so this, like the rest of Phase 0, runs with the network off.

Drawn as a **silhouette with the folds cut out**, not as an outline: at 48px, thin strokes on a
dark field vanish into the background. Two variants, because Android crops a `maskable` icon to
a squircle and keeps ~80% - the maskable file is full-bleed with the mark at 58%, which looks
over-padded alone and correct once cropped.

There is no splash asset: Android composes it from `name`, `background_color` and the icon, both
colours taken from `globals.css` so the launch screen is continuous with the app.

The first version was a **top view** and it shipped that way. Installed on the phone it worked -
manifest, install prompt, launcher tile - but the shape read as a lumpy oval rather than as a
brain, because the outline people recognise is the profile one. Redrawn left-facing with
cerebellum and stem: **D-145**, which also records the three drawing rules that came out of
fixing it. Recognisability at a glance was always the goal here, not anatomy.

**Done when:** ~~the icon renders uncropped in a One UI launcher, checked on the real device.~~
Verified on the Samsung on 2026-08-30. Redrawn the same day off what that showed.

---

### Phase 1 · Pre-term burst — 2026-09-08 → 09-18 — **65h in a 66h window**

**This is the app.** 6h/day for 11 days. Everything correctness-critical is here because this
is the last contiguous block before term.

#### 1.1 · PWA shell — **8h** — DONE 2026-08-30 *(Phase 0 closed on day one, so this opened early)*

Manifest wired, service worker registered, install flow, and **update-in-background with a
reload toast**. The update path matters more than it looks: an offline app caches its own code
and can run a version that is weeks old. The toast never interrupts a half-written entry.

`src/lib/pwa/sw-template.js` is the worker's source; `scripts/build-sw.mjs` writes
`public/sw.js` from it on `predev`/`prebuild` with the **commit stamped in**. That stamp is the
load-bearing part and is why the update path works at all: a browser only re-installs a worker
when the script's bytes change, so without it every deploy that does not touch the worker ships
silently and the installed app keeps running old code. **D-146.**

**Two corrections to this item as written.**

1. *"Reload toast" is not a toast.* It does not auto-dismiss. An update notice that vanishes on
   a timer is one you can miss entirely while typing, which is the opposite of the requirement.
   It is a persistent bar with **Reload** and **Later**; "Later" postpones without losing the
   update, because the worker is still waiting on the next load.
2. *"Survives a cold start with the network off" did not belong here.* A cold offline start
   showing the **dashboard** needs three things this item does not own: a precached app shell
   (§2.1), local data (§1.2), and offline auth (§1.5). §1.1 alone can only guarantee that a cold
   offline start lands on the app rather than the browser's error page, which it does — on
   `/offline`, a public static page that says so plainly. The dashboard version of this
   criterion moves to **Milestone A**, where it always belonged.

**Done when:** ~~the app installs from Chrome on the Samsung, launches fullscreen with the
splash, survives a cold start with the network off, and a deployed change produces a reload
toast rather than a silent version skew.~~ Verified end to end in a real browser against a
production build - 9 checks, all passing: registers and claims the origin, precaches `/offline`
and nothing else, **no** prompt on a first install, offline navigation serves the offline page, a
changed build raises the prompt, Reload activates the waiting worker, and the new build is the
one then serving. Plus 18 unit tests. The device half - installs from Chrome, launches
fullscreen - is Victor's, and is the only part not machine-checkable.

#### 1.2 · The offline store — **14h** *(was briefly 19h — see below)*

Opens with a **migration**, not with code: `client_id` on the four tables that need it,
`updated_hlc` and `updated_at` everywhere, `deleted_at` on the four tables missing it, and a
shared `sync_seq` sequence bumped by a trigger. `docs/SYNC_DESIGN.md` §2–§4 is the spec.

Then the IndexedDB store mirroring those tables, plus the outbox. Client-generated UUIDs on
creates, LWW on edits, tiebroken by a hybrid logical clock — a phone whose clock jumps after a
flight must not silently win every conflict for the rest of the day.

**Sized at 19h for part of 2026-08-30, then back to 14h.** Full workout logging on the phone was
chosen, then reversed to log-only the same day. Worth recording because the excursion found
something: creating a workout offline means `workout_sets.workout_id` pointing at a `serial`
that does not exist yet, which needs the aggregate op in `SYNC_DESIGN.md` §4a. That design is
kept but not built. Log-only avoids it entirely — the Training log category already carries
exercise, weight, reps, distance, duration, SPM and RPE, so nothing about gym logging is lost,
and `workouts`/`workout_sets` become pull-only.

**Done when:** ~~an entry written with the radio off survives a force-quit and a reboot.~~
The migration and the client store landed 2026-08-31 and that case is a test. **660 tests**, up
from 611. What is *not* here and was never in this item: the flush, the batch endpoint and the
merge-on-pull are §1.3, so nothing is actually sent yet — the outbox fills and waits.

Three things the build found that the spec did not:

1. **A soft delete does not cascade.** `workout_sets` is `ON DELETE CASCADE` from `workouts`,
   which does nothing for a tombstone — a deleted session left its sets behind, still counting
   toward PRs.
2. **Filtering a LEFT JOIN's right-hand table in a `WHERE` turns it into an INNER JOIN**, which
   would have made a session whose sets were all deleted vanish from the list rather than show
   zero.
3. **`recordBodyweight` has to clear the tombstone on upsert.** The natural key means there is
   no second row to fall back on, so re-recording a deleted day would write the new weight into
   an invisible row and look like a silent failure.

Two places in `SYNC_DESIGN.md` had also gone stale when workouts were reverted to pull-only -
the §2 SQL block and §5's entity union both still listed them, while the prose above each was
already right. Corrected. **D-150.**

#### 1.3 · The sync engine — **12h**

A batch sync endpoint behind the existing session auth, and flush triggers: reconnect,
app foreground, and manual pull-to-refresh. Bidirectional — push the outbox, pull what changed.

**Done when:** ~~airplane mode → log three entries → reconnect → all three appear in Neon
exactly once, verified by row count, not by looking.~~ **Half closed 2026-08-31.** The three
entries case is a named test against real Postgres, checked by row count, including the retry
that follows a lost response. **700 tests**, up from 660. The HTTP boundary was checked against
a production build: 401 before any parsing, 405 on GET.

**The other half is still open, and deliberately.** The round trip against *Neon* was not run,
because it would write test rows into Victor's real log and — since §1.2 — there are no hard
deletes left to clean them up with. That is his to close on the phone, and it is in Section 8.

**A bug the tests found that would have been near-invisible.** `hasMore` compared the collected
rows against the returned ones, so when a *single* table was the one being truncated the two
were equal and it came back `false` with rows still waiting. The client only flushes again when
told there is more. The symptom would have been *"sync is slow sometimes"*, which is not a bug
report anyone can act on. Fixed by asking each table for `limit + 1`. **D-152.**

**One design change against `SYNC_DESIGN.md` §5.** There is no table of applied operation ids.
The stored HLC does the same job for free — stamps are unique per device and strictly
increasing, so equality *is* identity, and an op whose stamp matches the row's is a duplicate.

#### 1.4 · Sync tests at the database layer's bar — **8h**

The standard set by `@electric-sql/pglite`: real storage, real code, no mocks. Required cases —
reconnect mid-flush, partial failure, duplicate flush, clock skew, schema version skew, and a
create retried three times producing one row.

**Done when:** ~~each of those six is a named test that fails without its fix.~~
**Done 2026-09-01.** All six are in `web/src/lib/sync/__tests__/roundtrip.test.ts`, and each
was checked by *removing* its fix and watching the right test go red — not by reading the code
and agreeing with it.

**The audit was the deliverable, and it found a real bug.** Four of the six were already
covered by §1.2 and §1.3 and only needed naming. The fifth — clock skew — failed, and the
reason is worth writing down: `HlcClock.receive` had been written, documented and unit-tested
since §1.2, and **nothing on the live path ever called it.** The clock was monotonic but not
causal. A phone five minutes fast writes a row; the laptop pulls it; the laptop's next edit is
stamped five minutes *behind* what is stored, comes back `stale`, and is dropped — then the
next pull removes it from the screen too. No error on either device. Fixed by `absorbStamps`
in `engine.ts`. **D-153.**

Both bugs this phase have been in the *wiring*, not in either piece being wired — §1.3's
`hasMore` and now this one. The lesson is the same both times: `apply.test.ts` and
`engine.test.ts` each hold one half of sync still while testing the other, so neither can fail
the way sync actually fails. `roundtrip.test.ts` runs the real outbox against real Postgres
with nothing scripted in between except when the connection drops, and it is the only file
here that could have caught either.

**One known limit, deliberately left.** A peer more than ten minutes ahead is refused rather
than absorbed, so that one broken clock cannot poison this device permanently. While that peer
stays broken, edits made here to rows it wrote will keep coming back `stale`. That is the right
trade and it is still invisible — §1.7 should surface it.

**710 tests**, up from 700.

#### 1.5 · Local biometric unlock — **9h**

A WebAuthn assertion verified in the service worker against the cached credential public key.
No network. Enrolment still happens online against the server, unchanged.

**Done when:** ~~the app opens offline after a biometric, and refuses to open after a cancelled
one — both checked on the real device, since neither can be tested in Playwright.~~
**Built 2026-09-02; the device half is Victor's**, like §1.3's round trip. Both behaviours are
named tests — the gate withholds the page rather than covering it, and a cancelled prompt
leaves it withheld — and the gate itself was checked by removing it and watching five tests go
red. **761 tests**, up from 710.

**The service worker was the wrong place, and not by preference.** `navigator.credentials` is
`[Exposed=Window]`: a service worker has no `CredentialsContainer`, so the prompt cannot be
raised from one. What this section was really asking for is that the *verification* need no
server, and that is what was built — in the page, against a public key cached at the last
online sign-in. **D-154.**

**What it is and is not.** It is a display gate: the page's payload has already been sent and
§1.2's mirror is unencrypted in IndexedDB, so this defends against a phone handed over already
unlocked, not against someone with developer tools. The signature check still earns its place
over a boolean — a replayed assertion, another site's assertion, a stubbed
`navigator.credentials` and a bare tap without user verification all fail, each as its own
test signed by a real key pair. The data-gate version (encrypt the mirror under a `prf`-derived
key) is a much larger piece of work with a real hazard attached — lose the authenticator, lose
the data — and D-154 records why it was not taken now.

**Corrected 2026-09-03, after the phone said there was no biometric login.** The key was
cached only by the sign-in response — the one moment it is already in hand, and also a moment a
seven-day session may not reach for a week. An unarmed lock opens, so the symptom was an
absence with nothing to investigate. It now asks the server for the public halves the first time
it has signal, so **no fresh sign-in is needed** to arm it. **D-157.**

**Still Victor's to close, on the phone:** airplane mode → open the app → unlock with a
fingerprint; then again, cancelling the prompt, and confirm it stays shut.

#### 1.6 · Fast log paths — **8h**

Training, Applications, and Reading + People, each finishable one-handed in under 15 seconds.
Sticky last values, recent-exercise chips, correct numeric keypads, clipboard detection for the
Applications `link` field. Every field stays optional, per the rule already in `categories.ts`.

**Done when:** ~~each of the three is timed at under 15 seconds, one-handed, on the real phone,
and the timings are written down.~~ **Built 2026-09-02; the stopwatch is Victor's** — the whole
criterion is a measurement on a device, and no test can stand in for it. **808 tests**, up from
761. Each of the four claims was checked by breaking it and watching the right test go red.

**What was built.** Sticky values, recent-value chips, per-field keypads and a clipboard button
for the Applications `link` — all declared per field in `categories.ts`, none special-cased in
the form. **D-155.**

**The rule that governs it:** a value may come back on its own only if it is *context*. Sticky
covers `kind`, `action`, `effort`, `course`, `where`. **Never a measurement** — a stale weight
pre-filled and saved without looking is a number in the log that reads as measured, and the
log's value is entirely that its numbers can be trusted. That rule is one word per field and is
therefore asserted over every category rather than trusted.

**Measurements still come back, through a chip that prints them.** "Bench Press · 185 × 5" fills
all three. Same data the sticky rule forbids, and the difference is that it is a visible choice
about a number on the button rather than something that appeared while he was not looking.

**A bug fixed on the way past:** a failed save used to cost the entry as well. React blanks a
`<form action={fn}>` as soon as the action returns, success or not, so a save rejected for a
reason outside the form took the typing with it. It now puts back what was there.

**Still Victor's to close:** log one Training, one Applications and one Reading-or-People entry
one-handed on the phone, with a stopwatch, and write the three numbers into this section.

#### 1.7 · Failed sync — hold, surface, retry — **6h**

A stuck entry stays in the outbox with a persistent badge, one screen to inspect and fix it, and
an escalating warning past 24 hours. Nothing is ever discarded.

**Done when:** a deliberately malformed entry survives ten launches, stays visible, and syncs
after being corrected.

> ### ⚑ Milestone A — 2026-09-18
> **2ndMind is on the home screen. It logs with no signal and syncs on reconnect.**
> The only hard date in this plan.
>
> Now also carries the criterion moved out of §1.1: a **cold start with the network off opens
> on the dashboard**, not on the offline page. That needs the precached shell, the local store
> and offline auth all present, so it could never have been true at §1.1.

---

### Phase 2 · Term, first block — from 2026-09-20 — **28h**

Milestone B: nothing needs signal.

- **2.1 · Cached reads — 10h.** Today, Athletics, Academics + Calendar rendered from the local
  store. Every panel shows the sync time — a cached screen must read as cached.
- **2.2 · Public precache — 6h.** Every public route, all three resume variants including print
  layout, and `/now` with a visible "as of" date. This is `npm run freeze` (D-106) turned into a
  service-worker precache. *Done when: the portfolio and the resume render in airplane mode.*
- **2.3 · Offline full-text search — 6h.** Over logs and cached content, running locally. No
  embeddings, no model cost, no monthly bill. Semantic search stays cut for the fourth time.
- **2.4 · Error aggregation — 4h.** Sentry free tier with scrubbing rules for vault content.
  Reverses this plan's own deferral; see D-137.
- **2.5 · Device checklist — 2h.** USB remote debugging documented, plus a per-release manual
  list: install, airplane-mode log, reconnect, biometric, icon, thumb reach.

> ### ⚑ Milestone B — ~2026-10-18
> **Everything works with no signal, including showing the portfolio to a stranger.**

---

### Phase 3 · Term, second block — **31h**

Milestone C: it stops feeling like a website.

- **3.1 · Mobile layout and ordering pass — 10h.** D-083's fix applied to every private screen:
  actionable content first, reference and charts below.
- **3.2 · `shots.mjs` extension — 3h.** Report scroll depth to first actionable element on every
  private screen. Measurement over opinion — the rule that caught 791px and 1.33 pages.
- **3.3 · Gestures — 6h.** Swipe to complete/delete with an undo toast (`sonner` and soft-delete
  already exist), pull to refresh wired to the outbox flush, `navigator.vibrate` on save and a
  distinct pattern on sync failure.
- **3.4 · Motion — 3h.** Static gradient below the mobile breakpoint; sheet and save transitions
  added. Narrows D-007, does not reverse it.
- **3.5 · Icon long-press shortcuts — 2h.** "Log training", "Log application", "End of day",
  each straight into its form.
- **3.6 · AI offline — 2h.** Stored summaries (D-124) render with their date when offline.
- **3.7 · Playwright offline suite — 5h.** Drives the real service worker offline and back.
  Covers what 1.4 cannot: the browser's actual caching behaviour.

> ### ⚑ Milestone C — ~2026-11-15
> **It behaves like an Android app, and the layout is gated by measurement.**

---

### Phase 4 · Term, third block — **29h**

- **4.1 · Push notifications — 8h.** VAPID keys, subscription, and three triggers: stuck outbox,
  end-of-day reminder, calendar/assignment alerts. Note the third duplicates notifications
  Google Calendar and Canvas already send; if it becomes noise, it is one flag to disable.
- **4.2 · Light mode — 8h.** `:root` redefined, `.dark` already mirrors it, `next-themes` already
  installed. The work is the audit: every screen, both themes, and `npm run shots` in both.
- **4.3 · Voice, whole-entry — 8h.** "Bench press 185 for 5, RPE 8" → a filled Training form.
  **Always confirmed before saving** — an unreviewed transcription never writes.
  Shows an explicit offline state, because it cannot work offline.
- **4.4 · Upload your own resumes — 5h.** **Fallback** semantics: the generated resume shows
  where no upload exists. PDFs in `context/assets/resumes/`, served like images (V2 §7.3), and
  precached by 2.2. `/resume/[variant]` still resolves for a guessed URL.

---

### Phase 5 · Carried from the old plan — **16h**

- **5.1 · Filament and printers — 9h.** **Reorder-first layout**: spools sorted by how little is
  left, colour swatches prominent, low stock at the top. Printers are a secondary panel using
  Victor's own status vocabulary. Postgres, alongside the other mutable rows. *Blocked on the
  inventory in `docs/UPLOADS_NEEDED.md` §2.1–2.2.*
- **5.2 · Three-year course planner, desktop-only — 7h.** Whether the remaining requirements fit
  the remaining terms on a 3-year track to June 2028, built on the parsed `degree_audit.md`.
  Deliberately no mobile work: this is a sit-down activity, and its first real use is Winter
  enrollment.

> ### ⚑ Milestone D — ~2027-01-03
> **Full scope. Not a hard date.**

---

## 4. Ordered summary

| Phase | Block | Hours | Ends |
|---|---|---:|---|
| 0 | In transit — Prettier, sync design, nav, icon | 18 | 2026-09-07 |
| 1 | **The app** — PWA, store, sync, unlock, fast logs | 65 | **2026-09-18 ⚑A** |
| 2 | Offline everything — cached reads, portfolio, search, errors | 28 | ~2026-10-18 ⚑B |
| 3 | Feel — layout, gestures, motion, shortcuts, E2E | 31 | ~2026-11-15 ⚑C |
| 4 | Push, light mode, voice, resumes | 29 | ~2026-12-13 |
| 5 | Filament, course planner | 16 | ~2027-01-03 ⚑D |
| | **Total** | **187** | vs ~188 available |

---

## 5. What the old V3 plan said, and what happened to it

| Old item | Est. | Outcome |
|---|---:|---|
| §1.1 Upload your own resumes | 5h | **Kept** → 4.4. The blocking decision is answered: **fallback** (D-138). |
| §1.2 Filament and printer tracking | 9h | **Kept** → 5.1. The layout question is answered: **reorder-first** (D-139). Still blocked on inventory data. |
| §1.3 Edit the job sheet | 12h | **Dropped.** Not selected. The old plan's own gate — "use the read-only version for a month first" — expires ~2026-09-25, and its own note says the answer is probably a 3h "mark this rejected" button rather than a 12h Sheets integration. Revisit then, in V4. |
| Semantic search | 12h | **Cut a fourth time.** It cannot work offline — embedding a query needs an API call — so it is the one feature that would break the core premise. Offline full-text (2.3) replaces it. |
| Error aggregation | 4h | **Promoted into V3** → 2.4, reversing the old plan's deferral. See D-137. |
| Per-session revocation | 4h | Still recorded, still not scheduled. |
| In-browser photo upload | 4h | **Deferred to V4** at Victor's explicit request. |
| Vault-write markdown diff | 8h | Still unscheduled. V3 adds no model-driven markdown writer, so the trigger has not fired. |
| Octokit retry/throttle | 2h | Still unscheduled. |
| A separate "current work" list | 3h | Still unscheduled. |
| Vault write concurrency queue | — | Still over-engineering for one user. |

**The old plan's framing, quoted, because it aged badly:** *"V3 deliberately has no deadline…
a dated plan against that budget would be fiction."* The budget changed by roughly 4×, so
Milestone A is now a real date. The rest of the plan keeps the old framing and stays ordered
rather than scheduled.

---

## 6. What is deliberately not in V3

Recorded so "we decided not to" stays distinguishable from "we forgot".

| Item | Why not |
|---|---|
| Capacitor / native APK | Traded for one codebase. Revisit only if PWA background sync proves inadequate in practice. |
| Android home-screen widget | Impossible in a PWA. Needs the native path. |
| Share target (job posting → Applications entry) | Offered, not selected. ~3h, and it directly serves the 1+4 rule. Best candidate for the first V4 hour. |
| A locked "show my portfolio" mode | Offered at ~4h, declined. See D-130 and §7. |
| Photo capture and upload | Explicitly deferred to V4. |
| Offline markdown editing | Would need a merge story for prose. Read-only sidesteps it entirely. |
| Encrypted local cache | Declined in favour of the biometric gate. |
| Semantic search | Fourth cut. Incompatible with offline. |
| Editing the job sheet | Dropped from V3; revisit after a month of the read-only view. |

---

## 7. Risks, stated plainly

**1. Phase 1 is 65h of work in a 66h window.** One hour of slack across eleven days, on the most
technically demanding block in the project's history, against a hard date. V2 was planned with
34% slack and still needed four revisions. **This will slip.** The mitigation is ordering, not
optimism: 1.1 → 1.2 → 1.3 → 1.4 builds a working sync engine by roughly 09-14. If it slips, 1.6
(fast log paths) and 1.7 (retry UI) are what move to Phase 2 — the app is still installable and
still syncs, it is just slower to log into.

**2. Full scope was kept over the objection.** 187h against ~188h available is 100% utilisation
with zero slack. This was raised, and Victor's answer was to extend the timeline rather than cut.
That is a legitimate call and it is recorded here so the consequence — a date that moves rather
than a scope that shrinks — is not a surprise in November.

**3. The private app is one back-swipe from a stranger's hands.** §2.7. Accepted deliberately.

**4. A service worker fails invisibly.** This is why 2.4 is no longer optional. A failing
service worker on a Samsung produces no log anyone will ever read. D-085 — a retired model
404ing silently for an unknown length of time, found by chance — is the precedent, and a phone
is strictly worse than a server for this.

**5. Term-time estimates assume ~7h/week actually happens.** Against a 3-year fast track, 8–10
weekly study hours front-loaded to Monday and Tuesday, and dragon boat resuming at move-in. If
it turns out to be 4h/week, Milestone D lands in February and Phases 4–5 are the ones to
renegotiate — not Phases 2–3, which is where the offline promise is actually kept.

---

## 8. Blocked on Victor

Everything here needs a person, a device or a file. Nothing in it is waiting on code.

### Check these three, on the phone — they close three finished sections

| # | What to do | Closes |
|---|---|---|
| 1 | **The offline round trip.** Airplane mode → log three entries → reconnect → check all three are in Neon **once each**. §1.3 tests this against real Postgres, but the run against *Neon itself* was deliberately not made: it would write test rows into the real log, and since §1.2 there are no hard deletes left to clean them up with. | §1.3 |
| 2 | **Biometric unlock, twice.** Airplane mode → open the app → unlock with a fingerprint. Then again, **cancelling** the prompt, and confirm it stays shut. Since D-157 the lock arms itself the first time the phone has signal, so no fresh sign-in is needed. | §1.5 |
| 3 | **Time the three fast log paths**, one-handed, with a stopwatch: Training, Applications, and Reading or People. Write the three numbers into §1.6. Under 15 seconds each is the bar. | §1.6 |

### Then these, in no particular order

| # | What to do | Blocks |
|---|---|---|
| 4 | **Re-add the app to the home screen.** Android caches the old icon, so the emoji-shaped mark (D-151) will not appear until the shortcut is removed and re-added. | Nothing — cosmetic |
| 5 | **Filament and printer inventory** — `UPLOADS_NEEDED.md` §2.1–2.2. Plus the status vocabulary actually used. | §5.1 |
| 6 | **The resume PDFs themselves**, and which is the default for a bare "Resume" link. | §4.4 |
| 7 | **Fall 2026 classes in Google Calendar.** No code waits on this; the schedule appears on its own. | Phase 2 quality |
| 8 | **Confirm the goals editor has been used once**, so `/sprint-review` can be retired. | Housekeeping |

### Closed

| # | What | Closed |
|---|---|---|
| ~~0~~ | ~~**Commit the format pass.**~~ Landed on its own as `946c5f7`, ahead of any V3 code, so no feature diff carries the noise. | 2026-08-30 |
| ~~0~~ | ~~**Look at the icon on the phone.**~~ Installed from Chrome on the Samsung; install path and launcher tile both correct. The shape was wrong — top view, redrawn as a side profile (**D-145**), then again as the emoji (**D-151**). Worth keeping: the thing the device check caught was not the thing it was written to catch. Cropping and fold legibility were both fine, and the fault was the drawing itself — exactly the class of error a desktop screenshot lets you talk yourself past. | 2026-08-30 |
| ~~5~~ | ~~Does the phone create `workouts`, or only `log_entries`?~~ **Log entries only.** Answered "workouts too", reversed the same day. §1.2 is back to 14h and Phase 1 fits its window again. `SYNC_DESIGN.md` §11.1. | 2026-08-30 |

**Found while building, not scheduled:** `web/README.md` is still `create-next-app` boilerplate
and states the project uses Geist — false since D-002 put three self-hosted faces in
`src/app/fonts/`. It is the first file a stranger opens in the repo. ~20 minutes, nobody's
priority, recorded so it stays visible.

**Enable the hook once per clone** — git ignores a hooks directory until told to use it:

```bash
git config core.hooksPath .githooks
```

---

## 9. Rules carried forward

Unchanged from V2 and the old V3 plan, restated because they are what an agent gets wrong.

- **Never invent a fact about Victor's work.** Unknown → a `> **To write:**` prompt, stripped
  from public output. D-069 is what the alternative looked like.
- **Health data may go to the model** (D-071) but **may never be published**. V3 adds a third
  category: it may now be *cached on a device*. Storage is not publication, and the biometric
  gate is the boundary (D-131).
- **Public routes must never import a private loader.** The offline cache does not relax this —
  the public precache and the private store are separate service-worker caches with separate
  keys, and the existing test still enforces the import boundary.
- **Nothing writes to the vault on a model's say-so.** V3 adds no model-driven writer.
- **Add a `DECISIONS.md` entry** for every non-obvious choice, with how to reverse it.
- **`npm run shots`, `npm test`, `npm run typecheck`** before calling anything done. All three
  gate on exit code. V3 adds a fourth: **the device checklist** (2.5), because biometrics,
  launcher icons, battery and thumb reach cannot be measured in Playwright.
- **Measure, do not assume.** Every estimate in this project that was checked turned out to be
  wrong in a way that mattered. The end date in §0 is a direction. Milestone A is a date.
