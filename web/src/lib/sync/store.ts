import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import {
  ENTITIES,
  STORE_FOR,
  identityOf,
  isWritable,
  type Entity,
  type RowStore,
} from "@/lib/sync/entities";
import { compareHlc } from "@/lib/sync/hlc";

/**
 * The phone's local database (V3 §1.2, `docs/SYNC_DESIGN.md` §5, D-127).
 *
 * IndexedDB, because it is the only browser storage that survives a force-quit, a reboot and
 * a low-memory kill — which is the actual requirement: *an entry written with the radio off
 * survives a force-quit and a reboot.* `localStorage` is synchronous, size-capped and the
 * first thing evicted; it is fine for a remembered tab and useless for data nobody has sent
 * anywhere yet.
 *
 * Three things live here: a mirror of every syncable table, the outbox of changes not yet
 * accepted by the server, and a little metadata (this device's id, the clock, the pull cursor).
 *
 * This file holds no policy about *when* to sync. That is §1.3.
 */

/** A mirrored row, plus the bookkeeping sync needs to reason about it. */
export type LocalRecord = {
  /** `identityOf(entity, row)` — the primary key of the object store. */
  key: string;
  /** The row as the server would have it. */
  row: Record<string, unknown>;
  /** What last-write-wins compares. */
  updatedHlc: string;
  /** ISO string, or null. Deleted rows stay: a tombstone is a row, not an absence. */
  deletedAt: string | null;
  /** The cursor value this row arrived with, or null if it has never been to the server. */
  serverSeq: number | null;
  /**
   * 1 when this row carries local changes the server has not accepted, 0 otherwise. A number
   * rather than a boolean because IndexedDB cannot index booleans — a fact that is easy to
   * discover at runtime and annoying to discover late.
   */
  dirty: 0 | 1;
};

export type OutboxState = "pending" | "inflight" | "failed";

export type OutboxOp = {
  /** Makes the *operation* idempotent, and is what the retry screen addresses. */
  opId: string;
  entity: Entity;
  op: "create" | "update" | "delete";
  /** Makes the *row* idempotent. `identityOf` of the row this op concerns. */
  clientId: string;
  payload: Record<string, unknown>;
  hlc: string;
  state: OutboxState;
  attempts: number;
  lastError: { at: number; status: number; message: string } | null;
  /** Physical time. Used only for the 24-hour staleness warning — never for ordering. */
  createdAt: number;
};

export type SyncMeta = {
  deviceId: string;
  clock: { wallMs: number; counter: number };
  cursor: number;
  /** Epoch ms of the last flush that reached the server. Shown, never compared. */
  lastSyncAt: number;
};

interface SyncSchema extends DBSchema {
  outbox: {
    key: string;
    value: OutboxOp;
    indexes: {
      /**
       * Queue order. The HLC, not `createdAt`: every op in this outbox came from this device,
       * so its stamps are strictly increasing and give a total order with no ties. Two ops
       * written in the same millisecond have the same `createdAt`, and IndexedDB would then
       * return them in key order — which is a UUID, i.e. random. A create and its follow-up
       * update arriving in the wrong order is exactly the bug this avoids.
       */
      "by-hlc": string;
      "by-state": OutboxState;
      "by-client": string;
    };
  };
  meta: { key: string; value: unknown };
  log_entries: { key: string; value: LocalRecord; indexes: { dirty: number } };
  tasks: { key: string; value: LocalRecord; indexes: { dirty: number } };
  bodyweight_entries: { key: string; value: LocalRecord; indexes: { dirty: number } };
  rehab_completions: { key: string; value: LocalRecord; indexes: { dirty: number } };
  workouts: { key: string; value: LocalRecord; indexes: { dirty: number } };
  workout_sets: { key: string; value: LocalRecord; indexes: { dirty: number } };
  exercises: { key: string; value: LocalRecord; indexes: { dirty: number } };
  ai_summaries: { key: string; value: LocalRecord; indexes: { dirty: number } };
  routines: { key: string; value: LocalRecord; indexes: { dirty: number } };
  routine_exercises: { key: string; value: LocalRecord; indexes: { dirty: number } };
}

