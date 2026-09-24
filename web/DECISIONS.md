---
updated: 2026-09-24
domain: engineering
stability: volatile
summary: Design and architecture decisions for the web app, grouped by topic, each with its reason and how to reverse it.
read_when: Before changing anything that looks deliberate, or when Victor wants something undone.
---

# Decision Log

Every non-obvious choice, why it was made, and **how to undo it**. Victor reviews the site and
reverses things; this file exists so reversing is a lookup, not an archaeology dig.

**How it is kept.**

- Entries are grouped **by topic**. Each carries the date it was decided.
- **IDs are permanent and never reused.** About 1,300 citations in code and docs point here. The
  next new decision is **D-363**.
- A decision that is reversed or overtaken becomes a one-line row in
  [Superseded](#superseded), pointing at what replaced it. Its full text stays in git history
  (`git log -S "D-nnn" -- web/DECISIONS.md`).
- Entries are short: what was decided, why, and how to reverse. The measurements and the debugging
  story behind each one are in the commit that made it.
- A lesson that applies across many entries is a [standing rule](#standing-rules), and entries cite
  it (R1…R16) rather than retelling it.

Restructured 2026-09-24 (D-363): 603 KB → about a fifth of that; conflicts with the code resolved;
the Phase-6 brand decisions, which had reused D-215–D-231, renumbered to D-346–D-362.

---

## Standing rules

- **R1 · Measure before scoping.** An audit list names real categories of problem and does not know
  which ones this codebase has. Checking first has repeatedly dissolved an item or found a better
  one underneath (D-326, D-332, D-334, D-330).
- **R2 · A measurement in this log is a fact about the day it was taken.** Re-run it before acting
  on it (D-310 nearly added a workaround for a bug that had stopped reproducing).
- **R3 · A gate is trusted only after it has failed.** Inject a fault and watch it go red before
  relying on it; a checker that silently checks nothing looks identical to a pass (D-083, D-166,
  D-190, D-315, D-316).
- **R4 · A number counts once two consecutive runs agree.** A racy gate passes often enough to look
  healthy and fails often enough to be dismissed as flaky (D-166, D-323, D-336).
- **R5 · Before measuring `localhost:3000`, confirm the port is free.** `npm start` exits silently
  when it is held, and the old server keeps answering (D-336).
- **R6 · A CSS finding is not a finding until it reproduces in `npm run build`.** `next dev` serves
  stale CSS (D-143).
- **R7 · Layout is measured after `document.fonts.ready`.** A webfont swap moves the fold by ~20px
  (D-283). Do not "fix" a fold flake by lowering concurrency.
- **R8 · jsdom does not lay out.** Width, overflow and fold bugs need a real browser —
  `npm run shots`, `scripts/diag-widths.mjs` (D-219, D-220).
- **R9 · A test database more capable than production passes what production cannot do.** PGlite
  has transactions; `neon-http` does not (D-212).
- **R10 · Budgets ratchet; they are not aspirations.** A gate that is red forever gets switched off.
  Record today's number, fail on the next regression, and let it only go down (D-318, D-323,
  D-329).
- **R11 · Mutate a test before trusting it.** Pair every negative assertion with a positive
  control, or a test that matches nothing passes (D-175, D-180, D-202, D-204).
- **R12 · The public site states only what is recorded.** Nothing is inferred (D-069); every public
  projection names its fields explicitly (D-003); health data and collaborators' names are never
  published (D-010, D-024, D-058, D-071).
- **R13 · Nothing is written on a model's say-so.** A model may propose; a person saves (D-080,
  D-100, D-104, D-218).
- **R14 · Colour never signals alone.** Pair it with a shape, a word, an edge or a weight (D-287,
  D-302, D-303, D-256).
- **R15 · A value that only shows somewhere you rarely look needs a test, not an inspection** —
  the status bar, the splash screen, the launcher icon (D-147, D-346).
- **R16 · Retire, don't delete, anything old records depend on.** A retired log category keeps its
  definition so old entries still read and search; only the create path closes (D-159, D-215).

---

## Open items

Things this log says are wanted or unresolved, as of 2026-09-24.

- **Back up `context/assets/originals/`** somewhere that is not this repository — 33 MB of robot
  photographs, gitignored, and the only source for the crops (D-338).
- **Code follow-ups decided 2026-09-24, not yet done:** rename the private "Now" nav entry to
  "Updates" (D-342); remove the mood and energy scale (D-134); delete the unreachable voice-entry
  code (D-186); delete the public theme-override state in `theme-provider.tsx`, dead since the
  footer toggle went (D-345).
- **A density toggle** is still wanted; the spacing scale it needed exists (D-195, D-199).
- **Three custom icons** — dragon boat, filament and one more — to replace `waves` and the stand-ins
  on the OG card (D-349).
- **~56 KB of root-layout client code on every public page** — `ErrorWatch`, `ThemeProvider`,
  `ServiceWorker`, analytics. The largest remaining public-bundle saving (D-329).
- **`/private/sync` should say when another device's clock is far ahead** — otherwise its edits are
  dropped silently (D-153).
- **The course planner has never saved** — `course_plan.md` does not exist yet (D-187).

---

## Vault, content and what gets published

### D-001 · Monorepo — `web/` inside the vault repo · 2026-08-20
Vault writes trigger public rebuilds, and other projects can clone and read `context/` directly.
**Reverse.** Split the repo; the vault cache key (D-335) then stops tracking vault pushes.

### D-003 · Public projections name every field explicitly · early
Never spread-and-delete. A field added to the vault tomorrow is private by default; reaching a
public page takes a deliberate edit plus a test update. Two real leaks were caught by scanning
built output, not by the type system. Adding a public field is one line in a diff by design
(Prettier puts one element per line — D-142). **Do not "simplify" this into a spread.**

### D-009 · `## Notes` sections are stripped from every public body · 2026-08-20
`stripInternalSections()` removes them from project, experience and lab bodies at the projection
layer, so a new entry is covered without anyone remembering. They hold archive links and notes to
self. **Reverse.** Delete the call sites.

### D-010 · Collaborator names are never published; group size is · 2026-08-20
They are private individuals who did not agree to appear. Group size stays, because presenting group
work as solo misrepresents it. **Reverse.** Re-add `collaborators` to `PublicLab` and its keys, and
delete the privacy test.

### D-011 · Pursuits are their own vault entity, not a projection of the training logs · 2026-08-20
`context/03_craft_and_creative/pursuits/` holds the public framing of dragon boat, fabrication and
baking. The public build never reads `benchmarks_and_logs.md`, which holds health data. The risk is
structurally absent rather than guarded by an allowlist. **Reverse.** Not recommended.

### D-014 · Labs cut to one entry, promoted to a project · 2026-08-20
Four Physics 4BL labs are `public: false` — assigned coursework demonstrates compliance, not
capability. The solenoid bit reader is a self-directed build and lives in `projects/`. `/labs` is
gone. The lab files stay in the vault as history; D-015 took RLC off the robotics resume for the
same reason. **Reverse.** Flip `public: true`, restore `app/labs/` from `2699a2a`, re-add the nav
entry.

### D-069 · Nothing on the public site may be inferred, only recorded · 2026-08-24
An agent once filled a project with invented specifics (an ESP32, "±2g accuracy", MQTT) and they
reached the portfolio and two resumes. Fabricated detail on a hiring-facing page is discovered in an
interview. Missing detail stays missing and the entry carries `draft: true`. **Reverse.** Only by
filling in real detail from Victor first, then clearing `draft`.

### D-073 · Case studies are skeletons in the vault; unwritten sections do not publish · 2026-08-24
Each project carries four sections — the problem, architecture, what did not work, measured
results. Unwritten ones hold a `> **To write:**` prompt; `dropUnwritten` strips the prompt and any
heading left empty. As of 2026-09-23 every project is complete (D-340). **Reverse.** Delete
`dropUnwritten`; bodies then publish verbatim, prompts included.

### D-082 · Project sections are stored in narrative order, not reordered at render · 2026-08-25
`scripts/order_case_study_sections.py` orders each file; the renderer shows file order. Reordering
at render would make the page disagree with the file, and agents read the file. The script moves
whole sections only and has `--check`. **Reverse.** Reorder by hand.

### D-099 · Project updates live in the project's own markdown · 2026-08-25
`### YYYY-MM-DD` entries under `## Updates` are parsed out of the body into data and rendered, newest
first, on the project's own page. The section is removed from the rendered body so it does not
publish twice. Written from `/private/now` through the vault write path, which goes through the
outbox (D-325). Publishing is a commit plus a rebuild. The public `/now` page this also drove is
gone (D-342). **Reverse.** Drop `updates` from `toPublicProject`; the section then renders as
ordinary markdown.

### D-107 · Projects carry an explicit `order`; tiers are gone · 2026-08-29
Tiers published a ranking of Victor's own work to hiring managers, and the sequence he wanted was not
derivable from tier and year. A test asserts every `order` is distinct. `order` is a curated
sequence: a new project takes the number it deserves and everything below shifts (D-344).
**Reverse.** Restore `tier`; the old sort was `a.tier - b.tier || b.year - a.year`.

### D-108 · Project `status` is `active` or `done` · 2026-08-29
"Archived" read as abandoned. Water Bottle Scale was deleted, not archived. `status` now only drives
the badge on a card. **Reverse.** `git show` the deleted file.

### D-109 · An ongoing role says "Present" because the vault says so · 2026-08-29
`ongoing: boolean` on experience. `date_end` stays a real date; the flag decides what shows. A
hard-coded "Present" once told readers a finished internship was still running. D-068 set the rule:
`experience[0]` is "most recent", never "now". **Reverse.** Drop the field.

### D-113 · The DARS audit is parsed into a derived file, never read directly · 2026-08-29
`scripts/parse_dars.py` writes `degree_audit.md`; raw `DARS*.html` is gitignored. The saved audit
carries a student ID, a high school and every grade. Deriving once means the identifiers are never
in a file the app can read. GE lists are truncated to ~320 characters. **Reverse.** Delete the
script and the derived file.

### D-114 · Pursuits publish bullets only, and feed the tailor library · 2026-08-29
`facts` and `carryover` left the public projection — a field left in a projection ships in the
bundle whether rendered or not, and these were erg splits. **Reverse.** Restore the two fields to
`PublicPursuit` and its keys.

### D-119 · Public pages do not advertise an unfinished write-up · 2026-08-29
No "Write-up pending" badges or banners. Publishing only written sections (D-073) is the honesty.
`draft` still keeps an entry off every resume. **Reverse.** `git show` the commit for
`project-grid.tsx` and `projects/[slug]/page.tsx`.

### D-121 · Experience carries an explicit `order` · 2026-08-29
Date order put a seasonal lifeguard job above the robotics lead. A test pins that inversion.
**Reverse.** Sort on `date_start` descending.

### D-122 · The repo root holds only what belongs there · 2026-08-29
Plans live in `docs/`; downloaded source documents live in the gitignored `private/`, which
survives a file being saved under a new name. `CLAUDE.md` and `AGENTS.md` are identical copies.
**Reverse.** Move the files back.

### D-337 · The three FRC robots replaced Smart Bottle and the Dimaag paper · 2026-09-22
Both removed entries were scaffolding; the Dimaag paper could not be filled in without crossing
`confidential_scope`. Airhead (2023), Slipknot (2024) and Lemonlight (2025) are four seasons of
work with public repositories. The prose was written from the repositories; results and failures
came from Victor, never from an agent (D-069). **Reverse.** Recover the deleted files from git
(`git log --diff-filter=D -- context/01_engineering/projects/smart-bottle.md`).

### D-338 · The phone photographs live in `context/assets/originals/`, which nothing publishes · 2026-09-22
`sync-vault-assets.mjs` publishes every top-level image in `context/assets/`, and never follows
subdirectories. The originals — 33 MB of photos and a video — sit one level down, are gitignored, and
are the source `scripts/crop_robot_photos.py` recuts from. EXIF rotation is baked into the derived
JPEGs. **Not yet backed up** (see Open items). **Reverse.** Move them up a level and they are served.

