import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { logEntries, type LogEntry } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { searchTextFor, UNSORTED_CATEGORY } from "./categories";
import { normalizeTag, normalizeTags } from "./tags";

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
  /** Free tags (V4 Phase 3). Normalised again here, not only at the form boundary — a Server
   *  Action is a POST endpoint with a guessable id, so a caller that skipped `readTags` must
   *  not be able to smuggle in an oversized or duplicated list. */
  tags?: string[];
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
      tags: normalizeTags(input.tags ?? []),
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
    })
    .returning();

  return row;
}

/**
 * Notes captured but not yet filed into a real category (D-164).
 *
 * Newest first, because the pile is worked from the top and the thing written five minutes ago
 * is the one still fresh enough to file correctly.
 */
export async function unsortedEntries(db: Db, limit = 50): Promise<LogEntry[]> {
  return db
    .select()
    .from(logEntries)
    .where(and(eq(logEntries.category, UNSORTED_CATEGORY), alive))
    .orderBy(desc(logEntries.occurredAt), desc(logEntries.id))
    .limit(limit);
}

export async function countUnsorted(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(logEntries)
    .where(and(eq(logEntries.category, UNSORTED_CATEGORY), alive));
  return row?.n ?? 0;
}

/**
 * File an unsorted note into a real category — and, since V4 Phase 3, tag it in the same call.
 *
 * The note text moves across unchanged and `search_text` is recomputed, because it carries the
 * category label — leaving it would make a filed entry findable under "Note" and not under
 * "Training", which is the opposite of what filing is for.
 *
 * Only ever moves an entry *out* of the unsorted pile: the `where` requires it to be there.
 * Without that, a mistyped id could recategorise a real training entry into something else,
 * silently, with no undo — the log has no edit path anywhere else, and this is not the place
 * to introduce one by accident.
 *
 * **`tags` is additive, deliberately not the one-way-door guard's business.** D-164's rule is
 * about `category` — a note may be filed exactly once, out of the pile — and tagging is a
 * different axis: a filed entry can still be tagged again later through `editEntry`, the way
 * any of its other fields can. This just lets the one screen that already asks "where does
 * this go" also ask "what does this have on it", instead of two taps where one would do.
 * Omitted or empty leaves whatever tags the note already carried (normally none, since capture
 * has no tag input) untouched — the parameter adds tags, it does not replace the list.
 */
export async function fileEntry(
  db: Db,
  id: number,
  category: string,
  tags?: string[],
): Promise<LogEntry | null> {
  const [existing] = await db
    .select()
    .from(logEntries)
    .where(and(eq(logEntries.id, id), eq(logEntries.category, UNSORTED_CATEGORY), alive));
  if (!existing) return null;

  const nextTags =
    tags && tags.length > 0
      ? normalizeTags([...(existing.tags ?? []), ...tags])
      : (existing.tags ?? []);

  const [row] = await db
    .update(logEntries)
    .set({
      category,
      tags: nextTags,
      searchText: searchTextFor(category, existing.data, existing.note),
    })
    .where(eq(logEntries.id, id))
    .returning();

  return row ?? null;
}

/**
 * Add tags to an entry, wherever it lives — no category change, no unsorted-pile requirement
 * (V4 Phase 3, §3.3).
 *
 * This is what lets a note stay in the unsorted pile and still be tagged `#recipe`, and what
 * lets an already-filed entry pick up a tag later. It is deliberately a different door from
 * `fileEntry`'s: that one is one-way *because* it changes `category`; this one never touches
 * `category` at all, so there is nothing here for the one-way-door guard to protect.
 *
 * Additive, like `fileEntry`'s tag parameter — it merges into whatever tags the row already
 * has rather than replacing them, so tagging twice cannot lose the first tag.
 */
export async function tagEntry(db: Db, id: number, tags: string[]): Promise<LogEntry | null> {
  const [existing] = await db
    .select()
    .from(logEntries)
    .where(and(eq(logEntries.id, id), alive));
  if (!existing) return null;

  const [row] = await db
    .update(logEntries)
    .set({ tags: normalizeTags([...(existing.tags ?? []), ...tags]) })
    .where(eq(logEntries.id, id))
    .returning();

  return row ?? null;
}

