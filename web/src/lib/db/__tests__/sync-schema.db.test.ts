import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { logEntries, rehabCompletions, tasks } from "@/lib/db/schema";
import { resetTestDb, type TestDb } from "@/test/pg";

/**
 * The sync migration, exercised against real Postgres (PGlite) rather than asserted from the
 * SQL text (V3 §1.2, D-150).
 *
 * This matters more than the usual "test the query" case, because the load-bearing part of the
 * migration is a **trigger** — behaviour that no amount of reading `schema.ts` reveals, that
 * Drizzle does not know exists, and that would fail silently. If `bump_sync_seq` stops firing,
 * nothing errors: rows simply stop advancing the cursor, and changes quietly stop reaching the
 * phone. Nobody notices until data is missing.
 */
describe("the sync schema", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await resetTestDb();
  });

  it("stamps every insert with a server_seq from the shared sequence", async () => {
    const [task] = await db.insert(tasks).values({ title: "one" }).returning();
    const [entry] = await db.insert(logEntries).values({ category: "day" }).returning();

    expect(task.serverSeq).toBeGreaterThan(0);
    // One sequence across all tables, not one per table — which is the whole point. A single
    // cursor has to order changes from every table against each other.
    expect(entry.serverSeq).toBeGreaterThan(task.serverSeq);
  });

  it("advances server_seq on update, which is what makes an edit reach the phone", async () => {
    const [task] = await db.insert(tasks).values({ title: "one" }).returning();
    const [after] = await db
      .update(tasks)
      .set({ title: "two" })
      .where(eq(tasks.id, task.id))
      .returning();

    expect(after.serverSeq).toBeGreaterThan(task.serverSeq);
  });

  it("advances server_seq on a soft delete, so deletes propagate like any other change", async () => {
    const [entry] = await db.insert(logEntries).values({ category: "day" }).returning();
    const [deleted] = await db
      .update(logEntries)
      .set({ deletedAt: new Date() })
      .where(eq(logEntries.id, entry.id))
      .returning();

    expect(deleted.serverSeq).toBeGreaterThan(entry.serverSeq);
    expect(deleted.deletedAt).not.toBeNull();
  });

  it("maintains updated_at server-side and leaves updated_hlc alone", async () => {
    // Two clocks, two jobs. `updated_at` is the server's receipt and the trigger owns it;
    // `updated_hlc` is the client's clock and is what last-write-wins compares. Conflating
    // them is how the timezone bug gets in, so the trigger must not touch the second one.
    const [task] = await db
      .insert(tasks)
      .values({ title: "one", updatedHlc: "abc-1-phone" })
      .returning();

    expect(task.updatedHlc).toBe("abc-1-phone");
    expect(task.updatedAt).toBeInstanceOf(Date);

    const [after] = await db
      .update(tasks)
      .set({ title: "two" })
      .where(eq(tasks.id, task.id))
      .returning();

    // Untouched by an update that did not mention it.
    expect(after.updatedHlc).toBe("abc-1-phone");
  });

  it("gives every row a client id, including rows the server created", async () => {
    // The default is what makes `client_id` the global identity for every row rather than a
    // phone-only marker — so the phone never has to learn a server `serial` id after a create
    // is accepted.
    const [task] = await db.insert(tasks).values({ title: "one" }).returning();
    expect(task.clientId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects a second row with the same client id, which is what makes a retry safe", async () => {
    const clientId = "11111111-2222-3333-4444-555555555555";
    await db.insert(logEntries).values({ category: "day", clientId });

    // The failure this prevents: a flush times out after the server committed, the outbox
    // retries, and the entry is logged twice.
    await expect(db.insert(logEntries).values({ category: "day", clientId })).rejects.toThrow();
  });

  it("lets rehab completions carry a tombstone instead of being hard-deleted", async () => {
    // The reason this column exists: toggling used to be insert-or-hard-delete, and a hard
    // delete leaves nothing to compare. Offline, there was no way to tell a phone that
    // un-ticked an item from a phone that never had the row (`SYNC_DESIGN.md` §4).
    const [row] = await db
      .insert(rehabCompletions)
      .values({ completedOn: "2026-08-31", slug: "banded-external-rotation" })
      .returning();

    const [untoggled] = await db
      .update(rehabCompletions)
      .set({ deletedAt: new Date() })
      .where(eq(rehabCompletions.id, row.id))
      .returning();

    expect(untoggled.deletedAt).not.toBeNull();
    expect(untoggled.serverSeq).toBeGreaterThan(row.serverSeq);

    // Re-ticking is an upsert back to alive against the same natural key, not a second row.
    const [retoggled] = await db
      .update(rehabCompletions)
      .set({ deletedAt: null })
      .where(eq(rehabCompletions.id, row.id))
      .returning();

    expect(retoggled.deletedAt).toBeNull();
    const all = await db.select().from(rehabCompletions);
    expect(all).toHaveLength(1);
  });

  it("orders changes across tables by one cursor", async () => {
    // What a pull actually does: everything above a watermark, in order, regardless of which
    // table it came from.
    const [a] = await db.insert(tasks).values({ title: "a" }).returning();
    const [b] = await db.insert(logEntries).values({ category: "day" }).returning();
    const [c] = await db.update(tasks).set({ title: "a2" }).where(eq(tasks.id, a.id)).returning();

    const seqs = [a.serverSeq, b.serverSeq, c.serverSeq];
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
    expect(new Set(seqs).size).toBe(3);
  });

  it("has the trigger installed on every syncable table", async () => {
    // A list, because the way this breaks is a table added later that nobody wires up — and
    // its symptom is silence.
    const { rows } = (await db.execute(
      sql`SELECT event_object_table AS t FROM information_schema.triggers
          WHERE trigger_name LIKE '%bump_sync_seq'`,
    )) as unknown as { rows: { t: string }[] };

    expect(new Set(rows.map((r) => r.t))).toEqual(
      new Set([
        "workouts",
        "workout_sets",
        "tasks",
        "log_entries",
        "bodyweight_entries",
        "rehab_completions",
        "ai_summaries",
      ]),
    );
  });
});