### D-339 · The FRC projects are portfolio-only; the resume carries the role · 2026-09-22
The robotics variant is full at 0.83 of a page, and any added entry — even at one bullet — prints two
pages; the entry heading costs more than a bullet saves. Settled 2026-09-23: the robotics resume
represents FRC through the **Robotics Programming Lead** role in `experience/first-robotics.md`.
Slipknot keeps three bullets so enabling it is one field. **Reverse.**
`resume_variants: [robotics]` on `slipknot.md`, then `npm run shots` — if that is two pages, this
decision is what has to change.

### D-340 · Draft guards test a synthetic draft, not the vault · 2026-09-23
The vault has no `draft: true` projects left, and two tests asserted one existed. The filter is
`isResumeProject(project, variant)`, tested with a synthetic draft and a non-draft control; the OG
test dropped its `> 0` assertion. A guard on output must not depend on content Victor may change.
**Reverse.** Inline the predicate and restore the assertions — only alongside a real draft.

### D-341 · Slipknot's hero is `1458Robot.jpg` · 2026-09-23
The old hero was the smallest source carrying the largest image slot. It stays as Fig. 2, the only
shot of the robot scoring. **Reverse.** Swap the output names in `scripts/crop_robot_photos.py`.

### D-344 · Curated order leads with the three robots · 2026-09-23
Slipknot 1 (and `featured`), Lemonlight 2, Airhead 3, then Proof, Micromouse, 5 Second Rule,
Solenoid, TaskAble, 2ndMind. The sort controls were checked in a real browser and work — Curated,
Newest (year, then `order`) and A–Z; `?sort=bogus` falls back to Curated. **Reverse.** Renumber
`order`.

### D-351 · `featured: true` picks the hero project, separately from `order` · 2026-09-10
*(was D-220, renumbered.)* Exactly one published project may set it; `featured.test.ts` fails
otherwise. It drives the About hero's second call to action and the projects grid's hero card.
`order` decides sequence; "what a stranger sees first" is a different decision. Now on Slipknot
(D-337). **Reverse.** Drop the field and put `projects[0]` back.

---

## Public site

### D-004 · `SiteHeader` is a Client Component · early
It uses `usePathname` for the active-route indicator; it receives only a name string, so the
payload cost is negligible. **Reverse.** Drop the indicator and `"use client"`.

### D-066 · `app/error.tsx` shows a digest, not a message · 2026-08-24
It covers the public site, and client-thrown messages arrive verbatim. The digest locates the trace
in Vercel's logs. It is deliberately not `global-error.tsx`, which catches only root-layout errors.
**Reverse.** Render `error.message` unconditionally.

### D-074 · Only a real photograph earns a figure · 2026-08-24
A card without an image gets a 1px accent rail, not a generated placeholder (which replaced D-013).
The placeholders made `/projects` 6,150px tall on a phone. `ProjectFigure` is kept for a future
uniform grid. **Reverse.** Render `ProjectFigure` unconditionally.

### D-075 · A hover-only affordance must not occupy space without hover · 2026-08-24
"Read more →" is `hidden [@media(hover:hover)]:block`. Opacity hides ink, not layout. Standing rule
in DESIGN.md §9: nothing is reachable only by hover, and `title` is invisible on a phone (D-191).

### D-081 · A case study is styled by role · 2026-08-25
`CaseStudy` maps each `##` heading to a role: results get the accent and a panel with numbers in mono;
"what did not work" gets the secondary colour — failure is not red, it is evidence of judgement. A
section keeps its own heading; the index counts sections present. Number emphasis is opt-in and a
test asserts the text is character-identical. **Reverse.** Render `<Prose>` in the project page.

### D-090 · Project cards size to their own content · 2026-08-25
`items-start` on the grid; equal-height rows opened a 200px void above cards without images.

### D-091 · `image_fit: cover | contain`, per project · 2026-08-25
A diagram or screenshot is worth seeing whole; a photograph is worth cropping. Explicit rather than
derived from image dimensions. **Reverse.** Drop the field; everything returns to `object-cover`.

### D-102 · The public→private link is a hint with no authority · 2026-08-25
Login sets `2m_returning=1` (not `httpOnly`, one year); the header shows a `/private` link when it
is present. It gates nothing — `/private` checks the session regardless. A test fails if anything
outside an allowlist reads the cookie, so it cannot become an auth bypass. Cleared on explicit
sign-out. D-105 put it last in the header nav, as a lock icon below `sm`, after placing it first
collapsed the site name to zero width; `shots` now checks the name's rendered width.
**Reverse.** Delete `lib/auth/returning.ts` and `private-link.tsx`.

### D-120 · The resume variant row is fixed and complete · 2026-08-29
All three variants in `RESUME_VARIANTS` order, the current one `aria-current`. Rendering only the
other two moved the control under the cursor. **Reverse.** Restore the `others` filter.

### D-171 · No entrance fade above the fold · 2026-09-04
`.rise` is off the home hero, the facts grid and the sign-in card: a transparent frame does not
count as painted, and it hid the page for ~900ms. It stays below the fold, where re-keying the
projects grid replays it as feedback. **Reverse.** Add `rise` back to those three elements.

### D-342 · `/now` is removed and redirects to `/projects` · 2026-09-23
A page whose whole subject is "what I am doing now" is only as good as its last update and gets
wronger every day. It had one item left. 308 to `/projects`, because the URL is in the sitemap, the
PWA precache and inbound links. `## Updates` still publishes on each project page, dated.
**Reverse.** `git show <commit>^ -- web/src/app/now/`, restore the header entry and sitemap line,
drop the `redirects()` block in `next.config.ts`.

### D-343 · Public pages do not explain how the site is built · 2026-09-23
The resume footnote about being generated from the vault and the footer line about 2ndMind are gone.
A reader came for the work. The repository stays reachable as a "Source" link. **Reverse.** Both
strings are in that commit's diff.

### D-345 · The footer is one line, and public pages are Carbon-only · 2026-09-23
Name, then GitHub / LinkedIn / Email / phone / Source. The build stamp went — a date that ages by
itself — and so did the theme toggle. **Corrected 2026-09-24:** the original entry said the site
now follows the OS theme. It does not: `theme-provider.tsx` forces the default theme on every public
page (D-184), so without the toggle a visitor always sees Carbon. That is the intended policy. The
override state that served the toggle is now dead code (Open items). `ThemeToggle` itself stays,
mounted in the private tab bar. **Reverse.** `git show <commit>^ -- web/src/components/site/site-footer.tsx`.

### D-350 · The About copy lives in one module · 2026-09-10
*(was D-219.)* `lib/profile-copy.ts` holds the positioning line and the About paragraph, because the
OG card renders the line too, through a different toolchain; `og.test.ts` asserts the renderer
imports it. Every Dimaag figure in it is one `confidential_scope` names as shareable. **Reverse.**
Edit the strings; re-run `npm run og`.

### D-352 · The About hero states a claim, and the page proves it below · 2026-09-10
*(was D-221.)* Taller hero, positioning line under the name, two calls to action, a reduced contact
row, a paragraph below, facts as a dense line on phones, and a date gutter for past experience. The
portrait's bloom is gone. It also fixed a `join("")` that had dropped the contact links' colour class
since V1. **Reverse.** `git revert` the commit.

### D-353 · The footer carries the phone and marks external links · 2026-09-10
*(was D-222.)* The phone number moved from the About hero into the footer, where a contact belongs.
External links get a diagonal-arrow glyph (`aria-hidden`, with "opens in a new tab" as text).
`PrivateLink` is de-emphasised. Its theme toggle, build stamp and 2ndMind line were removed later
(D-343, D-345). **Reverse.** Restore `site-footer.tsx`; delete `external-link.tsx`.

### D-354 · Projects filter and sort are URL state; the grid is a Server Component · 2026-09-10
*(was D-223.)* The controls are `<Link>`s, so a filtered view is linkable and crawlable and the grid
is not serialised to the client. `/projects` is dynamic (it reads `searchParams`) but touches no
database. The hero card leads only the curated order. Status badges are one shape in two states.
**Reverse.** `git revert`; that also re-breaks linkable filters.

### D-355 · `?sort=` is validated with `Object.hasOwn` · 2026-09-10
*(was D-224.)* `in` walks the prototype chain: `?sort=constructor` silently reordered the page and
dropped a label.

### D-357 · The case study opens with a summary lifted from its own sections · 2026-09-10
*(was D-226.)* Problem / Approach / Result, each the first sentence of its section, so the summary
cannot disagree with the page. `firstSentence` returns null under 20 or over 260 characters, and a
list marker needs whitespace after it (a leading `**` once dropped the first line). **Reverse.**
Delete the `summary` block.

### D-358 · The table of contents and the reading-progress bar are one component · 2026-09-10
*(was D-227.)* Same measurement, one listener. `IntersectionObserver` for the active section; the
topmost intersecting section wins. Hidden with fewer than two sections. **Reverse.** Remove
`<CaseStudyToc>` and the `laptop:` wrapper.

### D-359 · Repo and demo links sit at the top of a project page · 2026-09-10
*(was D-228.)* They were below the fold on every project. Also: a wrapping "next project" link, and
relative dates in `title`. **Reverse.** Each is an independent block in `projects/[slug]/page.tsx`.

### D-362 · Hand-authored system diagrams, themed with CSS variables · 2026-09-10
*(was D-231.)* `system-diagram.tsx` holds four inline SVGs (Solenoid, Proof, Micromouse, TaskAble),
each drawn around the one thing its case study says matters — not a box layout. No hex, so they are
right in every theme and in print. On a phone they scroll (`tabindex={0}`) rather than shrink to
unreadable. Title is `aria-labelledby`, description `aria-describedby`. A test still asserts no
diagram for `dimaag-paper`, a slug that no longer exists. **Reverse.** Delete the component and the
`hasSystemDiagram` block.

---

## Resume

### D-016 · The PDF comes from print styling, not a PDF library · early
`@media print` in `globals.css`. $0 budget, and browser "Save as PDF" gives selectable text, which
resume parsers read. `.resume-block` avoids page breaks inside an entry. The print block is not
touched by design work. **Reverse.** Delete the `@media print` block.

### D-017 · The resume is generated from the vault, in two languages · early
`/resume/[variant]` renders from `lib/resume.ts`; `99_archive/resume.md` is written by
`scripts/build_indexes.py`. Both select by each entry's `resume_variants`, and a test asserts they
agree. The vault must stay readable without the app. **Reverse.** Delete `build_resume` and the
agreement test.

### D-076 · Bullet leading, not bullet count, closed the last 13px · 2026-08-25
Print bullet `line-height` 1.20 and section margin 0.375rem. Bullets were 44% of the page. The 9.6pt
type floor is untouched — leading is whitespace, type size is legibility. **Reverse.** 1.26 and
0.5rem; SWE goes to two pages.

### D-077 · The resume's page count is measured, not eyeballed · 2026-08-25
`npm run shots` prints each variant to PDF at Letter/0.5in and fails over one page, and reports the
sheet-height ratio so an overflow is fixable. Measure `.resume-sheet`; `scrollHeight` and `main`
both measure the window. **Reverse.** Delete `measureResumes`.

### D-078 · Coursework is four entries, shared by every variant · 2026-08-25
Algorithms and Complexity, Software Construction, Object-Oriented Design, Linear Algebra. It is one
flat list for all three variants. **Reverse.** Put the other three back and check `npm run shots`.

### D-115 · Resume entries may cap their own bullets per variant · 2026-08-29
`resume_bullets: { <variant>: <n> }`. Proof carries 2 on robotics. Trimming good content to fit
content that should not be there makes a worse document than asking — MathCounts and Lifeguard are
Tailor context, never resume content (D-118). **Reverse.** Delete the field and the two fallbacks.

### D-360 · The resume is a document, and the PDF is its only download · 2026-09-10, 2026-09-13
*(was D-229; absorbs D-245 and D-246.)* The sheet gets `shadow-floating` (a paper edge in light
themes, a ring in dark, from the token system) and padding that reflows on a phone. The uploaded PDF
is the single, primary download; the Print button is gone. PDFs live in `context/assets/resumes/`,
which the sync script allowlists for PDFs only — a transcript sits beside it in the vault. A
variant-named file wins on that variant; otherwise one general file serves all three. Replace the
file in place when refreshing it. **Reverse.** Restore `print-button.tsx` from git.

