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

### 3.0 · Revision, 2026-09-05 — the schedule stopped being the constraint

The phases below are unchanged in content. What changed is the order they are taken in and the
window they are taken in, and both are Victor's call, answered on 2026-09-05.

**The arithmetic that forced the question.** Phase 0, all of Phase 1, and §2.1, §2.2, §2.4,
§2.5, §3.1 and §3.2 are built. That leaves **69h of V3, of which 55h is unblocked** — §4.4
waits on the resume PDFs and §5.1 on the filament inventory. Against ~6h left in travel plus
the 66h pre-term burst, roughly **72h is available before term starts on 09-20.** The whole
remaining plan fits inside the burst.

So the plan's own dates — B at ~10-18, C at ~11-15, D at ~2027-01-03 — were derived from a
budget that no longer describes the situation. Two things follow.

**1 · Everything is pulled forward. The target is Milestone D's scope on Milestone A's date.**
Chosen over holding the phases at their planned pace. The cost is stated in §7 Risk 5 and is
worth naming again here: those term-time dates were also the insurance against the term being
busier than ~7h/week. Spending them now means that if the burst under-delivers, the fallback is
the plan's own — Phases 4 and 5 go back to term time, and Phases 2 and 3, where the offline
promise actually lives, do not move.

**2 · Verification comes before any new feature.** Five offline features — §1.7, §2.1, §2.2 and
the two halves of §1.6 — are verified entirely by tests and not at all by a phone. §2.3 was
deferred on 09-04 for exactly that reason and nothing has closed it since. Adding a sixth on top
would compound a risk the last deferral already declined to compound. **§3.7 and the device
round go first**, and everything after them is built on something that has been proven rather
than argued.

#### The order

| # | Round | Items | h | Window |
|---|---|---|---:|---|
| 1 | ~~**Trust the gates**~~ **done 09-05** | Test gate, suite audit, README | ~3 | 09-05 |
| 2 | ~~**Prove the offline work**~~ **done 09-05** | §3.7 + the device round + what they found | ~11 | 09-05 |
| 3 | ~~**Finish Feel**~~ **done 09-05** | §3.3, §3.4, §3.5, §3.6 | 13 | 09-05 |
| 4 | ~~**Offline search**~~ **done 09-06** | §2.3, on proven ground | 6 | 09-06 |
| 5 | ~~**Phase 4, unblocked**~~ **done 09-06** | §4.2 light mode, §4.1 push, §4.3 voice | 24 | 09-06 |
| 6 | ~~**Phase 5**~~ **done 09-06** | §5.2 course planner, desktop-only | 7 | 09-06 |
| | **Total** | | **~64** | vs ~72 available |

~8h of slack, and it is thinner than it looks: **the device round is the one item here that can
inject unbounded work, and every previous one has.** 09-03 produced four bugs, 09-04 produced
three more. The 4h carried in Round 2 for "what it finds" is a guess, not a measurement.

**Blocked, and therefore not in the table:** §4.4 (5h, needs the resume PDFs) and §5.1 (9h,
needs the filament inventory). Both are in §8. If they arrive during the burst they fit in the
slack; if they do not, they are the two items that legitimately fall into term time.

#### Round 2 — the device round ran the same day, and paid immediately

> **§1.6 is closed and §1.3 is half closed.** Both by Victor, on the phone, 2026-09-05.
>
> **The finding was a working feature reported as a missing one.** *"It takes me to the public
> page, and doesn't let me go to private, so logging in airplane mode/offline does not work."*
> The last clause was wrong — logging offline worked throughout. What was broken is that
> `/cached` rendered with the portfolio's header and without the app's bottom tab bar, because
> the chrome predicate and the tab bar both key on `/private` and the shell deliberately lives
> outside it (D-161). So the offline app looked like the public site, and a feature that worked
> was reported as absent. **D-174.**
>
> **No test could have caught it, and that is the argument for this round existing.** Every
> assertion about `/cached` passed: each was about what the component renders, none about what
> surrounds it. There are four now that would.
>
> Fixed in the same sitting: the tab bar renders on the shell with document navigations rather
> than client transitions (an RSC fetch cannot work where there is no server); the five screens
> the phone keeps no copy of are **named** instead of silently redirecting to Today; and the
> offline update check no longer files a crash report for the absence of a network — two of
> those arrived from the phone during this very test.
>
> **Closed later the same day.** The outbox drained on reconnect: two entries reached Neon at
> 2026-09-05T04:12Z, distinct client ids, no duplicates, and two is what was written. **§1.3 and
> §1.6 are both done, and Round 2's device half with them.** What remains in Round 2 is §3.7,
> which is the same round trip driven by a machine rather than by hand.

#### Round 1 — **done 2026-09-05.** The gate is green, and the suite has no dead weight

