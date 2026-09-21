---
updated: 2026-09-20
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
   which walks 35 files on disk rather than making 35 API calls (DECISIONS.md D-022).
   That bulk read only works because `next.config.ts` widens the file-tracing root — see
   D-023, which was verified by counting traced files in the build output, not by assumption.
5. **Every write bumps the file's `updated:` frontmatter** so freshness stays honest without
   relying on discipline.
6. **Every browser-side `fetch` has a deadline** — `fetchWithDeadline` from `lib/net/deadline.ts`,
   never bare `fetch`. `fetch()` has no default timeout, so a request that connects and then
   stalls never rejects, and this app's entire offline story is `try`/`catch`. Without a deadline
   every fallback is unreachable in exactly the condition it was written for, which is what froze
   the app on plane wifi (V4 Phase N, D-204). The service worker keeps its own copy of the budgets
   because it cannot import the module; a test fails if the two drift.
7. **`navigator.onLine === true` proves nothing.** It reports that the device has an interface,
   not that anything answers, and it is `true` on plane wifi. `false` is conclusive and is still
   worth checking. What the app actually believes about the connection is
   `lib/net/reachability.ts`, derived from how real requests turned out.

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

**Enrolled credentials live in Postgres** (`passkey_credentials`, `lib/db/schema.ts`), not the
environment (D-234). They started in a `PASSKEYS` env var — one indivisible `label:id:publicKey`
string per device — which made enrolling a device a Vercel round-trip: set a registration
secret, register, copy the returned value, paste it back, redeploy. That was fine for a device
that changes roughly never, but it was not self-serve. A row insert needs neither, so
`/signin/register` now finishes enrolment the moment the ceremony does. Neither the credential
id nor the public key is secret; the private key never leaves the authenticator.

The legacy env vars (`PASSKEYS`, `PASSKEY_CREDENTIAL_ID`, `PASSKEY_PUBLIC_KEY`) are still
folded into `storedCredentials()` alongside the table, so the device enrolled before the
migration was never lost. New devices go straight into the table. The registration gate
(`PASSKEY_REGISTRATION_SECRET`) is the one thing that stays a permanent env var — Victor keeps
it somewhere durable and types it on each new device, rather than round-tripping it through
Vercel per enrolment.

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

- **Dark**: magenta primary, steel secondary, on near-black grounds carrying the magenta hue.
- **Light**: teal-led on warm paper, from the vault's original six swatches. The canonical
  teal `#09A1A1` is **2.94:1 on paper** and cannot carry text, so the token is that hue
  darkened — the same problem the magenta had on white, with the same answer.

### V4 Phase 1 is complete as of 2026-09-08. Milestone A.

**Two stylesheets are generated, and which one a value belongs in is decided by one question:
does it vary per theme?** `src/app/tokens.css` comes from `scripts/build-tokens.mts` and holds
colour, elevation and the scrim. `src/app/scale.css` comes from `scripts/build-scale.mts`
(D-199) and holds the nine-step type scale, the eight-value spacing vocabulary, the named radii,
the breakpoint set, three durations, three easings and the icon sizes. `npm run tokens` and
`npm run scale` write them; `tokens:check` and `scale:check` fail when either is stale and the
test suite runs both. **Edit a generator, never its output.**

Elevation looks like it belongs in the scale and does not: DESIGN.md §6 makes it a ground-shift
plus a border in dark schemes and a real shadow in light ones, so the four *names* are published
by `scale.css` and the values are written per theme by `build-tokens.mts`.

**The type scale redefines Tailwind's own nine size names**, which are exactly the nine in use
across 466 call sites — so every existing `text-sm` became scale-correct with no migration.
`base` is anchored at exactly 1rem, and there are two hand-adjustments, both at the ends:
`5xl` rounds to 48px, and `xs` is lifted to 12px so the app's smallest text stopped shrinking.
`scale.test.ts` asserts adjustments only ever happen at the extremes.

