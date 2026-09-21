/**
 * The Fall 2026 daily-erg challenge, read out of the vault rather than hard-coded.
 *
 * Same argument as `protocol.ts`, which parses the weekly split and the SPM targets: the plan
 * already lives in `context/02_physical_performance/fall_2026_challenge.md`, and a second copy
 * in TypeScript is a copy that drifts. Editing the markdown *is* editing the app — no code
 * change, no migration, no deploy, which matters for a plan that will certainly be rewritten
 * mid-block when a week goes badly.
 *
 * Every function returns an empty result rather than throwing, and every caller renders "not
 * found in the vault" instead of an empty box, so a parse miss reads as a parse miss.
 *
 * Line-based, not one large regex. The vault is CRLF and `$` under the `m` flag does not match
 * before a `\r` — the same trap `protocol.ts` documents.
 */

/** What a day asks of the body. Drives the stretching routine and nothing else in code. */
export type SessionType =
  "base" | "long" | "quality" | "strength" | "water" | "recovery" | "test" | "race" | "epic";

/** Which family of stretching routines a day draws from. */
export type RoutinePool = "recovery" | "base" | "strength" | "long" | "quality" | "water";

const SESSION_TYPES = new Set<string>([
  "base",
  "long",
  "quality",
  "strength",
  "water",
  "recovery",
  "test",
  "race",
  "epic",
]);

/**
 * Session type to routine pool.
 *
 * Nine types collapse onto six pools on purpose: a test, a race and an interval session all
 * want the same ten minutes of dynamic work, and writing fifteen routines to cover nine types
 * evenly would have meant three of them existing only to fill a table.
 */
const POOL_FOR_TYPE: Record<SessionType, RoutinePool> = {
  base: "base",
  long: "long",
  epic: "long",
  quality: "quality",
  test: "quality",
  race: "quality",
  strength: "strength",
  water: "water",
  recovery: "recovery",
};

export type ChallengeDay = {
  /** Day number as written in the vault. Day 0 is the first day, not day 1. */
  day: number;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  /** The bold prefix of the session cell — "Rolling Start", "THE HUNDRED". */
  name: string;
  /** Everything after the em dash. The actual prescription. */
  detail: string;
  type: SessionType;
  meters: number;
  /** Index of the week this day belongs to, matching `ChallengeWeek.index`. */
  week: number;
  /**
   * What the vault said, when a `plan_overrides` row has changed this day.
   *
   * Absent on an untouched day, which is how the UI tells "this is the plan" from "this is what
   * I decided instead" without a second flag that can disagree with the values. Keeping the
   * original is what makes the change reversible in one click and auditable afterwards — the
   * plan file is never rewritten.
   */
  planned?: { name: string; detail: string; type: SessionType; meters: number };
};

export type ChallengeWeek = {
  /** `### Week 4 · The Long Haul` → 4. */
  index: number;
  /** `### Week 4 · The Long Haul` → "The Long Haul". */
  name: string;
  from: string;
  to: string;
  volumeM: number;
  intent: string;
  days: ChallengeDay[];
};

export type RoutineMovement = {
  /** Stable within its routine. Combined with the routine slug to address a completion row. */
  slug: string;
  name: string;
  prescription: string;
  why: string;
};

export type Routine = {
  slug: string;
  /** "The Reset". The `R1 ·` prefix is dropped — it is ordering, not identity. */
  name: string;
  pool: RoutinePool;
  minutes: number;
  movements: RoutineMovement[];
};

export type ChallengeGoal = {
  key: string;
  goal: string;
  target: string;
  /** As written — an ISO date in every current row, but not parsed as one. */
  window: string;
  measuredBy: string;
};

export type Challenge = {
  start: string;
  end: string;
  /** Day count as stated in the vault, not derived from the dates. A mismatch is a vault bug
   *  and `challengeFaults` reports it rather than silently preferring one of the two. */
  days: number;
  averageTargetM: number;
  plannedTotalM: number;
  requiredTotalM: number;
  rules: string[];
  goals: ChallengeGoal[];
  weeks: ChallengeWeek[];
  routines: Routine[];
};

