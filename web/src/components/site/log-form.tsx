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
import { SlowSaveNotice } from "@/components/site/slow-save";
import { TagInput } from "@/components/site/tag-input";
import {
  keypadFor,
  rowFieldsFor,
  SCALE_MAX,
  SCALE_MIN,
  type Category,
  type Field,
  type RowGroup,
} from "@/lib/log/categories";
import {
  Chip as Token,
  ChipRow as TokenRow,
  CONTROL as FIELD_CONTROL,
  CONTROL_FULL,
  ErrorSummary,
  // `Field` is already the *data* type for a log field (`lib/log/categories`). The shell
  // that draws one takes the longer name rather than shadowing it.
  Field as FieldShell,
  FIELD_LABEL,
  PasteAction,
  StickySave,
  useBlurValidation,
  useDirty,
  type ShortcutKind,
} from "@/components/site/field";
import { SaveState } from "@/components/site/states";
import { buzzSaved } from "@/lib/haptics";
import type { Chip, ChipSets } from "@/lib/log/chips";
import { clearDraft, draftStore, saveDraft } from "@/lib/log/drafts";
import { stickyStore, submittedValues, writeSticky } from "@/lib/log/sticky";
import type { ActionState } from "@/lib/sprint-goals";
import { VoiceEntry } from "@/components/site/voice-entry";
import type { SpokenEntry } from "@/lib/voice/parse";

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

/**
 * The control look now comes from `components/site/field.tsx` (V4 §5.2).
 *
 * It was declared here, and the three rules that matter travelled with it: the width stays out
 * of the base string (D-219 — two width utilities on one element resolve by Tailwind's emit
 * order, not by the order they are written), the height is Q245's 48px, and the size is 16px on
 * a phone so iOS Safari does not zoom the viewport on focus.
 *
 * The aliases below are kept so the ~30 call sites in this file read as they did. `LABEL` is
 * now only used where a `<legend>` or a group caption is the label — `Field` owns the real ones.
 */
