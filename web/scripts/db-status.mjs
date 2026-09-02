/**
 * Which migrations the database has, and which the repo has (D-156).
 *
 * Written after `0005_sync_columns` sat unapplied for three commits while every test passed.
 * The suite builds a fresh PGlite and applies every migration file, so the schema it tests
 * against is by construction the one the code expects — the single arrangement in which drift
 * cannot happen. Nothing anywhere compared the repo to the database that actually serves.
 *
 * Read-only. Run it with `npm run db:status`.
 *
 * Exits 1 when anything is pending, so it can gate a deploy later if that turns out to be
 * worth it. It is deliberately *not* wired into `predev` or `prebuild`: both would put a
 * network round trip in front of every start and fail on a plane.
 */

import fs from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");

if (!fs.existsSync(journalPath)) {
  console.error("No drizzle/meta/_journal.json — run this from web/.");
  process.exit(1);
}

const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
const expected = journal.entries.sort((a, b) => a.idx - b.idx).map((e) => e.tag);

if (!process.env.DATABASE_URL) {
  console.log(`${expected.length} migration(s) in the repo. DATABASE_URL is not set, so there is`);
  console.log("nothing to compare against. Set it in web/.env.local.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

let applied = [];
try {
  applied = await sql`
    select created_at from drizzle.__drizzle_migrations order by created_at asc`;
} catch (error) {
  // No migrations table at all means none have ever run — a fresh database, not a broken one.
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("does not exist")) throw error;
}

// Drizzle records a row per migration, in journal order, and stores a hash rather than the
// tag — so position is what can be compared, not name. Good enough: it applies in order and
// never skips.
const count = applied.length;
const pending = expected.slice(count);

console.log(`repo:     ${expected.length} migration(s)`);
console.log(`database: ${count} applied`);
console.log("");

for (const [i, tag] of expected.entries()) {
  console.log(`  ${i < count ? "applied" : "PENDING"}  ${tag}`);
}

if (pending.length === 0) {
  console.log("\nUp to date.");
  process.exit(0);
}

console.log(`\n${pending.length} migration(s) pending. The app will fail on every query that`);
console.log("touches a changed table until these run:\n");
console.log("  npm run db:migrate\n");
process.exit(1);
