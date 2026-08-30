---
updated: 2026-08-29
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

## 2026-08-29 · Offline review round

Victor reviewed a frozen snapshot of the site offline, wrote the case studies, and came back
with a list of changes. These are the decisions that came out of it, answered question by
question before any of it was built.

### D-106 · The site freezes to standalone HTML for offline review

**Decision.** `npm run freeze` (`web/scripts/freeze.mjs`) captures every public route — and,
with a session cookie in `FREEZE_COOKIE`, every private one — into `.frozen/`: one
self-contained HTML file per page, stylesheets and fonts and images inlined as data URIs,
every `<script>` stripped, internal links rewritten to the sibling file so clicking through
works from `file://`.

**Why.** The public site already runs offline under `npm run dev` — that is what self-hosted
fonts bought (D-002). The private side does not: `/private/*` redirects to sign-in, athletics
needs Neon, and several pages read editable files through the GitHub Contents API. A snapshot
sidesteps all three without building an offline mode nobody asked for.

**Why JavaScript is stripped rather than kept.** A frozen page that still tries to hydrate
reaches for chunks that are not there and fails visibly. Stripping it makes the page inert and
faithful. The cost is that buttons and forms do nothing, which is correct for a document whose
purpose is being looked at and annotated.

**How to reverse.** Delete `web/scripts/freeze.mjs`, the `freeze` script in `package.json`,
and the `.frozen/` line in `web/.gitignore`.

### D-107 · Tiers are gone; projects carry an explicit `order`

**Decision.** `tier` is removed from the project schema and replaced with `order`, an integer
ascending. `/projects` renders in that order and its lede is deleted. New projects append by
taking the next number. `project_catalog.md` becomes one table with a `#` column.

**Why.** Two reasons, and only the second is about ordering. Tier published a ranking of his
own work to hiring managers — the lede explicitly said "Tier 1 are the builds worth reading
about in depth", which invites the reader to skip the rest. And the sequence Victor actually
wanted (Proof, Micromouse, 5 Second Rule, Solenoid, TaskAble) is not derivable from tier then
year under any tie-break, so the data had to hold the decision.

**Also changed.** The project card no longer renders tier-1 titles larger, and a test now
asserts every `order` is distinct — a duplicate would silently hand the decision back to the
year tie-break.

**How to reverse.** Restore `tier` in `schemas.ts`, `public.ts`, `load.ts` and
`build_indexes.py`; the old sort was `a.tier - b.tier || b.year - a.year`.

### D-108 · `archived` becomes `done`; Water Bottle Scale is deleted

**Decision.** The project `status` enum is `["active", "done"]`. `water-bottle-scale.md` is
deleted rather than archived.

**Why the rename.** "Archived" reads as shelved or abandoned. These projects are finished, and
the badge on every card said the wrong word about them.

**Why the deletion.** It is superseded, not finished: Smart Bottle is the same idea built
properly, and Victor's own assessment of the 10th-grade version was "pretty lackluster".
Keeping both would put two entries on the site for one idea, the weaker one first by year.

**How to reverse.** `git show HEAD:context/01_engineering/projects/water-bottle-scale.md`.
Note that its case-study sections were placeholder text at deletion.

### D-109 · An ongoing role says "Present" because the vault says it is ongoing

**Decision.** `experienceSchema` gains `ongoing: boolean`. The About page renders "Present"
when it is set, and the real `date_end` when it is not.

**Why this shape.** "Present" was hard-coded in the page once, outlived the fact behind it,
and told every reader that a finished internship was still running — so it was removed and
replaced with the vault's own `date_end`. Dimaag is now genuinely ongoing, so the fix is not
to un-remove the string but to make the claim data: `date_end` stays a real date that nothing
has to parse, and the flag decides what is shown.

**How to reverse.** Drop the field and render `dateEnd` unconditionally.

### D-110 · Tailor becomes a sub-tab of Work

**Decision.** `/private/tailor` moves to `/private/work/tailor`. The top-level nav loses
"Tailor"; a `WorkTabs` sub-nav appears under the Work page header.

**Why.** Victor asked for it, and the reason holds up: Tailor is used a handful of times a
term and sat beside pages opened daily, in a nav that had grown to nine items and stayed one
line only because it scrolls. It is career work and belongs with the career pages.

**How to reverse.** Move the directory back, restore the nav entry, delete `work-tabs.tsx`.
`scripts/shots.mjs` has the route too — it 404'd for one run after the move, which is how the
oversight was caught.

### D-111 · The inbox is a task row, not a notes table

**Decision.** "Jot down random things" is a `tasks` row with `source: "inbox"` — undated,
undomained, captured from a one-field box on Today. It nags on the **age of the oldest item**
(7 days), not on count.

**Why a task.** D-037 made everything actionable one model. The point of jotting something
down is that it will later become actionable, so triage should be an edit to the row it
already is, not a migration between two stores.

**Why age and not count.** Ten things captured this morning is a productive morning; one thing
untriaged for three weeks is the actual problem. A count cannot tell those apart. The list is
also sorted oldest-first, because an inbox sorted newest-first hides its own backlog.

**How to reverse.** Delete `inbox-panel.tsx`, `addInboxNote`, `listInbox`/`staleDays`, and the
Inbox panel on Today. Existing rows stay valid tasks; they would reappear in Backlog once the
`source !== "inbox"` filter goes.

### D-112 · Today has one Goals panel, and the Backlog stays shut

**Decision.** "This week's goals" and "Draft next week" merge into one **Goals** panel, with
drafting nested inside it as a closed `<details>`. Backlog is now closed by default regardless
of size.

**Why.** Victor's words: "it feels weird how there is a this week's goals and draft next
week's goals." As siblings they read as two competing lists of goals rather than one list and
the tool that proposes next week's. And his read of the page overall was that it is too dense,
which a nested disclosure and a closed backlog both answer. Drafting stays closed for the
original reason — each press is a real API call against a ~$10/month budget.

**How to reverse.** Split the panels back apart; the `ProposalReview` component is unchanged.

### D-113 · The DARS audit is parsed into a derived file, never read directly

**Decision.** `scripts/parse_dars.py` turns a saved DARS page into
`context/01_engineering/degree_audit.md`. The private Academics page reads only the derived
file. Raw `DARS*.html` is gitignored.

**Why.** The saved audit carries Victor's student ID, his high school, and every grade he has
ever received, in ~900 KB of page furniture. The site needs one thing from it: which
requirements are unfulfilled and what satisfies them. Deriving that once, locally, means the
identifiers are never in a file the app can read, rather than being present and trusted not to
be rendered.

**And it could not have worked otherwise.** `99_archive/` — where a transcript-shaped document
belongs — is deliberately excluded from the Next.js file trace (D-023). A page reading the raw
audit would work locally and 404 in production, which is the exact failure that exclusion
exists to document.

**One deliberate lossiness.** A GE subgroup's "SELECT FROM" is every qualifying course at
UCLA. Those lists are truncated to ~320 characters with a count of what was dropped; the audit
itself is the place to go for the rest.

**How to reverse.** Delete the script and the derived file, and restore the Academics
`Record` panel as the only vault document on the page.

### D-114 · Pursuits publish bullets only, and feed the tailor library

**Decision.** `facts` and `carryover` are removed from the public pursuit projection.
Pursuit bullets are added to the tailoring bullet library.

**Why removed rather than un-rendered.** Victor asked for the metrics and the italic
carry-over hidden. Public pages are statically generated, so a field left in the projection
ships inside the bundle whether or not anything renders it — and the facts here are erg
splits, which he moved to private in the same round. "Hidden" that still ships is not hidden.

**Why the library grew.** CAD, SolidWorks and 3D printing are real skills that live only in
`pursuits/fabrication.md`, which contributed nothing, so a posting asking for mechanical
design could not be answered with the one thing that answers it. What the model may *say* is
still bounded by the ids it is handed, so this widens the advice without loosening the
guardrail.

**How to reverse.** Restore the two fields to `PublicPursuit`, `PUBLIC_PURSUIT_KEYS` and
`toPublicPursuit`, and the markup on the About page; drop the pursuits loop in
`collectBullets`.

### D-115 · Resume entries may cap their own bullets per variant

**Decision.** `resume_bullets: { <variant>: <n> }` on a project or experience entry overrides
the global cap for that variant.

**Why.** An entry can be worth listing on a variant without being worth three lines on it.
Proof earns a place on the robotics resume for the engineering behind it; a robotics reader
does not need its Socket.io timers.

**Where it ended up.** Only Proof uses it: **2 bullets on robotics**, which was Victor's
instruction ("put Proof on it if it can fit, but with less bullets"), not a page-pressure fix.

An intermediate state is worth recording because it was wrong. MathCounts and Lifeguard were
briefly added to all three variants, which pushed every one onto a second page — caught by
`npm run shots`, not by looking (D-077) — and paid for with caps on Solenoid and TaskAble.
Victor then clarified that those two roles were supplied **as Tailor context, never as resume
content** (D-118). With them off, the variants print at 0.89–0.93 and both caps were removed
again. The lesson is the ordinary one: trimming good content to fit content that should not
have been there produces a worse document than asking.

**How to reverse.** Delete the field from the schemas and the two `??` fallbacks in
`resume.ts`; every entry returns to the global caps. Re-run `npm run shots` after.

### D-116 · The Dimaag paper is published as a placeholder, deliberately

**Decision.** `projects/dimaag-paper.md` exists, is `status: active` so it reaches `/now`, and
says almost nothing: no vehicle class, no algorithm, no architecture, no numbers.
`confidential_scope` in `experience/dimaag.md` is rewritten to name exactly what is and is not
shareable.

**Why.** Victor supplied a detailed technical brief and confirmed it is **internal until
cleared**. The vault's existing boundary covered PPO, Isaac Lab, LiDAR raycasting, sim-to-real
and tracking accuracy; the brief goes well past that and in places contradicts it. Writing any
of it into a public file would have published uncleared material and desynchronised the vault
from its own confidentiality note.

**What is now cleared and changed.** Tracking is **>10 mph**, not >12; the internship is
**ongoing**; the LLM-tooling bullet is cut at Victor's request; the **80% reduction in mean
tracking error** is cleared and is now the strongest claim on the resume.

**How to reverse when clearance lands.** Rewrite `confidential_scope` first, then the project
body, then the bullets — in that order, so the boundary is never behind the content.

### D-117 · Tailor answers posting questions, and never drafts the answer

