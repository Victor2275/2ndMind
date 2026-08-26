# 2ndMind — V2 Completion Plan

**Rev 4 · 2026-08-25 · Deadline 2026-09-18 · Scope decided by Victor 2026-08-24, revised three times on 2026-08-25**

The forward plan. `MIGRATION_PLAN.md` is its predecessor and is finished — that document is
history, this one is live.

Revision 2 changes four things, all on Victor's call (2026-08-25):

1. **§2.2 is descoped** from a 10h markdown-diff UI to a 4h proposal-review surface. The
   reason is in §2.2 — the dependency that justified the original was false.
2. **§2.5 is reinstated in full.** The $10 was per month, not lifetime; cost was the objection.
3. **§1.4 is built against fixtures now**, not deferred behind the prose.
4. **§1.6 loses its wall-clock gate.**

Rev-1 items §1.1 (git push) and §1.2 (Vercel config) are closed and moved to §0.1.

**Revision 3** adds §7: ten new items requested on 2026-08-25, split four into V2 and six into
V3. One of them — the domain — reorders existing work, because changing the domain invalidates
the production passkey.

**Revision 4** takes the cut. Victor moved the Working page and the public→private button into
V2 and accepted read-only for the job sheet; **semantic search is cut** to pay for them. Net
−4.5h. V3 is now its own document, `V3_PLAN.md`.

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

**Total before the deadline: ~60 hours.** Planned work totals **~42h**, leaving **~18h of
slack — 30% of the budget**. That margin is deliberate: every estimate in this project so far
has been beaten or missed by more than 10%, and the ten-day gap in the middle is where context
gets lost and re-acquired.

Reinstating §2.5 (12h) is affordable only because descoping §2.2 and §2.3 gave back 7h. Those
two moves are linked; undoing the first without undoing the second breaks the budget.

**Rev 4 (2026-08-25)** is the version that matters now:

| | Hours |
|---|---:|
| Rev 3 total | 42h |
| **+** Working page, now a public "Now" page (§7.9) | +6h |
| **+** Public → private button (§7.5) | +1.5h |
| **+** Job sheet, read-only (§7.6) | +4h |
| **−** Semantic search, **cut** (was §2.4) | −12h |
| **Rev 4 total** | **~41.5h** |

**Spent: ~5.5h** — §0.3, §1.1, §1.2 and §1.4 are done. **~36h of work remains against ~54.5h
available**, so slack is ~34%. Three features were added and the plan got *shorter*, because
the item they displaced was the largest and hardest in it.

Victor offered extra hours to fit everything. They are not needed and are not being taken: the
cut was already declared in rev 1, and eleven consecutive 6h days ending the day before
move-in is the kind of schedule that produces the mistakes this plan exists to avoid. The offer
is held in reserve — see §5.

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

## 1. Do first — this week, before Taiwan (~16h available, 15h committed)

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

> **DONE 2026-08-25**, in ~2h. Tests 422 → 426.
>
> **The cache is now observed, not trusted** (D-093). `callModel` logs every real request, and
> from a cold cache three loads of `/private` with unchanged input cost **zero** calls while
> changing the prompt cost exactly **one**. That measurement is the completion test, and it was
> not satisfiable before — nothing could see whether a call happened.
>
> The model is fed **one line per day for seven days, empty days included** (D-092), not one
> line per entry. Keyed on the prompt, a week of raw entries would change its cache key every
> time any single entry moved; days change only when a day changes. And "nothing logged" on
> three days is the most useful thing a weekly summary can say — dropping those rows would make
> a four-day week look like a full one.
>
> **What is not verified: the populated path.** `.env.local` points at the production Neon
> database, so seeding log entries to exercise it would write into Victor's real logbook. The
> empty-week path, the guards and the tag separation are tested; the first real exercise is the
> first week he logs something. The Vercel-versus-local caching question in the note above is
> still open for the same reason it always was — it needs a deploy.

---

## 2. Feature 6 · the rest of the AI work — after Taiwan (14h)

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

