---
updated: 2026-09-05
domain: operations
stability: volatile
summary: This week's goals, operating rules, and academic tracker.
read_when: Always — anything about current priorities or scheduling.
---

# Current Sprint: 1-Week Horizon

## 1. Active Sprint Goals
*Identify top 3 priorities across all domains for the week here.*
- **Engineering / Career:** 2ndMind is live at https://victorgusev.com. V1 complete
  2026-08-21, **V2 complete 2026-08-30** — all seven features plus the offline review round.
  **V3 is now active: the phone.** Scoped 2026-08-30, `docs/V3_PLAN.md`. Phase 0 starts
  immediately at ~2h/day; the hard date is Milestone A on 2026-09-18.
- **Athletics:** Programming resumes at move-in (2026-09-20); nothing scheduled before then.
- **Academics:** Fall term starts 2026-09-20. Nothing due this sprint.

### 2ndMind build status
Plan runs to 2026-09-18 (real code deadline — travel 08-29 to 09-07, move-in 09-19).

- [x] Days 1-6 — vault refactor, typed parser, public-field whitelist
- [x] Days 7-12 — public site, breadth section, analytics, SEO, deployed
- [x] Days 13-15 — resume generator, three variants, print-to-PDF
- [x] Days 16-20 — passkey auth, vault writes, sprint editor, logbook, dashboard
- [x] Days 21-29 — freshness widget, athletics (Neon + Drizzle, Hevy import, PRs)
- [x] Days 30-32 — Work, Academics (tracker), Calendar, Hobbies. **V1 complete.**

### V2 — scoped 2026-08-21, replanned 2026-08-24, revised 2026-08-25

Full ordered plan with difficulty and estimates: `docs/V2_PLAN.md`.
Scope decided 2026-08-24: **features only** — per-session revocation and error
aggregation move to V3.

Revision 2 (2026-08-25) changed four things, all Victor's call:

- The AI approval gate is over **structured proposals, not a markdown diff** — sprint goals
  are Postgres rows, so the dependency that justified a 10h diff UI did not exist. 10h → 4h,
  and nothing AI-driven writes to the vault in V2 at all (D-080).
- **Semantic search is reinstated** — the $10 is per month, not lifetime. It stays last in
  build order, and the new cut line is its incremental re-embedding (D-079).
- The case-study page design is built **against fixtures now**, not deferred behind the prose.
- "Close out Today" loses its one-real-day-of-use gate.

Revisions 3 and 4 (2026-08-25) added ten requested items as `docs/V2_PLAN.md` §7. **Seven are in
V2**: the domain, the uploads list, the four uploaded images, retiring culinary, the public
`/now` Working page, the public→private button, and read-only access to the job sheet.

**Semantic search is cut** to pay for them (D-087) — 12h out against 11.5h in, so V2 got
shorter while gaining three features. It has now been assessed three times: cut on cost,
reinstated when the budget turned out to be monthly, cut on time. **V3 is its own document,
`docs/V3_PLAN.md`** — rewritten 2026-08-30 and no longer the three-feature list described here.
See the V3 section below.

Budget after all revisions: **~41.5h of my work against ~60h available**, ~34% slack.

**Done 2026-08-25 (~9h):** housekeeping, the resume page-count gate and one-page fix (§1.1),
the case-study page design (§1.2), feature 3's close-out (§1.4), summarise-my-week (§1.5), the
four uploaded images (§7.3), and retiring culinary formulas in favour of a Proof link (§7.4).

**Remaining before Taiwan: only §7.1, the domain** — parked at Victor's request until he buys
it. Nothing else pre-Taiwan is blocked.

**Corrected 2026-08-25:** project years — 5 Second Rule 2025, Micromouse 2023, TaskAble 2026.

**Found while doing it:** `gemini-2.5-flash` was retired and every AI call had been 404ing
silently — the daily summary showed a fallback string and nothing else said so. Now
`gemini-3.6-flash` and verified working (D-085). Failures were also being cached for six
hours (D-086). Both were blockers for feature 6 that no one knew about.


