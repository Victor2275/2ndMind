import {
  freshnessOf,
  byCourse,
  dueToday,
  latestSummary,
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
import { allChipSets, type ChipSets } from "@/lib/log/chips";
import { searchLocalEntries } from "@/lib/offline/search";
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
  /**
   * Recent values as one-tap chips, per category (§1.6), built from the local mirror.
   *
   * The reason the offline form is not a lesser form: the chips are what make a training entry
   * finishable one-handed, and they come from entries — which are already on the phone. There
   * is nothing about them that needed the server.
   */
  chips: Record<string, ChipSets>;
  /**
   * The newest stored daily summary, with the day it describes (§3.6).
   *
   * Rendered whatever its age. D-124 persisted these so they would outlive the model call, and
   * the offline screen already labels everything it shows with a date — so the date carries the
   * caveat and nothing has to be withheld.
   */
  summary: { periodStart: string; summary: string } | null;
  /** True when the mirror has never been filled — a new install that has not synced. */
  empty: boolean;
};

/**
 * The log entries on this phone matching a query (§2.3).
 *
 * A separate read rather than a field on `CachedView`, because the snapshot is taken on every
 * view and a search is asked for on almost none of them — putting every log entry the phone
 * holds into that snapshot would cost the whole dashboard a scan it does not use.
 */
export async function searchCachedLog(query: string, limit = 50): Promise<CachedEntry[]> {
  if (query.trim() === "") return [];
  const db = await openSyncDb();
  try {
    return searchLocalEntries(await listLocal(db, "log_entry"), query, limit);
  } finally {
    db.close();
  }
}

export async function readCachedView(now = new Date()): Promise<CachedView> {
  const db = await openSyncDb();
  try {
    const [tasks, logs, sets, workouts, bodyweight, rehab, summaries, lastSyncAt] =
      await Promise.all([
        listLocal(db, "task"),
        listLocal(db, "log_entry"),
        listLocal(db, "workout_set"),
        listLocal(db, "workout"),
        listLocal(db, "bodyweight"),
        listLocal(db, "rehab"),
        listLocal(db, "ai_summary"),
        getLastSyncAt(db),
      ]);

    return {
      freshness: freshnessOf(lastSyncAt, now.getTime()),
      due: dueToday(tasks, now),
      backlog: undated(tasks, now),
      byCourse: byCourse(tasks, now),
      loggedToday: loggedOn(logs, now),
      recentSets: recentSets(logs, sets, workouts),
      chips: allChipSets(
        // Newest first, and capped the way the server-side query is: a chip row shows six, and
        // scanning a year of entries to pick them would cost more than the form saves.
        logs
          .map((record) => record.row)
          .filter((row) => typeof row.occurredAt === "string")
          .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
          .slice(0, 200)
          .map((row) => ({
            category: String(row.category ?? ""),
            data:
              typeof row.data === "object" && row.data !== null
                ? (row.data as Record<string, unknown>)
                : {},
          })),
      ),
      weight: latestWeight(bodyweight),
      summary: latestSummary(summaries),
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
