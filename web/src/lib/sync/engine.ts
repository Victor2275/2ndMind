import { HlcClock, HlcDriftError } from "@/lib/sync/hlc";
import { isEntity, MAX_OPS, type ChangeRow, type SyncResponse } from "@/lib/sync/protocol";
import {
  applyRemote,
  deviceId,
  forgetOp,
  getCursor,
  loadClock,
  markFailed,
  pendingBatch,
  retryLater,
  saveClock,
  setCursor,
  setLastSyncAt,
  type OutboxOp,
  type SyncDb,
} from "@/lib/sync/store";

/**
 * The flush (V3 §1.3, `docs/SYNC_DESIGN.md` §6).
 *
 * Push the outbox, merge what comes back, advance the cursor. `post` is injected rather than
 * calling `fetch` directly, so every branch of the failure taxonomy below is a test rather
 * than a thing to stage with a network.
 *
 * This module decides *what* happens on each outcome. It does not decide *when* to run —
 * that is `SyncRunner`.
 */

export type SyncOutcome =
  | { status: "idle"; reason: "offline" | "nothing-to-do" }
  | { status: "synced"; pushed: number; merged: number; hasMore: boolean }
  | { status: "auth" }
  | { status: "transient"; message: string }
  | { status: "permanent"; message: string };

