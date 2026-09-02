"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useFormStatus } from "react-dom";

import { createLogEntry } from "@/app/private/log/actions";
import { DictateButton } from "@/components/site/dictate-button";
import { keypadFor, SCALE_MAX, SCALE_MIN, type Category, type Field } from "@/lib/log/categories";
import type { Chip, ChipSets } from "@/lib/log/chips";
import { stickyStore, submittedValues, writeSticky } from "@/lib/log/sticky";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * The quick-log form, generated from a category definition.
 *
 * One component for all six categories, because the fields are data. Adding a field means
 * editing `lib/log/categories.ts` and nothing else — which is what makes D-039's promise
 * (Victor edits the fields) actually cheap.
 *
 * V3 §1.6 (D-155) added the three things that make a log finishable one-handed in fifteen
 * seconds: values that stick between entries, recent values as chips, and the right keypad
 * per field. Each is declared in `categories.ts`; none of them is special-cased here.
 */

const INPUT =
  "w-full rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none";
const LABEL = "font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground";

/** Local date as YYYY-MM-DD. `toISOString` would shift to UTC and, in the evening in
 *  California, default the form to tomorrow. */
function todayLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * A 1-5 scale as five tap targets, not a number input.
 *
 * `inputMode="decimal"` on a phone raises a full numeric keypad to collect one digit out of
 * five, which is three interactions where there should be one — and this field is filled in
 * one-handed, in bed, which is the least forgiving context in the app.
 *
 * Radios rather than buttons so the value reaches `FormData` with no extra plumbing, and so
 * arrow keys work. Controlled only to render the clear affordance: without it a mis-tap is
 * unrecoverable, and every field in this form is optional by design.
 */
function ScaleField({ field }: { field: Field }) {
  const [value, setValue] = useState<number | null>(null);
  const [low, high] = field.anchors ?? ["", ""];
  const steps = Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, i) => SCALE_MIN + i);

  return (
    <fieldset className="col-span-2 sm:col-span-3">
      <div className="flex items-baseline justify-between gap-2">
        <legend className={LABEL}>{field.label}</legend>
        {value !== null && (
          <button
            type="button"
            onClick={() => setValue(null)}
            className="font-mono text-[0.55rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            clear
          </button>
        )}
      </div>

      <div className="mt-1 flex gap-1">
        {steps.map((step) => (
          <label
            key={step}
            className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm transition-colors ${
              value === step
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <input
              type="radio"
              name={field.name}
              value={step}
              checked={value === step}
              onChange={() => setValue(step)}
              className="sr-only"
            />
            {step}
          </label>
        ))}
      </div>

      {(low || high) && (
        <div className="mt-1 flex justify-between font-mono text-[0.55rem] text-muted-foreground">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </fieldset>
  );
}

/**
 * A one-tap paste, for the fields that are always pasted rather than typed.
 *
 * A button rather than reading the clipboard when the field is focused. Silently reading it
 * would raise a permission prompt at a moment nobody asked for one, and would mean the app
 * looks at the clipboard on every visit to the form — for a field that is empty most of the
 * time. One tap, and only when he means it.
 */
function PasteButton({ targetId }: { targetId: string }) {
  const [state, setState] = useState<"idle" | "empty">("idle");

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          const text = (await navigator.clipboard.readText()).trim();
          const input = document.getElementById(targetId) as HTMLInputElement | null;
          if (!text || !input) {
            setState("empty");
            return;
          }
          input.value = text;
          // Uncontrolled inputs, so React needs telling — without this the value is on screen
          // and in `FormData`, but nothing else here knows it changed.
          input.dispatchEvent(new Event("input", { bubbles: true }));
          setState("idle");
        } catch {
          // Denied, or a browser without the API. Nothing is broken; the field still types.
          setState("empty");
        }
      }}
      className="font-mono text-[0.55rem] text-muted-foreground transition-colors hover:text-foreground"
    >
      {state === "empty" ? "nothing to paste" : "paste"}
    </button>
  );
}

