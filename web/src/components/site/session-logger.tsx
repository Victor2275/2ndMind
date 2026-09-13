"use client";

import { CheckIcon, ChevronDownIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ExerciseFilterBar,
  ExerciseRows,
  keyFor,
  NO_FILTERS,
  useExerciseSections,
  type ExerciseFilterState,
} from "@/components/site/exercise-list";
import { MuscleMap } from "@/components/site/muscle-map";
import { requestSync, SYNC_DONE_EVENT } from "@/components/site/sync-runner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { howTo, type Modality } from "@/lib/athletics/catalogue";
import { COLUMN_LABEL, FIELDS_FOR } from "@/lib/athletics/fields";
import { parseTimeToSeconds } from "@/lib/athletics/forms";
import { formatDuration } from "@/lib/athletics/prs";
import {
  localCatalogue,
  localRoutines,
  localSessions,
  mergeCatalogue,
  mostRecentSetsByExercise,
  withLocal,
  type LocalExercise,
  type LocalRoutine,
  type LocalSet,
  type LocalSession,
} from "@/lib/athletics/local";
import { EQUIPMENT, type Equipment, type Muscle } from "@/lib/athletics/muscles";
import { estimateOneRepMax, strengthRecords, type Effort } from "@/lib/athletics/prs";
import {
  addExercise,
  deleteRoutine,
  emptySet,
  hasContent,
  saveRoutine,
  saveSession,
  type SetInput,
} from "@/lib/athletics/session";
import { buzzRested, buzzSaved } from "@/lib/haptics";
import { useKeyboardInset } from "@/lib/keyboard-inset";
import { fetchWithDeadline } from "@/lib/net/deadline";

/** No per-exercise default and no catalogue entry to read one from — the on-screen rest timer
 *  falls back to this. Ninety seconds is a reasonable compromise across a curl and a squat; the
 *  point of the editable default is that it does not have to stay that for either. */
const DEFAULT_REST_SECONDS = 90;

/**
 * Logging a training session (V4 Phase 2.5, Q391–Q400).
 *
 * ## Why it reads and writes the phone, always
 *
 * Everything on this screen comes out of IndexedDB and goes back into the outbox — there is no
 * server call at all, online or off. That is not an offline mode, it is the only mode, and it
 * falls out of the aggregate op: the session carries its own identity, the server assigns the
 * foreign key, and a re-send is an upsert. See `lib/athletics/session.ts`.
 *
 * The consequence worth naming: this screen behaves identically in a gym basement and at a desk,
 * which is the one property the old quick-log path could not offer, and which is why item 2.7
 * folded that path into this one.
 *
 * ## The shape of the form is the feature
 *
 * Q392 asks for three taps per set, so the fields shown are chosen by the exercise's
 * **modality** — weight and reps for a lift, distance, time and stroke rate for an erg piece.
 * Asking for all six every time is what made the old form slow. Q399 numbers the sets, Q400 adds
 * "same again", and Q398 keeps a running total at the top; Q409's records sit next to the
 * exercise while you are working, because a PR you cannot see while lifting is a PR you find out
 * about afterwards.
 *
 * Nothing sensitive may appear in this file — it compiles into `/_next/static/chunks/`.
 */

/**
 * A control's look, with **no width in it** (D-219).
 *
 * `w-full` used to be part of this string, and the set-type select below wrote `${FIELD} w-24`
 * to be narrower. Both utilities have the same specificity, so which one wins is decided by the
 * order Tailwind emits them, not by the order they appear in the attribute — and `w-full` won.
 * The select took the entire row, both number inputs computed to **zero pixels wide**, their
 * labels overprinted each other into "LBSPS", and the delete button sat 92px off the right edge
 * of the phone. Every class name read correctly and no test could see it, because jsdom gives
 * every element a width of zero.
 *
 * `scripts/diag-widths.mjs` is what does see it, and the rule that prevents it is here: the base
 * carries no width, so a call site states its width exactly once.
 */
const CONTROL =
  "rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none";
const FIELD = `${CONTROL} w-full`;
const LABEL = "eyebrow text-muted-foreground";

const SET_TYPES: SetInput["setType"][] = ["normal", "warmup", "drop", "failure"];

/**
 * A movement typed by hand or proposed by the AI-add path — everything `addExercise` needs and
 * nothing a seeded row has that a fresh one does not (no `seedKey`, no `aliases`, no `howTo`).
 */
type NewExerciseInput = {
  name: string;
  modality: Modality;
  equipment: Equipment;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
};

/** One exercise's worth of sets, as the screen holds it before saving. */
type Block = {
  id: string;
  exercise: string;
  modality: Modality;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  /** Rest timer default for this exercise, seconds. Editable per block (V4 Phase 2++ Stage 5). */
  restSeconds: number;
  sets: SetInput[];
};

function todayLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * The on-screen rest countdown (V4 Phase 2++ Stage 5). Starts when a set is ticked complete,
 * sits in a sticky header so it is visible while scrolling to the next exercise, and buzzes
 * once at zero — no push notification, per Victor's answer: this is a screen you are looking at,
 * not one you have put down.
 */
