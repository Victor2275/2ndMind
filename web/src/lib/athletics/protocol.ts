/**
 * The training protocol, read out of the vault rather than hard-coded.
 *
 * Victor's SPM targets, rehab protocol and weekly split already live in
 * `context/02_physical_performance/`. Copying them into TypeScript would create a second copy
 * that drifts: he would edit the vault, the site would keep showing last month's programme,
 * and nothing would say which one was right. Parsing means editing the markdown *is* editing
 * the app — no code change, no migration, no deploy.
 *
 * The cost is that a reformat of those files can stop a section parsing. Every function here
 * returns an empty result rather than throwing, and every caller renders "not found in the
 * vault" instead of an empty box, so a parse miss reads as a parse miss.
 *
 * Line-based, not one large regex. The vault is CRLF, `$` under the `m` flag does not match
 * before a `\r`, and the multi-line patterns this would otherwise need have already been a
 * source of silent bugs in this codebase.
 */

/** JS `getDay()` convention: Sunday is 0. Used to line the plan up against logged sessions. */
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type SpmTarget = {
  /** As written in the vault, e.g. "200m Sprints". */
  label: string;
  distanceM: number;
  minSpm: number;
  maxSpm: number;
  /** The parenthetical, e.g. "Maximal explosive power". */
  intent: string;
};

export type RehabItem = {
  /** Stable key for a completion row. Derived from the name, so renaming an item in the
   *  vault orphans its history rather than silently re-attributing it. */
  slug: string;
  name: string;
  /** "3x10 per side" — the prescription, without the parenthetical rationale. */
  prescription: string;
  rationale: string;
};

export type PlannedDay = {
  /** `getDay()` index, so this compares directly against a session date. */
  weekday: number;
  name: string;
  items: string[];
};

export type SplitGoal = {
  /** Seconds per 500 m. */
  targetSplitS: number;
  distanceM: number;
  /** True when the vault says the target is weight-adjusted, which changes the arithmetic. */
  weightAdjusted: boolean;
  /** As written, e.g. "May 2027". */
  milestone: string;
};

function toLines(markdown: string): string[] {
  return markdown.split(/\r?\n/);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Lines belonging to a section, from the line the predicate matches to the next boundary.
 *
 * A boundary is any `#` heading or any line that is nothing but a bold label — which is how
 * the vault separates "Daily Habits:" from "Lower Back Rehab Protocol:" without using
 * headings for either.
 */
function sectionLines(lines: string[], startsAt: (line: string) => boolean): string[] {
  const start = lines.findIndex(startsAt);
  if (start === -1) return [];

  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (/^#{1,6}\s/.test(trimmed)) break;
    if (/^\*\*[^*]+\*\*$/.test(trimmed)) break;
    out.push(lines[i]);
  }
  return out;
}

/**
 * `- **Label:** value` or `- **Label**: value`.
 *
 * The vault uses both — the colon sits inside the bold for the SPM targets and outside it for
 * the rehab items — so both are accepted and the label is normalised.
 */
function bullet(line: string): { label: string; value: string; indent: number } | null {
  const match = /^(\s*)-\s+\*\*([^*]+)\*\*\s*:?\s*(.*)$/.exec(line.replace(/\r$/, ""));
  if (!match) return null;
  return {
    indent: match[1].length,
    label: match[2].trim().replace(/:$/, "").trim(),
    value: match[3].trim(),
  };
}

/** The trailing "(…)" of a bullet, split from the part before it. */
function splitParenthetical(value: string): { head: string; note: string } {
  const match = /^(.*?)\s*\(([^)]*)\)\s*\.?\s*$/.exec(value);
  if (!match) return { head: value.replace(/\.$/, "").trim(), note: "" };
  return { head: match[1].replace(/\.$/, "").trim(), note: match[2].trim() };
}

/**
 * Stroke-rate targets per race distance.
 *
 * Reads `- **200m Sprints:** 80 - 85+ SPM (Maximal explosive power).` The `+` on the upper
 * bound is dropped: "85+" means no ceiling, and a range needs a number to compare against.
 */
export function parseSpmTargets(markdown: string): SpmTarget[] {
  const lines = sectionLines(toLines(markdown), (line) =>
    /^#{2,6}\s+SPM\b/i.test(line.trim()),
  );

  const targets: SpmTarget[] = [];

  for (const line of lines) {
    const parsed = bullet(line);
    if (!parsed) continue;

    const distance = /(\d+(?:\.\d+)?)\s*m\b/i.exec(parsed.label);
    const range = /(\d+)\s*(?:-|–|to)\s*(\d+)/.exec(parsed.value);
    if (!distance || !range) continue;

    const { note } = splitParenthetical(parsed.value);

    targets.push({
      label: parsed.label,
      distanceM: Number(distance[1]),
      minSpm: Number(range[1]),
      maxSpm: Number(range[2]),
      intent: note,
    });
  }

  return targets.sort((a, b) => a.distanceM - b.distanceM);
}

