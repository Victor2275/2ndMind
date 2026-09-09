"use client";

import { PlusIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { CatalogueEntry, Modality } from "@/lib/athletics/catalogue";
import { searchExercises } from "@/lib/athletics/exercise-search";
import { localCatalogue, localEfforts, withLocal } from "@/lib/athletics/local";
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
import { requestSync } from "@/components/site/sync-runner";

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

const FIELD =
  "w-full rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none";
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

/** One exercise's worth of sets, as the screen holds it before saving. */
type Block = {
  id: string;
  exercise: string;
  modality: Modality;
  sets: SetInput[];
};

function todayLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function SessionLogger() {
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
  const [efforts, setEfforts] = useState<Effort[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAt, setPerformedAt] = useState(todayLocal);
  const [bodyweight, setBodyweight] = useState("");
  const [picking, setPicking] = useState(false);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    void withLocal(async (db) => {
      const [list, history] = await Promise.all([localCatalogue(db), localEfforts(db)]);
      if (cancelled) return;
      setCatalogue(list);
      setEfforts(history);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const records = useMemo(() => strengthRecords(efforts), [efforts]);

  const addBlock = useCallback((entry: CatalogueEntry) => {
    setBlocks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        exercise: entry.name,
        modality: entry.modality,
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
        bodyweightLbs: bodyweight.trim() === "" ? null : Number(bodyweight),
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
      setBodyweight("");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
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
        <div>
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

        {/* The weigh-in, logged where you already are. It moved here from the quick log's
            Training category when Phase 2.7 retired it — otherwise the fast path to recording a
            weight would have disappeared with the tab. It writes a `bodyweight_entries` row
            rather than sitting on the session: one copy of the number every adjusted split is
            computed from. */}
        <div className="w-28">
          <label className={LABEL} htmlFor="session-bw">
            Bodyweight
          </label>
          <input
            id="session-bw"
            inputMode="decimal"
            value={bodyweight}
            onChange={(event) => setBodyweight(event.target.value)}
            placeholder="lbs"
            className={`${FIELD} mt-1 font-mono`}
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
            setCatalogue((current) =>
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
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${block.exercise}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
        >
          <XIcon className="icon-sm" aria-hidden />
        </button>
      </div>

      <ol className="mt-2 space-y-2">
        {block.sets.map((set, index) => (
          <li key={index} className="flex items-end gap-2">
            {/* Q399. Numbered, so "add ten pounds on set three" has something to point at. */}
            <span className="w-5 shrink-0 pb-2 text-center font-mono text-xs text-muted-foreground">
              {index + 1}
            </span>

            {columns.map((column) => (
              <div key={String(column)} className="min-w-0 flex-1">
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

            <select
              aria-label={`Set ${index + 1} type`}
              value={set.setType}
              onChange={(event) =>
                onChange({
                  ...block,
                  sets: block.sets.map((s, i) =>
                    i === index ? { ...s, setType: event.target.value as SetInput["setType"] } : s,
                  ),
                })
              }
              className={`${FIELD} w-24 shrink-0 text-xs`}
            >
              <option value="normal">normal</option>
              <option value="warmup">warmup</option>
              <option value="drop">drop</option>
              <option value="failure">failure</option>
            </select>

            <button
              type="button"
              onClick={() => onChange({ ...block, sets: block.sets.filter((_, i) => i !== index) })}
              aria-label={`Delete set ${index + 1}`}
              className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2Icon className="icon-sm" aria-hidden />
            </button>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={addSet}
        className="mt-2 min-h-10 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        + same again
      </button>
    </section>
  );
}

/**
 * Choosing what to log (Q391).
 *
 * Fuzzy search over the mirrored catalogue, so it works with no signal — see
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
  const [suggestion, setSuggestion] = useState<CatalogueEntry | null>(null);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const results = useMemo(() => searchExercises(catalogue, query, 30), [catalogue, query]);
  const exact = results.some((entry) => entry.name.toLowerCase() === query.trim().toLowerCase());

  async function createIt(entry: CatalogueEntry, source: "manual" | "ai") {
    const result = await addExercise({ ...entry, source });
    if (result.ok) onAdded(entry);
    else setProblem(result.message);
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

      const data = (await response.json()) as {
        match?: string | null;
        create?: CatalogueEntry | null;
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

      if (data.create) setSuggestion(data.create);
      else setProblem("Nothing came back that fits.");
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
              className="flex min-h-11 w-full items-baseline justify-between gap-3 rounded-md px-2 text-left text-sm text-foreground transition-colors hover:bg-primary/10"
            >
              <span className="truncate">{entry.name}</span>
              <span className="shrink-0 font-mono text-[0.6rem] text-muted-foreground">
                {entry.muscles.slice(0, 2).join(" · ") || entry.modality}
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
                  { name: query.trim(), modality: "lift", muscles: [], equipment: "" },
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
                {suggestion.muscles.length > 0 ? ` · ${suggestion.muscles.join(", ")}` : ""}
                {suggestion.equipment ? ` · ${suggestion.equipment}` : ""}
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