### Offline review round — 2026-08-29

Victor reviewed a frozen snapshot of the site while travelling (`npm run freeze`, D-106),
wrote the six project case studies, and returned a change list. Answered as ~50 questions,
then built. **Full status and what is left: `docs/REVIEW_ROUND_PLAN.md` at the repo root.**

Shipped: the About rewrite and hobbies trim, tiers replaced by explicit ordering, `archived`
renamed to `done`, Water Bottle Scale deleted and Smart Bottle created, the Dimaag paper as a
deliberately vague public placeholder, Proof onto the robotics resume, Tailor moved under
Work, an inbox on Today, Today's two goal panels merged, and the DARS audit parsed into
`01_engineering/degree_audit.md` and rendered on Academics. Decisions D-106 to D-116.

Found while doing it: the erg split `2:17` was hard-coded as a placeholder in a client chunk
served without authentication — harmless while it was public, not harmless after Victor made
the splits private in the same round. Fixed, and `web/AGENTS.md` gained a rule about
projections shipping whether or not they are rendered.

**Still open from this round:** the paper is internal until Dimaag clears it. The three-year
course planner is now **scheduled — V3 Phase 5.2, desktop-only, 7h**. Daily AI summaries are
**persisted as of 2026-08-30** (D-124), which closes feature 6.

Priority is Victor's: fix V1's findings and make it faster and cleaner before adding
features. Four ship before term, two during. Full plan and reasoning in `web/DECISIONS.md`
D-036 to D-039.

- [x] **0 · Foundation** — done 2026-08-21. Vault reads cached and time-limited; tasks live
      in Postgres, so saves are immediate and no longer commit or deploy. Measured: work
      320->69ms, calendar 377->32ms, academics 761->186ms.
- [x] **1 · Redesign** — done 2026-08-21. Magenta palette, active tab, single-shot sweep,
      freshness as a badge, shared page shell with collapsible reference prose, scrolling
      nav on narrow screens.
- [x] **2 · Structured logging** — done 2026-08-21. Six categories, fields generated from
      one definition file, full-text search over everything, dictation on Android, soft
      delete with undo. Replaces the old free-text logbook.
- [x] **3 · Today** — closed out 2026-08-25. The review was the feature: nothing new was
      built. The first task on `/private` sat 791px down a phone screen, behind a failed AI
      panel and three stacked stat cards; it now sits at 356px. `npm run shots` signs its own
      session, sweeps the private pages and fails above 500px, so this cannot regress
      unnoticed (D-083, D-084).
- [x] **4 · Calendar** — done 2026-08-22. Google and Canvas private iCal feeds via ical.js,
      agenda for today plus seven days, Canvas assignments importable as tasks. No OAuth, no
      cost. Two data gaps, neither a defect: the Canvas feed is empty (211 bytes, zero
      events) and Fall 2026 classes are not yet in Google Calendar.
- [x] **5 · Athletics depth** — done 2026-08-22. Concept2 weight-adjusted splits against
      the sub-2:00 goal, bodyweight table, rehab checklist and SPM targets parsed from this
      vault, week-plan-vs-logged review, server-rendered SVG charts.
- [ ] **6 · AI, narrowly scoped** (~14h) — summarise the week, draft sprint goals, resume
      tailoring. Semantic search is cut (D-087). Every model-proposed change is approved item
      by item before it is applied; nothing AI-driven writes to the vault in V2 (D-080).
- [ ] **7 · New scope, rev 3-4** (~14.5h) — domain, images, culinary retired, public `/now`
      page, public→private button, job sheet read-only. `docs/V2_PLAN.md` §7.

**Time budget (V2, historical):** ~4h/day until 2026-09-20, then ~4h/week. Six features is
80-106h against ~76h before term, which is why only 0-3 are pre-term. **Superseded for V3** —
see the V3 section below; the term-time rate is now ~7h/week and Taiwan is ~2h/day, not zero.

**Biggest structural change:** everything actionable becomes one task model (D-037). Sprint
goals, the academic tracker, daily to-dos, and Canvas assignments stop being four separate
lists.