**Mono is real data only, and it is now true of the four surfaces §1.6 names** — nav, eyebrows,
the tab bar, panel meta (D-198). 246 `font-mono` occurrences became 186, and 53 eyebrow call
sites collapsed onto `@utility eyebrow`. The remaining 186 are an audit in `DESIGN.md` §4, to be
judged screen by screen in Phases 4–6, not a backlog to clear blindly — most of them are dates
and splits and are correct.

**`components/ui/` is nine files and is no longer upstream's** (D-200). Ten unused components
were deleted, `tw-animate-css` went with them, the nine that remain were hand-reworked at the V4
tokens, and `src/components/ui/*.tsx` was removed from `.prettierignore`. A `shadcn add` would
now overwrite our work rather than merge with it.

**`/private/kitchen-sink` renders all five themes at once** (D-201). It is not in the navigation
and is reachable by URL; `npm run shots` sweeps it. It works because `tokens.css` scopes palettes
with a bare `[data-theme="…"]` attribute selector, so putting that attribute on a `<section>`
re-declares the whole palette for its subtree.

**Two traps this phase hit, both found in the built bundle rather than by reasoning.** Tailwind
finds classes by scanning source text and does not evaluate code, so an interpolated
`` `text-${step}` `` generates nothing, renders at the inherited size, and reports no error. And
`--duration-*` is not a Tailwind namespace — `duration-fast` needed three explicit `@utility`
blocks before it meant anything. Both fail the same way: the element renders, nothing errors, the
style is simply absent. **Check a new utility in `.next/static/chunks/*.css` before trusting it.**

### The section below was rewritten on 2026-09-08. V4 §1.1–1.4 landed.

**Themes are a registry, and the palettes are generated.** Five ship, listed in
`src/lib/theme/registry.ts`: `carbon` (**the default**), `dark-magenta`, `light-teal`,
`hc-dark`, `steel-light`. Public offers light/dark/system; the full picker is in
`/private/settings`.

**Never hand-write a palette.** `src/app/tokens.css` is **generated** by
`scripts/build-tokens.mts` and committed; `npm run tokens` writes it and `npm run tokens:check`
fails when it is stale (the test suite runs that check). Every value is *solved for a contrast
ratio* rather than picked — declare "teal, at whatever clears 5.4:1 on a card" and the solver
returns it. Edit the generator, never the CSS. A new theme is one spec in the generator plus one
entry in the registry; no component changes.

**`next-themes` writes `data-theme` on `<html>` and nothing else.** There is no `.dark` class and
no `data-scheme` attribute. Tailwind's `dark:` variant is a **generated selector list** over the
dark-family themes, emitted into `tokens.css` by the same script — so it cannot go stale and
cannot be forgotten. `<html>` carries `suppressHydrationWarning` because the attribute is written
before paint by an injected script.

**The default is named once**, as `DEFAULT_THEME` in the registry. Everything derives from it:
the bare `:root` block, `GROUND` in `lib/brand.ts`, the manifest, the splash screen, the status
bar, and the theme the public site is pinned to. `scripts/render-icons.mjs` carries a literal
copy only because it is plain ESM that cannot import, and a test pins the two together. It was
two literals in two files until D-197 and that fails silently — do not reintroduce a second copy.

**Amber (`--highlight`, `--warning`) means attention and nothing else** (D-196). It is hue 70 in
every theme, on purpose, because a warning that changes colour per theme is not a warning. That
is exactly why it must not be spent on decoration: an eyebrow painted with it is pinned to orange
in all five themes. Eyebrows take `--primary`.

The ground is deliberately not a flat fill: `<html>` paints the base colour and `body`'s
`::before`/`::after` layer three drifting radial pools plus an SVG-noise grain over it.
That is also why `body` must stay background-less — giving it an opaque background buries
both layers.

Motion is centralised as **three** custom utilities in `globals.css` rather than repeated
Tailwind chains: `card-scan` (lift, a magenta glow, and a trace sweeping across the card the way
a scope refreshes), `link-wipe` (underline growing from the leading edge), and `rise` (the
staggered reveal). All three, and the ambient drift, collapse under `prefers-reduced-motion`.
V4 §1.8 drops `card-scan`'s lift and moves `rise`'s stagger out of inline `animationDelay`.