**Decision.** `/private/work/tailor` gains a second panel: paste one written application
question, get the bullet ids to build the answer from, an angle, and a "do not claim" note.
There is deliberately **no draft field**.

**Why no draft.** A drafted answer is the model's prose submitted under Victor's name. The
resume side already refuses to write a bullet for exactly this reason (D-069 and the id
scheme above it), and an application answer is the same document class with a lower guard on
it. Once a draft box exists, it is the box that gets pasted.

**The failure mode specific to this half.** "Why do you want to work here" invites a model to
assert a motivation Victor never gave, in the first person, on an application. The prompt
forbids it explicitly and a test asserts the prompt still says so.

**Same parser discipline.** `points` are ids from the list handed over; an id it was not given
fails the whole response, for the same reason as the resume side — a fabricated reference is
evidence about everything else in it.

**How to reverse.** Delete `question-form.tsx`, `answerPostingQuestion`, and the
`answerQuestion`/`buildQuestionPrompt`/`parseQuestionResponse` trio in `lib/ai/tailor.ts`.

### D-118 · The Tailor library is vault-wide and ignores `resume_variants`

**Decision.** `collectBullets` reads `publicExperience()`, `publicProjects()` and
`publicPursuits()` directly, instead of unioning `buildResume()` across variants.

**Why.** `resume_variants` decides what gets **printed**; the library decides what the model
may **talk about**. Those are different questions, and building the library from the resume
made them the same one — so MathCounts and Lifeguard could not be both "reachable when a
posting asks about mentoring" and "off the printed page", which is exactly what Victor wanted.
Pursuits had the same problem from the other end: CAD and 3D printing are on no variant.

**What it does not loosen.** The guardrail is the id scheme, not the size of the list. A
wider library means better advice about material that already exists; it does not let the
model say anything it could not say before.

**How to reverse.** Rebuild `collectBullets` from `buildResume(variant)` over
`RESUME_VARIANTS`. Note that doing so silently drops every entry with `resume_variants: []`.

### D-119 · Public pages stop advertising an unfinished write-up

**Decision.** The "Write-up pending" badge on the project grid, the same marker on `/now`,
the banner on a project detail page, and "Active, no write-up yet." are all removed. The
`draft` field stays and still keeps an unwritten entry off every resume variant.

**Why.** Victor: it reads as unprofessional on a public-facing site, and he is right. The
badge was written as an honesty marker for a reader who could see the gap anyway; on a
portfolio it announces a gap to a stranger who had no way to know one existed, and it
captions the page's own emptiness. Honesty about scope is served by publishing only written
sections — `dropUnwritten` already does that — not by labelling the ones that are missing.

**How to reverse.** `git show` this commit for `project-grid.tsx`, `now/page.tsx` and
`projects/[slug]/page.tsx`; the `draft` flag they keyed on is untouched.

### D-120 · The resume variant row is fixed and complete

**Decision.** `/resume/[variant]` renders all three variants in `RESUME_VARIANTS` order —
Robotics, Machine Learning, Software Engineering — with the current one marked
`aria-current` rather than omitted.

**Why.** It previously rendered only the *other* two, so the row re-ordered itself on every
switch and the control moved out from under the cursor mid-click. A tab strip that changes
its own contents is not a tab strip.

**How to reverse.** Restore the `others` filter.

### D-121 · Experience carries an explicit `order`, like projects

**Decision.** `experienceSchema` gains `order`. The About page renders Dimaag, FIRST
Robotics, MathCounts, Lifeguard.

**Why.** Sorting on `date_start` alone put a seasonal lifeguard job (2022) above the FIRST
Robotics software lead (2021-08). Chronologically correct; wrong for a page a hiring manager
reads top-down. Same reasoning as D-107, and a test now asserts the specific inversion that
prompted it.

**How to reverse.** Drop the field and sort on `date_start` descending.

### D-122 · The repo root holds only what belongs at a repo root

**Decision.** Plans move to `docs/` (`V2_PLAN`, `V3_PLAN`, `MIGRATION_PLAN`,
`UPLOADS_NEEDED`, `REVIEW_ROUND_PLAN`), and downloaded source documents move to a gitignored
`private/`. An empty `assets/` is deleted, and `Proof.png` moves from `99_archive/` — where
nothing is served from — into `context/assets/`, which is what the build syncs.

**Why `private/` rather than name patterns alone.** The `DARS*.html` rule works only for
files named that way. A folder that is ignored wholesale is the version that survives the
next document being saved under a different name, and the patterns stay as a second line of
defence.

**Caught while doing it.** `README.md` requires `CLAUDE.md` and `AGENTS.md` to be identical
copies, and the previous round edited only `CLAUDE.md`. Re-synced with `cp`.

**How to reverse.** Move the files back and re-run the reference rewrite in the opposite
direction; every mention was updated in `current_sprint.md`, `DECISIONS.md`, the plans
themselves, and `README.md`.

### D-123 · Any Google Sheets link is accepted, and converted to a CSV endpoint

**Decision.** `normaliseSheetUrl` turns an ordinary `/edit#gid=…` link into
`/export?format=csv&gid=…`, fills in `output=csv` on a publish-to-web link that omitted it,
and passes anything already CSV-shaped — or non-Google — through untouched.

**Why.** The URL Victor will actually paste is the one in his address bar. That link serves an
HTML application behind a login, so the old requirement was "use Publish to web instead" —
correct, and useless, because the document id and the tab id are both sitting in the URL he
already has. Deriving the CSV endpoint is a dozen lines; making him re-navigate a share menu
to produce information the app could compute is a worse trade.

**What it deliberately does not do.** Grant access. The site fetches with no Google
credentials, so the sheet must be readable anonymously whichever URL form is used, and
`fetchSheet` already detects the login page Google returns and says so. That check is what
makes accepting the loose form safe: the failure is legible rather than silent.

**The tradeoff Victor has to make, and it is not symmetric.** Publish-to-web exposes *one
tab*; link-sharing exposes *the whole spreadsheet* to anyone holding the link. Both are
recorded in `docs/UPLOADS_NEEDED.md` §1.2 with publish-to-web recommended, because the
applications sheet is one tab of a document that may hold others.

**How to reverse.** Delete `normaliseSheetUrl` and have `jobSheetUrl` return the raw value.
Nine tests in `lib/jobs/__tests__/load.test.ts` cover the conversions.

---

## 2026-08-25 · Career tooling

### D-105 · The private link moves to the header, and becomes a lock icon on phones

**Decision.** The `/private` link moves from the footer into the header nav, last. Below `sm` it
renders a lock icon instead of the word; nav padding tightens below 380px. Behaviour is
unchanged — still shown to any browser that has signed in before, still gating nothing.

**Why it moved.** Victor asked for it in the header. D-102 had put it in the footer to avoid
crowding, which was a real constraint dodged rather than solved.

**What the first attempt got wrong, and how it was caught.** Placed first in the nav, the
measurements looked perfect — five items, zero overflow at every width. The screenshot showed
the header reading **"Private About Now Projects Resume"** with *Victor Gusev gone entirely*.
Nothing overflowed because the name is `min-w-0` and simply collapsed to zero. A nav that fits
is not the same as a header that works, and the check only knew about the nav.

Two fixes followed, and the order matters:

1. **The check now measures the name's rendered width**, failing below 40px. It is the only
   thing that would have caught this, and it was added before the layout was touched again.
2. **The link moved last.** Ahead of "About" it also sat where the site's identity belongs — the
   first thing on the portfolio read "Private".

**Why an icon on phones.** Measured: at 360px the four public items leave the name 59px, and the
word "Private" costs ~60px. The lock is ~24px including padding. With `px-1.5` below 380px the
name holds at 46px on a 360px screen and 56px at 390px — truncated, as it already was, but
present. `aria-label="Private"` on the link with `aria-hidden` on the icon means a screen reader
hears the same word at every width.

**Reversing it.** Move `<PrivateLink>` back to `site-footer.tsx` and drop the responsive padding.
The `home-returning-*.png` shots and the header check in `shots.mjs` are worth keeping either
way — they are the only thing that renders the signed-in header at all.

### D-104 · The tailoring model returns bullet ids, never bullet text

**Decision.** Resume tailoring supplies every bullet as `section:slug#index` with its text, and
the model may reply only with ids from that list. An id it was not given **fails the whole
response**. Free-text rationale is allowed and displayed as rationale. Bullet text on screen is
resolved from the vault by id; the model never supplies words that reach the page.

**Why ids and not prose.** Rev 1 of the plan promised "a test proves it cannot introduce a
bullet that is not in the vault". That is only enforceable if the model returns identifiers. If
it returns prose, the check is fuzzy string matching — and a model that helpfully rewrites
"Built a rechargeable scale" as "Engineered a precision instrument" passes any threshold loose
enough to be useful. That is D-069 walking back in through the one feature that touches a
hiring document.

**Why the whole response fails.** A fabricated id is evidence about everything else in that
response. Dropping just the bad id would hide exactly the failure the check exists to catch,
and would leave the surviving advice looking trustworthy. `deprioritise` is checked as
strictly as `emphasise` — advice to drop a bullet that does not exist is still a fabrication,
and a parser that only checked the first list would let it through.

**Bullets come from the union of all three variants,** not from one. *Which variant to send* is
one of the questions being asked; feeding it only the robotics bullets and then asking whether
robotics is right is a question with one possible answer.

**A posting under 80 characters is refused without a model call.** Given a job title alone the
model pattern-matches and recommends whatever sounds adjacent, confidently.

**Reversing it.** Delete `lib/ai/tailor.ts`, `app/private/tailor/` and the nav entry. Nothing
else depends on it — it writes nothing. Tests: `lib/ai/__tests__/tailor.test.ts`, including the
fabricated-id case the plan asked for by name.

### D-103 · `/private/work` reads the applications sheet, and still never writes to it

**Decision.** `/private/work` fetches the published CSV from `JOB_SHEET_CSV_URL`, parses it, and
shows live applications, a high-priority shortlist, and counts by status.

**Why this reverses the page's original refusal.** The page's lede used to say it deliberately
does not duplicate the sheet, because `internship_pipeline.md` asks assistants to leave that
data entry to the Gmail script. That reasoning was about a competing *writer*. Reading is not
duplicating: there is still exactly one source of truth and this is a view of it. Nothing here
writes, and the lede has been rewritten to say so rather than quietly dropped.

**The URL is a credential** — Google's publish-to-web link grants read access to whoever holds
it — so it lives in Vercel and never in the repo, the same treatment `GOOGLE_CALENDAR_KEY` gets.
Errors report status codes, never the URL.

