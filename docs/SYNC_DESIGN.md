# Sync design — V3 Phase 1

**Written 2026-08-30 · V3 §0.3 · Argued before any code exists**

This is the spec Phase 1 builds from. It is written now, on a plane, deliberately: a sync bug
found in November is a bug in code written in a hotel room in September, and the expensive
mistakes here are the ones baked into a schema.

Decisions and reversals live in `web/DECISIONS.md` **D-127** (identity and ordering),
**D-128** (offline unlock) and **D-129** (failure handling). This document is the *how*; those
entries are the *why* and the *how to undo*.

---

## 0. What was found by reading the real schema

The scoping session said "client UUIDs on creates, last-write-wins on edits". Reading
`web/src/lib/db/schema.ts` sharpened that into three findings that change the work:

1. **Only four tables actually need a client-generated id.** Three already have natural keys
   that make an offline create idempotent for free. Adding a UUID to those would be ceremony.
2. **`rehab_completions` cannot sync as built.** Toggling it is *insert-or-hard-delete*. A hard
   delete leaves nothing to compare, so last-write-wins has no way to decide between a phone
   that un-ticked and a laptop that ticked. It needs a tombstone.
3. **Almost nothing has an `updated_at`.** Every table has `created_at`; only `tasks` and
   `log_entries` even have `deleted_at`. Last-write-wins needs a modification time, so this is
   a migration, not a code change.

None of these were visible from the plan. All three are cheap now and expensive in Phase 1.

---

## 1. What syncs, and what does not

| | Direction | Mechanism |
|---|---|---|
| Postgres rows — logs, tasks, workouts, bodyweight, rehab | **Both ways** | Outbox + pull cursor (this document) |
| AI summaries | Server → phone only | Pull only; the phone never creates one |
| Rendered vault pages — Today, Athletics, School | Server → phone only | Service-worker cache, no writes |
| The public site | Server → phone only | Service-worker precache (D-130) |
| Vault markdown | **Neither** | Read-only on the phone; editing it offline was declined |

The last row is what keeps this tractable. Markdown writes go through the GitHub Contents API
one commit at a time, and queueing a week of them offline produces either commit spam or silent
overwrites. Read-only sidesteps the entire problem.

---

## 2. Identity — which tables need a client id

A create must be safe to retry. Retrying is required, because failed writes are held and
retried rather than dropped (D-129) — so without an idempotency key, every flaky connection
manufactures duplicate rows. This is the same problem D-026 already solved for Hevy imports
with a derived `external_id`.

**Tables that need `client_id uuid`** — no natural key, so two identical rows are legitimate:

| Table | Why it has no natural key |
|---|---|
| `log_entries` | Logging "Bench Press 185×5" twice in one session is a real thing to do |
| `tasks` | Two tasks may legitimately share a title and a due date |
| `workouts` | `external_id` is null for hand-logged sessions — only Hevy imports have one |
| `workout_sets` | Same set, same weight, same reps, twice in a row is normal |

**Tables that do not** — a natural key already makes the write idempotent:

| Table | Natural key | Offline create resolves as |
|---|---|---|
| `bodyweight_entries` | `measured_on` | Upsert — one reading per morning, by existing design |
| `rehab_completions` | `(completed_on, slug)` | Upsert — a double-tap is already idempotent |
| `ai_summaries` | `(kind, period_start)` | Never created on the phone; pull-only |

```sql
ALTER TABLE log_entries  ADD COLUMN client_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE tasks        ADD COLUMN client_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE workouts     ADD COLUMN client_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE workout_sets ADD COLUMN client_id uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX log_entries_client_id_idx  ON log_entries  (client_id);
-- …one per table
```

The default matters: existing rows and rows created on the laptop get an id too, so
`client_id` is the **global identity for every row**, not just phone-created ones. The phone
never needs to know a server `serial` id, which removes the "what is this row called now"
problem after a create is accepted.

`serial` primary keys stay exactly as they are. Replacing them would touch every foreign key
and every query in the codebase for no benefit.

---

## 3. Ordering — the clock

Last-write-wins needs a comparable timestamp, and `Date.now()` on a phone is not one. The
failure is concrete: fly to Taiwan, the clock jumps, and from that moment the phone wins every
conflict for the rest of the day — including overwriting edits made later on the laptop.

### Hybrid logical clock

Each device keeps `{ wallMs, counter }` and stamps every local change with it.

```
local event:
  wall = max(physicalNow, last.wall)
  counter = (wall == last.wall) ? last.counter + 1 : 0

receiving a remote stamp r:
  wall = max(physicalNow, last.wall, r.wall)
  counter = …whichever branch the max came from, +1 on a tie
  REJECT r if r.wall > physicalNow + MAX_DRIFT   (10 minutes)
```

Encoded as a lexicographically sortable string: `<wallMs base36, padded>-<counter>-<deviceId>`.