> **1.1, 1.3 and 1.4 are built; 1.2 is answered and deletes nothing.** The full suite is
> **1080 passing, exit 0, in 27.9s — down from 115s with 7 failures.** Typecheck clean, Prettier
> clean, lint clean bar one pre-existing warning in `prettier.config.mjs`. **D-172 and D-173.**
>
> **The fix was not a bigger timeout, and measuring said so.** Booting PGlite costs ~5.9s;
> replaying all seven migrations into it costs 0.7s. The expense is the WASM boot, not the
> schema — which rules out the obvious fix of caching a migrated dump, since restoring one still
> boots. Ten files were each paying that boot at the same time. They now share one process, one
> boot, and the `node` environment they never needed jsdom instead of.
>
> **Two things this turned up that were not the bug.** The tracked config is
> `vitest.config.mts`, and a `vitest.config.ts` written beside it silently wins and loads as
> CommonJS — worth knowing, since the warning it prints looks like a Vite deprecation notice
> rather than a duplicated config. And `npm test 2>&1 | tail` reports exit 0 no matter what
> vitest returns, which is how a config error that ran **zero tests** printed a tidy summary.
>
> **1.2, the suite audit: nothing meets the bar for deletion.** 1080 tests across 70 files, and
> a scan for tests that assert nothing, assert a literal against itself, or duplicate another
> file's assertion returns **zero** — the one apparent hit was my own scanner mis-parsing a
> regex. Test titles that repeat across files are all genuinely different subjects.
>
> **One real candidate, and it is Victor's call, not a cleanup's.** 57 tests across four files —
> `local-lock.test.tsx`, `assertion.test.ts`, `local-unlock.test.ts`, `lock-state.test.ts` —
> cover the biometric lock that D-158 unmounted on 09-04. That is 5.3% of the suite testing code
> the app does not run. **The recommendation is to keep them:** D-158's whole argument for
> keeping the feature was that re-enabling it is one import, and these tests are what makes that
> one-line reversal safe. Delete them and the reversal becomes an unverified change. Say the word
> and they go.

#### Round 1 as planned — the gates, because everything else is measured by them

- **1.1 · The test gate is not reliably green** (~1.5h). `npm test` fails 7 of 1077 on this
  laptop — every one a 30s `beforeEach` timeout in `resetTestDb()`, and every one passing when
  its file is run alone. The cause is growth, not a slowdown: `vitest.config.ts` already
  carries a comment raising `hookTimeout` from 10s to 30s when **three** database files ran in
  parallel at ~16s. There are **nine** now, each booting its own PGlite and replaying every
  migration. Raising the number a third time treads the same path; the fix is to stop nine WASM
  Postgres instances from booting at once. **A flaky gate is worse than a slow one** — it
  teaches you to re-run rather than to read, which is the sentence already written in
  `src/test/pg.ts` about this exact failure.
- **1.2 · Suite audit** (~2h). 1077 tests across 69 files, and Victor asked what is not earning
  its place. **Nothing is deleted before the list is reported.** The bar: a test that asserts
  nothing that can fail, a test whose exact assertion exists in another file, or a test pinned
  to an implementation detail that has since been replaced. Not on the bar: slow, verbose, or
  covering something obvious. One item is a judgement rather than a rule — §1.5's 46 local-lock
  tests cover a component that D-158 deliberately unmounted, and **that call belongs to Victor,
  not to a cleanup pass.**
- **1.3 · `web/README.md`** (~20m). Still `create-next-app` boilerplate stating the project uses
  Geist, false since D-002. First file a stranger opens in the repo.
- **1.4 · Retire `/sprint-review`.** Goal editing lives on `/private`; the separate route is
  gone. §8 item 8 closed.

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

**Removed from the app on 2026-09-04, and kept in the repo. D-158.** Victor: *"I do not like
the auth every single time I log in."* The lock re-locks on every cold start — most launches on
a phone — in exchange for a **display gate** the phone's own lock screen already provides. Several
fingerprints a day, forever, against someone picking up an already-unlocked phone is a bad trade,
and D-154 named this reversal itself.

`<LocalLock>` is gone from the private layout. The component, the ceremony, the local verifier,
the credentials route and all 46 tests remain and stay green. **Re-enabling is one import and one
wrapper** in `app/private/layout.tsx`. The middle option, if "never" turns out to be too far, is
to lock only after some hours away rather than on every launch — a small change to `decideLock`.

**The device check this section was blocked on is therefore withdrawn**, not deferred.

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

~~**Still Victor's to close:** log one Training, one Study and one Reading-or-People entry
one-handed on the phone, with a stopwatch, and write the three numbers into this section.~~
**Closed 2026-09-05 on the device** — *"the 15 seconds works for all of the logs."* All three
paths are under the bar, Training included, which is the one that changed shape twice (D-159
sets-in-rows, D-162 fields by kind). **§1.6 is done.**

**Reworked 2026-09-03 after he used it. D-159.** Four changes, from four pieces of feedback,
and none of them a bug — the form did what it was built to do and what it was built to do was
partly wrong.

