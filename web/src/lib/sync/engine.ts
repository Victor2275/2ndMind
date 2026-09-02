import { isEntity, MAX_OPS, type SyncResponse } from "@/lib/sync/protocol";
import {
  applyRemote,
  forgetOp,
  getCursor,
  markFailed,
  pendingBatch,
  retryLater,
  setCursor,
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

  return {
    status: "synced",
    pushed: body.results?.length ?? 0,
    merged,
    hasMore: body.hasMore === true,
  };
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
