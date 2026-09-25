---
updated: 2026-09-24
domain: engineering
stability: volatile
summary: V5 — make the vault useful to an AI again and make Today and Training usable. Two tracks, 35 points, from the 2026-09-24 audit. Nothing built yet.
read_when: Deciding what to do next in web/ or in the vault, after V4 Phase 8.
---

# 2ndMind — V5: context and cleanup

**Scoped 2026-09-24** from a whole-project audit. Victor picked two tracks out of four:
**A · Fix the AI context** and **B · Today + Training cleanup**. The other two (security and
data safety, job-hunt features) are listed at the end as open, not dropped.

Points mean the same thing as in `V4_PLAN.md`: difficulty, about one focused hour each, not a
schedule. No deadline.

## The thesis

> **The vault answers "what is going on" in one read, and every screen shows one way to do each
> thing.**

The audit found the second brain's two jobs had drifted apart. The app kept getting better while
the vault — the part any AI reads — filled up with build history. And Today grew a new input with
each phase, so it now has four ways to add something.

## What the audit measured (2026-09-24)

- Live vault context is **~209 KB**, not the ~27 KB `CLAUDE.md` claims. `current_sprint.md` alone
  is **62 KB** and ~790 lines, almost all of it V1–V4 build diary.
- Today's AI summary reads `current_sprint.md` → "1. Active Sprint Goals". On 2026-09-21 it told
  Victor to "start V4 Phase 5" and "paste the push env vars" — both long done. The real goals live
  in Postgres (the Goals panel), which the summary never sees, and that panel is empty.
- Five `volatile` files are 26–35 days old, so the "stale" badge on Today never goes away.
- Today on a phone has **four** inputs that create something, three stat cards reading 0 / 0 / 0,
  an always-open goals form, and today's training ~1,400px down. On desktop the right column is
  empty below 500px.
- Training → Records is **~6,200px** tall on a phone, much of it explanatory prose — the thing
  Q130 says defeats the point.

## Order

**A1 → A4 → B1–B4 → A2 → B5–B7 → A5 → A6.** A3 waits for R0.

A1 goes first because it also stops the daily summary quoting stale text, before A2 fixes that
properly. The Today work (B1–B4) comes before A2 because A2 changes where the goals panel reads
from, and B3 is already rebuilding that panel.

---

## R0 · On Victor — repo visibility

The audit found vault files in the repository that should not be public. Victor is changing the
repository's visibility; details are in the private write-up, not here. **A3 cannot start until
this is done**, because it would commit private data into the repo every night.

---

## Track A · Fix the AI context — 16 pts