function RestTimer({
  timer,
  onDismiss,
}: {
  timer: { startedAt: number; seconds: number } | null;
  onDismiss: () => void;
}) {
  /**
   * The countdown is **state**, not a value computed from `Date.now()` during render.
   *
   * Reading the clock while rendering is an impure render — the same props would produce a
   * different tree a second later, which is what `react-hooks/purity` objects to and what makes
   * a component behave differently under a concurrent re-render than under a normal one. The
   * parent keys this component by `startedAt`, so a fresh timer remounts and this initialiser
   * runs again with the new duration; only the interval below writes to it after that.
   */
  const [remaining, setRemaining] = useState(() => timer?.seconds ?? 0);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => {
      const left = timer.seconds - Math.floor((Date.now() - timer.startedAt) / 1000);
      if (left <= 0) {
        buzzRested();
        onDismiss();
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [timer, onDismiss]);

  if (!timer) return null;

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  return (
    <div className="sticky top-2 z-20 flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-background/95 px-3 py-2 shadow-floating backdrop-blur-sm">
      <span className="tabular font-mono text-lg text-primary">
        {mm}:{String(ss).padStart(2, "0")}
      </span>
      <span className="text-xs text-muted-foreground">Rest</span>
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-8 rounded-md px-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Skip
      </button>
    </div>
  );
}

/**
 * A duration typed as m:ss, the shape an erg monitor shows — not raw seconds.
 *
 * Holds its own draft text rather than reformatting on every keystroke: parsing "2:1" toward
 * "2:17" as it's typed would fight the person typing it. `parseTimeToSeconds` (already used by
 * the legacy manual-entry form) runs once, on blur, and the field snaps back to the canonical
 * `formatDuration` spelling of whatever committed — including rejecting back to the last good
 * value if what's on screen doesn't parse.
 */
function DurationField({
  id,
  "aria-label": ariaLabel,
  seconds,
  onCommit,
  placeholder,
  className,
}: {
  id?: string;
  "aria-label"?: string;
  seconds: number | null;
  onCommit: (seconds: number | null) => void;
  placeholder: number | null;
  className: string;
}) {
  const [draft, setDraft] = useState(seconds === null ? "" : formatDuration(seconds));

  // The committed value can change from outside (ghost fill, routine start, a fresh block) —
  // follow it whenever this field isn't the one being actively typed into.
  useEffect(() => {
    setDraft(seconds === null ? "" : formatDuration(seconds));
  }, [seconds]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      onCommit(null);
      return;
    }
    const parsed = parseTimeToSeconds(trimmed);
    if (parsed === null) {
      // Didn't parse — snap back to the last good value rather than keeping an invalid string.
      setDraft(seconds === null ? "" : formatDuration(seconds));
      return;
    }
    setDraft(formatDuration(parsed));
    onCommit(parsed);
  }

  return (
    <input
      id={id}
      aria-label={ariaLabel}
      inputMode="text"
      placeholder={placeholder !== null ? formatDuration(placeholder) : "m:ss"}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      className={className}
    />
  );
}

