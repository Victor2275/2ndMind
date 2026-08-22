---
updated: 2026-08-21
domain: operations
stability: volatile
summary: This week's goals, operating rules, and academic tracker.
read_when: Always — anything about current priorities or scheduling.
---

# Current Sprint: 1-Week Horizon

## 1. Active Sprint Goals
*Identify top 3 priorities across all domains for the week here.*
- **Engineering / Career:** Ship the 2ndMind public site. Live at
  https://victorgusev.vercel.app since 2026-08-21. Resume generator, passkey auth, vault
  writes, freshness audit, athletics, and the remaining private surfaces all done. V1 is
  complete; next is the V2 scope conversation.
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
- [ ] **3 · Today** (8-10h) — one screen: classes, what is due, what you chose to do.
- [ ] **4 · Calendar** (10-14h, during term) — Google and Canvas private iCal feeds. No
      OAuth, no cost.
- [ ] **5 · Athletics with real data** (12-16h, during term) — manual entry first, charts,
      bodyweight, rehab checklist, weight-adjusted split.
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

**Blocking on Victor, before 2026-08-29:** production is still switched off. Vercel has none
of the environment variables — `/signin` on the live site reports "Not configured". Set
`SESSION_SECRET` (a different one from local), `GITHUB_TOKEN`, `NEXT_PUBLIC_SITE_URL`, and
`DATABASE_URL` in Vercel, redeploy, then enrol a second passkey against the live origin per
`web/REGISTER_PASSKEY.md` — a passkey is bound to the origin it was created on.

**Cut rule:** spent. Days 16-20 and 21-29 both landed early; the CSV import shipped.

**Retiring `/sprint-review`:** the web sprint editor exists at `/private/sprint`. The slash
command comes out once Victor confirms he has used the editor at least once — still open.

## 2. Operational Rules & Boundaries
- **The Weekly Purge:** At the start of every sprint, any blocker or to-do that has rolled over twice must be: (1) Hard-scheduled into a calendar block, (2) Delegated to an AI, or (3) Ruthlessly deleted. No endless piling up.
- **Deep Work Curfew:** Deep, stimulating engineering/study blocks must conclude by 10:30 PM to allow a 30-minute neurological wind-down for an 11:00 PM sleep target.
- **Academic Front-Loading:** The majority of the 8-10 weekly study hours should be front-loaded on Monday and Tuesday to clear the end of the week for projects and racing.
- **Focus Mechanism:** Utilize the Pomodoro technique (25 minutes deep work, 5 minutes rest) for all textbook studying and LeetCode prep.

## 3. Academic Tracker (Secondary to Canvas)
*Use this space to manually track upcoming midterms or massive projects that span multiple sprints.*
- [ ] 
- [ ] 