| #  | Item | Pts |
| -- | ---- | --: |
| A1 | **Shrink the sprint file.** `current_sprint.md` to under 5 KB: three goals (engineering/career, athletics, academics), this week's dated items, what is waiting on Victor, the operating rules. The V1–V4 history moves verbatim to `docs/BUILD_LOG.md`, which no load order points at. **Done when** the file is under 5 KB and the next daily summary no longer mentions finished V4 work | 2 |
| A2 | **One home for goals.** The Goals panel (Postgres, D-080) is the source. `AiSummary` in `app/private/page.tsx` reads goals from there instead of from the sprint file's section. The sprint file keeps goals only as a copy written by A3. **Done when** saving a goal changes the next summary, and nothing reads goals out of markdown | 3 |
| A3 | **A generated `context/04_operations/now.md`.** A nightly job writes one small file: this week's goals, the challenge day and ledger, the next seven days of deadlines, application counts from the sheet, and seven days of log summaries. Any AI then gets current state in one read — today, what is in the database is invisible to every AI except the app's own summary call. **Two design points:** it commits through the GitHub Contents API, and a vault push redeploys the site (D-042), so it needs a Vercel ignored-build step that skips a build when `now.md` is the only change. And Vercel Hobby limits cron jobs — if the limit is hit, it rides on the evening job. **Blocked on R0** | 5 |
| A4 | **Doc cleanup pass.** Fix what the audit found wrong: `web/context.md` (says passkeys live in env with no database, "ships 2026-09-20", "four tables in Neon" then twelve with two listed twice, "two palettes", `form.tsx` notes contradicting D-330); `V4_PLAN.md` (three different done totals, "what is left is Phase 7", recharts in §6, 8.7 still carrying the closed Samsung check, 8.6's summary naming the wrong half); `AGENTS.md` calling GPA and phone private (both deliberately public, D-353); `CLAUDE.md`'s size claim; the decision log's "next ID" line. Test counts become "run `npm test`" — a typed count has gone stale four times | 3 |
| A5 | **A size budget for the docs.** A test that sums the live vault (everything `CLAUDE.md` routes to, excluding `99_archive/`) and fails above a committed budget that only goes down — the same ratchet as the bundle gate (D-329). Per-file caps for `current_sprint.md` and `now.md` | 2 |
| A6 | **Stale badge that means something.** `degree_audit.md` is generated and `logbook_archive.md` was retired (D-173) — both become `stable`. `internship_pipeline.md`, `coursework_and_labs.md` (fall term classes) and `proof.md` need content only Victor has; listed for him, not invented | 1 |

## Track B · Today + Training cleanup — 19 pts

Every change here is measured with `npm run shots` on a populated day (D-083; D-167's rule 3 —
an empty calendar hid a 936px regression once), gets a before/after with `shots:save` /
`shots:compare` (D-324), and a `DECISIONS.md` entry.

| #  | Item | Pts |
| -- | ---- | --: |
| B1 | **One capture box on Today.** Remove Inbox's "Jot it down" and "Add a task" and the add-task row under Due. The capture box's Task mode gains the due-date field. D-284 keeps the box *below* the Due list and that stays; what changes is that it is the only input. Watch where `data-first-action` lands | 3 |
| B2 | **Stats into the heading.** The three stat cards become one line in the Due panel's meta: "0 due · 0 overdue · 0 done". Overdue keeps its amber when non-zero (D-287) | 1 |
| B3 | **Goals as text.** Read-only with an Edit button, instead of three always-open inputs reading "Leave blank to clear". Empty goals say so in one line with Edit beside it | 2 |
| B4 | **Today's session moves up.** Phone: directly under Due. Desktop: the right column, under Schedule, which is empty below 500px today | 2 |
| B5 | **"Make task" on unsorted notes.** Creates a task and removes the note, with an undo toast (D-263). It does not widen `fileEntry`'s one-way guard (D-164) — it is a new action, not a new filing target | 2 |
| B6 | **Split Training → Records.** Records and Body become separate tabs. The weigh-in form leaves (Log already has the Weigh in category — D-221, one home); Hevy import moves to Settings. Explanatory paragraphs go behind an ⓘ disclosure. **Target:** under 2,000px on a 390px phone, from ~6,200 | 5 |
| B7 | **Labels and dead code.** Tab bar "Next" → Calendar; sidebar "Now" → Updates (the public `/now` it named is gone, D-342). "Day 1 of 75" → "Day 1 of 76" or "75 to go" (days run 0–75). Delete the retired voice entry — `/api/voice/parse`, `voice-entry.tsx` and its import in `log-form.tsx` (D-186 says "code to be deleted") | 4 |

---

## Decisions this plan touches

D-080 (goals in Postgres), D-164 (the filing guard), D-173 (retired sprint review), D-186 (voice),
D-221 (bodyweight's one home), D-263 (undo toasts), D-284 and D-182 (capture box position),
D-287 (overdue colour), D-329 (ratchet gates), D-342 (`/now` removed). Read each before changing
what it covers.

## Also open from the audit — not in V5 yet

Ranked. Victor chose the two tracks above first; these wait, they are not dropped.

- **Critical · R0** above.
- **High · No backups.** Everything logged since August exists only in Neon. Weekly export to the
  private vault repo (after R0), plus a "Download my data" button.
- **High · No lost-device story.** No list of enrolled passkeys, no way to remove one, sessions
  cannot be revoked. A Devices section in Settings, and sessions that check their credential
  still exists.
- **Medium · Sign-out leaves the offline copy readable** at `/cached`. Downgraded from high on
  2026-09-24: Victor signs in only on his own phone and laptop, which D-131 covers.
- **Medium · No CI.** Lint currently fails with 7 `set-state-in-effect` errors and nothing ran it.
  A GitHub Action for typecheck, lint, test and `tokens:check`.
- **Medium · The test suite takes 160s** (28s after D-172), with 38 `act()` warnings in the
  session-logger tests.
- **Low ·** registration secret in a GET query string; `userVerification: "preferred"` on login;
  the home page's `<title>` is "About"; seven fonts preloaded on every page; the "done" badge on
  public project cards.
- **Job-hunt features** (Victor's fourth option): application pace against the 5/day target on
  Today, a follow-up nudge at 14 days, Tailor from a sheet row, a weekly review that also restores
  the two steps D-173 left unreplaced.