---

## Brand, colour and the design system

### D-002 · Fonts are self-hosted · early
Much of this project is written offline. Files came from `@fontsource`, copied into
`src/app/fonts/` as WOFF2. **Reverse.** Switch to `next/font/google`.

### D-005 · Motion lives in two custom utilities · early
`card-scan` and `link-wipe` are `@utility` blocks in `globals.css`; both collapse under
`prefers-reduced-motion` in one place. D-040: the sweep plays once (`forwards`, 0.85s); its resting
off-card transform and 260% travel are a bug fix and stay whatever happens to the timing.
**Reverse.** Inline the CSS.

### D-007 · The background is not a flat fill · 2026-08-20
`<html>` paints the ground; `body::before` holds three radial pools and `body::after` a noise grain
that dithers banding. **`body` must stay transparent** or both layers vanish. The drift animation is
off below 40rem (D-179); the cost could not be measured above noise on the laptop and the phone
feels fine, so that question is closed (D-193). **Reverse.** Delete the two pseudo-elements and put
`bg-background` on `body`.

### D-184 · The portfolio is pinned to the default theme · 2026-09-06
The public site is a shopfront: it looks the same to everyone, and its images were composed
against a dark ground. Done with `forcedTheme`, never `setTheme`, so visiting the portfolio never
writes over the app's stored preference. The boundary is `hasPublicChrome` — one answer to "is this
the private app". `theme-color` follows `resolvedTheme`, not a media query. Since D-345 there is no
public toggle, so public pages are Carbon-only. **Reverse.** Drop `forcedTheme` for public pages.

### D-194 · Palettes are solved for contrast by a generator · 2026-09-07
`tokens.css` is generated by `scripts/build-tokens.mts` and committed; `npm run tokens:check`
fails when stale. Every colour is authored in OKLCH and solved for a target ratio: text against the
worst ground it can sit on, accents against `surface`. Out-of-gamut colours are mapped by reducing
chroma. Switching is `data-theme` only; Tailwind's `dark:` is a generated selector list over the
dark themes. The OS preference maps to themes named `light` and `dark`. **Five themes, all permanent
(2026-09-24):** `carbon` (default, D-197), `dark-magenta`, `light-teal`, `hc-dark`, `steel-light`.
**Reverse.** Delete the generator, `lib/theme/` and `tokens.css`; restore `:root`/`.dark` blocks.

### D-196 · Amber is a signal, not decoration · 2026-09-08
Eyebrows are `text-primary`. `--highlight` is hue 70 in every theme because it is the warning hue,
so spending it on decoration pinned elements amber whatever the theme, and made a stale badge and a
page kicker the same colour. Amber stays on everything asking for attention. **Reverse.**
`text-primary uppercase` → `text-highlight uppercase` in eight files.

### D-197 · The default theme is Carbon, everywhere · 2026-09-08
`DEFAULT_THEME = "carbon"` in `registry.ts` drives the unthemed `:root`, the pinned public site,
`GROUND` in `lib/brand.ts`, the manifest, splash screen and status bar. `build-tokens.mts` imports
it rather than repeating the literal; `render-icons.mjs` must repeat it and `brand.test.ts` pins the
two (R15, D-147). **Reverse.** `DEFAULT_THEME = "dark-magenta"`, then `npm run tokens` and
`node scripts/render-icons.mjs`.

### D-198 · Mono is for data only, and `eyebrow` is a primitive · 2026-09-08
Nav labels, eyebrows, the tab bar and panel meta dropped mono. 53 copied eyebrow chains became
`@utility eyebrow`, which sets no colour. It lands on `--text-xs` (11.11px). **Reverse.** Add
`font-family: var(--font-mono)` to the utility.

### D-199 · The type, space, radius, motion and breakpoint scales are generated · 2026-09-08
`scale.css` comes from `scripts/build-scale.mts` (`npm run scale`, `scale:check`). **Edit the
generator, never the CSS.** The type scale redefines Tailwind's own nine names, anchored at `base` =
1rem, ratio 1.2; the generator prints where it deviated. Elevation and the scrim are per-theme and
live in `build-tokens.mts`. `--duration-*` needs explicit `@utility` blocks or it compiles to
nothing. **Reverse.** Delete the generator and `scale.css`.

### D-200 · Nine `ui/` components remain, and they are ours · 2026-09-08
Ten unused shadcn components were deleted (and `tw-animate-css` with them). The nine left — badge,
button, card, input, label, textarea, sheet, skeleton, sonner — were reworked at the V4 tokens and
are formatted by Prettier. `--scrim` is a per-theme token. `ui/form.tsx` never existed.
**Reverse.** `npx shadcn@latest add <name>`.

### D-201 · `/private/kitchen-sink` renders all five themes at once · 2026-09-08
A `data-theme` attribute on a section re-declares the palette for its subtree, so no iframes. Each
themed block paints its own ground. Every class name is written out in full — Tailwind cannot see an
interpolated class. Not in the navigation. **Reverse.** Delete the route and its `shots` row.

### D-202 · "No raw hex" is a test, with positive controls · 2026-09-08
`no-raw-hex.test.ts` fails on any hex literal in `src/` outside an allowlist whose every entry
carries a written reason. Comments are exempt: much of the hex in this repo is evidence. Three
controls check that the scanner can find anything at all (R11). **Reverse.** Delete the file.

### D-219 · The space scale lives in `:root`, not `@theme` · 2026-09-09
`--spacing-*` is a Tailwind namespace that `max-w-*` reads before `--container-*`, so
`--spacing-2xl: 4rem` had silently turned `max-w-2xl` into 4rem across six screens. `scale.test.ts`
forbids any `--spacing-*` in `@theme`. Related guard in `width-conflicts.test.ts`: a shared class
string never carries a width. **Reverse.** Only after renaming the steps to something that is not a
container size.

### D-252 · Three named content widths, assigned by a route table · 2026-09-18
`--width-prose` (42rem), `--width-content` (64rem, the default), `--width-wide` (80rem), declared in
`:root` for D-219's reason. `content-width.tsx` owns the private `<main>` and picks the longest
matching prefix. `wide` for Academics, Athletics, Calendar and Work; `prose` for `/private/now`.
**Reverse.** Delete the `WIDTHS` block and restore `mx-auto w-full max-w-5xl`.

### D-259 · Skeletons are static · 2026-09-19
Victor's answer: a shimmer on a screen that resolves in 200ms is worse than nothing. A skeleton is
told apart from a failed panel by shape, not motion. `shimmer` stays defined, unused. **Reverse.**
Add `shimmer` to `SkeletonLine` and `ui/skeleton.tsx`.

### D-260 · A skeleton declares the shape it stands in for · 2026-09-19
`SkeletonPanel shape="rows | text | table | chart | board"` — five, not one per screen. It exists to
reserve space so the page does not jump; an exact copy of each layout would drift.

### D-267 · The pressed state is a base rule · 2026-09-19
`globals.css` gives every `button` and `[role="button"]` a 0.97 `:active` scale (a ground shift
under reduced motion), except `:disabled` and `[data-no-press]`. It reaches buttons nobody has
written yet. **Reverse.** Delete the two blocks; `touch.test.ts` fails first.

### D-268 · `can-hover:`, because a screen width is not a mouse · 2026-09-19
Tailwind v4 already wraps every `hover:` in `(hover: hover)`. The new variant is for things hidden
until hovered, which used `sm:` as a proxy and were invisible on a touch tablet. Those controls are
44px. **Reverse.** Additive; going back to `sm:` is the bug.

### D-311 · OS accessibility preferences only remove effects · 2026-09-21
`prefers-contrast: more`, `prefers-reduced-transparency` and `forced-colors` are supported, and
every rule takes something away — a preference block that adds a look is a sixth theme nobody
maintains. Forced colours adds back panel borders the OS removed. No `forced-color-adjust: none`
anywhere. **Reverse.** Delete the three `@media` blocks.

### D-322 · The default theme's CSS block is `:root:not([data-theme])` · 2026-09-21
A bare `:root` matched every page at the same specificity as `[data-theme=…]`, so three of five
themes rendered as the default. Two tests pin it: no bare `:root,` and five distinct backgrounds.

### D-143 · The private nav switch is plain CSS · 2026-08-30
`.nav-desktop` / `.nav-mobile` / `.phone-hidden` / `.phone-only` are unlayered rules in
`globals.css`. They were written because `hidden sm:flex` failed in a production build. **As of
2026-09-21 that bug no longer reproduces** (D-310 — likely Tailwind v4), so `hidden sm:block` is
fine in new code; the hand-written switch stays because both navigations are built on it.
`node scripts/diag-display.mjs` re-checks the cascade in four lines. **Reverse.** Replace the classes
with Tailwind utilities, after re-measuring against a build.

### D-346 · The mark is a monochrome brain whose folds are holes · 2026-09-10
*(was D-215.)* `brain.svg` is shaped like the 🧠 emoji (D-151): a rounded lobed blob with six wavy
grooves of alternating length — similar cuts at similar spacing read as texture, not a subject. It
is `currentColor`, and the grooves are knocked out of the alpha by a luminance mask, so a groove can
never drift from the tile colour and the mark takes its colour from whatever contains it. `BOX` in
`render-icons.mjs` must be re-measured on every redraw. `icon-192.png` is tested against the default
theme's accent (R15). **Reverse.** Restore the gradient and stroked grooves from git.

### D-203 · The notification badge is an alpha stencil of the mark · 2026-09-08
Android paints a `badge` image's opaque pixels in the system colour, so an opaque tile showed as a
white box. `badge-96.png` is the mark in white on transparent; a pixel test asserts a row across it
breaks into several opaque runs. **Reverse.** Point `badge` back at `icon-192.png`.

### D-347 · `cramped` (380px) is a named breakpoint · 2026-09-10
*(was D-216.)* Below it the header wordmark hides and the mark stands alone. Named, not an inline
arbitrary value. **Reverse.** Drop the row from `BREAKPOINTS` and run `npm run scale`.

### D-348 · The favicon is generated from the mark · 2026-09-10
*(was D-217.)* `render-icons.mjs` writes `icon.svg`, `apple-icon.png`, a hand-packed three-frame
`favicon.ico`, and the shortcut glyphs. The old `.ico` was never the mark. The ICO frames widen the
fold stroke as they shrink. At exactly 16px on a 1x screen it reads a little like a crown —
**accepted 2026-09-24.** **Reverse.** Delete those blocks and restore the old `.ico`.

### D-349 · The OG cards are rendered by Playwright, not `next/og` · 2026-09-10
*(was D-218.)* `next/og` cannot read WOFF2, the only format this site's fonts exist in, and would
fall back to Geist. `scripts/render-og.mjs` renders one card per published project plus a site card,
with the real fonts and the carbon tokens; PNGs are committed and `og.test.ts` compares their
manifest to `publicProjects()` both ways. The site card carries no wordmark. A row of pillar glyphs
uses `waves` for dragon boat until custom icons are drawn (Open items). **Reverse.** Delete the
script, `public/og/`, and the `images` metadata keys.

---

## The private shell and navigation

### D-045 · Loading boundaries and streaming · 2026-08-21
A `loading.tsx` under `/private` and a Suspense boundary around every database or GitHub read.
Every private page is `force-dynamic`, and the function overhead cannot be removed; what can be
fixed is that nothing appeared while it ran. **Reverse.** Only if the pages stop being dynamic.

### D-132 · A bottom tab bar on phones · 2026-08-30
Below 40rem: **Today · Train · [Log] · Next · More**. Train opens the session logger and stands for
all of `/private/athletics`; Next is the calendar. More holds the other training screens, Now,
Academics, Work, Hobbies, Not sent and Settings. `env(safe-area-inset-bottom)` keeps it clear of the
gesture pill. The sheet remembers which page it was opened on, so it closes on navigation.
Above 40rem the sidebar (D-251) takes over. **Reverse.** Delete `private-tabbar.tsx`.

