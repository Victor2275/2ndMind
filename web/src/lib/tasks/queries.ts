import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { tasks, type NewTask, type Task } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { normalizeTag, normalizeTags } from "@/lib/log/tags";

/**
 * Task reads and writes.
 *
 * The handle is a parameter, not a module singleton, so the tests run these against real
 * Postgres in WASM rather than against a mock that proves nothing.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type TaskSource = "manual" | "goal" | "canvas" | "calendar";

/** Live rows only. Soft-deleted tasks stay in the table so undo can bring them back. */
const alive = isNull(tasks.deletedAt);

export const LA = "America/Los_Angeles";

/**
 * The real UTC offset of a timezone at a given instant, in `getTimezoneOffset` units.
 *
 * This replaces a hard-coded `420` that was correct only while Los Angeles is on daylight
 * time. It would have gone wrong on 1 November 2026 — during term, when this site is used
 * daily — and the symptom is quiet rather than loud: "today" would begin at 11pm the night
 * before, so late-evening tasks and logs file under tomorrow.
 *
 * Formatting the instant in the zone and reading it back as though it were UTC is the only
 * way to get this from the platform without a timezone database of our own.
 */
export function zoneOffsetMinutes(now: Date, timeZone = LA): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    // `h23` rather than `hour12: false`, which yields "24" for midnight on some ICU builds.
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);

  const at = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asIfUtc = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    at("hour"),
    at("minute"),
    at("second"),
  );

  // Positive west of Greenwich, matching `getTimezoneOffset()`: minutes to add to reach UTC.
  return Math.round((now.getTime() - asIfUtc) / 60_000);
}

/**
 * Local midnight as a UTC instant, so "today" means Victor's today, not the server's —
 * Vercel runs in UTC, where the day rolls over at 5pm in Los Angeles.
 *
 * `offsetMinutes` follows the JavaScript convention of `Date.prototype.getTimezoneOffset`:
 * **minutes to add to local time to reach UTC**, so Los Angeles is `+420`, not `-420`. The
 * sign trips people up (it is the opposite of the "UTC-7" people say out loud), which is why
 * there are tests pinning both directions.
 */
export function dayBounds(now: Date, offsetMinutes: number): { start: Date; end: Date } {
  // Shift into local time, floor to the day, shift back. Doing this with UTC getters on the
  // shifted value avoids depending on the server's own timezone at all.
  const shifted = new Date(now.getTime() - offsetMinutes * 60_000);
  const startLocal = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const start = new Date(startLocal + offsetMinutes * 60_000);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export async function listTasks(
  db: Db,
  options: { includeDone?: boolean; tag?: string; limit?: number } = {},
): Promise<Task[]> {
  const clauses = [options.includeDone ? alive : and(alive, isNull(tasks.doneAt))];
  // Same `@>` shape as `listEntries` in `lib/log/queries.ts` — a tag has already gone through
  // `normalizeTag` on write, so the filter normalises the same way rather than trusting the
  // caller to have matched the stored case.
  if (options.tag) clauses.push(sql`${tasks.tags} @> ARRAY[${normalizeTag(options.tag)}]::text[]`);

  return (
    db
      .select()
      .from(tasks)
      .where(and(...clauses))
      // Undated tasks sort last rather than first: `NULLS LAST` is not the default in Postgres
      // for ascending order, and without it every undated task would sit above today's work.
      .orderBy(sql`${tasks.dueAt} asc nulls last`, asc(tasks.id))
      .limit(options.limit ?? 200)
  );
}

/**
 * What belongs on the Today screen: anything due before tomorrow, plus anything overdue.
 * Undated tasks are excluded here — they are a backlog, not a plan for today.
 */
export async function listDueBy(db: Db, cutoff: Date): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(and(alive, isNull(tasks.doneAt), lt(tasks.dueAt, cutoff)))
    .orderBy(sql`${tasks.dueAt} asc nulls last`, asc(tasks.id));
}

/** Completed within the window — used to show that today was not wasted. */
export async function listDoneBetween(db: Db, start: Date, end: Date): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(and(alive, gte(tasks.doneAt, start), lt(tasks.doneAt, end)))
    .orderBy(asc(tasks.doneAt));
}

/**
 * The inbox: undated, unfiled notes captured so they stop occupying attention.
 *
 * A task row with `source: "inbox"` rather than a notes table, per D-037 — everything
 * actionable is one model, and the whole point of jotting something down is that it will
 * later become actionable. Triaging one means giving it a domain or a due date, which is
 * an edit to the row it already is, not a migration between two stores.
 *
 * Oldest first, deliberately. An inbox sorted newest-first hides its own backlog: the item
 * you have been avoiding for three weeks sinks below the one you added this morning.
 */
