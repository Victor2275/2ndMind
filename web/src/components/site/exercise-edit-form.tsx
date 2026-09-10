"use client";

import { useState } from "react";

import { MuscleMap } from "@/components/site/muscle-map";
import type { LocalExercise } from "@/lib/athletics/local";
import type { Modality } from "@/lib/athletics/catalogue";
import { EQUIPMENT, REGIONS, type Equipment, type Muscle } from "@/lib/athletics/muscles";
import { addExercise, updateExercise } from "@/lib/athletics/session";
import { fetchWithDeadline } from "@/lib/net/deadline";

/**
 * Creating or editing a catalogue entry — seeded rows included (V4 Phase 2++ Stage 4).
 *
 * One form for both, per the plan. Creating calls `addExercise`; editing calls `updateExercise`
 * with `userEditedFields` set to the union of whatever was already there and whichever fields
 * this save actually changed — sticky, because a field once edited by hand stays that way for
 * `seed-exercises.mts` even across a save that does not touch it again.
 *
 * The figure is tappable, same cycling `/private/kitchen-sink`'s demo panel introduced: first tap
 * makes a region primary, second demotes it to secondary, third clears it.
 */

const MODALITIES: Modality[] = ["lift", "erg", "water", "conditioning"];

const FIELD =
  "min-h-10 w-full rounded-md border border-border bg-card/60 px-3 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none";
const LABEL = "eyebrow text-muted-foreground";