### D-149 · The private app does not wear the public header and footer · 2026-08-30
`lib/chrome.ts` holds the one predicate, `hasPublicChrome`, matching the segment, not the prefix.
The header and footer are passed into `PublicChrome` as props so the footer stays a Server
Component. The way back to the portfolio is in Settings. **Reverse.** Render them in the root layout
again.

### D-170 · Dynamic-route prefetches stay warm for 30s · 2026-09-04
`experimental.staleTimes.dynamic = 30`. Only the layout and loading shell are reused; data still
streams fresh. **Reverse.** Delete the block in `next.config.ts`.

### D-178 · Launcher shortcuts land in a form · 2026-09-05
Three manifest shortcuts: **Log training** → `/private/athletics/log`, **Quick note** →
`/private?capture=1`, **End of day** → `/private/log?category=day`. `?category=` is validated on the
server; a test resolves each shortcut against the real categories. **Reverse.** Delete the
`shortcuts` block.

### D-180 · Swipe a row: right completes, left deletes · 2026-09-05
`SwipeRow` wraps task and log rows; left is destructive everywhere, and a log row resists a right
swipe. The buttons stay — a gesture is never the only way. The gesture uses the same action dispatch
as the buttons. It engages only past 12px of mostly-horizontal movement, with `touch-action: pan-y`,
so it never steals a scroll. D-269: colour appears first, then the icon. **Reverse.** Remove the
wrapper.

### D-181 · Pull down to send · 2026-09-05
`PullToRefresh` on every private screen fires the same `SYNC_EVENT` as the retry button and stops
when `SYNC_DONE_EVENT` fires. Not on the offline shell. `overscroll-behavior-y: contain` on `body`
stops Chrome's own pull from reloading. D-270: the indicator is a filling ring, and `RELEASE` is one
named constant used by the gesture and the ring. **Reverse.** Remove the component from the layout.

### D-195 · `/private/settings`, and each control has one home · 2026-09-08
Anything that affects the site and is not used regularly lives in Settings — theme, notifications,
install, public-site link, sign-out, manual sync, passkeys, the deployed commit — moved, not copied,
so the two navigations cannot drift. The theme picker is a "match the phone" switch above the list.
Swatches are painted from literals, since a swatch shows a theme that is not active. The theme stays
in the offline More sheet because it needs no server. A **density toggle** is still wanted (Open
items). **Reverse.** Delete the route and restore the controls to the navigations.

### D-234 · Eight private nav entries; Training is one of them · 2026-09-10
Train and Athletics merged into **Training**, pointing at the logger, with Log / Exercises / Records
/ History as in-page tabs. Two top-level items were spent on one subject. **Reverse.** Split the
entry and delete the tabs.

### D-241 · Service worker updates apply immediately · 2026-09-12
No "Reload" banner: `applyUpdate` fires as soon as a worker is waiting. One user, who knows when he
has deployed. A reload mid-keystroke is the accepted cost. **Reverse.** `git revert`; hold the
waiting worker in state again in `ServiceWorker.tsx`.

### D-251 · On desktop the nav is a sidebar, collapsed by default in CSS · 2026-09-18
Same eight sections under **Daily** (Today, Now, Log) and **Areas** (Training, Academics, Work,
Calendar, Hobbies), plus Not sent, Settings and the connection glyph. It appears at 40rem and is
icon-only below 64rem. Collapse is not React state: an inlined `PREPAINT` script sets
`data-nav="collapsed"` before first paint. The collapsed look is the base state and wide is the one
exception, so a failure leaves a working rail. **Reverse.** Restore `private-nav.tsx` from git.

### D-253 · On a phone the page header is a 44px title bar · 2026-09-18
Title, connection glyph and the page's actions. Eyebrow and lede hide below 40rem; the actions stay,
because on several screens the header action is the first thing you can do. Not sticky.
**Reverse.** Drop `phone-hidden` in `page-shell.tsx`.

### D-254 · One glyph shows sync state; the pill only appears when a person is needed · 2026-09-18
`connection-glyph.tsx` is always visible; `SyncRunner`'s pill appears only for stale, failed or
degraded states. One store, `lib/sync/status.ts`, feeds the glyph and both badges, and is published
before the flush. The glyph ranks by what needs a person: a rejected op outranks being offline.
**Reverse.** Restore the `urgency !== "none"` condition.

### D-255 · The More sheet has a grabber and a real drag · 2026-09-18
Two snap points (content height, 85dvh). A flick beats distance; from full, down means partial.
Velocity is sampled over ~80ms. The arithmetic lives in `lib/ui/sheet-drag.ts` so it can be tested.
**Reverse.** Delete the grabber and the three pointer handlers.

### D-256 · The active tab icon is filled at 20% · 2026-09-18
Colour alone was the only active signal (R14); a solid fill turns lucide outlines into blobs.

### D-257 · Two columns on Today and Academics · 2026-09-18
Today is `1fr + 22rem` at `laptop`: act on the left, read on the right. Academics is even. Athletics
only gets the wider column. Both grids stack in the measured phone order. **Reverse.** Remove the
wrapper `<div>`s.

### D-258 · One `<main>` per page, one skip link per layout, a focus-ring floor · 2026-09-18
The private layout owns the only `<main>`. Skip links in `PublicChrome`, the private layout and
`/cached`. A zero-specificity `:where(…)` focus-visible rule is the floor that designed focus states
still beat. **Reverse.** Additive, except `<main>` → `<div>` in pages.

---

## Shared states, forms and feedback

### D-043 · Freshness is a badge that appears only when something is stale · 2026-08-21
A permanent list of healthy files is furniture. **Reverse.** `freshness-panel.tsx` is in git.

### D-061 · Charts are server-rendered SVG · 2026-08-22
`chart.tsx` draws `TrendChart` and `BarChart` by hand — no client boundary, no charting runtime.
`recharts` was uninstalled (D-330). **Reverse.** Reinstall a library and accept the JavaScript.

### D-155 · The form remembers context, never measurements · 2026-09-03
Per field in `categories.ts`: `sticky` (context from the last entry — never a number, asserted over
every category), `chips` (recent values as tap targets, which print what they fill), and a declared
`keypad`. A failed save puts back what was typed. Sticky values are read through
`useSyncExternalStore`. **Reverse.** Remove the flags; absent means the old behaviour.

### D-168 · The error panel is one line until opened · 2026-09-04
A native `<details>` whose summary carries the top finding and its count. It is absent when nothing
is open (D-165), and that must survive any reversal. **Reverse.** Swap back to a `<section>`.

### D-206 · The slow-save notice promises only what is true · 2026-09-08
After six seconds: "Still trying — the connection is slow. Keep this open until it saves." It does
not claim the entry is on the device, because Server Action forms keep no local copy. The button
stays disabled. **Reverse.** Delete `slow-save.tsx` and its call sites.

### D-207 · Nothing inside a `<form>` may call `setState` while its action is pending · 2026-09-08
On React 19.2, any `setState` inside a form ends `useFormStatus().pending` early, re-enabling Save
mid-POST. Toggle `hidden` through a ref. `slow-save.test.tsx` pins it. This constrains anything
rendered inside a submitting form.

### D-261 · One "as of" badge, and the thresholds are arguments · 2026-09-19
`AsOf` grades fresh / aging / stale with caller-supplied thresholds; `now` is required so two badges
measure the same instant. **Reverse.** Additive.

### D-262 · One failure box, and "database behind the build" is not red · 2026-09-19
`Unavailable` replaced six copies. When `describeDbError` (D-156) says the schema is behind, it
renders amber with the command to run — a step not yet taken is not a crash. **Reverse.** Git has
the six blocks.

### D-263 · The toast is mounted, and it is not how a save is confirmed · 2026-09-19
`PrivateToaster` in the private layout and in `/cached`, bottom-centred above the tab bar, 8s.
`notify` offers `undoable`, `failed`, `done`. Destructive actions are undoable, not confirmed, so the
toast's action button is 44px. `buzzSaved()` stays the save confirmation. It lives in the private
layout, not the root one (D-064). D-264: removing a task or a log entry raises an undo toast instead
of an inline row. **Reverse.** Remove the two mounts.

### D-265 · One form vocabulary · 2026-09-19
`field.tsx` holds the control look, labels, chips, the error summary, `useDirty`, `StickySave` and
`useBlurValidation`. Controls are 48px. `sticky` and `keypad` are annotations; `chips` and
`clipboard` are real controls. Inputs stay uncontrolled. `StickySave` shows only when dirty on a
phone, and its label differs from the form's own submit. **Reverse.** Point `LogForm`'s aliases back
at local strings.

### D-266 · `ActionState` carries `queued` · 2026-09-19
"Saved" and "safe on this phone" are different outcomes; only `lib/offline/write.ts` sets it.

### D-304 · Why an entry is stuck is a designed block, and its age is prominent · 2026-09-21
On `/private/sync`, the op's reason is a bordered block and its age is `text-sm` foreground. Waiting
is not an error; only a row that needs a person gets the destructive border.

### D-305–D-309 · Charts lead with their number · 2026-09-21
`ChartHeadline` shows the current value and a delta whose colour is a verdict, not a direction —
`lowerIsBetter` decides (D-305). Axis labels hide on phones, making the same SVG a labelled
sparkline (D-306). `ChartPin` is a client overlay of pre-formatted strings, so the chart stays a
Server Component; tapping again clears it (D-307). The PR table becomes cards under 40rem (D-308).
Empty charts use the shared `Empty`; no mount animation (D-309).

### D-312 · Every chart carries its data as a table, behind a closed disclosure · 2026-09-21
`ChartTable` in a native `<details>`: the honest text form of a chart is its data. The SVG keeps its
`role="img"` label. Missing points are an em dash. **Reverse.** Remove the two call sites.

### D-313 · One live region · 2026-09-21
`Announcer` is mounted once, empty, in the private layout; `useAnnounce(state)` feeds it. Twenty
per-form regions mostly could not fire, because they were created with their own content. Polite,
even for errors. Repeats get a zero-width space. **Reverse.** Drop `<Announcer />` and restore
`role="status"`.

### D-314 · Focus order is tested as a property · 2026-09-21
On the log form: no positive `tabindex`, tab order equals DOM order, Save is reachable, and a chip
sits right after the input it fills. A literal element list would break on every content change.

---

## Today, the log and tasks

### D-036 · High-frequency writes go to Postgres, not the vault · 2026-08-21
Every vault write is a commit and a deploy. Logs, tasks, workouts and the like live in Postgres and
save immediately; the vault keeps prose that is written rarely and read by agents. **Reverse.** Point
the log actions at the vault and accept a commit per save.

### D-037 · Everything actionable is one task model · 2026-08-21
Sprint goals, academic items, to-dos and Canvas assignments are rows in `tasks`, each with a
`source`. Four competing lists was the named way this project would get abandoned. **Reverse.**
Split by `source`.

### D-039 · Log fields are proposed from the vault, then edited · 2026-08-21
So logged quantities match the vocabulary the PR tables already use.

### D-047 · Categories are data, and the form is generated from them · 2026-08-21
`lib/log/categories.ts` drives the form, summary, search index and validation. No category may
exceed eight fields — a log must be fillable in fifteen seconds. **Reverse.** Edit the array.

### D-048 · Log entries are one table with JSONB fields · 2026-08-21
`log_entries`: category, `occurredAt`, note, per-category `jsonb`. `searchText` is written by
`createEntry` itself, never by callers. Search uses `plainto_tsquery`, which cannot throw on a stray
`&`. **Reverse.** Promote hot fields to columns.

### D-049 · Dictation is feature-detected with `useSyncExternalStore` · 2026-08-21
The dictate button renders nothing where the Web Speech API is absent. Android Chrome has it
(D-038). **Reverse.** Detect another way, but never set state in an effect.

### D-062 · The Los Angeles offset is computed · 2026-08-22
`zoneOffsetMinutes(now, timeZone)`; a hard-coded 420 is wrong for five months a year. **Don't
reverse.**

### D-100 · Approval is a typed proposal, and rejection is absence · 2026-08-25
A proposal is `{ key, label, before, after, note }[]`; the review ticks items, values are editable,
and only ticked items are sent. An approved empty value is a deletion. Staleness is checked on the
server against an order-independent fingerprint. Nothing is stored between steps. **Reverse.**
Delete `lib/proposals/` and `proposal-review.tsx`.