export type SyncDb = IDBPDatabase<SyncSchema>;

export const DB_NAME = "2ndmind";

/**
 * Bumped to 3 by V4 Phase 2++ Stage 2, which added the `routines` and `routine_exercises`
 * stores. Bumped to 2 by V4 Phase 2, which added `exercises`.
 *
 * The upgrade is written to be **re-runnable from any earlier version**, which is why it asks
 * `objectStoreNames.contains` rather than branching on `oldVersion`. A phone that has been
 * offline for a fortnight upgrades straight from 1 to 3 and a fresh install creates everything
 * at once; a version ladder would need every rung to stay correct forever, and the rung nobody
 * exercises is the one that breaks. The cost of getting this wrong is not a failed query — it
 * is `openSyncDb` throwing, which takes the whole local store with it. Missing this bump when a
 * store is added is exactly that cost: `openSyncDb` resolves without the new store, the first
 * transaction against it throws `NotFoundError`, and `withLocal`'s catch swallows it — the
 * screen renders empty with no error anywhere.
 */
export const DB_VERSION = 3;

export async function openSyncDb(name = DB_NAME): Promise<SyncDb> {
  return openDB<SyncSchema>(name, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("outbox")) {
        const outbox = db.createObjectStore("outbox", { keyPath: "opId" });
        outbox.createIndex("by-hlc", "hlc");
        outbox.createIndex("by-state", "state");
        outbox.createIndex("by-client", "clientId");
      }

      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");

      for (const entity of ENTITIES) {
        const name = STORE_FOR[entity];
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: "key" });
        store.createIndex("dirty", "dirty");
      }
    },
  });
}

/* ------------------------------------------------------------------ metadata */

/**
 * This install's device id, created once and never again.
 *
 * It is the final tiebreak in every HLC comparison, so it has to be stable across reloads —
 * a device that re-rolled its id on each launch could tie with its own past stamps.
 */
export async function deviceId(db: SyncDb): Promise<string> {
  const existing = (await db.get("meta", "deviceId")) as string | undefined;
  if (existing) return existing;

  const fresh = crypto.randomUUID();
  await db.put("meta", fresh, "deviceId");
  return fresh;
}

export async function loadClock(db: SyncDb): Promise<{ wallMs: number; counter: number }> {
  const state = (await db.get("meta", "clock")) as SyncMeta["clock"] | undefined;
  return state ?? { wallMs: 0, counter: 0 };
}

export async function saveClock(
  db: SyncDb,
  state: { wallMs: number; counter: number },
): Promise<void> {
  await db.put("meta", state, "clock");
}

export async function getCursor(db: SyncDb): Promise<number> {
  return ((await db.get("meta", "cursor")) as number | undefined) ?? 0;
}

export async function setCursor(db: SyncDb, cursor: number): Promise<void> {
  await db.put("meta", cursor, "cursor");
}

/* --------------------------------------------------------------- local reads */

/** Live rows for one entity, tombstones filtered out. */
export async function listLocal(db: SyncDb, entity: Entity): Promise<LocalRecord[]> {
  const all = await db.getAll(STORE_FOR[entity]);
  return (all as LocalRecord[]).filter((record) => record.deletedAt === null);
}

export async function getLocal(
  db: SyncDb,
  entity: Entity,
  key: string,
): Promise<LocalRecord | undefined> {
  return (await db.get(STORE_FOR[entity], key)) as LocalRecord | undefined;
}

/** Everything still waiting to reach the server, for the pending badge. */
export async function pendingCount(db: SyncDb): Promise<number> {
  return db.countFromIndex("outbox", "by-state", "pending");
}

export async function failedOps(db: SyncDb): Promise<OutboxOp[]> {
  return db.getAllFromIndex("outbox", "by-state", "failed");
}

/**
 * Everything in the outbox, whatever its state — what §1.7's screen and badge both read.
 *
 * Unbounded on purpose, unlike `pendingBatch`. That batch is capped because it becomes one
 * HTTP request; this is a list of things that have not arrived, and truncating it would mean
 * an entry that exists, is not synced, and is not shown — which is the one outcome §1.7 is
 * there to prevent.
 */
