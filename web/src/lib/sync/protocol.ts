import { z } from "zod";

import { ENTITIES, WRITABLE, type Entity } from "@/lib/sync/entities";

/**
 * The wire format between the phone and `/api/sync` (V3 §1.3, `docs/SYNC_DESIGN.md` §6–§7).
 *
 * Shared by both sides on purpose: the client builds requests from these schemas and the
 * server validates with the same ones, so a field added on one side cannot silently fail to
 * arrive on the other. Nothing here may import `server-only` — this module is in the browser
 * bundle, which also means **nothing sensitive belongs in it**. Shapes and field names only.
 */

/** ISO strings on the wire; the server coerces to `Date` at the column boundary. */
const isoDate = z.iso.datetime({ offset: true });

/**
 * Per-entity payload schemas. These are the *only* columns the phone may set — deliberately
 * not the whole row. `server_seq`, `updated_at` and `id` are the server's, and a client that
 * could set them could rewrite the cursor and make its own changes invisible to itself.
 */
export const PAYLOADS = {
  log_entry: z.object({
    clientId: z.uuid(),
    category: z.string().min(1).max(64),
    occurredAt: isoDate,
    note: z.string().max(20_000).default(""),
    data: z.record(z.string(), z.unknown()).default({}),
    searchText: z.string().max(40_000).default(""),
  }),
  task: z.object({
    clientId: z.uuid(),
    title: z.string().min(1).max(2_000),
    source: z.string().max(32).default("manual"),
    domain: z.string().max(64).nullable().default(null),
    courseCode: z.string().max(64).nullable().default(null),
    dueAt: isoDate.nullable().default(null),
    doneAt: isoDate.nullable().default(null),
    notes: z.string().max(20_000).default(""),
  }),
  bodyweight: z.object({
    measuredOn: z.iso.date(),
    weightLbs: z.number().positive().max(2_000),
    note: z.string().max(2_000).default(""),
  }),
  rehab: z.object({
    completedOn: z.iso.date(),
    slug: z.string().min(1).max(128),
  }),

  /**
   * A set, on its own (V4 Phase 2, `SYNC_DESIGN.md` §4a).
   *
   * Used for **edits and deletes after the session exists** — fixing a mistyped weight in set
   * three does not resend the session. It is deliberately not how a set is first created:
   * `parentClientId` is required and the server refuses one whose parent it has never seen, so
   * a set cannot arrive before the workout it belongs to. Creating a session and its sets in
   * one atomic op is the `workout` payload below, and it is the only path that makes a set for
   * the first time.
   */
  workout_set: z.object({
    clientId: z.uuid(),
    parentClientId: z.uuid(),
    exercise: z.string().min(1).max(200),
    setIndex: z.number().int().min(0).max(500).default(0),
    setType: z.enum(["normal", "warmup", "failure", "drop"]).default("normal"),
    weightLbs: z.number().min(0).max(5_000).nullable().default(null),
    reps: z.number().int().min(0).max(1_000).nullable().default(null),
    distanceM: z.number().min(0).max(1_000_000).nullable().default(null),
    durationS: z.number().int().min(0).max(360_000).nullable().default(null),
    spm: z.number().int().min(0).max(200).nullable().default(null),
    rpe: z.number().min(0).max(10).nullable().default(null),
  }),

  /**
   * A whole session, sets included — **the aggregate op** (`SYNC_DESIGN.md` §4a).
   *
   * This is the shape the deferral in §11.1 was about. `workout_sets.workout_id` is an integer
   * foreign key to a `serial`, and offline that number does not exist yet — so a set created on
   * the phone has nothing to point at. Three ways out were considered and only one is good:
   * send the session and its sets as **one operation**, let the server open a transaction and
   * assign the foreign key itself. There is no ordering to get wrong, no orphan to guard
   * against, and no partial session can exist.
   *
   * It also matches how the data is produced. You finish a session and save it once; a workout
   * without its sets was never a meaningful thing to write.
   *
   * `sets` is capped rather than unbounded because this is one row on the wire and one
   * transaction on the server — 200 sets is far beyond any real session and well inside what a
   * single statement should carry.
   */
  workout: z.object({
    clientId: z.uuid(),
    performedAt: isoDate,
    title: z.string().max(200).default(""),
    notes: z.string().max(20_000).default(""),
    sets: z
      .array(
        z.object({
          clientId: z.uuid(),
          exercise: z.string().min(1).max(200),
          setIndex: z.number().int().min(0).max(500).default(0),
          setType: z.enum(["normal", "warmup", "failure", "drop"]).default("normal"),
          weightLbs: z.number().min(0).max(5_000).nullable().default(null),
          reps: z.number().int().min(0).max(1_000).nullable().default(null),
          distanceM: z.number().min(0).max(1_000_000).nullable().default(null),
          durationS: z.number().int().min(0).max(360_000).nullable().default(null),
          spm: z.number().int().min(0).max(200).nullable().default(null),
          rpe: z.number().min(0).max(10).nullable().default(null),
        }),
      )
      .max(200)
      .default([]),
  }),

  /**
   * A catalogue entry (V4 Phase 2.1; editable fields added Phase 2++ Stage 2).
   *
   * The phone may add one — that is the point of "AI ADD" and of typing a movement the seed
   * does not know. `name` is the catalogue's natural key on the server, but the op is addressed
   * by `clientId`: two devices adding "Zercher Squat" on the same afternoon must not collide on
   * a unique index and lose one of them, and last-write-wins on a client key resolves that the
   * same way it does everywhere else — `apply.ts`'s writer now also converges same-named live
   * rows to one survivor after the fact, since the database no longer refuses the second insert.
   *
   * `primaryGroup` is deliberately absent: it is derived server-side from `primaryMuscles` in
   * `apply.ts`, never accepted from the client, so it cannot drift from the muscles it groups by.
   */
  exercise: z.object({
    clientId: z.uuid(),
    name: z.string().min(1).max(200),
    modality: z.enum(["lift", "erg", "water", "conditioning"]).default("lift"),
    muscles: z.array(z.string().max(40)).max(12).default([]),
    equipment: z.string().max(40).default(""),
    source: z.enum(["seed", "manual", "ai"]).default("manual"),
    seedKey: z.string().max(200).nullable().default(null),
    primaryMuscles: z.array(z.string().max(40)).max(6).default([]),
    secondaryMuscles: z.array(z.string().max(40)).max(6).default([]),
    userEditedFields: z.array(z.string().max(40)).max(24).default([]),
    aliases: z.array(z.string().max(100)).max(20).default([]),
    howTo: z.string().max(2_000).default(""),
    notes: z.string().max(4_000).default(""),
    restSeconds: z.number().int().min(0).max(3_600).nullable().default(null),
    archivedAt: isoDate.nullable().default(null),
  }),

  /**
   * A routine, its exercise list included — the same aggregate shape as `workout` and for the
   * same reason: `routine_exercises.routine_id` is an integer foreign key to a `serial` that
   * does not exist offline, so the routine and its lines travel as one operation and the server
   * assigns the key inside a transaction.
   *
   * `exercises` is a **replacement** of the routine's whole line list, not an addition to it —
   * see `routines` in `schema.ts`. Each line carries its own `clientId`, generated fresh by the
   * client on every save even for a line that looks unchanged; that is what lets the server's
   * writer treat this as "these are the lines now" without having to match old lines to new ones.
   */
  routine: z.object({
    clientId: z.uuid(),
    name: z.string().min(1).max(200),
    notes: z.string().max(4_000).default(""),
    exercises: z
      .array(
        z.object({
          clientId: z.uuid(),
          exercise: z.string().min(1).max(200),
          position: z.number().int().min(0).max(500).default(0),
          targetSets: z.number().int().min(0).max(50).nullable().default(null),
          targetReps: z.number().int().min(0).max(1_000).nullable().default(null),
          targetWeightLbs: z.number().min(0).max(5_000).nullable().default(null),
        }),
      )
      .max(100)
      .default([]),
  }),
} as const;