### D-101 · The goal drafter parses the model's output and drops what it cannot use · 2026-08-25
Zod-parsed; unknown domains and duplicates dropped; raw text logged, never shown. Uncached, and the
panel starts closed so the button is not pressed from habit. **Reverse.** Delete
`lib/ai/goal-drafts.ts`; the manual goal editor stays.

### D-111 · The inbox is a task row · 2026-08-29
`source: "inbox"`, undated, undomained. It nags on the age of the oldest item (7 days), not the
count, and sorts oldest first. **Reverse.** Delete the inbox panel and `addInboxNote`.

### D-112 · Today has one Goals panel, and the Backlog starts closed · 2026-08-29
Drafting next week is nested inside Goals, closed — each press is a paid API call.

### D-134 · Mood and energy are 1–5 fields · 2026-08-30 — **marked for removal 2026-09-24**
Anchored at the ends (*wrecked … great*, *empty … wired*), five radio tap targets, dropped rather
than clamped when out of range. The rule was "if the series is flat for a month, reconsider"; Victor
chose removal. **To remove.** Delete the two fields from `categories.ts`; restore the comment that
recorded why they were once absent.

### D-164 · A capture box, and an unsorted pile for what it catches · 2026-09-05
One field, one send, note or task (default note). A task goes to the inbox (D-111). `note` is a real
category with no tab. The unsorted pile shows only when non-empty, with one-tap filing per category;
filing recomputes `search_text` and only ever moves an entry out of the pile. The tab row wraps
instead of scrolling. Works offline. **Reverse.** Delete `quick-capture.tsx` and the pile.

### D-167 · Actionable content first, on every private screen · 2026-09-04
Today: tasks above the schedule. Academics: the list above its counts. Athletics: the thing you can
tick above the goal card. Each moved block names the number it moved for; re-run `npm run shots` if
reversing — if the number does not move, the reason was wrong.

### D-182 · The fold marker is opt-in, and the gate measures the deepest one · 2026-09-05
`data-first-action` is a prop, set on Today's Due list, Academics' list and the capture box on
`/private/log`. The capture box on Today sits **below** the Due list — above it, it cost 122px. A
mirrored panel must not claim the marker (D-235). Reverse all three parts or none.

### D-183 · Offline search is the same box, with a stated difference in matching · 2026-09-06
The worker answers `/private/log?q=` with the shell, which searches the local mirror's
`search_text`: word-beginnings, every term required, newest first, capped at fifty. `ran` does not
find `running` offline; that limit is a test. D-214 keeps it separate from the fuzzy exercise
search. **Reverse.** Delete `lib/offline/search.ts`.

### D-217 · Log entries are editable, but not their category · 2026-09-09
`editEntry` changes note and fields and recomputes `search_text`. The category comes from the stored
row, so an edit can never recategorise — `fileEntry` (D-164) remains the only one-way door. Retired
categories stay editable (R16). **Reverse.** Delete `editEntry` and `updateLogEntry`.

### D-221 · The weigh-in is its own quick-log category · 2026-09-09
Key `weight`, with a sticky "when". A form that asks for bodyweight every session collects careless
numbers, and this number feeds every adjusted split. `takeBodyweight` still lifts it into
`bodyweight_entries`, one copy only. **Reverse.** Put the field back on `SessionInput`.

### D-248–D-250 · Free tags · 2026-09-13
`tags` is a `text[]` column on `log_entries` and `tasks`, travelling with the row in the same sync
op — no join table, no new entity (D-248). Two vocabulary queries, one per table, frequency-sorted,
with shared normalisation (D-249). Caps: 20 tags per row, 40 characters, dropped past the limit,
set in `protocol.ts` and `lib/log/tags.ts` together (D-250). GIN-indexed (D-331). **Reverse.** Drop
the column and remove `tags` from the payloads and writers.

### D-284 · The capture box is the loudest thing on Today, and does not move · 2026-09-21
Primary border and tint, its own label, a filled Save, 48px field. Loud, not higher (D-182).

### D-285 · The summary archive is a route · 2026-09-21
`/private/log/archive`: every daily and weekly summary, newest first; Today links to it.

### D-286 · Summaries are quiet, closed, and name the model · 2026-09-21
`Panel tone="quiet"`, closed by default, with a sparkle glyph and the model name as real text.

### D-287 · Overdue is loud in weight and edge, never in red · 2026-09-21
Amber, semibold, a 2px left rule. Red is for failure; late is not failure.

### D-288 · A task's domain is an icon and a word · 2026-09-21
The nav's own icons. A course code replaces the domain badge rather than joining it.

### D-289 · The agenda draws a "now" line, on the server · 2026-09-21
Between the last started and the next event, compared in `America/Los_Angeles` day keys (UTC
misplaces every evening after 5pm). No ticking timer; a reload is the refresh.

### D-290 · A draft keeps everything, and says so · 2026-09-21
`lib/log/drafts.ts` stores the whole form per category, 500ms after typing. A restored draft
announces itself and offers **Start fresh** — that announcement is what keeps D-155's rule intact.

### D-291 · The log opens on the last tab used · 2026-09-21
Restored in an effect (no hydration mismatch); `?category=` always wins; the stored key is validated
against live tabs.

### D-292 · Search results mark the words searched for, approximately · 2026-09-21
Prefix matches inside `<mark>`; Postgres stems and the browser does not, so a row matched on a stem
shows no mark and the count says why. A test asserts the marked segments rejoin to the input.

### D-294 · The log's "nothing found" boxes are the shared `Empty` · 2026-09-21
`reason="filtered"`, with an action that clears the filter.

---

## Training and athletics

### D-024 · Training data lives in Postgres · 2026-08-21
It is tabular and queried across rows. No public route imports `lib/db` or `lib/athletics`, and the
public build runs with no database (R12). **Reverse.** Delete the routes and the two lib folders.

### D-025 · Personal records are computed on read, never stored · 2026-08-21
A stored record has no invalidation story. At one athlete's volume, recomputing is free.

### D-026 · Imports are idempotent through a derived `external_id` · 2026-08-21
`hevy:<ISO timestamp>:<title-slug>`, uniquely indexed; sets are written only for workouts the insert
created. Hevy exports are cumulative. **Reverse.** Only if imports become one-shot.

### D-027 · Numeric columns are `mode: "number"` · 2026-08-21
Otherwise `numeric` arrives as a string and `"95" > "155"`.

