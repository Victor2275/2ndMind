import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import {
  bodyweightEntries,
  planOverrides,
  rehabCompletions,
  workoutSets,
  workouts,
  type NewWorkoutSet,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { BodyweightReading } from "./adjusted";
import type { ParsedWorkout } from "./hevy";
import type { Effort } from "./prs";
import type { PlanOverride, SessionType } from "./challenge";

/**
 * Every function takes the database handle as its first argument rather than reaching for a
 * module-level singleton. That is what lets the test suite run these against PGlite — real
 * Postgres in WASM — instead of mocking the query builder and proving nothing.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type ImportResult = {
  insertedWorkouts: number;
  skippedWorkouts: number;
  insertedSets: number;
};

/**
 * Idempotent by construction. A Hevy export is cumulative, so the second import of a
 * growing file re-presents every session already stored; the unique index on `external_id`
 * turns those into no-ops. Sets are only written for workouts that were actually inserted,
 * because otherwise a re-import would leave the workout row alone and append a duplicate
 * copy of all its sets — which would not be visible anywhere except in wrong PR numbers.
 */
export async function importWorkouts(db: Db, plan: ParsedWorkout[]): Promise<ImportResult> {
  if (plan.length === 0) {
    return { insertedWorkouts: 0, skippedWorkouts: 0, insertedSets: 0 };
  }

  const inserted = await db
    .insert(workouts)
    .values(
      plan.map((w) => ({
        externalId: w.externalId,
        performedAt: w.performedAt,
        title: w.title,
        source: "hevy",
        notes: w.notes,
      })),
    )
    .onConflictDoNothing({ target: workouts.externalId })
    .returning({ id: workouts.id, externalId: workouts.externalId });

  const idByExternal = new Map(inserted.map((r) => [r.externalId, r.id]));

  const rows: NewWorkoutSet[] = [];
  for (const workout of plan) {
    const workoutId = idByExternal.get(workout.externalId);
    if (workoutId === undefined) continue; // already stored; leave it untouched
    for (const set of workout.sets) {
      rows.push({
        workoutId,
        exercise: set.exercise,
        setIndex: set.setIndex,
        setType: set.setType,
        weightLbs: set.weightLbs,
        reps: set.reps,
        distanceM: set.distanceM,
        durationS: set.durationS,
        rpe: set.rpe,
      });
    }
  }

  // Chunked because a year of training is thousands of rows and a single statement with
  // that many bind parameters exceeds what the Postgres wire protocol accepts.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(workoutSets).values(rows.slice(i, i + CHUNK));
  }

  return {
    insertedWorkouts: inserted.length,
    skippedWorkouts: plan.length - inserted.length,
    insertedSets: rows.length,
  };
}

/** One hand-logged session. Returns the new workout id. */
export async function logWorkout(
  db: Db,
  input: {
    performedAt: Date;
    title: string;
    notes: string;
    sets: Omit<NewWorkoutSet, "workoutId">[];
  },
): Promise<number> {
  const [row] = await db
    .insert(workouts)
    .values({
      performedAt: input.performedAt,
      title: input.title,
      notes: input.notes,
      source: "manual",
      // Left null on purpose: Postgres treats nulls as distinct in a unique index, so
      // hand-logged sessions never collide with each other or with an import.
      externalId: null,
    })
    .returning({ id: workouts.id });

  if (input.sets.length > 0) {
    await db.insert(workoutSets).values(input.sets.map((s) => ({ ...s, workoutId: row.id })));
  }

  return row.id;
}

/**
 * Every set, flattened with its date — the input shape the PR functions want.
 *
 * **One source, since V4 Phase 2.7.** This used to union two: `workout_sets` for Hevy imports
 * and laptop entries, plus the sets stored inside `athletics` log entries for anything logged
 * from the phone. That union was D-159, and it existed for one reason — the phone could not
 * create a `workout` row, so a set logged at the gym had nowhere else to live.
 *
 * Phase 2 gave it one. Sessions are writable from the phone now (`SYNC_DESIGN.md` §4a), the
 * `athletics` log category is retired, and every set reaches `workout_sets` by the same path
 * whether it was typed at a rack, imported from Hevy, or entered on the laptop.
 *
 * Item 2.7 said **do not add a third reader**. The answer turned out to be better than that:
 * there is one. `strengthRecords`, `ergRecords`, `e1rmSeries`, `weeklyVolume`, `flagSpm` and the
 * adjusted-split table all read `Effort[]` and none of them ever had to know where a set came
 * from — which is why removing a source cost nothing at the call sites.
 *
 * Old `athletics` log entries keep their data and stay readable in the timeline and in search;
 * they simply no longer feed the record board. Retiring the category rather than deleting it is
 * what preserves that (`lib/log/categories.ts`).
 */
export async function allEfforts(db: Db): Promise<Effort[]> {
  return workoutSetEfforts(db);
}

