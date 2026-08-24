# 2ndMind — Handoff

**Written 2026-08-22, revised 2026-08-24.** For an AI assistant picking this project up cold.

Read this, then `CLAUDE.md`, then `web/AGENTS.md` and `web/context.md`. `web/DECISIONS.md`
(69 entries) is the record of *why* things are the way they are — check it before undoing
anything that looks deliberate.

---

## 1. What this is

Victor Gusev's personal context vault (`context/`, markdown) plus a Next.js app (`web/`) that
renders it as two surfaces:

- **Public** — portfolio and resume for hiring managers. Statically generated.
- **Private** — a daily-use "second brain": tasks, logging, calendar, training. Behind a
  passkey.

Live at `https://victorgusev.vercel.app`. Repo is **private**.

**Timeline:** V1 shipped 2026-08-21. UCLA fall term starts 2026-09-20; the real code deadline
is **2026-09-18** because Victor travels to Taiwan 08-29 → 09-07 and moves in 09-19. Budget
~4h/day until term, ~4h/week after.

---

## 2. Hard constraints — read before writing any code

These are Victor's stated decisions, not suggestions. Violating one is the failure mode that
matters most here.

### Privacy

| Rule | Detail |
|---|---|
| **Health data never becomes public** | Bodyweight, nutrition, rehab protocol. This is the single most important rule. |
| **Collaborator real names never appear publicly** | |
| **GPA is public; per-course grades are not** | |
| **Phone number IS public** | Victor's explicit decision, reconfirmed. Do not "helpfully" remove it. |
| **Everything in the log is private** | "For now, assume everything private." |

The mechanism, from `web/AGENTS.md`:

1. **Public routes must never import a private loader or read a non-whitelisted field.**
   Public pages are statically generated — anything they read is baked into a world-readable
   bundle. `lib/vault/public.ts` names every public field explicitly. **Never spread-and-delete.**
   Two real leaks were caught by scanning built output, not by the type system.
2. **Never hard-code anything sensitive in a `"use client"` component.** They compile into
   `/_next/static/chunks/`, served without authentication. Confirmed by finding private-page UI
   copy fetchable by anyone. Private data may reach these components *as props at render time*;
   it may not appear in their source, including placeholders and default values.

### Budget

- **$0/month is a hard constraint.** Asked again during V2 scoping: *"Still the same."*
- One exception: **$10 on AI API credits** ("as I get free credits").
- Asked directly whether a nightly background job would be acceptable if it needed a paid
  tier: **"No."** This is why the calendar refresh and Canvas import are buttons, not cron.

### AI features (feature 6, not yet built)

- The **site itself** calls a model — not a local script, not a scheduled job.
- **Agent writes to the vault require user approval first.** *"No, it should first get user
  approval."* Show a diff; do not write on the model's say-so.

### Design and usability

Victor's own words from the V2 scoping questions, because these drove real decisions:

- *"Its too complex to use"* — named as the thing that would make him **abandon the project**.
  This is why D-037 merged four competing lists into one `tasks` table.
- *"Page loading is slow"*, *"didn't like how 'text' heavy it was… everything felt very cramped
  and hard to read"*.
- *"I want saves to be immediate"* — no commit-per-edit; high-frequency writes go to Postgres.
- *"The vault should be useful for AI agents to get context on me"* — this is why prose stays
  in markdown rather than migrating wholesale to the database.
- *"Undo would be nice"* — hence soft deletes (`deletedAt`) rather than hard.
- Volume **should** include warmup sets.

---

## 3. Stack

- **Next.js 16.3.1**, App Router, Turbopack, React 19.2.8
- **Drizzle ORM** + **Neon** serverless Postgres (`drizzle-orm/neon-http`)
- **PGlite** (`@electric-sql/pglite`) for tests — real Postgres in WASM, not mocks
- **Vitest** — 381 tests across 21 files
- Auth: `@simplewebauthn` (passkeys) + Web Crypto HMAC sessions, self-hosted
- Vault writes: **GitHub Contents API**, never `fs.writeFile`
- Deployed on Vercel free tier

---

## 4. Repo map