> **DONE 2026-08-25**, in ~2h against a 4h estimate. Decision D-100.
>
> **Rejection is expressed by absence** — an unticked item is not sent, so its current value
> carries through untouched. The alternative, every item plus a decision flag, needs a branch
> that can be got wrong; this cannot write a rejected item because it never sees one. An
> approved *empty* value is a deletion, not a no-op, so proposing removal stays sayable.
>
> **Staleness is recomputed server-side** against live rows; the returned `basis` is compared,
> never trusted. The fingerprint sorts by key because `replaceGoals` soft-deletes and re-inserts
> on every save — ids change constantly, and an order-sensitive fingerprint would mark every
> proposal stale.
>
> Nothing is persisted between proposing and approving. A table would need a migration, a
> lifecycle and a cleanup rule for proposals nobody answered, for two events seconds apart on
> one screen.
>
> Partial approval is tested **against real Postgres**, not a mock: `replaceGoals` wipes the set
> before inserting, so a merge bug would not throw — it would quietly delete the goals Victor
> did not approve.

### 2.2 · Draft sprint goals — **Moderate, 4h**

Reads the week's tasks, logs and calendar; proposes next week's goals as a §2.1 proposal.

*Down from 5h: it no longer has to render markdown, only produce three typed rows.*

**Done when:** it proposes goals Victor would plausibly have written, and he has approved one
real set — with at least one item rejected, to prove partial approval works on real input.

> **BUILT 2026-08-25**, in ~2h. Tests 464 → 499. Decision D-101. **The acceptance half is
> Victor's** and is deliberately left open: approving writes to the production goals table, so
> the first real set has to be his.
>
> Reads the week's done and open tasks, the week's log as one-line summaries, and next week's
> calendar (best-effort — a slow feed must not block drafting). Health data does not travel this
> path: bodyweight and rehab are their own tables and are not read.
>
> **The model's output is parsed, not cast.** Fenced JSON, a sentence of preamble, and two goals
> for one domain are routine model behaviour rather than exceptions, and `as GoalDraft[]` would
> put an empty row in front of Victor that approves an empty goal. Unparseable responses are
> logged and reported as a written message — pasting raw model output into the UI is how an
> injected string reaches the screen looking like an app message.
>
> **Uncached**, unlike the summaries: those exist because `/private` is `force-dynamic`. A draft
> is a button press, and a memoised one would make pressing twice look broken. The panel is
> collapsed by default so it is not pressed out of habit.

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

### 2.4 · Semantic search — ✂️ **CUT 2026-08-25**

Moved to `V3_PLAN.md` §1. It was the declared cut in rev 1, reinstated in rev 2 when the
budget turned out to be $10/month rather than $10 lifetime, and cut again in rev 4 — this time
on **time**, which was always the binding constraint. At 12h it was the largest item in V2 and
the only remaining Hard one, and it paid for three features Victor wanted more.

Nothing was built, so nothing is wasted. The reasoning that survives into V3: vectors in
Postgres, embed only files whose `updated:` changed, and a hard token ceiling per re-index run.
Health data reaching the model is inside D-071; health data reaching a *public* page never is,
so any search surface is private-only with a test asserting no public route imports it.

---

## 3. Not in V2

**Everything deferred now lives in `V3_PLAN.md`**, with sizing and reasoning, rather than as a
table of regrets at the bottom of this document. It holds nine items across ~46h.

The three Victor picked for V3 on 2026-08-25 — filament and printer tracking, uploading his own
resumes, and editing the job sheet — are scheduled there. The rest are recorded but unscheduled,
including the two V1 findings (per-session revocation, error aggregation) which he did *not*
pick, and which therefore stay open rather than quietly becoming V3's problem.

The rule that put each one there is the same: **V2 ships the portfolio**. Anything that does not
make the portfolio better, or is not forced by a date, waits.

---

## 4. Ordered summary

Done is struck through in spirit — the DONE blocks above carry the detail.