const CONTROL = FIELD_CONTROL;
const INPUT = CONTROL_FULL;
const LABEL = FIELD_LABEL;

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
            // `press` explicitly: §5.3's base rule reaches `button` and `[role=button]`, and
            // this is a `<label>` wrapping a radio — the pattern the base selector cannot see.
            // `min-h-12` is Q245's 48px, up from 40px, on the control whose own comment says it
            // is filled one-handed in bed.
            className={`flex min-h-12 flex-1 press cursor-pointer items-center justify-center rounded-control border text-sm transition-colors duration-fast ease-standard ${
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

  // §5.2 moved the look into `PasteAction`: this was the word "paste" at `text-[0.55rem]`,
  // which is a 7px tap target beside a 48px field and is under the 11px floor §7.1 turns into
  // a gate. Q253 also wanted the two shortcuts you can *act on* to look like controls; this is
  // one of the two. The behaviour below is unchanged.
  return (
    <PasteAction
      empty={state === "empty"}
      onPaste={async () => {
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
    />
  );
}

/**
 * Recent values for one field, newest first — tokens now (§5.2, Q255, Q256).
 *
 * The shape moved to `field.tsx`: a token rather than a button (Q255), filled when chosen
 * (Q256), and 44px rather than 32px. The old comment here said "a 24px chip is a miss", which
 * was right about the direction and stopped 12px short of DESIGN.md §9's number.
 *
 * **Selection is tracked, and that is new.** A chip fills several fields at once and then
 * looked exactly as it had before the tap, so on a phone there was no way to tell a chip you
 * had pressed from one you had not — which for `carries` fields means no way to tell whether
 * last time's weight went in. It is local state rather than derived from the inputs because the
 * inputs are uncontrolled on purpose, and comparing their values back would light a chip up
 * whenever the same number was typed by hand.
 */
function ChipRow({
  chips,
  onPick,
}: {
  chips: Chip[];
  onPick: (fills: Record<string, string>) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <TokenRow>
      {chips.map((chip) => (
        <Token
          key={chip.value}
          selected={chosen === chip.value}
          onClick={() => {
            setChosen(chip.value);
            onPick(chip.fills);
          }}
        >
          {chip.label}
        </Token>
      ))}
    </TokenRow>
  );
}

/**
 * The passive shortcuts this field has, for Q253's annotation row.
 *
 * `sticky` is read off the field definition. `keypad` is read off `keypadFor` rather than off
 * `field.keypad`, because the keypad a field raises is partly derived from its type — a
 * `number` gets `decimal` without saying so — and the mark has to describe what will actually
 * happen, not what was declared. A `text` keypad is no keypad and is not marked: the mark
 * exists to say *this one is different*, and marking every field says nothing.
 */
function marksFor(field: Field): ShortcutKind[] {
  const marks: ShortcutKind[] = [];
  if (field.sticky) marks.push("sticky");
  if (keypadFor(field) !== "text") marks.push("keypad");
  return marks;
}

function FieldInput({
  field,
  defaultValue,
  chips,
  onPick,
  prefix = "",
  compact = false,
  onValueChange,
  error,
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
  /** From `useBlurValidation`, shown under the control (§5.2, Q249, Q250). */
  error?: string | null;
}) {
  if (field.type === "scale") return <ScaleField field={field} />;

  if (field.type === "bool") {
    return (
      // A checkbox, not a switch (Q263: checkboxes for lists, switches for settings). The whole
      // row is the label, and `min-h-12` makes the row — not the 16px box — the tap target,
      // which is Q245's 48px on the control that was previously the smallest thing in the form.
      <label className="flex min-h-12 items-center gap-2.5">
        <input
          type="checkbox"
          name={`${prefix}${field.name}`}
          defaultChecked={defaultValue === "on"}
          className="size-5 rounded border-border accent-[var(--primary)]"
        />
        <span className="text-sm text-foreground">{field.label}</span>
      </label>
    );
  }

  const id = `f-${prefix}${field.name}`;
  const name = `${prefix}${field.name}`;

  return (
    <FieldShell
      label={field.label}
      htmlFor={id}
      marks={marksFor(field)}
      action={field.clipboard ? <PasteButton targetId={id} /> : undefined}
      error={error}
      chips={chips && chips.length > 0 ? <ChipRow chips={chips} onPick={onPick} /> : undefined}
      className={!compact && field.wide ? "col-span-2 sm:col-span-3" : ""}
    >
      {field.type === "select" ? (
        <select
          id={id}
          name={name}
          defaultValue={defaultValue ?? ""}
          onChange={onValueChange ? (event) => onValueChange(event.target.value) : undefined}
          className={INPUT}
        >
          <option value="">—</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "distance" ? (
        <div className="flex gap-1">
          <input
            id={id}
            name={name}
            defaultValue={defaultValue}
            inputMode={keypadFor(field)}
            placeholder={field.placeholder}
            className={INPUT}
          />
          <select name={`${name}Unit`} defaultValue="m" className={`${CONTROL} w-16 shrink-0`}>
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
          className={INPUT}
        />
      )}
    </FieldShell>
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
          // Marked so a spoken entry can add its extra sets through *this* button rather than
          // through a second copy of the row logic (§4.3, D-186). "185 for 5, three sets" means
          // the same set three times, and `add` already carries the previous row's values down
          // — so pressing it twice is exactly the right behaviour, and there is no second path
          // to keep in step.
          data-add-row
          className="mt-2 min-h-10 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          + {group.addLabel}
        </button>
      )}
    </div>
  );
}

/**
 * The save.
 *
 * `min-h-12` is Q245's 48px, on the control that decides whether the whole form was worth
 * filling in. It was `py-2` on `text-sm`, which measured about 34px.
 *
 * Rendered in two places at once on a phone — here, in the flow, and inside `StickySave` at the
 * bottom of the viewport (Q251). Two submit buttons in one form is correct and deliberate:
 * they submit the same form, so there is no second path to keep in step, and the alternative
 * (moving the button into the bar) would take it off the desktop layout, which has no bar.
 *
 * **They must not share an accessible name.** "Log training" rendered twice is two identical
 * answers to "what can I do here" — for a screen reader, and for `getByRole`, which is how this
 * was caught. `compact` is the bar's: it says **Save**, which is also the right word for a 56px
 * strip, and it is filled rather than outlined because inside the bar it is the only control.
 */
function SaveButton({ label, compact = false }: { label: string; compact?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-12 press items-center rounded-control px-4 text-sm transition-colors duration-fast ease-standard disabled:opacity-60 ${
        compact
          ? "bg-primary font-medium text-primary-foreground hover:bg-primary/80"
          : "border border-primary/50 text-primary hover:border-primary hover:bg-primary/10"
      }`}
    >
      {pending ? "Saving…" : compact ? "Save" : `Log ${label.toLowerCase()}`}
    </button>
  );
}

