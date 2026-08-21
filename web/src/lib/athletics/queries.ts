import { desc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { workoutSets, workouts, type NewWorkoutSet } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { ParsedWorkout } from "./hevy";
import type { Effort } from "./prs";

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
export async function importWorkouts(
  db: Db,
  plan: ParsedWorkout[],
): Promise<ImportResult> {
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
  input: { performedAt: Date; title: string; notes: string; sets: Omit<NewWorkoutSet, "workoutId">[] },
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
    await db.insert(workoutSets).values(
      input.sets.map((s) => ({ ...s, workoutId: row.id })),
    );
  }

  return row.id;
}

/** Every set, flattened with its session date — the input shape the PR functions want. */
export async function allEfforts(db: Db): Promise<Effort[]> {
  const rows = await db
    .select({
      exercise: workoutSets.exercise,
      performedAt: workouts.performedAt,
      setType: workoutSets.setType,
      weightLbs: workoutSets.weightLbs,
      reps: workoutSets.reps,
      distanceM: workoutSets.distanceM,
      durationS: workoutSets.durationS,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id));

  return rows;
}

export type WorkoutSummary = {
  id: number;
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
    .leftJoin(workoutSets, eq(workoutSets.workoutId, workouts.id))
    .groupBy(workouts.id)
    .orderBy(desc(workouts.performedAt))
    .limit(limit);

  return rows;
}

export async function countWorkouts(db: Db): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(workouts);
  return row?.n ?? 0;
}

export async function deleteWorkout(db: Db, id: number): Promise<void> {
  // Sets go with it via ON DELETE CASCADE.
  await db.delete(workouts).where(eq(workouts.id, id));
}