| # | Item | Who | Difficulty | Est. | Window | State |
|---|---|---|---|---:|---|---|
| 0.3 | Housekeeping — indexes, freshness, decisions | me | Easy | 1h | pre | **done** |
| 1.1 | Resume: page-count gate + one-page fix | me | Easy | 2h | pre | **done** |
| 1.2 | Case-study page design, against fixtures | me | Moderate | 4h | pre | **done** |
| 1.4 | Close out feature 3 | me | Moderate | 2h | pre | **done** |
| 7.2 | The uploads list | me | — | — | pre | **done** |
| 7.1 | Domain `victorgusev.com` | both | Easy | 1.5h | pre | **done** |
| 1.5 | Summarise my week | me | Easy | 3h | pre | **done** |
| 7.3 | The four uploaded images | me | Easy | 1h | pre | **done** |
| 7.4 | Culinary → Proof | me | Easy | 0.5h | pre | **done** |
| 7.11 | Both devices signed in | me | Easy | 1h | pre | **done** |
| 1.3 | Write the case studies | **Victor** | — | 2–4h | plane | 17 sections |
| — | `UPLOADS_NEEDED.md` §2 | **Victor** | — | — | plane | |
| 1.2b | Case-study revision, against real prose | me | Easy | 1h | post | needs 1.3 |
| 7.9 | Working page — public "Now" | me | Moderate | 6h | post | **done** (~3h) |
| 2.1 | Approval-gated proposal UI | me | Moderate | 4h | post | **done** (~2h) |
| 2.2 | Draft sprint goals | me | Moderate | 4h | post | **built** (~2h) · Victor to accept |
| 2.3 | Resume tailoring | me | Moderate | 6h | post | ✂️ 2nd cut |
| 7.5 | Public → private button | me | Easy | 1.5h | post | |
| 7.6 | Job sheet, read-only | me | Moderate | 4h | post | ✂️ **1st cut** · needs Victor |
| ~~2.4~~ | ~~Semantic search~~ | — | — | ~~12h~~ | — | **cut → V3** |

**Pre-Taiwan: complete.** Everything scheduled before the flight is done, plus §7.11, which
was not in the plan at all until sign-in started working.

