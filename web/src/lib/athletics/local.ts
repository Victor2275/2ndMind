import type { CatalogueEntry } from "@/lib/athletics/catalogue";
import type { Effort } from "@/lib/athletics/prs";
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
};

export type LocalSession = {
  clientId: string;
  performedAt: Date;
  title: string;
  notes: string;
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
      sets: [...merged.values()].sort((a, b) => a.setIndex - b.setIndex),
    });
  }

  return sessions.sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime());
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

/** The catalogue as the phone has it, sorted by name so an empty query reads alphabetically. */
export async function localCatalogue(db: SyncDb): Promise<CatalogueEntry[]> {
  const rows = await listLocal(db, "exercise");
  return rows
    .map((record) => {
      const row = record.row as Row;
      return {
        name: str(row.name),
        modality: str(row.modality, "lift") as CatalogueEntry["modality"],
        muscles: Array.isArray(row.muscles) ? (row.muscles as string[]) : [],
        equipment: str(row.equipment),
      };
    })
    .filter((entry) => entry.name !== "")
    .sort((a, b) => a.name.localeCompare(b.name));
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
