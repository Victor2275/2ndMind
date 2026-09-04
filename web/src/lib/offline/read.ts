import {
  freshnessOf,
  byCourse,
  dueToday,
  latestWeight,
  loggedOn,
  recentSets,
  rehabDoneOn,
  undated,
  type CachedEntry,
  type CachedSet,
  type CachedTask,
  type Freshness,
} from "@/lib/offline/panels";
import { getLastSyncAt, listLocal, openSyncDb } from "@/lib/sync/store";

/**
 * Reading the local mirror into the shapes the cached screens render (V3 §2.1).
 *
 * The only impure half: open IndexedDB, pull each entity, hand the rows to `panels.ts`. Split
 * this way so the arithmetic — day boundaries, overdue, the merge of logged and imported sets
 * — is testable without a browser, and so this file stays small enough to read in one go.
 *
 * Every screen reads **one snapshot**, taken once. Reading each panel separately would let a
 * flush land in the middle and render a dashboard where the task list is newer than the
 * "as of" line above it.
 */

export type CachedView = {
  freshness: Freshness;
  /** Tasks due by the end of today, plus what has no date at all. */
  due: CachedTask[];
  backlog: CachedTask[];
  byCourse: { course: string; tasks: CachedTask[] }[];
  loggedToday: CachedEntry[];
  recentSets: CachedSet[];
  weight: { measuredOn: string; weightLbs: number } | null;
  rehabToday: string[];
  /** True when the mirror has never been filled — a new install that has not synced. */
  empty: boolean;
};

export async function readCachedView(now = new Date()): Promise<CachedView> {
  const db = await openSyncDb();
  try {
    const [tasks, logs, sets, workouts, bodyweight, rehab, lastSyncAt] = await Promise.all([
      listLocal(db, "task"),
      listLocal(db, "log_entry"),
      listLocal(db, "workout_set"),
      listLocal(db, "workout"),
      listLocal(db, "bodyweight"),
      listLocal(db, "rehab"),
      getLastSyncAt(db),
    ]);

    return {
      freshness: freshnessOf(lastSyncAt, now.getTime()),
      due: dueToday(tasks, now),
      backlog: undated(tasks, now),
      byCourse: byCourse(tasks, now),
      loggedToday: loggedOn(logs, now),
      recentSets: recentSets(logs, sets, workouts),
      weight: latestWeight(bodyweight),
      rehabToday: rehabDoneOn(rehab, now),
      // Counted across every mirrored table, not just tasks: a phone with an empty task list
      // and a full log has synced, and telling it it has not would be a lie that sends him
      // looking for a problem.
      empty:
        tasks.length === 0 &&
        logs.length === 0 &&
        sets.length === 0 &&
        bodyweight.length === 0 &&
        rehab.length === 0,
    };
  } finally {
    db.close();
  }
}
