"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { MuscleMap } from "@/components/site/muscle-map";
import { lastPerformed, recencyBoost, searchExercises } from "@/lib/athletics/exercise-search";
import type { LocalExercise } from "@/lib/athletics/local";
import { EQUIPMENT, GROUPS, GROUP_FOR, type MuscleGroup } from "@/lib/athletics/muscles";
import { strengthRecords, type Effort } from "@/lib/athletics/prs";

/**
 * The exercise browser's list — grouped, filtered, searched (V4 Phase 2++ Stage 4).
 *
 * One component for two places, per the plan: the standalone page at
 * `/private/athletics/exercises`, and the picker the session logger opens to add a set. The
 * difference between them is one prop. Given `onSelect`, a row is a button and picking one calls
 * it; without it, a row is a link to the exercise's detail page. Nothing else about the list
 * changes — the same grouping, the same filters, the same search — because a picker and a browser
 * are the same question ("which exercise") asked from two different screens, and Hevy's
 * mistake to not repeat is maintaining two.
 *
 * ## Why this file is now four exports instead of one
 *
 * `ExerciseList` still exists and still takes the same props — the browser page is unchanged.
 * But the picker needs the search box and the filters **pinned** while the rows scroll under
 * them (D-237), and a single component that owns both cannot offer that: whatever contains the
 * scrollbar contains the controls. So the three pieces are separable —
 * `useExerciseSections` (the state), `ExerciseFilterBar` (the controls), `ExerciseRows` (the
 * list) — and `ExerciseList` is now just the three of them composed in the arrangement the
 * browser page wants. Neither screen has a second copy of the filtering rules.
 */

const exerciseHref = (entry: LocalExercise) =>
  `/private/athletics/exercises/${encodeURIComponent(entry.seedKey ?? entry.name)}`;

/** How many movements the picker's "Recent" section offers. Roughly one training block's worth:
 *  long enough to hold a full session's movements, short enough to stay a glance. */
const RECENT_COUNT = 8;

/** The stable key a row is addressed by — used for `selectedKeys` and as the React key. */
export const keyFor = (entry: LocalExercise): string =>
  entry.clientId ?? entry.seedKey ?? entry.name;

/** Everything the two filter rows and the search box hold between them. */
export type ExerciseFilterState = {
  query: string;
  group: MuscleGroup | "all";
  equipment: string;
  showArchived: boolean;
};

export const NO_FILTERS: ExerciseFilterState = {
  query: "",
  group: "all",
  equipment: "all",
  showArchived: false,
};

/** A run of rows under one heading. `Recent` and `Best matches` are sections too — the list does
 *  not care what produced a group, only that it has a label and some rows. */
export type ExerciseSection = { label: string; entries: LocalExercise[] };

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

/**
 * Filtering, searching and sectioning — the whole of the list's behaviour, with no markup.
 *
 * ## Searching abandons the grouping, deliberately
 *
 * This is the bug Victor hit on 2026-09-10 (D-238): typing `erg` put `Row (Erg)` at the *bottom* of the
 * list. `searchExercises` had ranked it near the top and the grouping then threw that ranking
 * away — rows were re-bucketed by muscle group, and groups paint in the fixed `GROUPS` order, so
 * a movement tagged `full body` landed in `Other`, dead last, no matter how well it matched.
 *
 * The fix is not a better group order. Grouping and ranking answer different questions and
 * cannot both be honoured at once: **grouping is for browsing, ranking is for searching.** With
 * a query present there is exactly one section, in score order, and the best match is the first
 * row on the screen. Clear the box and the groups come back.
 *
 * ## Recent is opt-in
 *
 * `recent` is the picker's, not the browser's. A movement in "Recent" is also still in its
 * muscle group below — dropping it from Chest because you benched on Tuesday would make the
 * catalogue look like it lost an entry — so the same exercise renders twice, and row keys carry
 * their section to stay unique. The browser page leaves this off: it is for reading and editing
 * the catalogue, where every entry appearing once is the point.
 */
