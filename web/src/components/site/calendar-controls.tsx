"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { refreshCalendars, syncCanvas } from "@/app/private/calendar/actions";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * Manual refresh and Canvas import.
 *
 * Manual rather than a nightly job: a scheduled task needs a paid tier, which Victor ruled
 * out, and a free-plan cron would be the one part of this that could fail silently overnight
 * with nobody watching. A button says plainly when the data was last pulled.
 */

function Button({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:opacity-60"
    >
      {pending ? busy : label}
    </button>
  );
}

export function CalendarControls() {
  const [refreshState, refresh] = useActionState<ActionState | null, FormData>(
    refreshCalendars,
    null,
  );
  const [syncState, sync] = useActionState<ActionState | null, FormData>(syncCanvas, null);
  const status = syncState ?? refreshState;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={refresh}>
        <Button label="Refresh" busy="Refreshing…" />
      </form>
      <form action={sync}>
        <Button label="Import Canvas" busy="Importing…" />
      </form>
      {status && (
        <p
          role="status"
          className={`w-full font-mono text-[0.65rem] sm:w-auto ${
            status.ok ? "text-primary" : "text-destructive"
          }`}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