/* ------------------------------------------------------------------ primitives */

function toLines(markdown: string): string[] {
  return markdown.split(/\r?\n/).map((line) => line.replace(/\r$/, ""));
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Heading level of a line, or 0 when it is not a heading. */
function headingLevel(line: string): number {
  const match = /^(#{1,6})\s/.exec(line.trim());
  return match ? match[1].length : 0;
}

/**
 * Lines under the first heading matching `startsAt`, up to the next heading of the same or a
 * shallower level.
 *
 * Level-aware rather than "until the next `#`", because §4's week sections are `###` nested
 * under a `##` and a naive scan would stop at the first one.
 */
function sectionLines(lines: string[], startsAt: (line: string) => boolean): string[] {
  const start = lines.findIndex(startsAt);
  if (start === -1) return [];

  const level = headingLevel(lines[start]);
  const out: string[] = [];

  for (let i = start + 1; i < lines.length; i += 1) {
    const found = headingLevel(lines[i]);
    if (found > 0 && found <= level) break;
    out.push(lines[i]);
  }
  return out;
}

/** Every `### …` heading index inside a run of lines, with its text. */
function subHeadings(lines: string[], level: number): { index: number; text: string }[] {
  const out: { index: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (headingLevel(lines[i]) !== level) continue;
    out.push({ index: i, text: lines[i].trim().slice(level).trim() });
  }
  return out;
}

/** `- **Label**: value` or `- **Label:** value`. Both spellings appear in the vault. */
function bullet(line: string): { label: string; value: string } | null {
  const match = /^\s*-\s+\*\*([^*]+)\*\*\s*:?\s*(.*)$/.exec(line);
  if (!match) return null;
  return { label: match[1].trim().replace(/:$/, "").trim(), value: match[2].trim() };
}

function bulletValue(lines: string[], label: string): string {
  for (const line of lines) {
    const parsed = bullet(line);
    if (parsed && parsed.label.toLowerCase() === label.toLowerCase()) return parsed.value;
  }
  return "";
}

/**
 * Body rows of every pipe table in a run of lines, header and separator dropped.
 *
 * Separator detection is by shape (`---`, `:--`, `--:`) rather than by position, because the
 * header row is identified the same way — the row *before* the first separator — and keying
 * both off position would break the moment a table gained a blank line.
 */
function tableRows(lines: string[]): string[][] {
  const rows: string[][] = [];
  let sawSeparator = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("|")) {
      // A blank line between two tables ends the first one, so the next header is dropped too.
      if (line === "") sawSeparator = false;
      continue;
    }

    const inner = line.replace(/^\|/, "").replace(/\|$/, "");
    const cells = inner.split("|").map((cell) => cell.trim());

    if (cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell))) {
      sawSeparator = true;
      // Drop the header row this separator belongs to.
      rows.pop();
      continue;
    }

    if (!sawSeparator) {
      // Header candidate. Kept for now; the separator below it pops it back off.
      rows.push(cells);
      continue;
    }

    rows.push(cells);
  }

  return rows;
}

