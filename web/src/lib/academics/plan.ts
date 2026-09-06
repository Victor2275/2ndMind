import { listNames, normaliseCourse, type Requirement } from "@/lib/academics/requirements";

/**
 * The three-year plan, and whether it fits (V3 §5.2, D-187).
 *
 * Stored as `context/01_engineering/course_plan.md` — a vault file, written through the GitHub
 * API like `/now`'s updates. Victor's call, and the reasoning is about lifespan rather than
 * speed: this is a document to read in five years and to see the history of, not a fast-changing
 * time series. Tasks went to Postgres in D-036 for a latency this does not have.
 *
 * ## The file
 *
 *     ## Winter 2027
 *     - COM SCI 111 (4)
 *     - ENGR 183EW (4)
 *
 * Units in brackets, optional. Round-trips through `parsePlan`/`renderPlan` unchanged, so
 * editing it by hand in the repo and editing it in the app are the same thing — which is most
 * of the point of putting it in the vault.
 */

/**
 * Where the plan lives.
 *
 * Here rather than beside the action that writes it: a `"use server"` module may only export
 * async functions, so a constant exported from one fails the production build with "the
 * requested export doesn't exist" — which `npm test` cannot see, because nothing in a test
 * environment enforces the Server Actions contract.
 */
export const PLAN_PATH = "context/01_engineering/course_plan.md";

/** The terms on the track to June 2028, after the one already in progress. */
export const TERMS = [
  "Winter 2027",
  "Spring 2027",
  "Fall 2027",
  "Winter 2028",
  "Spring 2028",
] as const;

export type Term = (typeof TERMS)[number];

export type PlannedCourse = {
  course: string;
  /** UCLA's default is 4; the field exists because seminars and labs are not. */
  units: number;
};

export type Plan = Record<string, PlannedCourse[]>;

/** What a term should carry. UCLA's full-time band is 12–19; 16 is four ordinary courses. */
export const MIN_UNITS = 12;
export const MAX_UNITS = 19;

export function emptyPlan(): Plan {
  return Object.fromEntries(TERMS.map((term) => [term, []]));
}

export function parsePlan(markdown: string): Plan {
  const plan = emptyPlan();
  let term: string | null = null;

  for (const raw of markdown.split(/\r?\n/)) {
    const heading = raw.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const name = heading[1].trim();
      term = (TERMS as readonly string[]).includes(name) ? name : null;
      continue;
    }
    if (!term) continue;

    // The leading `- ` is optional, which is what makes "the file format and the textarea
    // format are the same thing" actually true. The planner's textareas hold one course per
    // line with no bullet; the committed file is markdown and has them. Both parse.
    const line = raw.trim();
    // Blank lines, the empty-term placeholder, comments and headings are not courses. Without
    // this, making the bullet optional turns `_Nothing planned yet._` into a course.
    if (line === "" || line.startsWith("_") || line.startsWith("<!--") || line.startsWith("#")) {
      continue;
    }

    const item = line.match(/^(?:-\s+)?(.+?)\s*(?:\((\d+(?:\.\d+)?)\))?$/);
    if (!item) continue;
    const course = normaliseCourse(item[1]);
    if (course === "") continue;
    plan[term].push({ course, units: item[2] ? Number(item[2]) : 4 });
  }

  return plan;
}

export function renderPlan(plan: Plan, now = new Date()): string {
  const body = TERMS.map((term) => {
    const courses = plan[term] ?? [];
    const lines = courses.map((c) => `- ${c.course} (${c.units})`);
    return [`## ${term}`, "", ...(lines.length > 0 ? lines : ["_Nothing planned yet._"]), ""].join(
      "\n",
    );
  }).join("\n");

  const day = now.toISOString().slice(0, 10);
  return `---
updated: ${day}
domain: engineering
stability: volatile
summary: Planned courses per term on the three-year track to June 2028.
read_when: Course planning, enrollment, what is left to graduate.
---

<!-- Written by the planner at /private/academics/plan. Editing it here by hand is fine —
     the app reads this same file and the two round-trip through each other. -->

# Course Plan

Checked against \`degree_audit.md\`. The audit is the source of what is required; this is only
what is intended, and intending something does not make it offered.

${body}`;
}