**V1 shipped 2026-08-21**, four weeks ahead of the 2026-09-18 code deadline. Public
portfolio, resume generator, passkey auth, vault writes, freshness audit, athletics with
Hevy import, and the Work/Academics/Calendar/Hobbies surfaces are all live.

**Closed 2026-08-30:** the domain (§7.1) is done and verified live — the apex serves 200,
`www` 307s to it, and `sitemap.xml` advertises `https://victorgusev.com`. The old note here
claiming sign-in was broken is stale twice over: the variable is set correctly in Vercel, and
`relyingParty()` now derives the apex as `rpID` and accepts both origins, so a `www`/apex swap
can no longer break a passkey. Note `web/.env.local` still says `www` — local only, cosmetic.

**Open on Victor, in priority order:**
2. **Publish the internship sheet as CSV** and send the URL — needs a connection, so before
   you fly. It unblocks §7.6. See `docs/UPLOADS_NEEDED.md` §1.2.
3. ~~**Write the five case studies.**~~ **Done 2026-08-29** — all five are written and live;
   `scripts/case_study_status.py` reports every real project complete. Only Smart Bottle has
   unwritten sections, and it is new scope, `draft: true`, and off every resume.
4. **Add Fall 2026 classes to Google Calendar.** No code is waiting on this — the schedule
   appears on its own once they exist.
5. **`docs/UPLOADS_NEEDED.md`** — the data only you can supply, split into what needs a connection
   and what is plane work. Requested for 2026-08-27.

**Reported done 2026-08-25, not yet verified from here:** production passkey enrolled, and
`GOOGLE_CALENDAR_KEY` / `CANVAS_CALENDAR` / `DATABASE_URL` / `GEMINI_API_KEY` set in Vercel.
The weekly summary (V2_PLAN §1.5) is the first thing that will notice if the key is missing.

**Cut rule:** spent. Days 16-20 and 21-29 both landed early; the CSV import shipped.

**Retiring `/sprint-review`:** goal editing now lives on `/private` itself; the separate
`/private/sprint` route no longer exists. The slash command comes out once Victor confirms
he has used the editor at least once — still open.

### V3 — scoped 2026-08-30. **The phone.**

Full plan: `docs/V3_PLAN.md`, rewritten from scratch. Decisions **D-126 to D-141**.

The old V3 (resumes, filament, job sheet — 26h at 4h/week, no deadline) is superseded. The
goal is now: **2ndMind becomes an installed app on the Samsung that works with no internet
and re-syncs on reconnect.** Scope settled by 44 questions.

| | |
|---|---|
| Delivery | **PWA installed to the home screen.** Not Capacitor, not React Native (D-126). |
| Offline | Log + read cached. Everything cached forever, biometric-gated (D-131). |
| Sync | Client UUIDs on creates, LWW on edits (D-127). Failures held, never dropped (D-129). |
| Unlock | WebAuthn assertion verified locally in the service worker (D-128). |
| Nav | Bottom tab bar on mobile; desktop untouched (D-132). |
| Also in | Light mode (D-135), Prettier (D-136), error aggregation (D-137). |

**Time budget:** ~2h/day 08-30 → 09-07 (18h, partial connection), **6h/day 09-08 → 09-18
(66h)**, then ~7h/week taken flexibly (~104h). ~188h total.