/** `12500 m`, `12,500` or `12500` as a number. Returns 0 rather than NaN. */
function meters(value: string): number {
  const match = /(-?[\d,]+(?:\.\d+)?)/.exec(value.replace(/\s/g, ""));
  if (!match) return 0;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

const ISO_DATE = /\d{4}-\d{2}-\d{2}/;

function isoDate(value: string): string {
  const match = ISO_DATE.exec(value);
  return match ? match[0] : "";
}

/* --------------------------------------------------------------------- parsing */

/**
 * `**Rolling Start** — 10k Z2, rate 20.` into its two halves.
 *
 * The em dash is the separator and an ordinary hyphen is not, deliberately: prescriptions
 * contain hyphens ("2:15-2:25") and splitting on those would cut a session in half.
 */
function splitSession(cell: string): { name: string; detail: string } {
  const match = /^\*\*(.+?)\*\*\s*[—–]\s*(.*)$/.exec(cell.trim());
  if (match) return { name: match[1].trim(), detail: match[2].trim() };

  const bold = /^\*\*(.+?)\*\*\s*(.*)$/.exec(cell.trim());
  if (bold) return { name: bold[1].trim(), detail: bold[2].trim() };

  return { name: "", detail: cell.trim() };
}

/** `Week 4 · The Long Haul` → `{ index: 4, name: "The Long Haul" }`. */
function splitWeekHeading(text: string): { index: number; name: string } | null {
  const match = /^Week\s+(\d+)\s*(?:[·•|-]\s*(.*))?$/i.exec(text.trim());
  if (!match) return null;
  return { index: Number(match[1]), name: (match[2] ?? "").trim() };
}

/** `R1 · The Reset — \`the-reset\`` → name and slug. */
function splitRoutineHeading(text: string): { name: string; slug: string } | null {
  const match = /^R\d+\s*[·•|-]\s*(.+?)\s*[—–]\s*`([a-z0-9-]+)`\s*$/i.exec(text.trim());
  if (!match) return null;
  return { name: match[1].trim(), slug: match[2] };
}

function parseDays(lines: string[], week: number): ChallengeDay[] {
  const days: ChallengeDay[] = [];

  for (const cells of tableRows(lines)) {
    if (cells.length < 5) continue;

    const day = Number(cells[0]);
    const date = isoDate(cells[1]);
    const type = cells[3].toLowerCase();

    // A row is a day row only if all three of these hold. This is what keeps the week's own
    // prose tables — if one is ever added — from being absorbed as days.
    if (!Number.isInteger(day) || date === "" || !SESSION_TYPES.has(type)) continue;

    const { name, detail } = splitSession(cells[2]);
    days.push({
      day,
      date,
      name,
      detail,
      type: type as SessionType,
      meters: meters(cells[4]),
      week,
    });
  }

  return days.sort((a, b) => a.day - b.day);
}

export function parseWeeks(markdown: string): ChallengeWeek[] {
  const lines = toLines(markdown);
  const body = sectionLines(lines, (line) => /^##\s+\d*\.?\s*The Days\b/i.test(line.trim()));
  if (body.length === 0) return [];

  const headings = subHeadings(body, 3);
  const weeks: ChallengeWeek[] = [];

  for (let i = 0; i < headings.length; i += 1) {
    const parsed = splitWeekHeading(headings[i].text);
    if (!parsed) continue;

    const end = i + 1 < headings.length ? headings[i + 1].index : body.length;
    const block = body.slice(headings[i].index + 1, end);
    const dates = bulletValue(block, "Dates");

    weeks.push({
      index: parsed.index,
      name: parsed.name,
      from: isoDate(dates),
      to: isoDate(dates.slice(dates.indexOf(isoDate(dates)) + 10)),
      volumeM: meters(bulletValue(block, "Volume")),
      intent: bulletValue(block, "Intent"),
      days: parseDays(block, parsed.index),
    });
  }

  return weeks.sort((a, b) => a.index - b.index);
}

export function parseRoutines(markdown: string): Routine[] {
  const lines = toLines(markdown);
  const body = sectionLines(lines, (line) =>
    /^##\s+\d*\.?\s*Stretching Routines\b/i.test(line.trim()),
  );
  if (body.length === 0) return [];

  const headings = subHeadings(body, 3);
  const routines: Routine[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < headings.length; i += 1) {
    const parsed = splitRoutineHeading(headings[i].text);
    if (!parsed) continue;
    // Two routines sharing a slug would share every completion row and tick together.
    if (seen.has(parsed.slug)) continue;
    seen.add(parsed.slug);

    const end = i + 1 < headings.length ? headings[i + 1].index : body.length;
    const block = body.slice(headings[i].index + 1, end);

    const pool = bulletValue(block, "Pool").toLowerCase();
    if (!isPool(pool)) continue;

    const movements: RoutineMovement[] = [];
    const usedSlugs = new Set<string>();

    for (const cells of tableRows(block)) {
      if (cells.length < 2) continue;
      const name = cells[0];
      if (name === "") continue;

      let slug = slugify(name);
      if (slug === "") continue;
      // Two movements in one routine that slug the same would tick together. Suffix rather
      // than drop: both are real prescriptions and losing one silently is worse.
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${slugify(name)}-${suffix}`;
        suffix += 1;
      }
      usedSlugs.add(slug);

      movements.push({
        slug,
        name,
        prescription: cells[1] ?? "",
        why: cells[2] ?? "",
      });
    }

    routines.push({
      slug: parsed.slug,
      name: parsed.name,
      pool,
      minutes: Number(meters(bulletValue(block, "Minutes"))) || 10,
      movements,
    });
  }

  return routines;
}

function isPool(value: string): value is RoutinePool {
  return (
    value === "recovery" ||
    value === "base" ||
    value === "strength" ||
    value === "long" ||
    value === "quality" ||
    value === "water"
  );
}

export function parseGoals(markdown: string): ChallengeGoal[] {
  const lines = toLines(markdown);
  const body = sectionLines(lines, (line) => /^##\s+\d*\.?\s*Goals\b/i.test(line.trim()));

  const goals: ChallengeGoal[] = [];
  for (const cells of tableRows(body)) {
    if (cells.length < 5) continue;
    const key = cells[0];
    if (key === "" || /^key$/i.test(key)) continue;
    goals.push({
      key,
      goal: cells[1],
      target: cells[2],
      window: cells[3],
      measuredBy: cells[4],
    });
  }
  return goals;
}

export function parseChallenge(markdown: string): Challenge | null {
  const lines = toLines(markdown);
  const head = sectionLines(lines, (line) => /^##\s+\d*\.?\s*The Challenge\b/i.test(line.trim()));
  if (head.length === 0) return null;

  const start = isoDate(bulletValue(head, "Start"));
  const end = isoDate(bulletValue(head, "End"));
  if (start === "" || end === "") return null;

  const rulesBlock = sectionLines(head, (line) => /^###\s+Rules\b/i.test(line.trim()));
  const rules: string[] = [];
  for (const line of rulesBlock) {
    const parsed = bullet(line);
    if (parsed) rules.push(`${parsed.label}: ${parsed.value}`);
  }

  return {
    start,
    end,
    days: meters(bulletValue(head, "Days")),
    averageTargetM: meters(bulletValue(head, "Average target")),
    plannedTotalM: meters(bulletValue(head, "Planned total")),
    requiredTotalM: meters(bulletValue(head, "Required total")),
    rules,
    goals: parseGoals(markdown),
    weeks: parseWeeks(markdown),
    routines: parseRoutines(markdown),
  };
}

/* -------------------------------------------------------------------- overrides */

/**
 * One day of the plan, changed from the app.
 *
 * Every field is nullable and null means "leave the vault's value alone", so swapping a Sunday
 * from water to erg without touching the distance is one column, not a full copy of the row.
 */
export type PlanOverride = {
  /** ISO day, `YYYY-MM-DD`. The key — one override per day. */
  date: string;
  name: string | null;
  detail: string | null;
  type: SessionType | null;
  meters: number | null;
  /** Why it changed. Free text, shown on the plan screen, never parsed. */
  note: string;
};

export function isSessionType(value: string): value is SessionType {
  return SESSION_TYPES.has(value);
}

/**
 * The plan as Victor actually intends to do it.
 *
 * Returns a new `Challenge`; the parsed one is never mutated, because two things still need the
 * vault's own numbers. **`challengeFaults` must be run on the original**, since it checks the
 * day rows against the totals stated in §1 and an override is precisely a deliberate
 * disagreement with them — running it on the merged plan would report every edit as a vault bug.
 * The `planned` field on each changed day carries the original values for the UI.
 *
 * Order matters at the call site: this runs *before* `assignRoutines`, so changing a day's type
 * changes that day's stretching routine, and before `challengeProgress`, so the planned metres
 * reflect the edit.
 */
export function applyOverrides(
  challenge: Challenge,
  overrides: Map<string, PlanOverride>,
): Challenge {
  if (overrides.size === 0) return challenge;

  const weeks = challenge.weeks.map((week) => ({
    ...week,
    days: week.days.map((day) => {
      const override = overrides.get(day.date);
      if (!override) return day;

      const next: ChallengeDay = {
        ...day,
        name: override.name ?? day.name,
        detail: override.detail ?? day.detail,
        type: override.type ?? day.type,
        meters: override.meters ?? day.meters,
      };

      // An override row that changes nothing — every column null — is not an override. Without
      // this the UI would badge a day as changed because a note was left on it.
      const changed =
        next.name !== day.name ||
        next.detail !== day.detail ||
        next.type !== day.type ||
        next.meters !== day.meters;

      if (!changed) return day;

      return {
        ...next,
        planned: { name: day.name, detail: day.detail, type: day.type, meters: day.meters },
      };
    }),
  }));

  return { ...challenge, weeks };
}

/* ------------------------------------------------------------------- day lookup */

/** Every day across every week, in day order. */
export function allDays(challenge: Challenge): ChallengeDay[] {
  return challenge.weeks.flatMap((week) => week.days).sort((a, b) => a.day - b.day);
}

export function dayFor(challenge: Challenge, isoDay: string): ChallengeDay | null {
  for (const week of challenge.weeks) {
    for (const day of week.days) if (day.date === isoDay) return day;
  }
  return null;
}

/* --------------------------------------------------------------------- routines */

/**
 * Which routine each day draws, keyed by day number.
 *
 * Deterministic and computed rather than written into the vault, so the plan file does not
 * carry 76 hand-made assignments that can silently disagree with the pool table. A day takes
 * the *n*th routine of its pool, where *n* counts how many days of that pool came before it —
 * each pool cycling in vault order across the whole challenge.
 *
 * **Two cheaper-looking schemes were tried and both broke the thing this is for.** Indexing by
 * `day.day % poolSize` is local to a day, but the strength sessions are Tuesday and Friday —
 * three apart — and the strength pool held three routines, so *every* week handed both lifting
 * days the same routine. Restarting the count each week fixed that and put a collision on the
 * week boundary instead: week 7's recovery rotation ended on the index week 8 began at, so
 * 8 November and 9 November drew the same routine on consecutive days. The running count has
 * neither fault, and `challenge.test.ts` asserts both properties directly rather than trusting
 * this note.
 *
 * **What the running count costs**, and it is a real cost: a day's routine depends on every
 * earlier day of its pool, so changing a day's `Type` (D-276) reshuffles the assignment of
 * every *later* day of the pools involved. For today and the future that is harmless. For a day
 * already past it means its completion rows, which are keyed by routine slug, no longer match
 * the routine the page now shows — the ticks are not lost, but that day reads as undone in the
 * fortnight strip. Editing the past is the rare case and the damage is cosmetic, which is why
 * it loses to a rotation that never repeats itself in a week.
 *
 * **Pool sizes are load-bearing.** Each must be at least as large as the most days of that pool
 * any single week holds, or a routine repeats inside that week however it is indexed. §6 of the
 * plan file states both numbers side by side and a test enforces the relation.
 */
export function assignRoutines(challenge: Challenge): Map<number, Routine> {
  const byPool = new Map<RoutinePool, Routine[]>();
  for (const routine of challenge.routines) {
    const list = byPool.get(routine.pool) ?? [];
    list.push(routine);
    byPool.set(routine.pool, list);
  }

  const seen = new Map<RoutinePool, number>();
  const out = new Map<number, Routine>();

  for (const day of allDays(challenge)) {
    const pool = POOL_FOR_TYPE[day.type];
    const list = byPool.get(pool);
    if (!list || list.length === 0) continue;

    const index = seen.get(pool) ?? 0;
    seen.set(pool, index + 1);
    out.set(day.day, list[index % list.length]);
  }

  return out;
}

export function routineFor(challenge: Challenge, day: ChallengeDay): Routine | null {
  return assignRoutines(challenge).get(day.day) ?? null;
}

/**
 * The completion slug for one movement.
 *
 * Namespaced by routine, so the same movement in two routines is two rows — ticking the
 * hamstring floss inside `the-reset` must not silently tick it inside `hinge-prep` on a day
 * that never asked for it. It also keeps these rows from colliding with the old rehab-protocol
 * slugs still in the table, which carry no slash.
 */
export function movementSlug(routine: Routine, movement: RoutineMovement): string {
  return `${routine.slug}/${movement.slug}`;
}

/* --------------------------------------------------------------------- progress */

export type ChallengeProgress = {
  /** Day number for `today`, or null when today is outside the challenge window. */
  today: number | null;
  /** Days counted so far, inclusive of today. Clamped to the challenge length. */
  daysElapsed: number;
  daysTotal: number;
  daysRemaining: number;
  /** Metres actually logged inside the window. */
  loggedM: number;
  /** What rule 2 asks for across the whole challenge. */
  requiredTotalM: number;
  /** `averageTargetM × daysElapsed` — the pace line, not a rule. */
  paceM: number;
  /** Logged minus pace. Positive is ahead. */
  bankM: number;
  /** Metres per remaining day needed to finish at the average. Zero once it is already met. */
  neededPerDayM: number;
  /** What the plan file prescribes from the start through today. */
  plannedToDateM: number;
  /** Consecutive days ending today (or yesterday, if nothing is logged yet today). */
  streak: number;
  /** Longest run of consecutive logged days inside the window. */
  longestStreak: number;
};

/** `YYYY-MM-DD` in UTC. Matches how `trends.ts` keys a day. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, delta: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return isoDay(date);
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Metres logged per local day, from the same `Effort[]` every other athletics panel reads.
 *
 * Local day, not UTC: a 7pm session in Los Angeles is already tomorrow in UTC, and keying on
 * that would file half of Victor's training on the wrong day of the challenge and break the
 * streak roughly every other evening.
 */
export function metersByDay(
  efforts: readonly { performedAt: Date; distanceM: number | null }[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const effort of efforts) {
    const distance = effort.distanceM ?? 0;
    if (distance <= 0) continue;
    // `en-CA` is ISO order, and the local time zone is the one the athlete was standing in.
    const day = effort.performedAt.toLocaleDateString("en-CA");
    out.set(day, (out.get(day) ?? 0) + distance);
  }
  return out;
}

/**
 * Rule 4 — a boat practice counts as 5,000 m.
 *
 * Applied here rather than inside `challengeProgress` so the raw total stays inspectable: this
 * function only ever *raises* a day that already has something logged, and never invents a day
 * out of nothing. A practice logged as duration with no distance is the normal case (the team
 * does not publish metres), and without this the streak would hold while the ledger quietly
 * lost 5k a weekend.
 *
 * `race` days take the credit too. The Cup is 500 m of racing across a day of marshalling, and
 * crediting it as a practice is what the challenge's own rules imply.
 */
export function applyPracticeCredit(
  challenge: Challenge,
  logged: Map<string, number>,
  creditM: number,
): Map<string, number> {
  const credited = new Map(logged);

  for (const day of allDays(challenge)) {
    if (day.type !== "water" && day.type !== "race") continue;
    const actual = credited.get(day.date);
    if (actual === undefined) continue;
    if (actual < creditM) credited.set(day.date, creditM);
  }

  return credited;
}

/**
 * Where the challenge stands.
 *
 * `metersByDay` is the caller's, not read here, because two callers want it from different
 * sources — the athletics page from `workout_sets`, the offline shell from the mirror — and
 * a query inside this function would make it unusable in the second.
 *
 * **Boat practice credit is the caller's job too.** Rule 4 credits a practice with 5,000 m and
 * a water session frequently logs fewer (or none, when it is logged as duration only). Folding
 * that rule in here would mean this function silently inflating a real number, which is exactly
 * what `AsOf` and the rest of the app are built not to do.
 */
export function challengeProgress(
  challenge: Challenge,
  metersByDay: Map<string, number>,
  now: Date,
): ChallengeProgress {
  const daysTotal =
    challenge.days > 0 ? challenge.days : daysBetween(challenge.start, challenge.end) + 1;
  const today = isoDay(now);

  const offset = daysBetween(challenge.start, today);
  const inWindow = offset >= 0 && offset < daysTotal;
  const daysElapsed = Math.max(0, Math.min(offset + 1, daysTotal));
  const daysRemaining = Math.max(0, daysTotal - daysElapsed);

  let loggedM = 0;
  let longestStreak = 0;
  let run = 0;

  for (let i = 0; i < daysElapsed; i += 1) {
    const iso = addDays(challenge.start, i);
    const value = metersByDay.get(iso) ?? 0;
    loggedM += value;
    run = value > 0 ? run + 1 : 0;
    if (run > longestStreak) longestStreak = run;
  }

  // Today not being logged yet must not read as a broken streak at 9am. Walk back from
  // yesterday in that case; a genuinely missed day shows up tomorrow either way.
  let cursor = (metersByDay.get(today) ?? 0) > 0 ? today : addDays(today, -1);
  let streak = 0;
  while (daysBetween(challenge.start, cursor) >= 0 && (metersByDay.get(cursor) ?? 0) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const requiredTotalM =
    challenge.requiredTotalM > 0 ? challenge.requiredTotalM : challenge.averageTargetM * daysTotal;

  const plannedToDateM = allDays(challenge)
    .filter((day) => daysBetween(challenge.start, day.date) < daysElapsed)
    .reduce((sum, day) => sum + day.meters, 0);

  const shortfall = Math.max(0, requiredTotalM - loggedM);

  return {
    today: inWindow ? offset : null,
    daysElapsed,
    daysTotal,
    daysRemaining,
    loggedM,
    requiredTotalM,
    paceM: challenge.averageTargetM * daysElapsed,
    bankM: loggedM - challenge.averageTargetM * daysElapsed,
    neededPerDayM: daysRemaining > 0 ? Math.ceil(shortfall / daysRemaining) : shortfall,
    plannedToDateM,
    streak,
    longestStreak,
  };
}

/**
 * Vault problems worth naming on screen.
 *
 * A plan that silently loses a week is worse than one that says it has. These are the three
 * mistakes an edit to the markdown actually makes: a day row dropped, a stated total that no
 * longer matches the rows, and a routine pool with nothing in it.
 */
export function challengeFaults(challenge: Challenge): string[] {
  const faults: string[] = [];
  const days = allDays(challenge);

  const expected = challenge.days > 0 ? challenge.days : days.length;
  if (days.length !== expected) {
    faults.push(`${days.length} day rows in §4, but §1 says ${expected} days.`);
  }

  for (let i = 1; i < days.length; i += 1) {
    if (days[i].day !== days[i - 1].day + 1) {
      faults.push(`Day numbering jumps from ${days[i - 1].day} to ${days[i].day}.`);
      break;
    }
    if (days[i].date !== addDays(days[i - 1].date, 1)) {
      faults.push(`Dates jump from ${days[i - 1].date} to ${days[i].date}.`);
      break;
    }
  }

  const planned = days.reduce((sum, day) => sum + day.meters, 0);
  if (challenge.plannedTotalM > 0 && planned !== challenge.plannedTotalM) {
    faults.push(
      `Day rows total ${planned.toLocaleString()} m, but §1 claims ${challenge.plannedTotalM.toLocaleString()} m.`,
    );
  }

  const pools = new Set(challenge.routines.map((routine) => routine.pool));
  for (const type of Object.keys(POOL_FOR_TYPE) as SessionType[]) {
    const pool = POOL_FOR_TYPE[type];
    if (days.some((day) => day.type === type) && !pools.has(pool)) {
      faults.push(`No routine in the "${pool}" pool, which ${type} days need.`);
    }
  }

  return faults;
}