/* ------------------------------------------------------------------ the check */

export type Coverage = {
  requirement: Requirement;
  /** Planned courses the requirement's own list names. */
  matched: PlannedCourse[];
  /** Planned courses that *might* count — a truncated list, or a range. */
  unverifiable: PlannedCourse[];
  /** Courses still needed after the plan, where the audit counts courses. */
  coursesShort: number | null;
  /** Units still needed after the plan, where the audit counts units. */
  unitsShort: number | null;
  /** True when nothing is left to do for this requirement, on the plan as written. */
  satisfied: boolean;
};

/**
 * How far the plan gets each outstanding requirement.
 *
 * **A course counts once, for one requirement.** Double-counting is the whole failure mode of a
 * hand-written plan — one elective quietly satisfying three lines and the total coming out four
 * courses short in the term it matters. Assigned in order, most-constrained first: a requirement
 * whose list actually names the course has a stronger claim than one whose list was truncated
 * and might name anything.
 *
 * `unverifiable` is kept separate from `matched` rather than folded in, because the difference
 * is exactly what the screen has to show: *this counts* and *this might count* are different
 * claims, and a planner that renders them the same is telling you it knows something it does
 * not.
 */
export function checkPlan(requirements: Requirement[], plan: Plan): Coverage[] {
  const planned = TERMS.flatMap((term) => plan[term] ?? []);
  const claimed = new Set<PlannedCourse>();

  const coverage: Coverage[] = requirements.map((requirement) => ({
    requirement,
    matched: [],
    unverifiable: [],
    coursesShort: requirement.needsCourses,
    unitsShort: requirement.needsUnits,
    satisfied: false,
  }));

  // Two passes, definite claims first, so a named course is never eaten by a requirement that
  // could have taken anything.
  for (const pass of ["named", "maybe"] as const) {
    for (const entry of coverage) {
      for (const course of planned) {
        if (claimed.has(course)) continue;

        const answer = listNames(entry.requirement, course.course);
        if (pass === "named" ? answer !== true : answer !== null) continue;

        const stillWants =
          (entry.coursesShort ?? 0) > 0 || (entry.unitsShort ?? 0) > 0 || needsNothingYet(entry);
        if (!stillWants) continue;

        claimed.add(course);
        if (pass === "named") entry.matched.push(course);
        else entry.unverifiable.push(course);

        if (entry.coursesShort !== null) entry.coursesShort = Math.max(0, entry.coursesShort - 1);
        if (entry.unitsShort !== null) {
          entry.unitsShort = Math.max(0, entry.unitsShort - course.units);
        }
      }
    }
  }

  for (const entry of coverage) {
    entry.satisfied = (entry.coursesShort ?? 0) === 0 && (entry.unitsShort ?? 0) === 0;
  }

  return coverage;
}

/** A requirement the audit gave neither a course count nor a unit count still wants attention. */
function needsNothingYet(entry: Coverage): boolean {
  return entry.requirement.needsCourses === null && entry.requirement.needsUnits === null;
}

export type TermLoad = {
  term: Term;
  units: number;
  /** "light" below the full-time floor, "heavy" above the cap, "ok" between. */
  verdict: "light" | "ok" | "heavy";
};

export function termLoads(plan: Plan): TermLoad[] {
  return TERMS.map((term) => {
    const units = (plan[term] ?? []).reduce((total, course) => total + course.units, 0);
    return {
      term,
      units,
      // An empty term is not "light" — it is unplanned, and calling it a problem would put a
      // warning on every term of a plan that has not been started yet.
      verdict:
        units === 0 ? "ok" : units < MIN_UNITS ? "light" : units > MAX_UNITS ? "heavy" : "ok",
    };
  });
}
