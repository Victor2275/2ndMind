"use client";

import { ChevronDownIcon, PlusIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MuscleMap } from "@/components/site/muscle-map";
import { requestSync, SYNC_DONE_EVENT } from "@/components/site/sync-runner";
import { CATALOGUE, howTo, type CatalogueEntry, type Modality } from "@/lib/athletics/catalogue";
import { searchExercises } from "@/lib/athletics/exercise-search";
import { localCatalogue, localEfforts, withLocal } from "@/lib/athletics/local";
import { EQUIPMENT, type Equipment, type Muscle } from "@/lib/athletics/muscles";
import { estimateOneRepMax, strengthRecords, type Effort } from "@/lib/athletics/prs";
import {
  addExercise,
  emptySet,
  hasContent,
  saveSession,
  type SetInput,
} from "@/lib/athletics/session";
import { buzzSaved } from "@/lib/haptics";
import { fetchWithDeadline } from "@/lib/net/deadline";

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

/** Which columns a modality asks for. The whole point of the catalogue carrying one. */
const FIELDS_FOR: Record<Modality, (keyof SetInput)[]> = {
  lift: ["weightLbs", "reps"],
  erg: ["distanceM", "durationS", "spm"],
  water: ["distanceM", "durationS", "spm"],
  conditioning: ["distanceM", "durationS"],
};

const COLUMN_LABEL: Partial<Record<keyof SetInput, string>> = {
  weightLbs: "lbs",
  reps: "reps",
  distanceM: "metres",
  durationS: "seconds",
  spm: "spm",
};

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
  sets: SetInput[];
};

function todayLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * The catalogue, from the bundle first and the device second (D-224, rewritten V4 Phase 2++
 * Stage 3).
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
function mergeCatalogue(mirrored: CatalogueEntry[]): CatalogueEntry[] {
  const bySeedKey = new Map<string, CatalogueEntry>();
  const byName = new Map<string, CatalogueEntry>();

  for (const entry of CATALOGUE) {
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
      }
      // Else: bundle already holds the winning copy under this seedKey, nothing to do.
    } else {
      // No seedKey — a hand-typed or AI-added row, matched by name, same as before Stage 3.
      byName.set(entry.name, entry);
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function SessionLogger() {
  const [mirrored, setMirrored] = useState<CatalogueEntry[]>([]);
  const [efforts, setEfforts] = useState<Effort[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
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
      const [list, history] = await Promise.all([localCatalogue(db), localEfforts(db)]);
      if (cancelled) return;
      setMirrored(list);
      setEfforts(history);
    });
    return () => {
      cancelled = true;
    };
  }, [generation]);

  const records = useMemo(() => strengthRecords(efforts), [efforts]);

  const addBlock = useCallback((entry: CatalogueEntry) => {
    setBlocks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        exercise: entry.name,
        modality: entry.modality,
        primaryMuscles: entry.primaryMuscles,
        secondaryMuscles: entry.secondaryMuscles,
        sets: [emptySet(entry.name, 0)],
      },
    ]);
    setPicking(false);
  }, []);

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
    }
  }

  return (
    <div className="space-y-5">
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
          onChange={(next) =>
            setBlocks((current) => current.map((b, i) => (i === blockIndex ? next : b)))
          }
          onRemove={() => setBlocks((current) => current.filter((_, i) => i !== blockIndex))}
        />
      ))}

      {picking ? (
        <ExercisePicker
          catalogue={catalogue}
          onPick={addBlock}
          onAdded={(entry) => {
            setMirrored((current) =>
              [...current, entry].sort((a, b) => a.name.localeCompare(b.name)),
            );
            addBlock(entry);
          }}
          onCancel={() => setPicking(false)}
        />
      ) : (
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
  onChange,
  onRemove,
}: {
  block: Block;
  record: ReturnType<typeof strengthRecords>[number] | null;
  onChange: (next: Block) => void;
  onRemove: () => void;
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

  /**
   * Q400. "Same again" copies the previous row rather than adding a blank one.
   *
   * Straight sets are the common case — three sets of five at the same weight is one number
   * typed once, not three times — and an empty row that you then fill identically is exactly the
   * friction Q392's three-taps target is about.
   */
  const addSet = () => {
    const previous = block.sets[block.sets.length - 1];
    const next = previous
      ? { ...previous, setIndex: block.sets.length }
      : emptySet(block.exercise, block.sets.length);
    onChange({ ...block, sets: [...block.sets, next] });
  };

  return (
    <section className="rounded-lg border border-border bg-card/40 p-3">
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

      {/*
       * One set per row on a phone, two columns of controls inside it (D-220).
       *
       * The previous version put the number, every value field, a four-option select and a delete
       * button on one flex line. Even with the width bug fixed that is five controls in 324
       * pixels, and an erg piece has three value fields rather than two, so it was never going to
       * fit. Here the values get the full width and the set type is a row of chips underneath,
       * which is also fewer taps than a select: one, rather than open-scroll-choose.
       */}
      <ol className="mt-3 space-y-3">
        {block.sets.map((set, index) => (
          <li key={index} className="rounded-md border border-border/60 bg-background/30 p-2.5">
            <div className="flex items-center justify-between gap-2">
              {/* Q399. Numbered, so "add ten pounds on set three" has something to point at. */}
              <span className="font-mono text-xs text-muted-foreground">Set {index + 1}</span>
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
                  <input
                    id={`s-${block.id}-${index}-${String(column)}`}
                    inputMode="decimal"
                    value={set[column] === null ? "" : String(set[column])}
                    onChange={(event) => setField(index, column, event.target.value)}
                    className={`${FIELD} mt-1 font-mono`}
                  />
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
          </li>
        ))}
      </ol>

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
 * Choosing what to log (Q391).
 *
 * Fuzzy search over the catalogue, so it works with no signal — see
 * `lib/athletics/exercise-search.ts` for why it is fuzzy rather than the prefix match the log
 * search uses.
 */
function ExercisePicker({
  catalogue,
  onPick,
  onAdded,
  onCancel,
}: {
  catalogue: CatalogueEntry[];
  onPick: (entry: CatalogueEntry) => void;
  onAdded: (entry: CatalogueEntry) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestion, setSuggestion] = useState<NewExerciseInput | null>(null);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const results = useMemo(() => searchExercises(catalogue, query, 30), [catalogue, query]);
  const exact = results.some((entry) => entry.name.toLowerCase() === query.trim().toLowerCase());

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
      // No seedKey, no aliases, no how-to yet — a fresh row is exactly that until someone
      // fills the rest in from the exercise detail page (Stage 4).
      onAdded({
        seedKey: null,
        name: input.name,
        modality: input.modality,
        equipment: input.equipment,
        primaryMuscles: input.primaryMuscles,
        secondaryMuscles: input.secondaryMuscles,
        aliases: [],
        howTo: "",
        userEditedFields: [],
      });
    } else {
      setProblem(result.message);
    }
  }

  /**
   * Q391's "AI ADD". It **proposes**; adding is still a tap of yours (D-186).
   *
   * The most useful answer is usually that the movement is already in the catalogue under a
   * name you did not think of, so a match is offered as a row to pick rather than something
   * created — near-duplicates split an exercise's history in two and quietly lower the best on
   * both halves.
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
          body: JSON.stringify({ text: query.trim() }),
        },
        "report",
      );

      // The route's own shape — a proposed creation still speaks the old flat `muscles`, which
      // Stage 4 (AI-assist on the create form) is where that gets upgraded to primary/secondary.
      // Bridged here rather than left broken: every suggested muscle becomes primary, and an
      // equipment guess outside the closed vocabulary falls back to "other" rather than being
      // silently invalid.
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
        onPick(matched);
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

  return (
    <section className="rounded-lg border border-primary/40 bg-card/60 p-3">
      <div className="flex items-center gap-2">
        <SearchIcon className="icon-sm shrink-0 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search exercises"
          aria-label="Search exercises"
          autoComplete="off"
          className={FIELD}
        />
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <XIcon className="icon-sm" aria-hidden />
        </button>
      </div>

      <ul className="mt-2 max-h-64 overflow-y-auto">
        {results.map((entry) => (
          <li key={entry.name}>
            <button
              type="button"
              onClick={() => onPick(entry)}
              className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm text-foreground transition-colors hover:bg-primary/10"
            >
              {/* Small enough to be a glyph rather than a picture: at 40px the question it answers
                  is "is this the push or the pull one", which is exactly the question you have
                  while scanning a list of similar names. */}
              <MuscleMap
                primary={entry.primaryMuscles}
                secondary={entry.secondaryMuscles}
                size={40}
              />
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              <span className="shrink-0 font-mono text-[0.6rem] text-muted-foreground">
                {entry.primaryMuscles.slice(0, 2).join(" · ") || entry.modality}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {query.trim() !== "" && !exact && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                void createIt(
                  {
                    name: query.trim(),
                    modality: "lift",
                    equipment: "other",
                    primaryMuscles: [],
                    secondaryMuscles: [],
                  },
                  "manual",
                )
              }
              className="min-h-10 flex-1 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              Add “{query.trim()}”
            </button>
            <button
              type="button"
              onClick={() => void ask()}
              disabled={asking}
              className="min-h-10 shrink-0 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
            >
              {asking ? "Asking…" : "AI add"}
            </button>
          </div>

          {suggestion && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-2">
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
            <p role="status" className="text-xs text-muted-foreground">
              {problem}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Re-exported so the estimator's cap is visible to anyone reading the block above. */
export { estimateOneRepMax };