## The private shell — V4 Phase 4 (2026-09-18, D-251 to D-258)

**Navigation is two components over one route set, and that is deliberate** (D-132, reconfirmed
by Q358). `PrivateSidebar` owns `sm` and above; `PrivateTabBar` owns below it. The switch is the
unlayered `.nav-desktop` / `.nav-mobile` pair in `globals.css` — Tailwind's own `hidden sm:flex`
does not work here, and the comment there says why.

Four things in the shell are easy to break by accident:

1. **The sidebar's collapsed rail is the CSS base state; expanding is the exception.** One block
   of declarations, applied only at `laptop` and up and only when `data-nav` is absent. Writing
   it the other way round means the collapsed look appears twice — once in a media query, once
   under the attribute — and the two drift. The attribute is set **before first paint** by the
   inline script in `app/private/layout.tsx`, from `lib/nav/sidebar.ts`; React holds no layout
   state for it.
2. **The layout owns the only `<main>`**, rendered by `ContentWidth` with `id="main"` for the
   skip link. Private pages render a `<div>`. A page that reintroduces `<main>` nests two
   landmarks.
3. **How wide a private screen is comes from one table**, `CONTENT_WIDTH` in
   `components/site/content-width.tsx`, longest prefix wins (D-252). Not from a class on the
   page.
4. **`SyncRunner` is the only writer of the outbox summary** (`lib/sync/status.ts`), and it
   publishes *before* flushing as well as after. The glyph, the sidebar badge and the tab-bar
   badge are all readers. A second component summarising the outbox for itself is how the three
   start disagreeing.

`PageHeader` is a one-row title bar below `phone` — no eyebrow, no lede, actions kept (D-253).
The actions stay because on several screens the header action *is* `data-first-action`.

## The private screens — V4 Phase 5 foundations (2026-09-19, D-259 to D-270)

**5.1–5.3 are done; 5.4–5.9, the screens themselves, are not.** What landed is the vocabulary
every one of those screens will speak, so it is worth knowing before touching any of them.

**Four states, in two files.** `components/site/states.tsx` holds `AsOf`, `Empty`,
`Unavailable` and `SaveState`; `components/site/skeleton.tsx` holds the loading shapes.
Before this each screen invented its own, and six of them carried a hand-written copy of the same
red failure box. Five things here are easy to break by accident:

1. **`AsOf` takes `now` as a required prop.** Defaulting it to `Date.now()` is an impure
   read during render, and two badges on one page would then be measured against two different
   instants. Every caller already has the instant it read at.
2. **Its thresholds are arguments, and that is the design.** An outbox op is stale after a day;
   the offline mirror after two. The *grades* are shared, the numbers are not. `STALE_MS` lives
   in `lib/ui/staleness.ts` and `lib/sync/outbox-view.ts` re-exports it rather than
   redeclaring it.
3. **Amber means `stale` and nothing else** (D-196). `fresh` and `aging` are muted.
4. **`SaveState` has three values.** `queued` comes from `ActionState.queued`, set only by
   `lib/offline/write.ts`. Do not infer it from the message text — the copy is prose and will
   be reworded.
5. **Skeletons are static** (D-259, reversing §1.10 in favour of Q204), and `SkeletonPanel`
   takes the `shape` it stands in for. A `rows` skeleton in front of a chart reserves about
   90px where 300px is coming.

**Forms speak one vocabulary** (`components/site/field.tsx`): labels above and really
associated, placeholders that are never names, optional marked rather than required, 48px
controls, blur validation that clears on input, a dirty indicator and a sticky save. `LogForm`
uses all of it; the other forms migrate screen by screen, the way the mono audit does.

**The toast system is mounted for the first time.** D-192 found it was dead code that looked
alive — mounted nowhere, called nowhere, styled by a class name with no CSS behind it. Three
things about it are load-bearing:

- **A toast is not how a save is confirmed.** That is `buzzSaved()`, because the log form is
  used at a rack with eyes elsewhere. `notify` is for an action worth taking back (Q265) and a
  failure you were not watching for.
