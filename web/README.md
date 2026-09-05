# 2ndMind — web

Two surfaces over one markdown vault, in one Next.js app.

- **Public** — the portfolio at [victorgusev.com](https://victorgusev.com). Statically
  generated, no database, no auth, built from an explicit whitelist of public fields.
- **Private** — a second brain and daily log for one person. Passkey-gated, server-rendered,
  and installable on a phone as an offline-first PWA.

The vault it reads is `../context/`, in this same repository. That is the source of truth for
projects, experience, coursework and standards; Postgres holds only the time-series that
markdown handles badly — workouts, sets, erg results, tasks, log entries.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

`predev` and `prebuild` sync vault assets into `public/` and generate the service worker with
the current commit stamped into it, so the dev server and a build always agree about which
worker they are running.

Without a `.env.local` the public site works and the private one does not. See
`context.md` for what each variable does.

## The gates

Four, and all four are expected to pass before anything is called done:

```bash
npm test             # vitest — two projects, `unit` and `db`
npm run typecheck    # tsc --noEmit
npm run shots        # playwright sweep; fails if a page's first action sits too far down
npm run e2e          # the offline round trip, in a real browser, against a real build
```

`npm run e2e` is the slow one and the only one that writes to the database. It builds, starts a
production server, and drives Chromium through airplane mode: the worker serves the app shell
and the portfolio with the radio off, a training entry is written offline, and when the network
returns the entry has to reach Postgres **exactly once** — then the row it created is deleted
again. Nothing else in the suite has a service worker or a Cache Storage, which is why a bug
that made the whole offline app render as the public site passed every other check.

The fourth gate is `docs/DEVICE_CHECKLIST.md`, which runs on the phone with a thumb. It covers the
things no exit code can: whether the app installs, whether it works with the radio off, whether
the launcher icon is right, and whether you can reach what you need one-handed.

Database tests are named `*.db.test.ts` and run together in one process — booting Postgres in
WASM costs about six seconds and doing it ten times over in parallel is what made the suite
flaky. `src/test/__tests__/db-test-conventions.test.ts` enforces that, so it does not have to be
remembered.

## Where things are

| | |
|---|---|
| Framework | Next.js 16 App Router · React 19 · TypeScript |
| Styling | Tailwind v4 · shadcn/ui |
| Fonts | **Self-hosted in `src/app/fonts/`** — not `next/font/google`, which fetches at build time, and a meaningful amount of this project is written on a plane |
| Database | Neon Postgres · Drizzle |
| Auth | Self-hosted WebAuthn · credentials in env, not in the database |
| Vault I/O | GitHub Contents API via Octokit · gray-matter · zod |
| Offline | Service worker + IndexedDB mirror + an outbox that syncs on reconnect |
| Host | Vercel Hobby. Total budget: **$0** |

## Read before changing anything

- **`AGENTS.md`** — the rules that are easy to break without noticing.
- **`context.md`** — what this app is for and what it must never do.
- **`DECISIONS.md`** — every non-obvious choice, with its reason and how to reverse it. Add to
  it rather than explaining a decision only in a commit message.
- **`../docs/V3_PLAN.md`** — what is being built now and in what order.

The one rule worth repeating here: **public routes must never import a private loader.** A test
enforces it, and two real leaks were caught by scanning built output rather than by the type
system.
