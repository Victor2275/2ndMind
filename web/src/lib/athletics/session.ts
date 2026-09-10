import { HlcClock } from "@/lib/sync/hlc";
import { deviceId, enqueue, loadClock, openSyncDb, saveClock } from "@/lib/sync/store";

/**
 * Writing a training session (V4 Phase 2.5, `SYNC_DESIGN.md` §4a).
 *
 * ## It always goes through the outbox, online or not
 *
 * Every other write in this app has two paths — a Server Action when there is a network, a
 * local writer on the cached shell — and `lib/offline/write.ts` exists to keep them in step.
 * Sessions have **one path**, and that is a deliberate simplification the aggregate op makes
 * possible:
 *
 * - There is nothing a server round trip would add. The op carries its own identity, the server
 *   assigns the foreign key, and a re-send is an upsert — so writing locally and letting the
 *   ordinary flush deliver it is not a degraded mode, it is the same result a moment later.
 * - It removes the honesty problem D-206 records. A form that posts to a Server Action cannot
 *   promise the entry is safe on the device, because it is not; this one can, because it is.
 * - One path cannot drift from the other. D-159's `allEfforts()` union exists because two ways
 *   of recording training grew apart; this is the same lesson applied a level up.
 *
 * The cost is that a session is not in Postgres the instant you tap save. Nothing reads it from
 * there in that instant — the screen renders from the local store, which already has it.
 */

export type SetInput = {
  exercise: string;
  setIndex: number;
  setType: "normal" | "warmup" | "failure" | "drop";
  weightLbs: number | null;
  reps: number | null;
  distanceM: number | null;
  durationS: number | null;
  spm: number | null;
  rpe: number | null;
  /** Set when tick-to-complete marks a row done (V4 Phase 2++ Stage 5). Null for a set logged
   *  the old way — plain entry, no tick — which is honest rather than a gap. */
  completedAt: string | null;
  /** Per-set note — "felt heavy", "left knee" — distinct from `exerciseNotes` below. */
  notes: string;
  /** What the piece *was*, orthogonal to `setType` — see the column's doc in `schema.ts`. */
  pieceType: string | null;
};

export type SessionInput = {
  performedAt: Date;
  title: string;
  notes: string;
  /** Per-exercise notes for the whole session, keyed by exercise name — there is no per-exercise
   *  row in this schema, only per-set ones, and a note on set 1 must survive set 1 being
   *  deleted. */
  exerciseNotes: Record<string, string>;
  sets: SetInput[];
};

/**
 * The weigh-in is deliberately not on this type (D-221).
 *
 * It was, briefly. Phase 2.7 retired the quick log's Training tab and the bodyweight field came
 * here with it, because otherwise the fast path to recording a weight would have vanished with
 * the tab. Victor's objection was the right one and it is about behaviour rather than schema:
 * **a session form with a bodyweight field asks for a bodyweight every session.** A measurement
 * requested when there is nothing to measure is either skipped or typed carelessly, and every
 * weight-adjusted erg split in the app is computed from that one number — a careless value is
 * worse than a missing one, because it reads as real.
 *
 * It has its own quick-log category now (`categories.ts`, key `weight`), where nothing asks for
 * it and it is one tap from any screen. `takeBodyweight` still routes it to `bodyweight_entries`
 * and nowhere else, so the "one copy of the number" rule D-159 set is unchanged.
 */

/** A blank set, so the form and the writer agree on what "empty" means. */
export function emptySet(exercise: string, setIndex: number): SetInput {
  return {
    exercise,
    setIndex,
    setType: "normal",
    weightLbs: null,
    reps: null,
    distanceM: null,
    durationS: null,
    spm: null,
    rpe: null,
    completedAt: null,
    notes: "",
    pieceType: null,
  };
}

/**
 * Is there anything in this set worth keeping?
 *
 * A row with a name and no numbers is a row you added and did not fill in — dropping it is what
 * lets "add set" be free. It is checked here rather than in the form so the rule is one
 * sentence in one place, the same reasoning `readSetsFromForm` uses today.
 */
export function hasContent(set: SetInput): boolean {
  return (
    set.weightLbs !== null ||
    set.reps !== null ||
    set.distanceM !== null ||
    set.durationS !== null ||
    set.spm !== null
  );
}

export type SaveResult = { ok: boolean; message: string; clientId?: string };

/**
 * Queue a whole session as one op.
 *
 * `clientId` is passed in rather than generated here so the caller can retry a failed save with
 * the same identity — which is the entire reason the aggregate op is idempotent. Generating it
 * inside would turn a second tap of Save into a second session.
 */
