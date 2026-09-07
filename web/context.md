---
updated: 2026-09-06
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

**Local unlock is built and NOT mounted (V3 §1.5, D-154 → D-158).** A lock screen that
verifies a WebAuthn assertion in the browser against a cached public key, with no server, lives
in `components/site/local-lock.tsx` and is fully tested — but `app/private/layout.tsx` does not
render it, as of 2026-09-04. It asked for a fingerprint on every cold start, which is most
launches, and what it bought was a **display gate, not a data gate**: the page's payload is
already sent and the offline mirror is unencrypted. The phone's own lock screen covers the same
threat.

Re-enabling it is one import and one wrapper in `app/private/layout.tsx` — D-158 has the exact
change. Do not delete the module or its tests on the assumption it is unused.

## Fonts are self-hosted on purpose

`next/font/google` fetches at build time. Significant parts of this project are written in a
car and on a 13-hour flight, so a network dependency in the build is unacceptable. The three
faces live in `src/app/fonts/` and load via `next/font/local`. Source files came from the
`@fontsource` packages; re-copy from there to add a weight.

- Display: Bricolage Grotesque (variable, headings only)
- Body: Instrument Sans (400/500/600)
- Data: IBM Plex Mono (400/500/600) — dates, splits, PRs, file paths

## Theme

**Two palettes, one per theme** — settled in V4 scoping, 2026-09-06. `web/DESIGN.md` is the
design system of record and `context/00_meta/brand_and_voice.md` carries the brand reasoning;
this section is the orientation.

- **Dark** (default, and the one Victor uses): magenta `#d94f93` primary, steel `#5484a4`
  secondary, peach `#f6c992` as the single warm note — eyebrows and emphasis, nothing
  structural — on near-black grounds carrying the magenta hue.
- **Light**: teal-led on warm paper, from the vault's original six swatches. The canonical
  teal `#09A1A1` is **2.94:1 on paper** and cannot carry text, so the token is that hue
  darkened — the same problem the magenta had on white, with the same answer.

**Light lives in `:root` and dark in `.dark`**, which is what `next-themes` toggles (D-184).
Both blocks held the dark palette until 2026-09-06, because V1 was dark-only. `<html>` no
longer carries a hardcoded `dark` class — `next-themes` writes it before paint, which is why
the element carries `suppressHydrationWarning`.

**V4 is underway** (`docs/V4_PLAN.md`). Two things about this section will change under it and
are not true yet:

1. **The light palette is a placeholder** — contrast-computed by D-184, never designed. V4 §1.4
   designs it.
2. **Themes become a registry, not two CSS blocks.** V4 §1.2 makes the palette data, with five
   shipping: dark-magenta, light-teal, high-contrast dark, and two experimental slots. Public
   offers light/dark/system; the full picker is in private settings. Do not add a third
   hand-written block in the meantime — add it to the registry or wait.

The ground is deliberately not a flat fill: `<html>` paints the base colour and `body`'s
`::before`/`::after` layer three drifting radial pools plus an SVG-noise grain over it.
That is also why `body` must stay background-less — giving it an opaque background buries
both layers.

Motion is centralised as **three** custom utilities in `globals.css` rather than repeated
Tailwind chains: `card-scan` (lift, a magenta glow, and a trace sweeping across the card the way
a scope refreshes), `link-wipe` (underline growing from the leading edge), and `rise` (the
staggered reveal). All three, and the ambient drift, collapse under `prefers-reduced-motion`.
V4 §1.8 drops `card-scan`'s lift and moves `rise`'s stagger out of inline `animationDelay`.

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

Run with `npm test`. Typecheck with `npm run typecheck`. **1,240 tests across 86 files** as of
2026-09-06, all passing. A drop from that count is a regression, not noise.

(It read "582 across 36 files as of 2026-08-30" until 2026-09-06. The suite more than doubled
during V3 and the floor was never re-stated, so for a week the number that is supposed to catch
a regression would have accepted losing half the suite. Re-state it whenever it moves.)