export async function listInbox(db: Db, limit = 50): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(and(alive, isNull(tasks.doneAt), eq(tasks.source, "inbox")))
    .orderBy(asc(tasks.createdAt), asc(tasks.id))
    .limit(limit);
}

/** How many days the oldest untriaged note has been sitting. 0 when the inbox is empty. */
export function staleDays(items: Task[], now: Date): number {
  if (items.length === 0) return 0;
  const oldest = items.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
  return Math.floor((now.getTime() - oldest.createdAt.getTime()) / 86_400_000);
}

export async function createTask(db: Db, input: NewTask): Promise<Task> {
  // Normalised again here, not only at the form boundary — `NewTask` is Drizzle's inferred
  // insert type, so nothing stops a caller from handing this an un-normalised list, and a
  // Server Action is a POST endpoint with a guessable id.
  const tags = input.tags ? normalizeTags(input.tags) : undefined;
  const [row] = await db
    .insert(tasks)
    .values(tags ? { ...input, tags } : input)
    .returning();
  return row;
}

/**
 * Every tag in use on a task, for `TagInput`'s suggestions.
 *
 * Same shape as `allTags` in `lib/log/queries.ts` — frequency order, `unnest` rather than
 * pulling every row into JS to flatten there. **Not merged with the log's tags here**: the two
 * query modules do not import each other, so the UI combines both lists into one suggestion
 * set (`lib/log/tags.ts`'s vocabulary is shared in *meaning*, not in a shared query) — see
 * D-241 for why one vocabulary across two tables did not need a shared table to get it.
 */
export async function allTaskTags(db: Db, limit = 100): Promise<string[]> {
  const rows = await db
    .select({ tag: sql<string>`t.tag`, n: sql<number>`count(*)::int` })
    .from(sql`${tasks}, unnest(${tasks.tags}) as t(tag)`)
    .where(alive)
    .groupBy(sql`t.tag`)
    .orderBy(sql`count(*) desc`, sql`t.tag asc`)
    .limit(limit);

  return rows.map((r) => r.tag);
}

export async function setTaskDone(db: Db, id: number, done: boolean): Promise<Task | null> {
  const [row] = await db
    .update(tasks)
    .set({ doneAt: done ? new Date() : null })
    .where(and(eq(tasks.id, id), alive))
    .returning();
  return row ?? null;
}

/** Soft delete. The row survives so `restoreTask` can undo it. */
export async function deleteTask(db: Db, id: number): Promise<Task | null> {
  const [row] = await db
    .update(tasks)
    .set({ deletedAt: new Date() })
    .where(and(eq(tasks.id, id), alive))
    .returning();
  return row ?? null;
}

export async function restoreTask(db: Db, id: number): Promise<Task | null> {
  const [row] = await db.update(tasks).set({ deletedAt: null }).where(eq(tasks.id, id)).returning();
  return row ?? null;
}

/**
 * Upsert from a feed. Calendar and Canvas rows are re-read on a schedule, so this has to
 * update in place — inserting would duplicate every assignment on every refresh.
 *
 * Deliberately does not touch `doneAt`: ticking something off must survive the next sync.
 */
export async function upsertExternalTask(db: Db, input: NewTask & { externalId: string }) {
  const [row] = await db
    .insert(tasks)
    .values(input)
    .onConflictDoUpdate({
      target: tasks.externalId,
      set: {
        title: input.title,
        dueAt: input.dueAt ?? null,
        courseCode: input.courseCode ?? null,
        notes: input.notes ?? "",
      },
    })
    .returning();
  return row;
}

/** Goals are tasks too. This is what the sprint editor writes now. */
export async function replaceGoals(
  db: Db,
  goals: { title: string; domain: string }[],
): Promise<Task[]> {
  // Soft-delete the old set rather than dropping it, so a mistaken save is recoverable.
  await db
    .update(tasks)
    .set({ deletedAt: new Date() })
    .where(and(eq(tasks.source, "goal"), alive));

  if (goals.length === 0) return [];

  return db
    .insert(tasks)
    .values(goals.map((g) => ({ title: g.title, domain: g.domain, source: "goal" as const })))
    .returning();
}

export async function currentGoals(db: Db): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(and(alive, eq(tasks.source, "goal")))
    .orderBy(asc(tasks.id));
}

export async function countOpen(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(alive, isNull(tasks.doneAt)));
  return row?.n ?? 0;
}