- **It is mounted twice**, because `/cached` renders outside the private layout. A second
  `Toaster` there is not a duplicate; without it an undo offered offline has nowhere to appear.
- **Its action button is 44px.** Destructive actions in this app are undoable rather than
  confirmed, so there is no confirmation dialog anywhere and the toast is the whole safety story
  for a delete.

**The pressed state is a base rule in `globals.css`, not a utility call** (D-267). It reaches
every `button` and `[role="button"]`, so a new button gets it for free; `data-no-press` opts
out. The `press` utility is still needed for `<label>`, `<a>` and `<summary>` controls,
which that selector cannot see — do not delete it as redundant.

**Two things about hover, and they point opposite ways.** Tailwind v4 already wraps every
`hover:` in `@media (hover:hover)`, so stripping hover on touch (Q193) required no changes at
all. But that is exactly why **a reveal must never be gated on `hover:` alone or on a screen
width**: a touch tablet is over 640px and has no mouse. `can-hover:` is the variant for
hidden-until-hovered, and `touch.test.ts` fails if a `sm:opacity-0 sm:group-hover:` pair
reappears.

## Today, after V4 §5.4 (2026-09-21, D-284 to D-289)

The page Victor opens most, and the one §5.4 was written against. Five things changed and each
is easy to undo by accident:

- **The capture box is the loudest block on the page, and it is still below the Due list.**
  Those two facts are one decision (D-284). Position is D-182's, measured; loudness is Q380's.
  Do not "fix" the hierarchy by moving it up — that is the 495px regression two earlier
  decisions exist to prevent.
- **The summary archive is a route**, `/private/log/archive` (D-285), not a panel on Today. It
  holds daily and weekly rows in one list, ordered by the period each describes. Today links to
  it in one line.
- **`SummaryPanel` is the only way an AI summary is rendered** (D-286) — quiet surface, closed,
  model name on the `meta`. It is used by Today and by the archive, so the two cannot drift.
  `Panel` grew `tone="quiet"` and its `meta` became a `ReactNode` for this.
- **Overdue is amber, bold and edged — never red** (D-287). `destructive` in this app means
  something broke.
- **`Agenda` draws its "now" line only when a caller passes `now`** (D-289), which only Today
  does. `nowIndex` compares local day keys, not UTC: the UTC version disappears every evening
  after 5pm in Los Angeles.

## The log, after V4 §5.5 (2026-09-21, D-290 to D-294)

- **`lib/log/drafts.ts` is not `lib/log/sticky.ts`.** Sticky keeps context and never
  measurements (D-155); a draft keeps everything, because it is an unfinished entry. What makes
  that safe is that a restored draft **announces itself** and offers to be discarded — do not
  remove that line while tidying, it is the whole safety argument for D-290.
- **The draft store does not notify on write**, only on clear. A `useSyncExternalStore` that
  fired per keystroke would re-render this form on every character for no benefit: the fields
  are uncontrolled.
- **The remembered tab is read in an effect, never in `useState`.** `localStorage` does not
  exist during SSR. `?category=` outranks it (D-291).
- **Search marks are approximate by design** (D-292). Postgres matched with stemming; the marks
  are word-prefix only. The count line above the list is the authority, and `markTerms` must
  always rejoin to the exact input — a test pins that.
- **Undo is a toast here too now** (D-293). No list in the private app renders an inline undo
  row any more.

## Academics, after V4 §5.7 (2026-09-21, D-295 to D-299)

- **The audit is rendered from `lib/academics/requirements.ts`, not as markdown.** That parser
  is shared with the planner and is the only one; `scripts/parse_dars.py` changing breaks both
  screens or neither (D-295).
- **The meter's numbers come from the audit's frontmatter**, not from the parse — the file lists
  only the open requirements in full, so a parsed numerator would be wrong.
- **`IP` means in progress and must never render as counted** (D-296), and a truncated
  acceptable-course list must keep saying it is truncated.
- **The planner is a table below `lg` with an Edit toggle** (D-298). D-187's "desktop-only"
  stands for editing; reading is a phone activity.