/**
 * The daily lower-back protocol.
 *
 * Reads `- **Pallof Presses**: 3x10 per side (Anti-rotation stiffening).`
 */
export function parseRehabProtocol(markdown: string): RehabItem[] {
  const lines = sectionLines(toLines(markdown), (line) =>
    /^\*\*.*rehab protocol.*\*\*/i.test(line.trim()),
  );

  const items: RehabItem[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const parsed = bullet(line);
    if (!parsed) continue;

    const slug = slugify(parsed.label);
    // Two items that slug the same would share a completion row and tick together.
    if (slug === "" || seen.has(slug)) continue;
    seen.add(slug);

    const { head, note } = splitParenthetical(parsed.value);
    items.push({ slug, name: parsed.label, prescription: head, rationale: note });
  }

  return items;
}

/**
 * The weekly split: which weekday carries which sessions.
 *
 * Top-level bullets name the day, indented bullets underneath list that day's work:
 *
 * ```
 * - **Monday**:
 *   - Solo PERG (High Intensity: …)
 *   - Lower Body & Core Strength
 * ```
 */
export function parseWeeklyPlan(markdown: string): PlannedDay[] {
  const lines = sectionLines(toLines(markdown), (line) =>
    /^#{2,6}\s+Weekly Layout\b/i.test(line.trim()),
  );

  const days: PlannedDay[] = [];
  let current: PlannedDay | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const parsed = bullet(line);

    if (parsed && parsed.indent === 0) {
      const weekday = WEEKDAYS.findIndex(
        (name) => name.toLowerCase() === parsed.label.toLowerCase(),
      );
      // A bold bullet that is not a weekday ends the run rather than being absorbed as a day.
      current = weekday === -1 ? null : { weekday, name: WEEKDAYS[weekday], items: [] };
      if (current) days.push(current);
      continue;
    }

    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && current) {
      const text = item[1].trim();
      if (text !== "") current.items.push(text);
    }
  }

  return days;
}

/** `2:17`, `2:17.4` or `117` as seconds. Shared shape with the erg form's parser. */
function timeToSeconds(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length === 0 || parts.length > 3) return null;

  let seconds = 0;
  for (const part of parts) {
    if (!/^\d+(\.\d+)?$/.test(part.trim())) return null;
    seconds = seconds * 60 + Number(part);
  }
  return seconds > 0 ? seconds : null;
}

/**
 * The headline goal — "Sub-2:00 weight-adjusted 500m split in Dragon Boat."
 *
 * Whether it says "weight-adjusted" is not cosmetic: it decides whether the site compares the
 * raw split or the Concept2-adjusted one against the target, and those differ by about seven
 * seconds at Victor's bodyweight.
 */
export function parseSplitGoal(markdown: string): SplitGoal | null {
  const lines = toLines(markdown);

  let target: string | null = null;
  let milestone = "";

  for (const line of lines) {
    const parsed = bullet(line);
    if (!parsed) continue;
    if (/^target$/i.test(parsed.label)) target = parsed.value;
    if (/milestone/i.test(parsed.label)) milestone = parsed.value.replace(/\.$/, "").trim();
  }

  if (target === null) return null;

  const time = /(?:sub-?\s*)?(\d+:\d+(?:\.\d+)?)/i.exec(target);
  const distance = /(\d+)\s*m\b/i.exec(target);
  const seconds = time ? timeToSeconds(time[1]) : null;
  if (seconds === null || !distance) return null;

  return {
    targetSplitS: seconds,
    distanceM: Number(distance[1]),
    weightAdjusted: /weight[-\s]?adjusted/i.test(target),
    milestone,
  };
}

/**
 * The bodyweight written in the vault, used only until a real reading is logged.
 *
 * Reads `*Current Weight: 215 lbs. Drag Factor: 1.*`. This is a fallback, not a source: once
 * `bodyweight_entries` has a row the database wins, because the vault line is hand-maintained
 * and will go stale.
 */
export function parseVaultBodyweight(markdown: string): number | null {
  const match = /current weight:\s*(\d+(?:\.\d+)?)\s*lbs?/i.exec(markdown);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