- **Training logs sets, not a set.** It collected one weight and one reps, so three sets of
  bench press were three entries or one entry recording a third of the work. A category can
  now declare a repeated `rows` group; the exercise is typed once and each set is a row under
  it. One entry is **one exercise**, not one session — the log is written at the rack between
  sets, and a form that wanted a whole session is a form nobody finishes. "Add set" copies the
  row above it.
- **Those sets reach the PR board.** They had to, or the log is a diary the records ignore.
  The phone cannot create a `workouts` row (`SYNC_DESIGN.md` §11.1 — reversing that is the
  aggregate op in §4a, ~10h and a migration), so `allEfforts()` merges the two sources on read
  instead. Every consumer still takes one `Effort[]`. Nothing about sync changed, which means
  a set logged in airplane mode reaches the records by the path §1.3 already tested.
- **Bodyweight is loggable from Training**, and stored only in `bodyweight_entries` — never on
  the entry. It is the second input to every adjusted erg split, and two copies drift.
- **Applications is retired** (it lives in a Google Sheet) and **Study lost its kind, status
  and grade** — course, hours and the note every entry already has.

The Training tab's own workout form is **unmounted, not deleted**: `/private/log` is a normal
page and works on a laptop, so the tab links to it. **875 tests**, up from 842.

*The timing bar this section is measured against is now Training, Study, and Reading or
People* — Applications is gone.

**Two more fixes on 2026-09-05, from using it. D-162 and D-164.**

- **A set shows only the numbers that kind of session has.** A bench press was offering a
  distance, a time and a stroke rate — four things to read past between sets, which is most of
  the fifteen seconds. `kind` now picks the shape, with an *every field* escape hatch, and
  dropped fields are unmounted rather than CSS-hidden so a stale value cannot post.
- **The tabs wrap instead of scrolling sideways**, which was hiding the last two categories on
  a 360px screen with nothing to say they were there.
- **A capture box above the tabs.** One line, no category — because choosing one is the work
  being deferred. Note or task, defaulting to note. Notes wait in an *Unsorted* pile with
  one-tap filing into a real category; the pile disappears entirely when empty. It works
  offline too. **1015 tests**, up from 984.

Filing deliberately does *not* open the form to add fields: the log has no edit path anywhere,
and inventing one here would be a second way to change a saved entry with different rules from
the first. Worth revisiting if the pile fills with things that wanted structure.

#### 1.7 · Failed sync — hold, surface, retry — **6h**

A stuck entry stays in the outbox with a persistent badge, one screen to inspect and fix it, and
an escalating warning past 24 hours. Nothing is ever discarded.

**Done when:** ~~a deliberately malformed entry survives ten launches, stays visible, and syncs
after being corrected.~~ **Built 2026-09-05, and the criterion is a test** — `stuck.test.ts`
enqueues a malformed entry, has the server reject it, relaunches ten times (closing and
reopening IndexedDB, which is what a cold start does), and asserts after each that the op is
still there, still failed, still carrying its payload and its reason. Then it requeues and
watches it arrive. **D-160.**

**What was built.** `/private/sync` lists everything the server has not accepted, says why in a
sentence, and offers one action: send it again. The badge escalates and never fades — a quiet
count, then the age once something has waited a day, then a destructive-coloured *"not sent"*
for a rejection. Badge and screen read from the same pure module, so they cannot disagree.

**The decision inside it: there is no delete button.** An entry in that list is the only copy of
something he wrote, and the app offering to bin it at the moment it is being unhelpful is how a
log stops being trusted. A test fails if a button matching /delete|discard|remove/ ever appears
there, because that is the obvious thing for a later change to add.

**The messages are rewritten, not printed.** The raw text is Zod's or Postgres's or a status
code, none of it addressed to the person holding the phone. A validation rejection now says the
server would not accept the contents *and that the copy on the phone is safe*, which is the fact
that matters at that moment.

**Failure outranks age.** A rejected op will still be there next week, so calling it "waiting"
is a claim that gets more wrong the longer it stands.

> ### ⚑ Milestone A — 2026-09-18
> **2ndMind is on the home screen. It logs with no signal and syncs on reconnect.**
> The only hard date in this plan.
>
> Now also carries the criterion moved out of §1.1: a **cold start with the network off opens
> on the dashboard**, not on the offline page. That needs the precached shell, the local store
> and offline auth all present, so it could never have been true at §1.1.
>
> **Built as of 2026-09-05** — §2.1 and §2.2 were pulled forward rather than the date moving, so
> every part of this sentence now has code behind it. **Unconfirmed on a phone**, which is the
> only thing left.
>
> **Answered 2026-09-05.** §7b's ordering problem is closed by building §2.1 early rather than
> by moving the date: a cold start with the radio off now opens on the cached dashboard —
> today's tasks, what has been logged, recent training — instead of the offline page. It is
> read-only, so *"logs with no signal"* is still not literally true until the form itself is
> precached (§2.2). **Milestone A is worth restating as what it now delivers**, and that is
> still Victor's call.