**The export is 179 rows and 173 say "No Application".** Rendered whole it is a wall with the
six rows that matter invisible inside it, so the page shows live applications, the high-priority
rows not yet applied to, and counts. That fact came from parsing Victor's real export; a fixture
I invented would have had a tidy spread of statuses and taught me nothing.

**Headers are matched after stripping case and punctuation.** The sheet is edited by hand —
`Domain / Focus` carries spaces around the slash — and exact matching would turn a cosmetic edit
into an outage. A row with neither company nor role is counted as skipped rather than dropped
silently, so a drifting sheet shows as a visible number.

**A date that is not ISO is blanked, not guessed.** `08/13/2026` is ambiguous, and guessing
wrong misdates a row by up to eleven months with nothing looking wrong.

**Failures degrade to a message.** An unpublished sheet answers `200` with an HTML login page
rather than a `404`, so the body is sniffed for a leading `<`. As in D-086, the cache throws
rather than returns on failure, so a transient outage is not pinned to the page for the full TTL.

**Reversing it.** Unset `JOB_SHEET_CSV_URL` — the panel then explains itself and the rest of the
page is unaffected. Tests: `lib/jobs/__tests__/sheet.test.ts`, parsed against the real export in
`context/99_archive/`, which is a fixture and never a runtime fallback.

### D-102 · The public→private link is a hint with no authority, and a test keeps it that way

**Decision.** Login sets `2m_returning=1` — not `httpOnly`, a year long — and the public footer
renders a `/private` link when it is present. It gates nothing.

**Why a second cookie at all.** The session cookie is `httpOnly` and public pages are statically
generated, so neither the browser nor the server can tell who is asking. A value that decides
only whether a link is drawn is the workable shape.

**Why deliberately not `httpOnly`.** Making it unreadable would suggest it protects something.
Anyone can set it from the console; doing so yields a link and a redirect to `/signin`, because
`/private` calls `requireSession()` regardless.

**The test is a grep, not a unit test.** The hazard is not this module misbehaving — it is a
*new call site* somewhere else in the tree consulting the cookie to decide something real, at
which point it becomes an authentication bypass made of a boolean. So the test walks `src/` and
fails if anything outside an explicit allowlist mentions it. It caught its own test file within
a minute of being written, which is the correct behaviour.

**Cleared on explicit sign-out, not on session expiry.** Signing out on a borrowed machine
should not leave a "Victor signs in here" sign on the public site. An expired session is the
opposite case — that visitor wants the shortcut back to `/signin`.

**In the header nav** — *amended 2026-08-25, at Victor's request.* Originally the footer, on the
reasoning that a fifth item would crowd the bar. That reasoning was right about the constraint
and wrong about the conclusion: see D-105, which moves it and pays the layout cost properly.

**`useSyncExternalStore`, not `useState` + `useEffect`.** Its server snapshot is `false`, so the
prerendered HTML and first client render agree and there is no hydration mismatch — and setting
state from an effect is rejected by the React lint rule, correctly, since this reads an external
source.

**Reversing it.** Delete `lib/auth/returning.ts`, `components/site/private-link.tsx`, the footer
line and the two `store.set`/`store.delete` calls in the login route.

## 2026-08-25 · Proposals

### D-101 · The goal drafter parses the model's output, and drops what it cannot use

**Decision.** `draftSprintGoals` asks for JSON, extracts it by slicing between the first `{` and
the last `}`, parses it with Zod, then drops goals for unknown domains and duplicates within a
domain. A malformed response returns a written message; the raw text is logged, never shown.

**Why.** Model output is untrusted input. `as GoalDraft[]` would push a `{}` into the review UI,
where it renders as an empty row that approves an empty goal — and the fence-wrapping, the extra
sentence of preamble, and the two goals for one domain are all things models do routinely rather
than exceptionally.

Not showing the raw text matters separately: pasting model output into the UI as an app message
is how an injected string reaches the screen looking official. It goes to the server log.

**Uncached, unlike the summaries.** `gemini.ts` caches because `/private` is `force-dynamic` and
would re-summarise an unchanged day on every view. Drafting happens on a button press, and
serving a memoised draft would make pressing the button twice look broken. The panel is
collapsed by default so the button is not pressed out of habit — each press is a real call
against a ~$10/month budget.

**Reversing it.** Delete `lib/ai/goal-drafts.ts` and the `Draft next week` panel; the manual
`GoalsEditor` is untouched and remains the primary way goals are set.

### D-100 · Approval is a typed proposal, not a text diff, and rejection is expressed by absence

**Decision.** A proposal is a list of `{ key, label, before, after, note }`. The review UI ticks
items individually, values are editable before approving, and `applyApprovals` merges approvals
over current state. Nothing is stored between proposing and approving.

**Why not a markdown diff,** which rev 1 of the plan specified: sprint goals are rows in `tasks`
(D-037) and never touch the vault, so the 10h diff UI would have had no V2 caller at all. The
constraint worth building is "nothing writes on a model's say-so", and that is about structure,
not about text.

**Rejection is absence.** An unticked item is not sent, so its current value carries through
untouched. The alternative — sending every item with a decision flag — needs a branch that can
be got wrong; this cannot write a rejected item because it never sees one.

**An approved empty value is a deletion,** not a no-op. Proposing removal of a goal that no
longer makes sense is legitimate, and treating blank as "leave it" would make that unsayable.

**Staleness is checked server-side against live rows.** The `basis` fingerprint is sorted by key
so it does not depend on row order — `replaceGoals` soft-deletes and re-inserts, so ids change
on every save and an order-sensitive fingerprint would mark every proposal stale. The client
returns the basis but it is compared, never trusted: a forged one only skips a warning about the
user's own concurrent edit, and anyone who can post it is signed in and could call `replaceGoals`
directly.

**Nothing is persisted between the two steps.** A proposals table would need a migration, a
lifecycle, and a rule for cleaning up proposals nobody answered — for two events seconds apart
on one screen.

**Reversing it.** Delete `lib/proposals/` and `components/site/proposal-review.tsx`. Tests:
`lib/proposals/__tests__/`, including partial approval against real Postgres.

## 2026-08-25 · The Working page

### D-099 · Updates live in the project's markdown, and `status: active` is what puts a project on `/now`

**Decision.** `/now` renders every project whose frontmatter says `status: active`. Updates are
`### YYYY-MM-DD` entries under a `## Updates` heading in the project's own file, parsed out of
the public body into data.

**Why `status`, not a new list.** The project schema has carried `status: active | archived`
since the beginning. Reusing it means `/now` and `/projects` read one source, so a project cannot
be finished on one page and in progress on the other. A separate "currently working on" list
would allow showing motion on things that will never be portfolio projects — worth having, not
worth guessing at now, and addable later without moving any of this.

**Why the vault, not Postgres.** Updates in a table would make `/now` the first public page
needing a database, turning a static page dynamic for content written weekly. The cost is real
and stated in the UI: publishing is a commit plus a Vercel rebuild, about a minute. For ticking
off a task that trade went the other way — that is D-036 — and the difference is frequency.

**The section is removed from the published body.** Both callers want updates as data: `/now`
shows the latest two, the project page renders all of them as dated entries. Left in the body,
the same text would publish twice — once as raw markdown under a heading, once as entries. A
test asserts no public body still contains an `## Updates` heading.

**First live caller of `writeVaultFile`,** dormant since D-036 and exercised only by its own
tests. Its last-write-wins behaviour and 8s deadline are reachable in production for the first
time. No approval gate: a human writes these, not a model, so D-080 is untouched — nothing
AI-driven writes to the vault in V2.

**Photo prompts, not uploads,** as agreed. The private page names each active project with no
image and the file to edit. `writeVaultFile` is text-only; committing binaries through the
Contents API is its own piece of work.

**Reversing it.** Delete `src/app/now/`, `src/app/private/now/`, and the `updates` field from
`toPublicProject`; the `## Updates` sections then render as ordinary markdown on project pages
and nothing is lost. Remove the two nav entries. Tests:
`src/lib/vault/__tests__/updates.test.ts`.

## 2026-08-25 · The domain

### D-098 · A credential is one indivisible string, and `PASSKEYS` holds every device

**Decision.** `storedCredential()` becomes `storedCredentials()`, returning a list read from a
new `PASSKEYS` variable: entries separated by commas or newlines, each
`label:credentialId:publicKey`. Login offers every enrolled id and verifies against the one the
browser actually asserted; enrolment excludes every enrolled id and returns the **whole** list to
paste back.

**Why.** Victor wants the private side on his phone as well as his laptop, and the account was a
single pair of environment variables.

The alternative — `PASSKEY_CREDENTIAL_IDS` and `PASSKEY_PUBLIC_KEYS` as two parallel lists —
pairs by position. Retiring a device then means deleting the matching entry from both, and
missing one silently binds the wrong key to the wrong id. That fails closed rather than opening a
hole, but it fails as "sign-in stopped working" with nothing to point at. Keeping a credential
atomic makes that state unrepresentable. Colons are safe as a separator because base64url is
`A-Za-z0-9-_`; the id and key are read from the *end* of the entry, so labels may contain colons.

The label is for the human, never the ceremony. Deciding which of two opaque base64 blobs is the
old phone, six months from now, is otherwise guesswork.

Two failure modes shaped the rest:

- **Verifying against the first credential** in the list would have rejected the phone whenever
  the laptop was listed first. The asserted id selects the key. An unknown id returns the same
  opaque `verification failed` as a bad signature, so this is not an oracle for which ids exist.
- **Returning only the new device** — what the old two-variable output did — invites adding the
  phone by overwriting the laptop, which locks you out of the machine you are sitting at.
  Enrolment now returns one variable containing everything.

A malformed entry is skipped with a warning rather than thrown: one typo should cost one device,
not the ability to sign in at all. If none survive, the existing `no passkey enrolled` 503 fires.

`PASSKEY_CREDENTIAL_ID` / `PASSKEY_PUBLIC_KEY` are still read, as one unlabelled credential, and
deduped by id against `PASSKEYS`. That pair is what is deployed and working right now, and this
change must not be the thing that logs Victor out — the migration can happen at his pace.

**The migration hazard, learned the same day.** Keeping the legacy pair readable makes the
migration safe *only if the order is right*: deploy the code that reads `PASSKEYS`, then set it,
then delete the old pair. Done in the other order the site reads neither — the new variable is
invisible to an old build, and the old variables are gone — and it reports `no passkey enrolled`
for every device.