- **Counted and unchecked are different tokens** (D-299). Do not merge them back into a
  sentence: the unchecked one is a guess the audit could not confirm.

## Work, Calendar, Hobbies, Sync — V4 §5.8 (2026-09-21, D-300 to D-304)

- **The applications board never writes** (D-300). The Gmail script is the sheet's only writer;
  a status control here would make two. Stages are derived from free text by `stageOf`, matched
  most-specific-first, and `stages.test.ts` pins the two orderings that matter ("offer declined"
  is closed, "rejected after interview" is closed).
- **The calendar renders both views server-side** and `CalendarView` hides one (D-301). Do not
  make the month view fetch on switch — the feeds are one parse, and the hidden subtree keeps
  its `<details>` state.
- **The month window is wider than the agenda window** on purpose, and the Canvas panel filters
  back to a week. A month grid built from seven days claims the rest of the month is free.
- **Provenance is a shape** — filled dot Google, ring Canvas — with a legend (D-302).
- **Spool bars and printer dots never carry meaning alone** (D-303); the badges stay.
- **`/private/sync` leads with age and boxes the reason** (D-304). Waiting is still not an
  error (Q426): only a row that needs a person is destructive-bordered.

## Charts — V4 §5.9 (2026-09-21, D-305 to D-309)

- **Every chart leads with `ChartHeadline`** (D-305). `leadFromSeries`'s `lowerIsBetter` is what
  turns a direction into a verdict — a falling split is good, a falling 1RM is not, a moving
  bodyweight is neither. Leave it undefined rather than guessing.
- **`TrendChart` and `BarChart` stay Server Components.** Interaction lives in `ChartPin`, an
  overlay that receives formatted strings only (D-307). Do not make the chart itself a client
  component to add a feature to it.
- **One SVG serves both widths** (D-306): axis labels are `phone-hidden`, the endpoint value is
  in the caption at every width.
- **No mount animation, ever.** It is the default of every charting library that could replace
  this file, and it makes a chart unreadable for the first 400ms.
- **`PrTable` is cards below 40rem** (D-308). Any new table on a private screen should follow
  it rather than `overflow-x-auto`.

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

Run with `npm test`. Typecheck with `npm run typecheck`. **1,970 tests across 132 files** as of
2026-09-20, all passing. A drop from that count is a regression, not noise.

(It read "582 across 36 files as of 2026-08-30" until 2026-09-06, then "1,240 across 86", then
"1,375 across 90", then "1,452 across 97" until V4 Phase 2, then "1,502 across 100" until Phase
2++, then "1,644 across 110" until self-serve enrolment and the cover letter generator added
their own, then "1,755 across 120" until V4 Phase 3 added tag tests to `log.db.test.ts`,
`tasks/queries.db.test.ts`, and `apply.db.test.ts`, plus a new `tag-input.test.tsx`, and
"1,805 across 121" until V4 Phase 4 added `private-sidebar`, `connection-glyph`,
`content-width` and `sheet-drag` suites, and "1,848 across 125" until V4 Phase 5.1–5.3 added
`states`, `staleness`, `field`, `task-list` and `touch`. The suite
more than doubled during V3 and the floor was never re-stated, so for a week the number that is
supposed to catch a regression would have accepted losing half the suite. Re-state it whenever
it moves.)

### Two end-to-end suites, and they stage opposite failures

Unit tests cannot see either of these: neither has a service worker, a Cache Storage, or an
IndexedDB that survives a navigation.

- **`npm run e2e`** — the offline round trip (V3 §3.7). The radio is off, so every `fetch`
  rejects immediately. Writes to the real database and cleans up after itself by client id.
- **`npm run e2e:degraded`** — a connection that is **connected and answering nothing** (V4
  Phase N8). Nothing rejects, so before Phase N no `catch` ran and the app hung. Writes nothing.

**Every check in the offline suite passed on the build that froze on plane wifi.** That is the
argument for the second one existing, and for not merging them: they are different failures, and
a suite that stages the easy one is not evidence about the hard one.

