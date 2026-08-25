---
updated: 2026-08-25
domain: operations
stability: volatile
summary: This week's goals, operating rules, and academic tracker.
read_when: Always — anything about current priorities or scheduling.
---

# Current Sprint: 1-Week Horizon

## 1. Active Sprint Goals
*Identify top 3 priorities across all domains for the week here.*
- **Engineering / Career:** 2ndMind is live at https://victorgusev.com. V1 complete
  2026-08-21. V2 features 0, 1, 2, 4 and 5 shipped; 3 is largely built; 6 (AI) is the only
  one not started. Its scope is now decided (V2_PLAN rev 2, D-076 to D-080).
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

Full ordered plan with difficulty and estimates: `V2_PLAN.md` at the repo root.
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

Revisions 3 and 4 (2026-08-25) added ten requested items as `V2_PLAN.md` §7. **Seven are in
V2**: the domain, the uploads list, the four uploaded images, retiring culinary, the public
`/now` Working page, the public→private button, and read-only access to the job sheet.

**Semantic search is cut** to pay for them (D-087) — 12h out against 11.5h in, so V2 got
shorter while gaining three features. It has now been assessed three times: cut on cost,
reinstated when the budget turned out to be monthly, cut on time. **V3 is its own document,
`V3_PLAN.md`** — resumes, filament and printers, and editing the job sheet, ~26h scheduled at
a term-time rate of ~4h/week.

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
      page, public→private button, job sheet read-only. `V2_PLAN.md` §7.

**Time budget:** ~4h/day until 2026-09-20, then ~4h/week. Six features is 80-106h against
~76h before term, which is why only 0-3 are pre-term. Taiwan 08-29 to 09-07 is assumed to
be zero work.

**Biggest structural change:** everything actionable becomes one task model (D-037). Sprint
goals, the academic tracker, daily to-dos, and Canvas assignments stop being four separate
lists.

**V1 shipped 2026-08-21**, four weeks ahead of the 2026-09-18 code deadline. Public
portfolio, resume generator, passkey auth, vault writes, freshness audit, athletics with
Hevy import, and the Work/Academics/Calendar/Hobbies surfaces are all live.

**Open on Victor, in priority order:**
1. **Make the apex primary in Vercel, set `NEXT_PUBLIC_SITE_URL=https://victorgusev.com`,
   redeploy, then re-enrol the passkey.** The domain is connected but that variable is not set,
   so the site still advertises `victorgusev.vercel.app` in its sitemap and — because the same
   variable is the WebAuthn relying party — **sign-in on the live site does not work**. Order
   matters: flip the primary *before* enrolling, so it is done once. See `V2_PLAN.md` §7.1.
2. **Publish the internship sheet as CSV** and send the URL — needs a connection, so before
   you fly. It unblocks §7.6. See `UPLOADS_NEEDED.md` §1.2.
3. **Write the five case studies.** The prompts wait in each project file under
   `> **To write:**`. Nothing publishes until prose replaces them, and no agent will fill them
   in — that is the point of the convention (D-073) and D-069 is what happens when one tries.
   Plane work: no network, no computer beyond a text editor.
4. **Add Fall 2026 classes to Google Calendar.** No code is waiting on this — the schedule
   appears on its own once they exist.
5. **`UPLOADS_NEEDED.md`** — the data only you can supply, split into what needs a connection
   and what is plane work. Requested for 2026-08-27.

**Reported done 2026-08-25, not yet verified from here:** production passkey enrolled, and
`GOOGLE_CALENDAR_KEY` / `CANVAS_CALENDAR` / `DATABASE_URL` / `GEMINI_API_KEY` set in Vercel.
The weekly summary (V2_PLAN §1.5) is the first thing that will notice if the key is missing.

**Cut rule:** spent. Days 16-20 and 21-29 both landed early; the CSV import shipped.

**Retiring `/sprint-review`:** goal editing now lives on `/private` itself; the separate
`/private/sprint` route no longer exists. The slash command comes out once Victor confirms
he has used the editor at least once — still open.

## 2. Operational Rules & Boundaries
- **The Weekly Purge:** At the start of every sprint, any blocker or to-do that has rolled over twice must be: (1) Hard-scheduled into a calendar block, (2) Delegated to an AI, or (3) Ruthlessly deleted. No endless piling up.
- **Deep Work Curfew:** Deep, stimulating engineering/study blocks must conclude by 10:30 PM to allow a 30-minute neurological wind-down for an 11:00 PM sleep target.
- **Academic Front-Loading:** The majority of the 8-10 weekly study hours should be front-loaded on Monday and Tuesday to clear the end of the week for projects and racing.
- **Focus Mechanism:** Utilize the Pomodoro technique (25 minutes deep work, 5 minutes rest) for all textbook studying and LeetCode prep.

## 3. Academic Tracker (Secondary to Canvas)
*Use this space to manually track upcoming midterms or massive projects that span multiple sprints.*
- [ ] 
- [ ] 
