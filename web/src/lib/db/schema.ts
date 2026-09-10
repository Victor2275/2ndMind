import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
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

/**
 * The four columns every syncable table carries (V3 §1.2, `docs/SYNC_DESIGN.md` §3–§4, §7,
 * D-150). A function rather than a shared object because Drizzle's column builders are
 * stateful — spreading one object into seven tables makes them share builder instances.
 *
 * Each column does a different job, and conflating any two of them is a bug waiting to happen:
 *
 * - `updatedHlc` is what last-write-wins actually compares. A hybrid logical clock, not a
 *   timestamp: `Date.now()` on a phone is not a comparable clock. Fly to Taiwan, the clock
 *   jumps, and from that moment the phone wins every conflict for the rest of the day —
 *   including overwriting edits made later on the laptop.
 * - `updatedAt` is a human-readable server-side receipt. It is deliberately NOT what LWW
 *   compares. Two clocks, two jobs; conflating them is how the timezone bug gets in.
 * - `serverSeq` is the pull cursor, drawn from one sequence shared by every table. Timestamps
 *   are unsafe cursors — two rows can share one, and any clock adjustment reorders history.
 * - `deletedAt` is the tombstone. A row has to survive its own deletion or a delete made on
 *   one device is indistinguishable from a row the other device never had.
 *
 * `serverSeq` and `updatedAt` are written by the `bump_sync_seq` trigger, not by application
 * code. Application discipline fails silently here, and the failure mode is "changes stop
 * reaching the phone", which nobody notices until data is missing.
 */
function syncColumns() {
  return {
    updatedHlc: text("updated_hlc").notNull().default("0-0-server"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    serverSeq: bigint("server_seq", { mode: "number" })
      .notNull()
      .default(sql`nextval('sync_seq')`),
    /**
     * Soft delete. For `tasks` and `log_entries` this was already here and already made undo
     * possible (Q81); for the rest it arrived with sync, because a hard delete leaves nothing
     * to compare and LWW cannot decide between a device that deleted and one that never knew.
     */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  };
}

/**
 * A client-generated identity, so a create is safe to retry.
 *
 * Retrying is required — failed writes are held and retried rather than dropped (D-129) — so
 * without an idempotency key every flaky connection manufactures duplicate rows. Same problem
 * D-026 solved for Hevy imports with a derived `external_id`.
 *
 * `bodyweight_entries` (`measured_on`), `rehab_completions` (`completed_on, slug`) and
 * `ai_summaries` (`kind, period_start`) already have natural keys that make an offline create
 * idempotent for free, so they do not need one.
 *
 * **`workouts` and `workout_sets` gained this in V4 Phase 2**, which is the reversal
 * `SYNC_DESIGN.md` §11.1 spent two paragraphs deferring. They were pull-only precisely because
 * they had no client key: a set offline points at a parent `serial` that does not exist yet.
 * §4a is the answer — a session and its sets travel as one aggregate op — and a client key on
 * both tables is the first half of it. `exercises` carries one for the same reason: the phone
 * can add to the catalogue.
 *
 * The `gen_random_uuid()` default matters: rows created on the laptop get an id too, so this
 * is the global identity for every row rather than a phone-only marker. The phone therefore
 * never needs to learn a server `serial` id after a create is accepted.
 */
function clientId() {
  return uuid("client_id").notNull().defaultRandom();
}

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
    /**
     * Per-exercise notes for the session — "left knee bothered me on squats" — keyed by exercise
     * name (V4 Phase 2++ Stage 2). There is no per-exercise row in this schema, only per-set
     * ones, and a note attached to set 1 dies the moment set 1 is deleted; keying by name on the
     * parent survives that.
     */
    exerciseNotes: jsonb("exercise_notes").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    clientId: clientId(),
    ...syncColumns(),
  },
  (t) => [
    // Partial-unique in spirit: manual entries leave externalId null, and Postgres treats
    // each null as distinct, so hand-logged workouts never collide with each other.
    uniqueIndex("workouts_external_id_idx").on(t.externalId),
    uniqueIndex("workouts_client_id_idx").on(t.clientId),
    index("workouts_performed_at_idx").on(t.performedAt),
    index("workouts_server_seq_idx").on(t.serverSeq),
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
    /**
     * Set when a ticked-off set is marked done in the rebuilt logger (V4 Phase 2++ Stage 2).
     * Null for a set logged the old way — plain entry, no tick — which is not a data gap, it is
     * the honest answer for a set nobody stepped through in order.
     */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Per-set note — "felt heavy", "left knee" — separate from `workouts.exerciseNotes`, which
     *  is per exercise for the whole session rather than per rep. */
    notes: text("notes").notNull().default(""),
    /**
     * What the piece *was*, orthogonal to `setType`'s "does this count". A technical paddle at
     * low pressure and a race piece both `count` — `setType` stays `"normal"` on both — but they
     * answer a different question a PR board should never conflate. Free text on purpose, not
     * an enum: `"start"`, `"race"`, `"technical"`, `"steady"` today, and a new one tomorrow
     * should not need a migration. `isWorkingSet` in `lib/athletics/prs.ts` is untouched by this
     * column and must stay that way — extending `setType` instead would have let a light
     * technical paddle silently enter the PR board the moment someone added `"technical"` to
     * its deny list.
     */
    pieceType: text("piece_type"),
    /**
     * The `exercise` string as it was before Stage 3's rename touched it. Transitional — added in
     * the same migration as the rename script and dropped a release later — and it is the entire
     * reason the rename is reversible despite rewriting `workout_sets.exercise` in place. Null on
     * every row the rename never touched, including every row created after it ran.
     */
    exerciseBeforeV2: text("exercise_before_v2"),
    clientId: clientId(),
    ...syncColumns(),
  },
  (t) => [
    index("workout_sets_workout_id_idx").on(t.workoutId),
    index("workout_sets_exercise_idx").on(t.exercise),
    uniqueIndex("workout_sets_client_id_idx").on(t.clientId),
    index("workout_sets_server_seq_idx").on(t.serverSeq),
  ],
);

