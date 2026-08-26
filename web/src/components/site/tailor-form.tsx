"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { suggestTailoring } from "@/app/private/tailor/actions";
import type { TailorState } from "@/lib/tailor-state";

/**
 * Paste a posting, get advice.
 *
 * Nothing sensitive is hard-coded here — this compiles into `/_next/static/chunks/`, served
 * without authentication. Bullet text arrives as a prop at render time, from the vault.
 */

function SuggestButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "Reading the posting…" : "Suggest"}
    </button>
  );
}

export function TailorForm({ variantLabels }: { variantLabels: Record<string, string> }) {
  const [state, action] = useActionState<TailorState | null, FormData>(suggestTailoring, null);

  const advice = state?.ok ? state.advice : undefined;
  const byId = new Map((state?.bullets ?? []).map((b) => [b.id, b]));

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3">
        <div>
          <label
            htmlFor="posting"
            className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Job posting
          </label>
          <textarea
            id="posting"
            name="posting"
            rows={8}
            placeholder="Paste the whole description — requirements and responsibilities, not just the title."
            className="mt-1 w-full rounded-md border border-border bg-card/70 px-3 py-2 text-sm leading-relaxed text-foreground focus:border-primary/60 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SuggestButton />
          {state && !state.ok && (
            <p role="status" className="text-xs text-destructive-foreground">
              {state.message}
            </p>
          )}
        </div>
      </form>

      {advice && (
        <div className="space-y-6">
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
              Send this variant
            </p>
            <p className="mt-1 text-lg font-bold tracking-tight text-foreground">
              {variantLabels[advice.variant] ?? advice.variant}
            </p>
            {advice.variantReason && (
              <p className="mt-1.5 text-sm text-muted-foreground">{advice.variantReason}</p>
            )}
            <a
              href={`/resume/${advice.variant}`}
              className="link-wipe mt-2 inline-block font-mono text-xs text-primary"
            >
              Open it &rarr;
            </a>
          </div>

          <section>
            <h3 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
              Lead with
            </h3>
            <ol className="mt-2 space-y-2">
              {advice.emphasise.map((id, i) => {
                const bullet = byId.get(id);
                if (!bullet) return null;
                return (
                  <li key={id} className="flex gap-3">
                    <span className="tabular font-mono text-xs text-primary">{i + 1}</span>
                    <span className="text-sm text-foreground">
                      {/* The vault's words, resolved from the id. The model never supplies
                          bullet text — that is the entire point of the id scheme. */}
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

          {advice.deprioritise.length > 0 && (
            <section>
              <h3 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
                Carries less weight here
              </h3>
              <ul className="mt-2 space-y-1.5">
                {advice.deprioritise.map((id) => {
                  const bullet = byId.get(id);
                  if (!bullet) return null;
                  return (
                    <li key={id} className="text-sm text-muted-foreground">
                      {bullet.text}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {advice.notes && (
            <section>
              <h3 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
                Rationale
              </h3>
              {/* Displayed as rationale, never as resume content. It is the one part of this
                  screen the model wrote in its own words. */}
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{advice.notes}</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
