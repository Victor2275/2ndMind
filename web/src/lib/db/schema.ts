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
 * Only two tables need this. `bodyweight_entries` (`measured_on`), `rehab_completions`
 * (`completed_on, slug`) and `ai_summaries` (`kind, period_start`) already have natural keys
 * that make an offline create idempotent for free, and `workouts`/`workout_sets` are pull-only
 * — the phone never creates one (`SYNC_DESIGN.md` §11.1).
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...syncColumns(),
  },
  (t) => [
    // Partial-unique in spirit: manual entries leave externalId null, and Postgres treats
    // each null as distinct, so hand-logged workouts never collide with each other.
    uniqueIndex("workouts_external_id_idx").on(t.externalId),
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
    ...syncColumns(),
  },
  (t) => [
    index("workout_sets_workout_id_idx").on(t.workoutId),
    index("workout_sets_exercise_idx").on(t.exercise),
    index("workout_sets_server_seq_idx").on(t.serverSeq),
  ],
);

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type NewWorkoutSet = typeof workoutSets.$inferInsert;

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