```
context/                          the vault (markdown, CRLF line endings)
├── 00_meta/                      identity + behavioural directives
├── 01_engineering/               projects/, experience/, labs/ are canonical (one file each)
├── 02_physical_performance/      benchmarks_and_logs.md, training_blocks.md
├── 03_craft_and_creative/
├── 04_operations/                current_sprint.md ← always check this
└── 99_archive/                   NEVER glob this. Open only a named file.

web/
├── AGENTS.md / CLAUDE.md         four rules that are easy to violate by accident
├── context.md                    scope, architecture, non-negotiables
├── DECISIONS.md                  63 entries: decision, why, how to reverse
├── drizzle/                      0000_athletics, 0001_tasks, 0002_log_entries, 0003_bodyweight_rehab
└── src/
    ├── app/private/*             auth-gated pages + their server actions
    ├── lib/vault/                parse, whitelist, freshness, GitHub writes
    ├── lib/athletics/            prs, hevy, adjusted, protocol, trends, queries
    ├── lib/calendar/             ics, load, sync
    ├── lib/tasks/                the one task model
    ├── lib/log/                  categories-as-data
    └── test/pg.ts                shared PGlite harness
```

**Never glob `web/`** from the repo root — `node_modules/` will swamp the search.

---

## 5. Data model

Four tables' worth of things markdown cannot hold. Everything else stays markdown.

| Table | Purpose | Key design note |
|---|---|---|
| `workouts` / `workout_sets` | training data | `numeric({ mode: "number" })` — Postgres numeric arrives as a *string* by default, and `"145" > "95"` is false. A PR query would be silently wrong. |
| `tasks` | **everything actionable** (D-037) | Sprint goals, coursework, to-dos and Canvas assignments are all rows with a `source` column. Merging them was the fix for "too complex to use". |
| `log_entries` | structured daily logging | Per-category fields in JSONB; `searchText` denormalised on write. |
| `bodyweight_entries` / `rehab_completions` | feature 5 | `date` columns, not `timestamp` — a weigh-in belongs to a morning, not an instant. |

Recurring patterns worth knowing:

- **`uniqueIndex` on a nullable `externalId`.** Postgres treats NULLs as *distinct*, so
  hand-entered rows never collide while imported ones stay idempotent. This is what makes
  re-importing a cumulative Hevy export a no-op.
- **`deletedAt` soft deletes** everywhere, because Victor asked for undo.
- **Records are derived on read, never stored** (D-025). A stored PR has no invalidation story
  and reads high forever after a correction.

---

## 6. What is shipped

### V1 (complete 2026-08-21)

Public portfolio, resume generator (three variants, print-to-PDF), passkey auth, vault writes
through the GitHub API, freshness audit, athletics with Hevy CSV import, and the
Work/Academics/Calendar/Hobbies private surfaces.

### V2

| # | Feature | State |
|---|---|---|
| 0 | **Foundation** | ✅ Vault reads cached and time-limited; tasks moved to Postgres so saves are immediate. Measured: work 320→69ms, calendar 377→32ms, academics 761→186ms. |
| 1 | **Redesign** | ✅ Magenta palette, active tab indicator, single-shot hover sweep, freshness as a badge not a bar, shared page shell. |
| 2 | **Structured logging** | ✅ Six categories generated from one definition file, full-text search, dictation on Android, soft delete with undo. |
| 3 | **Today** | 🟡 Largely built — tasks, goals, stats and the schedule section are live on `/private`. Never formally closed out. |
| 4 | **Calendar** | ✅ Google + Canvas private iCal feeds via `ical.js`. No OAuth. Agenda for today + 7 days; Canvas assignments importable as tasks. |
| 5 | **Athletics depth** | ✅ See below. |
| 6 | **AI** | ❌ Not started. Needs a scope decision from Victor. |

### Feature 5 in detail (most recent work, commit `ab2d663`)

The vault states exactly one athletic goal: *sub-2:00 weight-adjusted 500m split*. The site
could only show raw splits, which cannot answer whether that goal is close — at 215 lb the two
differ by about seven seconds.

- **Concept2 weight adjustment**: `factor = (bodyweight_lbs / 270) ^ 0.222`, applied to time.
  The page leads with the **required raw split**, because "sub-2:00 adjusted" is not something
  anyone can pace to on a monitor and `2:06.2` is.
  **Direction matters and is counterintuitive**: the adjustment discounts *lighter* athletes,
  so gaining mass makes the goal *harder*. Raw and adjusted are charted together so weight loss
  cannot read as speed. There is a test pinning this direction specifically.