export type Poster = (body: { ops: OutboxOp[]; since: number }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/** Backoff for transient failures: 1s, 2s, 4s… capped at five minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(1_000 * 2 ** Math.max(0, attempts - 1), 5 * 60 * 1_000);
}

/** The oldest pending op's age, for the escalating warning past 24 hours (§1.7). */
export async function oldestPendingAgeMs(db: SyncDb, now = Date.now()): Promise<number | null> {
  const batch = await pendingBatch(db, MAX_OPS);
  if (batch.length === 0) return null;
  return now - Math.min(...batch.map((op) => op.createdAt));
}

export async function flush(
  db: SyncDb,
  post: Poster,
  options: { online?: boolean } = {},
): Promise<SyncOutcome> {
  if (options.online === false) return { status: "idle", reason: "offline" };

  const ops = await pendingBatch(db, MAX_OPS);
  const since = await getCursor(db);

  // A flush with an empty outbox is still worth making: it is how changes made on the laptop
  // reach the phone. Only skip when there is nothing to send *and* nothing to ask for, which
  // never happens — so this is here to say the empty batch is deliberate, not an oversight.

  let response: Awaited<ReturnType<Poster>>;
  try {
    response = await post({ ops, since });
  } catch (error) {
    // Network-level: the request never got an answer. Transient by definition — the server may
    // well have applied it, which is exactly why every op carries an idempotency key.
    await holdAll(db, ops, 0, String(error));
    return { status: "transient", message: String(error) };
  }

  if (response.status === 401) {
    // Pause the whole flush. Retrying 100 ops against a dead session just burns them, and the
    // attempts counter would drive them into a five-minute backoff for a problem a sign-in
    // fixes instantly.
    return { status: "auth" };
  }

  if (response.status >= 500 || response.status === 429) {
    await holdAll(db, ops, response.status, `server returned ${response.status}`);
    return { status: "transient", message: `server returned ${response.status}` };
  }

  if (!response.ok) {
    // A 4xx that is not 401 means the *request* was malformed — a client bug or schema skew,
    // not bad luck. Failing the batch surfaces it instead of looping on it forever.
    const message = `server rejected the batch (${response.status})`;
    for (const op of ops) {
      await markFailed(db, op.opId, { at: Date.now(), status: response.status, message });
    }
    return { status: "permanent", message };
  }

  const body = (await response.json()) as SyncResponse;

  for (const result of body.results ?? []) {
    if (result.status === "rejected") {
      // Permanent and surfaced. Never auto-retried: retrying bad data is an infinite loop.
      await markFailed(db, result.opId, {
        at: Date.now(),
        status: 422,
        message: result.reason ?? "rejected",
      });
      continue;
    }
    // applied, duplicate, stale and superseded all mean the same thing to the outbox: this op
    // has nothing left to do. Keeping them apart is for the retry screen and for debugging a
    // sync that looks stuck, not for control flow here.
    await forgetOp(db, result.opId);
  }

  // Before merging: drag this device's clock past every stamp it just saw. `flush` is the
  // only place a remote stamp ever arrives, so it is the only place this can happen — and
  // without it the clock is monotonic but not *causal*, which loses edits. See `absorbStamps`.
  await absorbStamps(db, body.changes ?? []);

  let merged = 0;
  for (const change of body.changes ?? []) {
    if (!isEntity(change.entity)) continue; // A table this build does not know about yet.
    const changed = await applyRemote(db, change.entity, {
      row: change.row,
      updatedHlc: change.updatedHlc,
      deletedAt: change.deletedAt,
      serverSeq: change.serverSeq,
    });
    if (changed) merged += 1;
  }

  // Only after every change is durably merged. Advancing first and crashing here would skip
  // those rows forever, because the cursor is the only record of what has been seen.
  if (typeof body.cursor === "number" && body.cursor > since) {
    await setCursor(db, body.cursor);
  }

  // Recorded only on a flush that got a real answer, which is what makes it meaningful as an
  // "as of" on a cached screen (§2.1). A failed attempt is not freshness.
  await setLastSyncAt(db, Date.now());

  return {
    status: "synced",
    pushed: body.results?.length ?? 0,
    merged,
    hasMore: body.hasMore === true,
  };
}

/**
 * Feed every stamp this device just pulled into its own clock, and persist the result.
 *
 * Skipping this is a *silent* data-loss bug, and it is worth spelling out because the code
 * reads fine without it. Say the phone's clock is three days fast — the Taiwan case the HLC
 * exists for. It writes a row; the laptop pulls it. The laptop's clock is correct, so its next
 * edit to that row is stamped three days *behind* the phone's, comes back `stale`, and is
 * discarded — then the next pull overwrites it on screen too. The edit disappears with no
 * error anywhere. `HlcClock.receive` is what prevents that, and until this call existed
 * nothing outside its own unit tests ever invoked it.
 *
 * A stamp beyond `MAX_DRIFT_MS` is skipped rather than absorbed, which is the whole point of
 * the bound: one badly-skewed peer must not drag this device forward permanently. The row
 * still merges — last-write-wins compares the strings and does not care about our clock.
 * Failing the flush instead would let one bad stamp wedge syncing entirely.
 *
 * Saved before the cursor advances, for the same reason the merge is: the cursor is the only
 * record of what has been seen, so it must never move past a stamp the clock has not absorbed.
 */
async function absorbStamps(db: SyncDb, changes: ChangeRow[]): Promise<void> {
  if (changes.length === 0) return;

  const clock = new HlcClock(await deviceId(db), Date.now, await loadClock(db));

  for (const change of changes) {
    try {
      clock.receive(change.updatedHlc);
    } catch (error) {
      // A malformed stamp is as untrustworthy as a skewed one, and neither is worth losing
      // the rest of the batch over.
      if (!(error instanceof HlcDriftError) && !String(error).includes("Malformed HLC"))
        throw error;
    }
  }

  await saveClock(db, clock.state);
}

/** Hold a whole batch for a later attempt, counting the failure against each op. */
async function holdAll(
  db: SyncDb,
  ops: OutboxOp[],
  status: number,
  message: string,
): Promise<void> {
  const at = Date.now();
  for (const op of ops) await retryLater(db, op.opId, { at, status, message });
}

/** The default `post`, used everywhere except tests. */
export const httpPoster: Poster = async (body) =>
  fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // The session cookie is same-origin and httpOnly; this is the default, stated because a
    // background fetch losing its credentials is a silent 401 loop.
    credentials: "same-origin",
  });