Both are local-only and need `.env.local`. Shared setup is in `scripts/lib/e2e.mjs`.

### Layout is checked by measurement, not by looking

`npm run shots` (dev server must be running) is the third gate. It sweeps the public pages at
four device widths, sweeps every private screen, and measures every resume variant against one
printed Letter page. It exits non-zero on a fault, so it can gate a commit.

**It runs its ~95 page loads six at a time** (D-281). It was fully sequential and took **581s**;
it now takes **~250s**, and `SHOTS_PNG=0` drops that to **~150s** by skipping the 148 MB of
screenshots when you only want the gates. `SHOTS_CONCURRENCY` tunes it, and the comment above it
says why six rather than twelve. Jobs buffer their own output and it is flushed in queue order,
so the report is byte-identical run to run and still diffable.

**Anything measured here waits for `document.fonts.ready` first.** Three faces are self-hosted,
and until they load the browser lays out in a fallback with different metrics — which made
`/private/athletics` report 394px or 414px depending on the run. `settledFold` could not catch it
because the swap lands between two readings that have already agreed. If a number here ever moves
between runs, look for a race like that one; do not lower the concurrency to hide it. See D-077 — the
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

- `plan_overrides` — days of the fall challenge changed from the app (D-276). **Not synced**
  and not in `ENTITIES`, like `error_reports`; reverting hard-deletes because nothing merges it
  across devices.
- `workouts` / `workout_sets` — training data, tabular and queried across rows. **Writable from
  the phone since V4 Phase 2**: a session and all its sets travel as one aggregate op and the
  server assigns the foreign key (`SYNC_DESIGN.md` §4a, D-211).
- `exercises` — the movement catalogue behind the session form (D-213).
- `tasks` — one model for everything actionable (D-037). Carries a `tags: text[]` column since
  V4 Phase 3 (D-248) — free tags, filtered with `@>` in `listTasks`, suggested from
  `allTaskTags`.
- `log_entries` — structured daily logging, per-category fields in JSONB. The form's
  shortcuts are declared per field in `lib/log/categories.ts` and nowhere else: `sticky`,
  `chips`, `carries`, `keypad`, `clipboard` (D-155). One rule is load-bearing —
  **`sticky` is for context, never for a measurement.** A category may also declare `rows`,
  a repeated group; Training uses it for sets (D-159). Also carries `tags: text[]` (V4 Phase 3,
  D-248) — the answer to "a recipe I want to try has nowhere to go" (§2.3): free tags, not a new
  category, filtered with `@>` in `listEntries` and suggested from `allTags`. `fileEntry` and the
  new `tagEntry` (`lib/log/queries.ts`) can attach tags without touching the one-way-door guard
  on `category`.
- `bodyweight_entries` / `rehab_completions` — feature 5 (D-058, D-059).
- `ai_summaries` — daily and weekly summaries, kept after they are shown (D-124). Fallback
  text is never stored: "nothing logged yet" is indistinguishable, months on, from a day when
  nothing happened.
- `workouts` / `workout_sets` — **writable from the phone since V4 Phase 2**, and addressed by a
  client key. The note that stood here said they were pull-only and mirrored by the server's
  `id` (D-169), which was safe *only* while the phone could not create one, and that "making
  them writable means giving them a client key first" — which is exactly what D-211 did. A
  session and all its sets travel as **one aggregate op** applied atomically, with the server
  assigning the foreign key (`SYNC_DESIGN.md` §4a). After creation, sets are independent ops.
- `exercises` — the movement catalogue: ~164 seeded rows (`npm run db:seed-exercises`) plus
  anything added on the phone. Mirrored so fuzzy search works with no signal, which is why it is
  a synced table rather than an API call. `modality` decides which fields the session form asks
  for (D-213). A set stores the exercise **name**, not a foreign key — Hevy imports write names
  the catalogue has never seen, so the catalogue assists entry and does not police history.
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

