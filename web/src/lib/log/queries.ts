import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { logEntries, type LogEntry } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { searchTextFor } from "./categories";

/**
 * Log entry reads and writes. Handle passed in, so the tests run against real Postgres.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const alive = isNull(logEntries.deletedAt);

export type NewEntry = {
  category: string;
  note?: string;
  data?: Record<string, unknown>;
  occurredAt?: Date;
};

export async function createEntry(db: Db, input: NewEntry): Promise<LogEntry> {
  const data = input.data ?? {};
  const note = input.note ?? "";

  const [row] = await db
    .insert(logEntries)
    .values({
      category: input.category,
      note,
      data,
      // Denormalised here, so every write path gets it — a caller that forgot would produce
      // an entry that exists but can never be found again.
      searchText: searchTextFor(input.category, data, note),
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
    })
    .returning();

  return row;
}

export async function listEntries(
  db: Db,
  options: { category?: string; limit?: number } = {},
): Promise<LogEntry[]> {
  const where = options.category ? and(alive, eq(logEntries.category, options.category)) : alive;

  return db
    .select()
    .from(logEntries)
    .where(where)
    .orderBy(desc(logEntries.occurredAt), desc(logEntries.id))
    .limit(options.limit ?? 50);
}

export async function entriesBetween(db: Db, start: Date, end: Date): Promise<LogEntry[]> {
  return db
    .select()
    .from(logEntries)
    .where(and(alive, gte(logEntries.occurredAt, start), lt(logEntries.occurredAt, end)))
    .orderBy(desc(logEntries.occurredAt));
}

/**
 * Full-text search across every entry ever written.
 *
 * `plainto_tsquery` rather than `to_tsquery`: it takes whatever the user typed and cannot be
 * made to throw on punctuation, where `to_tsquery` raises a syntax error on a bare `&` and
 * would turn a stray character into a 500.
 */
export async function searchEntries(db: Db, query: string, limit = 50): Promise<LogEntry[]> {
  const trimmed = query.trim();
  if (trimmed === "") return [];

  return db
    .select()
    .from(logEntries)
    .where(
      and(
        alive,
        sql`to_tsvector('english', ${logEntries.searchText}) @@ plainto_tsquery('english', ${trimmed})`,
      ),
    )
    .orderBy(desc(logEntries.occurredAt))
    .limit(limit);
}

export async function deleteEntry(db: Db, id: number): Promise<LogEntry | null> {
  const [row] = await db
    .update(logEntries)
    .set({ deletedAt: new Date() })
    .where(and(eq(logEntries.id, id), alive))
    .returning();
  return row ?? null;
}

export async function restoreEntry(db: Db, id: number): Promise<LogEntry | null> {
  const [row] = await db
    .update(logEntries)
    .set({ deletedAt: null })
    .where(eq(logEntries.id, id))
    .returning();
  return row ?? null;
}

/** Which categories have an entry today — drives the daily prompt. */
export async function categoriesLoggedBetween(db: Db, start: Date, end: Date): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: logEntries.category })
    .from(logEntries)
    .where(and(alive, gte(logEntries.occurredAt, start), lt(logEntries.occurredAt, end)));
  return rows.map((r) => r.category);
}

export async function countEntries(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(logEntries)
    .where(alive);
  return row?.n ?? 0;
}