---

### Phase 2 · Term, first block — from 2026-09-20 — **28h**

Milestone B: nothing needs signal.

- **2.1 · Cached reads — 10h.** ~~Today, Athletics, Academics + Calendar rendered from the local
  store. Every panel shows the sync time — a cached screen must read as cached.~~
  **Built 2026-09-05, ahead of Phase 2, because §7b said it had to be. D-161.**

  **The app now opens with no signal.** A static page at `/cached` renders Today, Training,
  Academics and the log out of IndexedDB; the service worker precaches it and serves it in
  place of any `/private` navigation that fails. It could not live under `/private` — every
  route there is `force-dynamic` and calls `requireSession()`, so rendering one needs a server,
  which is exactly what is missing. Serving it unauthenticated is safe because the HTML holds
  no data: every value is read from the local store in the browser, which exists only on a
  device that has signed in and synced.

  **Its scripts are precached too**, scraped from its own HTML at install. Without that the
  page appears and never hydrates, and airplane mode gets a heading and the word "Reading…".

  **A cached screen reads as cached.** The age is at the top of every view, shown whether it is
  two minutes or two weeks; only the tone changes.

  **Calendar is not in it, and says so.** Google events are not mirrored anywhere, nor are the
  degree audit and course notes (vault markdown — that is §2.2), nor **records and charts**:
  those are derived from the whole history (D-025) and only part of it is mirrored, so a PR
  board built here would be wrong in the direction that matters and look authoritative. Each is
  named on screen rather than rendered empty, because an empty panel reads as "nothing today".

  **Still open:** the shell reads and does not write. Logging with no signal still needs the
  form to have loaded once — §2.2's precached app shell is what closes that.
- **2.2 · Public precache — 6h.** ~~Every public route, all three resume variants including print
  layout, and `/now` with a visible "as of" date.~~ **Built 2026-09-05. D-163.** Two halves, and
  the second was not in the original scope.

  **The portfolio is precached**, from `/sitemap.xml` rather than from a list written in the
  worker — home, `/now`, the projects index, every public project, all three resume variants, plus
  the scripts each needs. Adding a project precaches it with no code change. Runs in `activate`
  rather than `install` so it never delays the update prompt, and filters `/private` explicitly
  before writing anything to disk. `/now` already prints *"Last update <date>"* (D-099), which is
  the content's own date and better than a build stamp, so nothing was added there.

  **The log now writes with no signal** — this is the half Milestone A needed. The cached shell
  carries the *same* `LogForm`, handed a writer that puts the entry in the outbox instead of
  posting a Server Action. Same fields, same set shapes, same chips (built from the local mirror),
  same recovery when a save fails. An entry written on a plane is then sent by exactly the flush
  `roundtrip.test.ts` already runs against real Postgres.

  §1.7's screen is reachable there too, since it only ever read IndexedDB.

  *Done when:* ~~the portfolio and the resume render in airplane mode~~ — **still Victor's**, on
  the phone, along with the offline round trip already on his list.
- **2.3 · Offline full-text search — 6h.** ✅ **DONE 2026-09-06. D-183.** The same box and the
  same URL: `/private/log?q=…` is answered by the worker with the shell, which searches the
  local mirror's `search_text` — the very column the server searches, already synced. Matching
  is word-beginnings with every term required, and **the difference from Postgres is asserted as
  a test**: `run` finds `running`, `ran` does not. Proven in the browser by `npm run e2e`.
  ~~Over logs and cached content, running locally.~~
  **Deferred 2026-09-04, at Victor's call** — *"skip over the offline stuff and go onto the next
  thing."* Not cut and not descoped: still 6h, still the same design, still ahead of semantic
  search (which stays cut for the fourth time). It simply goes after §2.4 and §2.5 rather than
  before them.

  The reasoning is worth recording, because "we skipped it" is the kind of note that reads as an
  accident a year later. Four days of offline work — §1.7, §2.1, §2.2 — is verified entirely by
  tests and not at all by a phone. Adding a sixth offline feature on top of five unconfirmed ones
  compounds the risk; §2.4 does the opposite, since error aggregation is the thing that makes the
  unconfirmed work report on itself.
