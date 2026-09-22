import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";

import type { Requirement } from "@/lib/academics/requirements";

/**
 * The degree audit as a structure rather than a document (V4 §5.7, Q415).
 *
 * This panel was `VaultDocument` — the generated markdown, rendered as prose. It is the exact
 * case Q130 names: *"the point of this project is to list my ideas; too much read-only text
 * defeats the point"*. What Victor asks the audit is "what is left, and what would satisfy it",
 * and the answer was four hundred lines of nested bullets with the GE course lists inlined.
 *
 * Nothing here is parsed twice. `lib/academics/requirements.ts` already reads this file for the
 * planner (D-187) and is the only parser; this renders what it returns. Changing the generator
 * changes both screens or neither, which is the property that made the planner's parser worth
 * having in the first place.
 *
 * ## What it shows, in order of how often it is asked
 *
 * 1. **How many requirements are met**, as a bar and as a sentence. From the audit's own
 *    frontmatter — `requirements_total` and `requirements_unfulfilled` — so the number agrees
 *    with DARS rather than with our parse of it.
 * 2. **What each open requirement still needs**, as tokens: "8 courses", "12.0 units".
 * 3. **What already counts**, as course chips with the term and the grade. `IP` is in progress.
 * 4. **What would count**, collapsed — the lists run to hundreds of codes and are the reason
 *    this page was unreadable.
 */

export function RequirementProgress({
  requirements,
  total,
  unfulfilled,
}: {
  requirements: Requirement[];
  /** From the audit's frontmatter. Null when a hand-written file has none. */
  total: number | null;
  unfulfilled: number | null;
}) {
  const met = total !== null && unfulfilled !== null ? total - unfulfilled : null;

  // Grouped the way the audit groups them, in first-appearance order. A `Map` rather than a
  // sort: the audit's order is meaningful (major requirements first, GEs last) and re-sorting
  // alphabetically would bury the ones that matter under "FOUNDATIONS OF…".
  const groups = new Map<string, Requirement[]>();
  for (const requirement of requirements) {
    const bucket = groups.get(requirement.group) ?? [];
    bucket.push(requirement);
    groups.set(requirement.group, bucket);
  }

  return (
    <div className="space-y-6">
      {met !== null && total !== null && <Meter met={met} total={total} />}

      {requirements.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The audit lists nothing outstanding. That is either graduation or a parse miss — check the
          file if it is the second.
        </p>
      ) : (
        [...groups].map(([group, list]) => (
          <section key={group}>
            <h3 className="mb-2 eyebrow text-muted-foreground">{shorten(group)}</h3>
            <ul className="space-y-2">
              {list.map((requirement) => (
                <RequirementCard key={requirement.id} requirement={requirement} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/**
 * Met against total, as a bar and as a sentence.
 *
 * `role="progressbar"` with real `aria-*` values rather than a styled div: a bar that a screen
 * reader cannot read is decoration, and this is the one number the panel exists to lead with.
 * The sentence beside it carries the same fact, so the bar is never the only signal (rule 10).
 */
function Meter({ met, total }: { met: number; total: number }) {
  const percent = total > 0 ? Math.round((met / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-foreground">
          <span className="tabular font-semibold">{met}</span> of{" "}
          <span className="tabular">{total}</span> requirements met
        </p>
        <p className="tabular eyebrow text-muted-foreground">{percent}%</p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={met}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Degree requirements met"
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function RequirementCard({ requirement }: { requirement: Requirement }) {
  const needs = [
    requirement.needsCourses !== null
      ? `${requirement.needsCourses} ${requirement.needsCourses === 1 ? "course" : "courses"}`
      : null,
    requirement.needsUnits !== null ? `${requirement.needsUnits} units` : null,
  ].filter(Boolean) as string[];

  return (
    <li className="rounded-lg border border-border bg-card/60 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm leading-snug text-foreground">{shorten(requirement.name)}</p>
        <span className="flex shrink-0 items-center gap-1 text-highlight">
          <CircleDashedIcon aria-hidden className="size-3.5" />
          <span className="tabular eyebrow">{needs.join(" · ") || "open"}</span>
        </span>
      </div>

      {/* 7.1 text-floor allowlist (Q113) on the chips below: a course code, its term and its
          grade, three or four to a row on a phone. The chip is an identifier to match against
          the audit rather than something read as a sentence, and at the floor a requirement
          with eight applied courses stops fitting in the panel. */}
      {requirement.applied.length > 0 && (
        <ul
          data-tiny-text="course chips: code, term and grade, several to a row"
          className="mt-2 flex flex-wrap gap-1.5"
        >
          {requirement.applied.map((course) => (
            <li
              key={`${course.course}-${course.term}`}
              // In progress is not the same as done, and the audit already distinguishes them
              // with the grade `IP`. Doubling that into the border keeps it visible while
              // scanning, and the grade text is what carries it for a reader (rule 10).
              className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.65rem] ${
                course.grade === "IP"
                  ? "border-dashed border-border text-muted-foreground"
                  : "border-primary/40 text-foreground"
              }`}
            >
              {course.grade !== "IP" && (
                <CircleCheckIcon aria-hidden className="size-3 text-primary" />
              )}
              <span className="font-mono">{course.course}</span>
              <span className="text-faint-foreground">
                {course.term}
                {course.grade ? ` · ${course.grade}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* The §7.1 text-floor allowlist (Q113) on the disclosure below. A GE requirement can
          list eighty course codes; they are reference material you open to check one thing,
          not something read in sequence. At the floor the list stops fitting on a phone at
          all, which is a worse answer than small type. */}
      {requirement.selectFrom.length > 0 && (
        <details
          className="group mt-2"
          data-tiny-text="course-code reference list behind a disclosure"
        >
          <summary className="cursor-pointer list-none eyebrow text-muted-foreground transition-colors hover:text-foreground">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90">
              &rsaquo;
            </span>
            What counts · {requirement.selectFrom.length}
            {requirement.truncated ? "+" : ""}
          </summary>
          <p className="mt-2 font-mono text-[0.65rem] leading-relaxed text-muted-foreground">
            {requirement.selectFrom.join(" · ")}
          </p>
          {requirement.truncated && (
            // The generator cuts the GE lists short, and the planner already treats a course
            // in a truncated list as unverifiable rather than invalid (D-187). Saying so here
            // is what stops this panel reading as a complete answer.
            <p className="mt-1 text-[0.65rem] text-highlight">
              The audit&rsquo;s list is longer than this. Anything checked against it is a guess,
              not a verdict.
            </p>
          )}
        </details>
      )}
    </li>
  );
}

/**
 * DARS puts instructions, URLs and whole paragraphs inside a requirement's name.
 *
 * Cut at the first sentence-like break and capped, because the rest is addressed to an adviser
 * rather than to Victor — *"[Declare TBA at: http://my.engineering.ucla.edu] You are responsible
 * to check…"* is 180 characters of heading. The full text stays in the vault file, which is one
 * click away and is the thing to read when a heading is not enough.
 */
function shorten(name: string, limit = 96): string {
  const cut = name.split(/\s+[[(]|\s+You are responsible|:\s+http/)[0].trim();
  if (cut.length <= limit) return cut;
  const space = cut.lastIndexOf(" ", limit);
  return `${cut.slice(0, space > 40 ? space : limit).trim()}…`;
}
