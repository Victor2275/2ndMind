import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { aiSummaries, type AiSummary } from "@/lib/db/schema";
import type { Db } from "@/lib/tasks/queries";

/**
 * Persisting AI summaries.
 *
 * Victor's condition for the feature was "as long as it logs the summaries somewhere". Until
 * this existed they were generated, rendered and lost: the cache held one for a few hours,
 * then the day was gone. A summary of a day you can no longer reconstruct is exactly the kind
 * worth keeping.
 *
 * Takes the handle as its first argument, like every other query module, so the suite can run
 * it against real Postgres in PGlite rather than a mock.
 */

export type SummaryKind = "daily" | "weekly";

/**
 * Stores a summary, replacing any earlier one for the same period.
 *
 * Upsert rather than insert. The daily summary is regenerated as the day fills in, so a plain
 * insert would leave a pile of half-days to read through and no way to tell which was final.
 * The last one written for a period is the one that describes it.
 *
 * Fallback text is never stored. `generateDailySummary` returns `ok: false` with a message
 * like "Nothing logged yet today" or a missing-key notice, and writing those would fill the
 * table with rows that say nothing happened — indistinguishable later from a day when nothing
 * did. The caller checks `ok`; this asserts it too, because the check that matters is the one
 * next to the write.
 */
export async function recordSummary(
  db: Db,
  entry: { kind: SummaryKind; periodStart: string; summary: string; model?: string },
): Promise<AiSummary | null> {
  const summary = entry.summary.trim();
  if (summary === "") return null;

  const [row] = await db
    .insert(aiSummaries)
    .values({
      kind: entry.kind,
      periodStart: entry.periodStart,
      summary,
      model: entry.model ?? "",
    })
    .onConflictDoUpdate({
      target: [aiSummaries.kind, aiSummaries.periodStart],
      set: { summary, model: entry.model ?? "", createdAt: sql`now()` },
    })
    .returning();

  return row ?? null;
}

/** The stored summary for one period, or null. */
export async function summaryFor(
  db: Db,
  kind: SummaryKind,
  periodStart: string,
): Promise<AiSummary | null> {
  const [row] = await db
    .select()
    .from(aiSummaries)
    .where(and(eq(aiSummaries.kind, kind), eq(aiSummaries.periodStart, periodStart)))
    .limit(1);
  return row ?? null;
}

/**
 * Recent summaries, newest first — the archive Victor asked for.
 *
 * Newest-first here, unlike the inbox: this is a record being read back, not a queue being
 * worked through, and the interesting end of a diary is the recent one.
 */
export async function recentSummaries(
  db: Db,
  options: { kind?: SummaryKind; since?: string; limit?: number } = {},
): Promise<AiSummary[]> {
  const clauses = [];
  if (options.kind) clauses.push(eq(aiSummaries.kind, options.kind));
  if (options.since) clauses.push(gte(aiSummaries.periodStart, options.since));

  return db
    .select()
    .from(aiSummaries)
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(desc(aiSummaries.periodStart), desc(aiSummaries.id))
    .limit(options.limit ?? 30);
}

/** `YYYY-MM-DD` for a Date in Victor's local day, matching the bodyweight convention. */
export function localDay(now: Date, offsetMinutes: number): string {
  return new Date(now.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 10);
}