### Layout is checked by measurement, not by looking

`npm run shots` (dev server must be running) is the third gate. It sweeps the public pages at
four device widths, sweeps every private screen, and measures every resume variant against one
printed Letter page. It exits non-zero on a fault, so it can gate a commit. See D-077 — the
resume ran at 1.33 pages for weeks because the only check anyone ran was looking at it. It
earned its keep again on 2026-08-29: adding Proof to the robotics variant and two roles to all
three pushed every variant onto a second page, and nothing else would have noticed (D-115).

**Know which of its numbers are gates and which are only printed** (D-190). Four things fail
the run: horizontal overflow, a resume over one page, a private page burying its first action
or missing its marker, and a signed-in header that does not fit.

**`tap<40px` and `text<12px` are diagnostics, not gates.** They are measured, printed, and
never added to the fault count — the public sweep has been reporting 68 sub-12px elements and
~13 sub-40px tap targets per width, passing, for the life of the script. They are also
**public-only**: the private loop measures the fold and nothing else, which is why the
private app's 8.8px tab-bar and `Stat` labels have never been measured by anything. V4 §7.1
turns both into real gates, raises the floors to 44px and 11px, and extends them across the
private sweep. Until then, do not read a passing `npm run shots` as a statement about text
size or tap targets anywhere, or about layout on a private screen.

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

**Before assuming a database failure is a code bug, run `npm run db:status`.** It compares the
migrations in the repo against the ones applied to whatever `DATABASE_URL` points at. On
2026-09-03 a migration had been sitting unapplied for three days while the whole suite passed:
the tests build a fresh PGlite and apply every migration, so the schema they check is by
construction the one the code expects, and drift is the single thing they cannot see. Database
errors are now translated by `lib/db/describe.ts`, which says *"the database is behind this
build"* rather than printing the query (D-156).


Everything not listed here is markdown. Four tables live in Neon via Drizzle, with migrations
committed under `drizzle/` and applied with `npm run db:migrate`:

- `workouts` / `workout_sets` — training data, tabular and queried across rows.
- `tasks` — one model for everything actionable (D-037).
- `log_entries` — structured daily logging, per-category fields in JSONB. The form's
  shortcuts are declared per field in `lib/log/categories.ts` and nowhere else: `sticky`,
  `chips`, `carries`, `keypad`, `clipboard` (D-155). One rule is load-bearing —
  **`sticky` is for context, never for a measurement.** A category may also declare `rows`,
  a repeated group; Training uses it for sets (D-159).
- `bodyweight_entries` / `rehab_completions` — feature 5 (D-058, D-059).
- `ai_summaries` — daily and weekly summaries, kept after they are shown (D-124). Fallback
  text is never stored: "nothing logged yet" is indistinguishable, months on, from a day when
  nothing happened.
- `workouts` / `workout_sets` — pull-only, and mirrored by the server's `id` rather than a
  client key (D-169), which is safe *only* while the phone cannot create one. Making them
  writable means giving them a client key first.
- `error_reports` — crash reports from this app's own code (D-165). **Not syncable** and not in
  `ENTITIES`: diagnostics are one-directional and disposable. Rows are **counted, not
  accumulated** — one per fingerprint, upserted — because a render loop otherwise makes this the
  largest table in the database.

**Layout (V3 §3.1–3.2 — D-166, D-167).** `npm run shots` gates five private screens on how
far down the page the first actionable element sits, marked `data-first-action`. Three rules
that are easy to break by accident:

1. **A gated page must carry the marker.** Removing it does not make the page pass, it fails
   the sweep by name — otherwise a page stops being checked with nobody noticing.
2. **Actionable first.** The thing you can do goes above the numbers, charts and prose that
   describe it. Every reordering carries a comment naming the pixel number it was made for.