**Post-Taiwan: 14h of the 26.5h is already done** — §7.9, §2.1 and §2.2 landed early, in ~7h
against a 14h estimate. Remaining: **§1.2b (1h, needs Victor's prose), §2.3 (6h), §7.5
(1.5h), §7.6 (4h)** — 12.5h.

**The cut line has not been reached.** Its trigger was §7.9 + §2.1 + §2.2 exceeding 16h
combined by 2026-09-14; they came in at ~7h, three weeks early. Both §7.6 and §2.3 survive
on current numbers, and §7.6 is still blocked on Victor publishing the sheet rather than on
time.

### The new cut line

Semantic search was the declared cut and has been spent. A plan without a cut line decides
under pressure, so:

1. **First cut — §7.6, the job sheet read (4h).** It is blocked on Victor publishing the CSV,
   it duplicates a sheet he can already open on his phone, and a background script already
   maintains it. Losing it costs the least of anything left.
2. **Second cut — §2.3, resume tailoring (6h).**

**Trigger:** if §7.9 + §2.1 + §2.2 exceed **16h combined** by **2026-09-14**, take cut 1.

---

## 5. What could go wrong

Ordered by how likely they are to actually happen.

1. **The case studies do not get written.** Unchanged as the top risk, and now the *only* thing
   standing between the portfolio and being finished — the design, the resume and the page
   structure are all done and waiting on prose. 17 sections; run
   `python scripts/case_study_status.py`. Mitigation: plane work, no network, and solenoid is
   one section from complete.
2. **§7.9 runs long.** It is the largest remaining item and the first live caller of
   `writeVaultFile`, dormant since D-036 — a code path that has never run in production.
   Mitigation: the cut line in §4, with a dated trigger.
3. **`unstable_cache` behaves differently on Vercel than locally.** Every §2 item's cost story
   rests on it. Mitigation: §1.5 verifies it on the deployed site before two more features
   depend on it. Rev 2 moved §1.5 forward for exactly this, and rev 3's discovery that failures
   were being cached for six hours (D-086) is evidence the concern was right.
4. **The domain switch locks Victor out of `/private`.** Changing `NEXT_PUBLIC_SITE_URL` moves
   the passkey relying party, and the enrolled credential stops working. This is not a risk so
   much as a certainty; the mitigation is doing it *before* the next enrolment rather than
   after, which is why §7.1 is first.
5. **The ten-day gap loses context.** Mitigation: `web/DECISIONS.md` (86 entries), this file,
   `V3_PLAN.md` and `UPLOADS_NEEDED.md`. Regenerate `Mastermind.md` before travelling if
   another AI will be used.
6. **The Vercel config is not actually done.** Reported, not verified. §1.5 surfaces it, and
   §7.1 forces a visit to that dashboard anyway.

**The reserve.** Victor offered extra hours. They are deliberately unspent — if two of these
land at once, that offer is the answer, not a further cut. Taking them up front would have
converted a margin into a plan, and a plan with no margin is how the last three weeks of a
deadline go wrong.

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

---

## 7. New scope — requested 2026-08-25

Ten items. **Seven are in V2; three are in V3.**

Rev 3 put four in V2 on the grounds that they were forced by time. Rev 4 added three more on
Victor's call — the Working page, the public→private button, and reading the job sheet — and
paid for them by cutting semantic search, which was 12h of the hardest work in the plan for the
capability he rated lowest. That trade is why seven new features fit into a plan that got
*shorter*.

| # | Item | Where | Est. | Why there |
|---|---|---|---:|---|
| 7.1 | Domain `victorgusev.com` | **V2, first** | 1.5h | Blocks passkey. Needs a connection. |
| 7.2 | The uploads list | **V2, done** | — | Requested for Thursday. `UPLOADS_NEEDED.md`. |
| 7.3 | The four images you uploaded | **V2** | 1h | Already on disk, earning nothing. |
| 7.4 | Culinary → Proof | **V2** | 0.5h | A deletion. Deletions are cheap. |
| 7.5 | Public → private button | **V2** *(rev 4)* | 1.5h | Moved in on your call. |
| 7.6 | Job sheet, **read-only** | **V2** *(rev 4)* | 4h | You said read-only is fine for now. |
| 7.9 | Working page — public **"Now"** | **V2** *(rev 4)* | 6h | Moved in on your call. |
| 7.7 | Upload your own resumes | V3 | 5h | Your call. Needs a decision first. |
| 7.8 | 3D printing: filament + printers | V3 | 9h | Your call. Blocked on your inventory. |
| 7.10 | **Edit** the job sheet | V3 | 12h | Ten times the cost of reading it. |

**Rev 4 settled this.** Three of the six deferred items came into V2 (+11.5h) and semantic
search was cut to pay for them (−12h), so V2 is ~41.5h against ~60h and slack is ~34% — better
than before the ten items arrived. The three remaining V3 items are in `V3_PLAN.md`.

### 7.1 · Buy `victorgusev.com` and point it here — **1.5h, and 10 min of it is yours**

**Do this before enrolling any more passkeys.** `relyingParty()` derives `rpID` from
`NEXT_PUBLIC_SITE_URL`'s hostname (`lib/auth/config.ts:56`), and a WebAuthn credential is
bound to the origin that created it. The passkey on `victorgusev.vercel.app` **stops working
the moment the domain changes**. Buy first, switch, then enrol once — rather than enrolling
now and again in three weeks.

**Where to buy, against a $12/yr ceiling.** A `.com` costs registries about $10.50 wholesale,
so the ceiling rules out anyone taking a real margin — and it especially rules out the common
trick of a cheap first year against a $15–20 renewal, which passes your budget in year two.

- **Cloudflare Registrar — recommended.** Sells at cost, no markup, renewal is the same price
  as year one. WHOIS privacy included. Requires using Cloudflare's DNS, which is free and is
  no worse than any other. Roughly **$10.50/yr**.
- **Porkbun** — a little more, around **$11/yr**, privacy included, no DNS requirement.
- **Vercel Domains** — buys and configures in one step, but a `.com` is typically around
  $20/yr. Convenient and over budget.
- **Namecheap / GoDaddy** — cheap first year, renewal above your ceiling. Avoid.

*Prices are approximate and move; check at checkout before committing.*

**Then, in order:**

1. Vercel → the project → **Settings → Domains** → add `victorgusev.com` **and**
   `www.victorgusev.com`. Vercel will nominate one as primary and redirect the other; apex as
   primary is the usual choice.
2. Vercel shows the exact DNS records to create — an `A` record for the apex and a `CNAME` for
   `www`. **Use the values it shows you, not any written down elsewhere**, including here:
   Vercel has changed these addresses before and a stale IP fails in a way that looks like a
   propagation delay for hours.
3. In Cloudflare, add those records with proxying **off** (the grey cloud, "DNS only").
   Cloudflare's orange-cloud proxy in front of Vercel's is two CDNs in series, which breaks
   certificate issuance and is a genuinely unpleasant thing to debug.
4. Wait for Vercel to report the domain valid and the certificate issued. Usually minutes.
5. **Set `NEXT_PUBLIC_SITE_URL=https://victorgusev.com` in Vercel** and redeploy. This one
   variable moves the canonical URL, the sitemap, `robots.txt`, Open Graph metadata *and* the
   passkey relying party together.
6. **Re-enrol the passkey on the new origin.** Set `PASSKEY_REGISTRATION_SECRET`, register from
   the phone you actually use, then unset it. `web/REGISTER_PASSKEY.md` has the ceremony.
7. Mine — the three fallback strings in `layout.tsx`, `robots.ts` and `sitemap.ts` still read
   `victorgusev.vercel.app`, and `REGISTER_PASSKEY.md`, `.env.example` and `context.md` all
   name the old host.

**Done when:** `victorgusev.com` serves the site over HTTPS, the old `.vercel.app` URL still
resolves, `/sitemap.xml` names the new host, and you can sign in to `/private` on your phone.

> **PARTLY DONE 2026-08-25. Two steps left, both Victor's.**
>
> The domain is bought and connected. Measured from here:
> `victorgusev.com` → 308 → `www.victorgusev.com` (200); `victorgusev.vercel.app` → 307 → the
> same. **`www` is the primary**, which the plan had not anticipated and which changes the
> passkey story.
>
> **`NEXT_PUBLIC_SITE_URL` is not set in Vercel.** `/sitemap.xml` and `/robots.txt` still
> advertise `victorgusev.vercel.app`, which is how I know. That single variable is both the
> canonical URL *and* the WebAuthn relying party, so while it is unset:
>
> - every indexed URL points at a redirect, and
> - **sign-in on the live site does not work** — the app expects `victorgusev.vercel.app` while
>   the browser is on `www.victorgusev.com`, and the origin check fails.
>
> **Done in code:** the three fallbacks now read `https://www.victorgusev.com` (D-094), and
> `relyingParty()` was rewritten (D-095) so the credential binds to the **apex** while *both*
> the apex and `www` are accepted as origins. That means flipping which one is primary no
> longer locks anyone out — previously it silently would have. Six tests cover it. Docs updated:
> `REGISTER_PASSKEY.md`, `.env.example`, `context.md`, `current_sprint.md`.
>
> **Canonical URL flipped to the apex** on Victor's call, later the same day (D-096,
> superseding D-094). `victorgusev.com` is what goes on a resume. It cost nothing to change
> because D-095 had already made `rpID` the apex and `origins` a list — without that, this
> would have been a second forced re-enrolment.
>
> **2026-08-25, later:** Victor hit `The RP ID "localhost" is invalid for this domain` while
> enrolling. Diagnosed from here — the apex is primary now (`www` 307s to it, step 1 done), but
> `/sitemap.xml` still names `victorgusev.vercel.app`, so **the deployed build is still the old
> code and `NEXT_PUBLIC_SITE_URL` is still unset.** The *old* `relyingParty()` fell back to
> `http://localhost:3000`, which is exactly where that `localhost` came from.
>
> Correction to the note above: it said the app "expects `victorgusev.vercel.app`". That was
> wrong for auth — only the sitemap, robots and metadata used that fallback. Auth's fallback was
> localhost, so sign-in was failing more confusingly than described, not less.
>
> D-097 makes this class of failure legible: both ceremonies now refuse up front with a sentence
> naming the request origin, the current `NEXT_PUBLIC_SITE_URL` and what the app expects.
>
> **Left for Victor, in order — and the order matters:**
> 1. ~~In Vercel, make **`victorgusev.com` the primary domain**~~ — **done**, verified
>    2026-08-25: `www` 307s to the apex.
> 2. ~~Set `NEXT_PUBLIC_SITE_URL=https://victorgusev.com` and redeploy.~~ — **done**.
> 3. ~~Re-enrol the passkey.~~ — **done 2026-08-25**, and sign-in works. See §7.11: one
>    device was never the requirement, and the account is now a list.
>
> Step 3 was unavoidable: the old credential was bound to `victorgusev.vercel.app`, which no
> longer serves anything. Putting it last meant it happened exactly once. **§7.1 is closed.**