export async function saveSession(input: SessionInput, clientId: string): Promise<SaveResult> {
  const sets = input.sets.filter(hasContent);

  if (sets.length === 0 && input.title.trim() === "") {
    return { ok: false, message: "Nothing to save — log a set, or give the session a name." };
  }

  try {
    const db = await openSyncDb();
    try {
      // Loaded fresh rather than held at module scope: two tabs of the installed app would
      // otherwise each hold their own copy of a per-device clock and issue colliding stamps.
      const clock = new HlcClock(await deviceId(db), Date.now, await loadClock(db));

      await enqueue(db, {
        entity: "workout",
        op: "create",
        row: {
          clientId,
          performedAt: input.performedAt.toISOString(),
          title: input.title.trim(),
          notes: input.notes.trim(),
          exerciseNotes: input.exerciseNotes,
          // Renumbered on the way out, so deleting the second of four sets leaves 0,1,2
          // rather than a gap. The index is what "Set 3" on screen counts from.
          sets: sets.map((set, index) => ({
            clientId: crypto.randomUUID(),
            ...set,
            setIndex: index,
          })),
        },
        hlc: clock.tick(),
      });

      await saveClock(db, clock.state);

      // A named session with no sets is legitimate — "Technical paddle", logged and filled in
      // later — so the count is only mentioned when there is one worth mentioning.
      const saved =
        sets.length > 1 ? `Session saved — ${sets.length} sets.` : "Session saved on this phone.";

      return { ok: true, clientId, message: saved };
    } finally {
      db.close();
    }
  } catch {
    // IndexedDB refused — a private window, or a blocked upgrade. Saying so is the only honest
    // answer: there is nowhere to put this, and the form still holds what was typed.
    return {
      ok: false,
      message: "This device will not open its local store, so the session was not saved.",
    };
  }
}

/**
 * Add one exercise to the catalogue.
 *
 * Separate from `saveSession` because it is a separate op against a separate table — a movement
 * you invent mid-session should survive even if you abandon the session.
 */
export async function addExercise(entry: {
  name: string;
  modality: string;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  source: "manual" | "ai";
}): Promise<SaveResult> {
  const name = entry.name.trim();
  if (name === "") return { ok: false, message: "Give it a name first." };

  try {
    const db = await openSyncDb();
    try {
      const clock = new HlcClock(await deviceId(db), Date.now, await loadClock(db));
      const clientId = crypto.randomUUID();

      await enqueue(db, {
        entity: "exercise",
        op: "create",
        // `seedKey` is deliberately absent: it identifies a *seeded* row, and this one is not.
        row: { clientId, ...entry, name },
        hlc: clock.tick(),
      });

      await saveClock(db, clock.state);
      return { ok: true, clientId, message: `Added ${name}.` };
    } finally {
      db.close();
    }
  } catch {
    return { ok: false, message: "This device will not open its local store." };
  }
}

/**
 * Changing a session after it is saved (Q402, `SYNC_DESIGN.md` §4a).
 *
 * ## Why these are separate ops rather than a re-send
 *
 * §4a: *"after creation, sets are independent"*. Only the initial create is atomic — fixing a
 * mistyped weight in set three is one op keyed by that set's own client id, so it does not
 * re-upload the whole gym session. That is not an optimisation; a session re-sent as a create
 * would carry whatever the screen happened to hold for every other set, and quietly overwrite
 * an edit made on the laptop in between.
 *
 * ## Every set edit names its parent
 *
 * `parentClientId` is required, and the server refuses a set whose parent it has never seen.
 * The phone has never seen the parent's `serial`, so the client id is the only name both sides
 * share.
 */

/** Fix one set. The mistyped-weight case, which is why Q402 was answered `yes`. */
export async function updateSet(
  sessionClientId: string,
  set: LocalSetPayload,
): Promise<SaveResult> {
  return oneOp("workout_set", "update", {
    ...set,
    parentClientId: sessionClientId,
  });
}

/** Remove one set. A tombstone, like every delete in this app. */
export async function deleteSet(
  sessionClientId: string,
  set: LocalSetPayload,
): Promise<SaveResult> {
  return oneOp("workout_set", "delete", { ...set, parentClientId: sessionClientId });
}

