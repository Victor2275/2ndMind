"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckIcon, CircleHelpIcon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { savePlan } from "@/app/private/academics/plan/actions";
import {
  checkPlan,
  parsePlan,
  termLoads,
  TERMS,
  type Plan,
  type TermLoad,
  MAX_UNITS,
  MIN_UNITS,
} from "@/lib/academics/plan";
import type { Requirement } from "@/lib/academics/requirements";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * The three-year plan, and whether it fits (V3 §5.2, D-187).
 *
 * **A checker, not a suggester.** Victor's call. It never proposes a schedule, because it does
 * not know what is offered when, what the prerequisites are, or what he wants to take — none of
 * which is in the DARS audit. A draft built from what it *does* know would be confidently wrong
 * in ways that take longer to unpick than to write from scratch.
 *
 * So it answers exactly one question, continuously: **on this plan, what is still outstanding by
 * June 2028, and is any term overloaded?**
 *
 * ## Why a textarea per term
 *
 * Drag-and-drop was the obvious alternative and is worse here. This is a sit-down activity a
 * handful of times a year, on a laptop, and the fastest way to move eight courses around is to
 * edit text. It is also the same format the vault file stores, so what is on screen and what is
 * committed are the same thing — nothing has to be translated, and a hand-edit in the repo shows
 * up here unchanged.
 *
 * Nothing sensitive may appear in this file; it compiles into `/_next/static/chunks/`. The
 * requirements arrive as props, read on the server from the vault.
 */

/**
 * The plan, as a table (§5.7, Q416).
 *
 * One row per term, with the courses as chips rather than a comma sentence — "COM SCI 111,
 * EC ENGR 115C, ENGR 183EW" on a 360px screen wraps into a paragraph and stops being scannable,
 * which is the whole reason this is a table and not the vault file.
 *
 * The verdict is a word, not a colour: a term is "heavy", "light" or nothing at all. `Q72`'s
 * rule, and here it is also the only honest rendering — "light" on an empty term would be a
 * warning about a term nobody has planned yet, which is why `termLoads` calls that `ok`.
 */