### 7.3 · The four images — **1h**

`5SecondRule.png`, `MicromouseSim.png`, `taskable.png` and `ProfilePhoto.jpg` are sitting in
`context/assets/`, untracked and unused.

The mechanism already exists but only for labs: `scripts/sync-lab-assets.mjs` copies
`context/assets/labs/` into `public/labs/` on predev and prebuild, and `public/labs/` is
gitignored so 2 MB of PNGs never enter the repo twice. This extends that to the top-level
assets directory, then sets `image:` in the three project files and adds the photograph to
About.

Three projects gaining a real photograph is worth more than it sounds: D-074 removed generated
placeholders precisely so that the projects which *do* have an image read as the strongest.
Until now that was one project out of six.

Rev 3 said `MicromouseSim.png` was too small at 6.4 KB and asked for a larger one. **That was
wrong, and the file is fine.** 6.4 KB is what flat maze graphics compress to; PNG is very good
at large areas of one colour. Measured:

| File | Pixels | Ratio | Fits the 16:9 hero? |
|---|---|---|---|
| `5SecondRule.png` | 1920 × 1080 | 1.78 | yes |
| `taskable.png` | 1428 × 910 | 1.57 | yes |
| `ProfilePhoto.jpg` | 2048 × 1365 | 1.50 | About page, not a hero |
| `MicromouseSim.png` | **606 × 649** | **0.93** | **no — nearly square** |

