# 2ndMind — V3

**Written 2026-08-25 · Starts when V2 ships · No deadline**

V2 has one: 2026-09-18, the code deadline before term. **V3 deliberately has none.** From
2026-09-20 the budget is roughly **4h/week**, not 4h/day — a tenth of the rate this project has
run at — and a dated plan against that budget would be fiction. What follows is ordered, sized,
and picked up when there is time.

`V2_PLAN.md` is the live document until V2 ships. Nothing here starts before it does.

---

## 0. The shape of the time

| Window | Rate | What that means |
|---|---|---|
| 2026-09-20 onward | ~4h/**week** | 46h of work is ~12 weeks of term-time evenings |

Two consequences worth stating before the list:

1. **Sequence matters more than estimates.** At 4h/week an item's cost is measured in weeks, so
   finishing one thing beats starting three.
2. **Every item must survive a two-week gap.** Term, midterms and racing will interrupt this.
   Anything that cannot be put down mid-way and picked up from `DECISIONS.md` is the wrong
   shape for V3.

---

## 1. Scheduled — Victor picked these on 2026-08-25

Ordered by value per hour, not by size.

### 1.1 · Upload your own resumes — **5h**

**Blocked on a decision, not on code.** `UPLOADS_NEEDED.md` §2.4 has it: does an uploaded PDF
*replace* the generated resume, run *alongside* it, or act as a *fallback* where no upload
exists?

The reason it needs deciding rather than defaulting: the generated resume is built from the
same vault entries as the project and experience pages, so it **cannot** drift from them. A PDF
can, silently — it becomes a second source of truth for the same bullet points, and the first
time that matters is an interview where the page and the PDF disagree. Fallback is the safe
default; replace is the honest one if Victor stops maintaining the generator.

Storage is the easy half: a PDF in `context/assets/resumes/`, served the way §7.3 of V2 serves
images. Nothing here needs a database.

**Done when:** an uploaded PDF is downloadable from the public site, the chosen relationship to
the generated resume is implemented and tested, and `/resume` still resolves for someone who
guesses the URL.

### 1.2 · Filament and printer tracking — **9h**

**Blocked on Victor's inventory** — the template is in `UPLOADS_NEEDED.md` §2.1 and §2.2.

Three things, of which only the first is really new:

- **Filament inventory.** Material, brand, colour name, **colour hex**, amount remaining.
  Postgres, alongside the other mutable rows — an amount that decreases every print is exactly
  what markdown handles badly, which is the standing rule in `web/context.md`.
- **Colour swatches.** The hex is what makes this page worth building. A swatch reads
  instantly; a colour name does not, and "PLA — Galaxy Black" tells you nothing about whether
  it matches the spool you used last week.
- **Printer status.** Small, and the vocabulary is Victor's rather than invented — he was asked
  for the states he actually uses rather than being given a taxonomy to translate in his head.

The open design question, and it decides the layout: **is this "which printer is free right
now" or "what do I need to reorder"?** They are different pages. The question is in
`UPLOADS_NEEDED.md` §2.2 and should be answered before any of this is built.

**Done when:** the inventory is editable from `/private`, swatches render, and the page answers
whichever of those two questions Victor named.

### 1.3 · Edit the job sheet from the Jobs tab — **12h**

**Do not start this until §7.6 of V2 has been used for a month.**

Reading the sheet ships in V2 for 4h, using the published-CSV pattern the calendar feeds
already use. Editing costs roughly ten times that: a Google Cloud project, a service account or
OAuth flow, a refresh token to store and rotate, write scopes, and an error path for each.

The question to answer first is not technical. It is whether, having watched the pipeline on
`/private` for a month, the editing actually wanted turns out to be **"mark this one
rejected"** — one field on one row, which is a far smaller feature than "edit the spreadsheet",
and possibly a 3h one. A background script already maintains the sheet, and the Sheets app is
already on Victor's phone.

**Done when:** whichever of those two things is genuinely wanted works, and the credential
handling is documented the way the calendar feeds are.

---

## 2. Recorded, not scheduled

Real, and none of them picked for V3. They are here so that "we decided not to" stays
distinguishable from "we forgot".

| Item | Est. | Why it is not scheduled |
|---|---:|---|
| **Semantic search** | 12h | Cut from V2 twice — on cost in rev 1, on time in rev 4. Vectors in Postgres, embed only files whose `updated:` changed, hard token ceiling per run. Health data may reach the model (D-071) but any search surface is private-only, with a test asserting no public route imports it. |
| **Per-session revocation** | ~4h | A V1 finding. Sessions are HMAC tokens with an expiry; rotating `SESSION_SECRET` is the only revocation and it signs out every device. **Victor did not pick this for V3** — recorded, still open. |
| **Error aggregation** | ~4h | A V1 finding. `app/error.tsx` is a boundary and logs to Vercel; what is missing is *aggregation*, and a failure nobody sees is still invisible. A free Sentry tier would close it, but payloads carry vault content and need scrubbing rules first. **Not picked** — see the note below. |
| **Vault-write markdown diff** | 8h | Deferred from V2 rev 2 because nothing wrote markdown. V2 §7.9 changes that, so this becomes buildable — behind a real writer rather than ahead of one. Needed only when a *model* proposes markdown; a human writing needs no gate. |
| **In-browser photo upload** | 4h | V2 §7.9 ships photo *prompts*. Uploading from a phone means committing binaries through the Contents API, and `writeVaultFile` is text-only. Worth it only if the prompts prove annoying in practice. |
| **A separate "current work" list** | 3h | V2 §7.9 uses `status: active` vault projects. A separate list would allow showing motion on work that will never be a portfolio project — coursework, this vault, one-off experiments. Additive; nothing has to move to add it later. |
| **Octokit retry/throttle** | 2h | Pointless for one user until something writes to the vault regularly. V2 §7.9 is the first such writer, so revisit once it has run for a while. |
| **Vault write concurrency queue** | — | The `409` is optimistic concurrency working correctly. Over-engineering for one user. |

**On error aggregation.** It was not picked, and that is Victor's call, but it is the one item
on this list whose absence hides other items' failures. `gemini-2.5-flash` was retired and every
AI call 404'd silently for an unknown length of time (D-085); it was found by reading a dev
server log by chance while screenshotting an unrelated page. That is precisely the class of
failure aggregation exists to catch, and it will happen again.

---

## 3. Ordered summary

| # | Item | Est. | Blocked on |
|---|---|---:|---|
| 1.1 | Upload your own resumes | 5h | A decision — `UPLOADS_NEEDED.md` §2.4 |
| 1.2 | Filament and printer tracking | 9h | Victor's inventory — `UPLOADS_NEEDED.md` §2.1–2.2 |
| 1.3 | Edit the job sheet | 12h | A month of using V2 §7.6 first |
| | **Scheduled total** | **26h** | ~7 weeks at 4h/week |
| | Recorded, unscheduled | ~37h | |

**Order.** §1.1 first: it is the smallest, it is career-facing, and it is blocked only on a
decision Victor can make in a minute. §1.2 second, because it is blocked on data he will have
written on the plane. §1.3 last, and deliberately gated on evidence rather than on a date.

---

## 4. Rules carried forward from V2

Unchanged, and restated because they are what an agent gets wrong.

- **Never invent a fact about Victor's work.** Unknown → a `> **To write:**` prompt, stripped
  from public output. D-069 is what the alternative looked like.
- **Health data may go to the model** (D-071) but **may never be published**. Absolute, and
  the two are different acts.
- **Nothing writes to the vault on a model's say-so.** V2 §7.9 makes `writeVaultFile` live for
  the first time, which raises the stakes on this rather than relaxing it.
- **Add a `DECISIONS.md` entry** for every non-obvious choice, with how to reverse it.
- **`npm run shots`, `npm test`, `npm run typecheck`** before calling anything done. All three
  gate on exit code. The layout sweep now covers the private pages and the printed resume.
- **Measure, do not assume.** Every estimate in this project that was checked turned out to be
  wrong in a way that mattered — 1.33 pages, 791px, a retired model — and each was found by
  measuring something nobody had measured before.
