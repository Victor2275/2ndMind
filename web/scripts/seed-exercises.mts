/**
 * Seeds the exercise catalogue from `src/lib/athletics/catalogue.ts` — rewritten for V4
 * Phase 2++ Stage 3, now that seeded rows are editable.
 *
 *   node --env-file-if-exists=.env.local scripts/seed-exercises.mts
 *   node --env-file-if-exists=.env.local scripts/seed-exercises.mts --check
 *
 * ## Matched by `seed_key`, not `name`
 *
 * The original version matched by name, which was safe only while a seeded row's name never
 * changed. Stage 3 renames every seeded row at least once (`Movement (Equipment)`), and a
 * seeded exercise can be renamed again after that from the exercise detail page — so matching by
 * name would either silently insert a duplicate under the seed's old idea of the name, or match
 * the wrong row entirely if two names happened to collide. `seed_key` is the identity this file
 * writes and never changes, which is the whole reason Stage 3 added it.
 *
 * ## Per-field respect for `user_edited_fields`
 *
 * The old version's rule was "leave a row alone if its `source` is not `seed`", which was the
 * right idea for a catalogue nobody could edit. Now a seeded row can be edited too — the exercise
 * detail page writes to `user_edited_fields` when it does — and the old rule would either
 * overwrite an edit (source stayed `seed`) or refuse to deliver a seed-authored fix to every
 * *other* field on a row where the person only ever touched one (source became something else,
 * if it were flipped, which it correctly is not). So this reseed is field-level: a column in
 * `user_edited_fields` is left exactly as it is; every other column on that same row still
 * updates from the seed when the seed's value differs from what is stored.
 *
 * ## Tombstones are read and skipped, not resurrected
 *
 * A seeded row a person archived-then-deleted has `deleted_at` set. The pre-Stage-3 version
 * filtered `deleted_at is null` when reading *existing* rows and then inserted whatever it did
 * not find among the live ones — which, after a delete, is exactly the deleted row, so every run
 * would resurrect it. This version reads every row regardless of `deleted_at` and, on a
 * tombstoned one, does nothing at all: not insert, not update, not un-delete. A person's delete
 * is a decision this script does not get to override.
 *
 * ## Still safe to run repeatedly, and `--check` still means "write nothing"
 */
import { neon } from "@neondatabase/serverless";

import { CATALOGUE, type CatalogueEntry } from "../src/lib/athletics/catalogue.ts";

const check = process.argv.includes("--check");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("seed-exercises: DATABASE_URL is required (it lives in .env.local).");
  process.exit(2);
}

const sql = neon(url);

type Row = {
  seedKey: string | null;
  name: string;
  modality: string;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  aliases: string[];
  howTo: string;
  userEditedFields: string[];
  deletedAt: string | null;
};

const existing = (await sql`
  select seed_key as "seedKey", name, modality, equipment,
         primary_muscles as "primaryMuscles", secondary_muscles as "secondaryMuscles",
         aliases, how_to as "howTo", user_edited_fields as "userEditedFields",
         deleted_at as "deletedAt"
  from exercises where seed_key is not null
`) as Row[];
const bySeedKey = new Map(existing.map((row) => [row.seedKey, row]));

/** The columns this script owns, each paired with how to read it off a `CatalogueEntry`. */
const FIELD_OF: Record<string, (e: CatalogueEntry) => unknown> = {
  name: (e) => e.name,
  modality: (e) => e.modality,
  equipment: (e) => e.equipment,
  primaryMuscles: (e) => e.primaryMuscles,
  secondaryMuscles: (e) => e.secondaryMuscles,
  aliases: (e) => e.aliases,
  howTo: (e) => e.howTo,
};

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

const toInsert: CatalogueEntry[] = [];
/** Entry + which columns actually differ and are not user-edited. */
const toUpdate: { entry: CatalogueEntry; fields: string[] }[] = [];
const tombstoned: string[] = [];
const untouchedByEdit: string[] = [];

for (const entry of CATALOGUE) {
  const current = entry.seedKey ? bySeedKey.get(entry.seedKey) : undefined;

  if (!current) {
    toInsert.push(entry);
    continue;
  }

  if (current.deletedAt) {
    tombstoned.push(entry.name);
    continue;
  }

  const edited = new Set(current.userEditedFields);
  const fields = Object.keys(FIELD_OF).filter((field) => {
    if (edited.has(field)) return false;
    return !sameValue(
      FIELD_OF[field](entry),
      (current as unknown as Record<string, unknown>)[field],
    );
  });

  if (fields.length > 0) toUpdate.push({ entry, fields });
  else if (edited.size > 0) untouchedByEdit.push(entry.name);
}

console.log(
  `catalogue: ${CATALOGUE.length} entries, ${existing.length} seeded rows in the database`,
);
console.log(`  insert ${toInsert.length}`);
console.log(`  update ${toUpdate.length}`);
if (tombstoned.length > 0) {
  console.log(`  left alone (archived + deleted): ${tombstoned.length} — ${tombstoned.join(", ")}`);
}
if (untouchedByEdit.length > 0) {
  console.log(
    `  left alone (user-edited, matches the seed on every other field): ${untouchedByEdit.length}`,
  );
}

if (check) {
  console.log("\n--check: nothing was written.");
  process.exit(toInsert.length + toUpdate.length > 0 ? 1 : 0);
}

for (const entry of toInsert) {
  await sql`
    insert into exercises
      (seed_key, name, modality, equipment, primary_muscles, secondary_muscles,
       aliases, how_to, source)
    values
      (${entry.seedKey}, ${entry.name}, ${entry.modality}, ${entry.equipment},
       ${entry.primaryMuscles}, ${entry.secondaryMuscles}, ${entry.aliases}, ${entry.howTo},
       'seed')
    on conflict (seed_key) do nothing
  `;
}

// Only the fields that actually changed and were not user-edited get written, one statement
// per differing column rather than always writing every column — so a partial edit (someone
// fixed the how-to, nothing else) leaves the rest of the row untouched by this script's own
// writes, not merely unchanged in value.
for (const { entry, fields } of toUpdate) {
  if (fields.includes("name")) {
    await sql`update exercises set name = ${entry.name} where seed_key = ${entry.seedKey}`;
  }
  if (fields.includes("modality")) {
    await sql`update exercises set modality = ${entry.modality} where seed_key = ${entry.seedKey}`;
  }
  if (fields.includes("equipment")) {
    await sql`update exercises set equipment = ${entry.equipment} where seed_key = ${entry.seedKey}`;
  }
  if (fields.includes("primaryMuscles")) {
    await sql`update exercises set primary_muscles = ${entry.primaryMuscles} where seed_key = ${entry.seedKey}`;
  }
  if (fields.includes("secondaryMuscles")) {
    await sql`update exercises set secondary_muscles = ${entry.secondaryMuscles} where seed_key = ${entry.seedKey}`;
  }
  if (fields.includes("aliases")) {
    await sql`update exercises set aliases = ${entry.aliases} where seed_key = ${entry.seedKey}`;
  }
  if (fields.includes("howTo")) {
    await sql`update exercises set how_to = ${entry.howTo} where seed_key = ${entry.seedKey}`;
  }
}

console.log(`\nseeded. ${toInsert.length} inserted, ${toUpdate.length} updated.`);
