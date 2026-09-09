import { localDay } from "@/lib/offline/panels";
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
};

export type SessionInput = {
  performedAt: Date;
  title: string;
  notes: string;
  sets: SetInput[];
  /**
   * The morning weigh-in, logged where you already are.
   *
   * It moved here from the quick log's Training category when Phase 2.7 retired that category —
   * without this the fast path to recording a weight would simply have disappeared, which is
   * the kind of thing a fold quietly loses. Caught by two tests in `offline/write.test.ts`
   * that suddenly had no field to read.
   *
   * It is **not** stored on the session. It writes a `bodyweight_entries` row, which is what
   * the weight chart and the bodyweight-adjusted erg table read — two copies of the second
   * input to every adjusted split is how they drift apart (D-159).
   */
  bodyweightLbs?: number | null;
};

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
  const weight =
    typeof input.bodyweightLbs === "number" && input.bodyweightLbs > 0 ? input.bodyweightLbs : null;

  if (sets.length === 0 && input.title.trim() === "" && weight === null) {
    return { ok: false, message: "Nothing to save — log a set, or give the session a name." };
  }

  try {
    const db = await openSyncDb();
    try {
      // Loaded fresh rather than held at module scope: two tabs of the installed app would
      // otherwise each hold their own copy of a per-device clock and issue colliding stamps.
      const clock = new HlcClock(await deviceId(db), Date.now, await loadClock(db));

      // A weigh-in on its own is a legitimate submit — you stepped on the scale and did not
      // train — so the session op is only written when there is a session to write.
      if (sets.length > 0 || input.title.trim() !== "") {
        await enqueue(db, {
          entity: "workout",
          op: "create",
          row: {
            clientId,
            performedAt: input.performedAt.toISOString(),
            title: input.title.trim(),
            notes: input.notes.trim(),
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
      }

      if (weight !== null) {
        await enqueue(db, {
          entity: "bodyweight",
          op: "create",
          // `measuredOn` is the natural key, so a second weigh-in on the same day replaces the
          // first rather than creating a duplicate — offline and online alike.
          row: { measuredOn: localDay(input.performedAt), weightLbs: weight, note: "" },
          hlc: clock.tick(),
        });
      }

      await saveClock(db, clock.state);

      const saved =
        sets.length === 0
          ? "Weighed in."
          : sets.length === 1
            ? "Session saved on this phone."
            : `Session saved — ${sets.length} sets.`;

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
  muscles: string[];
  equipment: string;
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
}): Promise<SaveResult> {
  return oneOp("workout", "update", {
    clientId: session.clientId,
    performedAt: session.performedAt.toISOString(),
    title: session.title.trim(),
    notes: session.notes.trim(),
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
};

/** One op, one clock tick, one store open. Shared by every mutation above. */
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
