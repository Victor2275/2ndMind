import { CATALOGUE, type CatalogueEntry } from "@/lib/athletics/catalogue";
import type { Muscle } from "@/lib/athletics/muscles";
import type { Effort } from "@/lib/athletics/prs";
import { normalizeExerciseName } from "@/lib/athletics/renames";
import { listLocal, openSyncDb, type SyncDb } from "@/lib/sync/store";

/**
 * Training, read from the phone (V4 Phase 2).
 *
 * The mirror of `lib/athletics/queries.ts`, over IndexedDB instead of Postgres. Both produce
 * `Effort[]`, which is the shape every PR function already takes — so `strengthRecords`,
 * `ergRecords` and the rest work identically with or without a network and neither of them has
 * to know where a set came from.
 *
 * **One source, since Phase 2.7.** `allEfforts()` used to union `workout_sets` with the sets
 * stored inside athletics log entries, because the phone could not create a session (D-159).
 * It can now, so the second source is gone and this reads sessions only. That is the whole
 * point of item 2.7's instruction not to add a third reader: the answer was to get down to one.
 */

export type LocalSet = {
  clientId: string;
  exercise: string;
  setIndex: number;
  setType: string;
  weightLbs: number | null;
  reps: number | null;
  distanceM: number | null;
  durationS: number | null;
  spm: number | null;
  rpe: number | null;
  completedAt: string | null;
  notes: string;
  pieceType: string | null;
};

export type LocalSession = {
  clientId: string;
  performedAt: Date;
  title: string;
  notes: string;
  exerciseNotes: Record<string, string>;
  sets: LocalSet[];
};

/** A row as the sync store holds it: the payload the server sent, or the one queued locally. */
type Row = Record<string, unknown>;

const num = (value: unknown): number | null =>
  typeof value === "number"
    ? value
    : typeof value === "string" && value !== ""
      ? Number(value)
      : null;

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

function toSet(row: Row): LocalSet {
  return {
    clientId: str(row.clientId),
    exercise: str(row.exercise),
    setIndex: num(row.setIndex) ?? 0,
    setType: str(row.setType, "normal"),
    weightLbs: num(row.weightLbs),
    reps: num(row.reps),
    distanceM: num(row.distanceM),
    durationS: num(row.durationS),
    spm: num(row.spm),
    rpe: num(row.rpe),
    completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
    notes: str(row.notes),
    pieceType: typeof row.pieceType === "string" ? row.pieceType : null,
  };
}

/**
 * Every session on this device, newest first, with its sets attached.
 *
 * Sets are found two ways and both are needed, which is a direct consequence of the aggregate
 * op. A session **pulled from the server** arrives as a parent row plus separate `workout_set`
 * rows. A session **written here** is one outbox op carrying its sets inline, and its local
 * record is that same payload — so its sets are on the parent and there are no child rows yet.
 *
 * Reading only the child store would make a session you just saved appear empty until it synced,
 * which on a phone in a gym is most of the time it will ever be looked at.
 */
export async function localSessions(db: SyncDb): Promise<LocalSession[]> {
  const [parents, children] = await Promise.all([
    listLocal(db, "workout"),
    listLocal(db, "workout_set"),
  ]);

  /**
   * A pulled set names its parent differently from a locally-queued one, and both have to work.
   *
   * From the server, a `workout_set` row is the Postgres row: it carries `workout_id`, the
   * parent's **serial**, because that is what the column is. From this device, a set edit op
   * carries `parentClientId`, because the phone has never seen that serial — which is the whole
   * reason §4a exists.
   *
   * So the parent's server id is mapped back to its client id first. Reading only one of the two
   * would silently drop half the sets: the pulled ones after a fresh install, or the edited ones
   * before the next sync.
   */
  const clientIdForServerId = new Map<string, string>();
  for (const record of parents) {
    const row = record.row as Row;
    if (row.id !== undefined && row.id !== null) {
      clientIdForServerId.set(String(row.id), str(row.clientId));
    }
  }

  const byParent = new Map<string, LocalSet[]>();
  for (const record of children) {
    const row = record.row as Row;
    const parent =
      str(row.parentClientId) ||
      (row.workoutId !== undefined ? (clientIdForServerId.get(String(row.workoutId)) ?? "") : "");
    if (!parent) continue;
    const list = byParent.get(parent) ?? [];
    list.push(toSet(row));
    byParent.set(parent, list);
  }

  const sessions: LocalSession[] = [];
  for (const record of parents) {
    const row = record.row as Row;
    const clientId = str(row.clientId);

    const inline = Array.isArray(row.sets) ? (row.sets as Row[]).map(toSet) : [];
    const pulled = byParent.get(clientId) ?? [];

    // Inline wins on a tie. A set edited after the session was created arrives as its own row
    // and is the newer truth, so it is merged over the inline copy by client id.
    const merged = new Map<string, LocalSet>();
    for (const set of inline) merged.set(set.clientId, set);
    for (const set of pulled) merged.set(set.clientId, set);

    sessions.push({
      clientId,
      performedAt: new Date(str(row.performedAt)),
      title: str(row.title),
      notes: str(row.notes),
      exerciseNotes:
        row.exerciseNotes && typeof row.exerciseNotes === "object"
          ? (row.exerciseNotes as Record<string, string>)
          : {},
      sets: [...merged.values()].sort((a, b) => a.setIndex - b.setIndex),
    });
  }

  return sessions.sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime());
}

