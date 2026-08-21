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
  writes, freshness audit, and athletics all done. Next: Work/Academics stubs (Days 30-32).
- **Athletics:** Programming resumes at move-in (2026-09-20); nothing scheduled before then.
- **Academics:** Fall term starts 2026-09-20. Nothing due this sprint.

### 2ndMind build status
Plan runs to 2026-09-18 (real code deadline — travel 08-29 to 09-07, move-in 09-19).

- [x] Days 1-6 — vault refactor, typed parser, public-field whitelist
- [x] Days 7-12 — public site, breadth section, analytics, SEO, deployed
- [x] Days 13-15 — resume generator, three variants, print-to-PDF
- [x] Days 16-20 — passkey auth, vault writes, sprint editor, logbook, dashboard
- [x] Days 21-29 — freshness widget, athletics (Neon + Drizzle, Hevy import, PRs)
- [ ] Days 30-32 — Work/Academics/Calendar stubs, buffer

**Local setup is done:** passkey enrolled, GitHub PAT set, Neon connected, athletics
tables migrated. Verified end to end against the real database on 2026-08-21.

**Blocking on Victor, before 2026-08-29:** production is still switched off. Vercel has none
of the environment variables — `/signin` on the live site reports "Not configured". Set
`SESSION_SECRET` (a different one from local), `GITHUB_TOKEN`, `NEXT_PUBLIC_SITE_URL`, and
`DATABASE_URL` in Vercel, redeploy, then enrol a second passkey against the live origin per
`web/REGISTER_PASSKEY.md` — a passkey is bound to the origin it was created on.

**Cut rule:** spent. Days 16-20 and 21-29 both landed early; the CSV import shipped.

**Retiring `/sprint-review`:** the web sprint editor now exists at `/private/sprint`. The
slash command comes out once Victor has signed in and used the editor once.

## 2. Operational Rules & Boundaries
- **The Weekly Purge:** At the start of every sprint, any blocker or to-do that has rolled over twice must be: (1) Hard-scheduled into a calendar block, (2) Delegated to an AI, or (3) Ruthlessly deleted. No endless piling up.
- **Deep Work Curfew:** Deep, stimulating engineering/study blocks must conclude by 10:30 PM to allow a 30-minute neurological wind-down for an 11:00 PM sleep target.
- **Academic Front-Loading:** The majority of the 8-10 weekly study hours should be front-loaded on Monday and Tuesday to clear the end of the week for projects and racing.
- **Focus Mechanism:** Utilize the Pomodoro technique (25 minutes deep work, 5 minutes rest) for all textbook studying and LeetCode prep.

## 3. Academic Tracker (Secondary to Canvas)
*Use this space to manually track upcoming midterms or massive projects that span multiple sprints.*
- [ ] 
- [ ] 
