---
updated: 2026-08-30
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

- [ ] **Phase 0 · In transit** (18h) — **6h done, 12h left.** Nothing left here needs a deploy
      or a connection.
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
        **Open for Victor:** does the phone create `workouts`, or only `log_entries`? Leaning
        log-only; it halves the migration.
  - [ ] **0.4 · Mood/energy fields** (2h)
  - [ ] **0.5 · Bottom tab bar** (7h)
  - [ ] **0.6 · Icon, splash, manifest** (3h)
- [ ] **Phase 1 · The app** (65h) — PWA shell, IndexedDB + outbox, sync engine, sync tests,
      biometric unlock, fast log paths, failed-sync retry. **⚑ Milestone A — 2026-09-18.**
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