/**
 * The exercise catalogue (V4 Phase 2.1).
 *
 * A row per movement, so the session form knows what to ask for before you have typed a
 * number. `modality` is the load-bearing column: a lift wants weight and reps, an erg piece
 * wants distance, duration and a stroke rate, and asking for all five every time is what made
 * the old form slow. `muscles` is a plain text array rather than a join table — it is read
 * whole, filtered in memory, and never queried across rows.
 *
 * **Seeded, not empty.** `scripts/seed-exercises.mjs` writes a curated ~150 from
 * `lib/athletics/catalogue.ts`, which is the same list the phone mirrors so fuzzy search works
 * with no signal. `source` says where a row came from: `seed` for those, `manual` for one you
 * typed, `ai` for one the AI-add path proposed and you confirmed. Nothing is ever created
 * without confirmation — D-186's rule for voice, applied here.
 *
 * `name` is *not* unique — it was, until V4 Phase 2++ Stage 2 found the bug that came from it.
 * `workout_sets.exercise` stores the name as free text, never a foreign key, so uniqueness on
 * `name` bought nothing there — but the op that adds a catalogue entry is addressed by
 * `client_id`, and a create only conflicts on that. Two devices adding "Zercher Squat" the same
 * afternoon therefore raised a **raw Postgres unique violation** on `exercises_name_idx`, which
 * is not an `UnknownParentError`, so `applyOps` did not catch it — the route 500'd, the whole
 * batch died, and every other entity queued behind it in that batch retried forever. Fixed two
 * ways: uniqueness dropped here, and `apply.ts`'s exercise writer now converges same-named live
 * rows to one survivor (highest `updated_hlc`) after every write, so the data stays clean without
 * ever needing the database to refuse the second insert.
 *
 * ## Phase 2++ Stage 2's additions
 *
 * Additive only — nothing above is dropped, and `muscles` stays populated for one release so a
 * client on the pre-Stage-3 bundle still renders a figure from `pullChanges`'s row. `seedKey` is
 * the identity Stage 3's rename keys on instead of `name`, so a name can change without losing
 * the row's history of AI-suggest matches, how-to text and user edits. `userEditedFields` is
 * what `mergeCatalogue` (`session-logger.tsx`) has to respect once seeded rows are editable —
 * without it, a bundle reseed cannot tell "the user changed this" from "the seed changed this".
 */