- **2.4 · Error aggregation — 4h.** ~~Sentry free tier with scrubbing rules for vault content.~~
  **Built 2026-09-04, and the vendor was dropped. D-165.** Reports POST to `/api/errors`, land in
  an `error_reports` table in Neon, and surface on the dashboard. No SDK, no third party.

  **Why not Sentry.** Its tooling is genuinely better. What it costs is that a GPA, per-course
  grades, bodyweight and a phone number sit one bad scrubbing rule away from an external service
  — and a scrubbing rule that fails does so silently, in the wrong direction. Keeping it in-house
  removes that failure mode rather than mitigating it. D-137 had already named this as a drop-in
  alternative.

  **A crash report is the one payload nobody wrote on purpose**, so it is allowlisted rather than
  blocklisted: fixed schema, every field capped, free text scrubbed for emails, phone numbers,
  named secrets and long tokens — twice, on the device and again on the server.

  **A real bug came out of it.** The email pattern is quadratic in the length of a word-character
  run, so scrubbing before truncating cost ~1s of CPU on a 50KB stack — on an unauthenticated
  endpoint, a way to burn a core per request. Found by a test timing out under load. Truncate
  first; pinned by a wall-clock assertion.

  **Rows are counted, not accumulated** — one per fingerprint, upserted — because a render loop
  otherwise makes the diagnostics table the largest thing in the database and takes the app down
  with it. The fingerprint ignores numbers, quoted values and the stack, so a deploy does not read
  as a fresh crop of new errors.

  **The panel is absent most of the time**, which is the point: a panel permanently showing
  "0 errors" stops being read within a week.

  **Three swallowed `catch` blocks now report** — the sync runner's, the cached shell's, and the
  service worker's install and precache. That last one is D-137's whole argument: a failing worker
  on a Samsung produces no log anyone will ever read.

  **1069 tests**, up from 1015. Migration `0006_error_reports` applied to Neon the same day.
- **2.5 · Device checklist — 2h.** **Built 2026-09-04 → `docs/DEVICE_CHECKLIST.md`.** How to
  attach Chrome DevTools to the Samsung over USB, a ten-minute per-release list (install, icon,
  the offline round trip, the portfolio with no signal, thumb reach, the dashboard), and a
  symptom table for when one fails. *(Biometric dropped — D-158 switched the lock off.)*

  Two things in it are corrections rather than notes. **Test offline with airplane mode, not
  DevTools' Offline checkbox**, which lies about installed PWAs. And **a stale launcher icon is
  not a code problem** — Android caches it for days, and the fix is uninstall, clear site data,
  reinstall.

  It deliberately excludes anything a test could check. If a step could be automated it belongs
  in the suite; this list is only the things that cannot be, which is why it is short.

> ### ⚑ Milestone B — ~2026-10-18
> **Everything works with no signal, including showing the portfolio to a stranger.**

---

### Phase 3 · Term, second block — **31h**

Milestone C: it stops feeling like a website.

- **3.2 · `shots.mjs` extension — 3h.** **Built 2026-09-04, and pulled ahead of §3.1. D-166.**
  All ten private screens swept, five gated on how far down the first actionable element sits.

  **The order was swapped on purpose.** §3.1 is ten hours of reordering and §3.2 is the three
  hours that measures it; doing the pass first meant reordering four screens by opinion against
  one screen's worth of measurement, which is what §7's "measure, do not assume" was written
  after. Same total, same design, and §3.1 got a before-number per page.

  It paid on the first run: `/private` measured **936px**, a regression on the one page that had
  ever been measured. D-132 got it to 265px and the gate passed ever since — on days with an
  empty calendar. Nobody had measured it on a term day.

  **A gated page with no marker is a fault**, or the check reports nothing and the page passes by
  having lost the thing being measured. **The measurement is settled, not instantaneous** — every
  private page streams, and the same sweep read 208px and 936px on the same page depending on
  whether the schedule had arrived. Gate verified both ways: 250px fails on four pages, 500px
  passes clean.