- **The programme is parsed from the vault, not hard-coded** (D-056). SPM targets, the rehab
  protocol, the weekly split and the goal all come from `context/02_physical_performance/` at
  request time. Editing the markdown changes the site with no deploy. Parsers return empty
  rather than throwing; every panel names the heading it looked for, so a parse miss reads as a
  parse miss rather than an empty box. **Tests run against the real vault files** — that is what
  would catch a reformat.
- **SPM now reaches the database.** It was in the log-entry schema but never in `workout_sets`,
  so the targets had nothing to check. Added a field to the manual log and to `allEfforts`.
  Note: Hevy exports do not carry stroke rate, so this only works going forward — nothing
  retroactive is possible.
- **Charts are server-rendered SVG** (D-061). `recharts` is installed and unused; using it
  would add a client boundary to a page that currently arrives as finished HTML.
- **Week plan vs logged** is deliberately coarse (D-055): it reports whether a day has *any*
  session, never which planned item was done. Nothing links a workout to a line of the plan, and
  guessing from the title would mark a rest-day walk as a completed team practice.

---

## 7. What remains

*Updated 2026-08-24, after reviewing an external agent's changes.*

### Before V3 — the gate

Nothing here is optional. V2 is not finished while any of it is outstanding.

**1. Feature 6 · AI is half-built and needs a decision (6–10h left).**
The summary panel exists on `/private`, is cached, and reads today's `log_entries`. It is inert
until `GEMINI_API_KEY` is set, and it is currently *the only* AI feature. Still to decide and
build: summarise-my-week, draft-sprint-goals, semantic search, resume tailoring — and, for any
of those that write, **the approval-gated diff UI, which does not exist yet**. That gate is a
hard constraint, not a nicety: nothing may write to the vault on a model's say-so.

**2. Feature 3 · Today is not closed out (2–3h).**
Tasks, goals, stats and the schedule are live on `/private`; nobody has ever sat down and asked
whether that page answers "what do I do now" in one screen. That review is the feature.

**3. Public site work (Victor asked; mostly still open).**
- ~~Remove the RC car~~ — done.
- ~~Add the water bottle scale~~ — added, but **`draft: true` until Victor supplies real
  detail**. It needs the load cell and amplifier, how the seal is achieved, battery capacity
  and measured runtime, and one measured accuracy figure. Until then it stays off the resume.
- Make **Dimaag.ai** more prominent — partly done (homepage spotlight).
- **A real "what I'm working on now" section** — still open. The homepage spotlight is *not*
  this; it shows the most recent role. What Victor asked for is current work: 2ndMind, term.
- **Case studies for projects** — not started.
- **The resume needs real design work** — not started, and it is the artefact most likely to be
  read by someone deciding whether to interview him.
- **Mobile layout pass** — not started.

**4. Vercel configuration (Victor, 15 minutes).** See §10. The calendar is dead in production
until two variables are set, and he cannot sign in there at all until a passkey is enrolled
against that origin.

### V1 findings — current state

- ~~**Markdown editing is regex-based**~~ — **closed.** `frontmatter.ts` now locates structure
  with mdast. Verified against the old implementation: a `##` inside a fenced code block used to
  truncate a section and leave a dangling fence. Note the narrower regexes inside
  `setLabelledBullet` and `setFrontmatterField` remain, so the CRLF and `m`-flag traps in §8
  still apply.
- ~~**No end-to-end write-path test**~~ — **closed.** `write-e2e.test.ts` mocks `fetch` and
  exercises read → edit → write, asserting the SHA is round-tripped and the content changed.
- ~~**No error reporting**~~ — **partly closed.** `app/error.tsx` gives a real boundary and logs
  to the Vercel function log. There is still no *aggregation*: a failure Victor never sees is
  still invisible. A free Sentry tier would close it properly and fits the $0 budget.
- **No per-session revocation** — still open. Sessions are HMAC tokens with an expiry; rotating
  `SESSION_SECRET` is the only revocation, and it signs out every device.

### Reviewed and deliberately **not** doing

An external agent proposed these. Each was checked against the code rather than accepted:

- **Boot-time env validation with `@t3-oss/env-nextjs`** — **rejected, it contradicts the
  architecture.** The app is deliberately built to degrade: `/private/athletics` explains itself
  without `DATABASE_URL`, `/signin` reports "Not configured", the calendar says "no feeds
  connected". "Refuses to boot" would break that, and would break the public build, which runs
  with no `DATABASE_URL` on purpose.