export type WritableEntity = keyof typeof PAYLOADS;

/** Compile-time proof that `PAYLOADS` and `WRITABLE` cannot drift apart. */
const _writableCovered: Record<WritableEntity, true> = {
  log_entry: true,
  task: true,
  bodyweight: true,
  rehab: true,
  workout: true,
  workout_set: true,
  exercise: true,
  routine: true,
};
void _writableCovered;

export const opSchema = z.object({
  opId: z.uuid(),
  entity: z.enum(WRITABLE as unknown as [WritableEntity, ...WritableEntity[]]),
  op: z.enum(["create", "update", "delete"]),
  clientId: z.string().min(1).max(256),
  payload: z.record(z.string(), z.unknown()),
  hlc: z.string().min(3).max(128),
});

export type WireOp = z.infer<typeof opSchema>;

/**
 * 100 is a guess (`SYNC_DESIGN.md` §11.3). The only cost of being wrong is latency on the
 * first sync after a long gap, and the cap is enforced server-side so a client bug cannot ask
 * for an unbounded batch.
 */
export const MAX_OPS = 100;
export const MAX_CHANGES = 100;

export const syncRequestSchema = z.object({
  ops: z.array(opSchema).max(MAX_OPS),
  /** The highest `server_seq` this device has already merged. */
  since: z.number().int().nonnegative(),
});

export type SyncRequest = z.infer<typeof syncRequestSchema>;

/**
 * What happened to one op. Four of the five mean "stop sending this" — only `rejected` is a
 * failure, and the distinction is the whole reason ops carry an `opId`.
 */
export type OpStatus =
  | "applied" // written
  | "duplicate" // this exact op had already landed; a retry after a lost response
  | "stale" // a newer write already won, so the op is satisfied
  | "superseded" // a later op in the same batch overwrote it before it was written
  | "rejected"; // permanent: malformed, unknown entity, bad payload

export type OpResult = { opId: string; status: OpStatus; reason?: string };

export type ChangeRow = {
  entity: Entity;
  row: Record<string, unknown>;
  updatedHlc: string;
  deletedAt: string | null;
  serverSeq: number;
};

export type SyncResponse = {
  results: OpResult[];
  changes: ChangeRow[];
  /** The new watermark. Only ever advances past changes actually included. */
  cursor: number;
  /** True when more changes are waiting above `cursor` — flush again rather than waiting. */
  hasMore: boolean;
};

/** Guard used by the client when narrowing an unknown entity from the wire. */
export function isEntity(value: unknown): value is Entity {
  return typeof value === "string" && (ENTITIES as readonly string[]).includes(value);
}