What made that hard to see is that a live session cookie lasts seven days, so one device kept
working and the failure looked per-device rather than total. The check that settles it in
seconds, and which now lives in `REGISTER_PASSKEY.md`:

```bash
curl -s https://victorgusev.com/api/auth/login -H "Origin: https://victorgusev.com"
```

It lists one entry per credential the *deployed* build can see, which is the only number that
matters and is not what Vercel's settings screen shows.

**Reversing it.** Delete `PASSKEYS`, keep the legacy pair; single-device behaviour is unchanged
and still fully tested. Tests: `src/lib/auth/__tests__/credentials.test.ts`.

### D-097 · A relying-party mismatch fails with a sentence, not a DOMException

**Decision.** Both auth routes call `relyingPartyProblem(request.headers.get("origin"))` before
starting a ceremony, and return a 500 naming the offending values when the request origin is
not one the app accepts.

**Why.** The browser's own error is actively misleading. With `NEXT_PUBLIC_SITE_URL` unset in
Vercel, the pre-2026-08-25 `relyingParty()` fell back to `http://localhost:3000`, and enrolling
on the live site produced:

    The RP ID "localhost" is invalid for this domain

That message names a value nobody configured, never mentions the variable that produced it, and
reads like a bug in the site rather than a missing environment variable. It cost a real
debugging session. The replacement says which origin the request came from, what
`NEXT_PUBLIC_SITE_URL` currently is, what the app therefore expects, and what to do.

Two details worth keeping:

- **A missing `Origin` header is not a problem.** Same-origin GETs may omit it, and refusing to
  serve on that would break the ceremony in the name of protecting it.
- **The message is safe to return.** `NEXT_PUBLIC_*` is inlined into client bundles by
  definition, and the request's own origin is known to whoever sent it. Nothing here is secret.

The check runs on *registration* too, and that is the more valuable half: enrolling against the
wrong relying party mints a credential bound to a hostname that will never serve the site, and
the only symptom is a sign-in failing later for reasons that look unrelated.

**How to reverse.** Delete the calls. The ceremonies work identically; only the failure gets
worse.

### D-096 · The canonical URL is the apex, `victorgusev.com`