The real problem is shape. The hero is `aspect-16/9` with `object-cover`, which on a square
image crops the top and bottom off the maze and upscales what is left from 606px. So Micromouse
does not get a hero: it renders **contained on a padded surface**, which is what the Figures
gallery on the same page already does (`object-contain p-1.5`). No larger file is needed.

**Done when:** the three projects show their image on card and detail page, About shows the
photograph, `npm run shots` reports no new overflow, and no PNG is committed to the repo.

> **DONE 2026-08-25**, in ~1h. `sync-lab-assets.mjs` became `sync-vault-assets.mjs` and now
> syncs `context/assets/` → `public/assets/` as well as the labs directory; both destinations
> are gitignored, so no image enters the repo twice.
>
> Two things the screenshots caught that the measurement could not:
>
> 1. **The grid went ragged** (D-090). Rows stretched to equal height, which was invisible with
>    one image among six and opened ~200px of void under Proof and Water Bottle Scale once four
>    of six had one. Fixed with `items-start`.
> 2. **Three heroes were being cropped** (D-091). A new `image_fit` field picks `contain` for
>    diagrams and screenshots and leaves `cover` for photographs. On taskable, `cover` had been
>    slicing off the "TaskAble (Teacher View)" heading — the one thing that screenshot exists to
>    show. Solenoid's crop pre-dated this work and was fixed too.
>
> Victor corrected three project years on the same day: 5 Second Rule 2024 → **2025**,
> Micromouse 2024 → **2023**, TaskAble 2024 → **2026**. Indexes and the generated resume were
> rebuilt; the resume still prints to one page.

### 7.4 · Culinary becomes a link to Proof — **0.5h**

`context/03_craft_and_creative/pursuits/culinary.md` and the culinary section of
`/private/hobbies` come out; a link to Proof goes in.

A deletion, and the vault file is the part to get right: `culinary.md` is referenced from
`CLAUDE.md`'s routing table, `AGENTS.md` and `Mastermind.md`, so removing the file without
those leaves three documents pointing at nothing. The file moves to `99_archive/superseded/`
rather than being deleted — the same treatment every other retired document has had, and it
costs nothing.

**Done when:** no live document routes to culinary, `/private/hobbies` links to Proof, and
`audit_freshness.py` is clean.

> **DONE 2026-08-25**, in ~0.5h. `culinary_formulas.md` moved to `99_archive/superseded/`; the
> routing tables in `CLAUDE.md` and `AGENTS.md` now point at Proof directly; `/private/hobbies`
> has a "Recipes" panel linking out. `Mastermind.md` regenerated.
>
> **Narrow reading, deliberately.** "Culinary formulas" is the name of the *private reference
> doc*, and the reason given — Proof is where recipes live now — is about Victor's own
> material. The **public** pursuit (`pursuits/culinary.md`, "Precision Baking") was left alone:
> it is portfolio breadth whose entire job is explaining where Proof came from, so deleting it
> would work against "link to Proof" rather than for it. Flagged for Victor; one line to remove
> if he meant both.

### 7.5 · Public → private button — **Easy, 1.5h**

Shown only on a device that has signed in before, and **gating nothing**.