export const exercises = pgTable(
  "exercises",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    /**
     * Lowercased, trimmed `name`, generated rather than written — the collision-convergence
     * query below groups on this, and a hand-maintained copy is a copy that can disagree with
     * `name` the moment an update sets one and not the other.
     */
    nameKey: text("name_key").generatedAlwaysAs(sql`lower(btrim(name))`),
    /** "lift" | "erg" | "water" | "conditioning" — which fields the session form asks for. */
    modality: text("modality").notNull().default("lift"),
    /**
     * Primary muscles worked, from the old 15-word vocabulary. Kept through Stage 2 so a client
     * on the pre-Stage-3 bundle still gets a figure from every pulled row; retired one release
     * after Stage 3 seeds `primaryMuscles`/`secondaryMuscles` for every row.
     */
    muscles: text("muscles")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** Prime movers, from `lib/athletics/muscles.ts`'s ~21-word vocabulary. Stage 3 backfills. */
    primaryMuscles: text("primary_muscles")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** Assisting muscles — the figure's lighter, secondary highlight. */
    secondaryMuscles: text("secondary_muscles")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /**
     * Coarse Hevy-style group (`Chest`, `Back`, …), for the exercise browser's sticky section
     * headers. Derived server-side from `primaryMuscles` via `primaryGroupOf` at write time —
     * never trusted from the client — so it cannot drift from the muscles it is grouping by.
     */
    primaryGroup: text("primary_group"),
    /** "barbell", "dumbbell", "machine", "cable", "bodyweight", "machine-erg", "" */
    equipment: text("equipment").notNull().default(""),
    /** "seed" | "manual" | "ai" — where the row came from, for pruning later. */
    source: text("source").notNull().default("manual"),
    /**
     * The identity Stage 3's rename keys on, instead of `name`. Null until Stage 3 backfills it
     * for every seeded row; a hand-added or AI-suggested row never gets one, which is correct —
     * `seedKey` means "this row traces to a specific catalogue.ts entry", and those rows do not.
     * Not unique here: uniqueness is enforced by the rename script's own totality check
     * (`renames.test.ts`), not by the database, because a partly-migrated table legitimately has
     * many rows sharing the null `seedKey`.
     */
    seedKey: text("seed_key"),
    /**
     * Which columns a person has edited by hand, so a bundle reseed (`seed-exercises.mts`) knows
     * to leave them alone. Without this, editing a seeded row's how-to text would be silently
     * overwritten the next time the seed script runs — correct in Postgres, correct in the
     * mirror, and gone on the next deploy.
     */
    userEditedFields: text("user_edited_fields")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** Other names this movement is logged under — "incline press" for "Incline Bench Press". */
    aliases: text("aliases")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** Setup, execution, common error — moved here from the static `how-to.ts` map in Stage 3 so
     *  an edit is a sync op rather than a code change. Empty until then. */
    howTo: text("how_to").notNull().default(""),
    /** Free-form notes, distinct from `howTo` — "use the 2-inch deficit plates", not technique. */
    notes: text("notes").notNull().default(""),
    /** Per-exercise default rest, seconds. Null means "use the logger's default". */
    restSeconds: integer("rest_seconds"),
    /**
     * Archived — hidden from the browser and the picker, kept for history. Two-step removal per
     * Victor's answer: archive first (reversible, syncs), delete only from the archive view
     * (permanent, confirmed) via the ordinary tombstone every other entity already uses.
     */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /** Which seed pass last touched this row's non-user-edited fields. Compared against the
     *  running catalogue version in `seed-exercises.mts`, not read anywhere else. */
    seedVersion: integer("seed_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    clientId: clientId(),
    ...syncColumns(),
  },
  (t) => [
    index("exercises_name_idx").on(t.name),
    index("exercises_name_key_idx").on(t.nameKey),
    uniqueIndex("exercises_seed_key_idx").on(t.seedKey),
    uniqueIndex("exercises_client_id_idx").on(t.clientId),
    index("exercises_server_seq_idx").on(t.serverSeq),
  ],
);

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type NewWorkoutSet = typeof workoutSets.$inferInsert;

