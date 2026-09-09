"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { approveGoals, proposeGoals } from "@/app/private/goals/actions";
import type { ActionState } from "@/lib/sprint-goals";
import type { ProposalState } from "@/lib/proposals/types";

/**
 * "The model proposes, Victor approves."
 *
 * Two forms, deliberately. Drafting and approving are separate round trips with a human
 * decision between them — collapsing them into one submit is exactly the thing this surface
 * exists to prevent.
 *
 * Nothing sensitive is hard-coded here; this compiles into `/_next/static/chunks/`, which is
 * served without authentication. Everything shown arrives at render time from the actions.
 */

function DraftButton({ hasProposal }: { hasProposal: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:opacity-60"
    >
      {pending ? "Thinking…" : hasProposal ? "Draft again" : "Draft next week"}
    </button>
  );
}

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save approved"}
    </button>
  );
}

export function ProposalReview() {
  const [draft, draftAction] = useActionState<ProposalState | null, FormData>(proposeGoals, null);
  const [saved, saveAction] = useActionState<ActionState | null, FormData>(approveGoals, null);

  const proposal = draft?.proposal;

  return (
    <div className="space-y-4">
      <form action={draftAction} className="flex flex-wrap items-center gap-3">
        <DraftButton hasProposal={Boolean(proposal)} />
        {draft && !draft.ok && (
          <p role="status" className="text-xs text-muted-foreground">
            {draft.message}
          </p>
        )}
      </form>

      {proposal && (
        // Keyed on the draft's timestamp so a re-draft resets every checkbox and textarea.
        // Without it, the boxes ticked against the previous proposal would still be ticked
        // against the new one — approving values Victor has not read.
        <form key={proposal.generatedAt} action={saveAction} className="space-y-4">
          <input type="hidden" name="basis" value={proposal.basis} />

          <p className="text-xs text-muted-foreground">
            Nothing is saved until you tick it. Edit anything before approving.
          </p>

          <ul className="space-y-3">
            {proposal.items.map((item) => {
              const changed = (item.before ?? "") !== item.after;
              return (
                <li
                  key={item.key}
                  className="rounded-lg border border-border bg-card/60 p-3 sm:p-4"
                >
                  {/* Stacked, not a two-column diff: this gets read on a phone, where side
                      by side means two unreadable columns. Before is shown only when it
                      differs, so an unchanged row does not look like a change. */}
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      name={`approve:${item.key}`}
                      defaultChecked={false}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="eyebrow text-muted-foreground">{item.label}</span>
                  </label>

                  {changed && item.before && (
                    <p className="mt-2.5 text-xs text-muted-foreground line-through decoration-muted-foreground/50">
                      {item.before}
                    </p>
                  )}

                  <textarea
                    name={`value:${item.key}`}
                    defaultValue={item.after}
                    rows={2}
                    className="mt-2 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm leading-relaxed text-foreground focus:border-primary/60 focus:outline-none"
                  />

                  {item.note && (
                    // The model's reasoning, marked as such. It is not a fact about the week.
                    <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
                      <span className="eyebrow">why</span> {item.note}
                    </p>
                  )}

                  {!changed && (
                    <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
                      Unchanged from the current goal.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <ApproveButton />
            {saved && (
              <p
                role="status"
                className={
                  saved.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive-foreground"
                }
              >
                {saved.message}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
