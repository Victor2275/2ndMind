import { gt, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "@/lib/db/schema";
import {
  aiSummaries,
  bodyweightEntries,
  logEntries,
  rehabCompletions,
  tasks,
  workouts,
  workoutSets,
} from "@/lib/db/schema";
import type { Entity } from "@/lib/sync/entities";
import { compareHlc } from "@/lib/sync/hlc";
import {
  MAX_CHANGES,
  PAYLOADS,
  type ChangeRow,
  type OpResult,
  type WireOp,
  type WritableEntity,
} from "@/lib/sync/protocol";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * The server half of sync (V3 §1.3, `docs/SYNC_DESIGN.md` §6–§7).
 *
 * Kept out of the route handler so it can be tested against real Postgres. The route is
 * authentication, parsing and a JSON response; everything that could lose data is here.
 */

/* ------------------------------------------------------------------- pushing */

/**
 * How the four writable tables are addressed and written. One entry per entity rather than a
 * generic column mapper: the tables genuinely differ — two are addressed by a client-generated
 * UUID and two by a natural key — and a generic version would be a worse lie than four honest
 * cases.
 */
const WRITERS = {
  log_entry: {
    table: logEntries,
    conflict: [logEntries.clientId],
    identity: (p: Record<string, unknown>) => String(p.clientId),
    columns: (p: Record<string, unknown>) => ({
      clientId: p.clientId as string,
      category: p.category as string,
      occurredAt: new Date(p.occurredAt as string),
      note: p.note as string,
      data: p.data as Record<string, unknown>,
      searchText: p.searchText as string,
    }),
  },
  task: {
    table: tasks,
    conflict: [tasks.clientId],
    identity: (p: Record<string, unknown>) => String(p.clientId),
    columns: (p: Record<string, unknown>) => ({
      clientId: p.clientId as string,
      title: p.title as string,
      source: p.source as string,
      domain: p.domain as string | null,
      courseCode: p.courseCode as string | null,
      dueAt: p.dueAt ? new Date(p.dueAt as string) : null,
      doneAt: p.doneAt ? new Date(p.doneAt as string) : null,
      notes: p.notes as string,
    }),
  },
  bodyweight: {
    table: bodyweightEntries,
    conflict: [bodyweightEntries.measuredOn],
    identity: (p: Record<string, unknown>) => String(p.measuredOn),
    columns: (p: Record<string, unknown>) => ({
      measuredOn: p.measuredOn as string,
      weightLbs: p.weightLbs as number,
      note: p.note as string,
    }),
  },
  rehab: {
    table: rehabCompletions,
    conflict: [rehabCompletions.completedOn, rehabCompletions.slug],
    identity: (p: Record<string, unknown>) => `${String(p.completedOn)}|${String(p.slug)}`,
    columns: (p: Record<string, unknown>) => ({
      completedOn: p.completedOn as string,
      slug: p.slug as string,
    }),
  },
} as const;

/** The identity string for an entity's row, matching `identityOf` on the client. */
function identityFor(entity: WritableEntity, payload: Record<string, unknown>): string {
  return WRITERS[entity].identity(payload);
}

type Decision =
  | { kind: "write"; op: WireOp; payload: Record<string, unknown> }
  | { kind: "result"; result: OpResult };

/**
 * Apply a batch of ops.
 *
 * Three things happen before anything is written, and each of them exists because of a
 * specific way this goes wrong:
 *
 * 1. **Validation**, per entity. A bad payload is `rejected` — permanent, surfaced, never
 *    auto-retried, because retrying bad data is an infinite loop.
 * 2. **Collapse by identity.** Two ops in one batch can address the same row (a create and
 *    then an edit). Postgres refuses an `ON CONFLICT DO UPDATE` that would touch one row
 *    twice — *"cannot affect row a second time"* — so only the highest-HLC op per row is
 *    written and the rest come back `superseded`. The client drops those, which is correct:
 *    the winner already contains their effect.
 * 3. **Compare against what is stored.** An op whose HLC *equals* the stored one is a
 *    `duplicate` — this exact op landed and the response was lost on the way back. One whose
 *    HLC is lower is `stale` — a newer write already won, so the op is satisfied. Both mean
 *    "stop sending this", and neither is a failure.
 *
 * That third point is why there is no table of applied operation ids. `SYNC_DESIGN.md` §5
 * asked for `opId` to distinguish "applied" from "already applied", and the stored HLC does it
 * for free: stamps are unique per device and strictly increasing, so equality *is* identity.
 */
export async function applyOps(db: Db, ops: WireOp[]): Promise<OpResult[]> {
  const results = new Map<string, OpResult>();

  // Group by entity so each table needs one read and one write, not one per op.
  const byEntity = new Map<WritableEntity, Decision[]>();

  for (const op of ops) {
    const schemaFor = PAYLOADS[op.entity as WritableEntity];
    if (!schemaFor) {
      results.set(op.opId, { opId: op.opId, status: "rejected", reason: "unknown entity" });
      continue;
    }

    const parsed = schemaFor.safeParse(op.payload);
    if (!parsed.success) {
      results.set(op.opId, {
        opId: op.opId,
        status: "rejected",
        reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      continue;
    }

    const payload = parsed.data as Record<string, unknown>;

    // The client's own idea of the row's identity has to match what the payload says, or an op
    // could be queued against one row and applied to another.
    if (identityFor(op.entity as WritableEntity, payload) !== op.clientId) {
      results.set(op.opId, {
        opId: op.opId,
        status: "rejected",
        reason: "clientId does not match payload identity",
      });
      continue;
    }

    const list = byEntity.get(op.entity as WritableEntity) ?? [];
    list.push({ kind: "write", op, payload });
    byEntity.set(op.entity as WritableEntity, list);
  }

  for (const [entity, decisions] of byEntity) {
    const writes = decisions.filter((d) => d.kind === "write");

    // Collapse to one op per row, keeping the latest stamp.
    const winners = new Map<string, { op: WireOp; payload: Record<string, unknown> }>();
    for (const { op, payload } of writes) {
      const current = winners.get(op.clientId);
      if (!current || compareHlc(op.hlc, current.op.hlc) > 0) {
        if (current) {
          results.set(current.op.opId, { opId: current.op.opId, status: "superseded" });
        }
        winners.set(op.clientId, { op, payload });
      } else {
        results.set(op.opId, { opId: op.opId, status: "superseded" });
      }
    }

    const stored = await storedStamps(db, entity, [...winners.keys()]);

    for (const [identity, { op, payload }] of winners) {
      const existing = stored.get(identity);

      if (existing !== undefined) {
        const order = compareHlc(op.hlc, existing);
        if (order === 0) {
          results.set(op.opId, { opId: op.opId, status: "duplicate" });
          continue;
        }
        if (order < 0) {
          results.set(op.opId, { opId: op.opId, status: "stale" });
          continue;
        }
      }

      await writeRow(db, entity, op, payload);
      results.set(op.opId, { opId: op.opId, status: "applied" });
    }
  }

  // Preserve request order, so the client can read the response positionally if it wants to.
  return ops.map(
    (op) => results.get(op.opId) ?? { opId: op.opId, status: "rejected", reason: "not processed" },
  );
}

/** The stored `updated_hlc` for each identity, so the comparison above needs one read. */
async function storedStamps(
  db: Db,
  entity: WritableEntity,
  identities: string[],
): Promise<Map<string, string>> {
  if (identities.length === 0) return new Map();

  switch (entity) {
    case "log_entry": {
      const rows = await db
        .select({ id: logEntries.clientId, hlc: logEntries.updatedHlc })
        .from(logEntries)
        .where(inArray(logEntries.clientId, identities));
      return new Map(rows.map((r) => [r.id, r.hlc]));
    }
    case "task": {
      const rows = await db
        .select({ id: tasks.clientId, hlc: tasks.updatedHlc })
        .from(tasks)
        .where(inArray(tasks.clientId, identities));
      return new Map(rows.map((r) => [r.id, r.hlc]));
    }
    case "bodyweight": {
      const rows = await db
        .select({ id: bodyweightEntries.measuredOn, hlc: bodyweightEntries.updatedHlc })
        .from(bodyweightEntries)
        .where(inArray(bodyweightEntries.measuredOn, identities));
      return new Map(rows.map((r) => [r.id, r.hlc]));
    }
    case "rehab": {
      // A composite natural key, so the identity string has to be taken apart again. One
      // query on the days involved, then filtered by the full pair in memory: a tuple `IN`
      // would be tighter, and this table is toggled a handful of times a day, so the tighter
      // version buys nothing and costs a dialect quirk.
      const pairs = identities.map((id) => {
        const [day, ...rest] = id.split("|");
        return { day, slug: rest.join("|") };
      });
      const rows = await db
        .select({
          day: rehabCompletions.completedOn,
          slug: rehabCompletions.slug,
          hlc: rehabCompletions.updatedHlc,
        })
        .from(rehabCompletions)
        .where(inArray(rehabCompletions.completedOn, [...new Set(pairs.map((p) => p.day))]));

      const wanted = new Set(identities);
      return new Map(
        rows
          .filter((r) => wanted.has(`${r.day}|${r.slug}`))
          .map((r) => [`${r.day}|${r.slug}`, r.hlc] as const),
      );
    }
  }
}

/** Upsert one row against its conflict target, setting the tombstone for a delete. */
async function writeRow(
  db: Db,
  entity: WritableEntity,
  op: WireOp,
  payload: Record<string, unknown>,
): Promise<void> {
  const deletedAt = op.op === "delete" ? new Date() : null;
  const stamp = { updatedHlc: op.hlc, deletedAt };

  switch (entity) {
    case "log_entry": {
      const columns = WRITERS.log_entry.columns(payload);
      await db
        .insert(logEntries)
        .values({ ...columns, ...stamp })
        .onConflictDoUpdate({ target: logEntries.clientId, set: { ...columns, ...stamp } });
      return;
    }
    case "task": {
      const columns = WRITERS.task.columns(payload);
      await db
        .insert(tasks)
        .values({ ...columns, ...stamp })
        .onConflictDoUpdate({ target: tasks.clientId, set: { ...columns, ...stamp } });
      return;
    }
    case "bodyweight": {
      const columns = WRITERS.bodyweight.columns(payload);
      await db
        .insert(bodyweightEntries)
        .values({ ...columns, ...stamp })
        .onConflictDoUpdate({
          target: bodyweightEntries.measuredOn,
          set: { ...columns, ...stamp },
        });
      return;
    }
    case "rehab": {
      const columns = WRITERS.rehab.columns(payload);
      await db
        .insert(rehabCompletions)
        .values({ ...columns, ...stamp })
        .onConflictDoUpdate({
          target: [rehabCompletions.completedOn, rehabCompletions.slug],
          set: stamp,
        });
      return;
    }
  }
}

/* ------------------------------------------------------------------- pulling */

/**
 * Everything changed above `since`, across every table, in cursor order.
 *
 * Each table is asked for its own smallest rows above the cursor, and the union is then sorted
 * and sliced. That is correct rather than merely convenient: the globally smallest N above a
 * watermark must be contained in the union of each table's smallest N.
 *
 * Each table is asked for **`limit + 1`**, which is what makes `hasMore` truthful. Asking for
 * exactly `limit` cannot distinguish "this table had precisely that many" from "this table was
 * cut short", so a single busy table would report `hasMore: false` with rows still waiting —
 * and since the client only flushes again when told there is more, those rows would sit there
 * until something else triggered a sync. Caught by a test, not by reading.
 *
 * Tombstones come through this path like any other row — that is how a delete made on the
 * laptop reaches the phone.
 */
export async function pullChanges(
  db: Db,
  since: number,
  limit = MAX_CHANGES,
): Promise<{ changes: ChangeRow[]; cursor: number; hasMore: boolean }> {
  const collected: ChangeRow[] = [];
  const perTable = limit + 1;

  const push = (entity: Entity, rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const { updatedHlc, deletedAt, serverSeq, ...rest } = row as {
        updatedHlc: string;
        deletedAt: Date | null;
        serverSeq: number;
      } & Record<string, unknown>;

      collected.push({
        entity,
        row: rest,
        updatedHlc,
        deletedAt: deletedAt ? new Date(deletedAt).toISOString() : null,
        serverSeq: Number(serverSeq),
      });
    }
  };

  push(
    "log_entry",
    await db
      .select()
      .from(logEntries)
      .where(gt(logEntries.serverSeq, since))
      .orderBy(logEntries.serverSeq)
      .limit(perTable),
  );
  push(
    "task",
    await db
      .select()
      .from(tasks)
      .where(gt(tasks.serverSeq, since))
      .orderBy(tasks.serverSeq)
      .limit(perTable),
  );
  push(
    "bodyweight",
    await db
      .select()
      .from(bodyweightEntries)
      .where(gt(bodyweightEntries.serverSeq, since))
      .orderBy(bodyweightEntries.serverSeq)
      .limit(perTable),
  );
  push(
    "rehab",
    await db
      .select()
      .from(rehabCompletions)
      .where(gt(rehabCompletions.serverSeq, since))
      .orderBy(rehabCompletions.serverSeq)
      .limit(perTable),
  );
  push(
    "workout",
    await db
      .select()
      .from(workouts)
      .where(gt(workouts.serverSeq, since))
      .orderBy(workouts.serverSeq)
      .limit(perTable),
  );
  push(
    "workout_set",
    await db
      .select()
      .from(workoutSets)
      .where(gt(workoutSets.serverSeq, since))
      .orderBy(workoutSets.serverSeq)
      .limit(perTable),
  );
  push(
    "ai_summary",
    await db
      .select()
      .from(aiSummaries)
      .where(gt(aiSummaries.serverSeq, since))
      .orderBy(aiSummaries.serverSeq)
      .limit(perTable),
  );

  collected.sort((a, b) => a.serverSeq - b.serverSeq);
  const changes = collected.slice(0, limit);

  return {
    changes,
    // Never advance past a change that was not included, or the skipped rows are lost forever.
    cursor: changes.length > 0 ? changes[changes.length - 1].serverSeq : since,
    hasMore: collected.length > limit,
  };
}