- **Rename `error.tsx` → `global-error.tsx`** — **rejected as stated.** `global-error` replaces
  the root layout, must render its own `<html>`/`<body>`, and fires only for errors thrown in
  the layout. Renaming trades the boundary that catches almost everything for the one that
  catches the rarest case. Adding it *alongside* would be fine.
- **Path-traversal hardening with `path.normalize`** — **not applicable.** Vault paths never
  touch a filesystem; they go to the GitHub Contents API. Every caller passes a hard-coded
  constant, so no user input reaches `assertVaultPath` at all.
- **Serialising vault writes to avoid a TOCTOU race** — **very low priority, and the diagnosis
  was wrong.** A stale SHA produces a loud `409`, not silent data loss — that is optimistic
  concurrency working. There is one user, and **nothing in the app currently writes to the
  vault** (D-036 moved it all to Postgres). Revisit when feature 6's approval-gated writes land.
- **Octokit retry/throttle plugins** — reasonable and cheap, low priority for one user.
- **APM / DevTools / CodeQL / Lighthouse MCP servers** — generic, and the observability ones
  imply paid tiers. The underlying gap (error aggregation) is already tracked above.

---

## 8. Traps that have already cost time

This is the highest-value section. Every item below was a real bug or a real hour lost.

### Next.js 16 specifics — your training data is probably wrong here

`web/AGENTS.md` says it outright: **this is not the Next.js you know.** Read
`node_modules/next/dist/docs/` before writing.

- `middleware.ts` is deprecated → **`proxy.ts`** exporting a `proxy` function.
- **`revalidateTag(tag, profile)` now takes two arguments.** The recommended `"max"` profile is
  stale-while-revalidate, which serves *pre-edit* content — wrong for a save button.
  **Use `updateTag(tag)`** for immediate visibility from a Server Action.
- `use cache` requires `cacheComponents: true`, which conflicts with `force-dynamic`.
  `unstable_cache` still works and is what this project uses.
- **A `"use server"` module may only export async functions.** Exporting a constant from one is
  a build error. This has been got wrong **twice**
  (`GOAL_LABELS`, then `TRACKER_HEADING`). Non-async shared values go in a plain module — see `lib/sprint-goals.ts`.
- Typed routes (`PageProps<"/route">`) are generated by `next build`.

### The vault is CRLF

- **Every regex needs `\r?\n`.**
- **`$` under the `m` flag means end-of-*line* and does not match before a `\r`.** Use
  `(?![\s\S])` for true end-of-input.
- Prefer **line-based parsing** over multi-line regexes. `lib/athletics/protocol.ts` is the
  model to copy — it splits on `/\r?\n/` and walks, which is both readable and CRLF-safe.

### Bash heredocs mangle backslashes in this environment

Confirmed **8+ times** in one session: heredocs silently corrupted `\r?\n` into literal control
characters, and once wrote nothing at all. **Use the Write tool for source files.** Heredocs are
fine for content with no backslashes; Python scripts using `io.open(..., newline='')` are a
reliable way to patch existing files while preserving line endings.

### Timezones

- `dayBounds(now, offsetMinutes)` follows the **JS `getTimezoneOffset()` convention**: minutes
  to *add* to local time to reach UTC. Los Angeles is **+420**, not −420. This is the opposite
  of the "UTC−7" people say out loud. A test caught this once; the code was right and the test
  was wrong.
- **Do not hard-code 420.** It was, and it would have broken on **2026-11-01**, mid-term, and
  quietly — "today" would have begun at 11pm the night before. Use
  `zoneOffsetMinutes(now, timeZone)` in `lib/tasks/queries.ts`.
- Manual workouts are stored at **noon UTC**, not midnight, so a timestamp rendered in a
  timezone behind UTC does not show as the previous day.

### Postgres

- `NULLS LAST` is **not** the default for ascending order. Without it every undated task sorts
  above today's work.
- `to_tsquery` throws on a bare `&`; use **`plainto_tsquery`** for user input.
- `sum()` over all-NULLs returns NULL, not 0. `COALESCE` **inside** the sum.

### Test suite flakiness — fixed twice, both times properly

1. A fresh PGlite per *test* made the suite take minutes and flake under load →
   `src/test/pg.ts`, one instance per file, TRUNCATE between tests. 88–155s → 7s.
2. The first `beforeEach` per file still took ~16s under 3-way parallelism, past vitest's 10s
   default → `hookTimeout: 30_000`.

**If you see tests that pass on a re-run, do not shrug.** Find the cause. Always confirm a fix
with **two consecutive clean runs**.

### `ical.js`

