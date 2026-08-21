---
updated: 2026-08-20
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
5. **Every write bumps the file's `updated:` frontmatter** so freshness stays honest without
   relying on discipline.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind v4 + shadcn/ui |
| Fonts | Self-hosted in `src/app/fonts/` — see below |
| Database | Neon Postgres + Drizzle |
| Auth | Self-hosted WebAuthn (`@simplewebauthn`) — single user, no vendor |
| Vault I/O | `@octokit/rest`, `gray-matter`, `zod` |
| Tests | Vitest + Testing Library |
| Host | Vercel Hobby, `vercel.app` subdomain |

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

Dark only in V1, per `context/00_meta/brand_and_voice.md`: teal primary, rose secondary,
peach as the single warm note, on grounds derived from the palette's own slate teal. The
dark palette lives in `:root` and `.dark` mirrors it, so adding light mode in V2 means
redefining `:root` and nothing else. `<html>` carries a hardcoded `dark` class.

The ground is deliberately not a flat fill: `<html>` paints the base colour and `body`'s
`::before`/`::after` layer three drifting radial pools plus an SVG-noise grain over it.
That is also why `body` must stay background-less — giving it an opaque background buries
both layers.

Motion is centralised as two custom utilities in `globals.css` rather than repeated Tailwind
chains: `card-scan` (lift, teal glow, and a trace sweeping across the card the way a scope
refreshes) and `link-wipe` (underline growing from the leading edge). Both, and the ambient
drift, collapse under `prefers-reduced-motion`.

## Testing expectations

`ai_directives.md` §6 requires automated tests after any feature. For V1 that means **unit
tests, no end-to-end suite** — the deadline does not allow both, and the bugs in this codebase
will live in pure logic, not in browser choreography. Required coverage:

- vault frontmatter parsers and zod schemas
- resume variant filtering (each variant includes and excludes the right entries)
- the public-field whitelist
- workout CSV parsing and PR derivation

Run with `npm test`. Typecheck with `npm run typecheck`.

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