/** One line of a saved routine, as this device holds it (V4 Phase 2++ Stage 6). */
export type LocalRoutineExercise = {
  clientId: string;
  exercise: string;
  position: number;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightLbs: number | null;
};

export type LocalRoutine = {
  clientId: string;
  name: string;
  notes: string;
  exercises: LocalRoutineExercise[];
};

function toRoutineExercise(row: Row): LocalRoutineExercise {
  return {
    clientId: str(row.clientId),
    exercise: str(row.exercise),
    position: num(row.position) ?? 0,
    targetSets: num(row.targetSets),
    targetReps: num(row.targetReps),
    targetWeightLbs: num(row.targetWeightLbs),
  };
}

/**
 * Every routine on this device, with its lines attached (V4 Phase 2++ Stage 6).
 *
 * The same two-source read `localSessions` needs, for the same reason: a routine **pulled** from
 * the server arrives as a parent row plus separate `routine_exercise` rows, while one **saved
 * here** is a single outbox op carrying its lines inline. Reading only the child store would
 * make a routine you just saved appear empty until it synced.
 *
 * Unlike a session, a routine's lines are replace-all (see `routines` in `schema.ts`), so there
 * is no merge-by-client-id to do: whichever source has lines for this routine has all of them,
 * and the inline copy — always the newest, since it has not synced yet — wins outright.
 */
