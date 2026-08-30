"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { importHevyCsv } from "@/app/private/athletics/actions";
import type { ActionState } from "@/lib/athletics/forms";

function ImportButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_20px_-6px_var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Reading the file…" : "Import"}
    </button>
  );
}

export function HevyImportForm() {
  const [state, action] = useActionState<ActionState | null, FormData>(importHevyCsv, null);

  return (
    <form action={action} className="mt-5 space-y-4">
      <input
        type="file"
        name="csv"
        accept=".csv,text/csv"
        required
        className="block w-full cursor-pointer rounded-md border border-border bg-card/70 px-3 py-2 text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-accent/60 file:px-3 file:py-1.5 file:font-mono file:text-xs file:text-foreground hover:border-primary/50"
      />

      <p className="text-xs text-muted-foreground">
        Hevy → Settings → Export Data. Importing the same export twice is safe: sessions already
        stored are recognised and left alone.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <ImportButton />
        {state && (
          <p
            role="status"
            className={`font-mono text-xs ${state.ok ? "text-primary" : "text-destructive"}`}
          >
            {state.message}
          </p>
        )}
      </div>

      {state?.detail && state.detail.length > 0 && (
        <ul className="space-y-1 rounded-md border border-highlight/40 bg-highlight/10 px-3 py-2">
          {state.detail.map((line) => (
            <li key={line} className="font-mono text-[0.68rem] text-muted-foreground">
              {line}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
