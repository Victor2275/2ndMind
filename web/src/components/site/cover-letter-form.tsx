"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { generateCoverLetterAction } from "@/app/private/work/tailor/actions";
import type { TailorState } from "@/lib/tailor-state";

/**
 * Cover letter drafting. Unlike `TailorForm` and `QuestionForm`, this one lets the model write
 * real prose — the guardrail is that every factual paragraph must cite a real bullet id
 * (`lib/ai/cover-letter.ts`), shown here so the draft is checkable rather than trusted.
 *
 * Nothing sensitive is hard-coded here — this compiles into `/_next/static/chunks/`, served
 * without authentication. Bullet text arrives as a prop at render time, from the vault.
 */

function DraftButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "Drafting…" : "Draft a letter"}
    </button>
  );
}

const SECTION_LABEL: Record<string, string> = {
  greeting: "Greeting",
  hook: "Hook",
  body: "Body",
  closing: "Closing",
};

export function CoverLetterForm() {
  const [state, action] = useActionState<TailorState | null, FormData>(
    generateCoverLetterAction,
    null,
  );
  const [copied, setCopied] = useState(false);

  const letter = state?.ok ? state.letter : undefined;
  const byId = new Map((state?.bullets ?? []).map((b) => [b.id, b]));

  const fullText = letter?.paragraphs.map((p) => p.text).join("\n\n") ?? "";

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A browser refusing clipboard access is not worth surfacing as an error — the text is
      // already visible and selectable on the page.
    }
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3">
        <div>
          <label htmlFor="letter-posting" className="eyebrow text-muted-foreground">
            Job posting
          </label>
          <textarea
            id="letter-posting"
            name="posting"
            rows={8}
            placeholder="Paste the whole description — requirements and responsibilities, not just the title."
            className="mt-1 w-full rounded-md border border-border bg-card/70 px-3 py-2 text-sm leading-relaxed text-foreground focus:border-primary/60 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DraftButton />
          {state && !state.ok && (
            <p role="status" className="text-xs text-destructive-foreground">
              {state.message}
            </p>
          )}
        </div>
      </form>

      {letter && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow text-muted-foreground">Draft</p>
              <button
                type="button"
                onClick={copyLetter}
                className="rounded-md border border-border px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {letter.paragraphs.map((p, i) => (
                <div key={i}>
                  <p className="text-sm leading-relaxed text-foreground">{p.text}</p>
                  {p.citedIds.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 font-mono text-[0.62rem] text-muted-foreground">
                      <span className="text-primary">{SECTION_LABEL[p.section] ?? p.section}</span>
                      {p.citedIds.map((id) => {
                        const bullet = byId.get(id);
                        return (
                          <span key={id} title={bullet?.text}>
                            {bullet?.entry ?? id}
                          </span>
                        );
                      })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Every claim above is traced to something already in the vault, tagged under each
            paragraph. Read it before sending — this is a draft, not a submission.
          </p>
        </div>
      )}
    </div>
  );
}
