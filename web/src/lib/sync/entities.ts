/**
 * What syncs, and how each row is identified (V3 §1.2, `docs/SYNC_DESIGN.md` §1–§2).
 *
 * Kept apart from the store so the same table can be read by server code, client code and
 * tests without dragging IndexedDB into any of them.
 */

/** Every table mirrored onto the phone, whether or not the phone can write to it. */
export const ENTITIES = [
  "log_entry",
  "task",
  "bodyweight",
  "rehab",
  "workout",
  "workout_set",
  "ai_summary",
] as const;

export type Entity = (typeof ENTITIES)[number];

/**
 * The subset the phone may create or change. Everything else is pull-only.
 *
 * `workout` and `workout_set` are **not** here, which is the outcome of `SYNC_DESIGN.md` §11.1:
 * "workouts too" was chosen and reversed the same day. Creating a workout offline means a set
 * pointing at a parent `serial` that does not exist yet, which needs the aggregate op in §4a.
 * Log-only avoids it entirely — the Training log category already carries exercise, weight,
 * reps, distance, duration, SPM and RPE — and workouts keep arriving from Hevy imports on the
 * laptop. `ai_summary` is pull-only because the phone never writes one.
 */
export const WRITABLE: readonly Entity[] = ["log_entry", "task", "bodyweight", "rehab"];

export function isWritable(entity: Entity): boolean {
  return WRITABLE.includes(entity);
}

/**
 * The IndexedDB object store backing each entity, named for the Postgres table it mirrors.
 *
 * `as const satisfies` rather than a `Record<Entity, string>` annotation: the annotation
 * widens every value to `string`, and `idb` types a transaction by its store names, so every
 * call site then needs a cast back to the literal union. `satisfies` keeps the exhaustiveness
 * check without throwing the literals away.
 */
export const STORE_FOR = {
  log_entry: "log_entries",
  task: "tasks",
  bodyweight: "bodyweight_entries",
  rehab: "rehab_completions",
  workout: "workouts",
  workout_set: "workout_sets",
  ai_summary: "ai_summaries",
} as const satisfies Record<Entity, string>;

/** The object-store names, as literals, for typing IndexedDB transactions. */
export type RowStore = (typeof STORE_FOR)[Entity];

/**
 * The stable identity of a row, as a single string.
 *
 * Two shapes, and which one a table uses is the same decision as whether it needed a
 * `client_id` at all. Tables with no natural key are addressed by their client-generated UUID;
 * the other three are addressed by the key they already had, which is what makes an offline
 * create on them idempotent for free.
 *
 * Returning one string for both keeps every caller — the store, the outbox, the merge — from
 * having to branch on which kind of table it is holding.
 */
export function identityOf(entity: Entity, row: Record<string, unknown>): string {
  switch (entity) {
    case "bodyweight":
      return String(row.measuredOn);
    case "rehab":
      return `${String(row.completedOn)}|${String(row.slug)}`;
    case "ai_summary":
      return `${String(row.kind)}|${String(row.periodStart)}`;
    default: {
      const clientId = row.clientId;
      if (typeof clientId !== "string" || clientId.length === 0) {
        throw new Error(`${entity} row has no clientId`);
      }
      return clientId;
    }
  }
}