/**
 * What a field has to look like to be worth saving (§5.2, Q249).
 *
 * Deliberately thin. Every field in this form is **optional** (D-155's governing constraint),
 * so there is nothing to require — what is left is catching the two shapes that are silently
 * wrong rather than empty, both of which produce a row whose numbers cannot be trusted, which
 * is the one thing the log promises.
 *
 * The server re-validates with zod regardless (`log/actions.ts`); this exists so the answer
 * arrives while the field is still under the thumb rather than after a round trip.
 */
function validatorsFor(category: Category): Record<string, (value: string) => string | null> {
  const rules: Record<string, (value: string) => string | null> = {};

  const walk = (fields: readonly Field[], prefix = "") => {
    for (const field of fields) {
      if (field.type === "duration") {
        rules[`${prefix}${field.name}`] = (value) =>
          value === "" || /^\d{1,2}:[0-5]\d(\.\d+)?$/.test(value) || /^\d+(\.\d+)?$/.test(value)
            ? null
            : "Use m:ss, like 2:17.";
      } else if (field.type === "number" || field.type === "distance") {
        rules[`${prefix}${field.name}`] = (value) =>
          value === "" || Number.isFinite(Number(value)) ? null : "Numbers only.";
      }
    }
  };

  walk(category.fields);
  // Row fields are prefixed per row (`sets.0.weightLbs`), and the row ids are generated at
  // runtime — so the rules are registered under the bare name and looked up by it. That is why
  // `useBlurValidation` keys on `name` and this strips the prefix rather than enumerating rows.
  if (category.rows) walk(category.rows.fields);

  return rules;
}