function PlanTable({ plan, loads }: { plan: Plan; loads: TermLoad[] }) {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg border border-border bg-card/60 text-left">
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="px-3 py-2 eyebrow text-muted-foreground">
            Term
          </th>
          <th scope="col" className="px-3 py-2 eyebrow text-muted-foreground">
            Planned
          </th>
          <th scope="col" className="px-3 py-2 text-right eyebrow text-muted-foreground">
            Units
          </th>
        </tr>
      </thead>
      <tbody>
        {TERMS.map((term) => {
          const courses = plan[term] ?? [];
          const load = loads.find((l) => l.term === term);
          return (
            <tr key={term} className="border-b border-border align-top last:border-b-0">
              <th scope="row" className="px-3 py-2.5 text-sm font-medium whitespace-nowrap">
                {term}
              </th>
              <td className="px-3 py-2.5">
                {courses.length === 0 ? (
                  <span className="text-xs text-faint-foreground">nothing planned</span>
                ) : (
                  <ul className="flex flex-wrap gap-1">
                    {courses.map((course) => (
                      <li
                        key={course.course}
                        className="rounded border border-border px-1.5 py-0.5 font-mono text-[0.65rem] text-foreground"
                      >
                        {course.course}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              {/* Right-aligned and tabular (Q239): these are numbers to compare down a column. */}
              <td className="px-3 py-2.5 text-right">
                <span className="tabular text-sm text-foreground">{load?.units ?? 0}</span>
                {load?.verdict !== "ok" && (
                  <span className="block eyebrow text-highlight">{load?.verdict}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function toText(plan: Plan, term: string): string {
  return (plan[term] ?? []).map((c) => `${c.course} (${c.units})`).join("\n");
}

export function CoursePlanner({
  requirements,
  initial,
}: {
  requirements: Requirement[];
  initial: Plan;
}) {
  const [state, action] = useActionState<ActionState | null, FormData>(savePlan, null);
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(TERMS.map((term) => [term, toText(initial, term)])),
  );

  // Re-checked on every keystroke, from the text rather than from saved state: the whole value
  // of this screen is that the answer moves while you are still deciding.
  const plan = useMemo(
    () => parsePlan(TERMS.map((term) => `## ${term}\n\n${text[term] ?? ""}`).join("\n\n")),
    [text],
  );
  const coverage = useMemo(() => checkPlan(requirements, plan), [requirements, plan]);
  const loads = useMemo(() => termLoads(plan), [plan]);

  const outstanding = coverage.filter((entry) => !entry.satisfied);

  /**
   * On a phone this is a **table** until you ask to edit it (§5.7, Q416).
   *
   * D-187 made this screen desktop-only on purpose — planning three years of courses is a
   * sit-down activity with a keyboard — but "desktop-only" was implemented as five stacked
   * textareas, which is the worst of both: unusable for editing *and* unreadable for checking.
   * Q416 asks for a board on a desktop and a table on a phone, and that is what a phone is for
   * here: reading the plan you made on a laptop.
   *
   * Editing is still reachable in one tap, because taking it away would be a regression
   * dressed up as a decision.
   */
  const [editing, setEditing] = useState(false);

  return (
    <form action={action} className="mt-8 space-y-8">
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">The terms</h2>
          <span className="phone-hidden font-mono text-[0.65rem] text-muted-foreground">
            one course per line · units in brackets
          </span>
          <button
            type="button"
            onClick={() => setEditing((current) => !current)}
            aria-pressed={editing}
            className="min-h-11 press rounded-control border border-border px-3 text-xs text-muted-foreground transition-colors duration-fast ease-standard hover:border-primary/50 hover:text-foreground lg:hidden"
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>

        {/* The table. Below `lg` only, and only while not editing. */}
        <div className={`mt-4 ${editing ? "hidden" : "lg:hidden"}`}>
          <PlanTable plan={plan} loads={loads} />
        </div>

        <div className={`mt-4 gap-4 lg:grid lg:grid-cols-5 ${editing ? "grid" : "hidden"}`}>
          {TERMS.map((term) => {
            const load = loads.find((l) => l.term === term);
            return (
              <div key={term} className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{term}</h3>
                  <span
                    className={`tabular font-mono text-[0.65rem] ${
                      load?.verdict === "heavy"
                        ? "text-destructive"
                        : load?.verdict === "light"
                          ? "text-highlight"
                          : "text-muted-foreground"
                    }`}
                    // The band is stated rather than left to be inferred from a colour.
                    title={`Full-time is ${MIN_UNITS}–${MAX_UNITS} units`}
                  >
                    {load?.units ?? 0}u
                  </span>
                </div>

                <textarea
                  name={`term:${term}`}
                  value={text[term] ?? ""}
                  onChange={(event) =>
                    setText((current) => ({ ...current, [term]: event.target.value }))
                  }
                  rows={6}
                  spellCheck={false}
                  aria-label={`Courses planned for ${term}`}
                  placeholder={"COM SCI 111 (4)"}
                  className="mt-3 w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 font-mono text-xs text-foreground transition-colors focus:border-primary/60 focus:outline-none"
                />

                {load?.verdict === "heavy" && (
                  <p className="mt-2 font-mono text-[0.6rem] text-destructive">
                    over {MAX_UNITS} units
                  </p>
                )}
                {load?.verdict === "light" && (
                  <p className="mt-2 font-mono text-[0.6rem] text-highlight">
                    under {MIN_UNITS} units
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {outstanding.length === 0
              ? "Everything is covered by this plan"
              : `Still outstanding · ${outstanding.length}`}
          </h2>
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            against the audit of {requirements.length} open requirements
          </span>
        </div>

        {outstanding.length === 0 ? (
          <p className="mt-4 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm text-foreground">
            On this plan every outstanding requirement is met by June 2028. That is a claim about
            the audit, not about what will be offered — and anything marked <em>might count</em>{" "}
            below is doing work the audit could not confirm.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {outstanding.map((entry) => (
              <li
                key={entry.requirement.id}
                className="rounded-lg border border-border bg-card/60 px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-foreground">{entry.requirement.name}</span>
                  <span className="tabular shrink-0 font-mono text-[0.65rem] text-highlight">
                    {[
                      entry.coursesShort ? `${entry.coursesShort} course` : null,
                      entry.unitsShort ? `${entry.unitsShort}u` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "unmet"}
                  </span>
                </div>

                <p className="mt-1 eyebrow text-muted-foreground">{entry.requirement.group}</p>

                {/* Q417 — what is **counted** and what merely **might count** are different
                    kinds of claim, and they were one sentence in the same grey.

                    D-187 made the distinction in logic: a course in a truncated audit list is
                    accepted as unverifiable rather than rejected, because a checker that is
                    wrong about what is allowed is worse than one that admits its limits. That
                    reasoning was invisible on screen. A solid token with a tick is a course the
                    audit names; a dashed token with a question mark is one it could not confirm,
                    and the sentence under it says why. */}
                {(entry.matched.length > 0 || entry.unverifiable.length > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {entry.matched.map((course) => (
                      <span
                        key={`counted-${course.course}`}
                        className="flex items-center gap-1 rounded border border-primary/40 px-1.5 py-0.5 font-mono text-[0.65rem] text-foreground"
                      >
                        <CheckIcon aria-hidden className="size-3 text-primary" />
                        {course.course}
                      </span>
                    ))}
                    {entry.unverifiable.map((course) => (
                      <span
                        key={`maybe-${course.course}`}
                        title="The audit's list of acceptable courses is truncated, so this one could not be checked."
                        className="flex items-center gap-1 rounded border border-dashed border-highlight/50 px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground"
                      >
                        <CircleHelpIcon aria-hidden className="size-3 text-highlight" />
                        {course.course}
                        <span className="eyebrow">unchecked</span>
                      </span>
                    ))}
                  </div>
                )}

                {entry.unverifiable.length > 0 && (
                  <p className="mt-1.5 text-[0.65rem] text-muted-foreground">
                    Marked <span className="text-highlight">unchecked</span> because the
                    audit&rsquo;s own list of acceptable courses is cut short — this plan may be
                    fine, and this screen cannot say so.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state && (
          <span
            role="status"
            className={`font-mono text-xs ${state.ok ? "text-primary" : "text-destructive"}`}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-10 rounded-md border border-primary/50 px-4 text-sm text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "Committing…" : "Save to the vault"}
    </button>
  );
}