### D-029 · Warmups are stored, count toward volume, and never set a record · 2026-08-21
`isWorkingSet()` excludes `warmup` and `drop` from records; `weeklyVolume` deliberately includes them
(D-060, Victor's call — they are load the body absorbed). `isWorkingSet` is a deny-list that
defaults to counting, which is why new intent went into `piece_type` (D-230), not `set_type`.

### D-030 · Estimated 1RM is capped at 12 reps · 2026-08-21
Epley drifts at high reps. **Reverse.** Change `E1RM_REP_CAP`, or better, the formula.

### D-055 · The week's plan is compared to logged sessions coarsely · 2026-08-22
A day either has a session or not; future days are never "missed". Nothing links a workout to a line
of the programme, and a confident wrong match is worse than an honest coarse one.

### D-056 · Training plans are parsed from the vault · 2026-08-22
SPM targets, the weekly split, the goal and the fall challenge (D-271) are read from
`context/02_physical_performance/` per request. Editing the vault is editing the app. Parsers are
line-based (the vault is CRLF), return empty rather than throw, and every panel names the heading it
looked for. Tests run against the real files. **Reverse.** Hard-code the structures.

### D-057 · Splits are weight-adjusted with Concept2's formula · 2026-08-22
`factor = (bodyweight_lbs / 270) ^ 0.222`. It discounts lighter athletes, so gaining mass makes the
sub-2:00 adjusted goal harder; both lines are charted, and the page leads with the required raw
split. A test pins the direction.

### D-058 · Bodyweight is a table, and it is health data · 2026-08-22
`bodyweight_entries`, one row per `date`, upserted. Never publishable (R12). **Reverse.** Drop the
table and `adjusted.ts`.

### D-059 · Daily completions are their own table, not `tasks` · 2026-08-22
`rehab_completions`, keyed `(completed_on, slug)` — a daily checklist is "done today", never done,
and would bury the task list. It now stores the stretching-routine ticks (D-272).

### D-211 · Workouts are writable, and a session travels as one aggregate op · 2026-09-09
`workouts`, `workout_sets` and `exercises` gain `client_id`. A session and all its sets are one
outbox op, applied atomically, with the server assigning the foreign key (`SYNC_DESIGN.md` §4a).
After creation each set is its own op. **Reverse.** Remove the three entities from `WRITABLE`.

### D-212 · The aggregate op uses `db.batch`, because `neon-http` has no transactions · 2026-09-09
`atomically()` prefers `db.batch` and falls back to `db.transaction`; the child's foreign key is a
sub-select, not a `RETURNING` value. It passed every PGlite test and 500'd on the first real session
(R9). Three tests use a neon-http-shaped handle. **Reverse.** Move to `neon-serverless`.

### D-213 · The exercise catalogue is a seeded, synced table · 2026-09-09
Seeded from `lib/athletics/catalogue.ts`. `modality` decides what a set asks for. A set stores the
exercise **name**, not a foreign key, so an import never fails on an uncatalogued movement. The seed
never touches rows you added. **Reverse.** Drop the table; the picker becomes free text.

### D-214 · Two search implementations, on purpose · 2026-09-09
Exercises: fuzzy and ranked, with a bonus for contiguous letters (`bnch` finds Bench Press first).
The log: prefix matching over prose (D-183). They want opposite things.

### D-215 · Training is logged as sessions; the `athletics` log category is retired · 2026-09-09
Logged at `/private/athletics/log`; `allEfforts()` reads one source. The category is retired, not
deleted (R16). Its bodyweight field moved to its own category (D-221). This closed the read-time
union of D-159. **Reverse.** Move the definition back into `CATEGORIES`.

### D-216 · A session is written to the outbox, never through a Server Action · 2026-09-09
`saveSession` enqueues and returns, online or off. The aggregate op carries its own identity and
re-sends are upserts, so local-first is not a degraded mode. Session editing (D-243) reads and
writes IndexedDB the same way. **Reverse.** Add a Server Action and inherit the two-paths problem.

### D-218 · "AI add" proposes a catalogue entry, and prefers matching · 2026-09-09
`POST /api/exercises/suggest` returns an existing name or a proposed entry and never writes (R13). A
`match` not in the supplied list is discarded as a hallucination. Near-duplicates split a lift's
history. **Reverse.** Delete the route and the button.

### D-220 · A set is a card with its controls stacked · 2026-09-09
Numbered header, value fields in two columns, set type as chips (a native select on Android is a
full-screen modal). Five controls did not fit in 324px (R8).

### D-222 · One body drawing, highlighted from the catalogue · 2026-09-09
`muscle-map.tsx` lights regions from an exercise's `muscles` array — one picture computed from the
data cannot disagree with it. Empty arrays read as "unknown", so movement entries were given real
tags. The geometry is licensed art (D-239); the argument is unchanged. **Reverse.** Delete the
component.

### D-224 · The catalogue comes from the bundle first, the device second · 2026-09-09
The picker seeds from `CATALOGUE` and merges the synced mirror over it, re-reading on
`SYNC_DONE_EVENT`; a partly synced device once could not find Bench Press. The bundle wins a name
collision **unless** the row carries `user_edited_fields` (D-232). **Reverse.** Read the mirror
alone.

### D-227 · The muscle vocabulary is 21 regions; `core` is a synonym · 2026-09-10
`lib/athletics/muscles.ts`: `core` split into abs and obliques, rear delts separated, rotator cuff,
adductors, abductors and hip flexors added. `expand()` maps `core`.

### D-228 · `exercises.name` is not unique · 2026-09-10
The index protected nothing (sets store the name) and caused a permanent sync wedge when two devices
added the same movement. The writer converges same-named rows to the highest `updated_hlc`.
**Reverse.** Expect the wedge back.

### D-229 · A routine op is replace-all · 2026-09-10
A routine's whole line list travels; lines not in it are tombstoned. Templates are saved, not
appended to.

### D-230 · `piece_type` is a new column, not a new `set_type` · 2026-09-10
`steady | interval | warmup | race`. `set_type` says whether a set counts; `piece_type` says what it
was, and nothing ranks on it. `race` is what marks a time trial (D-244).

### D-231 · How-to text is a database column · 2026-09-10
Two sentences per movement — setup, execution, the usual mistake — instead of demonstration clips,
which have no lawful source (D-223). Stored in `exercises.how_to`, editable on the detail page, and
seeded by `seed_key` so a rename cannot break it.

### D-232 · Seeded exercises are editable; `user_edited_fields` makes that safe · 2026-09-10
The seed script respects edited columns, and the merge lets the mirror win for an edited row.
Without it every edit vanished on reload. **Reverse.** Make seeded rows read-only again.

### D-233 · The catalogue was renamed once, and history with it · 2026-09-10
`Movement (Equipment)`; 164 → 139 entries; distances moved onto the set. `renames.ts` is the record.

### D-235 · A mirrored panel does not claim the page's `data-first-action` · 2026-09-10
The checklist mirrored onto Today passes `firstAction={false}`; two markers made the fold gate
measure the wrong element.

### D-236 · The offline shell knows the exercise routes · 2026-09-10
Data being offline is not the same as the screen being reachable; only the end-to-end run tells
them apart.

### D-237 · The exercise picker is a full screen with a fixed header · 2026-09-10
Search and filter chips in a fixed header, add/create in a fixed footer; only rows scroll. The
keyboard inset is measured through `visualViewport`. The create block folds away until a search
finds nothing. **Reverse.** `side="right"` on the `SheetContent`.

### D-238 · A search abandons the grouping · 2026-09-10
With a query, one flat list in score order; muscle groups return when the box is cleared. A small
recency boost breaks ties and never overturns a match. The picker opens with eight recent movements.

### D-239 · The body figure is licensed art · 2026-09-10
Geometry from **react-native-body-highlighter** v3.2.0 (MIT), licence in `NOTICE`; five regions are
original additions. Two unlicensed repositories were declined. `detail="simple"` draws only worked
regions. **Reverse.** `git revert`, and remove the `NOTICE` section with the paths.

### D-242 · Duration is typed as m:ss everywhere · 2026-09-13
Through `parseTimeToSeconds` / `formatDuration`. `FIELDS_FOR` lives in `lib/athletics/fields.ts` so
the logger and `RecentSessions` cannot drift. Records say how many erg sets lack a distance or time.

### D-243 · A session is editable at its own URL · 2026-09-13
`/private/athletics/sessions/[clientId]`, a client page over IndexedDB (D-216). The quick inline
fixes in `RecentSessions` stay.

### D-244 · Time trials are their own tab · 2026-09-13
Sets tagged `pieceType: "race"`, grouped by exercise and nearest 100m, every result kept. A fast
training piece must not stand in for a test. Erg, Perg (its own catalogue entry) and OC categories.
Not linked to the hand-kept PRs in `benchmarks_and_logs.md`.

### D-271 · The fall challenge is a vault file · 2026-09-20
`fall_2026_challenge.md` holds the rules, goals, 76 dated days, blocks, fifteen routines and
fuelling plans; `lib/athletics/challenge.ts` parses it per request (D-056). Completion is in the
database; prescription is not. **Reverse.** Delete the file and parser; the two panels disappear.

### D-272 · The routine checklist replaced the rehab checklist, in the same table · 2026-09-20
`routine-checklist.tsx` shows the day's routine and writes through `toggleRehabAction` into
`rehab_completions` with slugs namespaced `routine/movement`. Reusing the table saved a migration,
an entity and a writer. The rehab movements were absorbed into the routines (minus the Pallof press —
D-279). `parseRehabProtocol` is kept with no caller, as a vault-shape guard.

### D-274 · Rule 4's practice credit is applied outside `challengeProgress` · 2026-09-20
`applyPracticeCredit()` raises a logged water or race day to 5,000m and never invents a day. The
progress function stays an honest sum.

### D-275 · `training_blocks.md`'s weekly layout describes the challenge week · 2026-09-20
Otherwise two contradictory weekly plans sat side by side. The pre-challenge layout is in git (the
commit that made this change). Paste it back and the panel follows with no code change.

### D-276 · Plan edits live beside the vault, in `plan_overrides` · 2026-09-20
One row per changed day; `applyOverrides` merges on read and keeps the original. The app never
rewrites the plan file: that would need a serialiser, lose edits to last-write-wins, and erase
"planned vs decided". Null means "leave the vault's value", so the edit form starts empty. Not
synced; reverting hard-deletes. `challengeFaults` runs on the original. **Reverse.** Drop the table.

### D-277 · One `loadPlan()`, because the merge order matters · 2026-09-20
Parse, merge overrides, then assign routines — every screen calls `loadPlan()`.

### D-278 · Routines rotate by a running count across the challenge · 2026-09-20
*(absorbs D-273.)* The plan declares a `Type` per day and a `Pool` per routine; a day gets the *n*th
routine of its pool, *n* counting earlier days of that pool. Computed, not written into the vault.
Two local schemes (day mod pool size; per-week slots) both repeated routines — do not rediscover
them. Changing a past day's type reshuffles later days; accepted. Each pool must be at least as large
as that pool's most days in any week; a test enforces it. "Unique" means no repeat within a week.

### D-279 · Every stretch is floor-and-bodyweight · 2026-09-20
Dorm, hotel, boathouse. A test bans equipment words. The Pallof press had no equipment-free
equivalent and is gone from the routines; dead bugs, bird dogs and side planks carry
anti-rotation.

### D-280 · Boat practice is credited, never prescribed · 2026-09-20
Content is the coach's call. The `water` type still earns the 5,000m credit.

### D-319 · The fold limit is 350px; Athletics is allowed 460 · 2026-09-21
Measured after the phone header collapsed. Athletics is over because the challenge card sits
above the checklist on purpose (D-276). If Athletics is reordered, delete the allowance rather than
raise it.

### D-332 · Exercise search is not debounced · 2026-09-22
A search costs ~0.075ms; debouncing would add 150–300ms to a screen used mid-set. The render cost of
the list is unmeasured — profile it before optimising.

---

## Academics, work, calendar and hobbies

### D-051 · Calendars come from private iCal URLs, parsed with `ical.js` · 2026-08-21
`GOOGLE_CALENDAR_KEY` and `CANVAS_CALENDAR` are secret feed URLs in the environment — no OAuth. Real
feeds have recurring rules, timezones and an unbounded recurrence (capped at 400).
`TimezoneService.register` takes `(component, name)`. **Reverse.** Unset the variables.

### D-052 · Canvas import is a button · 2026-08-21
A nightly job needs a paid tier and could fail unwatched. The action calls `updateTag("calendar")`
first.

### D-053 · The agenda shows the whole feed, unfiltered · 2026-08-21
One general calendar; a classifier would silently drop a class. If ever filtered, mark rather than
hide.

### D-103 · `/private/work` reads the applications sheet, and never writes to it · 2026-08-25
The published CSV from `JOB_SHEET_CSV_URL` (a credential, kept in Vercel). A Gmail script is the
sheet's writer; reading is a view, not a second tracker. Headers are matched loosely; non-ISO dates
are blanked, not guessed. Editing the sheet from the app stays dropped (D-141, reconfirmed
2026-09-24). **Reverse.** Unset the variable.

### D-104 · Tailoring returns bullet ids, never bullet text · 2026-08-25
Every bullet is offered as `section:slug#index`; any id not offered fails the whole response.
Bullet text on screen comes from the vault. A posting under 80 characters is refused. D-117 adds
application questions with the same id discipline and **no draft field** — a drafted answer is the
model's prose under Victor's name. D-110: Tailor lives at `/private/work/tailor`. **Reverse.**
Delete `lib/ai/tailor.ts`.

### D-118 · The Tailor library is vault-wide · 2026-08-29
Built from the public experience, projects and pursuits, not from the resume. `resume_variants`
decides what is printed; the library decides what the model may talk about.

### D-123 · Any Google Sheets link is accepted and converted to CSV · 2026-08-29
`normaliseSheetUrl`. Publish-to-web (one tab) is recommended over link-sharing (whole sheet).

### D-187 · The course planner checks and never suggests · 2026-09-06
`/private/academics/plan`: five terms to June 2028, checked against `degree_audit.md` through
`lib/academics/requirements.ts`. A course counts once; definite claims first. Answers are yes, no,
or **cannot tell** (the audit's lists are truncated). Stored in the vault (`course_plan.md`, not
yet written). Textareas on a laptop; a read-only table with an Edit button on a phone (D-298).
**Reverse.** Delete the route, action and `lib/academics/`.

### D-189 · Filament and printers are entered on the site · 2026-09-06
`filament_spools` and `printers` in Postgres; only the material is required. Emptiest first; empty
spools stay and are their own band. Colours are allowlisted `#rgb`/`#rrggbb` at render. Four printer
states in their own module. D-303: a spool level is a bar, a printer state a dot and a word.
**Reverse.** Drop the two panels.

### D-295 · The degree audit renders as structure · 2026-09-21
`RequirementProgress`: a meter and one card per open requirement, from the planner's parser, so the
two screens cannot disagree. Totals come from the frontmatter. **Reverse.** Put `<VaultDocument>`
back.

### D-296 · In progress is not done, and a truncated list says so · 2026-09-21
An `IP` course is a dashed token without a tick. D-299: a planned course the audit cannot verify is
a dashed token marked **unchecked**.

### D-297 · The GPA is on the private academics page · 2026-09-21
From the same `core_profile.md` field the resume reads.

### D-300 · The applications board is a view with no status control · 2026-09-21
Five stages derived from the sheet's free-text status (`stageOf`); the sheet has one writer, so the
board cannot move cards. The shortlist shows high-priority rows only.

### D-301 · The calendar has Agenda and Month views, both rendered on the server · 2026-09-21
A client component switches one boolean, remembered in `localStorage`. D-302: in the month grid a
Google day is a filled dot and a Canvas day a ring (R14).

---

## AI

### D-067 · The daily summary is cached on its prompt and reads the live log · 2026-08-24
`unstable_cache`, 6h, tag `ai-summary`, keyed on the prompt — a real change regenerates; repetition
is free. D-086: failures throw at the cache boundary so they are never cached, and a missing key is
checked before the cache. D-093: every real model call logs `Gemini call: <model>, <n> chars`.

### D-071 · The whole log, health included, may be sent to the model · 2026-08-24
Victor's call. This does not loosen publication: health data never reaches a public page (R12).
**Reverse.** Filter by category before building the prompt.

### D-080 · AI approval is over typed proposals, not a markdown diff · 2026-08-25
Nothing AI-driven writes to the vault (R13). A model-drafted vault write would need a diff view and
Victor's explicit sign-off. See D-100.

### D-085 · The model is `gemini-3.6-flash` · 2026-08-25
`MODEL` in `lib/ai/gemini.ts`, printed on every summary. `gemini-2.5-flash` was retired and every
call failed silently. Tests assert "flash" and not the retired id. Budget ~$10/month.

### D-087 · Semantic search is cut · 2026-08-25
Evaluated three times; cut on time, the real constraint. Design notes in `docs/V3_PLAN.md` §2.

### D-092 · The weekly summary is fed days, not entries · 2026-08-25
Seven lines, empty days included as "nothing logged", its own cache tag.

### D-124 · Summaries are stored; fallback text never is · 2026-08-29
`ai_summaries`, upserted per `(kind, period_start)`. Anything `ok: false` is never stored. Storage
failure never fails the page. Read back at `/private/log/archive` (D-285).

---

## Sync and offline

### D-126 · The app is an installed PWA, not a native app · 2026-08-30
One codebase, $0. Gives up a real widget, guaranteed background sync, a store listing and native
gestures. **Reverse.** Capacitor wraps the same build.

### D-127 · Offline creates carry a client UUID; edits are last-write-wins on an HLC · 2026-08-30
Only tables where identical rows are legitimate need a client id; the others have natural keys.
Last-write-wins compares a hybrid logical clock, never `updated_at`; stamps more than 10 minutes
ahead are refused (D-153). Spec: `docs/SYNC_DESIGN.md`. **Reverse.** See the spec's alternatives.

### D-129 · A failed sync is held and surfaced, never dropped · 2026-08-30
Five failure classes (`SYNC_DESIGN.md` §6). A failed op blocks later ops on the same `clientId`
only. D-160: `/private/sync` lists everything unsent with a sentence saying why, and offers only
"send again" — **no delete button**, enforced by a test; the badge escalates with age.

### D-130 · The public site is precached inside the private app · 2026-08-30
One install shows the portfolio with no signal. Handing someone the phone puts private data one
back-swipe away; accepted. The worker precaches whatever the sitemap lists, plus images up to 1200px
(D-163, D-177). **Reverse.** Build a locked show-mode or split the manifest.

### D-131 · The phone caches everything, and its lock screen is the guard · 2026-08-30, revised 2026-09-24
The full history is mirrored to IndexedDB and kept. **Revised:** this entry said the biometric
unlock was the only boundary, but that lock is unmounted (D-158). The policy now: Android's own lock
screen and OS-level storage encryption guard the mirror. Encrypting it (WebAuthn `prf`) was sized
and declined. **Reverse.** Re-mount the lock (D-158), or add a field exclusion list.

### D-146 · The service worker is generated with the commit stamped in · 2026-08-30
`sw-template.js` → `public/sw.js` with `__BUILD_ID__` replaced, so every deploy is a byte change.
`updateViaCache: "none"` plus `no-store` on `/sw.js`. It handles GET only and never caches a private
response (tested on the source). Updates apply immediately (D-241). **Reverse.** Commit a static
`sw.js`.

### D-150 · The sync cursor is a trigger-maintained sequence; hard deletes are gone · 2026-08-31
`updated_hlc` (what LWW compares), `updated_at` (receipt), `server_seq` (cursor, from one shared
`sync_seq` via trigger), `deleted_at` (tombstone). Soft deletes do not cascade — tombstone children
explicitly; filter a LEFT JOIN's right side in the join condition. `recordBodyweight` clears the
tombstone on upsert. **Reverse.** Additive; drop the triggers and columns.

### D-152 · The stored HLC is the idempotency key · 2026-09-02
Equal is `duplicate`, lower `stale`, higher `applied`; no table of op ids. Batches collapse to the
highest HLC per row. Push before pull. 401 not a redirect; 503 when the database is unconfigured.
Each table is queried with `limit + 1` for `hasMore`.

### D-153 · The flush absorbs every stamp it pulls, up to the drift bound · 2026-09-02
`absorbStamps` feeds incoming stamps through the device clock; one more than ten minutes ahead is
skipped. Without it a fast phone's rows made the laptop's later edits come back `stale` and vanish.
Surfacing a far-ahead peer is still open. **Reverse.** Delete `absorbStamps`.

### D-154 · Local unlock is a real signature check, in the page · 2026-09-03
The lock screen (built, currently unmounted — D-158) verifies a WebAuthn assertion against a
locally cached public key: in the page, because a service worker has no `navigator.credentials`.
`userVerification: "required"`. It is a display gate, not a data gate. Authenticators sign DER;
WebCrypto wants raw `r||s`. D-157: a signed-in session fetches the public keys it needs.

### D-158 · The biometric lock is built and not mounted · 2026-09-04
A fingerprint on every cold start was the wrong trade. The code and its tests stay (kept on
2026-09-24). **Reverse.** Import `LocalLock` in `app/private/layout.tsx` and wrap the return. A
middle option: lock only after N hours away (`AUTO_LOCK_MS`, `decideLock`).

### D-157 · The offline page says what failed, and never dead-ends · 2026-09-03
The worker retries a failed navigation once when online, then hands over the offline page with the
path. The page reads `navigator.onLine` before blaming the signal, and carries Retry (same-origin
checked) and a way back, rendered on the server.

### D-161 · The app opens with no signal, at the static route `/cached` · 2026-09-04
`/private` needs a server, so the offline shell lives outside it and reads everything from IndexedDB;
its HTML holds no data. Every view shows its data's age. Screens the phone keeps no copy of say so.
Records and charts are not computed offline — a partial history would under-report. **Reverse.**
Delete `app/cached/` and `lib/offline/`.

### D-163 · The log writes with no signal · 2026-09-04
The shell carries the same `LogForm`, given a writer that enqueues to the outbox; the reading
functions are shared, so the offline row matches the Server Action's. **Reverse.** Drop the `write`
prop.

### D-174 · The offline shell is dressed as the private app · 2026-09-05
No public chrome, the tab bar on every branch with plain anchors (a client transition cannot reach a
server), and `registration.update()` skipped offline.

### D-175 · The cached shell runs its own sync, only when something is queued · 2026-09-05
`SyncRunner offline` on `/cached` pushes when the outbox is non-empty, so a stranger opening the URL
fires nothing. It does not pull. `next/link` is absent from `cached-app.tsx`.

### D-204 · Every network call has a deadline · 2026-09-08
`fetchWithDeadline` and one `BUDGET` table (navigation 3s, RSC 3s, sync 10s, report 5s, asset 10s);
the worker's copy is pinned by a test. A stall and an abort are told apart. GitHub calls have their
own 8s deadline (D-041). **Reverse.** Deleting it restores the plane-wifi freeze.

### D-205 · Precached public pages are served first; RSC payloads get a deadline only · 2026-09-08
Cache names carry `BUILD_ID`, so within one build the cache and network are identical. Nothing under
`/private` is ever cached (enforced inside `serveFromCache`). An RSC payload is never served from
cache; on timeout the rejection goes through and the App Router hard-navigates.

### D-208 · The worker tells the page it fell back because of a stall · 2026-09-08
`window.__2ndmindNet="degraded"`, adopted once; any answering request clears it.

### D-209 · `online` clears the sync backoff · 2026-09-08
It is the one event that says the network changed. Foregrounding still respects the delay.

### D-325 · Vault writes go through the outbox · 2026-09-22
Publishing a project update and saving the course plan enqueue into the sync outbox and ack
locally; the GitHub commit follows with retry. The vault stays the source of truth and Postgres gets
no copy. A commit plus rebuild is the only way an update reaches a statically generated project
page, so a database buffer with a push button would decide when the public site changes. **Reverse.**
Keep `lib/vault/write.ts` synchronous; revisit the buffer only if public pages stop being built from
the vault.

---

## Auth, errors and infrastructure

### D-006 · Auth is self-hosted WebAuthn · 2026-08-20
Clerk gates passkeys at $20–25/month; one user forever.

### D-018 · Passkey auth; sessions are HMAC-signed cookies · early
Web Crypto HMAC over JSON, no JWT library. Platform passkeys report counter 0. Enrolment is closed
unless `PASSKEY_REGISTRATION_SECRET` is set and supplied; `/signin/register` runs the ceremony. No
recovery flow: re-open the gate and re-enrol. Credentials are stored in Postgres (D-240).

### D-240 · Enrolled passkeys live in Postgres · 2026-09-12
`passkey_credentials`; registration writes a row, so enrolment needs no deploy. The legacy
`PASSKEYS` / `PASSKEY_CREDENTIAL_ID` / `PASSKEY_PUBLIC_KEY` variables are still read as a fallback.
Credentials stay atomic — one entry per device, verified against the id the browser asserted
(D-098). **Reverse.** Re-set `PASSKEYS` with every enrolled credential first, then revert.

### D-095 · The relying party is the apex; both origins are accepted · 2026-08-25
`rpID` is the apex (a credential scoped to it works on `www` too); `origins` is a list. D-096: the
canonical URL is `https://victorgusev.com`, with `www` redirecting. D-097: an origin mismatch fails
with a sentence naming the values, checked on registration too. **Reverse.** Change
`NEXT_PUBLIC_SITE_URL` and the three fallbacks; the passkey survives.

### D-019 · Private pages read editable vault files over the GitHub API · early
The runtime filesystem holds only what was traced, and after a write the local copy is stale.
D-022: the freshness audit reads the filesystem, because it touches 34 files for one field each.
D-046: that walk is memoised per deployment.

### D-020 · Vault writes validate the path first · early
`assertVaultPath` rejects traversal, backslashes, non-`context/` and non-`.md` paths. The token can
write the whole repo, including workflows. **Don't reverse.**

### D-021 · A misconfigured deployment explains itself · early
`/signin` shows "Not configured" rather than a 500. Auth fails closed; configuration failures stay
legible. D-031 applies the same shape to a missing `DATABASE_URL`.

### D-023 · `outputFileTracingRoot` puts the vault in the serverless bundle · 2026-08-21
Set to the repo root, excluding `context/99_archive/**`, with no `outputFileTracingIncludes` — an
include beats an exclude and dragged the archive in. Verify by counting traced `.md` files in
`.next/server/app/private/page.js.nft.json`.

### D-042 · Vault reads are cached; the write path is not · 2026-08-21
`readVaultFileCached` uses `unstable_cache` (tag `vault`); writes call `updateTag`, not
`revalidateTag`. The write path reads uncached for a live blob SHA. D-335: the deploy SHA is part of
the key and `revalidate` is 3600s — a direct push redeploys and drops the entry at once.
**Reverse.** Call `readVaultFile` directly.

### D-063 · `db:migrate` loads `.env.local` itself · 2026-08-22
`node --env-file-if-exists=.env.local` in front of drizzle-kit. D-156 adds `npm run db:status`,
which lists pending migrations; deliberately not in `predev`/`prebuild`.

### D-064 · No client runtime in the root layout without a caller · 2026-08-24
The public site's value is arriving as finished HTML. What the root layout still mounts is listed in
Open items as the largest remaining bundle saving.

### D-156 · One database-error translator, reading the cause chain · 2026-09-03
`describeDbError` walks `cause` for the message and SQLSTATE: missing table (42P01), missing column
(42703 — the database is behind the build), missing function (42883). Anything else passes through.

### D-165 · Errors go to this app's own endpoint · 2026-09-04
`/api/errors` → `error_reports`, shown on the dashboard. No vendor: a scrubbing rule failing silently
would put grades and a phone number in someone else's database. Allowlisted schema, capped fields,
scrubbed on device and server — truncate before scrubbing (a quadratic regex). Unauthenticated on
purpose, always answers 204, one row per fingerprint. The panel is absent when nothing is open.
`error_reports` does not sync. No alerting. **Reverse.** Remove `<ErrorWatch />`; to use Sentry,
change only `lib/errors/client.ts`.

### D-185 · Notifications: two cron jobs and one local alert · 2026-09-06
Permission is never requested automatically. Cron at 21:00 and 08:00 Pacific, each silent unless
there is something to say. The day is computed in `America/Los_Angeles`. Cron routes refuse
everything without `CRON_SECRET`. The stuck-outbox alert is raised by the app through its own worker,
only when the failed count rises. Dead subscriptions prune on 404/410 only. Keys and secret
configured and working (confirmed 2026-09-24). **Reverse.** Delete the crons, routes and `lib/push/`.

### D-327 · `zod` is kept out of the client-reachable error path · 2026-09-22
`ErrorWatch` is on every page, and its imports reached `zod` — 64 KB gzipped of the public bundle.
The schema lives in `lib/errors/schema.ts`, imported only by the API route; the type is written by
hand and pinned both ways. **Don't reverse:** a client module needing validation gets a hand-written
guard.

### D-330 · Four unused dependencies removed; `shadcn` stays · 2026-09-22
`@sentry/nextjs`, `recharts`, `react-hook-form`, `@hookform/resolvers` had no importers. `shadcn`
ships the stylesheet `globals.css` imports.

### D-065 · Vault edits parse structure and edit text by offset · 2026-08-24
`frontmatter.ts` locates sections with an mdast parse, then edits that byte range as text — a regex
cannot tell a `##` inside a code fence from a heading, and re-printing the tree rewrites untouched
lines. **Reverse.** The pre-AST version is at `4fe26eb`; it brings back the code-fence bug.

### D-331 · GIN indexes on the two `tags` columns · 2026-09-22
Tag filters use `@>`, which a B-tree cannot answer. A test asserts the indexes exist, not a plan.

---

## Gates, tests and tooling

### D-028 · Database tests run on real Postgres, in WASM · 2026-08-21
PGlite runs the committed migrations and the real queries; query functions take the handle as a
parameter. D-172: files named `*.db.test.ts` share one process (PGlite's boot is the cost, not the
schema), and a conventions test forbids mocks, fake timers or env writes inside them.

### D-072 · A local browser is the only MCP server · 2026-08-24
`.mcp.json` runs `@playwright/mcp`, isolated, 1280×900. Nothing leaves the machine.

### D-083 · `npm run shots` signs its own session and gates the fold · 2026-08-25
It mints a short-lived session from `SESSION_SECRET` and fails if a private page's first action sits
below `FOLD_LIMIT` (now 350px — D-319). D-166: every gated private screen must carry the marker, and
readings settle until two agree. D-125: the dev overlay is hidden before measuring.

### D-106 · `npm run freeze` snapshots the site to standalone HTML · 2026-08-29
Every page inlined into one file, scripts stripped, links rewritten for `file://`.

### D-136 · Prettier formats hand-written code in `web/` · 2026-08-30
`printWidth: 100` and `endOfLine: "auto"`, both measured. The hook is `.githooks/pre-commit` via
`core.hooksPath` — every clone runs `git config core.hooksPath .githooks` once. Formatting only;
tests stay outside the hook. D-142: `drizzle/`, markdown and generated output are ignored.

### D-173 · `/sprint-review` is retired, with nothing replacing its last two steps · 2026-09-05
Appending the week to `logbook_archive.md` and running `audit_freshness.py` are retired too
(confirmed 2026-09-24); freshness shows as a dashboard badge (D-043).

### D-176 · `npm run e2e` drives a real browser offline against a real build and database · 2026-09-05
Eighteen checks, from install through an offline write to exactly one row in Postgres, then SQL
teardown by the run's own ids. At phone size; the first navigation avoids third-party calls.
D-210: `npm run e2e:degraded` stalls requests with `context.route` — network emulation misses the
service worker.

### D-191 · Nothing is reachable only by hover · 2026-09-06
Standing rule in `DESIGN.md` §9; `title` is invisible on a phone.

### D-281–D-283 · `npm run shots` runs six pages at once · 2026-09-21
`mapPool` at `SHOTS_CONCURRENCY` (default 6), each job buffering output so the report is
byte-identical to a sequential run. `SHOTS_PNG=0` skips screenshots but still writes resume PDFs.
Everything measured waits for fonts (R7).

### D-315–D-318 · The sweep gates text, taps, headings and contrast · 2026-09-21
Each check returns offending elements, not a count, on public and private pages at six widths.
Contrast resolves colour through a 1×1 canvas and composites from `<html>` (D-316). Text under 11px
fails unless an ancestor carries `data-tiny-text="<reason>"` (D-317). Taps under 44px are gated per
page by a budget that only goes down; inline links in a sentence are exempt (D-318). D-321: a
heading may jump up but never skip down a level.

### D-323 · Contrast is gated per theme and page, by ratchet · 2026-09-21
30 near-misses between 3.74 and 4.41:1 at the time. The theme is pinned with a `MutationObserver` so
`next-themes` cannot race it; fully transparent text is skipped. `SHOTS_THEMES=0` skips the sweep.

### D-356 · The slow session-logger test file gets a 20s timeout · 2026-09-10
*(was D-225.)* `vi.setConfig({ testTimeout: 20_000 })` in `session-logger.test.tsx`: it renders the
whole logger against `fake-indexeddb` and timed out only under suite-wide CPU contention. Raising the
global timeout would hide the signal elsewhere.

### D-324 · Before/after is a record you look at, not a diff that fails · 2026-09-21
`npm run shots:save -- <label>` and `shots:compare -- <label>` write a side-by-side page: changed,
new, and gone. No pixel gate for a design still being redrawn. Baselines are local.

### D-326 · Phase 8 was scoped from measurement · 2026-09-22
Four audit items were already true and are recorded rather than dropped: Vercel's edge for load
balancing and CDN, `next build` for minification, and no pool to exhaust on `neon-http`.

### D-329 · The public bundle budget is a per-route ratchet · 2026-09-22
*(absorbs D-320 and D-336.)* `npm run bundle` measures the gzipped JavaScript a real browser
downloads per public route and fails above a committed `ROUTE_BUDGET` that only goes down; the 90KB
target is kept as an aspiration. It waits for 1.5s of script quiet, not `networkidle` (D-328).
Numbers as corrected on 2026-09-22 under R5: ~169–176 KB per route, of which ~113 KB is React and
the App Router runtime, ~56 KB the root layout's own client components (Open items), and 0–7 KB
route code. The private app is not budgeted. **Reverse.** `BUNDLE_BUDGET=90` makes the aspiration
the gate.

### D-333 · The lightbox's full-size image mounts on first open · 2026-09-22
A closed `<dialog>` still downloads its image, and React preloaded it: 95% of a project page's image
bytes. D-334: `next/image` already serves the large source PNGs as small WebP, so they were not
re-encoded. `npm run images` is the gate. **Reverse.** Remove the `everOpened` latch.

### D-363 · This log is grouped by topic, and superseded entries become stubs · 2026-09-24
Victor asked for the file to be simplified. 603 KB of dated narrative became topic sections, short
entries, sixteen standing rules and a superseded table; ID collisions were resolved by renumbering
the Phase-6 brand set. **Reverse.** `git show <this commit>^:web/DECISIONS.md`.

---

## Superseded

Each row points at what replaced it. Full text: `git log -S "D-nnn" -- web/DECISIONS.md`.

| ID | Was | Now |
|---|---|---|
| D-008 | Victor's teal/rose/peach palette, "settled" | Generated themes, Carbon default — D-194, D-197 |
| D-012 | Card sweep loops while hovered | Plays once — D-005 (D-040) |
| D-013 | Generated placeholder hero images | Only real photos — D-074 |
| D-015 | RLC lab off the robotics resume | Folded into D-014 |
| D-022 | Freshness reads the filesystem | Folded into D-019 |
| D-031 | Athletics explains a missing database | Folded into D-021 |
| D-032 | Academic tracker edits the sprint file | One task model — D-037 |
| D-033 | Work page is not an application tracker | Reads the sheet — D-103, D-300 |
| D-034 | Calendar page has no calendar | iCal feeds — D-051 |
| D-035 | Checklist editing module | Deleted with the tracker (D-044) |
| D-038 | Voice input worth building on Android | Folded into D-049 |
| D-040 | Card sweep plays once | Folded into D-005 |
| D-041 | GitHub requests have an 8s deadline | Folded into D-204 |
| D-044 | Vault academic tracker deleted | Done; history only |
| D-046 | Freshness walk memoised | Folded into D-019 |
| D-050 | One PGlite per test file | Shared process — D-028 (D-172) |
| D-054 | Vitest hook timeout 30s | Shared process — D-028 (D-172) |
| D-060 | Warmups count toward volume | Folded into D-029 |
| D-068 | `experience[0]` is "most recent" | Folded into D-109 |
| D-070 | Four AI capabilities, summaries first | Semantic search cut — D-087; approval — D-080 |
| D-079 | Semantic search reinstated | Cut — D-087 |
| D-084 | Today's order, stats compact | D-167, D-257 |
| D-086 | Failed summaries are not cached | Folded into D-067 |
| D-088 | `/now` built on `status: active` | `/now` removed — D-342 |
| D-089 | Project updates in markdown | Folded into D-099 |
| D-093 | Every model call is logged | Folded into D-067 |
| D-094 | Canonical URL is `www` | Apex — D-095 |
| D-096 | Canonical URL is the apex | Folded into D-095 |
| D-097 | Relying-party mismatch explains itself | Folded into D-095 |
| D-098 | `PASSKEYS` env var holds every device | Postgres — D-240 |
| D-105 | Private link in the header, lock icon on phones | Folded into D-102 |
| D-110 | Tailor under Work | Folded into D-104 |
| D-116 | Dimaag paper published as a placeholder | Project removed — D-337; `confidential_scope` in `experience/dimaag.md` still binds |
| D-117 | Tailor answers posting questions, no drafts | Folded into D-104 |
| D-125 | Dev overlay hidden in `shots` | Folded into D-083 |
| D-128 | Offline unlock verified in the service worker | In the page, unmounted — D-154, D-158 |
| D-133 | Ambient drift static on phones | D-007 (D-179) |
| D-135 | Light mode ships in V3 | D-184, D-194 |
| D-137 | Error aggregation via Sentry | Own endpoint — D-165 |
| D-138 | Uploaded resume PDF is a fallback | PDF is the only download — D-360 |
| D-139 | Filament page answers "what to reorder" | Folded into D-189 |
| D-140 | V3 keeps full scope, extends timeline | Planning; done |
| D-141 | Editing the job sheet dropped | Still dropped — D-103 |
| D-142 | What Prettier ignores | Folded into D-136 |
| D-144 | App icon is a brain silhouette | D-346 |
| D-145 | Brain seen from the side | D-346 |
| D-147 | One ground colour `#140a10`, pinned by a test | Ground is Carbon's, still pinned — D-197 |
| D-148 | Brain proportioned anatomically | D-346 |
| D-151 | The mark is the 🧠 emoji | Folded into D-346 |
| D-159 | Quick log logs sets; union read for PRs; Applications retired | Sessions — D-215; weigh-in — D-221; Applications stays retired (R16) |
| D-160 | Stuck entries held, no delete button | Folded into D-129 |
| D-162 | Set fields chosen by `kind` in the quick log | Quick-log training retired — D-215; sessions use `modality` — D-213 |
| D-166 | Fold check covers every private screen | Folded into D-083 |
| D-169 | Workouts addressed by server id | Client ids — D-211 |
| D-172 | Database tests share one process | Folded into D-028 |
| D-177 | Precache keeps images to 1200px | Folded into D-130 |
| D-179 | Ambient drift stops on phones | Folded into D-007 |
| D-186 | Voice entry: rules first, model second | **Retired 2026-09-24** — only rendered on the retired Training tab; code to be deleted |
| D-188 | Resume PDF beside the generated sheet | D-360 |
| D-190 | `tap`/`text` numbers were never gates | Gates built — D-315–D-318 |
| D-192 | Unused shadcn components, no toasts | D-200, D-263 |
| D-193 | `npm run paint` measures the ambient layer | Closed 2026-09-24 — phone feels fine; script stays |
| D-210 | Degraded-network e2e suite | Folded into D-176 |
| D-223 | How-to text as a static map | Database column — D-231 |
| D-225 | A Train entry in the desktop nav | One Training entry — D-234 |
| D-226 | Figure redrawn by hand at reference fidelity | Licensed art — D-239 |
| D-245 | Resume page has one download | Folded into D-360 |
| D-246 | Resume PDF renamed in place | Folded into D-360 |
| D-247 | 2ndMind card shows a private Today screenshot | Content detail; `context/assets/2ndmind.png` |
| D-264 | Task undo moved into the toast | Folded into D-263 |
| D-269 | Swipe shows colour, then icon | Folded into D-180 |
| D-270 | Pull-to-refresh draws a ring | Folded into D-181 |
| D-273 | Routine for a day is computed | Folded into D-278 |
| D-293 | Log undo moved into the toast | Folded into D-263 |
| D-298 | Planner is a table on a phone | Folded into D-187 |
| D-299 | "Counted" vs "might count" tokens | Folded into D-296 |
| D-302 | Provenance is a shape | Folded into D-301 |
| D-303 | Spool bar, printer dot | Folded into D-189 |
| D-310 | `hidden sm:block` works again | Folded into D-143 |
| D-320 | Bundle gate built at 90KB, every route failing | Ratchet — D-329 |
| D-321 | Two heading-order bugs | Folded into D-315–D-318 |
| D-328 | Bundle gate waits for script quiet | Folded into D-329 |
| D-334 | Source PNGs not re-encoded | Folded into D-333 |
| D-335 | Deploy SHA in the vault cache key | Folded into D-042 |
| D-336 | Bundle numbers corrected (stale server) | Folded into D-329; rule R5 |
| D-361 | *(was D-230)* `/now` leads with the newest update | `/now` removed — D-342 |
