---
updated: 2026-08-22
domain: operations
stability: volatile
summary: This week's goals, operating rules, and academic tracker.
read_when: Always — anything about current priorities or scheduling.
---

# Current Sprint: 1-Week Horizon

## 1. Active Sprint Goals
*Identify top 3 priorities across all domains for the week here.*
- **Engineering / Career:** 2ndMind is live at https://victorgusev.vercel.app. V1 complete
  2026-08-21. V2 features 0, 1, 2, 4 and 5 shipped; 3 is largely built; 6 (AI) is the only
  one not started, and is the one needing a scope decision from Victor.
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

### V2 — scoped 2026-08-21

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
- [~] **3 · Today** (8-10h) — largely built already: tasks, goals, stats and the schedule
      section are all live on `/private`. Not formally closed out.
- [x] **4 · Calendar** — done 2026-08-22. Google and Canvas private iCal feeds via ical.js,
      agenda for today plus seven days, Canvas assignments importable as tasks. No OAuth, no
      cost. Two data gaps, neither a defect: the Canvas feed is empty (211 bytes, zero
      events) and Fall 2026 classes are not yet in Google Calendar.
- [x] **5 · Athletics depth** — done 2026-08-22. Concept2 weight-adjusted splits against
      the sub-2:00 goal, bodyweight table, rehab checklist and SPM targets parsed from this
      vault, week-plan-vs-logged review, server-rendered SVG charts.
- [ ] **6 · AI, narrowly scoped** (10-14h, last) — summarise the week, draft sprint goals,
      every vault write approved as a diff.

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
1. **Enrol a passkey on the production origin** (`victorgusev.vercel.app`). The local one is
   bound to `localhost` and will not work there. See `web/REGISTER_PASSKEY.md`.
2. **Set `GOOGLE_CALENDAR_KEY` and `CANVAS_CALENDAR` in Vercel.** They exist in `.env.local`
   only, so the production calendar page shows "No calendar feeds connected". These URLs are
   credentials — anyone holding one can read the calendar.
3. **Confirm Vercel's `DATABASE_URL` is the same Neon database as local.** Migration 0003 was
   applied to the local one; if production points elsewhere, `/private/athletics` errors
   there until it is migrated.
4. **Add Fall 2026 classes to Google Calendar.** No code is waiting on this — the schedule
   appears on its own once they exist.

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
