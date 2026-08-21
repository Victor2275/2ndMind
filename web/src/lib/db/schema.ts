import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Athletics schema.
 *
 * This is the one part of 2ndMind that is not markdown. Training data is tabular and
 * queried across thousands of rows — "best set of Bench Press at 5 reps" is a group-by, not
 * something to hand-maintain in a file. Everything here is private by construction: no
 * public route imports this module, and the public site is built without DATABASE_URL set.
 *
 * Two shapes of effort live in one table. A barbell set has weight and reps; an erg piece
 * has distance, duration, and a stroke rate. Splitting them into separate tables would mean
 * every "what did I do on Tuesday" query became a union, so instead a set carries whichever
 * columns apply and PR logic branches on what is populated.
 */

export const workouts = pgTable(
  "workouts",
  {
    id: serial("id").primaryKey(),
    /**
     * Stable identity for an imported session, used to make re-importing a CSV a no-op.
     * Hevy exports are cumulative — every export contains the entire history — so without
     * this, a second import silently doubles every workout and every PR computed from them.
     */
    externalId: text("external_id"),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull(),
    title: text("title").notNull().default(""),
    source: text("source").notNull().default("manual"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Partial-unique in spirit: manual entries leave externalId null, and Postgres treats
    // each null as distinct, so hand-logged workouts never collide with each other.
    uniqueIndex("workouts_external_id_idx").on(t.externalId),
    index("workouts_performed_at_idx").on(t.performedAt),
  ],
);

export const workoutSets = pgTable(
  "workout_sets",
  {
    id: serial("id").primaryKey(),
    workoutId: integer("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exercise: text("exercise").notNull(),
    setIndex: integer("set_index").notNull().default(0),
    /** "normal", "warmup", "failure", "drop" — warmups must not count toward a PR. */
    setType: text("set_type").notNull().default("normal"),
    // `mode: "number"` matters: Postgres numeric arrives as a string by default, and
    // "145" > "95" is false under string comparison. A PR query would be quietly wrong.
    weightLbs: numeric("weight_lbs", { precision: 7, scale: 2, mode: "number" }),
    reps: integer("reps"),
    distanceM: numeric("distance_m", { precision: 10, scale: 2, mode: "number" }),
    durationS: integer("duration_s"),
    /** Strokes per minute. Erg work only; the vault tracks SPM targets per race distance. */
    spm: integer("spm"),
    rpe: numeric("rpe", { precision: 4, scale: 2, mode: "number" }),
  },
  (t) => [
    index("workout_sets_workout_id_idx").on(t.workoutId),
    index("workout_sets_exercise_idx").on(t.exercise),
  ],
);

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type NewWorkoutSet = typeof workoutSets.$inferInsert;
