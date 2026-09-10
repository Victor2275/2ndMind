"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { MuscleMap } from "@/components/site/muscle-map";
import { searchExercises } from "@/lib/athletics/exercise-search";
import type { LocalExercise } from "@/lib/athletics/local";
import { EQUIPMENT, GROUPS, GROUP_FOR, type MuscleGroup } from "@/lib/athletics/muscles";
import { strengthRecords, type Effort } from "@/lib/athletics/prs";

/**
 * The exercise browser's list — grouped, filtered, searched (V4 Phase 2++ Stage 4).
 *
 * One component for two places, per the plan: the standalone page at
 * `/private/athletics/exercises`, and the sheet the session logger opens to add a set. The
 * difference between them is one prop. Given `onSelect`, a row is a button and picking one calls
 * it; without it, a row is a link to the exercise's detail page. Nothing else about the list
 * changes — the same grouping, the same filters, the same search — because a picker and a browser
 * are the same question ("which exercise") asked from two different screens, and Hevy's
 * mistake to not repeat is maintaining two.
 */

const exerciseHref = (entry: LocalExercise) =>
  `/private/athletics/exercises/${encodeURIComponent(entry.seedKey ?? entry.name)}`;

/** The heaviest-set PR line for a lift, or nothing — erg/water records are the detail page's
 *  table, since a list row has no room for one line per distance. */
function prLine(
  entry: LocalExercise,
  records: Map<string, ReturnType<typeof strengthRecords>[number]>,
) {
  if (entry.modality !== "lift") return null;
  const record = records.get(entry.name);
  if (!record?.heaviest) return null;
  return `${record.heaviest.weightLbs} × ${record.heaviest.reps}`;
}

export function ExerciseList({
  entries,
  efforts = [],
  onSelect,
  emptyLabel = "Nothing matches.",
}: {
  entries: LocalExercise[];
  /** For the PR shown beside each lift. Omit where there is nothing to compute it from. */
  efforts?: Effort[];
  /** Picker mode: a row is a button and this fires instead of linking to the detail page. */
  onSelect?: (entry: LocalExercise) => void;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | "all">("all");
  const [equipment, setEquipment] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  const records = useMemo(() => {
    const map = new Map<string, ReturnType<typeof strengthRecords>[number]>();
    for (const record of strengthRecords(efforts)) map.set(record.exercise, record);
    return map;
  }, [efforts]);

  const filtered = useMemo(() => {
    let list = entries.filter((e) => showArchived || !e.archivedAt);
    if (group !== "all") {
      list = list.filter((e) =>
        e.primaryMuscles.some((m) => GROUP_FOR[m as keyof typeof GROUP_FOR] === group),
      );
    }
    if (equipment !== "all") list = list.filter((e) => e.equipment === equipment);
    return searchExercises(list, query, 500);
  }, [entries, group, equipment, showArchived, query]);

  const grouped = useMemo(() => {
    // Search already ranked the list, so within a group the ranked order is kept rather than
    // re-sorting alphabetically — a query should still put the best match first inside its group.
    const byGroup = new Map<string, LocalExercise[]>();
    for (const entry of filtered) {
      const primary = entry.primaryMuscles[0];
      const label = primary ? (GROUP_FOR[primary as keyof typeof GROUP_FOR] ?? "Other") : "Other";
      const list = byGroup.get(label) ?? [];
      list.push(entry);
      byGroup.set(label, list);
    }
    const order = [...GROUPS, "Other"];
    return [...byGroup.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [filtered]);

  const equipmentUsed = useMemo(
    () => EQUIPMENT.filter((eq) => entries.some((e) => e.equipment === eq)),
    [entries],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises"
          aria-label="Search exercises"
          autoComplete="off"
          className="min-h-10 flex-1 rounded-md border border-border bg-card/60 px-3 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none"
        />
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as MuscleGroup | "all")}
          aria-label="Filter by muscle group"
          className="min-h-10 rounded-md border border-border bg-card/60 px-2 text-sm text-foreground"
        >
          <option value="all">Every muscle group</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          aria-label="Filter by equipment"
          className="min-h-10 rounded-md border border-border bg-card/60 px-2 text-sm text-foreground"
        >
          <option value="all">Every equipment</option>
          {equipmentUsed.map((eq) => (
            <option key={eq} value={eq}>
              {eq}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="size-4"
        />
        Show archived
      </label>

      {filtered.length === 0 && (
        <p className="rounded-md border border-border bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}

      {grouped.map(([label, list]) => (
        <div key={label}>
          {/* Sticky, Hevy-style — the header you are scrolling past is the one answering
              "what am I looking at" for the rows currently on screen. */}
          <h3 className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-1.5 eyebrow text-muted-foreground backdrop-blur-sm">
            {label} · {list.length}
          </h3>
          <ul className="divide-y divide-border/60 rounded-lg border border-border bg-card/40">
            {list.map((entry) => {
              const pr = prLine(entry, records);
              const content = (
                <>
                  <MuscleMap
                    primary={entry.primaryMuscles}
                    secondary={entry.secondaryMuscles}
                    size={40}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {entry.name}
                      {entry.archivedAt && (
                        <span className="ml-1.5 rounded border border-border/70 px-1 py-0 font-mono text-[0.55rem] text-muted-foreground">
                          archived
                        </span>
                      )}
                    </span>
                    <span className="block truncate font-mono text-[0.6rem] text-muted-foreground">
                      {entry.primaryMuscles[0] ?? entry.modality} · {entry.equipment}
                    </span>
                  </span>
                  {pr && (
                    <span className="tabular shrink-0 font-mono text-xs text-primary">{pr}</span>
                  )}
                </>
              );

              return (
                <li key={entry.clientId ?? entry.seedKey ?? entry.name}>
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(entry)}
                      className="flex min-h-14 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-primary/10"
                    >
                      {content}
                    </button>
                  ) : (
                    <Link
                      href={exerciseHref(entry)}
                      className="flex min-h-14 w-full items-center gap-3 px-3 transition-colors hover:bg-primary/10"
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export { exerciseHref };
