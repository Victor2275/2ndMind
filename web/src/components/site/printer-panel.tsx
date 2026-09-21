"use client";

import { useActionState, useState } from "react";
import { PencilIcon, XIcon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { deletePrinter, savePrinter } from "@/app/private/hobbies/actions";
import { PRINTER_STATUSES } from "@/lib/fabrication/statuses";
import type { Printer } from "@/lib/db/schema";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * Printers, as a secondary panel (V3 §5.1, D-189).
 *
 * Secondary on purpose: the page is about what to reorder, and "which printer is free" is a
 * different question the plan explicitly separated. It is a short list read at a glance, so it
 * is one line per machine with the state carried by a word and a colour rather than a chart.
 *
 * The four states are Victor's own, confirmed 2026-09-06 — the plan refused to invent a
 * taxonomy, and these are the distinctions that change what he does next.
 */

const TONE: Record<string, string> = {
  printing: "border-primary/60 text-primary",
  idle: "border-border text-muted-foreground",
  "needs maintenance": "border-highlight/60 text-highlight",
  down: "border-destructive/60 text-destructive",
};

export function PrinterPanel({ printers }: { printers: Printer[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-foreground">
          {printers.length === 0
            ? "No printers yet."
            : `${printers.filter((p) => p.status === "idle").length} free of ${printers.length}.`}
        </p>
        <button
          type="button"
          onClick={() => setAdding((open) => !open)}
          className="min-h-11 press rounded-control border border-primary/50 px-3 font-mono text-xs text-primary transition-colors duration-fast ease-standard hover:bg-primary/10"
        >
          {adding ? "Cancel" : "+ printer"}
        </button>
      </div>

      {adding && <PrinterForm onDone={() => setAdding(false)} />}

      {printers.length > 0 && (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60">
          {printers.map((printer) => (
            <PrinterRow key={printer.id} printer={printer} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PrinterRow({ printer }: { printer: Printer }) {
  const [editing, setEditing] = useState(false);
  const [, remove] = useActionState<ActionState | null, FormData>(deletePrinter, null);

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{printer.name}</span>

        {/* Q424 — the state, as a state. A dot plus the word: the dot is what makes a list of
            four machines readable in one pass, and the word is what makes it mean something
            (rule 10). `printing` pulses, because it is the one state that is *happening*. */}
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[0.65rem] ${
            TONE[printer.status] ?? TONE.idle
          }`}
        >
          <span
            aria-hidden
            className={`size-1.5 rounded-full bg-current ${
              printer.status === "printing" ? "motion-safe:animate-pulse" : ""
            }`}
          />
          {printer.status}
        </span>

        <button
          type="button"
          onClick={() => setEditing((open) => !open)}
          aria-label={`Edit ${printer.name}`}
          className="inline-flex size-11 shrink-0 press items-center justify-center rounded-control text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground"
        >
          <PencilIcon aria-hidden className="size-3.5" />
        </button>

        <form action={remove} className="shrink-0">
          <input type="hidden" name="id" value={printer.id} />
          <button
            type="submit"
            aria-label={`Remove ${printer.name}`}
            className="-mr-2 inline-flex size-11 press items-center justify-center rounded-control text-muted-foreground transition-colors duration-fast ease-standard hover:text-destructive"
          >
            <XIcon aria-hidden className="size-3.5" />
          </button>
        </form>
      </div>

      {printer.notes !== "" && (
        <p className="mt-1 text-xs text-muted-foreground">{printer.notes}</p>
      )}

      {editing && <PrinterForm printer={printer} onDone={() => setEditing(false)} />}
    </li>
  );
}

function PrinterForm({ printer, onDone }: { printer?: Printer; onDone: () => void }) {
  const [state, action] = useActionState<ActionState | null, FormData>(savePrinter, null);

  return (
    <form action={action} className="mt-3 rounded-lg border border-border bg-background/60 p-3">
      {printer && <input type="hidden" name="id" value={printer.id} />}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow text-muted-foreground">Name</span>
          <input
            name="name"
            required
            defaultValue={printer?.name ?? ""}
            className="mt-1 min-h-10 w-full rounded-md border border-border bg-card/60 px-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="eyebrow text-muted-foreground">Status</span>
          {/* A select, not free text: the four states are the vocabulary, and a typo'd fifth
              would be a state nothing renders a colour for and nothing counts. */}
          <select
            name="status"
            defaultValue={printer?.status ?? "idle"}
            className="mt-1 min-h-10 w-full rounded-md border border-border bg-card/60 px-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none"
          >
            {PRINTER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-2 block">
        <span className="eyebrow text-muted-foreground">Notes</span>
        <input
          name="notes"
          defaultValue={printer?.notes ?? ""}
          className="mt-1 min-h-10 w-full rounded-md border border-border bg-card/60 px-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none"
        />
      </label>

      <div className="mt-3 flex items-center gap-3">
        <SaveButton />
        <button
          type="button"
          onClick={onDone}
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          close
        </button>
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
      className="min-h-10 rounded-md border border-primary/50 px-3 text-sm text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "…" : "Save"}
    </button>
  );
}