export function SessionLogger() {
  const [mirrored, setMirrored] = useState<LocalExercise[]>([]);
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [restTimer, setRestTimer] = useState<{ startedAt: number; seconds: number } | null>(null);
  const [routines, setRoutines] = useState<LocalRoutine[]>([]);
  const [performedAt, setPerformedAt] = useState(todayLocal);
  const [picking, setPicking] = useState(false);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const catalogue = useMemo(() => mergeCatalogue(mirrored), [mirrored]);

  /**
   * One identity for the whole session, minted once.
   *
   * Generated when the screen mounts rather than at save time, so tapping Save twice — or
   * retrying after a failure — writes the *same* session rather than a second one. The aggregate
   * op is idempotent precisely so this can be true.
   *
   * Lazy `useState` rather than a ref initialised during render: reading or writing a ref while
   * rendering is what `react-hooks` objects to, and it is not pedantry here — under a concurrent
   * re-render the initialisation can run twice and hand two identities to one session. The
   * initialiser form runs exactly once.
   */
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());

  /**
   * Re-read the device whenever a sync finishes, not only on mount.
   *
   * Reading once was the second half of the empty-search bug. Even with the whole catalogue on
   * the device, a page opened while the first pull was still in flight held the store's contents
   * *at that instant* for the rest of the visit — and on a phone, opening the screen and the
   * first sync are the same second. `SYNC_DONE_EVENT` already exists for exactly this (§3.3), so
   * this is a listener rather than a polling loop.
   */
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const bump = () => setGeneration((n) => n + 1);
    window.addEventListener(SYNC_DONE_EVENT, bump);
    return () => window.removeEventListener(SYNC_DONE_EVENT, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void withLocal(async (db) => {
      const [list, history, saved] = await Promise.all([
        localCatalogue(db),
        localSessions(db),
        localRoutines(db),
      ]);
      if (cancelled) return;
      setMirrored(list);
      setSessions(history);
      setRoutines(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [generation]);

  const efforts = useMemo<Effort[]>(
    () =>
      sessions.flatMap((session) =>
        session.sets.map((set) => ({
          exercise: set.exercise,
          performedAt: session.performedAt,
          setType: set.setType,
          weightLbs: set.weightLbs,
          reps: set.reps,
          distanceM: set.distanceM,
          durationS: set.durationS,
          spm: set.spm,
          pieceType: set.pieceType,
        })),
      ),
    [sessions],
  );
  const records = useMemo(() => strengthRecords(efforts), [efforts]);

  /** Previous-set ghosts (V4 Phase 2++ Stage 5) — Hevy's single best feature, by Victor's own
   *  account. Excludes the session being drafted, so a set just typed is never its own ghost. */
  const previousByExercise = useMemo(
    () => mostRecentSetsByExercise(sessions, sessionId),
    [sessions, sessionId],
  );

  const addBlock = useCallback((entry: LocalExercise) => {
    setBlocks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        exercise: entry.name,
        modality: entry.modality,
        primaryMuscles: entry.primaryMuscles,
        secondaryMuscles: entry.secondaryMuscles,
        restSeconds: entry.restSeconds ?? DEFAULT_REST_SECONDS,
        sets: [emptySet(entry.name, 0)],
      },
    ]);
    setPicking(false);
  }, []);

  /** Multi-select add (V4 Phase 2++ Stage 5, Q-per-plan "Add 3 exercises" in one pass). */
  const addBlocks = useCallback((entries: LocalExercise[]) => {
    setBlocks((current) => [
      ...current,
      ...entries.map((entry) => ({
        id: crypto.randomUUID(),
        exercise: entry.name,
        modality: entry.modality,
        primaryMuscles: entry.primaryMuscles,
        secondaryMuscles: entry.secondaryMuscles,
        restSeconds: entry.restSeconds ?? DEFAULT_REST_SECONDS,
        sets: [emptySet(entry.name, 0)],
      })),
    ]);
    setPicking(false);
  }, []);

  const startRest = useCallback((seconds: number) => {
    setRestTimer({ startedAt: Date.now(), seconds });
  }, []);

  /**
   * Start a routine (V4 Phase 2++ Stage 6) — pre-filled with the weights it was saved at.
   *
   * The routine stores only a name per line, so the modality, muscles and rest default are
   * looked up in the catalogue the same way the picker does. A line whose exercise has since
   * been renamed or deleted still opens as a block — the name is what history is keyed by, so
   * refusing to load it would be worse than loading it with an empty figure.
   */
  const startRoutine = useCallback(
    (routine: LocalRoutine) => {
      setTitle((current) => (current.trim() === "" ? routine.name : current));
      setBlocks(
        routine.exercises.map((line) => {
          const entry = catalogue.find((e) => e.name === line.exercise);
          const count = Math.max(1, line.targetSets ?? 1);
          return {
            id: crypto.randomUUID(),
            exercise: line.exercise,
            modality: entry?.modality ?? "lift",
            primaryMuscles: entry?.primaryMuscles ?? [],
            secondaryMuscles: entry?.secondaryMuscles ?? [],
            restSeconds: entry?.restSeconds ?? DEFAULT_REST_SECONDS,
            sets: Array.from({ length: count }, (_, index) => ({
              ...emptySet(line.exercise, index),
              weightLbs: line.targetWeightLbs,
              reps: line.targetReps,
            })),
          };
        }),
      );
      setState({ ok: true, message: `Started “${routine.name}”.` });
    },
    [catalogue],
  );

  /**
   * Save what is on screen as a routine. The targets are this session's own numbers — the
   * heaviest working set per exercise, which is what "pre-filled with last weights" means when
   * you start it again.
   */
  async function saveAsRoutine() {
    const name = title.trim() === "" ? "Routine" : title.trim();
    const result = await saveRoutine(
      {
        name,
        notes: "",
        exercises: blocks.map((block, index) => {
          const working = block.sets.filter((set) => hasContent(set));
          const heaviest = working.reduce<SetInput | null>(
            (best, set) =>
              set.weightLbs !== null && (best === null || set.weightLbs > (best.weightLbs ?? 0))
                ? set
                : best,
            null,
          );
          return {
            exercise: block.exercise,
            position: index,
            targetSets: working.length > 0 ? working.length : null,
            targetReps: heaviest?.reps ?? null,
            targetWeightLbs: heaviest?.weightLbs ?? null,
          };
        }),
      },
      crypto.randomUUID(),
    );
    setState(result);
    if (result.ok) {
      buzzSaved();
      requestSync();
      setGeneration((n) => n + 1);
    }
  }

  async function removeRoutine(clientId: string) {
    const result = await deleteRoutine(clientId);
    setState(result);
    if (result.ok) setGeneration((n) => n + 1);
  }

  const totals = useMemo(() => {
    let sets = 0;
    let volume = 0;
    for (const block of blocks) {
      for (const set of block.sets) {
        if (!hasContent(set)) continue;
        sets += 1;
        if (set.weightLbs !== null && set.reps !== null) volume += set.weightLbs * set.reps;
      }
    }
    return { sets, volume };
  }, [blocks]);

  async function save() {
    setSaving(true);
    const result = await saveSession(
      {
        performedAt: new Date(performedAt),
        title,
        notes,
        exerciseNotes,
        sets: blocks.flatMap((block) =>
          block.sets.map((set) => ({ ...set, exercise: block.exercise })),
        ),
      },
      sessionId,
    );
    setSaving(false);
    setState(result);

    if (result.ok) {
      buzzSaved();
      // Ask for a flush rather than waiting for one. On a good connection the session is in
      // Postgres a second later; on a bad one this is a no-op and the ordinary triggers get it.
      requestSync();
      // A fresh identity, so the next session is a new row rather than an edit of this one.
      setSessionId(crypto.randomUUID());
      setBlocks([]);
      setTitle("");
      setNotes("");
      setExerciseNotes({});
      setRestTimer(null);
    }
  }

  return (
    <div className="space-y-5">
      <RestTimer
        key={restTimer?.startedAt ?? "idle"}
        timer={restTimer}
        onDismiss={() => setRestTimer(null)}
      />

      {/*
       * Two fields, and they wrap rather than compete.
       *
       * The weigh-in used to be a third field here. It is gone: a bodyweight is not a property of
       * a workout, it is a daily measurement that happens to be taken near one, and putting it on
       * this form asked for it every single session — which makes it either noise or a number
       * typed carelessly, and a carelessly typed number is worse than a missing one because every
       * weight-adjusted split is computed from it. It now has its own quick-log category, which
       * is one tap from anywhere and required by nothing. See D-221.
       */}
      <header className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label className={LABEL} htmlFor="session-title">
            Session
          </label>
          <input
            id="session-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Push A"
            autoComplete="off"
            className={`${FIELD} mt-1`}
          />
        </div>
        <div className="min-w-0">
          <label className={LABEL} htmlFor="session-when">
            When
          </label>
          <input
            id="session-when"
            type="datetime-local"
            value={performedAt}
            onChange={(event) => setPerformedAt(event.target.value)}
            className={`${FIELD} mt-1 font-mono text-xs`}
          />
        </div>
      </header>

      {/* Routines (V4 Phase 2++ Stage 6). Above the sets rather than below them: the moment a
          routine is useful is before you have added anything, and a control you scroll past to
          reach is a control you use once. */}
      {routines.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={LABEL}>Routines</span>
          {routines.map((routine) => (
            <span
              key={routine.clientId}
              className="flex items-center rounded-pill border border-border bg-card/60"
            >
              <button
                type="button"
                onClick={() => startRoutine(routine)}
                className="min-h-9 rounded-l-pill px-3 text-xs text-foreground transition-colors hover:text-primary"
              >
                {routine.name}
                <span className="ml-1.5 font-mono text-[0.6rem] text-muted-foreground">
                  {routine.exercises.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void removeRoutine(routine.clientId)}
                aria-label={`Delete routine ${routine.name}`}
                className="flex size-9 items-center justify-center rounded-r-pill text-muted-foreground transition-colors hover:text-destructive"
              >
                <XIcon className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Q398. Kept at the top rather than the bottom: it is the number you glance at between
          sets, and the bottom of this page moves every time a row is added. */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-card/40 px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>
          <span className="text-foreground">{totals.sets}</span> sets
        </span>
        {totals.volume > 0 && (
          <span>
            <span className="text-foreground">{Math.round(totals.volume).toLocaleString()}</span> lb
            volume
          </span>
        )}
      </div>

      {blocks.map((block, blockIndex) => (
        <ExerciseBlock
          key={block.id}
          block={block}
          record={records.find((r) => r.exercise === block.exercise) ?? null}
          previous={previousByExercise.get(block.exercise) ?? []}
          exerciseNote={exerciseNotes[block.exercise] ?? ""}
          onExerciseNoteChange={(text) =>
            setExerciseNotes((current) => ({ ...current, [block.exercise]: text }))
          }
          onChange={(next) =>
            setBlocks((current) => current.map((b, i) => (i === blockIndex ? next : b)))
          }
          onRemove={() => setBlocks((current) => current.filter((_, i) => i !== blockIndex))}
          onStartRest={startRest}
        />
      ))}

      <ExercisePicker
        open={picking}
        onOpenChange={setPicking}
        catalogue={catalogue}
        efforts={efforts}
        onAdd={(entries) => {
          const created = entries.filter(
            (e) => !catalogue.some((c) => c.seedKey === e.seedKey && c.name === e.name),
          );
          if (created.length > 0) {
            setMirrored((current) =>
              [...current, ...created].sort((a, b) => a.name.localeCompare(b.name)),
            );
          }
          addBlocks(entries);
        }}
        onCreated={(entry) => {
          setMirrored((current) =>
            [...current, entry].sort((a, b) => a.name.localeCompare(b.name)),
          );
          addBlock(entry);
        }}
      />
      {!picking && (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <PlusIcon className="icon-sm" aria-hidden />
          Add exercise
        </button>
      )}

      <div>
        <label className={LABEL} htmlFor="session-notes">
          Notes
        </label>
        <textarea
          id="session-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className={`${FIELD} mt-1 resize-y`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save session"}
        </button>
        {/* Saved from a finished session rather than built from a blank form — Victor's answer,
            and what makes a routine cost a name and a tap rather than a second data-entry
            screen. Hidden until there is something to save, since an empty one is not a
            routine. */}
        {blocks.length > 0 && (
          <button
            type="button"
            onClick={() => void saveAsRoutine()}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            Save as routine
          </button>
        )}
        {state && (
          <p
            role="status"
            className={`text-xs ${state.ok ? "text-muted-foreground" : "text-destructive"}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </div>
  );
}

/** One exercise and its sets. */
function ExerciseBlock({
  block,
  record,
  previous,
  exerciseNote,
  onExerciseNoteChange,
  onChange,
  onRemove,
  onStartRest,
}: {
  block: Block;
  record: ReturnType<typeof strengthRecords>[number] | null;
  /** Last time's sets for this exercise, for the ghost placeholders (V4 Phase 2++ Stage 5). */
  previous: LocalSet[];
  exerciseNote: string;
  onExerciseNoteChange: (text: string) => void;
  onChange: (next: Block) => void;
  onRemove: () => void;
  onStartRest: (seconds: number) => void;
}) {
  const columns = FIELDS_FOR[block.modality];
  const [showing, setShowing] = useState(false);
  const description = howTo(block.exercise);

  const setField = (index: number, field: keyof SetInput, raw: string) => {
    const value = raw.trim() === "" ? null : Number(raw);
    onChange({
      ...block,
      sets: block.sets.map((set, i) =>
        i === index ? { ...set, [field]: Number.isFinite(value as number) ? value : null } : set,
      ),
    });
  };

  /** Duration is typed as m:ss, same shape an erg monitor shows, and parsed on blur rather than
   *  on every keystroke — reformatting mid-type would fight a person typing "2:1" toward "2:17". */
  const setDuration = (index: number, seconds: number | null) => {
    onChange({
      ...block,
      sets: block.sets.map((set, i) => (i === index ? { ...set, durationS: seconds } : set)),
    });
  };

  /**
   * Tick to complete (V4 Phase 2++ Stage 5). Ticking on starts the rest timer and dims the row;
   * ticking back off — a mis-tap — clears both the mark and, silently, nothing else: the numbers
   * typed stay exactly as they were.
   */
  const toggleComplete = (index: number) => {
    const set = block.sets[index];
    const completing = set.completedAt === null;
    onChange({
      ...block,
      sets: block.sets.map((s, i) =>
        i === index ? { ...s, completedAt: completing ? new Date().toISOString() : null } : s,
      ),
    });
    if (completing) onStartRest(block.restSeconds);
  };

  /**
   * Q400. "Same again" copies the previous row rather than adding a blank one.
   *
   * Straight sets are the common case — three sets of five at the same weight is one number
   * typed once, not three times — and an empty row that you then fill identically is exactly the
   * friction Q392's three-taps target is about. The copy starts un-ticked and un-noted — those
   * are facts about this rep, not the last one.
   */
  const addSet = () => {
    const last = block.sets[block.sets.length - 1];
    const next = last
      ? { ...last, setIndex: block.sets.length, completedAt: null, notes: "" }
      : emptySet(block.exercise, block.sets.length);
    onChange({ ...block, sets: [...block.sets, next] });
  };

  return (
    <section
      className={`rounded-lg border border-border bg-card/40 p-3 transition-colors ${
        block.sets.length > 0 && block.sets.every((s) => s.completedAt !== null)
          ? "border-success/30 bg-success/5"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm text-foreground">{block.exercise}</h3>
          {/* Q409: the record, while you are working. A PR you can only see afterwards is a PR
              you find out about too late to chase. */}
          {record?.heaviest && (
            <p className="mt-0.5 font-mono text-[0.65rem] text-muted-foreground">
              best {record.heaviest.weightLbs} × {record.heaviest.reps}
              {record.bestE1rm ? ` · e1RM ${record.bestE1rm.e1rm}` : ""}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Rest default, editable per exercise (V4 Phase 2++ Stage 5). */}
          <label className="flex items-center gap-1 font-mono text-[0.6rem] text-muted-foreground">
            <span className="sr-only">Rest, seconds, for {block.exercise}</span>
            <input
              type="number"
              min={0}
              step={5}
              value={block.restSeconds}
              onChange={(event) =>
                onChange({ ...block, restSeconds: Number(event.target.value) || 0 })
              }
              className="tabular w-12 rounded border border-border bg-card/60 px-1 py-1 text-right"
            />
            s rest
          </label>
          {/* Collapsed by default. The diagram and the cues are reference — useful the first few
              times you program a movement and pure clutter on the four hundredth bench press, so
              they are one tap away rather than occupying the screen you are typing into. */}
          {(block.primaryMuscles.length > 0 ||
            block.secondaryMuscles.length > 0 ||
            description) && (
            <button
              type="button"
              onClick={() => setShowing((open) => !open)}
              aria-expanded={showing}
              aria-label={`${showing ? "Hide" : "Show"} how to do ${block.exercise}`}
              className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDownIcon
                className={`icon-sm transition-transform duration-fast ${showing ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${block.exercise}`}
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
          >
            <XIcon className="icon-sm" aria-hidden />
          </button>
        </div>
      </div>

      {showing && (
        <div className="mt-3 flex flex-wrap items-start gap-4 rounded-md border border-border/70 bg-background/40 p-3">
          <MuscleMap primary={block.primaryMuscles} secondary={block.secondaryMuscles} size={124} />
          <div className="min-w-[12rem] flex-1">
            {(block.primaryMuscles.length > 0 || block.secondaryMuscles.length > 0) && (
              <p className="font-mono text-[0.6rem] text-muted-foreground">
                {[...block.primaryMuscles, ...block.secondaryMuscles].join(" · ")}
              </p>
            )}
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {description ?? "No description for this one — it is not in the seeded catalogue."}
            </p>
          </div>
        </div>
      )}

      {/* Per-exercise note — "left knee bothered me on squats" — separate from a per-set one. */}
      <input
        value={exerciseNote}
        onChange={(event) => onExerciseNoteChange(event.target.value)}
        placeholder="Note for this exercise"
        className="mt-2 min-h-9 w-full rounded-md border border-border/60 bg-background/30 px-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
      />

      {/*
       * Cards on the phone, a table above 64rem (V4 Phase 2++ Stage 5, D-220 still applies — no
       * width lives in a shared class constant, only at the call site).
       *
       * The previous version put the number, every value field, a four-option select and a
       * delete button on one flex line. Even with the width bug fixed that is five controls in
       * 324 pixels, and an erg piece has three value fields rather than two, so it was never
       * going to fit on a phone. Here the values get the full width and the set type is a row of
       * chips underneath. A laptop has the room a table wants — one row per set, values as
       * columns — which reads faster once there is more than a handful of sets.
       */}
      <ol className="mt-3 space-y-3 lg:hidden">
        {block.sets.map((set, index) => {
          const ghost = previous[index];
          const done = set.completedAt !== null;
          return (
            <li
              key={index}
              className={`rounded-md border p-2.5 transition-colors ${
                done
                  ? "border-success/30 bg-success/5 opacity-70"
                  : "border-border/60 bg-background/30"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Tick to complete. The row dims once every value is locked in, which is the
                      visual cue that this set is done and the next one is the one to look at. */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`Mark set ${index + 1} ${done ? "not done" : "done"}`}
                    onClick={() => toggleComplete(index)}
                    className={`flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      done
                        ? "border-success/50 bg-success/20 text-success"
                        : "border-border text-transparent hover:border-primary/50"
                    }`}
                  >
                    <CheckIcon className="icon-sm" aria-hidden />
                  </button>
                  {/* Q399. Numbered, so "add ten pounds on set three" has something to point at. */}
                  <span className="font-mono text-xs text-muted-foreground">Set {index + 1}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...block, sets: block.sets.filter((_, i) => i !== index) })
                  }
                  aria-label={`Delete set ${index + 1}`}
                  className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2Icon className="icon-sm" aria-hidden />
                </button>
              </div>

              <div className="mt-1 grid grid-cols-2 gap-2">
                {columns.map((column) => (
                  <div key={String(column)} className="min-w-0">
                    <label className={LABEL} htmlFor={`s-${block.id}-${index}-${String(column)}`}>
                      {COLUMN_LABEL[column]}
                    </label>
                    {column === "durationS" ? (
                      <DurationField
                        id={`s-${block.id}-${index}-${String(column)}`}
                        seconds={set.durationS}
                        onCommit={(seconds) => setDuration(index, seconds)}
                        placeholder={ghost?.durationS ?? null}
                        className={`${FIELD} mt-1 font-mono`}
                      />
                    ) : (
                      <input
                        id={`s-${block.id}-${index}-${String(column)}`}
                        inputMode="decimal"
                        value={set[column] === null ? "" : String(set[column])}
                        onChange={(event) => setField(index, column, event.target.value)}
                        // Previous-set ghost (V4 Phase 2++ Stage 5) — Hevy's single best feature,
                        // by Victor's account. Shown only where this set has nothing typed yet, so
                        // it never hides a real, deliberately-cleared value.
                        placeholder={
                          ghost && ghost[column] !== null ? String(ghost[column]) : undefined
                        }
                        className={`${FIELD} mt-1 font-mono`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* A radiogroup rather than a `<select>`: four options is few enough to show, and a
                  native select on Android is a full-screen modal for a choice that is "normal"
                  ninety-five percent of the time. */}
              <div
                role="radiogroup"
                aria-label={`Set ${index + 1} type`}
                className="mt-2 flex flex-wrap gap-1"
              >
                {SET_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={set.setType === type}
                    onClick={() =>
                      onChange({
                        ...block,
                        sets: block.sets.map((s, i) => (i === index ? { ...s, setType: type } : s)),
                      })
                    }
                    className={`min-h-9 rounded-md border px-2.5 font-mono text-[0.65rem] transition-colors ${
                      set.setType === type
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Time trial tag (erg/water only) — writes `pieceType`, orthogonal to `setType`
                  above (D-230): a technical paddle and a race piece both "count", but only one
                  of them is a benchmark test. One tap, not a free-text field, since "was this a
                  time trial" is the only distinction this screen needs to make. */}
              {(block.modality === "erg" || block.modality === "water") && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={set.pieceType === "race"}
                  onClick={() =>
                    onChange({
                      ...block,
                      sets: block.sets.map((s, i) =>
                        i === index
                          ? { ...s, pieceType: s.pieceType === "race" ? null : "race" }
                          : s,
                      ),
                    })
                  }
                  className={`mt-2 min-h-9 rounded-md border px-2.5 font-mono text-[0.65rem] transition-colors ${
                    set.pieceType === "race"
                      ? "border-highlight/50 bg-highlight/10 text-highlight"
                      : "border-border text-muted-foreground hover:border-highlight/40"
                  }`}
                >
                  Time trial
                </button>
              )}

              <input
                value={set.notes}
                onChange={(event) =>
                  onChange({
                    ...block,
                    sets: block.sets.map((s, i) =>
                      i === index ? { ...s, notes: event.target.value } : s,
                    ),
                  })
                }
                placeholder="Note for this set"
                className="mt-2 min-h-8 w-full rounded-md border border-border/50 bg-background/40 px-2 text-[0.7rem] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
              />
            </li>
          );
        })}
      </ol>

      {/* The desktop table — same data, same handlers, laid out as columns rather than cards. */}
      <div className="mt-3 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[40rem] text-left">
          <thead>
            <tr className="border-b border-border text-[0.65rem] text-muted-foreground">
              <th className="w-10 py-1.5"></th>
              <th className="w-10 py-1.5 font-mono">#</th>
              {columns.map((column) => (
                <th key={String(column)} className="py-1.5 font-mono">
                  {COLUMN_LABEL[column]}
                </th>
              ))}
              <th className="py-1.5 font-mono">Type</th>
              {(block.modality === "erg" || block.modality === "water") && (
                <th className="py-1.5 font-mono">TT</th>
              )}
              <th className="py-1.5 font-mono">Note</th>
              <th className="w-10 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {block.sets.map((set, index) => {
              const ghost = previous[index];
              const done = set.completedAt !== null;
              return (
                <tr
                  key={index}
                  className={`border-b border-border/40 last:border-0 ${done ? "opacity-70" : ""}`}
                >
                  <td className="py-1.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={`Mark set ${index + 1} ${done ? "not done" : "done"}`}
                      onClick={() => toggleComplete(index)}
                      className={`flex size-8 items-center justify-center rounded-md border transition-colors ${
                        done
                          ? "border-success/50 bg-success/20 text-success"
                          : "border-border text-transparent hover:border-primary/50"
                      }`}
                    >
                      <CheckIcon className="icon-sm" aria-hidden />
                    </button>
                  </td>
                  <td className="tabular py-1.5 font-mono text-xs text-muted-foreground">
                    {index + 1}
                  </td>
                  {columns.map((column) => (
                    <td key={String(column)} className="py-1.5 pr-2">
                      {column === "durationS" ? (
                        <DurationField
                          aria-label={`Set ${index + 1} ${COLUMN_LABEL[column]}`}
                          seconds={set.durationS}
                          onCommit={(seconds) => setDuration(index, seconds)}
                          placeholder={ghost?.durationS ?? null}
                          className="w-20 rounded-md border border-border bg-card/60 px-2 py-1 font-mono text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none"
                        />
                      ) : (
                        <input
                          aria-label={`Set ${index + 1} ${COLUMN_LABEL[column]}`}
                          inputMode="decimal"
                          value={set[column] === null ? "" : String(set[column])}
                          onChange={(event) => setField(index, column, event.target.value)}
                          placeholder={
                            ghost && ghost[column] !== null ? String(ghost[column]) : undefined
                          }
                          className="w-20 rounded-md border border-border bg-card/60 px-2 py-1 font-mono text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none"
                        />
                      )}
                    </td>
                  ))}
                  <td className="py-1.5 pr-2">
                    <select
                      aria-label={`Set ${index + 1} type`}
                      value={set.setType}
                      onChange={(event) =>
                        onChange({
                          ...block,
                          sets: block.sets.map((s, i) =>
                            i === index
                              ? { ...s, setType: event.target.value as SetInput["setType"] }
                              : s,
                          ),
                        })
                      }
                      className="rounded-md border border-border bg-card/60 px-2 py-1 font-mono text-xs text-foreground"
                    >
                      {SET_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </td>
                  {(block.modality === "erg" || block.modality === "water") && (
                    <td className="py-1.5 pr-2">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={set.pieceType === "race"}
                        aria-label={`Set ${index + 1} time trial`}
                        onClick={() =>
                          onChange({
                            ...block,
                            sets: block.sets.map((s, i) =>
                              i === index
                                ? { ...s, pieceType: s.pieceType === "race" ? null : "race" }
                                : s,
                            ),
                          })
                        }
                        className={`flex size-8 items-center justify-center rounded-md border font-mono text-[0.6rem] transition-colors ${
                          set.pieceType === "race"
                            ? "border-highlight/50 bg-highlight/10 text-highlight"
                            : "border-border text-muted-foreground hover:border-highlight/40"
                        }`}
                      >
                        TT
                      </button>
                    </td>
                  )}
                  <td className="py-1.5 pr-2">
                    <input
                      aria-label={`Set ${index + 1} note`}
                      value={set.notes}
                      onChange={(event) =>
                        onChange({
                          ...block,
                          sets: block.sets.map((s, i) =>
                            i === index ? { ...s, notes: event.target.value } : s,
                          ),
                        })
                      }
                      className="w-36 rounded-md border border-border bg-card/60 px-2 py-1 text-xs text-foreground"
                    />
                  </td>
                  <td className="py-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ ...block, sets: block.sets.filter((_, i) => i !== index) })
                      }
                      aria-label={`Delete set ${index + 1}`}
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2Icon className="icon-sm" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addSet}
        className="mt-3 min-h-10 w-full rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        + same again
      </button>
    </section>
  );
}

/**
 * Choosing what to log — a sheet over the session, sharing one list with the browser page
 * (Q391; rebuilt for V4 Phase 2++ Stage 5).
 *
 * ## One component, two screens
 *
 * The rows, the grouping, the filters and the fuzzy search are `ExerciseList`, the same component
 * `/private/athletics/exercises` renders. That is the plan's instruction and it is worth stating
 * why: a picker and a browser ask the same question — *which exercise* — and the previous version
 * answered it twice, with a hand-rolled result list here that had no grouping, no filters and no
 * archived handling, drifting further from the browser with every change to either.
 *
 * ## Multi-select
 *
 * Tapping a row selects rather than adds. "Add 3 exercises" in one pass is Victor's answer, and
 * it is the difference between planning a session in one visit to this sheet and opening it once
 * per movement. A single tap on **Add** with nothing selected is still the fast path for one.
 *
 * ## Creating from here
 *
 * Kept, because the movement you want at 6am is sometimes not in the catalogue at all. It has its
 * own name field rather than reusing the list's search box: the list's search is *finding*, and
 * conflating the two is what makes "Add 'ben'" a plausible mis-tap. AI-assist proposes and never
 * writes (D-186), same as everywhere else it appears.
 */
function ExercisePicker({
  open,
  onOpenChange,
  catalogue,
  efforts,
  onAdd,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogue: LocalExercise[];
  efforts: Effort[];
  onAdd: (entries: LocalExercise[]) => void;
  onCreated: (entry: LocalExercise) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filters, setFilters] = useState<ExerciseFilterState>(NO_FILTERS);
  /** The create block starts folded away — see the footer for why. */
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [suggestion, setSuggestion] = useState<NewExerciseInput | null>(null);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const selectedKeys = useMemo(() => new Set(selected), [selected]);

  const { sections } = useExerciseSections({
    entries: catalogue,
    efforts,
    filters,
    // The picker's, not the browser's: what you are about to log is overwhelmingly something you
    // logged last week, and eight rows at the top of the list beats typing the name.
    recent: true,
  });

  /** Only measured while the panel is open, so a closed picker costs no viewport listener. */
  const keyboardInset = useKeyboardInset(open);

  /**
   * Changing what is listed sends you back to the top of it.
   *
   * Without this the panel keeps the scroll offset it had, so typing a query while forty rows
   * down leaves the best match above the visible area — the same "it was at the bottom of the
   * list" complaint D-238 fixed, arriving by a different route. The header is fixed, so the
   * search box you just typed into stays put either way; only the rows move.
   */
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [filters.query, filters.group, filters.equipment, filters.showArchived]);

  /**
   * Closing throws the query, the filters and the half-finished creation away.
   *
   * Reopening onto last time's search is the wrong default here: the picker is opened once per
   * movement in the worst case, and a stale `bnch` filtering the list down to one row reads as
   * the catalogue having lost everything else. The selection is cleared for the same reason —
   * an "Add 3 exercises" button on a panel you have already added from would add them twice.
   */
  function setOpen(next: boolean) {
    if (!next) {
      setFilters(NO_FILTERS);
      setSelected([]);
      setCreating(false);
      setNewName("");
      setSuggestion(null);
      setProblem(null);
    }
    onOpenChange(next);
  }

  function toggle(entry: LocalExercise) {
    const key = keyFor(entry);
    setSelected((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  }

  function addSelected() {
    // Selection order, not list order: three exercises picked in the order you plan to do them
    // should arrive in that order, which is the only ordering information the tap sequence has.
    const byKey = new Map(catalogue.map((entry) => [keyFor(entry), entry]));
    const entries = selected.map((key) => byKey.get(key)).filter((e): e is LocalExercise => !!e);
    if (entries.length === 0) return;
    setSelected([]);
    onAdd(entries);
  }

  async function createIt(input: NewExerciseInput, source: "manual" | "ai") {
    const result = await addExercise({
      name: input.name,
      modality: input.modality,
      equipment: input.equipment,
      primaryMuscles: input.primaryMuscles,
      secondaryMuscles: input.secondaryMuscles,
      source,
    });
    if (result.ok) {
      setNewName("");
      setSuggestion(null);
      // No seedKey, no aliases, no how-to yet — a fresh row is exactly that until someone fills
      // the rest in from the exercise detail page. `clientId` came back from the write itself,
      // generated client-side, so it is editable immediately rather than only after a sync.
      onCreated({
        seedKey: null,
        clientId: result.clientId ?? null,
        name: input.name,
        modality: input.modality,
        equipment: input.equipment,
        primaryMuscles: input.primaryMuscles,
        secondaryMuscles: input.secondaryMuscles,
        aliases: [],
        howTo: "",
        notes: "",
        restSeconds: null,
        archivedAt: null,
        userEditedFields: [],
      });
    } else {
      setProblem(result.message);
    }
  }

  /**
   * Q391's "AI ADD". It **proposes**; adding is still a tap of yours (D-186).
   *
   * The most useful answer is usually that the movement is already in the catalogue under a name
   * you did not think of, so a match is added straight away rather than duplicated —
   * near-duplicates split an exercise's history in two and quietly lower the best on both halves.
   */
  async function ask() {
    setAsking(true);
    setProblem(null);
    setSuggestion(null);
    try {
      const response = await fetchWithDeadline(
        "/api/exercises/suggest",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: newName.trim() }),
        },
        "report",
      );

      // The route's own shape — a proposed creation still speaks the old flat `muscles`. Bridged
      // here rather than left broken: every suggested muscle becomes primary, and an equipment
      // guess outside the closed vocabulary falls back to "other" rather than being invalid.
      const data = (await response.json()) as {
        match?: string | null;
        create?: { name: string; modality: Modality; muscles: string[]; equipment: string } | null;
        error?: string;
      };

      if (!response.ok) {
        setProblem(data.error ?? "That did not work.");
        return;
      }

      const matched = data.match ? catalogue.find((entry) => entry.name === data.match) : undefined;
      if (matched) {
        setNewName("");
        onAdd([matched]);
        return;
      }

      if (data.create) {
        const equipment = (EQUIPMENT as readonly string[]).includes(data.create.equipment)
          ? (data.create.equipment as Equipment)
          : "other";
        setSuggestion({
          name: data.create.name,
          modality: data.create.modality,
          equipment,
          primaryMuscles: data.create.muscles as Muscle[],
          secondaryMuscles: [],
        });
      } else {
        setProblem("Nothing came back that fits.");
      }
    } catch {
      // Offline, or the model took too long. Said out loud rather than hidden: this screen is
      // designed to work with no signal, and a control that silently disappears when the
      // connection drops is a worse surprise than one that explains itself.
      setProblem("Needs a connection. Search the catalogue, or add it by name.");
    } finally {
      setAsking(false);
    }
  }

  // Zero results is the one moment "add it by name" is certainly what you want, so the create
  // block unfolds itself rather than waiting to be asked. Derived, not state: it folds back the
  // instant the query matches something again, with nothing to keep in sync.
  const showCreate = creating || sections.length === 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Full screen on a phone, the plan's second column from `sm` up (D-237).
          It used to be `side="right"` at every width, which on a phone slid a full-width panel
          in from the edge — the gesture a navigation drawer makes, for something that is not
          navigation — and, more to the point, put the search box *inside* the scrolling area.
          Forty rows down the list you could no longer reach the one control that would have got
          you there in one move. Header and footer are fixed now; only the rows scroll. */}
      <SheetContent
        side="fullscreen"
        showCloseButton={false}
        // `bg-background`, not the inherited `bg-popover`: at this size it is a screen rather
        // than an overlay, and the rows' sticky group headings are painted in `background` — a
        // popover-coloured panel behind them shows every heading as a visible band.
        className="gap-0 bg-background text-foreground"
        // The keyboard covers the bottom of a fixed panel without resizing it. Shortening the
        // content box here re-lays the flex column out inside what is left, which lifts the
        // footer clear and shortens the scroller by the same amount. See `useKeyboardInset`.
        style={{ paddingBottom: keyboardInset || undefined }}
      >
        <div className="shrink-0 border-b border-border px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <SheetTitle>Add exercises</SheetTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            >
              <XIcon className="icon-sm" aria-hidden />
            </button>
          </div>
          <SheetDescription className="sr-only">
            Tap to select as many as you want, then add them in one pass.
          </SheetDescription>
          <ExerciseFilterBar entries={catalogue} value={filters} onChange={setFilters} />
        </div>

        {/* `overscroll-contain` so flicking past the last row scrolls the list to its end rather
            than handing the gesture to the session underneath and pulling the page with it. */}
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <ExerciseRows
            sections={sections}
            efforts={efforts}
            onSelect={toggle}
            selectedKeys={selectedKeys}
            emptyLabel="Nothing matches. Add it by name below."
          />
        </div>

        <div className="shrink-0 border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {/* Folded away by default (D-237). Open, this block is a field, two buttons and
              sometimes a suggestion card — around 120px of a phone screen, held permanently, for
              the rare movement that is not among the hundred and forty already listed. Those
              pixels are worth more as two more rows of the list. */}
          {showCreate ? (
            <div className="mb-3">
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Add a movement by name"
                  aria-label="Add a movement by name"
                  autoComplete="off"
                  className={FIELD}
                />
                <button
                  type="button"
                  onClick={() => void ask()}
                  disabled={asking || newName.trim() === ""}
                  className="min-h-10 shrink-0 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
                >
                  {asking ? "Asking…" : "AI"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void createIt(
                      {
                        name: newName.trim(),
                        modality: "lift",
                        equipment: "other",
                        primaryMuscles: [],
                        secondaryMuscles: [],
                      },
                      "manual",
                    )
                  }
                  disabled={newName.trim() === ""}
                  className="min-h-10 shrink-0 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
                >
                  Add
                </button>
              </div>

              {suggestion && (
                <div className="mt-2 rounded-md border border-primary/40 bg-primary/5 p-2">
                  <p className="text-sm text-foreground">{suggestion.name}</p>
                  <p className="mt-0.5 font-mono text-[0.6rem] text-muted-foreground">
                    {suggestion.modality}
                    {suggestion.primaryMuscles.length > 0
                      ? ` · ${suggestion.primaryMuscles.join(", ")}`
                      : ""}
                    {` · ${suggestion.equipment}`}
                  </p>
                  {/* It proposes; you confirm. Nothing the model produced is written until this. */}
                  <button
                    type="button"
                    onClick={() => void createIt(suggestion, "ai")}
                    className="mt-2 min-h-10 w-full rounded-md border border-primary/50 px-3 text-xs text-primary transition-colors hover:bg-primary/10"
                  >
                    Add this
                  </button>
                </div>
              )}

              {problem && (
                <p role="status" className="mt-2 text-xs text-muted-foreground">
                  {problem}
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mb-2 min-h-10 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              + Not in the list?
            </button>
          )}

          <button
            type="button"
            onClick={addSelected}
            disabled={selected.length === 0}
            className="min-h-11 w-full rounded-md border border-primary/50 px-3 text-sm text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            {selected.length === 0
              ? "Select an exercise"
              : `Add ${selected.length} exercise${selected.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Re-exported so the estimator's cap is visible to anyone reading the block above. */
export { estimateOneRepMax };