- **3.1 · Mobile layout and ordering pass — 10h.** **Built 2026-09-04. D-167, D-168.** D-083's
  fix applied to the three private screens that never had it, measured at 390px:

  | | before | after |
  |---|---|---|
  | `/private` | 936px | **296px** |
  | `/private/athletics` | 855px | **342px** |
  | `/private/academics` | 541px | **266px** |

  The schedule moved below the tasks on the dashboard; the stats moved below the list on
  academics and went three-across on a phone; the rehab checklist moved above the goal card on
  athletics. Calendar (297px) and the log (205px) already passed and were left alone —
  changing a passing layout to match a pattern turns a measured improvement into a preference.

  **The error panel became a one-line disclosure (D-168).** Five open cards were what put
  `/private` at 936px: a panel reporting that something is broken had made the working part of
  the page unreachable. Its summary line names the top problem rather than counting them, which
  is the part worth keeping.

  **And it found a real bug (D-169).** The panel's first real content was `workout_set row has
  no clientId`, 11 times, from five routes: `identityOf` had no case for `workout`/`workout_set`,
  threw on every pull, and the sync runner swallowed it — **the workout mirror had never
  populated once**. Offline, the training page had been showing quick-logged sets and nothing
  imported from Hevy. Fixed by addressing them with the server's `id`, which is safe only
  because they are pull-only.
- **3.3 · Gestures — 6h.** ✅ **DONE 2026-09-05.** Swipe right completes a task, left removes
  it; a log entry has only left, and right resists and springs back so the rule holds app-wide.
  Pull down on any private screen to send. A short buzz on every save, a deliberately unlike
  pattern on a failed sync. **The undo stayed inline and `sonner` stayed unmounted** — Victor's
  call, and the reason is that the bottom of the screen already carries three fixed layers.
  **D-180, D-181.**
- **3.4 · Motion — 3h.** ✅ **DONE 2026-09-05, trimmed to ~1h at Victor's call.** The ambient
  gradient stops animating below 40rem — a fixed, full-viewport layer of three radial fills was
  repainting for as long as the app was open, which surfaces as battery rather than as jank.
  **The sheet and save transitions are deliberately left for V4:** they are about how the app
  looks, the look is being overhauled, and building them now means building them twice.
  **D-179.**
- **3.5 · Icon long-press shortcuts — 2h.** ✅ **DONE 2026-09-05.** Two deep links had to exist
  first: the log page accepted only `?q=`, and the capture box was not on Today at all — it is
  on `/private/log` in the live app and on Today only in the *offline shell*, so the app and its
  own offline copy disagreed about where capture lives. A test resolves each shortcut's category
  against `TAB_CATEGORIES`, because nobody re-tests a long-press menu. **D-178.** *("Log application" was dropped 2026-09-04: D-159 removed applications
  from the log, and the Google Sheet owns them. Victor picked the capture box (D-164) to replace
  it — the unstructured note is the thing most worth reaching in one press.)*
- **3.6 · AI offline — 2h.** ✅ **DONE 2026-09-05.** The newest daily summary renders on the
  offline Today with the day it describes, **whatever its age** — the age is a label, not a
  filter, which is the rule the rest of that screen already follows. Weekly summaries are
  excluded: one under a heading dated a single day would make the date say something untrue.
- **3.7 · Playwright offline suite — 5h.** ✅ **DONE 2026-09-05.** `npm run e2e`. Eighteen
  checks against a production build and the real database: the worker precaches, the radio goes
  off, `/private` is answered with the shell, the portfolio still opens, a Training entry with
  two sets is written offline, and on reconnect it reaches Postgres **exactly once** with its
  sets intact — then the row is deleted. Six rows before, six after. **Mutation-tested:**
  removing the shell's sync runner makes it fail and exit 1. Three of its first four failures
  were the suite's own fault and are recorded in **D-176**, because each is a way this kind of
  test lies — a desktop viewport, a network that is never idle, a third-party 503, and a
  `navigator.onLine` that reports the radio back before the first POST can succeed.

> ### ⚑ Milestone C — ~2026-11-15
> **It behaves like an Android app, and the layout is gated by measurement.**

---

### Phase 4 · Term, third block — **29h**

- **4.1 · Push notifications — 8h.** ✅ **DONE 2026-09-06. D-185.** All three triggers, which
  turn out to work three different ways. Two cron jobs — an evening nudge **only on a day with
  nothing logged**, a morning digest **only when something is due** — both silent by default,
  because a notification that arrives regardless is one you learn to swipe away. The stuck-outbox
  alert is **not a push at all**: the server cannot see an outbox that lives on the phone, so the
  app raises it through its own worker, only for ops that have actually failed. The day is
  computed in `America/Los_Angeles`, tested across a daylight-saving change — the evening job
  runs at 04:00 UTC, which is already tomorrow there. **Needs `npm run push:keys` and a
  `CRON_SECRET` pasted into `.env.local` and Vercel before any of it fires.**
- **4.2 · Light mode — 8h.** ✅ **DONE 2026-09-06, scoped to ~3h at Victor's call. D-184.**
  The *mechanism* now, the colours in V4 — the overhaul includes the visual style, so the audit
  would be done twice. The palette is computed rather than picked: `#d94f93` is **3.6:1** on
  white and unreadable at body size, so every value is the same hue taken down until it carries.
  **The portfolio stays dark** — a shopfront should look the same to everyone — using
  `forcedTheme`, so visiting it cannot overwrite the app's setting.
- **4.3 · Voice, whole-entry — 8h.** ✅ **DONE 2026-09-06. D-186.** The browser hears it, a
  grammar reads it, Gemini gets what the grammar cannot. **"Always confirmed" is structural:**
  the component has no way to write — it fills fields, and the ordinary save button saves.
  Rules before the model because a grammar is wrong the *same way* every time and a model is
  wrong differently each time, in a log whose value is that its numbers can be trusted. It gives
  up rather than half-filling. Explicit offline state, as specified.
- **4.4 · Upload your own resumes — 5h.** ✅ **DONE 2026-09-06. D-188, which reverses D-138.**
  ~~**Fallback** semantics: the generated resume shows where no upload exists.~~ **Alongside, not
  instead of** — Victor's call once the file was in front of him. The PDF is dated 20 August and
  the vault's resume content was updated on the 30th, so an override would publish a document
  already ten days behind with nothing saying so. The generated sheet stays primary and the PDF
  is a download beside it, on all three variants. **The risk was the folder, not the feature:**
  everything in `context/assets/` becomes a public URL and a transcript sits next to this file in
  the vault, so the sync script now carries a per-folder allowlist.

