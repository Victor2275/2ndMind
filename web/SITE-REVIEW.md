# Site review

Rounds of Victor's own review of the running site. Round 1's template is below, kept because
the round it belongs to was answered in `docs/REVIEW_ROUND_PLAN.md` rather than here.

**Round 2 is the one that matters now** — it is V4 §7.6, and it became V4 Phase 8.

---

## Round 2 — 2026-09-22 · V4 §7.6

Reviewed against the live app rather than a `npm run freeze` snapshot; freezing exists for
reviewing with no connection, and this was done with one.

**Not page by page, and that is the finding.** Round 1 returned a list of things that looked
wrong on named pages. This round returned two complaints about the app as a whole and **nothing
visual**, which is the closest thing to evidence that Milestones C and D landed.

### What came back

1. **"The performance of certain aspects of the website is slow."**
2. **"It is unclear when something is logged/saved."**
3. A hypothesis, offered to be checked rather than implemented: *git is being used to log
   certain things; saving to a faster database with a single button to push to git would be
   better — unless that is slower.*
4. A seventeen-item audit list: caching API responses, load balancing, database indexing, image
   compression, loading skeletons, caching expensive queries, debouncing input handlers, code
   splitting, a CDN, paginating large lists, compressing API payloads, removing unnecessary
   re-renders, minifying JS and CSS, lazy loading, deferring non-critical scripts, removing
   unused dependencies, and database connection pooling.

### What the check found

**(3) is right in kind and wrong in scale.** Two write paths still commit to git — publishing a
project update and saving the course plan. Everything else went to Postgres in V2 (D-036,
D-037). The migration he is asking for has mostly already happened.

**The commit is load-bearing, which the hypothesis did not account for.** `/now` builds fully
static from the vault on disk, so a commit and the rebuild behind it are the *only* way a
published update reaches the public site. Buffering in Postgres and pushing later does not just
defer latency — it decides when the public page changes. That is why D-325 took the outbox route
instead: it makes the save instant without moving the source of truth or opening a divergence
window.

**The measured problem is on the read side and in the bundle, not in the writes.** The public
portfolio ships **220.7 KB** of gzipped JavaScript against a 90 KB budget, and **64.1 KB of it is
`zod`** — on a site that validates nothing at runtime. Eight call sites render private pages off
a cached GitHub read.

**Four of the seventeen were already true** and are recorded as checked rather than skipped:
load balancing and the CDN are Vercel's edge network, minification is `next build`, and
`neon-http` has no connection pool to size.

**Answered in full as `docs/V4_PLAN.md` Phase 8** — 60 points, scoped the same day. Decisions
D-325 and D-326.

---

## Round 1 — snapshot 2026-08-27

What I like / don't like, page by page. Rough is fine; tidy later.

*Answered in `docs/REVIEW_ROUND_PLAN.md`; the per-page notes were returned as a change list
rather than written in here.*

## /

- 

## /now

- 

## /projects

- 

## /projects/five-second-rule

- 

## /projects/micromouse-simulator

- 

## /projects/proof

- 

## /projects/solenoid-bit-reader

- 

## /projects/taskable

- 

## /projects/water-bottle-scale

- 

## /resume/robotics

- 

## /resume/ml

- 

## /resume/swe

- 