async function workoutSetEfforts(db: Db): Promise<Effort[]> {
  const rows = await db
    .select({
      exercise: workoutSets.exercise,
      performedAt: workouts.performedAt,
      setType: workoutSets.setType,
      weightLbs: workoutSets.weightLbs,
      reps: workoutSets.reps,
      distanceM: workoutSets.distanceM,
      durationS: workoutSets.durationS,
      spm: workoutSets.spm,
      pieceType: workoutSets.pieceType,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    // Both sides. A soft delete does not cascade the way the foreign key does, so a deleted
    // session leaves its sets behind and they would go on counting toward PRs (SYNC_DESIGN §4).
    .where(and(isNull(workouts.deletedAt), isNull(workoutSets.deletedAt)));

  return rows;
}

export type WorkoutSummary = {
  id: number;
  clientId: string;
  performedAt: Date;
  title: string;
  source: string;
  setCount: number;
  volumeLbs: number;
};

export async function recentWorkouts(db: Db, limit = 20): Promise<WorkoutSummary[]> {
  const rows = await db
    .select({
      id: workouts.id,
      clientId: workouts.clientId,
      performedAt: workouts.performedAt,
      title: workouts.title,
      source: workouts.source,
      setCount: sql<number>`count(${workoutSets.id})::int`,
      // COALESCE inside the sum, not outside: a session of bodyweight-only sets has null
      // weights, and sum() over all-nulls returns null rather than 0.
      volumeLbs: sql<number>`coalesce(sum(
        coalesce(${workoutSets.weightLbs}, 0) * coalesce(${workoutSets.reps}, 0)
      ), 0)::float8`,
    })
    .from(workouts)
    // The set filter belongs in the join condition, not in a WHERE: on a LEFT JOIN a WHERE
    // that mentions the right-hand table turns it back into an inner join, and a session whose
    // sets were all deleted would vanish from the list instead of showing zero.
    .leftJoin(
      workoutSets,
      and(eq(workoutSets.workoutId, workouts.id), isNull(workoutSets.deletedAt)),
    )
    .where(isNull(workouts.deletedAt))
    .groupBy(workouts.id)
    .orderBy(desc(workouts.performedAt))
    .limit(limit);

  return rows;
}

export async function countWorkouts(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(workouts)
    .where(isNull(workouts.deletedAt));
  return row?.n ?? 0;
}

/**
 * Soft delete, since V3 §1.2. It used to be a hard `DELETE` relying on `ON DELETE CASCADE`.
 *
 * A hard delete cannot sync: it leaves nothing to compare, so there is no way to tell a device
 * that deleted a row from one that never had it. The foreign key still cascades, but only for
 * a genuine hard delete — of which there are now none in normal operation — so the sets are
 * soft-deleted explicitly here and every read filters them.
 */
export async function deleteWorkout(db: Db, id: number): Promise<void> {
  const deletedAt = new Date();
  await db.update(workoutSets).set({ deletedAt }).where(eq(workoutSets.workoutId, id));
  await db.update(workouts).set({ deletedAt }).where(eq(workouts.id, id));
}

/** Every logged session's local day, for checking the week's plan against reality. */
export async function workoutDates(db: Db, since: Date): Promise<Date[]> {
  const rows = await db
    .select({ performedAt: workouts.performedAt })
    .from(workouts)
    .where(and(gte(workouts.performedAt, since), isNull(workouts.deletedAt)))
    .orderBy(desc(workouts.performedAt));

  return rows.map((r) => r.performedAt);
}

/* ---------------------------------------------------------------- bodyweight */

/** Oldest first, which is the order every chart and the `weightOn` lookup want. */
export async function listBodyweight(db: Db, limit = 400): Promise<BodyweightReading[]> {
  const rows = await db
    .select({
      measuredOn: bodyweightEntries.measuredOn,
      weightLbs: bodyweightEntries.weightLbs,
      note: bodyweightEntries.note,
    })
    .from(bodyweightEntries)
    .where(isNull(bodyweightEntries.deletedAt))
    .orderBy(desc(bodyweightEntries.measuredOn))
    .limit(limit);

  return rows.reverse();
}

/**
 * One reading per day, last write wins.
 *
 * An upsert rather than an insert because weighing twice in a morning is normal and two rows
 * for one day would put two contradictory points on the trend line with no way to tell which
 * was meant.
 */
export async function recordBodyweight(
  db: Db,
  input: { measuredOn: string; weightLbs: number; note?: string },
): Promise<void> {
  await db
    .insert(bodyweightEntries)
    .values({
      measuredOn: input.measuredOn,
      weightLbs: input.weightLbs,
      note: input.note ?? "",
    })
    .onConflictDoUpdate({
      target: bodyweightEntries.measuredOn,
      // `deletedAt: null` revives a day that was deleted earlier. Without it the row is
      // updated with the new weight and stays invisible, which reads as the save silently
      // failing — the natural key means there is no second row to fall back on.
      set: { weightLbs: input.weightLbs, note: input.note ?? "", deletedAt: null },
    });
}

/** Soft delete, since V3 §1.2 — a hard delete leaves nothing for sync to compare. */
export async function deleteBodyweight(db: Db, measuredOn: string): Promise<void> {
  await db
    .update(bodyweightEntries)
    .set({ deletedAt: new Date() })
    .where(eq(bodyweightEntries.measuredOn, measuredOn));
}

/* --------------------------------------------------------------------- rehab */

/** Slugs ticked on each day in `[from, to]`, keyed by day. */
export async function rehabCompletionsBetween(
  db: Db,
  from: string,
  to: string,
): Promise<Map<string, Set<string>>> {
  const rows = await db
    .select({ completedOn: rehabCompletions.completedOn, slug: rehabCompletions.slug })
    .from(rehabCompletions)
    .where(
      and(
        gte(rehabCompletions.completedOn, from),
        lte(rehabCompletions.completedOn, to),
        isNull(rehabCompletions.deletedAt),
      ),
    );

  const byDay = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = byDay.get(row.completedOn) ?? new Set<string>();
    set.add(row.slug);
    byDay.set(row.completedOn, set);
  }
  return byDay;
}

/**
 * Ticks or un-ticks one protocol item for one day. Returns its state afterwards.
 *
 * Upsert against the unique key rather than a read-modify-write, so a double-tap on a phone
 * cannot produce two rows.
 *
 * Un-ticking sets `deletedAt` instead of deleting the row (V3 §1.2, `SYNC_DESIGN.md` §4). The
 * old version hard-deleted, and that could not sync:
 *
 * > The phone un-ticks an item for Tuesday while offline. The laptop ticks it the same
 * > evening. On sync there is no row on the phone and a row on the server — and no way to tell
 * > whether the phone deleted it or simply never had it.
 *
 * A tombstone makes both states comparable, so last-write-wins has something to decide with.
 */
export async function toggleRehab(db: Db, day: string, slug: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: rehabCompletions.id, deletedAt: rehabCompletions.deletedAt })
    .from(rehabCompletions)
    .where(and(eq(rehabCompletions.completedOn, day), eq(rehabCompletions.slug, slug)));

  if (existing) {
    const ticked = existing.deletedAt !== null;
    await db
      .update(rehabCompletions)
      .set({ deletedAt: ticked ? null : new Date() })
      .where(eq(rehabCompletions.id, existing.id));
    return ticked;
  }

  await db.insert(rehabCompletions).values({ completedOn: day, slug }).onConflictDoNothing();

  return true;
}