`TimezoneService.register(timezone, name?)` takes **the component first, not the id**. Reversed,
it type-checks as `any` in plain JS, registers nothing, and puts every event seven hours out.
Also: cap recurrence expansion. Victor's real feed contains an unbounded monthly rule that
otherwise expands to **2058**.

### Build tracing

`outputFileTracingIncludes` was once added alongside excludes. **An explicit include beats an
exclude**, so the archive could not be dropped. Measured: root-widening alone did the work.
Final config is `outputFileTracingRoot` + `outputFileTracingExcludes` only (44 → 34 files).

---

## 9. How to verify work here

Victor values verification over assurance. The habits that have caught real bugs:

- **Scan the built output for leaks after every change**, with a **positive control** so you
  know the grep works. `grep -rl "Victor" .next/static/` finding nothing means your scan is
  broken, not that the build is clean.
- **Measure, don't assume.** "It's slow" was diagnosed by timing production TTFB (335–440ms with
  no DB or API call), not by guessing. The fix was `loading.tsx` + Suspense streaming, verified
  by finding the skeleton at byte 6755 and the content at byte 30566 of the response.
- **Verify computed values against an independent hand calculation.** Feature 5's goal card was
  checked digit by digit: factor `0.9511`, required raw `2:06.2`, best adjusted `2:10.3`, gap
  `10.3s`.
- **When the real data is empty, seed a temporary set, verify, then delete exactly what you
  inserted.** Mark seeded rows so cleanup can target them and can never touch real data.
- **Report data gaps as data gaps, not defects.** The Canvas feed being empty and Fall 2026
  classes being absent are both true facts about the world, and the UI says so plainly rather
  than rendering an empty box that looks broken.

### Commands

```bash
cd web
npm run dev          # Turbopack
npm test             # vitest run — 380 tests
npm run typecheck
npm run lint
npm run build
npm run db:generate  # after editing lib/db/schema.ts
npm run db:migrate   # loads .env.local itself (D-063)
python scripts/build_indexes.py   # from repo root, after editing any canonical vault entry
```

### Environment variables

Names only — **values are secrets and must never be committed or pasted into chat.**

`SESSION_SECRET`, `GITHUB_TOKEN`, `PASSKEY_CREDENTIAL_ID`, `PASSKEY_PUBLIC_KEY`,
`PASSKEY_REGISTRATION_SECRET`, `DATABASE_URL`, `GOOGLE_CALENDAR_KEY`, `CANVAS_CALENDAR`,
`NEXT_PUBLIC_SITE_URL`.

⚠️ **The iCal URLs are credentials.** Anyone holding one can read the calendar. `.env.local` and
Vercel only.

---

## 10. Open on Victor

Nothing in the codebase is blocked on these, but the features are inert until they happen:

1. **Enrol a passkey on the production origin** (`victorgusev.vercel.app`). A passkey is bound
   to the origin it was created on; the existing one is bound to `localhost`. See
   `web/REGISTER_PASSKEY.md`.
2. **Set `GOOGLE_CALENDAR_KEY` and `CANVAS_CALENDAR` in Vercel.** They exist locally only, so
   the production calendar page currently shows "No calendar feeds connected".
3. **Confirm Vercel's `DATABASE_URL` points at the same Neon database as local.** Migration
   `0003` was applied to the local one. If production differs, `/private/athletics` errors
   there until migrated.
4. **Add Fall 2026 classes to Google Calendar.** No code waits on this.

---

## 11. Working agreements

- **Add a `DECISIONS.md` entry for every non-obvious choice** — decision, why, and **how to
  reverse it**. Victor reviews the site and reverses things; this file exists so reversing is a
  lookup rather than an archaeology dig. Several entries bundle a bug fix with a style choice and
  say explicitly which half must survive a reversal.
- **If a fact contradicts the vault, update the vault**, bump its `updated:` field, and say what
  changed.
- `project_catalog.md`, `experience_and_roles.md` and the `## Lab Experiments` section of
  `coursework_and_labs.md` are **generated** — read them, never edit them. Run
  `python scripts/build_indexes.py` after changing a canonical entry.
- **Dimaag.ai:** the technical specifics recorded in `experience_and_roles.md` (PPO, Isaac Lab,
  LiDAR raycasting, sim-to-real validation, tracking accuracy) are shareable. Anything beyond
  that documented scope is not in the vault — say so rather than guessing.
- Dates are **ISO 8601**.