/** Rename a session, move its date, or change its notes. */
export async function updateSession(session: {
  clientId: string;
  performedAt: Date;
  title: string;
  notes: string;
  /**
   * Required rather than defaulted, deliberately. `writeRow`'s `workout` case is a plain
   * `onConflictDoUpdate` — it overwrites the whole row, `exerciseNotes` included — so a caller
   * that forgot this field would silently wipe every per-exercise note the session had. The
   * caller always has this value already: it came from the same read that put the rest of the
   * form on screen.
   */
  exerciseNotes: Record<string, string>;
}): Promise<SaveResult> {
  return oneOp("workout", "update", {
    clientId: session.clientId,
    performedAt: session.performedAt.toISOString(),
    title: session.title.trim(),
    notes: session.notes.trim(),
    exerciseNotes: session.exerciseNotes,
    // Deliberately empty. An update carries no sets: they are independent rows now, and sending
    // the ones the screen happens to hold would overwrite an edit made elsewhere in between.
    sets: [],
  });
}

/**
 * Delete a whole session.
 *
 * Soft, and the server tombstones its sets with it. Reads already filter children by the
 * parent's `deleted_at`, so that is belt and braces — but a set left live under a deleted
 * session still reaches `allEfforts()` on a device that only ever pulled the child row.
 */
export async function deleteSession(clientId: string): Promise<SaveResult> {
  return oneOp("workout", "delete", { clientId, performedAt: new Date().toISOString(), sets: [] });
}

/** The fields a set edit has to carry. Narrower than `LocalSet`: no server id, no parent. */
export type LocalSetPayload = {
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

/**
 * Editing the catalogue (V4 Phase 2++ Stage 4).
 *
 * ## Everything is editable, seeded rows included
 *
 * That is Victor's answer, and it is the reversal `mergeCatalogue` in `session-logger.tsx` had
 * to be rewritten for: a seeded row's `userEditedFields` is what tells a bundle reseed to leave
 * a column alone rather than overwrite the edit on the next reload.
 *
 * ## Archive, then delete — two separate ops
 *
 * `archiveExercise` sets `archivedAt` and nothing else; the row keeps syncing, keeps its
 * history, and is reversible from the archive view. `deleteExercise` is the ordinary tombstone
 * every other entity in this app already has — permanent, and only reachable from the archive.
 */

/** Every field the exercise detail page can change. */
export type ExerciseEdit = {
  clientId: string;
  seedKey: string | null;
  name: string;
  modality: string;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  aliases: string[];
  howTo: string;
  notes: string;
  restSeconds: number | null;
  source: string;
  /** Which of the fields above a person has changed — union'd with whatever was already there,
   *  since a field once edited by hand stays that way for good (`seed-exercises.mts`). */
  userEditedFields: string[];
};

export async function updateExercise(entry: ExerciseEdit): Promise<SaveResult> {
  return exerciseOp("update", entry);
}

/** Reversible — the row keeps syncing and stays in the archive view. */
export async function archiveExercise(entry: ExerciseEdit): Promise<SaveResult> {
  return exerciseOp("update", { ...entry, archivedAt: new Date().toISOString() });
}

/** Reverses `archiveExercise`. */
export async function unarchiveExercise(entry: ExerciseEdit): Promise<SaveResult> {
  return exerciseOp("update", { ...entry, archivedAt: null });
}

/** Permanent. Only reachable from the archive view, and confirmed there. */
export async function deleteExercise(entry: ExerciseEdit): Promise<SaveResult> {
  return exerciseOp("delete", entry);
}

async function exerciseOp(
  op: "update" | "delete",
  row: Record<string, unknown>,
): Promise<SaveResult> {
  try {
    const db = await openSyncDb();
    try {
      const clock = new HlcClock(await deviceId(db), Date.now, await loadClock(db));
      await enqueue(db, { entity: "exercise", op, row, hlc: clock.tick() });
      await saveClock(db, clock.state);
      return { ok: true, message: op === "delete" ? "Deleted." : "Saved." };
    } finally {
      db.close();
    }
  } catch {
    return { ok: false, message: "This device will not open its local store." };
  }
}

/** One op, one clock tick, one store open. Shared by every session mutation above. */
async function oneOp(
  entity: "workout" | "workout_set",
  op: "update" | "delete",
  row: Record<string, unknown>,
): Promise<SaveResult> {
  try {
    const db = await openSyncDb();
    try {
      const clock = new HlcClock(await deviceId(db), Date.now, await loadClock(db));
      await enqueue(db, { entity, op, row, hlc: clock.tick() });
      await saveClock(db, clock.state);
      return { ok: true, message: op === "delete" ? "Deleted." : "Saved." };
    } finally {
      db.close();
    }
  } catch {
    return { ok: false, message: "This device will not open its local store." };
  }
}
