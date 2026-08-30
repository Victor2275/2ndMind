---
updated: 2026-08-29
domain: engineering
stability: volatile
summary: Project expectations for the 2ndMind web app — scope, architecture, conventions.
read_when: Working anywhere inside web/.
---

# 2ndMind Web — Project Context

Per `context/00_meta/ai_directives.md` §6, every new software project is initialized with a
`context.md` stating expectations. This is that file.

Design and architecture decisions are logged in `DECISIONS.md`, each with its reason and
reversal steps. Add to it rather than explaining a choice only in a commit message.

## What this is

Two surfaces over one markdown vault:

- **Public** — a portfolio host for hiring managers. Statically generated. Contains only
  whitelisted public fields. No database, no auth.
- **Private** — a second brain and daily logging tool for Victor alone. Auth-gated,
  server-rendered, reads and writes the vault.

Ships **2026-09-20**, the day UCLA fall term begins.

## Non-negotiables

1. **The vault at `../context/` is the source of truth** for projects, experience, coursework,
   sprint, standards, brand. Postgres holds only time-series that markdown handles badly:
   workout sessions, sets, erg results.
2. **Public routes must never import private loaders.** A test enforces this. Public pages are
   built from a field whitelist, so private data cannot reach the bundle even by accident.
3. **No screen requires typing markdown**, and every write path is under three interactions
   from the dashboard. If logging is slower than the app it replaces, it will not get used,
   and the whole project fails.
4. **Writes go through the GitHub Contents API**, not the filesystem. Vercel functions have an
   ephemeral read-only FS and no git binary. One commit per save; last-write-wins on conflict.
   *Reads* of single editable files go the same way; the one exception is the freshness audit,
   which walks 34 files on disk rather than making 34 API calls (DECISIONS.md D-022).
   That bulk read only works because `next.config.ts` widens the file-tracing root — see
   D-023, which was verified by counting traced files in the build output, not by assumption.
5. **Every write bumps the file's `updated:` frontmatter** so freshness stays honest without
   relying on discipline.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind v4 + shadcn/ui |
| Fonts | Self-hosted in `src/app/fonts/` — see below |
| Database | Neon Postgres + Drizzle |
| Auth | Self-hosted WebAuthn (`@simplewebauthn`), credentials in env (`PASSKEYS`), no database |
| Vault I/O | `@octokit/rest`, `gray-matter`, `zod` |
| Tests | Vitest + Testing Library |
| Host | Vercel Hobby, custom domain `victorgusev.com` (apex primary, `www` redirects) |

Budget is **$0**. Everything above must stay on a free tier.

## Auth is self-hosted, not Clerk

Original plan was Clerk passkey auth. Checked their pricing on 2026-08-20 while writing account
setup instructions: passkeys are Pro-only ($20-25/mo), not on the free Hobby plan, and it's an
ongoing cost, not one-time — well outside the $0 (max $5) budget. `@clerk/nextjs` has been
removed.

There is exactly one user, forever. That makes Clerk's actual job — multi-tenant identity,
org management, session UI for arbitrary sign-ups — pure overhead here. Auth is a WebAuthn
ceremony (`@simplewebauthn/server` + `@simplewebauthn/browser`) against one row in the Neon DB
holding Victor's registered credential, plus a signed session cookie. No vendor, no recurring
cost, no dashboard to configure. Built in Days 16-20 alongside the vault-write flow.

## Fonts are self-hosted on purpose

`next/font/google` fetches at build time. Significant parts of this project are written in a
car and on a 13-hour flight, so a network dependency in the build is unacceptable. The three
faces live in `src/app/fonts/` and load via `next/font/local`. Source files came from the
`@fontsource` packages; re-copy from there to add a weight.

- Display: Bricolage Grotesque (variable, headings only)
- Body: Instrument Sans (400/500/600)
- Data: IBM Plex Mono (400/500/600) — dates, splits, PRs, file paths

## Theme

Dark only in V1, per `context/00_meta/brand_and_voice.md`. V2's redesign replaced the original
teal/rose pairing: **magenta** (`#d94f93`) is the primary accent, **steel** (`#5484a4`) the
secondary, and peach (`#f6c992`) remains the single warm note — eyebrows and tier markers,
nothing structural — on near-black grounds carrying the magenta hue. The
dark palette lives in `:root` and `.dark` mirrors it, so adding light mode in V2 means
redefining `:root` and nothing else. `<html>` carries a hardcoded `dark` class.

The ground is deliberately not a flat fill: `<html>` paints the base colour and `body`'s
`::before`/`::after` layer three drifting radial pools plus an SVG-noise grain over it.
That is also why `body` must stay background-less — giving it an opaque background buries
both layers.

Motion is centralised as two custom utilities in `globals.css` rather than repeated Tailwind
chains: `card-scan` (lift, a magenta glow, and a trace sweeping across the card the way a scope
refreshes) and `link-wipe` (underline growing from the leading edge). Both, and the ambient
drift, collapse under `prefers-reduced-motion`.

## Testing expectations

`ai_directives.md` §6 requires automated tests after any feature. For V1 that means **unit
tests, no end-to-end suite** — the deadline does not allow both, and the bugs in this codebase
will live in pure logic, not in browser choreography. Required coverage:

