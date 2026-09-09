import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { errorReports, type ErrorReport } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { CleanReport } from "@/lib/errors/report";

/**
 * Storing and reading crash reports (V3 §2.4, D-165).
 *
 * Handle passed in, as everywhere, so this runs against real Postgres in the tests rather than
 * against a mocked query builder — which matters more here than usual, because the whole
 * design rests on an upsert doing the right thing under a conflict.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Record one occurrence.
 *
 * **Counted, not accumulated.** A broken selector in a render loop produces thousands of
 * identical reports in seconds, and inserting a row for each is how a diagnostics table becomes
 * the largest thing in the database and takes the app down with it. One row per fingerprint;
 * `seenCount` and `lastSeenAt` move.
 *
 * The upsert is what makes that safe under concurrency: two reports arriving at once cannot
 * both insert, because the unique index refuses the second and the `DO UPDATE` counts it
 * instead. A read-then-insert would lose one of them and, worse, occasionally throw.
 *
 * A repeat **clears `resolvedAt`**. Something marked dealt with that happens again is not dealt
 * with, and silently leaving it resolved is how a real regression stays invisible.
 */
export async function recordError(db: Db, report: CleanReport): Promise<ErrorReport> {
  const [row] = await db
    .insert(errorReports)
    .values(report)
    .onConflictDoUpdate({
      target: errorReports.fingerprint,
      set: {
        seenCount: sql`${errorReports.seenCount} + 1`,
        lastSeenAt: sql`now()`,
        resolvedAt: null,
        // The newest stack and build, because a fix that half-worked shows up as the same
        // fingerprint from a different deploy — and the old stack would send you to the old
        // line numbers.
        stack: report.stack,
        buildId: report.buildId,
        message: report.message,
      },
    })
    .returning();

  return row;
}

/** Unresolved problems, loudest first — most recent, then most frequent. */
export async function openErrors(db: Db, limit = 20): Promise<ErrorReport[]> {
  return (
    db
      .select()
      .from(errorReports)
      .where(isNull(errorReports.resolvedAt))
      // `id` breaks the tie. Two reports recorded in the same millisecond — which happens
      // whenever something fails in a loop, and happened in this suite — otherwise come back in
      // whatever order Postgres feels like, so "most recent first" was true most of the time and
      // the test that checked it failed about one run in twenty.
      .orderBy(desc(errorReports.lastSeenAt), desc(errorReports.id))
      .limit(limit)
  );
}

/**
 * How many distinct problems are open and recent.
 *
 * Distinct, not total occurrences: the dashboard badge answers "is something broken", and a
 * count of thousands from one loop would say the same thing far louder than it deserves.
 */
export async function openErrorCount(db: Db, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(errorReports)
    .where(and(isNull(errorReports.resolvedAt), gte(errorReports.lastSeenAt, since)));
  return row?.n ?? 0;
}

/** Mark one as dealt with. It comes back on its own if it happens again. */
export async function resolveError(db: Db, id: number): Promise<ErrorReport | null> {
  const [row] = await db
    .update(errorReports)
    .set({ resolvedAt: new Date() })
    .where(eq(errorReports.id, id))
    .returning();
  return row ?? null;
}