- [x] **Phase 0 · In transit** (18h) — **COMPLETE 2026-08-30.** All six items done. Gates
      green: 590 tests, typecheck and lint clean, `npm run shots` passing at four widths, and
      everything verified against a **production build** rather than the dev server.
  - [x] **0.1 · Dependencies** (1h) — done 2026-08-30. 103 packages, exit 0.
        `@sentry/nextjs` resolved cleanly against Next 16.3.1. Verified offline-capable:
        `npm ci --dry-run --offline` resolves the whole tree from cache.
  - [x] **0.2 · Prettier** (2h) — done 2026-08-30. 91 files reformatted, net −5 lines;
        typecheck clean, 582/582 tests. Two measured deviations from defaults
        (`printWidth: 100`, `endOfLine: "auto"` — the second prevents `--check` failing on a
        fresh clone). Scope in `.prettierignore`, reasoned in D-142. Hook is
        `.githooks/pre-commit` + `core.hooksPath`, not husky; all four paths tested.
        **Closes the `DECISION NEEDED` open in `web/context.md` since V1.**
  - [x] **0.3 · Sync model on paper** (3h) — done 2026-08-30. Spec in `docs/SYNC_DESIGN.md`;
        D-127–D-129 each gained a *Designed* block naming the failure it prevents. Reading the
        real schema found three problems the plan could not see: only 4 of 7 tables need a
        client id (the rest have natural keys), `rehab_completions` **cannot sync as built**
        because it hard-deletes on toggle, and almost nothing has an `updated_at` — so Phase 1
        opens with a migration. Clock is an HLC, not `Date.now()`. Test list §10 feeds §1.4.
        **Closed same day: log entries only.** Answered "workouts too" first, then reversed —
        the excursion is worth keeping because it found the parent-child FK problem and its fix
        (`SYNC_DESIGN.md` §4a, designed but not built). Log-only means `workouts`/`workout_sets`
        are pull-only, §1.2 stays at 14h, and **Phase 1 fits its window again at 65h of 66h.**
        Nothing is lost: the Training log category already carries exercise, weight, reps,
        distance, duration, SPM and RPE.
  - [x] **0.4 · Mood/energy fields** (2h) — done 2026-08-30. New `scale` field type, fixed at
        1-5, anchored at the ends (*wrecked...great*, *empty...wired*) — the mitigation for the
        standing objection, not a withdrawal of it. Five tap targets rather than a number
        input. Out-of-range values are dropped, not clamped: a fabricated point is worse than a
        missing one. `readField` moved to `lib/log/form.ts` to be testable. **590 tests**, up
        from 582; the old test asserting these fields' *absence* was inverted, not deleted.
  - [x] **0.5 · Bottom tab bar** (7h) — done 2026-08-30. **Today · Train · [Log] · Next ·
        More.** Victor chose Calendar over Academics for the fourth tab. **First task on a
        phone: 356px → 265px**, because the mobile layout no longer carries the scrolling nav
        row; D-083 took it 791px → 356px, this takes another 91px. Desktop untouched at 330px.
  - [x] **0.6 · Icon, splash, manifest** (3h) — done 2026-08-30, **verified on the phone**.
        A brain **seen from the side** in magenta, drawn as a silhouette with the folds cut out
        because thin strokes vanish at 48px. `brain.svg` + `scripts/render-icons.mjs`
        (Playwright, offline). Separate maskable variant at 58% fill, because One UI crops to a
        squircle. No splash asset needed — Android composes it.
        Shipped first as a **top view**; installing it showed the install path and the launcher
        tile were both fine and the *shape* was the problem — a top view is a lumpy oval, and
        the outline people recognise is the profile. Redrawn left-facing with cerebellum and
        stem (**D-145**). Note what happened: the device check was written to catch cropping
        and fold legibility, and it caught neither of those — it caught the drawing.

**Found while building 1.1, and the more useful of the two findings:** three files each
claimed to state the app's ground colour and all three disagreed — the page was `#140a10`, the
Android splash `#100a0e`, and the status bar `#0a161b`, a leftover teal from the palette D-002
replaced. None of it is visible on a laptop; the status bar only exists on a phone and the
splash colour shows for about 200ms. **The device check had just been run and missed both**,
because someone watching a launch animation is looking at the icon. Now one constant with a
test pinning all four sites (D-147). The rule: *a value that only shows up somewhere you rarely
look needs a test, not an inspection.*