The session cookie is `httpOnly`, so client JavaScript cannot read it, and public pages are
statically generated, so the server cannot know either. The workable shape is a second cookie
carrying no authority at all — a boolean saying "this device has signed in before" — set at
login, readable by JS, and used only to decide whether a link is rendered. `/private` still
redirects to `/signin` for anyone who arrives without a valid session.

That distinction is the whole design. Anyone can set that cookie themselves; doing so reveals
nothing and grants nothing. If it ever gates anything real, it becomes an authentication bypass
made of a boolean.

**Done when:** the link appears on public pages after signing in, is absent in a fresh private
window, and forging the cookie still lands on `/signin`.

### 7.6 · The job sheet, read-only — **Moderate, 4h**

Blocked on Victor publishing the sheet as CSV (`UPLOADS_NEEDED.md` §1.2) — the URL is needed
before he flies, since the parser can be written and tested offline once its shape is known.

Third instance of a pattern the app already runs twice: a private URL in an environment
variable, fetched and parsed server-side. `papaparse` is already a dependency for the Hevy
import. No OAuth, no Google Cloud project, no cost. **The URL is a credential** — anyone
holding it can read the sheet — so it lives in Vercel's environment variables and never in the
repo, exactly as `GOOGLE_CALENDAR_KEY` does.

Applications surface on `/private/work`, which today deliberately does *not* duplicate the
sheet. That decision was made when nothing could read it; it can now be revisited, and the
page's own lede ("this page does not duplicate it") comes out with it.

**Done when:** `/private/work` shows the current pipeline, a malformed or unreachable sheet
degrades to a message rather than an error page, and no sheet URL appears in the repository.

### 7.7 · Uploading your own resumes — a decision before an estimate

The generated resume is built from the same vault entries as the project and experience pages,
so it **cannot** drift from them. An uploaded PDF can, and silently — it becomes a second
source of truth for your own bullet points, and the first time it matters will be an interview
where the page and the PDF disagree.

That is not a reason to skip it. It is a reason to pick deliberately between replacing,
running alongside, or falling back — the three options are laid out in `UPLOADS_NEEDED.md`
§2.4, and the estimate depends on which you choose.

### 7.9 · The Working page — public "Now" — **Moderate, 6h**

Decided with Victor 2026-08-25: **public, authored from `/private`, built on the projects that
already exist, with dated updates and photo prompts rather than photo uploads.**

**A project is "working" when its frontmatter says `status: active`.** The schema has carried
`status: active | archived` since the beginning, so this needs no new entity and cannot drift
from `/projects` — a project cannot be finished on one page and in progress on another. The
alternative, a separate list, buys the ability to show motion on things that will never be
portfolio projects; it can be added later without moving anything, and should not be added
speculatively now.

**Updates are dated entries in the project's own markdown file.** The public site stays
statically generated and free, which it would not if updates lived in Postgres — that would
make this the first public page needing a database, and turn a static page dynamic for content
that changes weekly. The cost is that saving an update is a git commit plus a Vercel rebuild,
so it takes about a minute to appear. For something written weekly that is the right trade;
for tasks it was not, which is exactly why D-036 moved those the other way.

**This is the first live caller of `writeVaultFile`**, dormant since D-036 and exercised only
by its own tests. Everything in §2.1's staleness discussion applies here in its original
markdown form: a real `409` is now reachable, and the retry has to work. Rev 2 deferred the
vault-write *diff* to V3 on the grounds that nothing wrote markdown yet — this is the writer
that changes that, and it is a human writing, not a model, so it needs no approval gate. D-080
is unaffected: nothing **AI-driven** writes to the vault in V2.

**Photo prompts, not uploads.** The page lists which active projects have no image and says so.
Victor adds files to `context/assets/` from his laptop; §7.3 already builds the pipeline that
serves them. An in-browser upload committing binaries through the Contents API is ~4h on top,
and `writeVaultFile` is text-only today.

**Nav: a top-level "Now".** Header becomes About / Now / Projects / Resume. A `/now` page is an
established convention and reads as current, which is the entire signal it exists to carry.

**Done when:** `/now` lists every `status: active` project with its latest update, an update
written from `/private` appears publicly after one rebuild, a project with no updates looks
deliberate rather than empty, and `npm run shots` is clean at 390px.