**Decision.** `NEXT_PUBLIC_SITE_URL` and the three fallbacks in `layout.tsx`, `robots.ts` and
`sitemap.ts` are `https://victorgusev.com`. Vercel serves the apex as primary and redirects
`www` to it. Supersedes D-094, which is in [Reversed](#reversed).

**Why.** Victor's call, 2026-08-25. The bare domain is what he would write on a resume and in
an email signature, and it is one fewer word everywhere it appears. D-094 had chosen `www`
only because that was how the domain happened to be connected — a description of the current
setting rather than a preference, and the wrong thing to enshrine once the preference was
known.

**This cost nothing to reverse, by design.** D-095 had already made `rpID` the apex and
`origins` a list covering both forms, so flipping the primary did not invalidate the passkey
and required no auth change at all. Had D-095 not landed first, this would have been a second
forced re-enrolment. That is the entire value of the list.

**How to reverse.** Flip the primary in Vercel and change `NEXT_PUBLIC_SITE_URL` plus the
three fallbacks back to the `www` form. The passkey survives either direction.

### D-095 · The relying party is the apex, and both origins are accepted

**Decision.** `relyingParty()` returns `rpID` = the apex domain with any `www.` stripped, and
`origins` = a **list** containing the configured origin plus both the apex and `www` forms.
Both auth routes pass the list as `expectedOrigin`.

**Why.** It broke for real. The domain was connected with **`www.victorgusev.com` as the
primary** — the apex 308-redirects to it — while `NEXT_PUBLIC_SITE_URL` was unset and still
falling back to `victorgusev.vercel.app`. The app therefore expected one origin while the
browser sent another, and sign-in on the live site simply failed.

Two separate rules were being conflated by deriving both values from one hostname:

- **`rpID` is a permanent binding.** It may be any registrable-domain suffix of the origin, so
  a credential scoped to `victorgusev.com` works on `www.victorgusev.com` — but not the
  reverse. The apex is therefore strictly better: `www` is a narrower binding that buys
  nothing and breaks if the primary is ever flipped.
- **`origins` must contain the browser's exact origin**, scheme and port included. Which of
  apex and `www` is primary is a Vercel setting changeable in one click, and as a single value
  that click was a lockout.

Together: the passkey now survives apex and `www` being swapped, and only an actual change of
domain forces re-enrolment. Six tests cover it, including that `rpID` never carries a scheme or
port and that `localhost` keeps its port — rebuilding the origin from the hostname would drop
it and break the ceremony in development only.

**How to reverse.** Return `origin: url.origin` and pass it directly. Accept that the primary
hostname and the configured one must then match exactly, forever.

---

## 2026-08-25 · Weekly summary, images, and retiring culinary

### D-093 · Every real model call is logged

**Decision.** `callModel` prints `Gemini call: <model>, <n> chars` on every request that
actually reaches the API.

**Why.** The entire cost story rests on the cache absorbing repeat views, and that was never
observable — a cache that had silently stopped working looked exactly like one that was
working, until the bill arrived. This makes it checkable in ten seconds: load a page twice and
the second load must print nothing.

Measured with it, from a cold cache: three loads of `/private` with unchanged input cost
**zero** calls; changing the prompt cost exactly **one**. That is V2_PLAN §1.5's completion
test — "verified by watching the cache rather than by trusting it" — and it could not have been
satisfied without this line.

The character count is there because prompt length is most of what is paid for.

**How to reverse.** Delete the line. Accept that cache behaviour becomes unobservable again.

### D-092 · The weekly summary is fed days, not entries

**Decision.** `generateWeeklySummary` receives one line per day for seven days, with empty days
included explicitly as "nothing logged". It has its own cache entry and its own tag, and it
short-circuits to zero cost when the whole week is empty.

**Why.** Three reasons, in order of weight:

1. **Cache stability.** Keyed on the prompt, a week of raw entries changes its key every time
   any single entry moves. Days change only when a day changes.
2. **Empty days are the signal.** "Nothing logged" on three days is the most informative thing
   a weekly summary can say. Dropping those rows would make a four-day week indistinguishable
   from a full one, which is exactly the self-flattering summary nobody needs.
3. **Cost.** A week of entries is a few hundred lines against a $10/month budget.

A separate tag from the daily summary matters: a day's log changing must not invalidate the
week, and invalidating the week must not cost a fresh daily call. Sharing one would make each
pay for the other's churn.

**Not verified live.** The weekly path needs real log data, and `.env.local` points at the
production Neon database — seeding fake entries would write into Victor's actual logbook. The
empty-week path and the guards are tested; the populated path gets its first real exercise the
first week he logs something.

**How to reverse.** Pass entries instead of days, and drop the `anything` guard in the page.

### D-091 · `image_fit` decides cover or contain, per project

**Decision.** A new optional frontmatter field, `image_fit: cover | contain`, defaulting to
`cover`. Set to `contain` on `micromouse-simulator`, `taskable` and `solenoid-bit-reader`.

**Why.** The hero box is `aspect-16/9` with `object-cover`, which is right for a photograph and
wrong for everything else. Measured: micromouse is 606×649 (0.93:1), taskable 1428×910 (1.57:1),
solenoid 424×299 (1.42:1) — all taller than 16:9, so `cover` cropped the top and bottom off.
On taskable that removed the "TaskAble (Teacher View)" heading, which is the one thing the
screenshot exists to show. `5SecondRule.png` is 1920×1080 artwork and stays `cover`.

Explicit rather than derived. Reading intrinsic dimensions at build time would work, but it
makes every project page depend on decoding an image to decide something a human knows by
looking — and the rule is not really about the ratio, it is that **a diagram or screenshot is
worth seeing whole and a photograph is worth cropping**.

Solenoid's crop pre-dated all of this and was not a regression; it was fixed anyway, because
leaving one diagram cropped while fixing two others is incoherent.

**How to reverse.** Delete the field from the schema, both projections and both render sites.
Everything returns to `object-cover`.

### D-090 · Project cards size to their own content

**Decision.** `items-start` on the projects grid.

**Why.** A regression introduced by adding images. The grid stretched rows to equal height,
which was invisible while one project of six had an image. With four of six carrying one, a
card without an image was stretched to match its neighbour and opened roughly 200px of void
above its tags — Proof and Water Bottle Scale both looked broken.

Uneven card heights read as a set. A void reads as a missing image.

**How to reverse.** Drop `items-start` and accept equal-height rows.

---

## 2026-08-25 · V2 rev 4 — the cut, and three features that fit inside it

### D-089 · Project updates live in markdown, and `writeVaultFile` finally gets a caller

**Decision.** The Working page's dated updates are stored as entries in each project's own
markdown file, written from `/private` through `writeVaultFile`. Not Postgres.

**Why.** The public site is statically generated and free. Updates in Postgres would make the
Working page the first public page needing a database, turning a static page dynamic for
content that changes weekly. Markdown keeps it static; the cost is that saving an update is a
commit plus a Vercel rebuild, so it appears in about a minute.

That is the right trade *here* and was the wrong one for tasks — D-036 moved those to Postgres
precisely because a commit-and-deploy per save made logging slower than the app it replaced.
The difference is frequency: tasks change many times a day, a project update perhaps weekly.

This makes V2 §7.9 the **first live caller of `writeVaultFile`**, dormant since D-036 and
exercised only by its own tests. A real `409` becomes reachable for the first time, so the
retry has to work. D-080 is unaffected: this is a human writing, not a model, so it needs no
approval gate, and nothing AI-driven writes to the vault in V2.

**How to reverse.** Move updates to a Postgres table and make `/now` dynamic. Expect to revisit
static export assumptions across the public build.

### D-088 · The Working page is built on `status: active`, not a new entity

**Decision.** A project appears on the public `/now` page when its frontmatter says
`status: active`. No new data model. Nav becomes About / Now / Projects / Resume.

**Why.** The schema has carried `status: active | archived` since the beginning. Reusing it
means `/now` and `/projects` cannot disagree — a project cannot be in progress on one page and
finished on another — and it means the page costs 6h instead of 9h.

The alternative, a separate list, buys the ability to show motion on work that will never be a
portfolio project: coursework, this vault, one-off experiments. That is a real gap, but it is
**additive** — a separate list can be added later without moving anything that exists — so
adding it speculatively now would be paying for an option before knowing it is wanted. Recorded
in `docs/V3_PLAN.md` §2.

**How to reverse.** Introduce a `working` entity and read from it instead; `/projects` is
unaffected either way.

### D-087 · Semantic search is cut, and this time it stays cut

**Decision.** Semantic search leaves V2 and moves to `docs/V3_PLAN.md` §2 as recorded-but-unscheduled.
The Working page, the public→private button and read-only job-sheet access take its place.

**Why.** It has now been evaluated three times. Rev 1 cut it on **cost** ($10 of credit). Rev 2
reinstated it when the budget turned out to be $10 *per month*, which removed that objection.
Rev 4 cuts it on **time**, which was always the real constraint: at 12h it was the largest item
in V2 and the only remaining Hard one, and Victor rated it the lowest-frequency capability in
the plan.

The arithmetic is the argument. Three requested features cost 11.5h; semantic search cost 12h.
Trading them left V2 **shorter** than before the features arrived, with slack going from ~19%
to ~34%. Victor offered extra hours to fit everything; they were declined and held in reserve,
because eleven consecutive 6h days ending the day before move-in is how the last week of a
deadline goes wrong.

Nothing had been built, so nothing was wasted.

**How to reverse.** It is intact in `docs/V3_PLAN.md` §2 with its design notes — Postgres vectors,
re-embed only on `updated:` change, hard token ceiling, private-only surface.

---

## 2026-08-25 · Closing out "Today"

### D-086 · A failed summary is not cached, and a missing key never reaches the cache

**Decision.** `cachedSummary` throws when `callModel` returns `ok: false`, and
`generateDailySummary` catches it and turns it back into a message. A missing or placeholder
`GEMINI_API_KEY` is checked *before* the cache and short-circuits, like the empty-day case.

**Why.** `unstable_cache` stores whatever its function returns, and `callModel` deliberately
returns failures as values rather than throwing (so a nice-to-have panel cannot 500 the
dashboard). Composed naively those two correct decisions produce a wrong one: a single 404 or
rate limit pinned "the summary could not be generated" to the dashboard for the full six-hour
TTL, long after the cause had gone. A rejected promise is not stored, so throwing at the cache
boundary means only successes occupy it.

The key check moved out for a second reason: `unstable_cache` needs a Next request context, so
anything behind it cannot be tested outside one — the first version of the test got
`Invariant: incrementalCache missing` and the too-broad catch reported it as a summary
failure. A missing key is a configuration state, not a model failure. There is nothing to
memoise about it.

**How to reverse.** Return the result instead of throwing, and put the key check back inside
`callModel`. Accept that a transient failure sticks for six hours.

### D-085 · `gemini-2.5-flash` is retired; the model id is `gemini-3.6-flash`

**Decision.** `MODEL` is exported from `lib/ai/gemini.ts`, is `gemini-3.6-flash`, and is what
the dashboard panel prints as its `meta`.

**Why.** Every call was returning `404 — "This model models/gemini-2.5-flash is no longer
available to new users"`. The API names its own replacement, which is where the new value came
from. The daily summary had been silently degrading to its fallback string, because
`callModel` catches everything: **a retired model does not fail loudly here.** Found only by
reading the dev server log while screenshotting the page for D-084.

That is also why the panel now prints the live `MODEL` constant rather than a hardcoded
"Gemini 2.5 Flash" label — the label had already drifted from the truth once.

Two tests guard it: one asserts the id still contains `flash` (the budget is ~$10/month), one
asserts it is not the retired string.

**How to reverse.** Change the constant. Nothing else references a model name.

### D-084 · The task list comes before the numbers that describe it

**Decision.** `/private` orders as: schedule (when there are events), the Due list, a compact
three-across stat row, goals, backlog, finished, and the AI summary last. The stats no longer
stack on a phone, and their hints are hidden below `sm`.

**Why.** Feature 3 was "largely built" and had never been reviewed against the question it
exists to answer: *what do I do now*. Measured at 390px, **the first task sat 791px down the
page** — past the fold on any phone. What occupied that space was a failed AI panel (~170px
saying it could not generate a summary) and three stat cards stacked into ~290px to show three
zeros. Two of those three restate what the panels below already say: "Due today" is the length
of the very next list, and "Done today" is the count in "Finished today". So the page opened
with a summary of the answer and put the answer below the fold.

The AI summary moved to the bottom because it answers "how did today go", not "what do I do
now", and because it is the slowest thing on the page — last means the network round trip is
the thing nobody is waiting for. When it fails it now gets one muted line rather than a panel:
still shown, because a silently missing summary is a key nobody notices is broken, but at the
weight the message deserves.

After: **356px.** No panel was deleted and nothing was built — the review was the feature,
exactly as V2_PLAN predicted.

`SkeletonStats` was updated to match the new grid. When the two drifted, three stacked
placeholders collapsing into one row moved the page ~200px under the reader's thumb as the
tasks resolved.

**How to reverse.** Move the blocks back in `app/private/page.tsx`; they are three
independent JSX chunks. Put `sm:grid-cols-3` back on the stat row and the skeleton together.

### D-083 · `shots` signs its own session and gates the fold

**Decision.** `npm run shots` now sweeps `/private` and `/private/log`, minting a session
cookie from `SESSION_SECRET` (loaded via `--env-file-if-exists=.env.local`). It reports how far
down the page the first task sits and **exits non-zero above 500px** on a phone width. Skipped
silently when the secret is absent, or with `SHOTS_PRIVATE=0`.

**Why.** `/private` is the page Victor opens most and the only one he uses on a phone daily,
and it was the one page nothing could see — behind a passkey, so the sweep stopped at the
sign-in screen. That is how 791px survived. The session is an HMAC over a JSON payload, so a
valid cookie can be minted from the same secret the app verifies against; the secret is
already on this machine, the server is this machine, and the minted token lives fifteen
minutes rather than the app's seven days.

500px because a 390×844 phone shows roughly 690px once browser chrome is subtracted. The gate
was verified in both directions — lowered to 300px it fails with exit 1, restored to 500px it
passes with exit 0. A gate that has never fired is not known to be a gate.

The script also reports a redirect to `/signin`, so a rejected cookie cannot silently become a
screenshot of the sign-in page recorded as a healthy layout.

**How to reverse.** Delete the private block and `data-task-list` from `task-list.tsx`, and
drop `--env-file-if-exists` from the `shots` script.

---

## 2026-08-25 · The case-study page

### D-082 · Project sections are stored in narrative order, not reordered at render

**Decision.** `scripts/order_case_study_sections.py` puts each project file's sections into
the order a case study reads in — problem, what was built, what did not work, what it
measured, then anything else. Five of six files moved. The renderer then displays them in
file order, with no reordering of its own.

**Why.** Four files opened with `## Architecture` and reached `## The problem` third, because
the D-073 skeleton was appended to files that already had an architecture paragraph. That is
invisible today only because the misplaced sections are all still unwritten and
`dropUnwritten` removes them — it stops being invisible the moment the prose lands, which is
why this ran before Victor writes rather than after.

Reordering in the renderer was the alternative and is worse: the public page would then
disagree with the file, which breaks the one rule this vault runs on. The vault is also read
directly by AI agents, so a file that reads in the wrong order is wrong for them too, not just
for the website.

The script moves whole sections and never edits a line inside one. Verified by comparing the
sorted set of non-blank lines before and after: identical for all six files. It is idempotent,
and `--check` reports drift without writing.

**How to reverse.** Move the sections back by hand; nothing depends on the order but reading.

### D-081 · A case study is styled by role, and the results carry the weight

**Decision.** `CaseStudy` renders a project body by mapping each `##` heading to a role and
giving each role its own treatment. `Measured results` gets the primary magenta, a panel, and
its numbers wrapped in mono; `What did not work` gets the steel secondary and a panel of its
own; the problem and the architecture are plain. Sections carry a mono index and a rule to the
edge. Everything else falls through to plain `Prose` exactly as before.

**Why.** Every section was styled identically, so the one number Victor measured and the one
thing he abandoned looked exactly like a paragraph about the stack. Those are the two sections
an engineer actually reads: results are the payload, and "what did not work" is the section
almost no student portfolio has at all.

Three rules make the half-written states — which is most of the portfolio until the write-ups
land — look deliberate rather than broken:

- **A section keeps its own heading.** The role picks the colour and the container, never the
  wording. `solenoid-bit-reader` still says "Design decisions" and "Results", because D-073
  kept that wording on purpose and a renderer quietly retitling an author's section is an
  editorial act disguised as styling.
- **The index counts sections that are present**, not the role's slot in the skeleton.
  Numbering by role would print `01 03 04` on a half-written project, advertising exactly the
  gap `dropUnwritten` exists to hide.
- **One section is still a case study**, and is rendered without an index — it does not need
  to be told it is the first of one.

Failure is steel, not red. This section is evidence of judgement; colouring it like a warning
would say the opposite.

Number emphasis is opt-in on `Prose` (`numbers`) and used only inside a results panel. `Prose`
also renders experience entries, lab write-ups, the private calendar's rules and every vault
document, and highlighting every figure across those would be noise where it is signal on one
panel. A test asserts the marked-up text is character-identical to the plain text — altering a
measured figure on a portfolio page is the D-069 failure mode with extra steps.

Verified against `solenoid-bit-reader` plus throwaway one-, two- and four-section fixtures at
390px and 1280px, since solenoid alone is one section from complete and cannot show the
partially-filled case. The fixtures were deleted immediately; they were never committed.

**How to reverse.** Put `<Prose>` back in `projects/[slug]/page.tsx` and delete
`case-study.tsx`, `lib/vault/case-study.ts` and the `numbers` prop. Bodies then render as an
undifferentiated run of headings again.

---

## 2026-08-25 · V2 replan and the resume gate

### D-080 · The AI approval gate is over proposals, not over a markdown diff

**Decision.** Feature 6's approval surface reviews a **typed list of changes** — a before and
an after per item, approved or rejected individually — rather than a rendered diff of two
markdown documents. `writeVaultFile` stays dormant through V2; nothing AI-driven writes to the
vault at all.

**Why.** V2_PLAN rev 1 specified a markdown diff and justified building it first because
"draft sprint goals depends entirely on the approval UI". That dependency does not exist.
Sprint goals are Postgres rows: `saveSprintGoals` → `replaceGoals` writes `tasks` rows with
`source='goal'` (`src/app/private/actions.ts:144`). Nothing about goals touches markdown.

Following rev 1 would have spent 10h — the largest single item before the deadline — building
a markdown-diff UI that **no V2 feature calls**: goals write rows, resume tailoring writes
nothing, semantic search reads. It would have shipped a code path exercised only by its own
tests, which is the exact condition (`writeVaultFile` dormant since D-036) the plan named as
its own risk.

The constraint Victor set — *nothing writes on a model's say-so* — is unchanged and is in fact
satisfied more strongly this way, because in V2 the model cannot reach the vault at all.

**How to reverse.** Build the diff view and give `writeVaultFile` a caller. Do it in that
order and only once something genuinely drafts markdown; a writer whose first job is
case-study prose collides with D-073 and needs Victor's explicit sign-off, not an agent's
judgement.

### D-079 · Semantic search is reinstated; the cut line moves to its re-embedding

**Decision.** Feature 6 keeps all four capabilities including semantic search. It stays last
in build order. The declared cut is now, in order: (1) drop incremental re-embedding for
on-demand full re-index, (2) drop the feature.

**Why.** Rev 1 cut it on cost, against "$10 of credits, total, for the life of this". The
budget is **$10 per month**. Cost was the objection, so the cut lapses — but a plan without a
declared cut line decides under pressure, so a new one is named with a dated trigger (V2_PLAN
§2.4). Reinstating 12h is affordable only because D-080 gave back 7h; the two are linked.

**How to reverse.** Take cut 1, then cut 2.

### D-078 · Coursework is four entries, and it is shared by every variant

**Decision.** `coursework:` in `resume_config.md` drops from seven to four — Algorithms and
Complexity, Software Construction, Object-Oriented Design, Linear Algebra. Dropped:
Programming Languages, Discrete Structures, Logic Design.

**Why.** The SWE variant printed at 1.03 pages and coursework is the lowest-signal content on
the sheet. Worth knowing before editing it: this is **one flat list consumed by all three
variants** (`src/lib/resume.ts:126`), so the trim shortened ml and robotics too. That was
acceptable — both had room — but a variant-specific coursework line would need a schema
change, and was judged not worth it for one line of text.

Measured: the trim alone moved swe 1.03 → 1.01, i.e. it recovered ~19px of the ~29px needed.
It did **not** close the gap on its own, which is why D-076 exists.

**How to reverse.** Put the three back. Expect swe to return to 1.01 and check with
`npm run shots`.

### D-077 · The resume's page count is measured, not eyeballed

**Decision.** `npm run shots` measures every resume variant against one printed Letter page
and exits non-zero if any runs over. Two numbers per variant: `pages`, from Chromium's own PDF
writer at Letter/0.5in — the same path as the print dialog Victor actually uses — and `ratio`,
the print-emulated sheet height over one page. A print-media PNG is written alongside the PDF.

**Why.** V2_PLAN rev 1's completion test for the resume was "`shots.mjs` reports every variant
under 1.00 pages". `shots.mjs` could not do that: it measured horizontal overflow, tap targets
and font size, and only ever loaded `/resume/swe`. The plan's own rule is *measure, do not
assume*, and its completion test assumed a measurement that did not exist. The resume printed
at 1.33 pages for weeks for exactly this reason.

`ratio` is there because it is the number that makes an overflow *fixable*: "1.03" says trim a
line, "2 pages" says nothing. Two attempts at measuring it were wrong before the third was
right, and both failure modes are worth remembering — `documentElement.scrollHeight` never
reports less than the viewport, so every variant that fit read exactly 1.00; and `main`
carries `flex-1` inside the layout's flex column, so it is stretched to the viewport whatever
it holds. Both measure the window, not the content. `.resume-sheet` is the only element whose
height is the content's. The fixed version independently reproduced the three figures rev 1
had recorded by hand (1.03 / 0.98 / 0.90), which is what says it is right.

Only `swe` is screenshotted at the four device widths. The three variants are one component
fed different data, so a mobile layout fault appears in all of them identically; what differs
between variants is length, and length is what the new measurement covers.

**How to reverse.** Delete `measureResumes` and its call. Page count returns to being checked
by printing the page and counting.

### D-076 · Bullet leading, not bullet count, closed the last 13px

**Decision.** Print bullet `line-height` 1.26 → 1.20, and `.resume-sheet section` margin-top
0.5rem → 0.375rem. Font sizes are unchanged.

**Why.** After D-078 the SWE sheet still measured 973px against 960 available. Probing where
the height actually went: 17 bullets over 27 rendered lines were 432px — **44% of the page** —
so leading there is worth more than anything else on the sheet, and it costs no content. The
alternative levers were both worse: `main` and `.resume-sheet` padding are already zeroed in
print, and everything else on the page is text Victor wrote.

The 9.6pt floor from the earlier density pass is deliberately untouched. Leading is
whitespace; type size is legibility, and shrinking it further is how a resume starts looking
like it is hiding from its own length.

Result: swe 0.98, ml 0.93, robotics 0.86 — all one page, with headroom rather than sitting at
0.999 where the next added bullet breaks it again.

**How to reverse.** Both values back to 1.26 and 0.5rem. swe returns to two pages.

---

## 2026-08-24 · Mobile and case studies

### D-075 · A hover-only affordance must not occupy space without hover

**Decision.** The "Read more →" hint on a project card is `hidden` and becomes `block` only
under `@media (hover: hover)`.

**Why.** It was `opacity-0` with `group-hover:opacity-100`, which still reserves its box. On a
phone that is roughly 32px of permanently invisible space per card — six cards, no touch user
could ever resolve any of it into text. Opacity hides ink, not layout.

**How to reverse.** Drop the `hidden [@media(hover:hover)]:block` pair and accept the empty space.

### D-074 · Only a real photograph earns a figure

**Decision.** Project cards and detail pages render an image only when one exists. Without one,
a card gets a 1px accent rail instead of a 16:9 generated placeholder.

**Why.** Five of six projects have no photograph, and the generated stand-in cost about 180px
each. Measured, the projects page ran to **6,150px on a 390px phone** — most of it decorative
charts of nothing, above the actual writing. It is now **3,950px**, and the one project that
does have a photograph reads as the strongest by contrast rather than being lost among five
lookalikes.

The `ProjectFigure` placeholder generator is kept, not deleted: it is still the right thing if
a future layout wants a uniform grid.

**How to reverse.** Render `ProjectFigure` unconditionally again.

### D-073 · Case studies are skeletons in the vault, and unwritten sections do not publish

**Decision.** Every project file carries the four sections Victor chose — the problem and its
constraint, architecture, what did not work, measured results. Unwritten ones hold a
`> **To write:** …` prompt. `dropUnwritten` strips those prompts *and* removes any heading left
with nothing under it, so the public page shows only what he has actually written.

**Why.** The write-ups are 24–80 words. A case study needs content, and content that is not
recorded cannot be produced by an agent — the water bottle scale (D-069) is what that looks
like when it goes wrong. So the structure is built and the prose is Victor's to add, in the
file where he already edits.

Publishing an empty `## Measured results` would be worse than having no section: it advertises
a gap. Publishing the prompt itself would be worse again — a portfolio page asking its own
author what he tried that failed.

Two bugs found while building it, both fixed and pinned by tests:
- The prompt matcher caught only the opening line of a blockquote, so the *wrap* of each prompt
  was published as if it were prose. Prompts now run to the end of their quote.
- `water-bottle-scale.md` had a "Still to write up" list that was publishing its own gaps. It
  now uses the same convention as every other file.

`solenoid-bit-reader.md` keeps `## Design decisions` and `## Results` rather than gaining
duplicates: it already answers both questions, with a real measured number.

**How to reverse.** Delete `dropUnwritten` and the skeleton sections. Bodies then publish
verbatim, prompts included.

---

## 2026-08-24 · V2 close-out decisions

### D-072 · A local browser is the only MCP server

**Decision.** `.mcp.json` runs `@playwright/mcp` locally, isolated, at a 1280×900 viewport.
Nothing else is configured.

**Why.** Two of the remaining tasks — resume design and the mobile layout pass — are purely
visual, and until now the site has only ever been verified by grepping built HTML. That caught
fabricated content and privacy leaks, but it cannot answer "does this look right", which is the
actual question for both jobs.

Local matters more than the capability. The repo is private and holds health data; a browser
driven on Victor's own machine sends nothing anywhere. The alternatives considered — Sentry,
Semgrep, Datadog, a Neon MCP — all ship code, telemetry or query results to a third party, and
three of them imply paid tiers against a $0 budget. Sentry alone remains defensible later, and
would need scrubbing rules before it touches the private site.

`--isolated` so no browser profile persists between runs, and no cookie or session from ordinary
browsing is reachable from an automated one.

**How to reverse.** Delete `.mcp.json`. Verification returns to inspecting built output.

### D-071 · The whole log, health included, may be sent to the model

**Decision.** The AI summary sends everything: sprint goals and all six log categories,
athletics and bodyweight among them. Asked directly, Victor chose this over excluding health.

**Why.** It is his data and his call, and a summary that silently omits training is a summary of
a fraction of his day.

**This does not loosen the publication rule, which is unchanged and absolute.** Health data must
never reach a public page. The two are different acts: one sends data to an API under Victor's
own key for a private page only he can see; the other bakes it into a world-readable static
bundle. A future agent reading "everything goes to Google" as licence to publish bodyweight
would be misreading this entry.

Practical consequences worth stating: prompts leave the machine, so anything sent is subject to
Google's retention, and the summary is cached — meaning health-derived text sits in the Next
cache alongside everything else.

**How to reverse.** Filter by category in `AiSummary` before building the prompt. The
`summarise()` output is already per-category, so the filter is one predicate.

### D-070 · Feature 6 gets all four capabilities, summaries first

**Decision.** Read-only summaries, draft-sprint-goals behind an approval diff, resume tailoring,
and semantic search — all four, built in that order, after the public-site work.

**Why.** Victor picked the public site as the priority for the pre-term window: the resume is
what gets him interviews and fall recruiting is imminent, whereas feature 6 is for him alone and
fits the 4h/week he will have during term.

On cost, he judged the $10 sufficient — semantic search will be used rarely and Flash is cheap.
That is a real constraint rather than a guess, so embeddings must be cached and re-embedding
must be incremental, not a full pass on every vault edit.

Draft-sprint-goals is what forces the approval-gated write UI to exist. That gate is
non-negotiable: nothing writes to the vault on a model's say-so.

**How to reverse.** Build only the summaries and drop the rest; nothing else depends on them.

---

## 2026-08-24 · Review of external changes

### D-069 · Nothing on the public site may be inferred, only recorded

**Decision.** Project entries state what Victor has told us and nothing else. Where detail is
missing the file says so under a "Still to write up" heading and carries `draft: true`, which
keeps it on the portfolio but off every resume.

**Why.** The water bottle scale entry was rewritten with invented specifics — an ESP32 (Victor
said Arduino Uno), an HX711 amplifier, "±2g accuracy", a 5-second-window state machine and MQTT
streaming — and marked `draft: false` with `resume_variants: [swe, robotics]`. All of it reached
the built portfolio and two resume pages. Fabricated technical detail on a hiring-facing
document is the worst failure this project can produce: it is discovered in an interview, by
someone asking a follow-up question.

The previous placeholder had listed exactly what needed filling in. Those prompts became the
fabrication — "one measured number: accuracy in millilitres" became "±2g accuracy".

**How to reverse.** Fill the entry in with real detail from Victor, then set `draft: false` and
add resume variants. Do not do it the other way round.

### D-068 · `experience[0]` is "most recent", never "now"

**Decision.** The homepage spotlight is headed "Most recent" and prints the entry's real
`dateEnd`.

**Why.** It was headed "What I'm working on now" with a hard-coded `— Present`. Dimaag.ai's
vault entry says `date_end: 2026-08`, so the public site told every hiring manager that a
finished internship was ongoing — a claim about employment produced by a string literal and an
array index.

The "what I'm working on now" section Victor actually asked for is about current *work* —
2ndMind, coursework — and is still unbuilt. Reusing the experience list for it was not the same
feature.

**How to reverse.** Only with a field that says a role is current, and only driven by data.

### D-067 · The AI summary is cached and reads the live log

**Decision.** `generateDailySummary` wraps the model call in `unstable_cache` (6h TTL, tag
`ai-summary`) keyed on the prompt, and the dashboard feeds it today's `log_entries` rows plus
the sprint goals section — not `logbook_archive.md`.

**Why.** Two defects. The call sat uncached on `/private`, which is `force-dynamic` and the page
Victor opens most, so every load re-summarised an unchanged day against a $10 lifetime credit
budget. And it summarised the *retired* free-text logbook — the thing feature 2 replaced and
Victor asked to rework or delete — so it described a system he stopped using while ignoring
everything he has written since.

Keying the cache on the prompt rather than on time means a real change in goals or log produces
a new summary immediately; only repetition is free.

**How to reverse.** Call `callModel` directly and pass whatever context is wanted.

### D-066 · `app/error.tsx` shows a digest, not a message

**Decision.** The message is rendered only in development; production shows the digest.

**Why.** This boundary sits at the root of `app/`, so it covers the public portfolio. Next
redacts server-thrown messages in production, but anything thrown in a client component arrives
verbatim — and this page is reachable by anyone. A digest locates the real trace in the Vercel
logs and tells a passer-by nothing.

It is deliberately **not** renamed to `global-error.tsx`. That file replaces the root layout,
must render its own `<html>`/`<body>`, and fires only for errors thrown in the layout itself.
Renaming would trade the boundary that catches nearly everything for the one that catches the
rarest case. Both may exist; one may not become the other.

**How to reverse.** Render `error.message` unconditionally, and accept that public visitors see
internal strings.

### D-065 · Structure is parsed, text is edited by offset

**Decision.** `frontmatter.ts` locates sections and bullets with an mdast parse, then edits the
located byte range as text rather than re-printing the tree.

**Why.** This closes a real corruption bug: a `##` inside a fenced code block used to terminate
a section, so replacing an earlier section left a dangling fence and a fake heading behind. A
regex cannot tell that a line is inside a fence. Measured on the old implementation before the
change, so the benefit is established rather than assumed.

Editing by offset, not re-printing, because `mdast` round-tripping normalises whitespace, list
markers and emphasis characters — rewriting parts of a file nobody touched and making every
diff unreadable.

Note what this does *not* do: `setLabelledBullet`, `getLabelledBullet` and `setFrontmatterField`
still use the same regexes as before, now applied inside a narrowed range. The `m`-flag and
CRLF traps therefore still apply, which is why the module header still documents them.

**How to reverse.** The pre-AST implementation is at commit `4fe26eb`. Reverting reintroduces
the code-fence bug.

### D-064 · No client runtime in the root layout without a caller

**Decision.** `<Toaster />` removed from `app/layout.tsx`.

**Why.** It was mounted globally while nothing in the codebase calls `toast()`. That shipped a
client component — and its hydration cost — to every page including the statically generated
public portfolio, for zero functionality. The public site's whole value is arriving as finished
HTML.

**How to reverse.** Add it back at the same time as the first `toast()` call, and preferably in
the private layout rather than the root one.

---

## 2026-08-22 · Athletics depth (feature 5)

### D-063 · The `db:migrate` script loads `.env.local` itself

**Decision.** `node --env-file-if-exists=.env.local ./node_modules/drizzle-kit/bin.cjs migrate`.

**Why.** `drizzle-kit` does not read `.env.local` the way Next does, so `npm run db:migrate`
failed with an empty `url` even with the variable sitting right there in the file. Every
migration therefore needed a remembered incantation, which is exactly the kind of friction
that ends with migrations not being run.

**How to reverse.** Put `"drizzle-kit migrate"` back and set `DATABASE_URL` in the shell first.

### D-062 · The Los Angeles offset is computed, not hard-coded

**Decision.** `zoneOffsetMinutes(now, timeZone)` in `lib/tasks/queries.ts`, replacing the
`const LA_OFFSET_MINUTES = 420` repeated in three pages.

**Why.** 420 is only correct while Los Angeles is on daylight time. It would have gone wrong
on **2026-11-01**, during term — and quietly: "today" would have begun at 11pm the night
before, filing every late-evening task and log entry under tomorrow for the whole of winter.
The new function formats the instant in the zone and reads it back as UTC, which is the only
way to get a real offset without shipping a timezone database.

**How to reverse.** Pass a literal offset to `dayBounds` again. Do not — the constant is wrong
for five months of the year.

### D-061 · Charts are server-rendered SVG, not `recharts`

**Decision.** `components/site/chart.tsx` draws `TrendChart` and `BarChart` by hand. `recharts`
stays unused in `package.json`.

**Why.** These are one `<polyline>` each. Using the library would add a client boundary and a
charting runtime to a page that currently arrives as finished HTML, turning a streamed render
into one that waits for hydration — the exact regression D-045 was written to prevent.

**How to reverse.** `recharts` is already installed; replace the two components. Accept that
the athletics page then ships JavaScript to draw its charts.

### D-060 · Warmup sets count toward volume but never toward a record

**Decision.** `weeklyVolume` deliberately does not apply `isWorkingSet`; `strengthRecords`,
`ergRecords` and `flagSpm` all do.

**Why.** Victor was asked directly and said volume should include warmups — they are load the
body absorbed. A record set by a warmup, though, is not a record. This was V1 finding F10,
where the two rules were inconsistent by accident rather than on purpose; they are now
inconsistent on purpose, which is different, and the test says so.

**How to reverse.** Add `if (!isWorkingSet(effort)) continue;` to `weeklyVolume`.

### D-059 · The rehab checklist is its own table, not `tasks`

**Decision.** `rehab_completions`, keyed `(completed_on, slug)`.

**Why.** D-037 merged everything actionable into `tasks` so there would be one list to read.
Four rehab items every day is ~1,400 rows a year, which would bury the thing D-037 was
protecting. A daily-recurring checklist is a different shape from a to-do: it is never "done",
only "done today".

**How to reverse.** Insert four `tasks` rows a day with `source: "rehab"` and delete this
table. Expect the task list to become unreadable within a fortnight.

### D-058 · Bodyweight is a table, and it is health data

**Decision.** `bodyweight_entries`, one row per day, `date` rather than `timestamp`.

**Why.** It is the second input to every weight-adjusted split on the site, so "the weight
closest to this piece" has to be an indexed lookup rather than a scan through JSONB. `date`
because a weigh-in belongs to a morning, not an instant — storing days as timestamps is what
forces the noon-UTC trick used elsewhere here, and it breaks the first time Victor travels.

One reading per day, upserted: weighing twice in a morning is normal, and two rows would put
two contradictory points on one day of the chart.

**Privacy.** This is the field Victor named as never publishable. No public route imports the
schema, and the built client chunks were scanned — the only hits were the form's own UI copy.

**How to reverse.** Drop the table and delete `adjusted.ts`; the site falls back to raw splits.

### D-057 · Splits are weight-adjusted with Concept2's formula

**Decision.** `factor = (bodyweight_lbs / 270) ^ 0.222`, applied to time.

**Why.** The vault states exactly one athletic goal — "sub-2:00 **weight-adjusted** 500m
split" — so a site showing only raw splits could not answer whether he is close to it. At
215 lb the two differ by about seven seconds.

The direction is worth stating because it is the opposite of the intuitive reading: the
adjustment discounts *lighter* athletes, so **putting on mass makes this goal harder**. Both
the raw and the adjusted line are charted for that reason — an adjusted line alone would let
a lighter month read as a faster month. There is a test pinning the direction specifically.

The number the page leads with is the **required raw split**, because "sub-2:00 adjusted" is
not something anyone can pace to on a monitor and "2:06.2" is.

**How to reverse.** Show `splitPer500S` only and drop the Adjusted column.

### D-056 · The protocol is parsed from the vault, not written in code

**Decision.** SPM targets, the rehab protocol, the weekly split and the goal are read from
`context/02_physical_performance/` at request time by `lib/athletics/protocol.ts`.

**Why.** All four already live in the vault. A copy in TypeScript would drift: Victor edits
the markdown, the site keeps showing last month's programme, and nothing says which is right.
Parsing means editing the vault *is* editing the app — no code change, no deploy.

The cost is that reformatting those files can stop a section parsing. Every parser returns
empty rather than throwing, and every panel says "not found in the vault, from this heading"
rather than rendering an empty box — so a parse miss reads as a parse miss. Tests run against
the real vault files, which is what would actually catch a reformat.

Parsing is line-based, not one large regex: the vault is CRLF, `$` under `m` does not match
before a `\r`, and multi-line patterns have already caused silent bugs in this repo.

**How to reverse.** Hard-code the four structures in `protocol.ts` and delete the vault reads.
The panels stop tracking the vault.

### D-055 · The week's plan is compared to logged sessions coarsely, on purpose

**Decision.** `weekReview` reports whether a day has *any* session, never which planned item
was done. Future days are never "missed".

**Why.** Nothing in the data links a logged workout to a line of the programme. Matching on
the title would mark a rest-day walk as "Team Land Practice, complete" — a confident wrong
answer, which is worse here than an honest coarse one. And a review that shows the whole week
red on a Monday morning is the fastest way to make this view ignored.

**How to reverse.** Match `PlannedDay.items` against workout titles and report per item.
Expect false positives.

---

## 2026-08-21 · V2 scope

### D-054 · Vitest hook timeout raised to 30s

**Decision.** `hookTimeout: 30_000` in `vitest.config.mts`.

**Why.** The first `beforeEach` in each database test file boots PGlite and runs every
migration; three such files run in parallel workers, and under that load the first hook was
measured at ~16s, past vitest's 10s default. It surfaced as three "Hook timed out" failures
that passed on a re-run — the same flakiness D-050 fixed, from a different cause.

Raised rather than masked: the work genuinely takes that long once per file, and every
subsequent hook is a TRUNCATE taking milliseconds. Verified with two consecutive clean runs.

**How to reverse.** Lower it and the suite goes back to failing intermittently on a cold run.

---

### D-053 · The agenda shows the whole feed, unfiltered

**Decision.** `/private/calendar` lists every event in the Google feed. No classification, no
course-code filter.

**Why.** Victor's calendar is one general calendar — 182 events covering classes, practice and
personal life, of which only about 40 carry anything resembling a course code. A regex
deciding what is a "class" would drop a real one the moment it is titled without a code, and a
silently missing class is worse than a cluttered list. Asked, and he chose showing everything.

**How to reverse.** Filter in `Schedule`. If it ever happens, mark rather than hide, so a
misclassification is cosmetic.

---

### D-052 · Canvas import is a button, not a scheduled job

**Decision.** Assignments are pulled into the task table when Victor presses *Import Canvas*.

**Why.** A nightly sync needs a paid tier, which he ruled out. A free-plan cron would also be
the one part of this able to fail silently at 3am with nobody watching — and there is still no
error reporting (finding F6). A button is honest about when the data was last pulled.

The action calls `updateTag("calendar")` before fetching, because otherwise it would re-read
the 15-minute cache and appear to do nothing.

**How to reverse.** Move the body into a route handler and point a cron at it, once something
watches for failures.

---

### D-051 · Calendar comes from private iCal URLs, via ical.js

**Decision.** Both feeds are read from the secret iCal URLs Google Calendar and Canvas publish
(`GOOGLE_CALENDAR_KEY`, `CANVAS_CALENDAR` — Victor's own names, kept rather than renamed to
match the plan). Parsing uses `ical.js`.

**Why.** No OAuth, no consent screen Google must review, no refresh-token rotation, and no
cost — the objection D-034 raised against calendar sync in V1 does not apply to a feed URL.
The URL *is* the credential, so it lives in the environment and never reaches the browser.

`ical.js` rather than something hand-rolled, because the real feed has 37 recurring rules with
`UNTIL`/`BYDAY`, one VTIMEZONE, nested VALARM blocks and 50 all-day entries. A homemade RRULE
expander gets DST wrong, and the symptom is a class that silently stops appearing.

Two details that cost time: `TimezoneService.register` takes `(component, name?)`, not
`(name, component)` — reversed, it type-checks in plain JS and registers nothing, putting
every event seven hours out. And occurrences are capped at 400 per rule, which the real feed
needed: it contains an unbounded monthly recurrence that otherwise expands to 2058.

**Known limitation, not a defect.** As of 2026-08-22 the Canvas feed is empty (211 bytes, zero
events) and Victor's Fall 2026 classes are not yet in Google Calendar — the recurring classes
in the feed are Fall 2025 and have ended. The pipeline is correct and will fill in; the UI says
so rather than looking broken.

**How to reverse.** Unset the variables; every page keeps working without them.

---

### D-050 · One Postgres per test file, truncated between tests

**Decision.** `src/test/pg.ts` builds one PGlite instance per file and `TRUNCATE ... RESTART
IDENTITY CASCADE`s between tests.

**Why.** The first version made a fresh database and re-ran every migration for *each* test.
With three database test files running concurrently it took 88–155s and, once, failed three
tests that passed on a re-run. A suite that is flaky teaches you to ignore red, which is worse
than having no suite. Now **7s**, and deterministic.

The table list is parsed out of the migration SQL rather than hand-written, because a
hand-written list silently stops truncating a table added later.

**How to reverse.** Go back to per-test instances. Do not.

---

### D-049 · Dictation is feature-detected with `useSyncExternalStore`

**Decision.** The dictate button reads support through `useSyncExternalStore` with a server
snapshot of `false`, and renders nothing when the API is absent.

**Why.** Two constraints met at once. `window` does not exist on the server, so detecting
during render would break hydration; setting state in an effect is what the React lint rule
warns about and causes a cascading render. `useSyncExternalStore` is built for exactly this —
external, non-reactive state — and gives a clean server snapshot.

Rendering nothing rather than a disabled button is deliberate: Safari on iOS has no Web Speech
API, and a control that visibly does nothing is worse than no control.

**How to reverse.** Feature-detect however you like, but do not set state in an effect.

---

### D-048 · Log entries are one table with JSONB fields

**Decision.** `log_entries` holds all six categories: a `category`, an `occurredAt`, a `note`,
and per-category fields in `jsonb`. `searchText` is denormalised on write.

**Why.** The alternative was a column per field across every category — mostly nulls, and a
migration every time Victor wants a field changed. D-039 promises that changing fields is
cheap, and a migration per edit is not cheap.

`searchText` is written by `createEntry` rather than by callers, for the same reason
`bumpUpdated` lives in `writeVaultFile`: an entry whose caller forgot would exist but never be
findable again.

Search uses `plainto_tsquery`, not `to_tsquery` — the latter raises a syntax error on a bare
`&`, so a stray character in the search box would 500 the page. A test covers that.

**How to reverse.** Promote hot fields to real columns; the JSONB stays for the rest.

---

### D-047 · Categories are data, and the form is generated from them

**Decision.** `lib/log/categories.ts` declares six categories and their fields. One
`LogForm` renders any of them; the summary line, the search index and the validation all read
the same definitions.

**Why.** Six bespoke forms would be six places to change when Victor edits the fields, and
D-039 committed to that being a one-file edit. Tests assert the structural invariants that
matter — unique field names, options on every select, and **no category longer than eight
fields**, because the constraint from Q16 is that a log must be fillable in fifteen seconds.

Deliberately absent: any mood or energy scale. Victor put that in V3, and a 1–5 filled in from
habit rather than reflection is worse than nothing. A test pins that too.

**How to reverse.** Edit the array. That is the whole point.

---

### D-046 · The freshness walk is memoised at module scope

**Decision.** `loadFreshness` caches the 34-file disk read in a module-level variable.

**Why.** The vault ships inside the serverless bundle, so its contents are fixed for the life
of a deployment — re-reading every file on every request was repeated work with no possible
change to find. Module scope is the right cache: it survives across requests in a warm
function and is discarded automatically when a new deployment starts a new instance, so there
is no invalidation to get wrong. Ages are still computed per call, since those move with the
clock rather than the files.

**How to reverse.** Call `readVaultFiles()` directly; `resetFreshnessCache()` already exists
as the test seam.

---

### D-045 · Loading boundaries and streaming, because the server cannot get faster

**Decision.** A `loading.tsx` under `/private`, and a Suspense boundary around every
database or GitHub read on Today, Work, Academics, Athletics, Calendar and Hobbies.

**Why.** Victor reported it still felt slow after D-042 made the server measurably faster, so
I measured the thing I had not: production. `/signin` — a dynamic page with *no* database and
*no* API call — costs 335–440ms of Vercel function time, against 70ms to connect. That
overhead is not mine to remove, and it is paid on every navigation because every private page
is `force-dynamic`.

The mistake was optimising server time when the problem was that **nothing appeared on screen
while it ran**. With no loading boundary the App Router has nothing to show, so a click left
the old page sitting there and the app read as frozen rather than busy.

Measured after: TTFB 50–110ms across every private page, and the streaming order is verified
in the HTML — the shell and skeleton ship at byte ~6.7k, the content arrives at ~30k.

This also matters most exactly when the app feels worst: Neon's free tier suspends after a
few minutes idle, so the first query after a break is slow. The shell no longer waits for it.

**How to reverse.** Delete `loading.tsx` and unwrap the Suspense boundaries. Do not, unless
the pages stop being `force-dynamic`.

---

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

> **Amended by D-098 (2026-08-25):** the account is now a *list* — `PASSKEYS`, one
> `label:credentialId:publicKey` entry per device — so more than one device can be signed in.
> The two variables named here are still read as a single unlabelled credential. What this entry
> got right is unchanged and is the reason the amendment was cheap: no database, no vendor,
> credentials in the environment.

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

### D-094 · The canonical URL is `www` — **reversed 2026-08-25, same day**

Superseded by D-096 within hours, at Victor's request: he wants the bare `victorgusev.com`.

D-094 was not wrong so much as premature. It described how the domain had happened to be
connected — Vercel was serving `www` as primary — and promoted that accident to a decision
before anyone had been asked which they preferred. The lesson is narrow and worth keeping:
*a setting you discovered is not a decision you made.*

It never reached production. `NEXT_PUBLIC_SITE_URL` was unset the whole time it existed, so
the deployed site never advertised the `www` canonical it specified.

The original entry, for the record:

> ### D-094 · The canonical URL is `www`, because that is what is served
>
> **Decision.** The three `NEXT_PUBLIC_SITE_URL` fallbacks in `layout.tsx`, `robots.ts` and
> `sitemap.ts` are `https://www.victorgusev.com`.
>
> **Why.** Vercel is serving `www` as primary and redirecting the apex to it. Canonical URLs,
> the sitemap and Open Graph metadata should name the origin that actually answers, or every
> indexed URL is a redirect hop.
>
> These are *fallbacks*: the environment variable still wins, and setting it in Vercel is what
> actually moves the deployed site. They matter because the fallback is what runs when the
> variable is missing — which is exactly the state the production deployment was in.
>
> **How to reverse.** If the apex is made primary in Vercel instead, change these three strings
> and `NEXT_PUBLIC_SITE_URL` together. Thanks to D-095 the passkey survives that change; nothing
> else does automatically.