**Found while building 0.5 (D-143), and worth knowing generally:** Tailwind's `hidden sm:flex` and
`flex max-sm:hidden` *both* fail here — a base display utility beats its own responsive variant,
confirmed in a production build. The nav switch is plain unlayered CSS instead. Nearly recorded
wrong: the first diagnosis came from `next dev`, which was also reporting `px-5` and `pb-24` as
computing to `0px` when a real build applies them correctly. **A CSS finding is not a finding
until it reproduces in `npm run build`.**
- [ ] **Phase 1 · The app** (65h) — PWA shell, IndexedDB + outbox, sync engine, sync tests,
      biometric unlock, fast log paths, failed-sync retry. **⚑ Milestone A — 2026-09-18.**
      Opened early, on 2026-08-30, because Phase 0 closed on day one of its nine-day window.
  - [x] **1.1 · PWA shell** (8h) — done 2026-08-30. Service worker registered, install button,
        and a persistent "new version is ready" bar. **608 tests**, up from 590, plus a
        nine-check browser run against a production build.
        The load-bearing idea is the **build stamp** (D-146): a browser only re-installs a
        service worker when the file's bytes change, so `scripts/build-sw.mjs` writes
        `public/sw.js` with the commit baked in. Without it every deploy that does not touch
        the worker ships silently and the phone keeps running old code against a new server.
        Two honest corrections to the plan. The "reload toast" does **not** auto-dismiss — one
        that vanishes on a timer is one you miss while typing. And "survives a cold start with
        the network off" was moved to Milestone A: opening on the *dashboard* offline needs the
        precached shell, the local store and offline auth together, none of which are §1.1.
        What §1.1 does guarantee is that a cold offline start lands on the app rather than a
        browser error page.
  - [x] **Interlude, 2026-08-31** — two fixes Victor asked for before 1.2.
        **The icon is proportioned like a brain** (D-148). The side profile was still
        essentially round at 1.05 : 1; it is now 1.65 : 1, with a proper temporal lobe, a chunky
        cerebellum tucked under the occipital, a short thick stem, and 13 folds instead of 7.
        Three obvious ideas made it worse and were reverted — cutting the fissure as a wedge in
        the outline (turns the mark into a shrimp), spacing the folds evenly (reads as a rib
        cage), and sitting the cerebellum behind the occipital rather than under it. Checked by
        downscaling with no smoothing: holds at 48px and above, **degrading at 36px**, which is
        the honest cost of the fold count.
        **The private app no longer wears the public header and footer** (D-149). It had three
        navigations stacked on a phone. First task on `/private`: **265px → 208px** on a phone,
        342px → 285px on a desktop. A "Public site" link in the desktop nav row and the phone
        More sheet is the way back. **611 tests**, up from 608.
        Also fixed a gate failure that looked like a flake and was not: the first `npm run
        shots` after any build timed out on `/private`, because the daily AI summary is a live
        Gemini call on a cold cache and Playwright's default `goto` timeout is 30s.
  - [x] **1.2 · The offline store** (14h) — done 2026-08-31. **660 tests**, up from 611.
        Three pieces. A **migration** giving every syncable table a clock, a cursor and a
        tombstone, with the cursor maintained by a database trigger rather than by code —
        because code that forgets to bump it does not error, the row just stops reaching the
        phone, and nobody notices until data is missing. A **hybrid logical clock**, which is
        what decides who wins when the phone and the laptop disagree: a plain timestamp means
        a phone whose clock jumps on a flight wins every conflict for the rest of the day. And
        the **local database plus outbox** on the phone, where a write lands first and waits.
        The last three hard deletes are gone. `rehab_completions` was genuinely broken for
        sync: it toggled by insert-or-delete, and offline there is no way to tell a phone that
        un-ticked an item from a phone that never had it.
        Found while building, none of it in the spec: a soft delete does not cascade (deleted
        workouts left their sets counting toward PRs); filtering a LEFT JOIN's right side in a
        `WHERE` silently makes it an INNER JOIN; and re-recording a deleted bodyweight day
        needed the tombstone cleared or the save looks like it failed.
        **Nothing is sent yet** — that is 1.3. The outbox fills and waits.
  - [x] **1.3 · The sync engine** (12h) — done 2026-08-31. **700 tests**, up from 660.
        The phone now actually sends. One endpoint pushes the outbox and pulls what changed in
        a single round trip, and the app flushes on three triggers: opening it, reconnecting,
        and bringing it back to the foreground. Reconnect alone is not enough — hotel wifi with
        a sign-in page reports "online" — and an installed app sits in the background for hours
        with nothing to wake it.
        The design got simpler in one place: there is **no table of applied operations**. The
        clock already answers the question. An entry whose stamp matches the one stored is one
        that already arrived, so a retry after a lost reply is recognised for free rather than
        logged twice.
        **A bug the tests caught that would have been near-invisible:** the "more waiting" flag
        could say *no* while entries were still queued, and the app only asks again when told
        there is more. The symptom would have been "sync is slow sometimes", which is not
        something you can report or chase.
        **Still open, on purpose:** the round trip against the real database has not been run,
        because it would write test entries into the actual log and there is nothing left that
        hard-deletes to clean them up. That one is Victor's, on the phone.
  - [x] **1.4 · Sync tests at the database layer's bar** (8h) — done 2026-09-01.
        **710 tests**, up from 700. Six named cases, each checked by taking its fix out and
        watching that test go red rather than by reading the code and agreeing with it.
        Four of the six were already covered and only needed naming. The fifth found a real
        bug, and a quiet one: the piece that keeps the two devices' clocks in step had been
        written and tested weeks ago and **was never actually plugged in**. The effect was
        that a phone running five minutes fast — an ordinary phone that has not checked the
        time in a while — would make later edits from the laptop disappear, with no error on
        either device. Now fixed.
        Both bugs found this phase have been in the wiring rather than in the parts, which is
        an argument for the kind of test this section added: one that runs the real phone-side
        code against the real database with nothing faked in between except the network
        dropping.
  - [x] **1.5 · Local biometric unlock** (9h) — built 2026-09-02. **761 tests**, up from 710.
        The private app now opens to a lock screen and needs a fingerprint, with the check
        done on the phone itself — no signal required.
        The plan said to do this inside the service worker. That turned out to be impossible
        rather than merely awkward: the browser does not expose the passkey prompt to a
        service worker at all. The part that mattered — verifying without a server — is done,
        in the page.
        **Worth being clear about what it protects.** It stops someone picking up an unlocked
        phone from reading the log. It does not encrypt anything, so it is not protection
        against someone technical with the device in hand; the phone's own lock screen is
        still the real defence. The stronger version, where the offline copy is actually
        encrypted and the fingerprint is the only way to read it, is a much bigger piece of
        work and carries a real risk: lose the passkey, lose the data.
        **Yours to check, on the phone:** airplane mode, open the app, unlock with a
        fingerprint. Then do it again and cancel the prompt — it should stay shut.
  - [x] **1.6 · Fast log paths** (8h) — built 2026-09-02. **808 tests**, up from 761.
        Logging is much faster now. The form remembers the things that repeat — which kind of
        session, which course, whether an application was tailored or a quick apply — and
        recent exercises, companies, books and people appear as buttons you tap instead of
        typing. A training chip brings last time's numbers with it: tap "Bench Press · 185 × 5"
        and all three fields fill.
        **The line I drew, and why.** The form will never quietly pre-fill a *measurement*.
        A remembered "erg" is obvious if it is wrong; a remembered 185 lbs that you save
        without looking is a number in your log that reads as measured. Weights and times come
        back only through a chip — which prints them on the button, so it is your choice
        rather than something that happened while you were not looking.
        Also fixed: a save that failed used to wipe what you had typed. It puts it back now.
        **Yours to close:** log one Training, one Applications and one Reading or People entry
        one-handed with a stopwatch, and tell me the three numbers. Under 15s each is the bar.
  - [x] **Fixed 2026-09-03: the app was down, and it was my fault.** The database change that
        §1.2 needed was written three days ago and never actually run against Neon. The code
        kept asking for columns that were not there, so every page that touches tasks, the
        log, workouts, bodyweight or rehab broke at once. Applied now; nothing was lost (there
        were six rows in the whole database).
        **Why no test caught it:** the tests build a throwaway database and apply every change
        to it from scratch, so the version they check is always exactly the version the code
        expects. Drift between the code and the *real* database is the one thing they are
        structurally unable to see. 808 passing tests said nothing about it.
        Two things now guard it. `npm run db:status` says whether the real database is behind.
        And the error you saw — a wall of SQL — now reads "the database is behind this build,
        run npm run db:migrate". Writing that fix turned up a second bug: four copies of the
        error message code existed and **all four had never worked**, because the real error
        was nested one level deeper than any of them looked.
  - [x] **Fixed 2026-09-03: the two things you found on the phone.** **841 tests**, up from 816.
        **No biometric login.** The lock only remembered your passkey at the moment you signed
        in — and since a sign-in lasts a week, a phone signed in before that shipped never got
        one. An unarmed lock just opens, so there was nothing to see and nothing to report
        except its absence. It now fetches what it needs the first time it has signal, so you
        do not have to sign in again.
        **"This page needs a signal" with full bars.** Three faults stacked. The app gave up
        after one failed request, when a single dropped request on a phone is completely
        ordinary. The page then blamed the network without checking — being wrong is worse
        than being vague, because it sends you hunting for a problem that is not there. And it
        was a dead end: no retry, no way back. It now retries once on its own, says which page
        failed, checks whether you are actually online before claiming anything, and gives you
        a button.
  - [x] **2026-09-04 — the fingerprint lock is off, and two offline fixes.** **842 tests.**
        **Removed the lock**, as you asked. It is switched off, not deleted: the code and all
        its tests are still there and turning it back on is one line, which is written down in
        the decision log. If you ever want the middle version — locks after a few hours away
        rather than every time you open it — that is a small change rather than a rebuild.
        **Two offline things were mine.** The app retried failed pages even with the radio
        off, which bought nothing and doubled how long you stared at a blank screen; that was
        the "stalls and never shows anything". And the offline page's buttons needed
        JavaScript to appear — on the one page whose whole job is to work when things are not
        loading. Its links are now part of the page itself.
        **The rest of "nothing works offline" is not a bug — it is unbuilt.** Reading and
        showing pages with no signal is Phase 2 (§2.1, §2.2). Phase 1 built the machinery to
        log offline but no screen you can reach without signal.
        **That is worth a decision from you**, because Milestone A on 09-18 promises "logs
        with no signal" and the work that makes that possible is scheduled to start on 09-20.
        Options are in the plan, §7b — pull ~10h forward, move the date, or restate what
        Milestone A means.
  - [x] **2026-09-03 — the log, reworked around how you actually use it.** **875 tests**, up
        from 842. Four things you said, four changes.
        **Training logs sets now.** It used to ask for one weight and one reps, so three sets
        of bench press were three separate entries or a third of the truth. You type the
        exercise once and add a row per set, the way the Training tab always did. Adding a
        set copies the one above it, because the second set is nearly always the first one
        again.
        **Those sets count.** They go to the PR board, the strength charts, the weekly volume
        and the bodyweight-adjusted erg table, exactly like a Hevy import does. That was the
        expensive half — the phone is not allowed to create a workout, for reasons written
        down back in the sync design — so instead the records read from both places and do
        not care which one a set came from.
        **You can weigh in from Training.** The number goes to the weight chart, not into the
        entry, so there is only ever one copy of it.
        **Applications is gone** — that is the Google Sheet's job — and **Study is just the
        course and the hours** now. No grade, no status. Anything else goes in the note.
        Old application entries still read correctly in the timeline and in search; the
        category is retired, not deleted.
        **The Training tab no longer has its own logging form.** It links to the log instead,
        which works fine on a laptop. The old form is still in the repo if entering a whole
        backdated session one exercise at a time turns out to be worse.
  - [x] **2026-09-05 — nothing gets lost, and the app opens without signal.** **949 tests**,
        up from 875. Two sections in one go.
        **1.7 — entries that have not sent.** There is a screen now, at Not sent, listing
        anything the server has not taken and saying why in plain words rather than printing
        the error. The badge grows louder instead of quieter: a quiet count while things are
        just waiting, the age once something has sat for a day, and red once the server has
        actually refused it. **There is no delete button, on purpose.** An entry in that list
        is the only copy of something you wrote, and the app offering to bin it at the moment
        it is being annoying is how a log stops being trusted. One button: send it again.
        I checked this the hard way rather than by reading the code — a test writes a bad
        entry, has the server reject it, then restarts the app ten times and confirms it is
        still there, still explained, every single time. Then it fixes it and watches it go.
        **2.1 — the app now opens with the radio off.** This is the one you reported on the
        4th: with no signal every page landed on "that page did not arrive", while the phone
        was quietly holding a day of tasks and a week of training that nothing could show you.
        Airplane mode now opens on a cached copy — what is due today, what you have logged
        today, your last weigh-in and recent sets, and coursework by class. Every screen says
        how old it is, always, even when that is two minutes.
        **What it will not show you, and says so.** Your calendar, the daily summary, course
        notes, and the PR board. The first two need the network; the records need your whole
        training history and only part of it is on the phone, so a PR board built there would
        be too low and look confident about it. Each of those says why it is missing rather
        than sitting empty and reading as "nothing today".
        **Still not true:** you can read offline but not write. Logging with no signal needs
        the form itself cached, which is the next piece (§2.2, 6h). Worth deciding what
        Milestone A on the 18th should claim — see §7b in the plan.
  - [ ] **2.2 · Public precache** (6h) — also closes offline writing. Next.