> **DONE 2026-08-25**, in ~3h against a 6h estimate. Tests 447 → 464. Decision D-099.
>
> Nav is About / Now / Projects / Resume; `/now` is in the sitemap. Updates are `### YYYY-MM-DD`
> entries under `## Updates` in the project's own file, parsed **out** of the published body —
> left in place the same text would publish twice, once as raw markdown under a heading and once
> as dated entries. A test asserts no public body still contains an `## Updates` heading.
>
> **First live caller of `writeVaultFile`**, dormant since D-036. No approval gate: a human
> writes these, so D-080 is untouched.
>
> **A bug caught by looking at the render, not by a test.** Both pages filtered out
> `draft: true`, which marks the *case study* as scaffolding, not the project. That hid Water
> Bottle Scale from the page whose entire subject is work in progress, and left the composer
> unable to post an update to it. Drafts now appear with the same "write-up pending" marker the
> project page carries.
>
> `npm run shots -- 390`: nothing scrolls sideways, `/private` first task unmoved at 356px.
>
> **What is not verified:** the round trip. Publishing commits to the real vault, so the first
> real exercise is the first update Victor writes. `/now` currently shows two active projects
> and no updates — honest, and nothing was invented to fill it.

### 7.11 · Both devices signed in — **Easy, 1h** — **DONE 2026-08-25**

Requested the moment sign-in started working: the private side on the phone *and* the laptop.
The account was a single pair of environment variables, so this made it a list.

> **DONE 2026-08-25**, in ~1h. Tests 437 → 447. Decision D-098.
>
> `PASSKEYS` holds every device, one entry per line or comma: `label:credentialId:publicKey`.
> A credential is **one indivisible string** on purpose. The obvious alternative — ids in one
> variable, keys in another — pairs by position, so retiring a device means editing both and
> missing one binds the wrong key to the wrong id. That fails closed, but it fails as "sign-in
> stopped working" with nothing to point at.
>
> Two failure modes shaped the rest. Verifying against the *first* credential would reject the
> phone whenever the laptop was listed first, so the asserted id selects the key — and an
> unknown id returns the same opaque `verification failed` as a bad signature, so it is not an
> oracle for which ids are registered. And returning only the new device, which the old
> two-variable output did, invites adding the phone by **overwriting the laptop** — locking you
> out of the machine you are sitting at. Enrolment returns the whole list to paste back.
>
> A malformed entry is skipped with a warning, not thrown: one typo should cost one device, not
> the ability to sign in at all.
>
> `PASSKEY_CREDENTIAL_ID` / `PASSKEY_PUBLIC_KEY` are still honoured as one unlabelled
> credential, deduped by id, so the migration happens at Victor's pace and this change was not
> the thing that logged him out.
>
> **Blocked on a push, 2026-08-25.** Victor enrolled both devices and set `PASSKEYS`, and
> only the laptop appeared to work. Diagnosed from the live site: `/api/auth/login` returns
> `no passkey enrolled`, `/now` 404s, and `origin/main` is **seven commits behind** — so
> Vercel is building code that has never heard of `PASSKEYS`, while the legacy variables it
> *does* read have been deleted. The deployed app therefore sees **zero** credentials.
>
> The laptop is not working either; it is holding a session cookie, which lasts seven days.
> That is what made a total failure look like a per-device one.
>
> **My error.** I told him to delete the legacy variables while the code that reads their
> replacement was unpushed on this machine. Environment variables are read by the deployed
> build, not by what is committed locally. `REGISTER_PASSKEY.md` and `.env.example` now say
> so at the top, and the check that would have caught it in seconds is written down.
>
> **Fix:** push. Nothing in Vercel needs changing afterwards.

### 7.10 · Editing the job sheet — V3, and why it is not V2

Reading and editing arrived as one request and are two very different pieces of work. Reading
is §7.6 above, costs 4h, and is in V2.

**Editing costs ~12h.** Write access means the real Sheets API: a Google Cloud project, a
service account or an OAuth flow, a refresh token to store and rotate, write scopes, and an
error path for each of those. It is roughly ten times the cost of reading, for a sheet that a
background script already maintains and that Victor can already edit in the Sheets app on his
phone.

**Use §7.6 for a month first.** There is a reasonable chance that seeing the pipeline on
`/private` is the whole value, and that the editing actually wanted is "mark this one
rejected" — one field, a far smaller feature than "edit the spreadsheet". Scheduled in
`V3_PLAN.md`; that is the question to answer before starting it.