Three properties, each earning its keep:

- **Monotonic per device.** The counter guarantees a device's own stamps always increase, even
  if its wall clock goes backwards.
- **Causal across devices.** Receiving a newer stamp drags this device's clock forward, so a
  reply to a change always sorts after it.
- **Bounded drift.** `MAX_DRIFT` stops a badly-skewed peer from poisoning the clock permanently.
  A rejected stamp is a *sync error*, surfaced like any other (§6), not a silent clamp.

`deviceId` is a random UUID stored once per install, used only as a final tiebreak so two
devices can never produce an identical stamp.

### The comparison rule

```
winner = max(hlc)          -- ties broken by deviceId, which is total and stable
```

Applied per row, not per field. Field-level merge was considered and rejected: it produces rows
that never existed on either device, which is harder to reason about than losing one edit.

### Schema

```sql
ALTER TABLE <each syncable table>
  ADD COLUMN updated_hlc text NOT NULL DEFAULT '0-0-server',
  ADD COLUMN updated_at  timestamptz NOT NULL DEFAULT now();
```

`updated_at` is a human-readable server-side receipt — *not* what LWW compares. Two clocks, two
jobs, and conflating them is how the timezone bug gets in.

---

## 4. Tombstones — the `rehab_completions` fix

`rehab_completions` toggles by insert-or-delete against `(completed_on, slug)`. Offline, that
breaks:

> Phone un-ticks "banded external rotation" for Tuesday while offline. Laptop ticks it the same
> evening. On sync there is no row on the phone and a row on the server — and no way to tell
> whether the phone *deleted* it or simply *never had it*.

The row must survive its own deletion:

```sql
ALTER TABLE rehab_completions ADD COLUMN deleted_at timestamptz;
```

Toggling becomes upsert-and-set-`deleted_at`, never `DELETE`. Every read filters
`deleted_at IS NULL`. `workouts`, `workout_sets` and `bodyweight_entries` get the same column
for the same reason.

**`workout_sets` cascade.** Sets are `ON DELETE CASCADE` from `workouts`. A soft delete does not
cascade, so deleting a workout offline must soft-delete the parent and let reads filter children
by the parent's state. The FK cascade stays for genuine hard deletes (there are none in normal
operation).

---

## 5. The outbox

IndexedDB store, in queue order:

```ts
type OutboxOp = {
  opId:     string;   // uuid — primary key, and what the retry screen addresses
  entity:   "log_entry" | "task" | "workout" | "workout_set"
          | "bodyweight" | "rehab";
  op:       "create" | "update" | "delete";
  clientId: string;   // uuid, or the natural key for the three tables that have one
  payload:  Record<string, unknown>;
  hlc:      string;
  state:    "pending" | "inflight" | "failed";
  attempts: number;
  lastError: { at: number; status: number; message: string } | null;
  createdAt: number;  // physical time, for the 24h staleness warning only
};
```

`clientId` makes the **row** idempotent; `opId` makes the **operation** idempotent. Both are
needed — `clientId` alone stops duplicate creates, but `opId` is what lets the server log
"already applied" distinctly from "applied", which is the difference between a working retry
and a silent no-op nobody can debug.

### Ordering rule

FIFO globally, with one exception that matters:

> **A `failed` op blocks later ops on the same `clientId`, and nothing else.**

Without this, a rejected create is skipped and its follow-up update lands on a row that does not
exist. With a global block, one bad row freezes all syncing. Per-row is the correct granularity
and costs one index on the outbox.

---

## 6. Flush and failure

Triggers: **reconnect**, **app foreground**, **manual pull-to-refresh**, and opportunistically
after a local write when already online.

```
flush():
  if offline: return
  batch = pending ops, FIFO, skipping any clientId with a failed op, max 100
  POST /api/sync { ops: batch, since: cursor }
  for each result:
    applied | duplicate  -> delete from outbox
    rejected             -> state = failed, store reason
  merge server changes   (§7)
  cursor = response.cursor
```

### Failure taxonomy

This table is the spec for D-129. Nothing is ever discarded.

| Class | Examples | Outbox state | Behaviour |
|---|---|---|---|
| **Transient** | Offline, timeout, 5xx | `pending` | Backoff 1s→2s→4s… capped at 5 min. `attempts++`. Never dropped. |
| **Permanent** | 400, zod failure, schema skew | `failed` | Surfaced immediately. Never auto-retried — a retry loop on bad data is an infinite loop. |
| **Auth** | 401 | `pending` | **Pause the whole flush.** Prompt sign-in. Retrying 100 ops against a dead session just burns them. |
| **Clock** | HLC beyond `MAX_DRIFT` | `failed` | Surfaced, because a drifting clock is a real fault, not noise. |
| **Conflict** | — | n/a | Cannot occur. LWW always has an answer; that is the point of choosing it. |

### What the user sees