export async function allOps(db: SyncDb): Promise<OutboxOp[]> {
  return (await db.getAll("outbox")) as OutboxOp[];
}

/**
 * When the last flush actually reached the server, as epoch milliseconds.
 *
 * Physical time, and the one place in sync where that is right: it is shown to a person, not
 * compared with anything. `updatedHlc` orders events; this answers "how old is what I am
 * looking at", which is the question every cached screen in §2.1 has to answer.
 */
export async function getLastSyncAt(db: SyncDb): Promise<number | null> {
  return ((await db.get("meta", "lastSyncAt")) as number | undefined) ?? null;
}

export async function setLastSyncAt(db: SyncDb, at: number): Promise<void> {
  await db.put("meta", at, "lastSyncAt");
}

/* -------------------------------------------------------------- local writes */

/**
 * Record a local change: update the mirror and queue the op, **in one transaction**.
 *
 * The atomicity is the point. Written separately, a crash between the two writes leaves either
 * a change the user can see that will never sync, or an op for a row that is not there. Both
 * are silent, and the first is the worse of the two: it looks like it worked.
 */
export async function enqueue(
  db: SyncDb,
  input: {
    entity: Entity;
    op: OutboxOp["op"];
    row: Record<string, unknown>;
    hlc: string;
    opId?: string;
  },
): Promise<OutboxOp> {
  const { entity, op, row, hlc } = input;

  if (!isWritable(entity)) {
    // A programming error, not a user-facing one: these tables are pull-only by design, and
    // an op for one of them would be rejected by the server after a round trip.
    throw new Error(`${entity} is pull-only and cannot be written from this device`);
  }

  const key = identityOf(entity, row);
  const storeName: RowStore = STORE_FOR[entity];

  const outboxOp: OutboxOp = {
    opId: input.opId ?? crypto.randomUUID(),
    entity,
    op,
    clientId: key,
    payload: row,
    hlc,
    state: "pending",
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
  };

  const tx = db.transaction([storeName, "outbox"], "readwrite");
  const existing = (await tx.objectStore(storeName).get(key)) as LocalRecord | undefined;

  const record: LocalRecord = {
    key,
    row: op === "delete" ? (existing?.row ?? row) : row,
    updatedHlc: hlc,
    deletedAt: op === "delete" ? new Date().toISOString() : null,
    // A row created offline has never been to the server, so it has no cursor value yet.
    serverSeq: existing?.serverSeq ?? null,
    dirty: 1,
  };

  await tx.objectStore(storeName).put(record);
  await tx.objectStore("outbox").put(outboxOp);
  await tx.done;

  return outboxOp;
}

/* ------------------------------------------------------------- the outbox */

/**
 * The next ops to send, in order.
 *
 * FIFO globally, with one exception that matters: **a failed op blocks later ops on the same
 * row, and nothing else.** Without the block, a rejected create is skipped and its follow-up
 * update lands on a row the server has never heard of. With a *global* block, one bad row
 * freezes all syncing — which is how an app stops working entirely because of one malformed
 * entry from a week ago. Per-row is the right granularity and costs one index.
 */
export async function pendingBatch(db: SyncDb, limit = 100): Promise<OutboxOp[]> {
  const tx = db.transaction("outbox", "readonly");
  const all = (await tx.store.index("by-hlc").getAll()) as OutboxOp[];
  await tx.done;

  const blocked = new Set(all.filter((op) => op.state === "failed").map((op) => op.clientId));

  const batch: OutboxOp[] = [];
  for (const op of all) {
    if (op.state !== "pending") continue;
    if (blocked.has(op.clientId)) continue;
    batch.push(op);
    if (batch.length >= limit) break;
  }
  return batch;
}

