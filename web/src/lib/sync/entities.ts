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
  "exercise",
  "ai_summary",
] as const;

export type Entity = (typeof ENTITIES)[number];

/**
 * The subset the phone may create or change. Everything else is pull-only.
 *
 * **`workout`, `workout_set` and `exercise` joined this list in V4 Phase 2**, which is the
 * reversal `SYNC_DESIGN.md` §11.1 deferred twice — on 2026-08-30 for cost, and again on
 * 2026-09-03 (D-159), which solved the symptom instead by having `allEfforts()` read sets out
 * of log entries. Q391 asked for real session logging, so §4a is finally built: a session and
 * all its sets travel as **one aggregate op**, applied in a single transaction, and the server
 * assigns the foreign key itself. There is no ordering to get wrong and no orphan to guard
 * against.
 *
 * `ai_summary` stays pull-only because the phone never writes one.
 */
export const WRITABLE: readonly Entity[] = [
  "log_entry",
  "task",
  "bodyweight",
  "rehab",
  "workout",
  "workout_set",
  "exercise",
];

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
  exercise: "exercises",
  ai_summary: "ai_summaries",
} as const satisfies Record<Entity, string>;

/** The object-store names, as literals, for typing IndexedDB transactions. */
export type RowStore = (typeof STORE_FOR)[Entity];

/**
 * The stable identity of a row, as a single string.
 *
 * Two shapes, and which one a table uses is the same decision as whether it needed a
 * `client_id` at all. Tables with no natural key are addressed by their client-generated UUID;
 * the rest are addressed by the key they already had, which is what makes an offline create on
 * them idempotent for free.
 *
 * Returning one string for both keeps every caller — the store, the outbox, the merge — from
 * having to branch on which kind of table it is holding.
 *
 * **`workout` and `workout_set` moved to the `clientId` branch in V4 Phase 2.** They were
 * addressed by the server's `id`, which was safe for exactly one reason — being pull-only, the
 * phone never minted one — and that reason has now gone. The note that used to live here said
 * *"if they ever become writable, this case has to move to a client-generated key first"*; this
 * is that move, and the migration backfills `client_id` for every existing row so the server's
 * id is never needed as an identity again.
 *
 * They fell into the `clientId` branch once before, by accident, until 2026-09-04 — back when
 * the column did not exist, so `identityOf` threw on every workout row the server sent and
 * **the whole workout mirror had never populated once**. The sync runner caught it and said
 * nothing; the athletics page offline was quietly reading an empty store. Found by the error
 * panel D-165 put on the dashboard, on its first day. Worth remembering, because the shape of
 * the fix now looks identical to the shape of the bug.
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