- session signing and verification (forgery, tampering, expiry)
- frontmatter edits, including CRLF files and regex-metacharacter labels
- vault write path validation
- vault frontmatter parsers and zod schemas
- resume variant filtering (each variant includes and excludes the right entries)
- the tailoring bullet library, which is vault-wide and deliberately independent of
  `resume_variants` — MathCounts and Lifeguard are reachable there and on no printed resume
- the public-field whitelist
- workout CSV parsing and PR derivation
- freshness thresholds, including parity with `scripts/audit_freshness.py`
- the database layer, against real Postgres (see below)

Run with `npm test`. Typecheck with `npm run typecheck`. **582 tests across 36 files** as of
2026-08-30, all passing. A drop from that count is a regression, not noise.

### Layout is checked by measurement, not by looking

`npm run shots` (dev server must be running) is the third gate. It sweeps the public pages at
four device widths reporting horizontal overflow, sub-40px tap targets and sub-12px text, and
it measures every resume variant against one printed Letter page. It exits non-zero on a
fault, so it can gate a commit. See D-077 — the resume ran at 1.33 pages for weeks because the
only check anyone ran was looking at it. It earned its keep again on 2026-08-29: adding Proof
to the robotics variant and two roles to all three pushed every variant onto a second page,
and nothing else would have noticed (D-115).

### Reviewing the site offline

`npm run freeze` writes every route to `.frozen/` as standalone HTML — inlined assets, no
scripts, links rewritten so it browses from `file://`. Set `FREEZE_COOKIE` to a live
`2m_session` value to include the private pages. This is how the 2026-08-29 review round was
done (D-106); notes land in `web/SITE-REVIEW.md`.

### The database tests are not mocked

`@electric-sql/pglite` is Postgres compiled to WASM. The suite runs the *committed migration
SQL* into a fresh in-memory database per test, then exercises the real queries. This is why
query functions take the handle as their first argument instead of importing a singleton.

It matters because the interesting bugs here are ones a mock cannot see: `numeric` columns
arriving as strings (so `"95" > "155"`), a re-import appending duplicate sets to an existing
session, `sum()` returning null for a bodyweight-only workout. Each of those has a test that
fails without its fix.

## Postgres holds what markdown cannot

Everything not listed here is markdown. Four tables live in Neon via Drizzle, with migrations
committed under `drizzle/` and applied with `npm run db:migrate`:

- `workouts` / `workout_sets` — training data, tabular and queried across rows.
- `tasks` — one model for everything actionable (D-037).
- `log_entries` — structured daily logging, per-category fields in JSONB.
- `bodyweight_entries` / `rehab_completions` — feature 5 (D-058, D-059).
- `ai_summaries` — daily and weekly summaries, kept after they are shown (D-124). Fallback
  text is never stored: "nothing logged yet" is indistinguishable, months on, from a day when
  nothing happened.

Rules that hold the athletics side together, each with a decision entry:

- **Records are derived on read, never stored** (D-025). A stored PR has no invalidation
  story and reads high forever after a correction.
- **Imports are idempotent** (D-026). Hevy exports are cumulative, so re-importing is the
  normal workflow, not an accident.
- **Warmups are stored but never ranked** (D-029) — yet they *do* count toward volume, which
  is a deliberate asymmetry, not an oversight (D-060).
- **Splits are weight-adjusted with Concept2's formula** (D-057). The vault's one athletic
  goal is a weight-adjusted split, so raw splits alone cannot answer whether it is close.

The programme itself is not in the database and not in code. SPM targets, the rehab protocol,
the weekly split and the goal are parsed out of `context/02_physical_performance/` on each
request (D-056), so editing the vault changes the site with no deploy. Every parser returns
empty rather than throwing, and every panel names the heading it looked for — a parse miss has
to read as a parse miss, not as an empty box.

Health data is the category that must never become public — bodyweight above all. No public
route imports `lib/db` or `lib/athletics`, the public build has no `DATABASE_URL` at all, and
the built client chunks are scanned after each change with a positive control.


## Style guide — DECISION NEEDED

`ai_directives.md` §6 says Victor is unopinionated on style guides and that tradeoffs should
be outlined rather than chosen for him. Current state: ESLint via `eslint-config-next`, which
catches correctness but says almost nothing about formatting.

| Option | Gets you | Costs you |
|---|---|---|
| **Prettier + eslint-config-next** | Zero formatting arguments, one command, universal in the React world | One more dev dependency and a pre-commit hook to keep honest |
| **Biome** | Formatter and linter in one fast Rust binary; replaces Prettier and most of ESLint | Smaller ecosystem; some `eslint-config-next` rules have no equivalent |
| **ESLint only, no formatter** | Nothing new to install | Diffs fill with whitespace churn; formatting gets argued in review |

Recommendation: **Prettier**, because it is the boring choice and this project has 31 days.
Not installed yet — Victor decides.

## Known accepted issues

- `npm audit` reports 4 moderate advisories, all the same esbuild dev-server issue reaching us
  through `drizzle-kit`'s bundled loader. Dev-dependency only, does not affect the Next dev
  server or production. `npm audit fix --force` downgrades and breaks `drizzle-kit`. Left alone
  deliberately.
- `src/components/ui/form.tsx` is not vendored — the shadcn registry did not emit it. Its
  dependencies (`react-hook-form`, `@hookform/resolvers`) are installed; the wrapper is
  hand-authored when forms land.
