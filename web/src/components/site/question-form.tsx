"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { answerPostingQuestion } from "@/app/private/work/tailor/actions";
import { useAnnounce } from "@/components/site/announcer";
import type { TailorState } from "@/lib/tailor-state";

/**
 * The other half of an application: the written questions a posting asks directly.
 *
 * "Why do you want to work here", "describe a time you led something". Same guardrail as the
 * resume side — the model points at material Victor already has and says how to frame it. It
 * never drafts the answer, because a drafted answer is the model's prose submitted under his
 * name, and once a draft box exists it is the box that gets pasted.
 *
 * Nothing sensitive is hard-coded here — this compiles into `/_next/static/chunks/`, served
 * without authentication. Bullet text arrives as a prop at render time, from the vault.
 */

function AskButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "Reading the question…" : "What do I draw on?"}
    </button>
  );
}

export function QuestionForm() {
  const [state, action] = useActionState<TailorState | null, FormData>(answerPostingQuestion, null);
  useAnnounce(state);

  const answer = state?.ok ? state.answer : undefined;
  const byId = new Map((state?.bullets ?? []).map((b) => [b.id, b]));

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3">
        <div>
          <label htmlFor="question" className="eyebrow text-muted-foreground">
            Application question
          </label>
          <textarea
            id="question"
            name="question"
            rows={4}
            placeholder="Paste one question — e.g. “Describe a technical project you are proud of and your role in it.”"
            className="mt-1 w-full rounded-md border border-border bg-card/70 px-3 py-2 text-sm leading-relaxed text-foreground focus:border-primary/60 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AskButton />
          {state && !state.ok && (
            <p className="text-xs text-destructive-foreground">{state.message}</p>
          )}
        </div>
      </form>

      {answer && (
        <div className="space-y-6">
          <section>
            <h3 className="eyebrow text-muted-foreground">Build it from</h3>
            <ol className="mt-2 space-y-2">
              {answer.points.map((id, i) => {
                const bullet = byId.get(id);
                if (!bullet) return null;
                return (
                  <li key={id} className="flex gap-3">
                    <span className="tabular font-mono text-xs text-primary">{i + 1}</span>
                    <span className="text-sm text-foreground">
                      {/* The vault's words, resolved from the id. The model never supplies
                          this text — that is the entire point of the id scheme. */}
                      {bullet.text}
                      <span className="ml-2 font-mono text-[0.62rem] text-muted-foreground">
                        {bullet.entry}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {answer.angle && (
            <section>
              <h3 className="eyebrow text-muted-foreground">Angle</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer.angle}</p>
            </section>
          )}

          {answer.avoid && (
            <section className="rounded-lg border border-highlight/40 bg-highlight/10 p-4">
              <h3 className="eyebrow text-muted-foreground">Do not claim</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{answer.avoid}</p>
            </section>
          )}

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Write the answer yourself. This is a plan, not a draft.
          </p>
        </div>
      )}
    </div>
  );
}