/**
 * A saved routine — a template you start a session from (V4 Phase 2++ Stage 2, absorbed into
 * Stage 6). Victor's answer: saved from a finished session rather than built from a blank form,
 * pre-filled with the weights that session used.
 *
 * Syncs as one aggregate op, like `workouts` (`SYNC_DESIGN.md` §4a) — a routine and its exercise
 * list travel together, and the server assigns `routine_exercises.routine_id` itself inside the
 * transaction, for the same reason a set cannot point at a workout that does not exist yet
 * offline. The one difference from a workout's aggregate: **a routine op replaces the whole list
 * rather than upserting into it.** Reordering and removing exercises is the normal edit for a
 * template — you save a routine, not append to one — so the write that makes that correct is
 * "these are the exercises now", not "here are some more".
 */
export const routines = pgTable(
  "routines",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    clientId: clientId(),
    ...syncColumns(),
  },
  (t) => [
    uniqueIndex("routines_client_id_idx").on(t.clientId),
    index("routines_server_seq_idx").on(t.serverSeq),
  ],
);

export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;

/**
 * One line of a routine. Pull-only — it is in `ENTITIES` and `STORE_FOR` so it mirrors onto the
 * phone, but not in `sync/entities.ts`'s `WRITABLE`, because a lone line item is never addressed
 * on its own: it only ever arrives embedded in a `routine` op, the same way `workout_sets` only
 * ever arrives embedded in a `workout` op on first create.
 *
 * `clientId` is generated fresh, client-side, every time a routine is saved — even for "the same"
 * exercise line the person is just re-saving unchanged. That is what makes replace-all simple: the
 * writer does not need to match old line items to new ones, only tombstone whichever old rows for
 * this routine are not among the incoming `clientId`s and upsert the rest.
 */