export async function localRoutines(db: SyncDb): Promise<LocalRoutine[]> {
  const [parents, children] = await Promise.all([
    listLocal(db, "routine"),
    listLocal(db, "routine_exercise"),
  ]);

  const clientIdForServerId = new Map<string, string>();
  for (const record of parents) {
    const row = record.row as Row;
    if (row.id !== undefined && row.id !== null) {
      clientIdForServerId.set(String(row.id), str(row.clientId));
    }
  }

  const byParent = new Map<string, LocalRoutineExercise[]>();
  for (const record of children) {
    const row = record.row as Row;
    const parent =
      row.routineId !== undefined ? (clientIdForServerId.get(String(row.routineId)) ?? "") : "";
    if (!parent) continue;
    const list = byParent.get(parent) ?? [];
    list.push(toRoutineExercise(row));
    byParent.set(parent, list);
  }

  return parents
    .map((record) => {
      const row = record.row as Row;
      const clientId = str(row.clientId);
      const inline = Array.isArray(row.exercises) ? (row.exercises as Row[]) : null;
      const lines = inline ? inline.map(toRoutineExercise) : (byParent.get(clientId) ?? []);
      return {
        clientId,
        name: str(row.name),
        notes: str(row.notes),
        exercises: [...lines].sort((a, b) => a.position - b.position),
      };
    })
    .filter((routine) => routine.name !== "")
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The most recent sets logged for each exercise, excluding one session — the "previous set"
 * ghost the logger shows in each input's placeholder (V4 Phase 2++ Stage 5, Hevy's own
 * single-best feature by Victor's account).
 *
 * `sessions` is assumed newest-first, which is what `localSessions` already returns — so the
 * first session encountered for a given exercise, other than the excluded one, is by
 * construction the most recent, and nothing here has to re-sort or compare dates.
 */
export function mostRecentSetsByExercise(
  sessions: LocalSession[],
  excludeSessionId?: string,
): Map<string, LocalSet[]> {
  const byExercise = new Map<string, LocalSet[]>();
  for (const session of sessions) {
    if (session.clientId === excludeSessionId) continue;
    const byName = new Map<string, LocalSet[]>();
    for (const set of session.sets) {
      const list = byName.get(set.exercise) ?? [];
      list.push(set);
      byName.set(set.exercise, list);
    }
    for (const [exercise, sets] of byName) {
      if (!byExercise.has(exercise)) {
        byExercise.set(
          exercise,
          [...sets].sort((a, b) => a.setIndex - b.setIndex),
        );
      }
    }
  }
  return byExercise;
}

/** Every set on this device, flattened — the input shape the PR functions want. */
export async function localEfforts(db: SyncDb): Promise<Effort[]> {
  const sessions = await localSessions(db);
  return sessions.flatMap((session) =>
    session.sets.map((set) => ({
      exercise: set.exercise,
      performedAt: session.performedAt,
      setType: set.setType,
      weightLbs: set.weightLbs,
      reps: set.reps,
      distanceM: set.distanceM,
      durationS: set.durationS,
      spm: set.spm,
    })),
  );
}

const strArray = (value: unknown): string[] => (Array.isArray(value) ? (value as string[]) : []);

/**
 * A `CatalogueEntry` as a specific row on this device rather than a seed definition — everything
 * the exercise browser and detail page (V4 Phase 2++ Stage 4) need to edit, archive or delete it.
 *
 * `clientId` is what makes this different from a bundle entry, and it is null for exactly one
 * reason: the bundle's rows are seed *definitions*, authored in `catalogue.ts` with no server
 * row behind them yet on a device that has never synced. Every real row — seeded or not — gets a
 * client-generated or server-assigned id the moment it exists in Postgres, which for the seed
 * happens the first time `scripts/seed-exercises.mts` runs. `clientId === null` therefore means
 * "not editable from this screen yet", not "does not exist" — the entry is still fully readable
 * and pickable, it just cannot be the target of `updateExercise`/`archiveExercise` until a pull
 * fills it in.
 */
export type LocalExercise = CatalogueEntry & {
  clientId: string | null;
  /** Free-form notes — "use the 2-inch deficit plates" — never part of the seed. */
  notes: string;
  restSeconds: number | null;
  archivedAt: string | null;
};

/**
 * The catalogue as the phone has it, sorted by name so an empty query reads alphabetically.
 *
 * `name` is passed through `normalizeExerciseName` (V4 Phase 2++ Stage 3) — a mirrored row can
 * still carry a v1 name if this device has not pulled the rename yet, and reading it straight
 * would let a session logged from this screen write new history under a name the server just
 * retired. `renames.ts` ships in the client bundle for exactly this: it is the one lookup that
 * has to be correct on a phone that has not synced today.
 */
export async function localCatalogue(db: SyncDb): Promise<LocalExercise[]> {
  const rows = await listLocal(db, "exercise");
  return rows
    .map((record) => {
      const row = record.row as Row;
      const primaryMuscles = strArray(row.primaryMuscles);
      return {
        seedKey: typeof row.seedKey === "string" ? row.seedKey : null,
        clientId: typeof row.clientId === "string" ? row.clientId : null,
        name: normalizeExerciseName(str(row.name)),
        modality: str(row.modality, "lift") as CatalogueEntry["modality"],
        equipment: str(row.equipment, "other") as CatalogueEntry["equipment"],
        // Falls back to the legacy flat `muscles` array when `primaryMuscles` is empty — a row
        // pulled before Stage 3's rename has only the legacy field populated, and the figure
        // should still draw something rather than going blank for the transition window.
        primaryMuscles: (primaryMuscles.length > 0
          ? primaryMuscles
          : strArray(row.muscles)) as Muscle[],
        secondaryMuscles: strArray(row.secondaryMuscles) as Muscle[],
        aliases: strArray(row.aliases),
        howTo: str(row.howTo),
        notes: str(row.notes),
        restSeconds: num(row.restSeconds),
        archivedAt: typeof row.archivedAt === "string" ? row.archivedAt : null,
        userEditedFields: strArray(row.userEditedFields),
      };
    })
    .filter((entry) => entry.name !== "")
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The catalogue, from the bundle first and the device second (D-224, moved here from
 * `session-logger.tsx` in V4 Phase 2++ Stage 4 so the exercise browser can share it).
 *
 * This screen used to read the mirrored `exercises` store and nothing else, which made the whole
 * feature depend on a completed sync pull. That failed in the most ordinary way there is: the
 * catalogue is ~140 rows and the pull is paged at 100, so a device that had synced **once** held
 * most but not all of it — and searching `bnch` on a phone in a gym could find nothing at all, if
 * Bench Press happened to be in the part that had not arrived yet. It was not an error state; the
 * search box simply came up empty and the only way forward was to type the name in by hand.
 *
 * The seed is already in this bundle — `CATALOGUE` is the file `scripts/seed-exercises.mts`
 * inserts from, so the two cannot disagree — which means every seeded movement is available on
 * first paint, before any network, on a device that has never synced. The mirror is then merged
 * over the top by `seedKey`, which is what carries the ones the seed does not know: an exercise
 * added on the phone, or one the AI-add path proposed, both of which have no `seedKey` at all and
 * are matched by `name` instead.
 *
 * **The mirror wins for any row carrying `userEditedFields`, the bundle wins otherwise.** This is
 * the reversal Stage 3 exists to make safe. The comment this replaced said *"nothing in the app
 * can edit a seeded entry, so the bundle is the only writer of those rows"* — that premise is
 * gone the moment the exercise detail page (Stage 4) can edit a seeded row's how-to text or its
 * muscles. Bundle-always-wins under that premise would make every edit vanish on reload: correct
 * in Postgres, correct in the mirror, invisible on screen. So the mirror wins precisely where a
 * person actually changed something — `userEditedFields` says which fields, but the merge is
 * per-row rather than per-field, matching `store.ts`'s own last-write-wins granularity — and the
 * bundle still wins everywhere else, which is what keeps a stale pre-reseed mirror row from
 * showing an old how-to or a blank figure after the seed changes something *nobody* edited.
 */
export function mergeCatalogue(mirrored: LocalExercise[]): LocalExercise[] {
  const bundle: LocalExercise[] = CATALOGUE.map((entry) => ({
    ...entry,
    clientId: null,
    notes: "",
    restSeconds: null,
    archivedAt: null,
  }));

  const bySeedKey = new Map<string, LocalExercise>();
  const byName = new Map<string, LocalExercise>();

  for (const entry of bundle) {
    if (entry.seedKey) bySeedKey.set(entry.seedKey, entry);
    byName.set(entry.name, entry);
  }

  for (const entry of mirrored) {
    if (entry.seedKey) {
      const seeded = bySeedKey.get(entry.seedKey);
      // No bundle row shares this seedKey — the seed dropped it, or (should not happen) the
      // mirror is ahead of this build. Keep the mirror's copy rather than losing the row.
      if (!seeded) {
        byName.set(entry.name, entry);
        continue;
      }
      if (entry.userEditedFields.length > 0) {
        // The mirror wins, but the bundle's own name still resolves to it — otherwise renaming
        // a seeded row and editing it in the same session would leave two entries in the list.
        byName.delete(seeded.name);
        byName.set(entry.name, entry);
      } else {
        // The bundle already holds the winning copy under this seedKey, but the mirror still
        // knows this row's real clientId and archivedAt — carry those over so the browser can
        // still edit/archive a row nobody has touched yet.
        byName.set(seeded.name, {
          ...seeded,
          clientId: entry.clientId,
          archivedAt: entry.archivedAt,
          restSeconds: entry.restSeconds,
        });
      }
    } else {
      // No seedKey — a hand-typed or AI-added row, matched by name, same as before Stage 3.
      byName.set(entry.name, entry);
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Opens the store, runs `read`, and always closes it. */
export async function withLocal<T>(read: (db: SyncDb) => Promise<T>): Promise<T | null> {
  try {
    const db = await openSyncDb();
    try {
      return await read(db);
    } finally {
      db.close();
    }
  } catch {
    // IndexedDB unavailable — a private window, a blocked upgrade. Every caller renders an
    // empty state rather than failing, which is the same call `lib/offline/read.ts` makes.
    return null;
  }
}
