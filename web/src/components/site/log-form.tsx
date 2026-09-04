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
import {
  keypadFor,
  rowFieldsFor,
  SCALE_MAX,
  SCALE_MIN,
  type Category,
  type Field,
  type RowGroup,
} from "@/lib/log/categories";
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
  prefix = "",
  compact = false,
  onValueChange,
}: {
  field: Field;
  defaultValue?: string;
  chips?: Chip[];
  onPick: (fills: Record<string, string>) => void;
  /** Set for a field inside a repeated row: `sets.1.` */
  prefix?: string;
  /** Inside a row, where the label is a caption above a tight grid. */
  compact?: boolean;
  /** Only for the field a row group's shape keys off (D-162). */
  onValueChange?: (value: string) => void;
}) {
  if (field.type === "scale") return <ScaleField field={field} />;

  if (field.type === "bool") {
    return (
      <label className="flex items-center gap-2 pt-5">
        <input
          type="checkbox"
          name={`${prefix}${field.name}`}
          defaultChecked={defaultValue === "on"}
          className="size-4 rounded border-border accent-[var(--primary)]"
        />
        <span className="text-sm text-foreground">{field.label}</span>
      </label>
    );
  }

  const id = `f-${prefix}${field.name}`;
  const name = `${prefix}${field.name}`;

  return (
    <div className={!compact && field.wide ? "col-span-2 sm:col-span-3" : ""}>
      <div className="flex items-baseline justify-between gap-2">
        <label className={LABEL} htmlFor={id}>
          {field.label}
        </label>
        {field.clipboard && <PasteButton targetId={id} />}
      </div>

      {field.type === "select" ? (
        <select
          id={id}
          name={name}
          defaultValue={defaultValue ?? ""}
          onChange={onValueChange ? (event) => onValueChange(event.target.value) : undefined}
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
            name={name}
            defaultValue={defaultValue}
            inputMode={keypadFor(field)}
            placeholder={field.placeholder}
            className={INPUT}
          />
          <select name={`${name}Unit`} defaultValue="m" className={`${INPUT} w-16 shrink-0`}>
            <option value="m">m</option>
            <option value="km">km</option>
            <option value="mi">mi</option>
          </select>
        </div>
      ) : (
        <input
          id={id}
          name={name}
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

/**
 * The repeated rows — sets (D-159).
 *
 * Rows are addressed by a generated id rather than by their position. Keying them by index
 * means removing the second of three rows renumbers the third, React reuses the removed row's
 * DOM node for it, and the values on screen shuffle up by one — a silent corruption of a
 * record whose entire purpose is that its numbers can be trusted.
 *
 * "Add set" copies the row above it, because the second set of an exercise is nearly always
 * the same weight and reps as the first. Copied rather than blank saves the two fields that
 * are otherwise retyped every single time, and a copied number is visible on screen before it
 * is saved — the same standard the chips are held to.
 */
function RowFields({
  group,
  shape,
  onPick,
}: {
  group: RowGroup;
  /** The current value of the field this group's shape keys off. */
  shape: string | undefined;
  onPick: (fills: Record<string, string>) => void;
}) {
  const nextId = useRef(group.initial);
  const [ids, setIds] = useState(() => Array.from({ length: group.initial }, (_, i) => i));
  const [showAll, setShowAll] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  /**
   * Only the fields this kind of session actually has (D-162).
   *
   * Rendered conditionally rather than hidden with CSS. A hidden input still posts, so a
   * split typed into an erg piece and then switched to a lift would arrive on the entry as a
   * number nobody meant — and this form's whole claim is that its numbers can be trusted.
   * The cost is that switching kind clears what was typed into a field the new shape drops,
   * which is the right way round.
   */
  const fields = rowFieldsFor(group, shape, showAll);
  const hidden = group.fields.length - fields.length;

  const add = () => {
    if (ids.length >= group.max) return;
    const id = nextId.current++;
    const from = ids[ids.length - 1];
    setIds((current) => [...current, id]);

    // After the row exists. Reading the previous row's values now and passing them as
    // defaults would work too, but this keeps the inputs uncontrolled, which is what lets a
    // failed save put back exactly what was typed.
    queueMicrotask(() => {
      const element = container.current;
      if (!element || from === undefined) return;
      for (const field of fields) {
        const source = element.querySelector<HTMLInputElement | HTMLSelectElement>(
          `[name="${group.name}.${from}.${field.name}"]`,
        );
        const target = element.querySelector<HTMLInputElement | HTMLSelectElement>(
          `[name="${group.name}.${id}.${field.name}"]`,
        );
        if (source && target) target.value = source.value;
      }
    });
  };

  return (
    <div ref={container}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={LABEL}>{group.label}s</span>
        {ids.length >= group.max ? (
          <span className="font-mono text-[0.55rem] text-muted-foreground">
            {group.max} is the most
          </span>
        ) : (
          // The escape hatch. A shape is a good guess, never a rule, and a form that cannot
          // record what actually happened is worse than one carrying a spare field.
          (hidden > 0 || showAll) && (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="font-mono text-[0.55rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              {showAll ? "fewer fields" : "every field"}
            </button>
          )
        )}
      </div>

      <div className="mt-1 space-y-2">
        {ids.map((id, index) => (
          <div key={id} className="flex items-end gap-2">
            <span className="w-4 shrink-0 pb-2 font-mono text-[0.6rem] text-muted-foreground tabular-nums">
              {index + 1}
            </span>

            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
              {fields.map((field) => (
                <FieldInput
                  key={field.name}
                  field={field}
                  prefix={`${group.name}.${id}.`}
                  compact
                  onPick={onPick}
                />
              ))}
            </div>

            {ids.length > 1 && (
              <button
                type="button"
                onClick={() => setIds((current) => current.filter((each) => each !== id))}
                aria-label={`Remove ${group.label.toLowerCase()} ${index + 1}`}
                className="min-h-10 shrink-0 px-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {ids.length < group.max && (
        <button
          type="button"
          onClick={add}
          className="mt-2 min-h-10 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          + {group.addLabel}
        </button>
      )}
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

export function LogForm({
  category,
  chips = {},
  write = createLogEntry,
}: {
  category: Category;
  chips?: ChipSets;
  /**
   * Where a submitted entry goes (V3 §2.2).
   *
   * Defaults to the Server Action. The cached shell passes a writer that puts the entry
   * straight into the outbox instead, so the same form — same fields, same shapes, same chips,
   * same recovery when a save fails — works with no network. Injecting it rather than branching
   * inside on `navigator.onLine` keeps this component ignorant of the network, and means the
   * offline path is exercised by a test that hands it a function rather than one that fakes a
   * radio.
   */
  write?: (prev: ActionState | null, formData: FormData) => Promise<ActionState>;
}) {
  const [state, action] = useActionState<ActionState | null, FormData>(write, null);
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

  /**
   * The value the row shape keys off — `kind`, for Training (D-162).
   *
   * Seeded from the sticky value so a form that opens on "erg" opens with erg's fields. Keyed
   * by the same generation as the form itself, so it resets alongside the inputs after a save.
   */
  const shapeName = category.rows?.shapeBy;
  const [shape, setShape] = useState<string | undefined>(
    shapeName ? sticky.values[shapeName] : undefined,
  );

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
              onValueChange={field.name === shapeName ? setShape : undefined}
            />
          ))}
        </div>
      )}

      {category.rows && <RowFields group={category.rows} shape={shape} onPick={fill} />}

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
