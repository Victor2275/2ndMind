import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { logEntries, tasks } from "@/lib/db/schema";
import { resetTestDb, type TestDb } from "@/test/pg";

/**
 * The GIN indexes behind the tag filter (V4 §8.8, D-331).
 *
 * `listEntries` and `listTasks` both filter with `tags @> ARRAY[...]`, and until this migration
 * neither column had an index of any kind. A B-tree cannot answer array-containment at all, so
 * the query that the whole of §2.3 exists to serve — *"a recipe I want to try has nowhere to
 * go"* — was a sequential scan over every row.
 *
 * ## What this test can honestly prove, and what it cannot
 *
 * It asserts the indexes **exist and are GIN**, against the real committed migration SQL run
 * into real Postgres. That is a genuine check: `drizzle-kit` could emit the wrong access
 * method, the migration could fail to apply, or someone could drop the line from `schema.ts`
 * and regenerate.
 *
 * It deliberately does **not** assert that a query plan uses them. Postgres picks a sequential
 * scan on a table of a dozen rows no matter what indexes exist, because for a dozen rows that
 * genuinely is faster — so an `EXPLAIN` assertion here would either fail against correct code
 * or need enough seeded rows to change the planner's mind, which makes the test slow and its
 * threshold arbitrary. Asserting the index exists is the part that stays true at every size.
 */
describe("the tag columns are indexed for containment", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await resetTestDb();
  });

  /**
   * `pg_indexes` reports the `CREATE INDEX` statement Postgres actually stored.
   *
   * The `as unknown as { rows }` cast matches `sync-schema.db.test.ts` — `execute`'s return is
   * driver-dependent and Drizzle types it as the union, so every raw-SQL read in this repo
   * narrows it the same way.
   */
  async function indexDef(name: string): Promise<string | null> {
    const { rows } = (await db.execute(
      sql`SELECT indexdef FROM pg_indexes WHERE indexname = ${name}`,
    )) as unknown as { rows: { indexdef: string }[] };

    return rows[0]?.indexdef ?? null;
  }

  for (const [table, index] of [
    ["log_entries", "log_entries_tags_idx"],
    ["tasks", "tasks_tags_idx"],
  ] as const) {
    it(`${table}.tags has a GIN index`, async () => {
      const def = await indexDef(index);

      expect(def, `${index} does not exist — the migration did not apply`).not.toBeNull();
      // `USING gin`, not merely "an index exists". A B-tree here would be created without
      // error by some generators and would never be used by `@>`, which is the silent version
      // of having no index at all.
      expect(def?.toLowerCase()).toContain("using gin");
    });
  }

  /**
   * The control. `indexDef` is the only thing the two assertions above trust, and a reader
   * that returned a string unconditionally would make both pass while checking nothing —
   * D-315's lesson, applied to a three-line helper. This is the cheapest way to show it
   * discriminates.
   */
  it("reports null for an index that does not exist — the control", async () => {
    await expect(indexDef("log_entries_tags_idx_that_never_existed")).resolves.toBeNull();
  });

  it("the filter those indexes serve still returns the right rows", async () => {
    // The index is an optimisation, so the correctness it must not change is worth pinning
    // beside it — a wrong index and a missing one look identical until results differ.
    await db.insert(logEntries).values([
      { category: "note", tags: ["recipe", "bread"] },
      { category: "note", tags: ["bread"] },
      { category: "note", tags: [] },
    ]);
    await db.insert(tasks).values([
      { title: "tagged", tags: ["recipe"] },
      { title: "untagged", tags: [] },
    ]);

    const entries = await db
      .select()
      .from(logEntries)
      .where(sql`${logEntries.tags} @> ARRAY['recipe']::text[]`);
    const matchedTasks = await db
      .select()
      .from(tasks)
      .where(sql`${tasks.tags} @> ARRAY['recipe']::text[]`);

    expect(entries).toHaveLength(1);
    expect(entries[0].tags).toEqual(["recipe", "bread"]);
    expect(matchedTasks).toHaveLength(1);
    expect(matchedTasks[0].title).toBe("tagged");
  });
});
