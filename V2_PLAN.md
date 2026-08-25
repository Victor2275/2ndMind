# 2ndMind — V2 Completion Plan

**Written 2026-08-24 · Deadline 2026-09-18 · Scope decided by Victor on 2026-08-24**

The forward plan. `MIGRATION_PLAN.md` is its predecessor and is finished — that document is
history, this one is live.

---

## 0. The shape of the time

This is the constraint everything else answers to.

| Window | Days | Hours | Notes |
|---|---:|---:|---|
| **Now → Taiwan** | 2026-08-24 → 08-28 | **~20h** | 5 days × 4h |
| Taiwan | 08-29 → 09-07 | **0h** | Assumed zero work |
| **Back → deadline** | 09-08 → 09-18 | **~44h** | 11 days × 4h |
| Move-in | 09-19 | 0h | |
| Term starts | 09-20 | ~4h/**week** | Everything after this is a different budget |

**Total before the deadline: ~64 hours.** Planned work below totals **43h**, which leaves
**21h of slack — a third of the budget**. That margin is deliberate: every estimate in this project so
far has been beaten or missed by more than 10%, and the ten-day gap in the middle is where
context gets lost and re-acquired.

### What "V2 done" means

**Features only.** The two remaining V1 findings — per-session revocation and error
aggregation — move to V3. They are real, but neither blocks daily use, and both are the kind of
work that expands once started.

### Difficulty scale

| | Meaning |
|---|---|
| **Easy** | Understood end to end. The only risk is typing it. |
| **Moderate** | One unknown, or a decision to make while building. Estimate is reliable ±25%. |
| **Hard** | Genuine unknowns, or it touches something with a history of biting. Estimate could be off by 2×. |
| **Victor** | Not code. Blocked on Victor and cannot be done by an agent. |

---

## 1. Do first — this week, before Taiwan (~20h)

The ordering principle: **anything blocked on Victor goes first**, because a ten-day gap turns a
five-minute task into a two-week delay. Then the work with external stakes.

### 1.1 · Unblock the repository — **Victor, 10 min** — 🔴 BLOCKING

`git push` has failed on every attempt since 2026-08-23 with `remote: Repository not found`.
Five commits are stacked locally:

```
78f8ff1  mobile weight loss, case-study skeleton
c8ae3fa  resume fits one page, local browser
461d51e  plan update after external review
d1f8557  fabricated portfolio content corrected
4fe26eb  handoff document
```

The token has expired or been revoked. Until this is fixed nothing reaches production, nothing
is backed up, and **the corrected water bottle scale entry is still live on the public site in
its fabricated form**. That last point is why this is first.

**Done when:** `git push` succeeds and `victorgusev.vercel.app/projects/water-bottle-scale`
shows the Arduino Uno version with no HX711 or MQTT claims.

### 1.2 · Vercel configuration — **Victor, 20 min**

Four items, all independent:

1. **Enrol a passkey on the production origin.** A passkey is bound to the origin it was
   created on; the existing one is bound to `localhost`, so the live private site is
   unreachable. See `web/REGISTER_PASSKEY.md`.
2. **Set `GOOGLE_CALENDAR_KEY` and `CANVAS_CALENDAR`.** They exist only in `.env.local`, so the
   production calendar shows "No calendar feeds connected". *These URLs are credentials.*
3. **Confirm `DATABASE_URL` matches the local Neon database.** Migration `0003` was applied
   locally; if production points elsewhere, `/private/athletics` errors there.
4. **Set `GEMINI_API_KEY`** — without it the AI summary is inert, and §2 has nothing to test
   against.

**Done when:** signing in on the live site works, and `/private/calendar` and
`/private/athletics` render there.

### 1.3 · Resume: close the last 30px — **Easy, 1h**

SWE prints at **1.03 pages**; ML at 0.98 and Robotics at 0.90 already fit. The overflow is one
bullet line. Recommended fix: trim the coursework line from six courses to four — it wraps to
two lines and is the lowest-signal content on the page.

Not more type-shrinking. 9.6pt bullets are already at the floor of what reads as confident.

**Done when:** `node scripts/shots.mjs` reports every variant under 1.00 pages.

### 1.4 · Case-study page design — **Moderate, 4h**

The four sections now exist in every project file and unwritten ones correctly render as
nothing. What does *not* exist is a design that makes a filled-in case study read well: right
now `## The problem` and `## Measured results` are styled identically to any other heading.

Specifically:
- Give **Measured results** visual weight — numbers are the payload, and they should be
  scannable without reading the prose.
- Give **What did not work** a distinct treatment. It is the rarest and most convincing section
  on any student portfolio and should not look like filler.
- Make the four-section rhythm obvious on a phone, where they arrive one at a time.
- A project with *some* sections filled must not look broken beside one with all four.

Build it against `solenoid-bit-reader`, the only project with real content in more than one
section.

**Difficulty note:** moderate rather than easy because it is a judgement call, and because
`npm run shots` can tell you it does not overflow but not whether it looks good.

**Done when:** solenoid-bit-reader reads as a case study at 390px and 1280px, and a
one-section project still looks deliberate.

### 1.5 · Write the case studies — **Victor, 2–4h of typing**

The prompts are waiting in each project file under `> **To write:**`. Nothing publishes until
prose replaces them, and **no agent will fill these in** — that is the whole point of the
convention, and the water bottle scale (D-069) is what happens when one tries.

Suggested order, strongest first:

| Project | What is missing | Why this order |
|---|---|---|
| **Solenoid Bit Reader** | Only "what did not work" | Already has the problem, design decisions and a real number (100% decoding accuracy, 40mm resolution limit). One section from complete. |
| **Proof** | Problem, what failed, results | Your largest software build and the most relevant to SWE roles. |
| **Water Bottle Scale** | All four | Also unlocks `draft: false` and a resume slot — it is off both today. |
| **TaskAble** | Problem, what failed, results | Hackathon context is already there. |
| **Micromouse** | Problem, what failed, results | Lowest stakes. |

**Do this on the plane.** It is the only item here that needs no computer beyond a text editor
and no network.

### 1.6 · Feature 3 · close out "Today" — **Easy, 2h**

Everything is built — tasks, goals, stats, schedule. What has never happened is someone sitting
down and asking whether `/private` answers *"what do I do now"* in one screen without scrolling.

That review **is** the feature. Expect the outcome to be reordering and deleting, not building.

**Done when:** the top of `/private` at 390px answers that question, and you have used it for
one real day without wanting to scroll for the answer.

---

## 2. Feature 6 · AI — after Taiwan (36h, or 24h with §2.5 cut)

All four capabilities were approved. Built in this order, because each one makes the next
cheaper, and because the cut line falls naturally at the end.

**Budget note.** ~$10 of credits, total, for the life of this. Flash is cheap and the daily
summary is already cached on its prompt (D-067), but embeddings in §2.5 are the one item that
could actually consume it. Every step below must be cached; none may call the model on render.

### 2.1 · Summarise my week — **Easy, 3h**

The daily summary already exists, is cached, and reads the live `log_entries`. A weekly version
is the same shape over a seven-day window with a different prompt.

**Why first:** it reuses everything and proves the caching story at a second call site before
anything harder depends on it.

**Done when:** `/private` shows a weekly summary that costs one model call per week of unchanged
data, verified by watching the cache rather than by trusting it.

### 2.2 · The approval-gated write UI — **Hard, 10h** ⚠️ the centrepiece

This is the constraint you set and it has no implementation: *nothing writes to the vault on a
model's say-so.* Every AI write must be shown as a diff and explicitly approved.

What it needs:

1. **A diff view.** Old and new markdown, changes marked. Must be readable on a phone, since
   that is where approvals will actually happen.
2. **Approve / reject / edit-then-approve.** Rejecting must leave the vault untouched.
3. **The write path itself**, which is currently *dormant* — `writeVaultFile` exists and is
   tested but has no caller anywhere in the app since D-036 moved everything to Postgres. This
   will be its first live user.
4. **Concurrency.** A stale SHA produces a `409`. Today that surfaces as a raw error; with a
   human approving a diff minutes after it was generated, the window is wide enough to hit.
   Retry once against fresh content, and re-show the diff if the file moved underneath.

**Why hard:** three of these four are new, and item 3 means the first real exercise of a code
path that has never run in production.

**Done when:** a proposed change can be approved from a phone, appears as a commit, and a
rejected one leaves no trace.

### 2.3 · Draft sprint goals — **Moderate, 5h**

Reads the week's tasks, logs and calendar; proposes next week's goals; routes them through
§2.2. Depends entirely on the approval UI, which is why that is built first.

**Done when:** it proposes goals you would plausibly have written, and you have approved one
real set.

### 2.4 · Resume tailoring — **Moderate, 6h**

Paste a job description; get suggestions about which bullets to emphasise and which variant to
send. **Writes nothing** — output is advice, so it needs no approval gate.

Keep it honest: it may suggest *reordering and selecting* from bullets that exist. It may never
propose new claims. Given D-069, that guardrail should be enforced in the prompt *and* checked
in code against the actual bullet list.

**Done when:** it produces a suggestion for a real job posting, and a test proves it cannot
introduce a bullet that is not in the vault.

### 2.5 · Semantic search — **Hard, 12h** ✂️ **first to cut**

Natural-language questions across the vault. Needs embeddings, somewhere to store them, and
incremental re-embedding so that editing one file does not re-embed all twenty-four.

**This is the agreed cut.** Highest cost, and by your own assessment the lowest frequency of
use. If §2.2 runs long — and it is the most likely to — this is what goes.

If it survives: store vectors in Postgres, embed only files whose `updated:` changed, and put a
hard ceiling on tokens per re-index run.

---

## 3. Not in V2 — deferred to V3

Recorded so they are not silently forgotten.

| Item | Why deferred |
|---|---|
| **Per-session revocation** | Sessions are HMAC tokens with an expiry; rotating `SESSION_SECRET` is the only revocation and it signs out every device. Real, but it does not block daily use. |
| **Error aggregation** | `app/error.tsx` gives a boundary and logs to Vercel. What is missing is *aggregation* — a failure you never see is still invisible. A free Sentry tier would close it, but payloads carry vault content and need scrubbing rules first. |
| **Octokit retry/throttle** | Reasonable, cheap, and pointless for one user until something writes to the vault regularly. Revisit after §2.2 ships. |
| **Vault write concurrency queue** | The `409` is optimistic concurrency working correctly. §2.2 adds a retry; a full queue is over-engineering for one user. |

---

## 4. Ordered summary

| # | Item | Who | Difficulty | Est. | Blocks |
|---|---|---|---|---:|---|
| 1.1 | Fix `git push` | Victor | — | 10m | **everything** |
| 1.2 | Vercel config ×4 | Victor | — | 20m | §2 testing |
| 1.3 | Resume last 30px | me | Easy | 1h | — |
| 1.4 | Case-study page design | me | Moderate | 4h | — |
| 1.5 | Write the case studies | Victor | — | 2–4h | 1.4 to look right |
| 1.6 | Close out feature 3 | me | Easy | 2h | — |
| 2.1 | Summarise my week | me | Easy | 3h | 1.2 |
| 2.2 | Approval-gated write UI | me | **Hard** | 10h | 2.3 |
| 2.3 | Draft sprint goals | me | Moderate | 5h | 2.2 |
| 2.4 | Resume tailoring | me | Moderate | 6h | — |
| 2.5 | Semantic search | me | **Hard** | 12h | ✂️ cut first |

**My work: ~43h against ~64h available.** Cutting §2.5 brings it to ~31h.

---

## 5. What could go wrong

Ordered by how likely they are to actually happen.

1. **The push stays broken.** Everything downstream is unverifiable in production and the
   fabricated project entry stays live. This is why it is item 1.1.
2. **§2.2 runs to 15h instead of 10.** It is the hardest item and the first live use of a
   dormant code path. Mitigation: §2.5 is the declared cut.
3. **The case studies do not get written.** Then §1.4 designs an empty page, and the portfolio
   gains structure without substance. Mitigation: they are plane work, needing no network.
4. **The ten-day gap loses context.** Mitigation: `web/DECISIONS.md` (75 entries) and this file.
   Regenerate `Mastermind.md` before travelling if another AI will be used.
5. **The $10 runs out on embeddings.** Only §2.5 can plausibly do this, and §2.5 is the cut.

---

## 6. Standing rules for this work

Not new — restated because they are what an agent gets wrong.

- **Never invent a fact about Victor's work.** Unknown → a `> **To write:**` prompt, which is
  stripped from public output. See D-069 for what the alternative looked like.
- **Health data may go to the model** (D-071) but **may never be published** (unchanged,
  absolute). These are different acts.
- **Add a `DECISIONS.md` entry** for every non-obvious choice, with how to reverse it.
- **`npm run shots`** before calling any visual work done. It found every mobile defect fixed so
  far; none was visible to a text-only check.
- **Measure, do not assume.** "The resume looks fine" survived weeks; "1.33 pages" did not
  survive ten minutes.