/* ------------------------------------------------------- challenge plan overrides */

/**
 * Every day Victor has changed from the vault's plan, keyed by ISO day (D-276).
 *
 * Read whole rather than by range: there are at most 76 rows for the whole challenge, and the
 * plan screen needs all of them at once. A range query here would be a second code path for no
 * measurable saving.
 */
export async function listPlanOverrides(db: Db): Promise<Map<string, PlanOverride>> {
  const rows = await db
    .select({
      planDate: planOverrides.planDate,
      sessionName: planOverrides.sessionName,
      detail: planOverrides.detail,
      type: planOverrides.type,
      distanceM: planOverrides.distanceM,
      note: planOverrides.note,
    })
    .from(planOverrides);

  const out = new Map<string, PlanOverride>();
  for (const row of rows) {
    out.set(row.planDate, {
      date: row.planDate,
      name: row.sessionName,
      detail: row.detail,
      // Stored as free text so a new session type never needs a migration — the same call
      // `workout_sets.piece_type` makes (D-230). A value the current build does not know is
      // dropped here rather than crashing `applyOverrides`, which types it as `SessionType`.
      type: row.type !== null && isKnownType(row.type) ? row.type : null,
      meters: row.distanceM,
      note: row.note,
    });
  }
  return out;
}

const KNOWN_TYPES = new Set<string>([
  "base",
  "long",
  "quality",
  "strength",
  "water",
  "recovery",
  "test",
  "race",
  "epic",
]);

function isKnownType(value: string): value is SessionType {
  return KNOWN_TYPES.has(value);
}

/**
 * Writes or replaces one day's override.
 *
 * Upsert on `plan_date` rather than read-modify-write, so a double-submit cannot produce two
 * rows for one day. Every field is written, including the nulls: this is "the day now reads like
 * this", not a patch, which is what makes the form's cleared field actually clear.
 */
export async function setPlanOverride(db: Db, override: PlanOverride): Promise<void> {
  const values = {
    planDate: override.date,
    sessionName: override.name,
    detail: override.detail,
    type: override.type,
    distanceM: override.meters,
    note: override.note,
    updatedAt: new Date(),
  };

  await db
    .insert(planOverrides)
    .values(values)
    .onConflictDoUpdate({ target: planOverrides.planDate, set: values });
}

/**
 * Drops one day's override, returning it to the vault's plan.
 *
 * A hard delete, deliberately — see the schema comment. Nothing merges this table across
 * devices, so there is no second state for a tombstone to be compared against, and the vault
 * row is always the fallback. Nothing is lost.
 */
export async function clearPlanOverride(db: Db, day: string): Promise<void> {
  await db.delete(planOverrides).where(eq(planOverrides.planDate, day));
}