export function LogForm({
  category,
  chips = {},
  tagSuggestions = [],
  write = createLogEntry,
}: {
  category: Category;
  chips?: ChipSets;
  /** The distinct-tags vocabulary, for `TagInput`'s autocomplete (V4 Phase 3, §3.2). */
  tagSuggestions?: readonly string[];
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
   * The half-typed entry, if the app was closed on one (§5.5, Q394).
   *
   * Read through a store for the same reason the sticky values are: `localStorage` does not
   * exist during SSR, so anything read at render time is a hydration mismatch. It is empty on
   * the server and real one re-render later, which is exactly what `useSyncExternalStore`
   * promises.
   *
   * A draft **outranks a sticky value** where both name the same field. Sticky is what this
   * category usually is; a draft is what Victor was actually typing.
   */
  const drafts = useMemo(() => draftStore(category), [category]);
  const draft = useSyncExternalStore(
    drafts.subscribe,
    drafts.getSnapshot,
    drafts.getServerSnapshot,
  );

  const defaults = useMemo(
    () => ({ ...sticky.values, ...draft.values }),
    [sticky.values, draft.values],
  );

  /**
   * Whether *this mount* restored something, which is not the same question as whether a draft
   * exists — the fields are uncontrolled, so once they are on screen the store's contents stop
   * being what the reader sees. Captured at mount and cleared by hand.
   */
  const [restored, setRestored] = useState(false);
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (announced.current === category.key) return;
    announced.current = category.key;
    setRestored(Object.keys(draft.values).length > 0);
    // `draft.values` is read once per category on purpose: this announces a restore, and a
    // draft saved by the next keystroke is not a restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.key]);

  /**
   * Keep the draft current, debounced (§5.5, Q394).
   *
   * Serialising the whole form on every keystroke is cheap in this form's terms — thirty
   * fields, not three thousand — but writing `localStorage` synchronously on each one is not,
   * and on a phone it lands on the same thread as the keyboard. 500ms after the last input is
   * indistinguishable to a person and turns a burst of typing into one write.
   */
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keep = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      const element = form.current;
      if (!element) return;
      saveDraft(storage(), category, submittedValues(new FormData(element)));
    }, 500);
    // `storage` is a stable arrow over `window`; `form` is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // A pending write must not outlive the form it describes: switching tabs unmounts this and
  // the timer would otherwise serialise the *new* category's fields under the old key.
  useEffect(() => {
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, [category]);

  const discardDraft = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    clearDraft(storage(), category);
    setRestored(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  /**
   * The value the row shape keys off — `kind`, for Training (D-162).
   *
   * Seeded from the sticky value so a form that opens on "erg" opens with erg's fields. Keyed
   * by the same generation as the form itself, so it resets alongside the inputs after a save.
   */
  const shapeName = category.rows?.shapeBy;
  const [shape, setShape] = useState<string | undefined>(
    shapeName ? (draft.values[shapeName] ?? sticky.values[shapeName]) : undefined,
  );

  /**
   * Adopt the shape the stored values imply, once they arrive.
   *
   * The hydration pass has no `localStorage`, so the seed above can only ever be empty on first
   * paint — which for Training means the erg fields do not appear until something is touched.
   * Guarded on `shape === undefined`, so this never overrules a choice already made.
   */
  useEffect(() => {
    if (!shapeName || shape !== undefined) return;
    const found = defaults[shapeName];
    if (found) setShape(found);
  }, [defaults, shapeName, shape]);

  /**
   * Blur validation, the error summary and the dirty indicator (§5.2, Q249, Q250, Q252).
   *
   * All three listen at the **form**, not per field, which is what keeps every input in here
   * uncontrolled — the property the failed-save recovery below depends on, and the reason this
   * form can put back exactly what was typed. Lifting every value into React to answer one
   * boolean would trade that for a dot.
   *
   * `validatorsFor` walks the field definitions, so it is rebuilt only when the category is.
   */
  const rules = useMemo(() => validatorsFor(category), [category]);
  const { errors, handlers, summary, clear: clearErrors } = useBlurValidation(rules);
  const { dirty, clear: clearDirty } = useDirty(form);

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
   * A spoken entry, poured into the fields (§4.3, D-186).
   *
   * **It fills and stops.** Nothing here submits — the same button that was always there is
   * what turns these values into a row, so "always confirmed before saving" is a property of
   * the wiring rather than a rule anyone has to keep.
   *
   * `kind` goes in first and on its own, because it decides which fields the set rows even
   * have (D-162): writing a split into an erg piece before the shape has changed writes it into
   * a field that is about to be unmounted. The rest follows a microtask later, once the new
   * shape has rendered.
   *
   * Extra sets are added by pressing the add-set button, not by a second copy of the row logic
   * — it already carries the previous row's values down, which is precisely what "three sets"
   * means.
   */
  const fillSpoken = useCallback(
    (entry: SpokenEntry) => {
      const element = form.current;
      if (!element || !category.rows) return;

      if (shapeName) {
        fill({ [shapeName]: entry.kind });
        setShape(entry.kind);
      }

      queueMicrotask(() => {
        const values: Record<string, string> = { exercise: entry.exercise };
        if (entry.rpe !== null) values.rpe = String(entry.rpe);
        for (const [field, value] of Object.entries(entry.sets[0] ?? {})) {
          values[`${category.rows?.name}.0.${field}`] = String(value);
        }
        fill(values);

        const addRow = element.querySelector<HTMLButtonElement>("button[data-add-row]");
        for (let extra = 1; extra < entry.sets.length; extra += 1) addRow?.click();
      });
    },
    [category.rows, fill, shapeName],
  );

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

    if (state.ok) {
      // The confirmation you get without looking (§3.3). This is the form used at a rack, one
      // hand, eyes elsewhere — a toast only answers "did that save?" if you read it. §5.2
      // mounted the toast system and this is deliberately **not** one of its call sites:
      // `notify` is for an action worth taking back and for a failure you were not watching
      // for, and a completed log entry is neither.
      buzzSaved();
      writeSticky(storage(), category, submitted.current);
      // The entry exists now, so the draft of it is not a draft of anything (§5.5). This also
      // bumps the draft generation, which is what remounts the fields onto the new sticky
      // defaults rather than the ones they were mounted with.
      if (pending.current) clearTimeout(pending.current);
      clearDraft(storage(), category);
      setRestored(false);
      // React has reset the form, so nothing is unsaved and nothing is invalid any more.
      // Neither state clears itself: `useDirty` listens for `input` and a reset fires none,
      // and a blur error outlives the value that produced it (§5.2).
      clearDirty();
      clearErrors();
      return;
    }

    // A failed save must not also cost him the entry. React has already blanked the fields,
    // so put back what was typed — the message says what went wrong, and everything is still
    // there to fix and send again.
    fill(submitted.current);
  }, [state, category, fill, clearDirty, clearErrors]);

  return (
    <form
      ref={form}
      action={submit}
      // Remounts on category change, so switching tabs clears the previous category's values
      // instead of leaving them to be submitted by accident. The generation does the same
      // after a successful save.
      key={`${category.key}-${sticky.version}-${draft.version}`}
      // Delegated, not per input (§5.2). `blur` does not bubble, but React's synthetic `onBlur`
      // is `focusout` underneath and does — which is the whole reason one handler here can
      // validate ~30 fields, including the ones inside generated row groups that do not exist
      // when this renders.
      onBlur={handlers.onBlur}
      onInput={(event) => {
        handlers.onInput(event);
        // The draft rides the delegated handler that already exists (§5.5). A second listener
        // — or thirty per-field ones — would be a second place for "what is in this form" to
        // be computed, and this one is already the answer.
        keep();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="category" value={category.key} />

      {/* A restored draft **says so** (§5.5, Q394).
          Sticky values pretend to be defaults, which is safe because they are context. A draft
          carries measurements, and a number that was typed yesterday must not read as one
          measured today — so it is announced, and discarding it is one tap. */}
      {restored && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-highlight/40 bg-highlight/5 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Picked up where you left off. Nothing here has been saved yet.
          </p>
          <button
            type="button"
            onClick={discardDraft}
            className="min-h-11 press rounded-control px-2 text-xs text-primary transition-colors duration-fast ease-standard hover:underline"
          >
            Start fresh
          </button>
        </div>
      )}

      {category.fields.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {category.fields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              defaultValue={defaults[field.name]}
              chips={chips[field.name]}
              onPick={fill}
              onValueChange={field.name === shapeName ? setShape : undefined}
              error={errors[field.name]}
            />
          ))}
        </div>
      )}

      {category.rows && <RowFields group={category.rows} shape={shape} onPick={fill} />}

      {/* Only where a sentence maps onto fields (§4.3). Training is the category with numbers
          worth dictating; a note is already one text box and a microphone on the keyboard. */}
      {category.key === "athletics" && <VoiceEntry onParsed={fillSpoken} />}

      {/* Free tags, orthogonal to the category (V4 Phase 3, §2.3) — not declared per category
          like `chips`/`sticky`, because every category can take them and a category-scoped
          version would be the fixed-list problem tags exist to solve, one level down. */}
      <TagInput suggestions={tagSuggestions} />

      {/* The same shell every other field uses, so the label row is not a fourth spelling of
          one idea. `optional` is marked and required is not (Q248) — and here that is not a
          formality: the note is the field most often left empty. */}
      <FieldShell
        label="Note"
        htmlFor={noteId}
        optional
        action={<DictateButton targetId={noteId} />}
      >
        <textarea
          id={noteId}
          name="note"
          rows={2}
          // An example, never a label (Q247). The label is above and is a real `<label>`.
          placeholder="Anything worth remembering"
          className={`${INPUT} resize-y`}
        />
      </FieldShell>

      {/* Phase N5. Silent until a save has been running for six seconds, at which point the
          difference between "slow" and "crashed" is the difference between waiting and closing
          the app on an entry that has not landed. */}
      <SlowSaveNotice />

      {/* Silent at two or fewer, which is what makes it safe to mount unconditionally (Q250). */}
      <ErrorSummary errors={summary} />

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

        {/* Q289 — saved, queued and failed differ in icon, word and weight rather than in
            colour alone. This was one mono sentence tinted two ways, on the surface where
            "did that land?" is the only question the reader has.

            `state.queued` is set by the offline writer and by nothing else. Saying "Saved"
            about a row the server has never seen is the lie §1.7 exists to stop telling, and
            the flag is what makes the distinction a fact rather than a guess at the copy. */}
        {state && (
          <SaveState
            state={!state.ok ? "failed" : state.queued ? "queued" : "saved"}
            message={state.message}
          />
        )}
      </div>

      {/* Pinned to the bottom of the viewport, on a phone, only while there is something to
          save (Q251, Q252). It carries a second `SaveButton` submitting this same form rather
          than moving the first one, because the desktop layout has no bar to move it into. */}
      <StickySave dirty={dirty}>
        <SaveButton label={category.label} compact />
      </StickySave>
    </form>
  );
}