/**
 * Edit an entry that has already been saved (Q402, V4 Phase 2).
 *
 * ## Its own guard, deliberately not `fileEntry`'s
 *
 * `fileEntry` above is one-way on purpose: it can only move a note *out* of the unsorted pile,
 * so a mistyped id cannot recategorise a real entry. Reusing that guard here would have been
 * tempting and wrong — the two operations protect different things.
 *
 * **This one cannot change an entry's category at all.** The category is read from the stored
 * row and never from the caller. That keeps filing a one-way door even though editing now
 * exists: an entry can be filed once, out of the pile, and after that its category is settled.
 * Without the rule, `editEntry` would be a second and much wider way to do what `fileEntry`
 * carefully restricts.
 *
 * `search_text` is recomputed from the stored category and the new content, because it carries
 * both — leaving it would make an edited entry findable by the words it used to contain.
 *
 * Returns `null` for an entry that is missing or already deleted, rather than resurrecting one.
 */
export async function editEntry(
  db: Db,
  id: number,
  changes: { note: string; data: Record<string, unknown> },
): Promise<LogEntry | null> {
  const [existing] = await db
    .select()
    .from(logEntries)
    .where(and(eq(logEntries.id, id), alive));
  if (!existing) return null;

  const [row] = await db
    .update(logEntries)
    .set({
      note: changes.note,
      data: changes.data,
      searchText: searchTextFor(existing.category, changes.data, changes.note),
    })
    .where(eq(logEntries.id, id))
    .returning();

  return row ?? null;
}

export async function listEntries(
  db: Db,
  options: { category?: string; tag?: string; limit?: number } = {},
): Promise<LogEntry[]> {
  const clauses = [alive];
  if (options.category) clauses.push(eq(logEntries.category, options.category));
  // `@>` (array contains) rather than `= ANY`: reads as "this row's tags include that one",
  // which is the question a filter actually asks, and it is what the tag already went through
  // `normalizeTag` to match — a raw form value would miss on case alone.
  if (options.tag)
    clauses.push(sql`${logEntries.tags} @> ARRAY[${normalizeTag(options.tag)}]::text[]`);

  return db
    .select()
    .from(logEntries)
    .where(and(...clauses))
    .orderBy(desc(logEntries.occurredAt), desc(logEntries.id))
    .limit(options.limit ?? 50);
}

/**
 * Every tag in use, for the suggestion list `TagInput` autocompletes from.
 *
 * Sorted by frequency, not alphabetically: the tags worth suggesting are the ones already
 * reused, and a frequency order surfaces "reading" and "recipe" before a one-off typo — which
 * an alphabetical list would give equal billing. `unnest` rather than reading every row's array
 * into JS and flattening it there — this is one aggregate query instead of pulling every log
 * entry over the wire to throw away everything but its tags.
 */
export async function allTags(db: Db, limit = 100): Promise<string[]> {
  const rows = await db
    .select({ tag: sql<string>`t.tag`, n: sql<number>`count(*)::int` })
    .from(sql`${logEntries}, unnest(${logEntries.tags}) as t(tag)`)
    .where(alive)
    .groupBy(sql`t.tag`)
    .orderBy(sql`count(*) desc`, sql`t.tag asc`)
    .limit(limit);

  return rows.map((r) => r.tag);
}

/**
 * Recent entries, reduced to what the chips need (V3 §1.6, D-155).
 *
 * One query rather than one per category. Five separate `LIMIT 20`s would each be cheap and
 * would still be five round trips in front of a form whose entire promise is that it appears
 * instantly; two hundred rows of `(category, data)` is a single index scan and covers months
 * of every category at once.
 *
 * Only the two columns the chips read. `select *` here would drag every note and search
 * vector across the wire to be thrown away.
 */
export async function recentForChips(
  db: Db,
  limit = 200,
): Promise<{ category: string; data: Record<string, unknown> }[]> {
  return db
    .select({ category: logEntries.category, data: logEntries.data })
    .from(logEntries)
    .where(alive)
    .orderBy(desc(logEntries.occurredAt), desc(logEntries.id))
    .limit(limit);
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