/** An op the server accepted — or had already applied, which is the same outcome for us. */
export async function forgetOp(db: SyncDb, opId: string): Promise<void> {
  const tx = db.transaction("outbox", "readwrite");
  const op = (await tx.store.get(opId)) as OutboxOp | undefined;
  await tx.store.delete(opId);
  await tx.done;

  // The row is only clean once nothing else is queued for it. Clearing the flag per-op would
  // mark a row settled while a later edit to it is still waiting.
  if (op) await clearDirtyIfSettled(db, op.entity, op.clientId);
}

/**
 * A transient failure: offline, a timeout, a 5xx. Stays `pending` and is never dropped — the
 * count is what drives backoff in §1.3.
 */
export async function retryLater(
  db: SyncDb,
  opId: string,
  error: OutboxOp["lastError"],
): Promise<void> {
  await patchOp(db, opId, (op) => ({
    ...op,
    state: "pending",
    attempts: op.attempts + 1,
    lastError: error,
  }));
}

/**
 * A permanent failure: a 400, a validation error, schema skew, or a clock beyond `MAX_DRIFT`.
 * Surfaced and never auto-retried, because retrying bad data is an infinite loop.
 */
export async function markFailed(
  db: SyncDb,
  opId: string,
  error: OutboxOp["lastError"],
): Promise<void> {
  await patchOp(db, opId, (op) => ({
    ...op,
    state: "failed",
    attempts: op.attempts + 1,
    lastError: error,
  }));
}

/** Put a failed op back in the queue — what the retry screen's button does after a fix. */
export async function requeue(db: SyncDb, opId: string): Promise<void> {
  await patchOp(db, opId, (op) => ({ ...op, state: "pending" }));
}

async function patchOp(
  db: SyncDb,
  opId: string,
  change: (op: OutboxOp) => OutboxOp,
): Promise<void> {
  const tx = db.transaction("outbox", "readwrite");
  const op = (await tx.store.get(opId)) as OutboxOp | undefined;
  if (op) await tx.store.put(change(op));
  await tx.done;
}

async function clearDirtyIfSettled(db: SyncDb, entity: Entity, key: string): Promise<void> {
  const remaining = (await db.getAllFromIndex("outbox", "by-client", key)) as OutboxOp[];
  if (remaining.length > 0) return;

  const storeName: RowStore = STORE_FOR[entity];
  const tx = db.transaction(storeName, "readwrite");
  const record = (await tx.store.get(key)) as LocalRecord | undefined;
  if (record) await tx.store.put({ ...record, dirty: 0 });
  await tx.done;
}

/* --------------------------------------------------------------- the merge */

/**
 * Apply a row that arrived from the server. Last-write-wins on the HLC, **per row, not per
 * field**.
 *
 * Field-level merge was considered and rejected: it produces rows that never existed on either
 * device, which is harder to reason about after the fact than losing one edit.
 *
 * @returns whether the local copy changed.
 */
export async function applyRemote(
  db: SyncDb,
  entity: Entity,
  incoming: {
    row: Record<string, unknown>;
    updatedHlc: string;
    deletedAt: string | null;
    serverSeq: number;
  },
): Promise<boolean> {
  const key = identityOf(entity, incoming.row);
  const storeName: RowStore = STORE_FOR[entity];

  const tx = db.transaction(storeName, "readwrite");
  const existing = (await tx.store.get(key)) as LocalRecord | undefined;

  // A local edit that has not been sent yet is not a conflict — the server has not seen it, so
  // it will win or lose on its own HLC when it is flushed. Overwriting it here would discard a
  // change the user made and never told them.
  const localWins =
    existing !== undefined &&
    (existing.dirty === 1 || compareHlc(existing.updatedHlc, incoming.updatedHlc) > 0);

  if (localWins) {
    // Still take the cursor value: the row *has* been seen at this sequence, and not recording
    // that means pulling it again on every sync forever.
    if (existing.serverSeq !== incoming.serverSeq) {
      await tx.store.put({ ...existing, serverSeq: incoming.serverSeq });
    }
    await tx.done;
    return false;
  }

  await tx.store.put({
    key,
    row: incoming.row,
    updatedHlc: incoming.updatedHlc,
    deletedAt: incoming.deletedAt,
    serverSeq: incoming.serverSeq,
    dirty: 0,
  });
  await tx.done;
  return true;
}
