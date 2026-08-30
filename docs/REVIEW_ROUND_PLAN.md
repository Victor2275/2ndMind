# Offline review round — status and remainder

Victor reviewed a frozen snapshot of the site while travelling, wrote the six case studies,
and returned a change list on 2026-08-29. This tracks what came out of it.

**Context.** Code deadline is **2026-09-18**; move-in 09-19, fall term starts 09-20. After
that the rate drops to ~4h/week. V2 feature 6 (AI) and §7 were the open items before this
round; the domain (§7.1) is still parked on Victor.

Decisions from this round: `web/DECISIONS.md` **D-106 – D-125**.

---

## Done

### Public site

| Change | Where |
|---|---|
| Persona → "Robotics Engineer" | `core_profile.md` |
| Bio rewritten | About hero |
| "Outside the lab" → **Hobbies and Interests** | About |
| Projects cards moved **above** hobbies | About |
| Hobby cards: metrics and italic carry-over gone, tighter padding | About, `public.ts` |
| Dragon Boat / Fabrication / Baking rewritten; kickers and the Baking title changed | `pursuits/` |
| Dimaag: ongoing, >10 mph, 80% error reduction, LLM bullet cut | `experience/dimaag.md` |
| An ongoing role renders **"Present"** from vault data | About |
| FIRST: 40+ members; hardware-collaboration bullet dropped | `experience/first-robotics.md` |
| MathCounts and Lifeguard bullets added — for Tailor, **not** for resumes | `experience/` |
| `/projects` lede deleted | `/projects` |
| Projects reordered: Proof → Micromouse → 5SR → Solenoid → TaskAble → Smart Bottle → Paper | `order:` field |
| Tiers removed everywhere, incl. card styling and the catalog index | schema, `public.ts`, `build_indexes.py` |
| `archived` → **`done`** across schema, files and badges | schema + 5 files |
| Water Bottle Scale deleted; **Smart Bottle** created | `projects/` |
| **Dimaag paper** project created, deliberately vague | `projects/dimaag-paper.md` |
| `/now` lede → "Current active projects"; now shows Smart Bottle + the paper | `/now` |
| Proof marked `done`, and gains its hero image | `projects/proof.md`, `context/assets/` |
| Experience order fixed: Dimaag, FIRST, MathCounts, Lifeguard | `order:` on experience |
| "Write-up pending" removed from every public page | grid, `/now`, project detail |
| Resume variant row is fixed and complete, current one marked | `/resume/[variant]` |
| Repo root tidied: plans to `docs/`, source documents to gitignored `private/` | root |

**Case studies, corrected against the real repos** (both public, cloned and read):

- **5 Second Rule** — "top 50%" now carries its denominator: Ludum Dare 58 took **1,390
  submitted entries**, theme "Collector", October 2025.
- **Micromouse** — the claim was `O(n log n)` with a note to check. It is neither: the
  committed solver is a wavefront pass per distance layer, **O(n·d)**, bounded by the 16×16
  grid. The first version copied the visited-set at every recursive call, which is the
  slowness the case study describes. Rewritten to say that.
- **Proof** — "100% uptime" removed. Counted from the public repo instead: **99 automated
  tests across 22 files, 40 React components, ~9,000 lines, 31 runtime dependencies**. An
  earlier draft also claimed "no rollback"; that was never verified, so it is gone.
- **TaskAble** — the "Measured results" heading is removed rather than filled. No placement,
  no number, and an invented one would be worse than the gap.
- **Solenoid** — stray `>` that was rendering his prose as a blockquote.

### Resume

Proof is on the robotics variant at **2 bullets**, via a new per-entry `resume_bullets` cap
(D-115) — "less bullets" was the instruction, not a space fix.

**MathCounts and Lifeguard are not on any resume.** Their bullets exist so the Tailor library
can reach them; that library no longer reads `resume_variants` (D-118), so the two are
independent. An intermediate version did put them on all three variants, which pushed every
one to two pages and cost Solenoid and TaskAble a bullet each to fix; both were restored once
the roles came off. Variants now print at **0.93 / 0.89 / 0.91**.

### Private site

- **Tailor is a sub-tab of Work** at `/private/work/tailor`, with a `WorkTabs` sub-nav. The
  top-level nav is back to eight items.
- **Inbox on Today** — one capture field, a task row with `source: "inbox"`, nagging on the
  **age of the oldest note** (7 days) rather than the count. Oldest-first, so the backlog
  cannot hide.
