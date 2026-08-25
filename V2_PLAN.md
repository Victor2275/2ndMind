# 2ndMind — V2 Completion Plan

**Revised 2026-08-25 · Deadline 2026-09-18 · Scope decided by Victor 2026-08-24, re-decided 2026-08-25**

The forward plan. `MIGRATION_PLAN.md` is its predecessor and is finished — that document is
history, this one is live.

Revision 2 changes four things, all on Victor's call (2026-08-25):

1. **§2.2 is descoped** from a 10h markdown-diff UI to a 4h proposal-review surface. The
   reason is in §2.2 — the dependency that justified the original was false.
2. **§2.5 is reinstated in full.** The $10 was per month, not lifetime; cost was the objection.
3. **§1.4 is built against fixtures now**, not deferred behind the prose.
4. **§1.6 loses its wall-clock gate.**

Rev-1 items §1.1 (git push) and §1.2 (Vercel config) are closed and moved to §0.1.

---

## 0. The shape of the time

This is the constraint everything else answers to.

| Window | Days | Hours | Notes |
|---|---:|---:|---|
| **Now → Taiwan** | 2026-08-25 → 08-28 | **~16h** | 4 days × 4h. Rev 1 said 20h; one day has passed. |
| Taiwan | 08-29 → 09-07 | **0h** | Assumed zero work |
| **Back → deadline** | 09-08 → 09-18 | **~44h** | 11 days × 4h |
| Move-in | 09-19 | 0h | |
| Term starts | 09-20 | ~4h/**week** | Everything after this is a different budget |

**Total before the deadline: ~60 hours.** Planned work below totals **39h**, leaving **21h of
slack — 35% of the budget**. That margin is deliberate: every estimate in this project so far
has been beaten or missed by more than 10%, and the ten-day gap in the middle is where context
gets lost and re-acquired.

Reinstating §2.5 (12h) is affordable only because descoping §2.2 and §2.3 gave back 7h. Those
two moves are linked; undoing the first without undoing the second breaks the budget.

### What "V2 done" means

**Features only.** The two remaining V1 findings — per-session revocation and error
aggregation — move to V3. They are real, but neither blocks daily use, and both are the kind of
work that expands once started.

### 0.1 · Closed since rev 1

- **`git push` is fixed.** `origin/main..HEAD` is empty; all five commits are on the remote.
  Verified 2026-08-25.
- **Vercel configuration** — Victor reports done. **Not verified by me**, and §2.1 is the first
  thing that will notice if `GEMINI_API_KEY` is missing there. Treated as a §0.2 check, not an
  assumption.

### 0.2 · Baseline, measured 2026-08-25

- `npm run typecheck` — clean.
- `npm test` — **391 tests across 21 files**, all passing. (`web/context.md` still claims 200
  across 13; fixed in §0.3.)
- `writeVaultFile` has no application caller. Only `readVaultFileCached` is called, from four
  sites. Unchanged since D-036, and after this revision it **stays** that way through V2.

### 0.3 · Housekeeping — **Easy, 1h**

Small, and every item is a rule this project already has that no task was assigned to.

1. `python scripts/build_indexes.py` after any change under `context/01_engineering/`.
2. Bump `context/04_operations/current_sprint.md` — it is `volatile` and dated 2026-08-24, so
   it trips the site's own freshness threshold on return from Taiwan. Update it before leaving
   and again on return.
3. Correct the test count in `web/context.md` (200/13 → 391/21).
4. Record the four scope decisions from this revision in `web/DECISIONS.md` as D-076…D-080.

**Done when:** `npm run shots` and the freshness widget both report nothing stale, and the
four decision entries exist.

> **DONE 2026-08-25.** Indexes rebuilt (only the coursework line moved). `web/context.md`
> corrected and given a section on the `shots` gate. Five decision entries written, D-076 to
> D-080 — five rather than four, because the resume needed a fix the plan had not anticipated.
> `current_sprint.md` updated below.

### Difficulty scale

| | Meaning |
|---|---|
| **Easy** | Understood end to end. The only risk is typing it. |
| **Moderate** | One unknown, or a decision to make while building. Estimate is reliable ±25%. |
| **Hard** | Genuine unknowns, or it touches something with a history of biting. Estimate could be off by 2×. |
| **Victor** | Not code. Blocked on Victor and cannot be done by an agent. |

---

## 1. Do first — this week, before Taiwan (~16h available, 12h committed)

Ordering principle unchanged: **anything blocked on Victor goes first**, because a ten-day gap
turns a five-minute task into a two-week delay. §1.5 is the only one left in that class.

### 1.1 · Resume: close the last 30px — **Easy, 2h**

SWE prints at **1.03 pages**; ML at 0.98 and Robotics at 0.90 already fit. The overflow is one
bullet line.

**Rev 1 hid a sub-task here.** Its completion test — "`node scripts/shots.mjs` reports every
variant under 1.00 pages" — is not achievable with the current script. `scripts/shots.mjs`
measures horizontal overflow, tap-target height and font size. It has **no page-count
measurement**, and its `PAGES` list contains only `/resume/swe`. So the work is two parts:

1. **Add page-count measurement to `shots.mjs`** (~45 min). Drive `page.pdf()` at Letter with
   the print stylesheet, or measure `scrollHeight` against the `@page` box in
   `globals.css:412`, and report a ratio per variant. Add `/resume/ml` and `/resume/robotics`
   to `PAGES`. Without this the "done" test is an eyeball, which is what let 1.33 pages survive
   for weeks.
2. **Trim the coursework line.** `coursework:` in `context/01_engineering/resume_config.md` is
   **seven** entries (rev 1 said six), and it is a **single flat list consumed by all three
   variants** (`src/lib/resume.ts:126`). Trimming to four shortens ml and robotics too. That is
   acceptable — both already fit — but it is a consequence, not a surprise. A swe-only trim
   would need variant-scoped coursework in the schema and is not worth it.

Not more type-shrinking. 9.6pt bullets are already at the floor of what reads as confident.

**Done when:** the extended `shots.mjs` reports all three variants under 1.00 pages, from a
measurement rather than a screenshot.

> **DONE 2026-08-25**, in ~1.5h. `swe 0.98 · ml 0.93 · robotics 0.86`, all one page, and the
> script now exits non-zero if any variant runs over.
>
> **The premise above was wrong, and the measurement is what caught it.** "The overflow is one
> bullet line" was not true: trimming coursework from seven to four moved swe only 1.03 → 1.01,
> recovering ~19px of the ~29px needed. Probing where the height actually goes found 17 bullets
> occupying 432px of a 973px sheet — 44% of the page — so the remaining 13px came from bullet
> leading (1.26 → 1.20) and the section gap (0.5rem → 0.375rem), neither of which costs
> content. Font sizes were not touched. See D-076, D-077, D-078.
>
> Two of the three ways of measuring the ratio were wrong before one was right — both measured
> the viewport rather than the content. D-077 records both failure modes, because the next
> person to measure a page height here will reach for exactly those two properties.

### 1.2 · Case-study page design — **Moderate, 4h** (+1h revision post-prose)

The four sections exist in every project file and unwritten ones correctly render as nothing
(D-073). What does not exist is a design that makes a filled-in case study read well: today
`## The problem` and `## Measured results` are styled identically to any other `h2` by
`src/components/site/prose.tsx`, which is a generic markdown renderer with no notion of the
case-study convention.

Specifically:
- Give **Measured results** visual weight — numbers are the payload, and they should be
  scannable without reading the prose.
- Give **What did not work** a distinct treatment. It is the rarest and most convincing section
  on any student portfolio and should not look like filler.
- Make the four-section rhythm obvious on a phone, where the sections arrive one at a time.
- A project with *some* sections filled must not look broken beside one with all four.

**Built against fixtures, on Victor's call (2026-08-25).** `solenoid-bit-reader` is the only
project with real content in more than one section, and it is one section from complete — so it
cannot verify the partially-filled case, which is the requirement most likely to be got wrong.
The design is therefore built against solenoid *plus* synthetic fixtures covering one-section,
two-section and all-four states. A revision pass (1h, post-Taiwan) reruns it against Victor's
actual prose.

**Implementation note.** The section-aware styling belongs in a case-study-aware renderer or a
component override keyed on heading text, not in `Prose` — `Prose` also renders experience,
labs and vault documents, and a `## Measured results` treatment leaking into those is a
regression. Whatever is chosen gets a test that a non-project body renders unchanged.

**Difficulty note:** moderate rather than easy because it is a judgement call, and because
`npm run shots` can tell you it does not overflow but not whether it looks good.

**Done when:** solenoid-bit-reader reads as a case study at 390px and 1280px, each fixture
state looks deliberate, and a vault document rendered through `Prose` is byte-identical to
before.

> **DONE 2026-08-25**, in ~2.5h against a 4h estimate. Tests 391 → 414; lint, typecheck and
> `shots` all clean. See D-081 and D-082.
>
> **One thing the plan did not anticipate: the section order was wrong in the files.** Four of
> six projects opened with `## Architecture` and reached `## The problem` third, because the
> D-073 skeleton was appended to files that already had an architecture paragraph. It is
> invisible today only because the misplaced sections are unwritten and `dropUnwritten`
> removes them — and it stops being invisible the moment §1.3's prose lands. So it was fixed
> *before* the writing, not after, by `scripts/order_case_study_sections.py` (whole sections
> only; verified no line changed; idempotent, with a `--check` mode).
>
> Fixtures were throwaway vault files at one, two and four written sections, screenshotted at
> 390px and 1280px and deleted immediately. They were never committed.
>
> Note for the §1.2b revision pass: `shots` now reports 27 sub-12px elements on
> project-detail, up from 24. The three new ones are the section indices at `0.62rem`, the
> same size as every existing eyebrow label on the page (`STATUS`, `YEAR`, `STACK`). Consistent
> with the established pattern rather than a new defect, but worth a look on real hardware.

### 1.3 · Write the case studies — **Victor, 2–4h of typing**

The prompts are waiting in each project file under `> **To write:**`. Nothing publishes until
prose replaces them, and **no agent will fill these in** — that is the whole point of the
convention (D-073), and the water bottle scale (D-069) is what happens when one tries.

Suggested order, strongest first:

| Project | What is missing | Why this order |
|---|---|---|
| **Solenoid Bit Reader** | Only "what did not work" | Already has the problem, design decisions and a real number (100% decoding accuracy, 40mm resolution limit). One section from complete. |
| **Proof** | Problem, what failed, results | Your largest software build and the most relevant to SWE roles. |
| **Water Bottle Scale** | All four | Also unlocks `draft: false` and a resume slot — it is off both today. |
| **TaskAble** | Problem, what failed, results | Hackathon context is already there. |
| **Micromouse** | Problem, what failed, results | Lowest stakes. |

**Do this on the plane.** It is the only item here that needs no computer beyond a text editor
and no network. Run `python scripts/build_indexes.py` afterwards (§0.3).

### 1.4 · Feature 3 · close out "Today" — **Moderate, 2h**

Everything is built — tasks, goals, stats, schedule. What has never happened is someone sitting
down and asking whether `/private` answers *"what do I do now"* in one screen without scrolling.

That review **is** the feature. Expect the outcome to be reordering and deleting, not building.

**Regraded from Easy.** Rev 1 called it Easy while its own body described judgement work of the
same class as §1.2. The hour count is unchanged; the label was wrong.

**The wall-clock gate is dropped, on Victor's call (2026-08-25).** Rev 1 required "one real day
of use", which cannot be satisfied before 08-29. I do the reorder-and-delete pass now and close
it on the screen test; Victor uses it in Taiwan on his phone, and anything wrong becomes a small
post-Taiwan fix rather than an item held open until the final window.

**Done when:** the top of `/private` at 390px answers "what do I do now" with no scroll, verified
in `shots.mjs` at 390px with `/private` added behind a session cookie or against a fixture.

> **DONE 2026-08-25**, in ~2h. **First task at 791px → 356px.** Tests 414 → 422. The plan
> called it exactly: nothing was built and no panel was deleted — the review was the feature.
>
> What occupied the fold: a failed AI panel (~170px) and three stat cards stacked into ~290px
> to show three zeros, two of which restate what the panels below already say. Tasks moved
> above the stats, the stats went three-across, the summary moved to the bottom. See D-084.
>
> `shots` now signs its own session and sweeps `/private`, **failing above 500px** — that is
> how 791px survived this long, since the passkey meant the sweep only ever saw the sign-in
> screen (D-083). The gate was verified in both directions before being trusted.
>
> **Two defects found on the way, both silent, both fixed:**
>
> 1. **`gemini-2.5-flash` is retired** — every call was 404ing with "no longer available to
>    new users", and `callModel` catches everything, so the dashboard just showed its fallback
>    string. **The whole AI feature set was inert and nothing said so.** Now
>    `gemini-3.6-flash`, verified working against the live API (D-085). This was a blocker for
>    §1.5 and all of §2.
> 2. **Failures were being cached for six hours** — `unstable_cache` stores what its function
>    returns, and `callModel` returns failures as values, so one 404 pinned the error message
>    to the dashboard long after the cause had gone (D-086).
>
> Both matter for §1.5, whose completion test is "verified by watching the cache rather than
> by trusting it". That test would have passed against a cache full of failures.

### 1.5 · Feature 6 · Summarise my week — **Easy, 3h**

Pulled forward from §2. It depends on nothing in §2 and on nothing Victor still owes, and the
pre-Taiwan window has room for it.

The daily summary already exists, is cached and reads the live `log_entries` (D-067). A weekly
version is the same shape over a seven-day window with a different prompt.

**Why here:** it reuses everything and proves the caching story at a second call site before
anything harder depends on it. It is also the first thing that will notice if `GEMINI_API_KEY`
is missing from Vercel (§0.1).

**Done when:** `/private` shows a weekly summary that costs one model call per week of unchanged
data, verified by watching the cache rather than by trusting it — meaning a logged cache
hit/miss, not an assumption that `unstable_cache` did its job. Note that local
`unstable_cache` behaviour and Vercel's are not identical; this must be confirmed on the
deployed site, not only in dev.

---

## 2. Feature 6 · the rest of the AI work — after Taiwan (27h)

Built in this order, because each one makes the next cheaper.

**Budget note.** ~$10 of credits **per month** (corrected 2026-08-25; rev 1 said lifetime).
Flash is cheap and the daily summary is already cached on its prompt (D-067). A monthly budget
is what makes §2.4 affordable. Every step below must still be cached; none may call the model
on render.

### 2.1 · The approval-gated proposal UI — **Moderate, 4h**

*Descoped from "approval-gated write UI, Hard, 10h" on Victor's call (2026-08-25).*

**Why the change.** Rev 1 specified a markdown diff over vault files and justified building it
first because "§2.3 depends entirely on the approval UI". That dependency is false. Sprint
goals are **Postgres rows**, not markdown: `saveSprintGoals` → `replaceGoals` writes `tasks`
rows with `source='goal'` (`src/app/private/actions.ts:144`). Nothing about goals touches the
vault. Following rev 1 would have meant building a 10h markdown-diff UI that **no V2 feature
calls** — §2.2 writes rows, §2.3 writes nothing, §2.4 reads — reproducing exactly the dormancy
the plan flagged as its own risk.

What gets built instead is the constraint itself, at the right altitude: **a generic
"model proposes / Victor approves" surface over structured proposals.**

1. **A proposal model.** A proposal is a typed list of changes with a before and an after per
   item — not a text diff. Goals are the first producer; anything later (tasks, log entries)
   plugs in without touching the UI.
2. **Approve / reject / edit-then-approve, per item.** Rejecting must leave state untouched.
   Partial approval is the normal case, not an edge case.
3. **Readable on a phone**, since that is where approvals will actually happen.
4. **Staleness.** A proposal generated against rows that have since changed must be detected
   and re-shown, not silently applied over the top. This is the row-shaped version of rev 1's
   `409` concern and it is still real.

**The constraint is unchanged and is now satisfied more strongly than rev 1 satisfied it:**
nothing writes on a model's say-so, and in V2 **nothing AI-driven writes to the vault at all**.
`writeVaultFile` stays dormant. Wiring it to a markdown diff moves to V3 (§3), where it belongs
— behind a real writer rather than ahead of one.

**Done when:** a proposed change can be reviewed and partially approved from a phone, a
rejected item leaves no trace in Postgres, and a proposal built against stale rows is refused
rather than applied.

### 2.2 · Draft sprint goals — **Moderate, 4h**

Reads the week's tasks, logs and calendar; proposes next week's goals as a §2.1 proposal.

*Down from 5h: it no longer has to render markdown, only produce three typed rows.*

**Done when:** it proposes goals Victor would plausibly have written, and he has approved one
real set — with at least one item rejected, to prove partial approval works on real input.

### 2.3 · Resume tailoring — **Moderate, 6h**

Paste a job description; get suggestions about which bullets to emphasise and which variant to
send. **Writes nothing** — output is advice, so it needs no approval gate.

Keep it honest: it may suggest *reordering and selecting* from bullets that exist. It may never
propose new claims.

**Rev 1's guardrail was under-specified.** "A test proves it cannot introduce a bullet that is
not in the vault" only holds if the model emits **bullet identifiers** — a stable index or slug
per bullet — rather than prose. If it emits prose, any check is fuzzy string matching, and
D-069 walks straight back in through the one feature that touches a hiring document. So:

- The prompt supplies bullets as an enumerated list and demands ids back.
- The response is parsed to ids; **any id not in the supplied set fails the whole response**,
  it is not dropped silently.
- Free-text rationale is allowed and displayed as *rationale*, never as bullet text.
- A test feeds a response containing a fabricated id and asserts rejection.

**Done when:** it produces a suggestion for a real job posting, and the fabricated-id test
fails closed.

### 2.4 · Semantic search — **Hard, 12h**

*Reinstated on Victor's call (2026-08-25).* Rev 1 declared it the cut on grounds of cost; the
budget is $10/month, not lifetime, so that reason no longer holds. It stays **last in build
order**, which keeps it the de-facto cut without needing to be named one.

Natural-language questions across the vault. Needs embeddings, somewhere to store them, and
incremental re-embedding so that editing one file does not re-embed all twenty-four.

- Vectors in Postgres, alongside the four existing tables, with a committed migration.
- Embed only files whose `updated:` frontmatter changed — the field every write already bumps,
  which is why it can be trusted here.
- A hard ceiling on tokens per re-index run, enforced in code, not in judgement.
- **Health data may go to the model (D-071) and may never be published (absolute).** Embedding
  `02_physical_performance/` sends bodyweight to Google; that is inside D-071. Any search
  surface reading those vectors is private-only, and a test asserts no public route imports it.

**New cut line, since §2.5 is no longer it:**

1. **First cut** — drop incremental re-embedding; full re-index on demand from a button.
   Saves ~4h, costs one full pass per invocation, which at 24 files is affordable monthly.
2. **Second cut** — the whole item.

**Cut trigger, stated now so it is not decided under pressure:** if §2.1 + §2.2 + §2.3 exceed
**18h combined** as of **2026-09-13**, take cut 1. If they exceed 22h, take cut 2.

---

## 3. Not in V2 — deferred to V3

Recorded so they are not silently forgotten.

| Item | Why deferred |
|---|---|
| **Vault-write markdown diff** | *New in rev 2.* The full diff UI from rev 1 §2.2. Real, but it needs a writer to exist first; building it ahead of one is what rev 1 got wrong. Revisit when something actually drafts markdown — case-study sections or `current_sprint.md` prose are the candidates, and the first collides with D-073 and needs Victor's explicit sign-off. |
| **Per-session revocation** | Sessions are HMAC tokens with an expiry; rotating `SESSION_SECRET` is the only revocation and it signs out every device. Real, but it does not block daily use. |
| **Error aggregation** | `app/error.tsx` gives a boundary and logs to Vercel. What is missing is *aggregation* — a failure you never see is still invisible. A free Sentry tier would close it, but payloads carry vault content and need scrubbing rules first. |
| **Octokit retry/throttle** | Reasonable, cheap, and pointless for one user until something writes to the vault regularly. Revisit alongside the diff UI. |
| **Vault write concurrency queue** | The `409` is optimistic concurrency working correctly. A full queue is over-engineering for one user. |

---

## 4. Ordered summary

| # | Item | Who | Difficulty | Est. | Window |
|---|---|---|---|---:|---|
| 0.3 | Housekeeping — indexes, freshness, decisions | me | Easy | 1h | pre |
| 1.1 | Resume: page-count measurement + coursework trim | me | Easy | 2h | pre |
| 1.2 | Case-study page design, against fixtures | me | Moderate | 4h | pre |
| 1.3 | Write the case studies | **Victor** | — | 2–4h | plane |
| 1.4 | Close out feature 3 | me | Moderate | 2h | pre |
| 1.5 | Summarise my week | me | Easy | 3h | pre |
| 1.2b | Case-study design revision, against real prose | me | Easy | 1h | post |
| 2.1 | Approval-gated **proposal** UI | me | Moderate | 4h | post |
| 2.2 | Draft sprint goals | me | Moderate | 4h | post |
| 2.3 | Resume tailoring | me | Moderate | 6h | post |
| 2.4 | Semantic search | me | **Hard** | 12h | post |

**Pre-Taiwan: 12h committed against ~16h.** 4h buffer, deliberately unfilled — the last day
before a flight is not when to start a 4h item.

**Post-Taiwan: 27h against ~44h.** 17h slack.

**Total mine: ~39h against ~60h.**

### Changed against rev 1

| Item | Rev 1 | Rev 2 | Why |
|---|---:|---:|---|
| Resume | 1h | 2h | Page-count measurement did not exist |
| Approval UI | 10h Hard | 4h Moderate | The dependency justifying it was false |
| Draft goals | 5h | 4h | No markdown to render |
| Semantic search | 12h ✂️ | 12h kept | $10/month, not lifetime |
| Housekeeping | — | 1h | Rules with no task attached |
| **Total** | **43h** | **39h** | |

---

## 5. What could go wrong

Ordered by how likely they are to actually happen.

1. **The case studies do not get written.** Now the top risk, since the push is fixed. Then
   §1.2 designs a page for content that does not exist and the portfolio gains structure
   without substance. Mitigation: they are plane work, needing no network; and §1.2 is built
   against fixtures so it is at least *correct* for the empty and partial cases.
2. **§2.4 runs to 18h instead of 12.** It is the only Hard item left and the only one touching
   a new storage shape. Mitigation: the two-stage cut in §2.4, with a dated trigger.
3. **`unstable_cache` behaves differently on Vercel than locally.** Every §2 item's cost story
   rests on it, and it has only ever been exercised on one call site. Mitigation: §1.5 verifies
   it on the deployed site before three more features depend on it. This is why §1.5 moved
   forward.
4. **The ten-day gap loses context.** Mitigation: `web/DECISIONS.md` (75 entries, 79 after
   §0.3) and this file. Regenerate `Mastermind.md` before travelling if another AI will be used.
5. **The $10/month runs out.** Only §2.4 can plausibly do this, and only through repeated full
   re-indexing — which is precisely what cut 1 would introduce. If cut 1 is taken, the token
   ceiling stops being a safeguard and becomes the only defence.
6. **The Vercel config is not actually done.** Reported, not verified. §1.5 surfaces it.

---

## 6. Standing rules for this work

Not new — restated because they are what an agent gets wrong.

- **Never invent a fact about Victor's work.** Unknown → a `> **To write:**` prompt, which is
  stripped from public output. See D-069 for what the alternative looked like.
- **Health data may go to the model** (D-071) but **may never be published** (unchanged,
  absolute). These are different acts. §2.4 embeds health data; that is inside D-071 and
  changes nothing about publication.
- **Nothing writes to the vault on a model's say-so.** In V2 nothing AI-driven writes to the
  vault at all.
- **Add a `DECISIONS.md` entry** for every non-obvious choice, with how to reverse it.
- **`npm run shots`** before calling any visual work done. It found every mobile defect fixed so
  far; none was visible to a text-only check.
- **`npm test` and `npm run typecheck`** before calling anything done. Baseline is 391/21 and
  clean; a drop is a regression, not noise.
- **Measure, do not assume.** "The resume looks fine" survived weeks; "1.33 pages" did not
  survive ten minutes. Rev 1's own completion test for that item assumed a measurement that did
  not exist.