3. **Measure on a page with content in it.** `/private` passed for weeks at 265px and was
   936px on a term day, because it had only ever been measured with an empty calendar.

The sweep settles before reading — private pages stream, and an unsettled read is a smaller,
wrong number. `docs/DEVICE_CHECKLIST.md` is the fourth gate, for what a pixel cannot say.

**Errors (V3 §2.4, D-165).** Reports go to `/api/errors` and Neon — **never to a vendor**.
Three rules that are easy to break by accident:

1. **Truncate before scrubbing.** The email pattern is quadratic in the length of a
   word-character run; the other order costs a second of CPU on a 50KB stack, on an endpoint
   open to the network. A test with a wall-clock bound pins it.
2. **The schema is an allowlist**, and the server re-cleans whatever arrives. The endpoint takes
   unauthenticated POSTs on purpose — a worker throwing during `install` has no session — so the
   client's scrub is a convenience, not a boundary.
3. **The endpoint always answers 204.** A reporter that can tell a real failure from a rejection
   will retry, and a retry loop inside error reporting is an outage.

`lib/errors/client.ts` must never throw and never loop; every call site is somewhere already
going wrong.

**Offline (V3 §1.7, §2.1 — D-160, D-161).** Two routes exist because a page about the network
must not need the network:

- **`/private/sync`** lists everything the outbox has not got rid of, and why. **It has no
  delete button, deliberately** — an entry there is the only copy of something he wrote. A test
  fails if one appears.
- **`/cached`** is a **static** page, outside `/private` on purpose: everything under `/private`
  is `force-dynamic` and needs a session checked on a server, which is what is missing offline.
  The service worker precaches it and serves it for any failed `/private` navigation. It holds
  **no data** — every value is read from IndexedDB in the browser — which is why serving it
  without a session check is not a leak. Do not add server data to it, and do not make it
  dynamic: either one silently kills offline, because the worker would cache a redirect to the
  sign-in page and serve that in airplane mode. It **writes** too (D-163): the same `LogForm`,
  handed a writer that enqueues into the outbox rather than posting a Server Action.

Both read the local mirror only. Every cached view shows its age, always, however small.

The public site is precached from **`/sitemap.xml`** (D-163) — not from a list in the worker, so
a new project is cached with no code change. The worker filters `/private` before writing anything
to disk: a cached private response would survive sign-out, and this is the one file in the app
that can do that.

**A log category may declare row `shapes`** keyed off another field (D-162). Training uses it so a
bench press is not asked for a stroke rate. Fields outside the current shape are **unmounted, not
hidden** — a hidden input still posts, and a value nobody meant is worse than a missing one.

**`note` is a category with no tab** (D-164). `Category.capture` marks it; `TAB_CATEGORIES` is what
the tab row renders and `CATEGORIES` is everything writable. Notes are captured through the box
above the tabs and wait in the unsorted pile until filed. `fileEntry` only ever moves a row *out*
of that pile — the log has no edit path anywhere else, and that guard is what stops a mistyped id
silently recategorising a real entry.

Rules that hold the athletics side together, each with a decision entry:

- **Training is logged in one place, and read from two** (D-159). Sets are entered in the
  quick log — one exercise per entry, a row per set — because the phone cannot create a
  `workouts` row (`docs/SYNC_DESIGN.md` §11.1). `allEfforts()` unions `workout_sets` with the
  sets inside `log_entries`, so every PR function, chart and the adjusted-split table reads
  one `Effort[]` and none of them knows where a set came from. **Do not add a second reader
  of one source** — that is the whole design. Quick-logged exercises are deliberately absent
  from "Recent sessions", which lists `workouts` rows.
- **Bodyweight has one home** (D-159). The Training category offers the field, but it is
  lifted out by `takeBodyweight` and written to `bodyweight_entries` — never stored on the
  entry. It is the second input to every adjusted split, and two copies would drift.
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
