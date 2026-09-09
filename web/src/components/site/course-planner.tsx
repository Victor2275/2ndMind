"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { savePlan } from "@/app/private/academics/plan/actions";
import {
  checkPlan,
  parsePlan,
  termLoads,
  TERMS,
  type Plan,
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

  return (
    <form action={action} className="mt-8 space-y-8">
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">The terms</h2>
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            one course per line · units in brackets
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-5">
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

                {(entry.matched.length > 0 || entry.unverifiable.length > 0) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {entry.matched.length > 0 && (
                      <span>counted: {entry.matched.map((c) => c.course).join(", ")}. </span>
                    )}
                    {entry.unverifiable.length > 0 && (
                      <span>
                        might count: {entry.unverifiable.map((c) => c.course).join(", ")} — the
                        audit&rsquo;s list is truncated, so this is not checked.
                      </span>
                    )}
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