**Filing gained a second, additive door: tagging** (V4 Phase 3, D-248). `fileEntry` now takes an
optional `tags` argument, so the same sheet that files a note into a category can tag it in one
call — but `tagEntry` is the one that answers §2.3's actual complaint, because it works with *no*
category change at all: a note can stay in the unsorted pile and still be found by `#recipe`. The
one-way-door guard is untouched either way — it was always about `category`, and neither function
gives a caller a new way to move a row *into* the unsorted pile or recategorise a filed one.

Rules that hold the athletics side together, each with a decision entry:

- **Training is logged in one place, and read from one** (V4 Phase 2.7, D-215). Sessions are
  written at `/private/athletics/log`: a set belongs to a `workouts` row, and the phone creates
  that row itself — a session and all its sets travel as **one aggregate op**
  (`docs/SYNC_DESIGN.md` §4a), which is the reversal §11.1 deferred twice. The quick log's
  `athletics` category is **retired, not deleted**: old entries keep their sets and stay
  searchable, and no new one can take the old path. `allEfforts()` used to union two sources and
  now reads sessions only. **Do not add a second reader** — getting down to one was the point.
- **Bodyweight has one home, and its own tab** (D-159, D-221). The `weight` quick-log category
  offers the field; `takeBodyweight` lifts it out into `bodyweight_entries` and it is never
  stored on the entry. It is the second input to every adjusted split, and two copies would
  drift. It is deliberately **not** on the session form — a form that asks every session gets a
  number typed carelessly, which is worse than a missing one.
- **The exercise catalogue ships in the bundle** (D-224, D-232). `lib/athletics/catalogue.ts` is
  what the seed script inserts *and* what every training screen searches, with the synced mirror
  merged over the top — `mergeCatalogue` in `lib/athletics/local.ts`, shared by the logger and
  the browser. Reading only the mirror made the feature depend on a completed sync pull, and the
  pull is paged: a half-synced device found nothing.
  **The merge rule changed when seeded rows became editable.** It matches on `seed_key`, and the
  mirror wins for any row carrying `user_edited_fields`; the bundle wins otherwise. The comment
  it replaced said *"nothing in the app can edit a seeded entry"* — once that stopped being true,
  bundle-always-wins would have made every edit vanish on reload.
- **The catalogue is addressed by `seed_key`, not by name** (D-231, D-233). A name can change:
  V4 Phase 2++ renamed all 164 of them to `Movement (Equipment)` and collapsed 31 rows whose
  names were really distance parameters. `scripts/seed-exercises.mts` matches on `seed_key`,
  honours `user_edited_fields` per column, and **skips tombstoned rows rather than resurrecting
  them**. `renames.ts` is the v1 → v2 map, pinned against a frozen fixture of the old names, and
  it also ships client-side so a device on a stale build cannot write new history under a dead
  name.
- **One muscle diagram, not 139 pictures** (D-222, D-226). `muscle-map.tsx` highlights regions
  from the entry's own `primaryMuscles`/`secondaryMuscles`, so the drawing cannot contradict the
  data. It was redrawn at reference fidelity in Phase 2++ and the vocabulary grew to 21 regions
  (`lib/athletics/muscles.ts`), but D-222's argument is unchanged — one drawing computed from the
  data, not many that can drift. The written how-to now lives in `exercises.how_to`, seeded from
  the catalogue and editable on the exercise's own page; there are no demonstration clips and
  there will not be (D-223, D-231).
- **`set_type` says whether a set counts; `piece_type` says what it was** (D-230). `isWorkingSet`
  in `prs.ts` is a deny-list defaulting to *true*, so adding a value to `set_type` silently lets
  it onto the record board. A technical paddle and a race piece both count as work and are not
  the same thing — that distinction lives in `piece_type`, which nothing ranks on.
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

**The Fall 2026 challenge is a vault file, and only its completions are in Postgres** (D-271 to
D-275). `context/02_physical_performance/fall_2026_challenge.md` carries the rules, the four
goals, seventy-six dated day rows, the block structure, fifteen stretching routines and the
fuelling plans for the 50k and the 100k; `lib/athletics/challenge.ts` parses it on each request.
Four things here are easy to break by accident:

