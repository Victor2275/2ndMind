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
  https://victorgusev.vercel.app since 2026-08-21. Resume generator done (three variants,
  print-to-PDF). Next: auth + vault writes, then the private dashboard.
- **Athletics:** Programming resumes at move-in (2026-09-20); nothing scheduled before then.
- **Academics:** Fall term starts 2026-09-20. Nothing due this sprint.

### 2ndMind build status
Plan runs to 2026-09-18 (real code deadline — travel 08-29 to 09-07, move-in 09-19).

- [x] Days 1-6 — vault refactor, typed parser, public-field whitelist
- [x] Days 7-12 — public site, breadth section, analytics, SEO, deployed
- [x] Days 13-15 — resume generator, three variants, print-to-PDF
- [ ] Days 16-20 — WebAuthn auth + GitHub Contents API vault writes + sprint editor
- [ ] Days 21-29 — private dashboard, freshness widget, athletics (Neon + Drizzle)
- [ ] Days 30-32 — Work/Academics/Calendar stubs, buffer

**Blocking on Victor, before 2026-08-29:** create the Neon account and mint the
fine-grained GitHub PAT (repo `2ndMind`, Contents: read/write). Both are network-dependent
and gate Days 16-20. Setup steps are in `web/.env.example`.

**Cut rule:** if Days 16-20 are not done by 2026-09-08, drop the workout CSV import first.

**Retiring `/sprint-review`:** the slash command stays until the web sprint editor lands in
Days 16-20, then goes.

## 2. Operational Rules & Boundaries
- **The Weekly Purge:** At the start of every sprint, any blocker or to-do that has rolled over twice must be: (1) Hard-scheduled into a calendar block, (2) Delegated to an AI, or (3) Ruthlessly deleted. No endless piling up.
- **Deep Work Curfew:** Deep, stimulating engineering/study blocks must conclude by 10:30 PM to allow a 30-minute neurological wind-down for an 11:00 PM sleep target.
- **Academic Front-Loading:** The majority of the 8-10 weekly study hours should be front-loaded on Monday and Tuesday to clear the end of the week for projects and racing.
- **Focus Mechanism:** Utilize the Pomodoro technique (25 minutes deep work, 5 minutes rest) for all textbook studying and LeetCode prep.

## 3. Academic Tracker (Secondary to Canvas)
*Use this space to manually track upcoming midterms or massive projects that span multiple sprints.*
- [ ] 
- [ ] 
