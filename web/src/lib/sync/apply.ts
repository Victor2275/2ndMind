import { eq, gt, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { primaryGroupOf } from "@/lib/athletics/muscles";
import type * as schema from "@/lib/db/schema";
import {
  aiSummaries,
  bodyweightEntries,
  exercises,
  logEntries,
  rehabCompletions,
  routineExercises,
  routines,
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
  workout: {
    table: workouts,
    conflict: [workouts.clientId],
    identity: (p: Record<string, unknown>) => String(p.clientId),
    // `sets` is deliberately absent: it is not a column on this table. `writeRow` handles it
    // separately, inside the transaction that makes the aggregate atomic.
    columns: (p: Record<string, unknown>) => ({
      clientId: p.clientId as string,
      performedAt: new Date(p.performedAt as string),
      title: p.title as string,
      notes: p.notes as string,
      exerciseNotes: (p.exerciseNotes ?? {}) as Record<string, string>,
      source: "phone",
      // Null on purpose, and load-bearing: `workouts_external_id_idx` is unique, and Postgres
      // treats each null as distinct — so hand-logged sessions never collide with each other
      // or with a Hevy import (D-026).
      externalId: null,
    }),
  },
  workout_set: {
    table: workoutSets,
    conflict: [workoutSets.clientId],
    identity: (p: Record<string, unknown>) => String(p.clientId),
    // `workoutId` is absent for the same reason: it is resolved from `parentClientId` at apply
    // time, because the phone has never seen the server's serial.
    columns: (p: Record<string, unknown>) => ({
      clientId: p.clientId as string,
      exercise: p.exercise as string,
      setIndex: p.setIndex as number,
      setType: p.setType as string,
      weightLbs: p.weightLbs as number | null,
      reps: p.reps as number | null,
      distanceM: p.distanceM as number | null,
      durationS: p.durationS as number | null,
      spm: p.spm as number | null,
      rpe: p.rpe as number | null,
      completedAt: p.completedAt ? new Date(p.completedAt as string) : null,
      notes: (p.notes ?? "") as string,
      pieceType: (p.pieceType ?? null) as string | null,
    }),
  },
  exercise: {
    table: exercises,
    conflict: [exercises.clientId],
    identity: (p: Record<string, unknown>) => String(p.clientId),
    columns: (p: Record<string, unknown>) => {
      const primaryMuscles = (p.primaryMuscles ?? []) as string[];
      return {
        clientId: p.clientId as string,
        name: p.name as string,
        modality: p.modality as string,
        muscles: p.muscles as string[],
        equipment: p.equipment as string,
        source: p.source as string,
        seedKey: p.seedKey as string | null,
        primaryMuscles,
        secondaryMuscles: (p.secondaryMuscles ?? []) as string[],
        // Derived, never trusted from the wire — see the field's doc in `schema.ts`.
        primaryGroup: primaryGroupOf(primaryMuscles),
        userEditedFields: (p.userEditedFields ?? []) as string[],
        aliases: (p.aliases ?? []) as string[],
        howTo: (p.howTo ?? "") as string,
        notes: (p.notes ?? "") as string,
        restSeconds: (p.restSeconds ?? null) as number | null,
        archivedAt: p.archivedAt ? new Date(p.archivedAt as string) : null,
      };
    },
  },
  routine: {
    table: routines,
    conflict: [routines.clientId],
    identity: (p: Record<string, unknown>) => String(p.clientId),
    // `exercises` is deliberately absent: not a column on this table, handled separately inside
    // the transaction that makes the aggregate atomic — see `writeRow`'s `routine` case.
    columns: (p: Record<string, unknown>) => ({
      clientId: p.clientId as string,
      name: p.name as string,
      notes: p.notes as string,
    }),
  },
  /**
   * Not a `WritableEntity` — `routine_exercise` is pull-only (see `sync/entities.ts`) and never
   * arrives as its own op. This entry exists only so `writeRow`'s `routine` case has one place
   * to build a line-item row from, the same shape `workout_set`'s entry serves for `workout`.
   */
  routine_exercise: {
    table: routineExercises,
    conflict: [routineExercises.clientId],
    identity: (p: Record<string, unknown>) => String(p.clientId),
    columns: (p: Record<string, unknown>) => ({
      clientId: p.clientId as string,
      exercise: p.exercise as string,
      position: p.position as number,
      targetSets: p.targetSets as number | null,
      targetReps: p.targetReps as number | null,
      targetWeightLbs: p.targetWeightLbs as number | null,
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

      try {
        await writeRow(db, entity, op, payload);
        results.set(op.opId, { opId: op.opId, status: "applied" });
      } catch (error) {
        // A set for a session the server has never seen. Permanent rather than transient: it
        // will never succeed on a later attempt, so retrying it forever is how an outbox stops
        // draining. Everything else is a real failure and takes the batch down, which is
        // correct — a 500 is retried, and the op stays queued.
        if (!(error instanceof UnknownParentError)) throw error;
        results.set(op.opId, { opId: op.opId, status: "rejected", reason: error.message });
      }
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
    case "workout": {
      const rows = await db
        .select({ id: workouts.clientId, hlc: workouts.updatedHlc })
        .from(workouts)
        .where(inArray(workouts.clientId, identities));
      return new Map(rows.map((r) => [r.id, r.hlc]));
    }
    case "workout_set": {
      const rows = await db
        .select({ id: workoutSets.clientId, hlc: workoutSets.updatedHlc })
        .from(workoutSets)
        .where(inArray(workoutSets.clientId, identities));
      return new Map(rows.map((r) => [r.id, r.hlc]));
    }
    case "exercise": {
      const rows = await db
        .select({ id: exercises.clientId, hlc: exercises.updatedHlc })
        .from(exercises)
        .where(inArray(exercises.clientId, identities));
      return new Map(rows.map((r) => [r.id, r.hlc]));
    }
    case "routine": {
      const rows = await db
        .select({ id: routines.clientId, hlc: routines.updatedHlc })
        .from(routines)
        .where(inArray(routines.clientId, identities));
      return new Map(rows.map((r) => [r.id, r.hlc]));
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
    case "exercise": {
      const columns = WRITERS.exercise.columns(payload);
      await atomically(db, (handle) => [
        handle
          .insert(exercises)
          .values({ ...columns, ...stamp })
          .onConflictDoUpdate({ target: exercises.clientId, set: { ...columns, ...stamp } }),

        // Converge same-named live rows to one survivor (V4 Phase 2++ Stage 2, fixing the
        // permanent-sync-wedge bug documented on `exercises.name` in schema.ts). `name` is no
        // longer unique, so two devices creating "Zercher Squat" independently now both
        // succeed instead of one 500ing the whole batch — but that would otherwise leave two
        // live rows forever. This statement is pure and idempotent: for every `name_key` with
        // more than one live row, it tombstones every row except the one with the highest
        // `updated_hlc`. Run after *every* exercise write, cheap at catalogue scale, and
        // correct regardless of which of two colliding writes triggers it — both converge to
        // the same survivor because both compare against the same stored maximum.
        //
        // `COLLATE "C"` matters: `updated_hlc` is compared as a plain byte string everywhere
        // else (`hlc.ts:compareHlc` is `a < b` in JS), and Postgres's default collation is
        // locale-aware — it would occasionally disagree with that ordering.
        handle.execute(sql`
          UPDATE exercises AS e
          SET deleted_at = now()
          WHERE e.deleted_at IS NULL
            AND e.name_key IS NOT NULL
            AND e.updated_hlc COLLATE "C" < (
              SELECT max(e2.updated_hlc COLLATE "C")
              FROM exercises AS e2
              WHERE e2.name_key = e.name_key AND e2.deleted_at IS NULL
            )
        `),
      ]);
      return;
    }

    /**
     * A routine and every line it contains, in one transaction — the same aggregate shape as
     * `workout` (`SYNC_DESIGN.md` §4a), with one difference: **replace-all.** Reordering and
     * removing lines is the normal edit for a template, so rather than upserting into whatever
     * lines already exist, this tombstones every existing line not present in the incoming list
     * and upserts the rest. A re-sent create is therefore still idempotent — the same incoming
     * `clientId`s tombstone the same complement every time.
     */
    case "routine": {
      const columns = WRITERS.routine.columns(payload);
      const exercisesIn = (payload.exercises ?? []) as Record<string, unknown>[];
      const parentClientId = columns.clientId;
      const incomingIds = exercisesIn.map((e) => String(e.clientId));
      // A Postgres array literal built from bound params, not a JS array handed to `sql`
      // directly — the driver has no column type to infer an array cast from, and interpolating
      // one expands to a row expression instead (`($1, $2)`, not `{$1,$2}`).
      const incomingIdsArray =
        incomingIds.length > 0
          ? sql`ARRAY[${sql.join(
              incomingIds.map((id) => sql`${id}`),
              sql`, `,
            )}]::uuid[]`
          : sql`ARRAY[]::uuid[]`;

      await atomically(db, (handle) => [
        handle
          .insert(routines)
          .values({ ...columns, ...stamp })
          .onConflictDoUpdate({ target: routines.clientId, set: { ...columns, ...stamp } }),

        // Tombstone whatever lines this routine had that are not in the new list. `<> ALL` over
        // an empty array is vacuously true for every row, so an empty `exercises` (a delete, or
        // a routine cleared to no lines) correctly tombstones everything with no special case.
        // Safe on a first create too — `routineId` then matches no live rows, a no-op — and safe
        // to re-run, since an already-tombstoned line stays excluded by `deleted_at IS NULL`.
        handle.execute(sql`
          UPDATE routine_exercises AS re
          SET deleted_at = now()
          WHERE re.deleted_at IS NULL
            AND re.routine_id = (SELECT id FROM routines WHERE client_id = ${parentClientId})
            AND re.client_id <> ALL(${incomingIdsArray})
        `),

        ...exercisesIn.map((line) => {
          const row = {
            ...WRITERS.routine_exercise.columns(line),
            // A sub-select, not a value read back — see the identical comment on `workout`'s
            // `workoutId` above. A batch statement may depend on an earlier one's *effect*, not
            // its *result*.
            routineId: sql<number>`(select id from ${routines} where ${routines.clientId} = ${parentClientId})`,
            ...stamp,
          };
          return handle
            .insert(routineExercises)
            .values(row)
            .onConflictDoUpdate({ target: routineExercises.clientId, set: row });
        }),
      ]);
      return;
    }

    /**
     * A session and every set it contains, in one transaction (`SYNC_DESIGN.md` §4a).
     *
     * The parent is upserted first so its `id` exists, then the sets are written pointing at
     * it. Both inside `db.transaction`, which is the entire reason this design was chosen over
     * the two alternatives: **no partial session can exist.** A crash between the two
     * statements rolls back rather than leaving a workout with no sets, or sets that a later
     * read would count toward a PR board while the session they belong to is missing.
     *
     * A re-sent create is an upsert on both levels, so retrying is free — which matters,
     * because retrying is not optional here: failed writes are held and retried (D-129), and
     * the op that carries a whole gym session is the most expensive one to lose.
     */
    case "workout": {
      const columns = WRITERS.workout.columns(payload);
      const sets = (payload.sets ?? []) as Record<string, unknown>[];
      const parentClientId = columns.clientId;

      await atomically(db, (handle) => [
        handle
          .insert(workouts)
          .values({ ...columns, ...stamp })
          .onConflictDoUpdate({ target: workouts.clientId, set: { ...columns, ...stamp } }),

        ...sets.map((set) => {
          // Deleting the session tombstones its sets too. Reads already filter children by the
          // parent's `deleted_at`, so this is belt and braces — but a set left live under a
          // deleted session still reaches `allEfforts()` on a device that only ever pulled the
          // child row.
          const row = {
            ...WRITERS.workout_set.columns(set),
            /**
             * The foreign key as a sub-select, not as a value read back from the insert above.
             *
             * `RETURNING` would mean this statement depends on the *result* of the previous
             * one, which rules out sending them as one batch — and one batch is the only
             * atomic primitive the production driver has (see `atomically`). Resolved inside
             * the statement, the dependency becomes one the database handles: the sub-select
             * runs after the insert, inside the same transaction, and sees the row it just
             * wrote.
             */
            workoutId: sql<number>`(select id from ${workouts} where ${workouts.clientId} = ${parentClientId})`,
            ...stamp,
          };

          return handle
            .insert(workoutSets)
            .values(row)
            .onConflictDoUpdate({ target: workoutSets.clientId, set: row });
        }),
      ]);
      return;
    }

    /**
     * One set, after the session exists — an edit or a delete, never a first create.
     *
     * The parent is resolved from `parentClientId`, because the phone has never seen the
     * server's `serial`. A set whose parent is unknown is **dropped rather than guessed at**:
     * inventing a workout to hang it on would manufacture a session that never happened, and
     * the ordering guarantee that makes that impossible is exactly what the aggregate op
     * exists to provide. In practice it cannot happen — the create carries the parent — so
     * this is the guard for a client bug, not a normal path.
     */
    case "workout_set": {
      const parentClientId = String(payload.parentClientId);
      const [parent] = await db
        .select({ id: workouts.id })
        .from(workouts)
        .where(eq(workouts.clientId, parentClientId))
        .limit(1);
      if (!parent) throw new UnknownParentError(parentClientId);

      const columns = { ...WRITERS.workout_set.columns(payload), workoutId: parent.id };
      await db
        .insert(workoutSets)
        .values({ ...columns, ...stamp })
        .onConflictDoUpdate({ target: workoutSets.clientId, set: { ...columns, ...stamp } });
      return;
    }
  }
}

/**
 * A set arrived for a session the server has never seen.
 *
 * Its own type so `applyOps` can turn it into a `rejected` result with a useful reason, rather
 * than a 500 that takes the whole batch down. Permanent, not transient: the op will never
 * succeed on a later attempt, and retrying it forever is how an outbox stops draining.
 */
/**
 * Run several statements as one all-or-nothing unit, on whichever driver is underneath.
 *
 * ## Why this is not just `db.transaction`
 *
 * **`neon-http` has no transactions.** It is a stateless HTTP driver, and Drizzle's
 * `db.transaction()` throws on it outright. PGlite — what the tests run — supports them fine, so
 * the aggregate op passed every database test and **500'd against production on the first real
 * session**, which is how this was found: `npm run e2e` logged a session offline, reconnected,
 * and the outbox came back with `server returned 500`.
 *
 * That is worth stating plainly, because the whole argument for §4a's aggregate op is that no
 * partial session can exist. Without an atomic primitive it was a session write that *usually*
 * completed, which is a different and much worse thing.
 *
 * ## What each driver gets
 *
 * - **`batch`** (neon-http): Neon's HTTP transaction API — every statement in one request,
 *   wrapped in `BEGIN`/`COMMIT` server-side. Genuinely atomic, and the reason the foreign key
 *   above is a sub-select rather than a value read back: a batch cannot depend on an earlier
 *   statement's *result*, only on its *effect*.
 * - **`transaction`** (PGlite, and any pooled driver): the ordinary thing. Statements are built
 *   against the transaction handle, not the outer one — building them against `db` inside a
 *   `transaction` callback is the classic way to run them outside the transaction and get no
 *   atomicity while appearing to.
 *
 * Both paths execute the same statements in the same order, so the tests exercise the same SQL
 * production runs even though they take the other branch.
 */
async function atomically(db: Db, build: (handle: Db) => PromiseLike<unknown>[]): Promise<void> {
  const runner = db as unknown as { batch?: (statements: unknown[]) => Promise<unknown> };

  if (typeof runner.batch === "function") {
    const statements = build(db);
    if (statements.length === 0) return;
    await runner.batch(statements);
    return;
  }

  await db.transaction(async (tx) => {
    for (const statement of build(tx as unknown as Db)) await statement;
  });
}

export class UnknownParentError extends Error {
  constructor(readonly parentClientId: string) {
    super(`no workout with clientId ${parentClientId}`);
    this.name = "UnknownParentError";
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
    "exercise",
    await db
      .select()
      .from(exercises)
      .where(gt(exercises.serverSeq, since))
      .orderBy(exercises.serverSeq)
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
  push(
    "routine",
    await db
      .select()
      .from(routines)
      .where(gt(routines.serverSeq, since))
      .orderBy(routines.serverSeq)
      .limit(perTable),
  );
  push(
    "routine_exercise",
    await db
      .select()
      .from(routineExercises)
      .where(gt(routineExercises.serverSeq, since))
      .orderBy(routineExercises.serverSeq)
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
