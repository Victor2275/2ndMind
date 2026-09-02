---
updated: 2026-08-30
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
ceremony (`@simplewebauthn/server` + `@simplewebauthn/browser`) plus a signed session cookie.
No vendor, no recurring cost, no dashboard to configure.

The registered credential lives in **environment variables, not the database** — `PASSKEYS`,
one indivisible `label:id:publicKey` string per device (`lib/auth/config.ts`). Neither value is
secret; the private key never leaves the authenticator. The cost is that enrolling a device
means pasting a new value into Vercel, which for a personal tool happens roughly never, and it
takes a database out of the auth path entirely.

**Local unlock (V3 §1.5, D-154).** Since 2026-09-02, `/private` also sits behind a lock screen
that verifies a WebAuthn assertion in the browser against a public key cached in IndexedDB at
the last online sign-in — no server, so it works with no signal. It is a **display gate, not a
data gate**: the page's payload has already been sent and the offline mirror is unencrypted, so
it defends against a phone handed over already unlocked, not against someone with developer
tools. Read D-154 before assuming it does more than that.

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
- `log_entries` — structured daily logging, per-category fields in JSONB. The form's
  shortcuts are declared per field in `lib/log/categories.ts` and nowhere else: `sticky`,
  `chips`, `carries`, `keypad`, `clipboard` (D-155). One rule is load-bearing —
  **`sticky` is for context, never for a measurement.**
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


## Style guide — settled 2026-08-30

**Prettier**, chosen by Victor over Biome and over no formatter. Installed and applied in V3
§0.2. This section was open from V1 until then; the tradeoff table that used to live here is
preserved in `DECISIONS.md` D-136.

```bash
npm run format         # write
npm run format:check   # verify — what the hook and CI run
```

Config is `prettier.config.mjs`. Everything is a Prettier default except two values, and both
were measured rather than preferred — the reasoning is in the file's own comments and in D-136:

- **`printWidth: 100`** — the codebase was written to ~100 columns (p90 87, p99 104). At
  Prettier's default 80 the one-shot pass reflows 2,764 lines; at 100 it reflows 266.
- **`endOfLine: "auto"`** — `.gitattributes` sets `eol=lf`, so files are committed as LF and
  checked out CRLF on Windows. Forcing `"lf"` passes here and then fails `--check` on every
  fresh clone, which would block commits through the hook below.

**What Prettier does not touch** (`.prettierignore`, reasoning in D-142): `src/components/ui/*.tsx`
because it is vendored from the shadcn registry, `drizzle/` because `drizzle-kit` regenerates
it, and `*.md` because it is hand-wrapped prose — including `AGENTS.md`, whose
`nextjs-agent-rules` block `next dev` rewrites on every run. `form.tsx` is the one file in
`ui/` that *is* formatted: the registry never emitted it, so it is ours.

### The pre-commit hook is not installed automatically

`.githooks/pre-commit` is committed, but git does not use a hooks directory unless told to.
**Once per clone:**

```bash
git config core.hooksPath .githooks     # enable
git config --unset core.hooksPath       # disable
git commit --no-verify                  # bypass once
```

It checks staged `web/` files only, and it is formatting-only on purpose — `npm test`,
`npm run typecheck` and `npm run shots` are the real gates and are run before work is called
done. Putting a 15-second suite in a pre-commit hook trains you to reach for `--no-verify`,
which would disable the formatting check too. No husky: `core.hooksPath` does husky's whole
job, and husky is a dependency whose purpose is to copy a file.

## Known accepted issues

- `npm audit` reports 4 moderate advisories, all the same esbuild dev-server issue reaching us
  through `drizzle-kit`'s bundled loader. Dev-dependency only, does not affect the Next dev
  server or production. `npm audit fix --force` downgrades and breaks `drizzle-kit`. Left alone
  deliberately.
- `src/components/ui/form.tsx` is not vendored — the shadcn registry did not emit it. Its
  dependencies (`react-hook-form`, `@hookform/resolvers`) are installed; the wrapper is
  hand-authored when forms land.
