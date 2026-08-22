---
updated: 2026-08-21
domain: engineering
stability: volatile
summary: Dated log of design and architecture decisions for the web app, each with its reason and how to reverse it.
read_when: Before changing anything that looks deliberate, or when Victor wants something undone.
---

# Decision Log

Every non-obvious choice, why it was made, and **how to undo it**. Victor reviews the site
and reverses things; this file exists so reversing is a lookup, not an archaeology dig.

Newest first. When a decision is reversed, do not delete the entry — move it to
[Reversed](#reversed) with a note. The history of what was tried and rejected is the
useful part.

---

## 2026-08-21 · V2 scope

### D-044 · The academic tracker's vault implementation is deleted, not kept alongside

**Decision.** `checklist.ts`, its 25 tests, `academic-tracker.tsx`, `tracker.ts`, and the
academics actions are removed. `/private/sprint` and its form go too — goals are edited
inline on Today now.

**Why.** D-037 merged the tracker into the task model. Leaving the vault version in place
would have shipped both, which is the exact failure the merge exists to prevent, and keeping
unused-but-tested modules "in case" is how dead code accumulates. Everything is one `git
show` away if feature 5's rehab checklist wants it back.

**How to reverse.** `git show b069dcb -- web/src/lib/vault/checklist.ts` and friends.

---

### D-043 · Freshness is a badge, not a panel

**Decision.** The dashboard's full-width freshness section is replaced by a chip in the page
header that appears **only when something is stale**, expanding to a list on click.

**Why.** Victor's verdict on V1: it "should be here as an alert that something is not fresh,
almost as a notification. The full bar itself should be removed." The audit is unchanged —
this reverses only the presentation. A permanent list of 34 healthy files is furniture.

**How to reverse.** `freshness-panel.tsx` in git history; the report shape is identical.

---

### D-042 · Vault reads are cached; the write path is not

**Decision.** `readVaultFileCached` wraps reads in `unstable_cache` tagged `vault`, and
`writeVaultFile` calls `updateTag` after committing. Actions keep the uncached reader.

**Why.** Measured: private pages spent 300–800ms on serial GitHub round trips, against 33ms
for the one page making no network call. After caching, best-of-five steady state went
320→69ms (work), 377→32ms (calendar), 761→186ms (academics).

Three specifics worth keeping:
- **`unstable_cache`, not `use cache`.** The directive needs `cacheComponents: true`, which
  changes every dynamic API in the app and conflicts with the `force-dynamic` these pages
  rely on. Deprecated, but the migration is contained to one function.
- **`updateTag`, not `revalidateTag`.** The latter now requires a cache profile, and the
  recommended `"max"` is stale-while-revalidate — which serves the *pre-edit* content on the
  next read, making a save look like it did nothing.
- **The write path must not use the cache.** It needs a live blob SHA; a cached one turns
  last-write-wins into last-write-fails.

**How to reverse.** Call `readVaultFile` directly and delete the tag. Pages get slow again.

---

### D-041 · Every GitHub request has an 8-second deadline

**Decision.** Octokit is constructed with a `fetch` that carries `AbortSignal.timeout`.

**Why.** `fetch` has no default timeout, so a network problem was not a slow page but a hung
one — when the connection dropped mid-session, pages sat for minutes. 5s was the first value
and it fired during ordinary use on a working connection, which is worse than no timeout: it
turns slow into broken. 8s rides out a bad moment and still fails before anyone assumes the
app has died.

**How to reverse.** Remove the custom fetch. Do not, unless something else bounds the wait.

---

### D-040 · The card sweep plays once (reverses half of D-012)

**Decision.** `infinite` becomes `forwards`, and the keyframes drop the 55%-then-hold that
existed only to pause between loops. Duration 0.85s.

**Why.** Victor: "once it does the sweep once it should not repeat it when still hovering."

D-012 said explicitly which half of it must survive a reversal, and that instruction is
followed here: the corrected base transform (resting off-card) and the 260% travel stay,
because those were the bug fix — without them the highlight parks itself over the card and
never exits. Only the looping goes.

**How to reverse.** `forwards` → `infinite` and restore the hold keyframe.

---

### D-039 · Log fields are proposed from the vault, then edited

**Decision.** I draft three or four fields per log category from what the vault already
records — SPM and drag factor for erg work, course and grade for academics — and Victor
strikes out what is wrong.

**Why.** Victor chose this over specifying fields from scratch. Starting from the vault means
the fields match the vocabulary already in use, so a logged erg piece and the PR table talk
about the same quantities.

**How to reverse.** Fields live in one schema module per category; changing them is a
migration, not a rewrite.

---

### D-038 · Voice input is worth building — Android confirmed

**Decision.** Quick-log screens get Web Speech API dictation.

**Why.** I had assumed iPhone and was ready to drop this: Safari on iOS has no Web Speech
API, and the iOS keyboard's own dictation button already covers every text field for free.
Victor logs from Android/Chrome, where the API exists. About an hour of work.

**How to reverse.** Feature-detect and fall back to a plain field — which is also what any
future iPhone would get.

---

### D-037 · Everything actionable is one task model

**Decision.** Sprint goals, the academic tracker, daily to-dos, and Canvas assignments become
rows in one `tasks` table, each with a source and a due date. The homepage filters to today
and this week.

**Why.** V2 was about to ship a fourth place to look for "what should I be doing". Victor
named "too complex to use" as the thing that would make him abandon the project, so four
competing lists is not a style question, it is the failure mode. Nothing is deleted: sprint
goals become tasks tagged as goals, tracker items become tasks with a course.

**Cost.** This partly supersedes D-032, which put tracker items in `current_sprint.md`. Those
rows move to Postgres. The markdown tracker section stays readable but stops being the
editable source.

**How to reverse.** The task source column makes the origin of every row recoverable, so
splitting them back out is a query, not an archaeology exercise.

---

### D-036 · High-frequency writes go to Postgres, not the vault

**Decision.** Anything logged often — daily entries, tasks, workouts — is written to Postgres
and saved immediately. The vault keeps prose that is written rarely and read by AI agents.

**Why.** Finding F2: every vault write is a commit and a deploy, so ticking three boxes was
three commits, three builds, and a plausible route to Vercel's Hobby ceiling. Victor asked
for immediate saves (Q77) and accepted logs living outside the vault (Q76).

**The tension, stated.** Victor also wants the site to create vault files (Q80), which can
never be instant — a GitHub round trip is 1–2 seconds. Resolution: two visibly different
actions. Logging is silent and instant; writing to the vault shows a publishing state,
because it is editing the permanent record.

**Deferred.** Syncing Postgres logs back into vault summaries is V3 by Victor's own call
(Q76).

**How to reverse.** The vault write path is untouched and still used for prose, so reverting
means pointing the log actions back at it and accepting the commit-per-save cost again.

---

## 2026-08-21

### D-035 · Checklist editing lives in its own module, not in `frontmatter.ts`

**Decision.** `lib/vault/checklist.ts` holds the `- [ ]` item reader and writers.
`frontmatter.ts` stays about frontmatter and generic section edits.

**Why.** Checklists are one markdown convention, not a property of every vault file. Keeping
them apart means `frontmatter.ts` does not grow a second vocabulary. Both modules repeat the
same two guards on purpose — `\r?\n` for CRLF files, `(?![\s\S])` rather than `$` for
end-of-input — and each has its own tests for them.

**How to reverse.** Merge the file back; nothing else depends on the split.

---

### D-034 · The Calendar page has no calendar

**Decision.** `/private/calendar` states plainly that live sync is out of scope for V1 and
shows the operating rules from the sprint file instead.

**Why.** Google Calendar reads need an OAuth consent screen Google must review before it
works beyond a test account, plus refresh-token storage and rotation. That is days of work
for a read-only view of an app already open in another tab, and it would be the only part of
2ndMind that can lock itself out without warning. A page that says so is more useful than a
page pretending to be finished.

**How to reverse.** V2 candidate. If it happens, an `.ics` subscription URL is a fraction of
the work of OAuth and covers reading.

---

### D-033 · The Work page is not an application tracker

**Decision.** `/private/work` renders pipeline strategy and career targets. It does not log
or count applications.

**Why.** `internship_pipeline.md` records that a background script already scans Gmail and
maintains a master Google Sheet, and explicitly asks AI assistants to leave that data entry
alone. A second tracker would be a competing source of truth for facts the sheet already
owns — the exact failure this vault exists to prevent.

**How to reverse.** If the sheet is ever retired, this is where its replacement goes.

---

### D-032 · The academic tracker edits the sprint file in place

**Decision.** Tracker items are `- [ ]` rows under `## 3. Academic Tracker` in
`current_sprint.md`. Adding, ticking, and removing each commit that one file. Adding reuses a
blank placeholder row before appending.

**Why.** The tracker already existed there as prose. Moving it to Postgres would split "what
am I working on" across two stores; keeping it in markdown means it still reads correctly
with no site at all, which is the property that makes this a vault and not an app.

A test reads the **real** `current_sprint.md` and asserts the section is found and everything
outside it stays byte-identical, so renaming or re-numbering the heading fails loudly in CI
instead of silently doing nothing in the UI.

**How to reverse.** Point the actions at a different file and heading; the pure functions
take both as parameters.

---

### D-031 · Athletics degrades to an explanation when `DATABASE_URL` is absent

**Decision.** `/private/athletics` renders a short "no database connected" page rather than
throwing. `isDatabaseConfigured()` is a separate function from `db()`.

**Why.** The same shape as D-021, applied before it could bite: the page someone opens to
find out why athletics is broken must not be the page that crashes on it. Verified by
loading the route with the variable unset — 200, self-explaining — and again with the
variable set but the tables missing, which renders the migration hint.

**How to reverse.** Delete `isDatabaseConfigured` and let `db()` throw.

---

### D-030 · Estimated 1RM is capped at 12 reps

**Decision.** `estimateOneRepMax` returns null above 12 reps rather than extrapolating.

**Why.** Epley drifts badly at high rep counts. Uncapped, a set of 20 light reps outranks a
genuine heavy single and sits at the top of the strength board forever — a wrong number that
looks plausible, which is the worst kind.

**How to reverse.** Raise or remove `E1RM_REP_CAP` in `lib/athletics/prs.ts`. A different
formula (Brzycki, Lombardi) would be a better fix than a higher cap.

---

### D-029 · Warmup sets are stored but never ranked

**Decision.** Every set from an import is written, including warmups; `isWorkingSet()`
excludes `warmup` and `drop` from records.

**Why.** Throwing them away at import would be lossy and irreversible — session volume and
history would be wrong forever. Counting them toward a PR would be wrong in the other
direction, and a single mistyped warmup would set a permanent fake record.

**How to reverse.** Change `isWorkingSet` to return true. The data is all still there.

---

### D-028 · The database layer is tested against real Postgres, in WASM

**Decision.** `@electric-sql/pglite` (dev dependency) runs the committed migration SQL and
the real queries in the test suite. Query functions take the handle as a parameter so the
same code runs on PGlite and on Neon.

**Why.** A mocked query builder asserts that the code called the mock, which is worth very
little — it would have accepted the numeric-as-string bug in D-027 without complaint. This
costs nothing, needs no server, and runs offline, which matters for the Taiwan trip.

**Cost.** About 17 seconds of the suite, from spinning up a fresh database per test.

**How to reverse.** Drop the dependency and delete `athletics/__tests__/queries.test.ts`.
Keep the parameter-passing shape regardless; it is good design independent of testing.

---

### D-027 · Numeric columns are declared `mode: "number"`

**Decision.** `numeric("weight_lbs", { …, mode: "number" })` on every numeric column.

**Why.** Postgres `numeric` arrives as a *string* by default in node-postgres, to protect
precision. Under string comparison `"95" > "155"` is true, so a warmup would outrank every
working set and every PR would be quietly wrong. A test asserts `typeof` is number and that
the max of a real stored session is 155.

**How to reverse.** Drop the mode and convert at each call site — but then every comparison
becomes a place to forget.

---

### D-026 · Imports are idempotent through a derived `external_id`

**Decision.** Each imported session gets `hevy:<ISO timestamp>:<title-slug>`, uniquely
indexed. Sets are written only for workouts the insert actually created.

**Why.** A Hevy export is cumulative — every export contains the entire history — so the
natural workflow is re-importing a growing file. Without this, the second import doubles
everything, and the damage shows up only as inflated PRs and volume, with no error anywhere.
The second half matters as much as the first: skipping the workout row but still appending
its sets would duplicate the sets against the original session.

Manual entries leave `external_id` null, and Postgres treats nulls as distinct in a unique
index, so hand-logged sessions never collide.

**How to reverse.** Drop the unique index. Do not, unless imports become one-shot.

---

### D-025 · Personal records are computed on read, never stored

**Decision.** No `records` table. `strengthRecords()` and `ergRecords()` run over every
stored set on each page load.

**Why.** A stored record is a cached answer with no invalidation story: correct a mistyped
weight and the PR keeps reading high forever, silently. At this scale — a few thousand sets
— recomputing is free.

**How to reverse.** Add a materialised table if the set count ever makes this slow. It will
not at one athlete's volume.

---

### D-024 · Training data lives in Postgres, not in the markdown vault

**Decision.** Athletics is the one feature backed by a database (Neon free tier).

**Why.** Everything else in 2ndMind is prose that a human writes and reads. Training data is
tabular and queried *across* rows — "best set of Bench Press at five reps" is a group-by. A
Hevy export is thousands of set rows, which no markdown file should hold. The rest of the
site is unaffected and builds without `DATABASE_URL`.

**Privacy.** Health data is the category that must never be public. No public route imports
`lib/db` or `lib/athletics`, and the public build runs with no database configured at all.

**How to reverse.** Nothing else depends on it; delete the routes, the two lib folders, and
the dependency. The vault's `benchmarks_and_logs.md` remains the hand-written record.

---

### D-023 · `outputFileTracingRoot` is what puts the vault in the serverless bundle

**Decision.** `next.config.ts` sets `outputFileTracingRoot` to the repo root and excludes
`context/99_archive/**`. It sets no `outputFileTracingIncludes`.

**Why.** Measured rather than assumed, because the first version of this config was wrong in
two ways. With no config, **zero** vault markdown files are traced into `/private` — the
freshness widget would have thrown ENOENT in production while working perfectly locally.
Widening the root alone fixes it: Next's analysis of the `readdirSync` in `vault/load.ts`
then pulls the tree in by itself, making the `includes` entries redundant. And an explicit
`include` *beats* an `exclude`, so adding one made the 10 archive files impossible to leave
behind — the build kept shipping superseded resumes and transcripts into the function.

**How to reverse.** Remove both keys and the freshness panel loses its data source in
production only, which is the hardest kind of regression to notice. Verify any change by
reading `.next/server/app/private/page.js.nft.json` and counting traced `.md` files: 34 is
correct, 44 means the archive came along, 0 means it is broken.

---

### D-022 · The freshness audit reads the filesystem, narrowing D-019

**Decision.** `loadFreshness()` walks `context/` on disk. D-019's rule — private pages read
the vault over the GitHub API — still holds for every *editable* file.

**Why.** Freshness inspects 34 files to read one frontmatter field from each. Over the API
that is 34 round trips per dashboard render, against a rate limit, to compute something that
changes once a day.

**Cost, stated plainly.** After a write through the site, the panel shows the pre-edit date
until Vercel redeploys. That self-corrects in a couple of minutes, because a vault write is
a commit and a commit triggers a deploy — but it is a real window where the dashboard and
the vault disagree.

**How to reverse.** Swap `readVaultFiles()` for API reads, and add caching, or the dashboard
becomes unusably slow.

---

### D-020 · Vault writes validate the path before anything else

**Decision.** `assertVaultPath` rejects traversal, backslashes, non-`context/` prefixes, and
non-`.md` files — in that order.

**Why.** A fine-grained PAT with "Contents: read and write" covers **every file in the repo**,
not just the vault. That includes `web/` and `.github/workflows/`. Path validation is the only
thing between a bug in a form handler and an arbitrary repo write, including a workflow file
that would then run with the repo's own permissions. Shape is checked before prefix so a
backslash path reports as traversal rather than as "outside the vault", which would point at
the wrong defect.

**How to reverse.** Don't.

### D-021 · A misconfigured deployment explains itself instead of crashing

**Decision.** `isAuthConfigured()` is separate from `getSession()`, and `/signin` renders a
"Not configured" notice rather than throwing.

**Why.** Found by probing the live deploy: with `SESSION_SECRET` unset, `/signin` returned
**500**. The sign-in page is exactly where someone looks when auth is broken, so it was the
one page that must not be the page that crashes. `/private` was already failing closed
correctly; only the explanation was missing.

**How to reverse.** Don't — but note the rule it encodes: auth failures fail closed, and
configuration failures stay legible.

### D-019 · Private pages read the vault over the API, not the filesystem

**Decision.** `/private/*` fetches vault files through the GitHub Contents API even though
the repo is checked out beside the app.

**Why.** Two reasons. Vercel's runtime filesystem contains only what the build traced, and
dynamically-constructed paths are not traced — so `fs.readFileSync` would work locally and
404 in production. And after a write, the local copy is stale by definition; the API is the
thing that just changed.

**Cost.** Every private page load is a network round trip. Acceptable for one user; if it
ever isn't, cache per-request rather than reverting to the filesystem.

### D-018 · Passkey auth with no database

**Decision.** The enrolled credential lives in two environment variables
(`PASSKEY_CREDENTIAL_ID`, `PASSKEY_PUBLIC_KEY`). Sessions are HMAC-signed cookies built on
Web Crypto. There is no user table and no auth vendor.

**Why.** Following D-006 (Clerk gates passkeys behind $20-25/mo). With exactly one user, the
stored values are not secret — the private key never leaves the authenticator — so a database
buys nothing here. Web Crypto rather than a JWT library because `proxy.ts` may run on an edge
runtime with no Node `crypto`, and an HMAC over JSON is the whole requirement.

**What this design gives up.** Signature counters, which detect a cloned authenticator, need
somewhere to persist. Platform passkeys (Touch ID, Windows Hello) report counter 0 and never
increment, so there is nothing to compare — which is the only reason this works. **A hardware
key that does increment would need real storage.** Rotating or adding a device means
re-running enrolment and pasting new values into Vercel.

**Enrolment is closed by default.** `PASSKEY_REGISTRATION_SECRET` must be both set and
supplied. An open registration endpoint on a deployment with no credential configured would
hand the private site to whoever found it first.

**Enrolment is a page, not a script.** `/signin/register` runs the ceremony through
`@simplewebauthn/browser`. The first draft of this was a console snippet in a markdown file;
that was fragile enough to be a bad answer, and hand-rolling base64url in a copy-pasted
script is exactly where this goes wrong silently. The page 404s when the gate is shut.

**No recovery flow, deliberately.** Lose the device and you re-open the gate and re-enrol.
Since Victor controls the environment variables, that path is always available to him and to
nobody else — which is a better property than any recovery mechanism a single-user app could
offer. Written up in `REGISTER_PASSKEY.md`.

**How to reverse.** Move the credential into Neon (`DATABASE_URL` already exists for
athletics) and store the counter alongside it. The ceremony code does not change.

### D-017 · The resume is generated from the vault, in two languages

**Decision.** `/resume/[variant]` renders from `web/src/lib/resume.ts`; `99_archive/resume.md`
is written by `scripts/build_indexes.py`. Both select entries by each entry's own
`resume_variants` field. A test asserts the two agree.

**Why.** Victor asked for a genuinely generated resume, not a maintained document — bullets
already live in canonical entries and a hand-written copy guarantees drift. The vault must
also stay readable without running the web app, which is why the Python copy exists at all.
The duplication is the cost of that, and the drift test is what makes it safe.

**How to reverse.** Delete `build_resume` from `build_indexes.py` and the
"archived copy agrees with the site" describe block. The site is unaffected.

### D-016 · Print styling, not a PDF library

**Decision.** The PDF comes from the browser's own print dialog, driven by an `@media print`
block. No PDF generation dependency.

**Why.** $0 budget, and browser "Save as PDF" produces **selectable text** — which is what
resume parsers read. A rasterised dark-theme screenshot would be unparseable by the ATS
systems these applications go through. Victor also said he would export the PDF manually.

**Consequences worth knowing.** Everything themed is forced to near-black; muted greys that
read well on `#0a161b` print as illegible haze, so they are darkened to `#333`. Links print
without underlines because the URLs are already spelled out in the contact line.
`.resume-block` sets `break-inside: avoid` so a bullet list is never orphaned from its job
title across a page boundary.

**How to reverse.** Delete the `@media print` block in `globals.css`.

### D-015 · RLC lab dropped from the robotics resume variant

**Decision.** `labs/rlc.md` had `resume_variants: [robotics]`; now `[]`.

**Why.** Consistency with D-014. Having argued that assigned coursework is padding on the
portfolio, leaving it on the resume would be incoherent — and the solenoid project already
covers ESP32 instrumentation, better and with a self-directed result.

**How to reverse.** Put `robotics` back in that file's `resume_variants` and rerun
`python scripts/build_indexes.py`.

### D-014 · Labs cut to one entry, promoted to a project

**Decision.** Four of the five Physics 4BL labs (optics, RLC, sound, resistor/LED) are now
`public: false`. The solenoid bit reader moved to `01_engineering/projects/` as a hardware
project. The `/labs` route and its nav entry are gone.

**Why.** Victor's read was right. Those four are *assigned coursework* — every student in the
course measures an I-V curve and the speed of sound. They demonstrate compliance, not
capability, and on a portfolio they dilute the work that does differentiate. The solenoid lab
is categorically different: a self-directed macro-scale hard-disk-reader analog, 387-turn
coil, op-amp gain staging, calibration matrix, 100% decode accuracy. That is a build, and it
belongs next to the other builds rather than filed under coursework.

A `/labs` index holding one item also reads as an abandoned section, which is worse than no
section.

**How to reverse.** Flip `public: true` on the four lab files, restore `web/src/app/labs/`
from git history (`git show 2699a2a:web/src/app/labs/page.tsx`), and re-add the nav entry in
`site-header.tsx`. The lab entries were never deleted from the vault, so nothing is lost.

**Note.** The four labs stay in the vault deliberately — they are real academic history and
useful context for any AI reading the vault. Only their *publication* changed.

### D-013 · Projects carry a hero image, with a generated placeholder fallback

**Decision.** `image` is an optional project frontmatter field. When absent, `ProjectFigure`
renders a deterministic SVG placeholder derived from the project slug rather than a grey box.

**Why.** Victor has no photography yet but will. A placeholder that is on-palette and varies
per project keeps the grid looking designed in the meantime, and dropping a real file in later
is a one-line frontmatter change with no component edit.

**How to reverse.** Delete the `image` field and render nothing; the grid falls back to the
text-only cards from commit `2699a2a`.

### D-012 · The card sweep loops while hovered

**Decision.** `card-scan`'s highlight sweep repeats on a 2.4s cycle (sweep, then pause)
instead of firing once.

**Why.** Two reasons, one of them a bug fix. The one-shot version ended with the highlight
*parked over the card*: the animation had no fill mode, so on completion the transform
reverted to its base value and left a bright static band sitting on the left of every hovered
card. The keyframes also only travelled to 120% of the bar's own width — about 54% of the
card — so it never actually exited. Base transform now rests off-card and the travel is
260%. Looping is also the thematically right behaviour: a scope refreshes continuously.

**How to reverse.** Drop `infinite` from the animation shorthand in `globals.css` and keep
the corrected keyframes and base transform — those are the bug fix and should not be reverted
independently.

---

## 2026-08-20

### D-011 · Breadth content is its own vault entity, not a projection of the training logs

**Decision.** `context/03_craft_and_creative/pursuits/` holds the portfolio framing of dragon
boat, fabrication, and baking. The public build never reads `benchmarks_and_logs.md` or
`culinary_formulas.md`.

**Why.** Those files hold bodyweight, protein and creatine targets, and a lower-back rehab
protocol. Victor is comfortable storing health data in the cloud; that is not the same as
publishing it to recruiters. A separate entity means the risk is structurally absent rather
than mitigated by an allowlist that someone has to maintain correctly forever.

**How to reverse.** Not recommended. If the breadth section is cut entirely, delete the
`pursuits/` directory, `pursuitSchema`, `loadPursuits`, `publicPursuits`, and the section in
`page.tsx`.

### D-010 · Collaborator names are never published; group size is

**Decision.** `collaborators` is excluded from the public lab projection. The site shows
"N-person group lab" instead.

**Why.** Victor asked for the names to come off. Beyond that, they are private individuals
who did not agree to appear on a public portfolio. Group size stays because silently
presenting group work as solo misrepresents it to exactly the audience the site is for.

**How to reverse.** Add `collaborators` back to `PublicLab`, `toPublicLab`, and
`PUBLIC_LAB_KEYS`, and delete the privacy test in `public.test.ts`. The names were never
removed from frontmatter.

### D-009 · `## Notes` sections are stripped from every public body

**Decision.** `stripInternalSections()` removes the vault's `## Notes` convention from
project, experience, and lab bodies before rendering.

**Why.** Those sections hold relative links into `99_archive` and notes-to-self about
frontmatter. Bodies render verbatim on public pages, so they were being published. Handling
it at the projection layer rather than per-file means the next entry added is covered without
anyone remembering to.

**How to reverse.** Delete the call sites; the function is pure and independently tested.

### D-008 · Palette replaced with Victor's six swatches

**Decision.** Gold/warm-near-black is gone. Teal `#09A1A1` primary, rose `#D396A6`
secondary, peach `#F6C992` as the single warm note, on grounds derived from `#30525C`.

**Why.** Victor supplied the palette and said the gold and the flat background were not to
taste. Only `#30525C` was dark enough to build grounds from, so the page and card colours are
that hue driven down in lightness — this keeps surfaces the same temperature as the accents
instead of fighting them.

**Resolved 2026-08-21.** The supplied image labelled a *pink* swatch `#30525C`, which is a
dark slate teal, so the hex codes were treated as authoritative over the swatch colours.
Victor confirmed the result: "I like the current palette, keep using what is currently
there." The palette is settled — do not reopen it without being asked.

**How to reverse.** `git show a81dee8:web/src/app/globals.css` has the gold palette intact.

### D-007 · The background is not a flat fill

**Decision.** `<html>` paints the base colour; `body::before` layers three drifting radial
pools and `body::after` adds SVG-noise grain.

**Why.** Victor asked for the solid background to go. The grain is not decoration — wide
radial fills band visibly on 8-bit displays, and noise dithers them out.

**Constraint this creates.** `body` must stay background-less. Giving it an opaque background
buries both layers, and the symptom (a flat page) looks like the CSS simply did not apply.

**How to reverse.** Delete the two pseudo-element rules and put `bg-background` back on
`body` in `layout.tsx`.

### D-006 · Auth is self-hosted WebAuthn, not Clerk

**Decision.** `@clerk/nextjs` removed; `@simplewebauthn/server` + `/browser` in.

**Why.** Clerk gates passkeys to its Pro tier at $20-25/mo — recurring, and far outside the
$0 (max $5) budget. There is exactly one user forever, which makes Clerk's real job
(multi-tenant identity, org management, arbitrary sign-up flows) pure overhead.

**How to reverse.** Reinstall `@clerk/nextjs` and accept the subscription, or use Clerk's
free-tier email-code sign-in and give up passkeys.

### D-005 · Motion lives in two custom utilities, not repeated class chains

**Decision.** `card-scan` and `link-wipe` are `@utility` blocks in `globals.css`.

**Why.** The same hover treatment appears on five surfaces. As a Tailwind chain it was ~90
characters repeated per element, and changing the feel meant editing every one. Both collapse
under `prefers-reduced-motion` in one place.

**How to reverse.** Inline the CSS at each call site.

### D-004 · `SiteHeader` is a Client Component

**Decision.** It uses `usePathname` for the active-route indicator.

**Why.** The alternative is threading the pathname from every page. It receives only a name
string, so the RSC payload cost is negligible.

**How to reverse.** Drop the indicator and the `"use client"` directive.

---

## Earlier

### D-003 · Public projections name every field explicitly

Never spread-and-delete. A field added to the vault tomorrow is private by default, and
reaching a public page requires a deliberate edit plus a test update. **Do not "simplify"
this into a spread.** Two real leaks were caught by scanning built output, not by the type
system.

### D-002 · Fonts are self-hosted

`next/font/google` fetches at build time; a meaningful chunk of this project is written in a
car and on a plane. Files came from `@fontsource`.

### D-001 · Monorepo — `web/` inside the vault repo

Vault writes trigger public rebuilds, and other projects can clone and read `context/`
directly, which Victor asked for.

---

## Reversed

*(nothing yet)*
