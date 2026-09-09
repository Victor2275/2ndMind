/**
 * Seeds the exercise catalogue from `src/lib/athletics/catalogue.ts` (V4 Phase 2.1).
 *
 *   node --env-file-if-exists=.env.local scripts/seed-exercises.mts
 *   node --env-file-if-exists=.env.local scripts/seed-exercises.mts --check
 *
 * ## Safe to run repeatedly, and that is the whole design
 *
 * Rows are matched **by name**, which is the catalogue's natural key. A name already present is
 * updated in place if the seed's idea of it has changed and left alone otherwise; a name that is
 * gone from the seed is **not** deleted. That last part is deliberate: by the time this is run a
 * second time, `workout_sets` rows point at these names as free text, and a catalogue entry
 * disappearing under them would leave a session referring to a movement the app no longer knows.
 *
 * ## What it will not touch
 *
 * Anything whose `source` is not `seed`. A movement typed on the phone, or one the AI-add path
 * proposed and Victor confirmed, is his — re-running the seed must never rewrite or remove it,
 * even if the seed later gains a row with the same name. In that case the manual row wins and
 * the seed row is skipped, because the one thing worse than a duplicate is silently replacing
 * something a person entered.
 *
 * `--check` reports what it would do and changes nothing, which is what makes it safe to run
 * against production to answer "is the catalogue current?".
 */
import { neon } from "@neondatabase/serverless";

import { CATALOGUE } from "../src/lib/athletics/catalogue.ts";

const check = process.argv.includes("--check");

const url = process.env.DATABASE_URL;
if (!url) {
  // Refused rather than skipped, for the same reason the e2e suites refuse: a script that
  // quietly does nothing when a variable is missing reports success for having run zero work.
  console.error("seed-exercises: DATABASE_URL is required (it lives in .env.local).");
  process.exit(2);
}

const sql = neon(url);

type Row = { name: string; modality: string; muscles: string[]; equipment: string; source: string };

const existing = (await sql`select name, modality, muscles, equipment, source
                            from exercises where deleted_at is null`) as Row[];
const byName = new Map(existing.map((row) => [row.name, row]));

const toInsert: typeof CATALOGUE = [];
const toUpdate: typeof CATALOGUE = [];
const skippedAsYours: string[] = [];

for (const entry of CATALOGUE) {
  const current = byName.get(entry.name);

  if (!current) {
    toInsert.push(entry);
    continue;
  }

  if (current.source !== "seed") {
    skippedAsYours.push(entry.name);
    continue;
  }

  const same =
    current.modality === entry.modality &&
    current.equipment === entry.equipment &&
    current.muscles.length === entry.muscles.length &&
    current.muscles.every((m, i) => m === entry.muscles[i]);

  if (!same) toUpdate.push(entry);
}

console.log(`catalogue: ${CATALOGUE.length} entries, ${existing.length} rows in the database`);
console.log(`  insert ${toInsert.length}`);
console.log(`  update ${toUpdate.length}`);
if (skippedAsYours.length > 0) {
  console.log(
    `  left alone (not seed rows): ${skippedAsYours.length} — ${skippedAsYours.join(", ")}`,
  );
}

if (check) {
  console.log("\n--check: nothing was written.");
  process.exit(toInsert.length + toUpdate.length > 0 ? 1 : 0);
}

for (const entry of toInsert) {
  await sql`insert into exercises (name, modality, muscles, equipment, source)
            values (${entry.name}, ${entry.modality}, ${entry.muscles}, ${entry.equipment}, 'seed')
            on conflict (name) do nothing`;
}

for (const entry of toUpdate) {
  // `updated_hlc` is left to the trigger and the server default. This is the server writing, so
  // there is no device clock to stamp it with — and the pull cursor moves either way, which is
  // what makes the change reach the phone.
  await sql`update exercises
            set modality = ${entry.modality},
                muscles = ${entry.muscles},
                equipment = ${entry.equipment}
            where name = ${entry.name} and source = 'seed'`;
}

console.log(`\nseeded. ${toInsert.length} inserted, ${toUpdate.length} updated.`);
