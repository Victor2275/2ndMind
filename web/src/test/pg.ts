import fs from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/lib/db/schema";

/**
 * A real Postgres for tests, shared per file.
 *
 * PGlite is Postgres compiled to WASM. The first version of this created a fresh instance
 * and re-ran every migration for *each test*, which made the suite take minutes and — with
 * three database test files running concurrently — flaky under load: three tests failed once
 * and then passed on a re-run, which is the worst kind of failure because it teaches you to
 * ignore red.
 *
 * One instance per file, truncated between tests, is both faster and deterministic. Truncate
 * rather than drop-and-recreate so the schema work happens once.
 */

export type TestDb = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = fs
  .readdirSync(path.join(process.cwd(), "drizzle"))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => fs.readFileSync(path.join(process.cwd(), "drizzle", f), "utf8"));

/** Every table the migrations create, discovered from the SQL rather than hand-listed —
 *  a hand-listed set silently stops truncating a table added later. */
const TABLES = [
  ...new Set(
    MIGRATIONS.flatMap((m) => [...m.matchAll(/CREATE TABLE "([^"]+)"/g)].map((x) => x[1])),
  ),
];

let client: PGlite | null = null;
let db: TestDb | null = null;

export async function getTestDb(): Promise<TestDb> {
  if (db) return db;

  client = new PGlite();
  for (const migration of MIGRATIONS) {
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
  db = drizzle(client, { schema }) as unknown as TestDb;
  return db;
}

/** Empties every table and resets identity, so ids start from 1 in each test. */
export async function resetTestDb(): Promise<TestDb> {
  const handle = await getTestDb();
  if (TABLES.length > 0) {
    const list = TABLES.map((t) => `"${t}"`).join(", ");
    await handle.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`));
  }
  return handle;
}