- **Goals merged.** "This week's goals" and "Draft next week" are one panel; drafting is
  nested inside it, still closed. Backlog is now closed by default. Both answer "too dense".
- **Academics reads the degree audit.** `scripts/parse_dars.py` derives
  `context/01_engineering/degree_audit.md` from a saved DARS page: 35 requirements, **15
  unfulfilled**, with what satisfies each. Raw `DARS*.html` is gitignored — it carries the
  student ID, high school, and full grade history.
- **Tailor library is vault-wide** (D-118). It reads every experience, project and pursuit
  bullet directly rather than unioning the resume variants, so MathCounts, Lifeguard, CAD,
  SolidWorks and 3D printing are all reachable while being on no printed resume. The parser
  guardrail is unchanged: the model may still only name ids it was handed.
- **Tailor answers posting questions** (D-117). A second panel takes one written application
  question and returns the bullets to build the answer from, an angle, and a "do not claim"
  note. It deliberately does **not** draft the answer — a drafted answer is the model's prose
  under Victor's name, and the prompt explicitly forbids asserting a motivation he never
  gave. 8 new tests.

### Found while doing it

**Your erg split was hard-coded in a client chunk.** `2:17` was the placeholder in the
workout form and the log category definition — shipped to `/_next/static/chunks/`, which is
served without authentication. It was harmless while the split was public; you made it
private in this same round (Q20). Replaced with `m:ss`. This is `AGENTS.md` rule 3, and a new
rule 5 now says the matching thing about projections.

**Verification:** 560 tests across 34 files passing, typecheck clean, production build clean,
`npm run shots` clean at four widths with zero horizontal overflow and all three resumes on
one page, and the built client chunks scanned for the pursuit telemetry that stopped being
published.

---

## Remaining

### Blocked on Dimaag

1. **Paper clearance.** When it lands, rewrite in this order — `confidential_scope` first,
   then `projects/dimaag-paper.md`, then the resume bullets — so the boundary is never behind
   the content. The brief you supplied (TRPO + IPO barrier, bounded corrections, the caster
   sim-to-sim gap, teacher–student distillation) is enough to write the project page in one
   sitting once cleared.
2. **Repo access.** Not needed for the site; needed if you want the paper's method section
   drafted against the actual code rather than the brief.

### Blocked on you

3. **The domain** (V2 §7.1) — still parked, still the top open item. Make the apex primary in
   Vercel, set `NEXT_PUBLIC_SITE_URL=https://victorgusev.com`, redeploy, **then** re-enrol the
   passkey. Order matters. Sign-in on the live site does not work until this is done.
4. **Verify the Proof metrics.** 99 tests / 22 files / 40 components / ~9k lines / 31 deps,
   counted from the public repo at `HEAD`. Sanity-check them before an interviewer does.
5. **Confirm the 5 Second Rule placement.** 1,390 entries is confirmed; *your* rank is not —
   the itch.io page shows no placement and I could not find the ldjam entry. If you have the
   results page, an exact percentile is stronger than "top half".
6. **Smart Bottle case study.** The file is scaffolded with prompts and marked
   `draft: true`, so the site says "write-up pending" rather than pretending. It reaches
   `/now` today on the strength of its summary.

### Not started — scoped, not built

7. **The three-year plan** (~6–8h). This is the real remainder of the DARS work. What exists
   now is the audit *read*: what is unfulfilled and what satisfies it. What you asked for on
   top is a planner — assign courses to future terms, check them against the outstanding
   requirements, see whether the June 2028 track actually closes. That needs a `planned_courses`
   table, a term-grid UI, and a validator against `degree_audit.md`. **Recommend V3**: it is
   the largest single item left and it is not deadline-shaped.
   - Worth knowing: your DARS says **Degree Expected Term 2029 SPRING**, the catalog default.
     Your three-year track is not reflected in it, so the planner is also how you would show
     the plan closes a year early.
8. **Calendar month view** — you said V3. Noted in `docs/V3_PLAN.md` territory, not started.
9. ~~**V2 feature 6 (AI), remainder**~~ — **done 2026-08-30.** Summaries are stored in an
   `ai_summaries` table (migration 0004, applied to Neon) and read back in an "Earlier
   summaries" panel on Today. Fallback text is never stored. D-124.

### Suggested order before 09-18

The domain first — it is one click plus a redeploy and it is the only item that leaves the
live site broken. Then the daily-summary logging (2h, closes feature 6). Then paper clearance
when it arrives, since it is the highest-value public content and cannot be scheduled. The
three-year planner and the calendar view go to V3, after term starts.