- A badge with the pending count, always visible when non-zero.
- One screen listing failed ops with their reason, an edit affordance, and retry.
- **Escalating warning once the oldest pending op passes 24h** — the phone can be lost, and
  the mitigation for that is not letting the window grow, since nothing recovers a destroyed
  device.

---

## 7. The pull side

Cursor-based, on a **shared Postgres sequence** — not on `updated_at`. Timestamps are unsafe
cursors: two rows can share one, and any clock adjustment reorders history.

```sql
CREATE SEQUENCE sync_seq;

ALTER TABLE <each syncable table>
  ADD COLUMN server_seq bigint NOT NULL DEFAULT nextval('sync_seq');

CREATE INDEX <table>_server_seq_idx ON <table> (server_seq);
```

Bumped by a trigger, not by application code — app discipline fails silently, and the failure
mode is "changes stop reaching the phone", which nobody notices until data is missing:

```sql
CREATE FUNCTION bump_sync_seq() RETURNS trigger AS $$
BEGIN
  NEW.server_seq := nextval('sync_seq');
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
-- BEFORE INSERT OR UPDATE on each syncable table
```

Pull is `WHERE server_seq > :cursor ORDER BY server_seq LIMIT n` per table; the new cursor is
the max returned. Soft-deleted rows come through the same path, which is how a delete made on
the laptop reaches the phone.

**Tombstones are kept forever.** With one user and two devices there is no garbage-collection
pressure, and it matches D-131's "everything, forever".

---

## 8. Offline unlock (D-128)

| | |
|---|---|
| **Enrolment** | Unchanged. Online, server-verified, existing WebAuthn flow. |
| **Cached at first online unlock** | Credential id + public key, in IndexedDB |
| **Offline unlock** | `navigator.credentials.get()` with `userVerification: "required"`, assertion verified locally against the cached key via WebCrypto |
| **No cached credential** | Online sign-in required. The app does not open. |

**What it protects:** casual access to a running app by someone holding the unlocked phone.

**What it does not protect, stated so nobody assumes otherwise:**

- The challenge is generated locally, so there is no server-side replay protection. An attacker
  who can run code on the device can replay an assertion.
- The signature counter is not checked. Platform authenticators report 0 (already noted in
  D-018), so there is nothing to check.
- IndexedDB is **not encrypted** (D-131). A forensic read of the device gets the vault. This was
  offered as a ~6h encryption option and declined in favour of the biometric gate.

A cached session is still just a session: unlocking offline grants access to *local data only*.
The server re-validates on the next request and will 401 an expired session regardless.

---

## 9. What this design deliberately does not do

- **No field-level merge.** Row-level LWW. Field merge invents rows that never existed.
- **No conflict UI.** Offered at ~6h and declined; LWW always decides.
- **No operational transform / CRDT.** One user, two devices, and mostly appends. A CRDT is the
  right answer for concurrent editing of shared documents and the wrong answer for this.
- **No background sync guarantee.** A PWA service worker can be suspended by Samsung's battery
  optimizer (D-126). Foreground and reconnect triggers are what actually work.
- **No markdown sync.** §1.

---

## 10. The test list

This is the input to §1.4, which is held to the database layer's bar — real `fake-indexeddb`,
real outbox code, no mocks. Six cases were named in the plan; reading the schema added three.

| # | Case | Fails without |
|---|---|---|
| 1 | Create retried three times → one row | `client_id` unique index |
| 2 | Reconnect mid-flush → no partial batch corruption | Per-op results, not batch-level |
| 3 | Partial failure → good ops land, bad op holds | Per-op result handling |
| 4 | Duplicate flush → no double-apply | `opId` dedupe |
| 5 | Clock jumps forward 8h → phone does not win everything | HLC + `MAX_DRIFT` |
| 6 | Schema version skew → ops held, not dropped | Permanent-vs-transient split |
| 7 | Rehab un-tick offline vs tick online → deterministic | `deleted_at` tombstone (§4) |
| 8 | Failed op blocks its own row, not the queue | Per-`clientId` block (§5) |
| 9 | Bodyweight same day, two devices → one row, later HLC wins | Natural-key upsert (§2) |

---

## 11. Open questions — decide before §1.2, not during

1. **Does the phone create workouts at all,** or only log entries that a workout is derived
   from? Training is a fast log path (§1.6) and `log_entries` already has a Training category
   with weight/reps/SPM. If the phone only ever writes `log_entries`, `workouts` and
   `workout_sets` drop out of the outbox entirely and §2's migration halves.
   *Leaning: log-only. It is the smaller design and matches how the fast path already works.*
2. **Should `ai_summaries` be pull-only, or should the phone be able to request one?** Pull-only
   in this document. Requesting one offline needs a second queue for read-requests, which the
   scoping session declined.
3. **Batch size 100** is a guess. Measure once there is real data; the only cost of being wrong
   is latency on the first sync after a long gap.