---

### Phase 5 · Carried from the old plan — **16h**

- **5.1 · Filament and printers — 9h.** ✅ **DONE 2026-09-06. D-189.** Reorder-first as
  specified: spools emptiest-first, swatches from a validated hex, and the count of what needs
  buying at the top. Printers are a secondary panel on Victor's own four states. ~~*Blocked on
  the inventory in `docs/UPLOADS_NEEDED.md` §2.1–2.2.*~~ **The block was a misread.** It waited
  weeks on a table Victor was meant to hand over; his answer was that he wants to add spools *on
  the site*, which makes the data entry the feature rather than its precondition. There was never
  anything to wait for.
- **5.2 · Three-year course planner, desktop-only — 7h.** ✅ **DONE 2026-09-06. D-187.**
  `/private/academics/plan`: five term columns to June 2028, checked continuously against the
  parsed audit. **A checker, never a suggester** — it does not know what is offered when, and a
  draft built without that would be confidently wrong. **A course counts once**, which is the
  failure mode of a hand-written plan. And it separates *counts* from *might count*, because the
  audit's GE lists are truncated in the generated file and rejecting a course the parser dropped
  would be worse than not checking. Stored as a vault file, not in Postgres: a document to read
  in five years, not a time series.

> ### ⚑ Milestone D — ~2027-01-03
> **Full scope. Not a hard date.**

---

## 4. Ordered summary

**Superseded on 2026-09-05 by §3.0** — the phases still describe the work, the *Ends* column no
longer describes the schedule. Kept as written, because a table quietly rewritten is a table
nobody can check against what was actually promised.

| Phase | Block | Hours | Ends (as planned 08-30) | State 09-05 |
|---|---|---:|---|---|
| 0 | In transit — Prettier, sync design, nav, icon | 18 | 2026-09-07 | **Complete** |
| 1 | **The app** — PWA, store, sync, unlock, fast logs | 65 | **2026-09-18 ⚑A** | **Complete, unconfirmed on a phone** |
| 2 | Offline everything — cached reads, portfolio, search, errors | 28 | ~2026-10-18 ⚑B | §2.3 left |
| 3 | Feel — layout, gestures, motion, shortcuts, E2E | 31 | ~2026-11-15 ⚑C | §3.1, §3.2 built |
| 4 | Push, light mode, voice, resumes | 29 | ~2026-12-13 | Not started · §4.4 blocked |
| 5 | Filament, course planner | 16 | ~2027-01-03 ⚑D | Not started · §5.1 blocked |
| | **Total** | **187** | vs ~188 available | **~69h left, 55h of it unblocked** |

**Not in any phase, and shipped anyway:** D-170 and D-171 on 2026-09-04 — dynamic-route
prefetches kept warm for 30s, and the above-the-fold entrance fade dropped, after measuring
400–600ms TTFB from the Hong Kong edge to the `iad1` function. Recorded here because the plan
has no section that owns perceived speed, and work with no home in the plan is work that
disappears from the history.

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
| **A UI overhaul** | **V4, at Victor's call 2026-09-05.** Named the day offline logging was confirmed working on the phone: *"Offline works right now, but I don't love the UI."* Three things, and the offline screen is not among them — **density and spacing, the visual style, and what lives where in the navigation.** Explicitly out of V3, and the reason is ordering rather than taste: a redesign puts every screen back in flux three weeks after §3.1 measured them and §3.2 gated them, and it would land on top of §3.3 to §3.6, which change how those same screens behave. Behaviour first, then the look, so each is judged against something that stopped moving. |

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

## 7b. Milestone A promises something Phase 2 builds — found 2026-09-04, **mostly closed 2026-09-05**

> **Closed 2026-09-05.** Option (1), in full: §2.1 and §2.2 were both built early rather than
> the date moving (D-161, D-163). The app opens with the radio off, reads today's tasks, the log
> and recent training from the local store, **and writes new entries into the outbox**, which the
> ordinary flush sends on reconnect. Milestone A's words — *"it logs with no signal and syncs on
> reconnect"* — are now literally true, and no estimate moved and nothing was cut.
>
> ~16h came out of Phase 2 into Phase 1, which leaves Phase 2 at §2.3 (offline search, 6h),
> §2.4 (error aggregation, 4h) and §2.5 (device checklist, 2h). **The remaining risk is not the
> code, it is confirmation:** every claim above is verified by tests and none of it by a phone.

**The finding.** Milestone A reads *"2ndMind is on the home screen. It logs with no signal and
syncs on reconnect."* You cannot log with no signal if you cannot **open** the app with no
signal, and opening it offline needs a precached shell — which is **§2.1 and §2.2, in Phase 2,
scheduled to start two days after Milestone A's date.**