export const routineExercises = pgTable(
  "routine_exercises",
  {
    id: serial("id").primaryKey(),
    routineId: integer("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    exercise: text("exercise").notNull(),
    position: integer("position").notNull().default(0),
    targetSets: integer("target_sets"),
    targetReps: integer("target_reps"),
    targetWeightLbs: numeric("target_weight_lbs", { precision: 7, scale: 2, mode: "number" }),
    clientId: clientId(),
    ...syncColumns(),
  },
  (t) => [
    index("routine_exercises_routine_id_idx").on(t.routineId),
    uniqueIndex("routine_exercises_client_id_idx").on(t.clientId),
    index("routine_exercises_server_seq_idx").on(t.serverSeq),
  ],
);

export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;

/**
 * Tasks — the one model for everything actionable (D-037).
 *
 * Before this, "what should I be doing" had four answers: sprint goals in the vault, the
 * academic tracker in the vault, a daily to-do list, and Canvas assignments. Victor named
 * "too complex to use" as what would make him abandon the project, so four competing lists
 * was not a style question.
 *
 * `source` is what keeps them distinguishable after the merge: a row still knows whether a
 * human typed it, whether it came from a calendar feed, or whether it is a weekly goal.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    /** "manual" | "goal" | "canvas" | "calendar" */
    source: text("source").notNull().default("manual"),
    /** "engineering" | "academics" | "athletics" | "work" | "life" — optional, for filtering. */
    domain: text("domain"),
    /** Set for coursework, so the academics page can group without a second table. */
    courseCode: text("course_code"),
    /**
     * Stable id from whatever produced this row, so re-reading a calendar feed updates
     * rather than duplicates. Null for hand-typed tasks, and Postgres treats nulls as
     * distinct in a unique index, so those never collide with each other.
     */
    externalId: text("external_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Two tasks may legitimately share a title and a due date, so there is no natural key. */
    clientId: clientId(),
    ...syncColumns(),
  },
  (t) => [
    uniqueIndex("tasks_external_id_idx").on(t.externalId),
    uniqueIndex("tasks_client_id_idx").on(t.clientId),
    index("tasks_due_at_idx").on(t.dueAt),
    index("tasks_source_idx").on(t.source),
    index("tasks_server_seq_idx").on(t.serverSeq),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

/**
 * Log entries — structured daily logging (feature 2).
 *
 * One table, six categories, per-category fields in JSONB. The alternative was a column for
 * every field across every category, which would be mostly nulls and would need a migration
 * each time Victor wants a field changed — and D-039 promises that changing fields is cheap.
 *
 * `searchText` is denormalised on write so search never has to reach into JSON at query time.
 */
export const logEntries = pgTable(
  "log_entries",
  {
    id: serial("id").primaryKey(),
    /** One of CATEGORY_KEYS. Not an enum: adding a category should not need a migration. */
    category: text("category").notNull(),
    /** When it happened, which is not always when it was typed. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note").notNull().default(""),
    /** Category-specific fields, shaped by `lib/log/categories.ts`. */
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    searchText: text("search_text").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Logging "Bench Press 185x5" twice in one session is a real thing to do, so two
     *  identical rows are legitimate and there is no natural key. */
    clientId: clientId(),
    ...syncColumns(),
  },
  (t) => [
    index("log_entries_occurred_at_idx").on(t.occurredAt),
    index("log_entries_category_idx").on(t.category),
    uniqueIndex("log_entries_client_id_idx").on(t.clientId),
    index("log_entries_server_seq_idx").on(t.serverSeq),
  ],
);

export type LogEntry = typeof logEntries.$inferSelect;
export type NewLogEntry = typeof logEntries.$inferInsert;

/**
 * Bodyweight (feature 5).
 *
 * Its own table rather than another log category, because it is the second input to every
 * weight-adjusted split on the site — the vault's single stated goal is a *weight-adjusted*
 * 2:00 500m — and "the weight closest to this piece's date" has to be a cheap indexed lookup,
 * not a scan that reaches into JSONB.
 *
 * `date` rather than `timestamp`: a bodyweight belongs to a morning, not an instant. Storing
 * a day as a timestamp is what forces the noon-UTC trick used elsewhere in this codebase, and
 * gets a reading rendered on the wrong day the first time someone travels.
 *
 * Health data. It is private by construction — no public route imports this module — and it
 * is the field Victor named as the one that must never be published.
 */
export const bodyweightEntries = pgTable(
  "bodyweight_entries",
  {
    id: serial("id").primaryKey(),
    /** ISO `YYYY-MM-DD`, in Victor's local day. */
    measuredOn: date("measured_on", { mode: "string" }).notNull(),
    weightLbs: numeric("weight_lbs", { precision: 6, scale: 2, mode: "number" }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (t) => [
    // One reading per day. Re-weighing overwrites rather than appending, so a chart cannot
    // show two contradictory points for the same morning. This is also the natural key that
    // makes an offline create idempotent without a client id.
    uniqueIndex("bodyweight_measured_on_idx").on(t.measuredOn),
    index("bodyweight_server_seq_idx").on(t.serverSeq),
  ],
);

export type BodyweightEntry = typeof bodyweightEntries.$inferSelect;

/**
 * Rehab protocol completions (feature 5).
 *
 * The protocol itself is *not* stored here — it is parsed from
 * `context/02_physical_performance/benchmarks_and_logs.md` so that editing the vault changes
 * the checklist with no code change and no migration. This table records only which item was
 * ticked on which day.
 *
 * Deliberately not `tasks`, despite D-037 unifying everything actionable. Four rehab items ×
 * every day of term is ~1,400 rows a year, and D-037's whole purpose was that the task list
 * stays short enough to read. A daily-recurring checklist is a different shape from a to-do.
 */
export const rehabCompletions = pgTable(
  "rehab_completions",
  {
    id: serial("id").primaryKey(),
    completedOn: date("completed_on", { mode: "string" }).notNull(),
    /** Slug of the protocol item, derived from its vault heading. */
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (t) => [
    // Toggling is upsert-and-set-`deletedAt` against this key, which makes a double-tap
    // idempotent rather than a second row. It used to be insert-or-*hard*-delete, which could
    // not sync: a hard delete leaves nothing to compare, so there was no way to tell a phone
    // that un-ticked from a phone that never had the row (`SYNC_DESIGN.md` §4).
    uniqueIndex("rehab_day_slug_idx").on(t.completedOn, t.slug),
    index("rehab_completed_on_idx").on(t.completedOn),
    index("rehab_server_seq_idx").on(t.serverSeq),
  ],
);

export type RehabCompletion = typeof rehabCompletions.$inferSelect;

/**
 * AI summaries, kept after they are shown.
 *
 * Victor's condition for the summary feature was "as long as it logs the summaries
 * somewhere" (2026-08-29). Until now they were generated, rendered, and lost — the cache held
 * one for a few hours and then the day was gone. A summary of a day you can no longer
 * reconstruct is the one kind that has value later, so it is stored.
 *
 * Postgres rather than the vault, for the reason in `web/context.md`: this is time-series,
 * one row per period, queried by range. It is also model output, and D-080 says nothing
 * AI-driven writes to the vault in V2 — a table keeps that boundary intact without needing an
 * approval gate on something Victor never has to accept.
 *
 * `periodStart` is a local date, not a timestamp, so "the 3rd" means the same thing in
 * Taiwan as in Los Angeles.
 */
export const aiSummaries = pgTable(
  "ai_summaries",
  {
    id: serial("id").primaryKey(),
    /** "daily" | "weekly". */
    kind: text("kind").notNull(),
    /** ISO `YYYY-MM-DD` — the day, or the first day of the week. */
    periodStart: date("period_start", { mode: "string" }).notNull(),
    summary: text("summary").notNull(),
    /** Which model wrote it, so a summary outlives the model that produced it. */
    model: text("model").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (t) => [
    // One row per period per kind. The summary is regenerated as the day fills in, and each
    // regeneration should replace the last rather than leaving a pile of drafts to read
    // through later. Also the natural key: the phone never creates one of these, but the same
    // uniqueness is what would make it idempotent if it ever did.
    uniqueIndex("ai_summaries_kind_period_idx").on(t.kind, t.periodStart),
    index("ai_summaries_period_idx").on(t.periodStart),
    index("ai_summaries_server_seq_idx").on(t.serverSeq),
  ],
);

export type AiSummary = typeof aiSummaries.$inferSelect;
export type NewAiSummary = typeof aiSummaries.$inferInsert;

/**
 * Crash reports from this app's own code (V3 §2.4, D-137, D-165).
 *
 * The one unscheduled item whose absence hides every other item's failure. D-085 —
 * `gemini-2.5-flash` retired and every AI call 404ing silently for an unknown length of time —
 * was found by reading a dev server log by chance. V3 makes that worse before it makes it
 * better: a failing service worker on a Samsung produces **no log anyone will ever read**, at
 * the same moment the code holding unsynced user data moves onto that phone.
 *
 * **Deliberately not syncable.** It carries none of `syncColumns()` and is not in `ENTITIES`.
 * Diagnostics are one-directional and disposable — mirroring them onto the device that
 * produced them would spend the phone's storage on its own crash log, and a report is
 * interesting to exactly one reader on exactly one screen.
 *
 * **Grouped by `fingerprint`, counted rather than accumulated.** Ten thousand copies of one
 * broken selector is one problem, and storing ten thousand rows to say so is how a diagnostics
 * table becomes the largest thing in the database. `seenCount` and `lastSeenAt` move; the row
 * does not multiply.
 */
export const errorReports = pgTable(
  "error_reports",
  {
    id: serial("id").primaryKey(),
    /**
     * A stable identity for "the same problem": source, error name, and the message with its
     * variable parts removed. Computed on the client-facing boundary, in `lib/errors/report.ts`,
     * so the server never has to parse a stack trace.
     */
    fingerprint: text("fingerprint").notNull(),
    /** "browser" | "worker" | "server" — where it happened, which changes what to do about it. */
    source: text("source").notNull(),
    /** The error's constructor name, e.g. `TypeError`. */
    name: text("name").notNull().default(""),
    message: text("message").notNull().default(""),
    /** Truncated hard. A stack is for orientation, not for archaeology. */
    stack: text("stack").notNull().default(""),
    /** The path it happened on, query string stripped — a query can carry anything. */
    route: text("route").notNull().default(""),
    /** Which deploy, from the service worker's build stamp (D-146). */
    buildId: text("build_id").notNull().default(""),
    /** Coarse only: the platform, not a fingerprintable string. */
    agent: text("agent").notNull().default(""),
    seenCount: integer("seen_count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** Set when Victor has looked at it and decided it is dealt with. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    // What makes counting rather than accumulating possible: the upsert target.
    uniqueIndex("error_reports_fingerprint_idx").on(t.fingerprint),
    index("error_reports_last_seen_idx").on(t.lastSeenAt),
  ],
);

export type ErrorReport = typeof errorReports.$inferSelect;
export type NewErrorReport = typeof errorReports.$inferInsert;

/**
 * Devices that have agreed to be notified (V3 §4.1, D-185).
 *
 * A Web Push subscription is three opaque strings the browser hands over: an endpoint URL at
 * the vendor's push service, and two keys used to encrypt the payload so the push service
 * cannot read it. There is no user column because this vault has exactly one user, which is
 * the same reason `sessions` does not have one.
 *
 * The endpoint is the identity — the browser reissues the same one for the same installation —
 * so it is the upsert target. Re-subscribing after a permission reset writes over the old row
 * rather than accumulating a second dead one.
 *
 * **These rows go stale on their own.** A push service answers 404 or 410 for a subscription
 * that has been revoked, an app that was uninstalled, or a browser whose storage was cleared,
 * and the sender deletes the row when it sees that. Nothing else prunes them, and nothing
 * needs to.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    endpoint: text("endpoint").notNull(),
    /** The client's public key, for payload encryption. Opaque to us. */
    p256dh: text("p256dh").notNull(),
    /** The client's auth secret, for payload encryption. Opaque to us. */
    auth: text("auth").notNull(),
    /** Coarse only, to tell one device from another in a list. Never fingerprintable detail. */
    agent: text("agent").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Set on the last successful send, so a dead device is visible before it is pruned. */
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint)],
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

/**
 * Filament spools (V3 §5.1, D-189).
 *
 * Postgres rather than the vault, unlike the course plan: this changes weekly, is a list of
 * quantities rather than a document, and the question it answers — *what am I about to run out
 * of* — wants a sort, not a diff. Same reasoning D-036 used to move tasks out of the vault.
 *
 * **Entered in the app, not handed over as a table.** The plan carried this as blocked on an
 * inventory in `docs/UPLOADS_NEEDED.md`; Victor's answer on 2026-09-06 was that he wants to add
 * spools on the site. The data entry *is* the feature, so there was never anything to wait for.
 */
export const filamentSpools = pgTable(
  "filament_spools",
  {
    id: serial("id").primaryKey(),
    /** PLA, PETG, ABS, TPU — free text, because a new material is a purchase not a migration. */
    material: text("material").notNull(),
    brand: text("brand").notNull().default(""),
    colourName: text("colour_name").notNull().default(""),
    /**
     * `#rrggbb`, for a real swatch instead of a word.
     *
     * Nullable on purpose: the upload brief said a rough entry now beats an exact one never,
     * and refusing a spool because its hex is unknown is exactly how an inventory stops being
     * kept up to date.
     */
    colourHex: text("colour_hex"),
    /** Grams left. The reorder sort is on this, so it is the one field worth being honest in. */
    gramsRemaining: integer("grams_remaining").notNull().default(0),
    /** What a full spool of this was, so "how little is left" can be a fraction not a count. */
    gramsFull: integer("grams_full").notNull().default(1000),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Soft delete, like every other row here — a spool used up is history, not an absence. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("filament_spools_remaining_idx").on(t.gramsRemaining)],
);

export type FilamentSpool = typeof filamentSpools.$inferSelect;
export type NewFilamentSpool = typeof filamentSpools.$inferInsert;

/**
 * Printers (V3 §5.1, D-189).
 *
 * The status vocabulary is Victor's, confirmed 2026-09-06: `idle`, `printing`,
 * `needs maintenance`, `down`. The plan deliberately refused to invent a taxonomy — those four
 * are the distinctions that change what he does next, and a fifth nobody uses is a field that
 * silently goes stale.
 *
 * Stored as text rather than a Postgres enum: adding a state should not be a migration.
 */
export const printers = pgTable("printers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("idle"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Printer = typeof printers.$inferSelect;
export type NewPrinter = typeof printers.$inferInsert;