export function ExerciseEditForm({
  initial,
  onSaved,
  onCancel,
}: {
  /** Omit to create a new exercise. */
  initial?: LocalExercise;
  onSaved: (entry: LocalExercise) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [modality, setModality] = useState<Modality>(initial?.modality ?? "lift");
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? "barbell");
  // One state object rather than two independent arrays — the tap cycle (none -> primary ->
  // secondary -> none) has to read and write both together, and two `setState` calls each
  // closing over the other's stale value is exactly how that cycle gets the wrong answer.
  const [muscles, setMuscles] = useState<{ primary: Muscle[]; secondary: Muscle[] }>({
    primary: initial?.primaryMuscles ?? [],
    secondary: initial?.secondaryMuscles ?? [],
  });
  const primary = muscles.primary;
  const secondary = muscles.secondary;
  const [aliasText, setAliasText] = useState((initial?.aliases ?? []).join(", "));
  const [howTo, setHowTo] = useState(initial?.howTo ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [restSeconds, setRestSeconds] = useState(
    initial?.restSeconds !== null && initial?.restSeconds !== undefined
      ? String(initial.restSeconds)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /** none -> primary -> secondary -> none, per tap — same cycle the kitchen-sink demo uses. */
  function onRegionTap(region: string) {
    const muscle = region as Muscle;
    setMuscles((current) => {
      if (current.primary.includes(muscle)) {
        return {
          primary: current.primary.filter((m) => m !== muscle),
          secondary: [...current.secondary, muscle],
        };
      }
      if (current.secondary.includes(muscle)) {
        return { ...current, secondary: current.secondary.filter((m) => m !== muscle) };
      }
      return { ...current, primary: [...current.primary, muscle] };
    });
  }

  /** AI-assist, same rule as everywhere else it appears (D-186): it proposes, this confirms. */
  async function fillWithAi() {
    if (name.trim() === "") {
      setProblem("Describe the movement in the name field first, then ask.");
      return;
    }
    setAsking(true);
    setProblem(null);
    try {
      const response = await fetchWithDeadline(
        "/api/exercises/suggest",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: name.trim() }),
        },
        "report",
      );
      const data = (await response.json()) as {
        create?: { name: string; modality: Modality; muscles: string[]; equipment: string } | null;
        error?: string;
      };
      if (!response.ok || !data.create) {
        setProblem(data.error ?? "Nothing came back that fits.");
        return;
      }
      setModality(data.create.modality);
      if ((EQUIPMENT as readonly string[]).includes(data.create.equipment)) {
        setEquipment(data.create.equipment as Equipment);
      }
      setMuscles((current) => ({
        ...current,
        primary: data.create!.muscles.filter((m) =>
          (REGIONS as readonly string[]).includes(m),
        ) as Muscle[],
      }));
    } catch {
      setProblem("Needs a connection to ask.");
    } finally {
      setAsking(false);
    }
  }

  async function save() {
    const trimmedName = name.trim();
    if (trimmedName === "") {
      setProblem("Give it a name first.");
      return;
    }
    setSaving(true);
    setProblem(null);

    const aliases = aliasText
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    if (!initial) {
      const result = await addExercise({
        name: trimmedName,
        modality,
        equipment,
        primaryMuscles: primary,
        secondaryMuscles: secondary,
        source: "manual",
      });
      setSaving(false);
      if (result.ok) {
        onSaved({
          seedKey: null,
          clientId: result.clientId ?? null,
          name: trimmedName,
          modality,
          equipment,
          primaryMuscles: primary,
          secondaryMuscles: secondary,
          aliases,
          howTo,
          notes,
          restSeconds: restSeconds.trim() === "" ? null : Number(restSeconds),
          archivedAt: null,
          userEditedFields: [],
        });
      } else {
        setProblem(result.message);
      }
      return;
    }

    if (!initial.clientId) {
      setSaving(false);
      setProblem("This row has not synced to this device yet — try again once it has.");
      return;
    }

    const changed: string[] = [];
    if (name !== initial.name) changed.push("name");
    if (modality !== initial.modality) changed.push("modality");
    if (equipment !== initial.equipment) changed.push("equipment");
    if (JSON.stringify(primary) !== JSON.stringify(initial.primaryMuscles)) {
      changed.push("primaryMuscles");
    }
    if (JSON.stringify(secondary) !== JSON.stringify(initial.secondaryMuscles)) {
      changed.push("secondaryMuscles");
    }
    if (JSON.stringify(aliases) !== JSON.stringify(initial.aliases)) changed.push("aliases");
    if (howTo !== initial.howTo) changed.push("howTo");
    if (notes !== initial.notes) changed.push("notes");

    const userEditedFields = [...new Set([...initial.userEditedFields, ...changed])];

    const result = await updateExercise({
      clientId: initial.clientId,
      seedKey: initial.seedKey,
      name: trimmedName,
      modality,
      equipment,
      primaryMuscles: primary,
      secondaryMuscles: secondary,
      aliases,
      howTo,
      notes,
      restSeconds: restSeconds.trim() === "" ? null : Number(restSeconds),
      source: initial.seedKey ? "seed" : "manual",
      userEditedFields,
    });
    setSaving(false);
    if (result.ok) {
      onSaved({
        ...initial,
        name: trimmedName,
        modality,
        equipment,
        primaryMuscles: primary,
        secondaryMuscles: secondary,
        aliases,
        howTo,
        notes,
        restSeconds: restSeconds.trim() === "" ? null : Number(restSeconds),
        userEditedFields,
      });
    } else {
      setProblem(result.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <MuscleMap
          primary={primary}
          secondary={secondary}
          size={180}
          onRegionTap={onRegionTap}
          className="mx-auto shrink-0 sm:mx-0"
        />
        <p className="text-xs text-muted-foreground sm:max-w-[14rem]">
          Tap a region on the figure: first tap sets it primary, second demotes it to secondary,
          third clears it.
        </p>
      </div>

      <div>
        <label className={LABEL} htmlFor="ex-name">
          Name
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="ex-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
            placeholder="Movement (Equipment)"
          />
          {!initial && (
            <button
              type="button"
              onClick={() => void fillWithAi()}
              disabled={asking}
              className="min-h-10 shrink-0 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
            >
              {asking ? "Asking…" : "Fill with AI"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL} htmlFor="ex-modality">
            Modality
          </label>
          <select
            id="ex-modality"
            value={modality}
            onChange={(e) => setModality(e.target.value as Modality)}
            className={`${FIELD} mt-1`}
          >
            {MODALITIES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="ex-equipment">
            Equipment
          </label>
          <select
            id="ex-equipment"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value as Equipment)}
            className={`${FIELD} mt-1`}
          >
            {EQUIPMENT.map((eq) => (
              <option key={eq} value={eq}>
                {eq}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="ex-rest">
          Default rest (seconds)
        </label>
        <input
          id="ex-rest"
          type="number"
          min={0}
          value={restSeconds}
          onChange={(e) => setRestSeconds(e.target.value)}
          className={`${FIELD} mt-1`}
          placeholder="Uses the logger's default"
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="ex-aliases">
          Aliases (comma separated)
        </label>
        <input
          id="ex-aliases"
          value={aliasText}
          onChange={(e) => setAliasText(e.target.value)}
          className={`${FIELD} mt-1`}
          placeholder="Other names this is logged under"
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="ex-howto">
          How to
        </label>
        <textarea
          id="ex-howto"
          value={howTo}
          onChange={(e) => setHowTo(e.target.value)}
          rows={3}
          className={`${FIELD} mt-1 py-2`}
          placeholder="Setup, execution, the common error — two sentences, read between sets."
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="ex-notes">
          Notes
        </label>
        <textarea
          id="ex-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`${FIELD} mt-1 py-2`}
          placeholder="Anything else — not technique, just useful"
        />
      </div>

      {problem && <p className="text-sm text-destructive">{problem}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="min-h-10 flex-1 rounded-md border border-primary/50 px-3 text-sm text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