1. **The routine for a day is computed, not written down** (D-273). The vault declares a `Type`
   per day and a `Pool` per routine; `assignRoutines` gives each day the *n*th routine of its
   pool. `challenge.test.ts` **pins the first fortnight of the sequence**, so reordering §6 of
   the plan file fails loudly rather than silently reshuffling months of completion history.
2. **`challengeFaults` is an arithmetic check on the plan, not a parser guard** (D-271). The day
   rows must be contiguous, the dates must not skip, and the metres in §4 must total what §1
   claims. It runs in the test suite against the real file and renders in amber on the page. The
   plan's stated total was wrong when first written and this is what said so.
3. **The practice credit lives outside `challengeProgress`** (D-274). `applyPracticeCredit` only
   ever *raises* a `water` or `race` day that already has something logged, and never invents
   one. Folding it into the progress function would make a function named "progress" silently
   inflate a real number.
4. **The routine checklist writes to `rehab_completions`** (D-272), which is not a leftover — it
   is a completion row per slug per day with a tombstone, a sync entity, an offline store and an
   apply branch already built. Routine slugs are namespaced `routine/movement` so they cannot
   collide with the legacy protocol slugs still in the table; a test asserts every one contains a
   slash. `rehab-checklist.tsx` is deleted; `parseRehabProtocol` is deliberately kept with no
   caller, because its tests pin the shape of a vault section that still exists.

**`training_blocks.md`'s Weekly Layout was rewritten to the challenge's week shape** (D-275), because
`parseWeeklyPlan` feeds the "This week" panel that now sits beside the challenge's "Today" panel,
and two contradictory weekly plans on one screen is worse than either of them. The pre-challenge
layout is preserved verbatim in D-275 and pasting it back needs no code change.

**The plan is readable and editable from the Training area** (D-276 to D-280). `Plan` is the
second tab; `/private/athletics/plan` renders all eleven weeks and every day, and a card on the
logger shows today's session above the form. Four things here are easy to break by accident:

1. **Everything goes through `loadPlan()`** (`lib/athletics/plan.ts`, D-277). Parse the vault,
   merge the overrides, *then* assign routines — in that order, which is what makes a changed
   session type also change that day's stretching routine. Four screens read it; none of them
   parse the plan themselves, and a fifth should not start.
2. **Edits never touch the vault file.** `plan_overrides` holds one row per changed day and
   `ChallengeDay.planned` carries what the vault said, which is what makes "back to plan" a row
   delete. The edit form's inputs are **empty with the plan as placeholder** — an empty field
   writes null and the vault shows through, so a pre-filled form submitted untouched would badge
   an unchanged day as changed.
3. **`challengeFaults` runs on the original, not the merged plan.** An override is a deliberate
   disagreement with the totals in §1 of the vault file; running the check on the merged plan
   reports every edit as a vault bug.
4. **`plan_overrides` is not in `ENTITIES` and does not sync**, the same call `error_reports`
   makes. Reverting hard-deletes, and that is not an inconsistency: a tombstone exists to give
   last-write-wins two comparable states, and nothing merges this table across devices.

**The routine rotation counts across the whole challenge, and two local schemes were tried and
rejected** (D-278). `day.day % poolSize` gave Tuesday and Friday the same strength routine every
week; per-week slots moved the collision to the week boundary. The cost of the running count is
that editing a **past** day reshuffles later assignments, so that day reads as undone in the
fortnight strip — cosmetic, and cheaper than a rotation that repeats inside a week. **Pool sizes
are load-bearing**: each must be at least as large as the most days of that pool any one week
holds, and a test asserts it per week.

**The routines need no equipment, and a test enforces it** (D-279). No bands, roller, bar, rack,
step, bench or doorway — a regex over every movement name and prescription in the vault fails the
suite. This is what removed the Pallof press, which has no equipment-free equivalent; dead bugs,
bird dogs and side planks carry the anti-rotation job the rehab protocol needs.

**Boat practice is credited, never prescribed** (D-280). Victor does not choose practices and
does not decide whether one is technique or conditioning — the coach does. `water` days say
there is practice and nothing about its content.

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