export function useExerciseSections({
  entries,
  efforts = [],
  filters,
  recent = false,
  now,
}: {
  entries: LocalExercise[];
  efforts?: Effort[];
  filters: ExerciseFilterState;
  recent?: boolean;
  /** Injectable clock, so a test can pin what "in the last 14 days" means. */
  now?: number;
}): { sections: ExerciseSection[]; total: number } {
  const lastAt = useMemo(() => lastPerformed(efforts), [efforts]);

  const pool = useMemo(() => {
    let list = entries.filter((e) => filters.showArchived || !e.archivedAt);
    if (filters.group !== "all") {
      list = list.filter((e) =>
        e.primaryMuscles.some((m) => GROUP_FOR[m as keyof typeof GROUP_FOR] === filters.group),
      );
    }
    if (filters.equipment !== "all") list = list.filter((e) => e.equipment === filters.equipment);
    return list;
  }, [entries, filters.group, filters.equipment, filters.showArchived]);

  return useMemo(() => {
    const query = filters.query.trim();

    if (query.length > 0) {
      const ranked = searchExercises(pool, query, 500, (entry) =>
        recencyBoost(lastAt, entry.name, now),
      );
      return {
        sections: ranked.length > 0 ? [{ label: "Best matches", entries: ranked }] : [],
        total: ranked.length,
      };
    }

    const sections: ExerciseSection[] = [];

    if (recent) {
      const done = pool
        .filter((entry) => lastAt.has(entry.name))
        .sort((a, b) => (lastAt.get(b.name) ?? 0) - (lastAt.get(a.name) ?? 0))
        .slice(0, RECENT_COUNT);
      if (done.length > 0) sections.push({ label: "Recent", entries: done });
    }

    // Alphabetical within a group. With no query there is no ranking to preserve, and a list you
    // are scanning rather than searching wants the order your eye can predict.
    const byGroup = new Map<string, LocalExercise[]>();
    for (const entry of pool) {
      const primary = entry.primaryMuscles[0];
      const label = primary ? (GROUP_FOR[primary as keyof typeof GROUP_FOR] ?? "Other") : "Other";
      const list = byGroup.get(label) ?? [];
      list.push(entry);
      byGroup.set(label, list);
    }
    const order = [...GROUPS, "Other"];
    const grouped = [...byGroup.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([label, list]) => ({
        label,
        entries: [...list].sort((a, b) => a.name.localeCompare(b.name)),
      }));

    return { sections: [...sections, ...grouped], total: pool.length };
  }, [pool, filters.query, lastAt, recent, now]);
}

/** `min-h-11`, not the `min-h-8` the log form's chips use: DESIGN.md §9 sets 44px as the floor
 *  for a tap target on this app, and a filter you tap mid-set is exactly what that rule is for.
 *  `text-sm` rather than `text-xs` so a 44px pill does not read as an empty box with a label
 *  floating in it. */
const CHIP =
  "min-h-11 shrink-0 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors";
const CHIP_ON = "border-primary bg-primary/10 text-primary";
const CHIP_OFF =
  "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground";

