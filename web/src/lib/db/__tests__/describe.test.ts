// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, isNull, lt } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";
import { tasks } from "@/lib/db/schema";
import { describeDbError } from "@/lib/db/describe";

/**
 * The outage of 2026-09-03, as a test (D-156).
 *
 * `0005_sync_columns` was generated in §1.2 and never applied to Neon. Drizzle went on building
 * every query with `client_id`, `updated_hlc` and `server_seq`; the database had none of them;
 * every page touching tasks, the log, workouts, bodyweight or rehab failed at once. What it
 * showed was the failed SQL and its fifteen column names.
 *
 * **The suite could not have caught it, and still cannot.** `src/test/pg.ts` builds a fresh
 * PGlite and applies *every* migration file, so the tested schema is by construction the schema
 * the code expects — the one arrangement in which drift is impossible. That is the right
 * default and it is also precisely the blind spot.
 *
 * So this file does the one thing the rest of the suite is built not to do: it stops the
 * migrations early, on purpose, and asserts that what comes back is a sentence naming the fix
 * rather than a wall of SQL.
 */

const DIR = path.join(process.cwd(), "drizzle");
const FILES = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** A database frozen at some point in the migration history. */
async function databaseAt(count: number) {
  const client = new PGlite();
  for (const file of FILES.slice(0, count)) {
    const sql = fs.readFileSync(path.join(DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
  return { client, db: drizzle(client, { schema }) };
}

/**
 * All three built once, for the reason `src/test/pg.ts` already gives: a PGlite per test is
 * slow enough that the suite goes flaky under load rather than failing honestly. Three more
 * instances spun up per test was enough to blow the 5s timeout the first time this ran with
 * everything else.
 */
type Frozen = Awaited<ReturnType<typeof databaseAt>>;
let empty: Frozen;
let behind: Frozen;
let current: Frozen;

beforeAll(async () => {
  [empty, behind, current] = await Promise.all([
    databaseAt(0),
    databaseAt(FILES.length - 1),
    databaseAt(FILES.length),
  ]);
}, 120_000);

afterAll(async () => {
  await Promise.all([empty?.client.close(), behind?.client.close(), current?.client.close()]);
});

describe("a database that is behind the code", () => {
  it("says so, instead of printing the query", async () => {
    // Exactly the state Neon was in: everything except the sync columns.
    let caught: unknown;
    try {
      await behind.db
        .select()
        .from(tasks)
        .where(and(isNull(tasks.deletedAt), lt(tasks.dueAt, new Date())));
    } catch (error) {
      caught = error;
    }

    expect(
      caught,
      "the query should fail — if it did not, this test has stopped testing anything",
    ).toBeDefined();

    const message = describeDbError(caught, { subject: "The tasks table" });
    expect(message).toContain("behind this build");
    expect(message).toContain("npm run db:migrate");
  });

  it("distinguishes that from a table that was never created", async () => {
    // A fresh clone, nothing migrated. Same symptom to look at, different fix — and the four
    // copies of this helper that existed before D-156 all handled *only* this case.
    let caught: unknown;
    try {
      await empty.db.select().from(tasks);
    } catch (error) {
      caught = error;
    }

    const message = describeDbError(caught, { subject: "The tasks table" });
    expect(message).toBe("The tasks table is missing. Run `npm run db:migrate`.");
  });

  it("works once every migration has been applied", async () => {
    await expect(current.db.select().from(tasks)).resolves.toEqual([]);
  });
});

describe("the messages", () => {
  it("passes a configuration problem through, because it already says what to set", () => {
    const error = new Error("DATABASE_URL is not set.");
    expect(describeDbError(error)).toBe("DATABASE_URL is not set.");
  });

  it("reads the SQLSTATE when there is one", () => {
    const error = Object.assign(new Error("something opaque"), { code: "42703" });
    expect(describeDbError(error)).toContain("behind this build");
  });

  it("names a missing function, which reads as a code bug otherwise", () => {
    const error = Object.assign(new Error("function bump_sync_seq() does not exist"), {
      code: "42883",
    });
    expect(describeDbError(error)).toContain("missing a function");
  });

  it("leaves an unrelated failure alone rather than guessing", () => {
    // A connection timeout is not a migration problem, and telling him to migrate would send
    // him to the one place the answer is not.
    const error = new Error("Connection terminated unexpectedly");
    expect(describeDbError(error)).toBe("Connection terminated unexpectedly");
  });

  it("handles something that is not an Error at all", () => {
    expect(describeDbError("nope")).toBe("nope");
    expect(describeDbError(null)).toBe("null");
  });
});