/** Recent values for one field, newest first. */
function ChipRow({
  chips,
  onPick,
}: {
  chips: Chip[];
  onPick: (fills: Record<string, string>) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {chips.map((chip) => (
        <button
          key={chip.value}
          type="button"
          onClick={() => onPick(chip.fills)}
          // `min-h-8` keeps every chip a real tap target on a phone; a 24px chip is a miss.
          className="min-h-8 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

function FieldInput({
  field,
  defaultValue,
  chips,
  onPick,
}: {
  field: Field;
  defaultValue?: string;
  chips?: Chip[];
  onPick: (fills: Record<string, string>) => void;
}) {
  if (field.type === "scale") return <ScaleField field={field} />;

  if (field.type === "bool") {
    return (
      <label className="flex items-center gap-2 pt-5">
        <input
          type="checkbox"
          name={field.name}
          defaultChecked={defaultValue === "on"}
          className="size-4 rounded border-border accent-[var(--primary)]"
        />
        <span className="text-sm text-foreground">{field.label}</span>
      </label>
    );
  }

  const id = `f-${field.name}`;

  return (
    <div className={field.wide ? "col-span-2 sm:col-span-3" : ""}>
      <div className="flex items-baseline justify-between gap-2">
        <label className={LABEL} htmlFor={id}>
          {field.label}
        </label>
        {field.clipboard && <PasteButton targetId={id} />}
      </div>

      {field.type === "select" ? (
        <select
          id={id}
          name={field.name}
          defaultValue={defaultValue ?? ""}
          className={`${INPUT} mt-1`}
        >
          <option value="">—</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "distance" ? (
        <div className="mt-1 flex gap-1">
          <input
            id={id}
            name={field.name}
            defaultValue={defaultValue}
            inputMode={keypadFor(field)}
            placeholder={field.placeholder}
            className={INPUT}
          />
          <select name={`${field.name}Unit`} defaultValue="m" className={`${INPUT} w-16 shrink-0`}>
            <option value="m">m</option>
            <option value="km">km</option>
            <option value="mi">mi</option>
          </select>
        </div>
      ) : (
        <input
          id={id}
          name={field.name}
          defaultValue={defaultValue}
          // Declared per field, not derived from the type: reps wants digits, weight wants a
          // decimal point, and a duration typed as `2:17` needs the full keyboard because no
          // numeric keypad on Android offers a colon.
          inputMode={keypadFor(field)}
          autoCapitalize={field.capitalise ?? "sentences"}
          autoCorrect={field.capitalise === "none" ? "off" : undefined}
          spellCheck={field.capitalise === "none" ? false : undefined}
          placeholder={field.placeholder}
          className={`${INPUT} mt-1`}
        />
      )}

      {chips && chips.length > 0 && <ChipRow chips={chips} onPick={onPick} />}
    </div>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "Saving…" : `Log ${label.toLowerCase()}`}
    </button>
  );
}

export function LogForm({ category, chips = {} }: { category: Category; chips?: ChipSets }) {
  const [state, action] = useActionState<ActionState | null, FormData>(createLogEntry, null);
  const [showDate, setShowDate] = useState(false);
  const noteId = `note-${category.key}`;

  const form = useRef<HTMLFormElement>(null);
  const storage = () => (typeof window === "undefined" ? undefined : window.localStorage);

  /**
   * Sticky values, straight from their store.
   *
   * The `version` in the snapshot is what remounts the fields after a save. React already
   * resets a `<form action={fn}>` for us, but a reset restores the defaults the inputs were
   * *mounted* with — the previous sticky values — so the entry after a change would otherwise
   * come back with the old ones.
   */
  const store = useMemo(() => stickyStore(category), [category]);
  const sticky = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  /** A chip tap, or anything else that fills several fields at once. */
  const fill = useCallback((values: Record<string, string>) => {
    const element = form.current;
    if (!element) return;

    for (const [name, value] of Object.entries(values)) {
      const input = element.elements.namedItem(name);
      if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }, []);

  /**
   * What was in the form when it was submitted.
   *
   * Captured here rather than read back in an effect, because React resets a function-action
   * form as soon as the action completes — by the time an effect sees `state.ok`, the fields
   * it would read are already empty.
   */
  const submitted = useRef<Record<string, string>>({});
  const submit = useCallback(
    (formData: FormData) => {
      submitted.current = submittedValues(formData);
      return action(formData);
    },
    [action],
  );

  const settled = useRef<ActionState | null>(null);
  useEffect(() => {
    if (!state || state === settled.current) return;
    settled.current = state;

    // Both branches write to something outside React — the sticky store, or the DOM — and
    // neither calls `setState`. The re-render that clears the form comes from the store
    // notifying its subscribers, which is the whole reason the store exists.
    if (state.ok) {
      writeSticky(storage(), category, submitted.current);
      return;
    }

    // A failed save must not also cost him the entry. React has already blanked the fields,
    // so put back what was typed — the message says what went wrong, and everything is still
    // there to fix and send again.
    fill(submitted.current);
  }, [state, category, fill]);

  return (
    <form
      ref={form}
      action={submit}
      // Remounts on category change, so switching tabs clears the previous category's values
      // instead of leaving them to be submitted by accident. The generation does the same
      // after a successful save.
      key={`${category.key}-${sticky.version}`}
      className="space-y-4"
    >
      <input type="hidden" name="category" value={category.key} />

      {category.fields.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {category.fields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              defaultValue={sticky.values[field.name]}
              chips={chips[field.name]}
              onPick={fill}
            />
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <label className={LABEL} htmlFor={noteId}>
            Note
          </label>
          <DictateButton targetId={noteId} />
        </div>
        <textarea
          id={noteId}
          name="note"
          rows={2}
          placeholder="Anything worth remembering"
          className={`${INPUT} mt-1 resize-y`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton label={category.label} />

        {showDate ? (
          <input
            type="date"
            name="occurredOn"
            defaultValue={todayLocal()}
            aria-label="Date this happened"
            className="rounded-md border border-border bg-card/60 px-2 py-1.5 font-mono text-xs text-muted-foreground focus:border-primary/60 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowDate(true)}
            className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            not today?
          </button>
        )}

        {state && (
          <p
            role="status"
            className={`font-mono text-xs ${state.ok ? "text-primary" : "text-destructive"}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
