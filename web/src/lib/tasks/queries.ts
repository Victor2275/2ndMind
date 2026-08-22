import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { tasks, type NewTask, type Task } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

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
  options: { includeDone?: boolean; limit?: number } = {},
): Promise<Task[]> {
  const where = options.includeDone ? alive : and(alive, isNull(tasks.doneAt));
  return db
    .select()
    .from(tasks)
    .where(where)
    // Undated tasks sort last rather than first: `NULLS LAST` is not the default in Postgres
    // for ascending order, and without it every undated task would sit above today's work.
    .orderBy(sql`${tasks.dueAt} asc nulls last`, asc(tasks.id))
    .limit(options.limit ?? 200);
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

export async function createTask(db: Db, input: NewTask): Promise<Task> {
  const [row] = await db.insert(tasks).values(input).returning();
  return row;
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
  const [row] = await db
    .update(tasks)
    .set({ deletedAt: null })
    .where(eq(tasks.id, id))
    .returning();
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
