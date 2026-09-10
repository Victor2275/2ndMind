/**
 * Rewrites logged history to the v2 catalogue names — V4 Phase 2++ Stage 3, the only
 * irreversible step in the phase.
 *
 *   node --env-file-if-exists=.env.local scripts/rename-exercises.mts --check
 *   node --env-file-if-exists=.env.local scripts/rename-exercises.mts
 *
 * ## What this touches, and what it does not
 *
 * Only `workout_sets.exercise`, and only the set's own `distance_m`/`duration_s`/`piece_type` —
 * filled from `renames.ts` **only where the set does not already have a value**, since a set
 * logged through the modality-aware form typed its own distance in already and that real number
 * must never be overwritten by the name's approximation of it. It does not touch the `exercises`
 * catalogue table; that is `seed-exercises.mts`'s job, matched by `seed_key`, run separately
 * afterward. This script's report does count how many *catalogue* rows share a name that is
 * about to be renamed, purely so the number is visible before anything runs — those rows are
 * left exactly as they are.
 *
 * ## Why `--check` first, always
 *
 * `workout_sets.exercise` is free text, and every Hevy import and every hand-typed set is a
 * string this script has never seen. Those are listed in full and left alone — a rename map is
 * total over the *catalogue's* v1 names, not over everything anyone ever typed. Read the report
 * before `--apply`: it is the only place "is this migrating what I think it's migrating" can be
 * checked before it is done.
 *
 * ## Reversible for one release
 *
 * Every migrated row's original string survives in `exercise_before_v2` (added in the same
 * migration as this script). That column is dropped a release after this runs — long enough to
 * notice a mistake, not long enough to keep two names for a row alive forever.
 *
 * ## Idempotent
 *
 * A row is matched by `exercise = <v1 name>`. Once migrated, its `exercise` column holds the v2
 * name, which is not a key in `RENAME_MAP` (the map is v1 → v2, and no v2 name is also a v1
 * name — `renames.test.ts` checks exactly that) — so re-running finds nothing left to do for
 * that row. Safe to run again after a sync error, a retry, or just to confirm nothing is
 * pending.
 */
import { neon } from "@neondatabase/serverless";

import { RENAMES } from "../src/lib/athletics/renames.ts";

const check = process.argv.includes("--check");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("rename-exercises: DATABASE_URL is required (it lives in .env.local).");
  process.exit(2);
}

const sql = neon(url);

const byFrom = new Map(RENAMES.map((r) => [r.from, r]));

/** Distinct exercise strings still in v1 form — never migrated, or migrated and reverted. */
const distinct = (await sql`
  select exercise as name, count(*)::int as sets
  from workout_sets
  where deleted_at is null and exercise_before_v2 is null
  group by exercise
`) as { name: string; sets: number }[];

const matched = distinct.filter((row) => byFrom.has(row.name));
const unmatched = distinct.filter((row) => !byFrom.has(row.name));

const totalSetsToMigrate = matched.reduce((sum, row) => sum + row.sets, 0);

// Purely informational — the catalogue table is seed-exercises.mts's job, but the number
// matters for reading this report, so it is computed and shown, never written.
const catalogueImpact =
  matched.length === 0
    ? []
    : ((await sql`
        select name from exercises
        where deleted_at is null and name = any(${matched.map((r) => r.name)}::text[])
      `) as { name: string }[]);

console.log(`workout_sets: ${distinct.length} distinct exercise names logged`);
console.log(`  ${matched.length} names match a v1 -> v2 rename (${totalSetsToMigrate} sets)`);
if (unmatched.length > 0) {
  console.log(`  ${unmatched.length} names have no rename entry and will be left alone:`);
  for (const row of unmatched.sort((a, b) => b.sets - a.sets)) {
    console.log(`    ${row.sets.toString().padStart(5)}  ${row.name}`);
  }
}
if (catalogueImpact.length > 0) {
  console.log(
    `\n  note: ${catalogueImpact.length} catalogue row(s) still carry a v1 name this would rename — ` +
      `seed-exercises.mts does not touch them; they become orphaned seed rows until archived by hand.`,
  );
}

if (check) {
  console.log("\n--check: nothing was written.");
  process.exit(matched.length > 0 ? 1 : 0);
}

for (const row of matched) {
  const rename = byFrom.get(row.name)!;
  await sql`
    update workout_sets
    set exercise = ${rename.to},
        exercise_before_v2 = exercise,
        distance_m = coalesce(distance_m, ${rename.distanceM ?? null}),
        duration_s = coalesce(duration_s, ${rename.durationS ?? null}),
        piece_type = coalesce(piece_type, ${rename.pieceType ?? null})
    where exercise = ${row.name} and exercise_before_v2 is null
  `;
}

// The counts from the report above, not a second read — the WHERE clause is identical to the
// one that produced them, so they are exactly what was just written.
console.log(`\nrenamed. ${matched.length} names, ${totalSetsToMigrate} sets.`);