This was half-known. §1.1's own correction already said that *"survives a cold start with the
network off"* did not belong in §1.1 and *"moves to Milestone A"*. What nobody then did was
check that anything scheduled before Milestone A actually delivered it. Nothing does.

**What it looks like today,** confirmed on the phone on 2026-09-04: with no signal, *every*
navigation lands on the offline page — the dashboard, the portfolio and sign-in alike. Phase 1
built the machinery to log offline (§1.2's store, §1.3's outbox and flush) and no way to reach a
screen that uses it. **That is not a bug; it is unbuilt**, and the offline page now says so
rather than implying a fault.

**This is an ordering question, not a scope one.** Nothing needs cutting and no estimate moves.
Three ways to take it:

1. **Pull §2.2 (public precache, 6h) and the shell half of §2.1 forward into Phase 1.** Milestone
   A then means what it says. Phase 1 goes 65h → ~75h and its window is already tight.
2. **Move Milestone A's date** to when Phase 2 lands the shell, and keep Phase 1 as it is.
3. **Restate Milestone A** as what Phase 1 actually delivers: installed, logging *online*, with
   the offline machinery built and tested underneath. Honest, and it defers the phone being
   useful on a plane to Milestone B.

Victor's stated preference in this situation is to keep the scope and move the date (D-140), so
(2) or (3) is the likely answer — but the date in question is the one hard date in the plan, so
it is his call and not a default to assume.

---

## 8. Blocked on Victor

Everything here needs a person, a device or a file. Nothing in it is waiting on code.

### Check these three, on the phone — they close three finished sections

**Scheduled 2026-09-05 as Round 2 of §3.0**, rather than left to whenever. Victor has the phone
this week, and everything after Round 2 in the new order is built on what these two checks
report. They are no longer background items; they are the gate on the rest of the plan.

| # | What to do | Closes |
|---|---|---|
| ~~1~~ | ~~**The offline round trip.**~~ **Closed 2026-09-05.** Written in airplane mode, arrived after reconnecting: two entries at 04:12Z, distinct client ids, **no duplicates**, and two is what he wrote. Both halves confirmed on the real device against real Neon. **§1.3 is done.** | ~~§1.3~~ |
| ~~2~~ | ~~**Time the three fast log paths.**~~ **Closed 2026-09-05.** Victor: *"the 15 seconds works for all of the logs."* Training as sets-in-rows, Study, and Reading/People all under the bar on the real device. §1.6 is done. | ~~§1.6~~ |
| ~~3~~ | ~~**Biometric unlock, twice.**~~ **Withdrawn 2026-09-04** — the lock was removed from the app (D-158). There is nothing left to check. | ~~§1.5~~ |

### Then these, in no particular order

| # | What to do | Blocks |
|---|---|---|
| 4 | **Re-add the app to the home screen.** Android caches the old icon, so the emoji-shaped mark (D-151) will not appear until the shortcut is removed and re-added. | Nothing — cosmetic |
| 5 | **Filament and printer inventory** — `UPLOADS_NEEDED.md` §2.1–2.2. Plus the status vocabulary actually used. | §5.1 |
| 6 | **The resume PDFs themselves**, and which is the default for a bare "Resume" link. | §4.4 |
| 7 | **Fall 2026 classes in Google Calendar.** No code waits on this; the schedule appears on its own. | Phase 2 quality |
| ~~8~~ | ~~**Confirm the goals editor has been used once**, so `/sprint-review` can be retired.~~ **Taken 2026-09-05** — Victor selected the retirement, which is the confirmation. Round 1.4. | ~~Housekeeping~~ |

### Closed

| # | What | Closed |
|---|---|---|
| ~~0~~ | ~~**Commit the format pass.**~~ Landed on its own as `946c5f7`, ahead of any V3 code, so no feature diff carries the noise. | 2026-08-30 |
| ~~0~~ | ~~**Look at the icon on the phone.**~~ Installed from Chrome on the Samsung; install path and launcher tile both correct. The shape was wrong — top view, redrawn as a side profile (**D-145**), then again as the emoji (**D-151**). Worth keeping: the thing the device check caught was not the thing it was written to catch. Cropping and fold legibility were both fine, and the fault was the drawing itself — exactly the class of error a desktop screenshot lets you talk yourself past. | 2026-08-30 |
| ~~5~~ | ~~Does the phone create `workouts`, or only `log_entries`?~~ **Log entries only.** Answered "workouts too", reversed the same day. §1.2 is back to 14h and Phase 1 fits its window again. `SYNC_DESIGN.md` §11.1. | 2026-08-30 |

**Found while building, ~~not scheduled~~ — scheduled 2026-09-05 as Round 1.3:**
`web/README.md` is still `create-next-app` boilerplate and states the project uses Geist —
false since D-002 put three self-hosted faces in `src/app/fonts/`. It is the first file a
stranger opens in the repo. ~20 minutes. It stayed visible for six days by being written down,
which is the whole argument for writing this class of thing down.

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