/** A row of chips that scrolls sideways rather than wrapping to three lines on a phone. The
 *  scrollbar is hidden because a horizontal one on a 32px strip is chrome, not affordance. */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 py-0.5 [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF}`}
    >
      {children}
    </button>
  );
}

/**
 * The search box and the two filter rows (D-237).
 *
 * ## Chips, not `<select>`
 *
 * The muscle-group and equipment filters were native selects. On iOS a `<select>` opens a
 * full-height wheel over whatever is behind it, which in the picker's case is the list you were
 * trying to filter — two taps and a modal to answer a question that is one tap wide. Chips also
 * show what the options *are* without being opened, which matters when the useful ones are
 * "Chest" and "Back" and the useless ones are nine others.
 *
 * Only groups and equipment that actually occur in `entries` get a chip. A filter that leads to
 * an empty list is a dead end you had to tap to discover.
 */
export function ExerciseFilterBar({
  entries,
  value,
  onChange,
  autoFocus = false,
}: {
  entries: LocalExercise[];
  value: ExerciseFilterState;
  onChange: (next: ExerciseFilterState) => void;
  autoFocus?: boolean;
}) {
  const groupsUsed = useMemo(
    () =>
      GROUPS.filter((group) =>
        entries.some((e) =>
          e.primaryMuscles.some((m) => GROUP_FOR[m as keyof typeof GROUP_FOR] === group),
        ),
      ),
    [entries],
  );

  const equipmentUsed = useMemo(
    () => EQUIPMENT.filter((eq) => entries.some((e) => e.equipment === eq)),
    [entries],
  );

  const hasArchived = useMemo(() => entries.some((e) => e.archivedAt), [entries]);

  return (
    <div className="flex flex-col gap-1.5">
      <input
        value={value.query}
        onChange={(e) => onChange({ ...value, query: e.target.value })}
        placeholder="Search exercises"
        aria-label="Search exercises"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        // `search` gives the phone keyboard a Search key and a clear affordance; `enterKeyHint`
        // stops it offering "Go", which here would suggest navigating away.
        type="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        className="min-h-10 w-full rounded-md border border-border bg-card/60 px-3 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none"
      />

      <ChipRow label="Filter by muscle group">
        <Chip active={value.group === "all"} onClick={() => onChange({ ...value, group: "all" })}>
          All
        </Chip>
        {groupsUsed.map((group) => (
          <Chip
            key={group}
            active={value.group === group}
            onClick={() =>
              onChange({ ...value, group: value.group === group ? "all" : (group as MuscleGroup) })
            }
          >
            {group}
          </Chip>
        ))}
      </ChipRow>

      <ChipRow label="Filter by equipment">
        <Chip
          active={value.equipment === "all"}
          onClick={() => onChange({ ...value, equipment: "all" })}
        >
          Any kit
        </Chip>
        {equipmentUsed.map((eq) => (
          <Chip
            key={eq}
            active={value.equipment === eq}
            onClick={() => onChange({ ...value, equipment: value.equipment === eq ? "all" : eq })}
          >
            {eq}
          </Chip>
        ))}
        {hasArchived && (
          <Chip
            active={value.showArchived}
            onClick={() => onChange({ ...value, showArchived: !value.showArchived })}
          >
            Show archived
          </Chip>
        )}
      </ChipRow>
    </div>
  );
}

/**
 * The rows themselves — every section, every entry, and nothing about how they were chosen.
 */
export function ExerciseRows({
  sections,
  efforts = [],
  onSelect,
  selectedKeys,
  emptyLabel = "Nothing matches.",
}: {
  sections: ExerciseSection[];
  efforts?: Effort[];
  /** Picker mode: a row is a button and this fires instead of linking to the detail page. */
  onSelect?: (entry: LocalExercise) => void;
  /**
   * Multi-select mode (V4 Phase 2++ Stage 5): rows whose `keyFor` is in this set show a check
   * mark instead of the usual glyph. The caller owns the selection — this component only ever
   * reports a tap through `onSelect`, so toggling, capping a count or clearing it all stay the
   * caller's decision.
   */
  selectedKeys?: ReadonlySet<string>;
  emptyLabel?: string;
}) {
  const records = useMemo(() => {
    const map = new Map<string, ReturnType<typeof strengthRecords>[number]>();
    for (const record of strengthRecords(efforts)) map.set(record.exercise, record);
    return map;
  }, [efforts]);

  if (sections.length === 0) {
    return (
      <p className="rounded-md border border-border bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.label}>
          {/* Sticky, Hevy-style — the header you are scrolling past is the one answering
              "what am I looking at" for the rows currently on screen. */}
          {/* `h2`, not `h3` — V4 7.4/7.1 (Q446). These sit directly under the page's one
              `h1` from `PageHeader`, and at `h3` the outline skipped a level on every
              section of the catalogue. Caught by the heading audit the sweep gained in 7.1;
              nothing about it is visible, which is why it survived Stage 4 and 4.7. */}
          <h2 className="sticky top-0 z-10 bg-background/95 py-1.5 eyebrow text-muted-foreground backdrop-blur-sm">
            {section.label} · {section.entries.length}
          </h2>
          {/* The §7.1 text-floor allowlist (Q113). Every row carries a second line of mono
              metadata — the muscle group and the equipment — under the exercise name, and at
              140 exercises that line is the difference between a list you can scan and one you
              scroll. Raising it to the 11px floor does not make the catalogue more readable; it
              makes it a third longer. The name above it is `text-sm`, which is what the eye
              lands on. */}
          <ul
            data-tiny-text="exercise metadata line; the floor would make the catalogue a third longer"
            className="divide-y divide-border/60 rounded-lg border border-border bg-card/40"
          >
            {section.entries.map((entry) => {
              const pr = prLine(entry, records);
              const selected = selectedKeys?.has(keyFor(entry)) ?? false;
              const content = (
                <>
                  {selectedKeys ? (
                    <span
                      aria-hidden
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-transparent"
                      }`}
                    >
                      <CheckIcon className="size-3.5" />
                    </span>
                  ) : (
                    <MuscleMap
                      primary={entry.primaryMuscles}
                      secondary={entry.secondaryMuscles}
                      size={40}
                    />
                  )}
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
                // The section is part of the key: an entry in "Recent" is still in its muscle
                // group further down, so `keyFor` alone is not unique across the whole list.
                <li key={`${section.label}:${keyFor(entry)}`}>
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(entry)}
                      aria-pressed={selectedKeys ? selected : undefined}
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

/**
 * Controls above rows, filter state owned here — what `/private/athletics/exercises` renders.
 *
 * The picker composes the same three pieces itself rather than calling this, because it needs
 * the controls outside the scrolling region. See the module doc.
 */
export function ExerciseList({
  entries,
  efforts = [],
  onSelect,
  selectedKeys,
  emptyLabel = "Nothing matches.",
}: {
  entries: LocalExercise[];
  efforts?: Effort[];
  onSelect?: (entry: LocalExercise) => void;
  selectedKeys?: ReadonlySet<string>;
  emptyLabel?: string;
}) {
  const [filters, setFilters] = useState<ExerciseFilterState>(NO_FILTERS);
  const { sections } = useExerciseSections({ entries, efforts, filters });

  return (
    <div className="flex flex-col gap-4">
      <ExerciseFilterBar entries={entries} value={filters} onChange={setFilters} />
      <ExerciseRows
        sections={sections}
        efforts={efforts}
        onSelect={onSelect}
        selectedKeys={selectedKeys}
        emptyLabel={emptyLabel}
      />
    </div>
  );
}

export { exerciseHref };