- [ ] **Phase 2 · Offline everything** (28h) — cached reads, public precache incl. resumes,
      offline full-text search, error aggregation, device checklist. ~10-18.
- [ ] **Phase 3 · Feel** (31h) — layout pass, gestures, motion, shortcuts, Playwright
      offline suite. ~11-15.
- [ ] **Phase 4** (29h) — push, light mode, voice-parsed entry, resume upload. ~12-13.
- [ ] **Phase 5** (16h) — filament (reorder-first), course planner (desktop-only). ~2027-01-03.

**Done when:** the app is on the home screen and two real weeks pass without reaching for the
laptop to log. Behaviour, not a date.

**Named risk (D-140):** ~187h of scope against ~188h available. Full scope was kept over an
explicit recommendation to cut ~60h — Victor's call, timeline extends rather than scope
shrinking. Phase 1 in particular is 65h of work in a 66h window with a hard date. **It will
slip**; when it does, 1.6 and 1.7 move to Phase 2 and the app still installs and still syncs.

**Deferred to V4:** photo capture (Victor's explicit call), editing the job sheet (D-141),
the Android share target, a portfolio-only "show" mode (D-130 accepts the exposure instead),
semantic search (cut a fourth time — it cannot work offline).

**Blocked on Victor:** filament inventory + printer status vocabulary (`UPLOADS_NEEDED.md`
§2.1-2.2) blocks Phase 5.1; the resume PDFs themselves block Phase 4.4.

## 2. Operational Rules & Boundaries
- **The Weekly Purge:** At the start of every sprint, any blocker or to-do that has rolled over twice must be: (1) Hard-scheduled into a calendar block, (2) Delegated to an AI, or (3) Ruthlessly deleted. No endless piling up.
- **Deep Work Curfew:** Deep, stimulating engineering/study blocks must conclude by 10:30 PM to allow a 30-minute neurological wind-down for an 11:00 PM sleep target.
- **Academic Front-Loading:** The majority of the 8-10 weekly study hours should be front-loaded on Monday and Tuesday to clear the end of the week for projects and racing.
- **Focus Mechanism:** Utilize the Pomodoro technique (25 minutes deep work, 5 minutes rest) for all textbook studying and LeetCode prep.

## 3. Academic Tracker (Secondary to Canvas)
*Use this space to manually track upcoming midterms or massive projects that span multiple sprints.*
- [ ] 
- [ ] 
