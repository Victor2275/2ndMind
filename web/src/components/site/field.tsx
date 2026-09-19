"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ClipboardIcon, HashIcon, PinIcon } from "lucide-react";

/**
 * The form vocabulary (V4 §5.2, Q245–Q256).
 *
 * `LogForm` is 686 lines and is the most-used surface in the app (Q243), and every form in
 * `web/` had invented its own label, its own control class chain and its own idea of how big a
 * tap target is. Collecting them is not tidying: the answers to Q245–Q256 are *rules*, and a
 * rule that lives in eleven copies is a rule that holds in eight of them.
 *
 * ## The rules, and which question each comes from
 *
 * - **Labels above the field, always** (Q246). Not floating, not beside.
 * - **A placeholder is never a label** (Q247). It is an example, it disappears when you type,
 *   and it is invisible to a screen reader as a name. `Field` takes both and they are separate
 *   arguments, so getting this wrong requires trying.
 * - **Optional is marked; required is not** (Q248). Every field in the quick log is optional by
 *   design, so marking required would be marking nothing; marking optional says something.
 * - **48px controls on touch** (Q245). `CONTROL` below is `min-h-12`, which is 48px, not the
 *   44px floor DESIGN.md §9 sets — §9 is the floor for anything tappable, and a field you aim
 *   at one-handed between sets gets the larger number.
 * - **Validation on blur** (Q249), errors **below the field**, and a summary once there are
 *   more than two (Q250).
 *
 * ## The four shortcut kinds, made visually distinct (Q253)
 *
 * D-155 declares four shortcuts per field — `sticky`, `chips`, `keypad`, `clipboard` — and
 * Q253's verdict was that they are not distinguishable from each other. They were not: `chips`
 * rendered pills, `clipboard` rendered the word "paste" at 0.55rem, and `sticky` and `keypad`
 * rendered nothing at all, so two of the four were invisible and the other two looked unrelated.
 *
 * The rule that separates them is **whether you do them or they happen to you**:
 *
 * | | | |
 * |---|---|---|
 * | `sticky` | passive | a pin on the label row — this value was carried from last time |
 * | `keypad` | passive | a hash on the label row — this field will raise a number pad |
 * | `chips` | active | tokens under the field, tappable, filled when chosen |
 * | `clipboard` | active | a bordered icon button on the label row |
 *
 * Passive marks are `--faint-foreground`, carry a `title` *and* an `aria-label`, and are not
 * tappable. Active ones are real controls at a real size. So the two you can act on look like
 * controls and the two you cannot look like annotations, which is the distinction that was
 * missing rather than four arbitrary colours.
 */

/* ------------------------------------------------------------------------------------------
   The control itself
   ------------------------------------------------------------------------------------------ */

/**
 * The look of a control, **with no width in it** (D-219).
 *
 * `w-full` used to be part of the equivalent string in `log-form.tsx`, and every call site that
 * wanted a narrower control wrote `${INPUT} w-16`. Those two utilities have identical
 * specificity, so the winner is Tailwind's emit order rather than the order they are written in
 * — `w-full` won, and a unit select took the whole row. Keeping the width out is the fix that
 * cannot come back.
 *
 * `min-h-12` is Q245's 48px. `text-base` and not `text-sm` below `tablet` is deliberate and is
 * not a size preference: 16px is the threshold under which iOS Safari zooms the viewport on
 * focus, and a form that zooms on every field is a form that is fought rather than filled.
 */
export const CONTROL =
  "min-h-12 rounded-control border border-border bg-card/60 px-3 py-2 text-base text-foreground transition-colors duration-fast ease-standard focus:border-primary/60 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 tablet:text-sm";

/** The same control, taking the width of its column. The common case. */
export const CONTROL_FULL = `${CONTROL} w-full`;

/** A label. `eyebrow` is the app's one small-tracked-caps value (§1.6). */
export const FIELD_LABEL = "eyebrow text-muted-foreground";

/* ------------------------------------------------------------------------------------------
   Field — label above, error below, shortcuts marked
   ------------------------------------------------------------------------------------------ */

export type ShortcutKind = "sticky" | "keypad";

export function Field({
  label,
  htmlFor,
  optional = false,
  error,
  marks = [],
  action,
  chips,
  children,
  className = "",
}: {
  label: string;
  /** The control's id. Required: a label that labels nothing is decoration (Q246). */
  htmlFor: string;
  /** Q248 — optional is marked, required is not. */
  optional?: boolean;
  /** Shown below the control, per Q250. */
  error?: string | null;
  /** The passive shortcuts this field has (Q253). */
  marks?: readonly ShortcutKind[];
  /** The active shortcut on the label row — the paste button, and nothing else so far. */
  action?: ReactNode;
  /** The active shortcut under the control: recent values as tokens. */
  chips?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <label className={FIELD_LABEL} htmlFor={htmlFor}>
          {label}
          {optional && (
            // Not `(optional)` in the label text: a screen reader would read it as part of the
            // field's name on every focus, and it is a property of the field rather than what
            // the field is called.
            <span className="ml-1 font-normal text-faint-foreground normal-case">optional</span>
          )}
        </label>

        <span className="flex items-center gap-1.5">
          {marks.map((mark) => (
            <ShortcutMark key={mark} kind={mark} />
          ))}
          {action}
        </span>
      </div>

      <div className="mt-1">{children}</div>

      {chips}

      {error && (
        // Below the field, per Q250, and `alert` so it is announced when blur produces it
        // rather than waiting for the next thing the reader focuses.
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The passive half of Q253 — an annotation, not a control.
 *
 * `title` **and** `aria-label`, because `title` is invisible on a phone (D-191's audit is about
 * exactly that) and this is a phone-first app. The mark is not the only way to learn either
 * fact — a sticky field arrives pre-filled and a keypad field raises the keypad — so it is a
 * confirmation of something already visible rather than the sole carrier of it.
 */
function ShortcutMark({ kind }: { kind: ShortcutKind }) {
  const { Icon, said } = MARK[kind];
  return (
    <span title={said} aria-label={said} role="img" className="text-faint-foreground">
      <Icon aria-hidden className="size-3" />
    </span>
  );
}

const MARK = {
  sticky: { Icon: PinIcon, said: "Kept from last time" },
  keypad: { Icon: HashIcon, said: "Opens a number pad" },
} as const;

/**
 * The active half — a real button at a real size.
 *
 * It was the word "paste" at `text-[0.55rem]`, which is a 7px tap target beside a 48px field
 * and is under the 11px floor §7.1 turns into a gate.
 */
export function PasteAction({ onPaste, empty }: { onPaste: () => void; empty: boolean }) {
  return (
    <button
      type="button"
      onClick={onPaste}
      aria-label={empty ? "Nothing to paste" : "Paste into this field"}
      className="inline-flex min-h-8 press items-center gap-1 rounded-control border border-border px-2 text-xs text-muted-foreground transition-colors duration-fast ease-standard hover:border-primary/50 hover:text-foreground"
    >
      <ClipboardIcon aria-hidden className="size-3" />
      {empty ? "nothing to paste" : "paste"}
    </button>
  );
}

/* ------------------------------------------------------------------------------------------
   Chips — tokens, filled when chosen (Q255, Q256)
   ------------------------------------------------------------------------------------------ */

/**
 * A recent value, one tap away.
 *
 * Q255 asked for these to look like **tokens rather than buttons**, and Q256 for a chosen one
 * to be **filled**. The two together are the whole spec: a token is a pill with a hairline and
 * no button chrome, and choosing one fills it rather than ticking it, because a tick needs
 * somewhere to put the tick and these are 8px of horizontal room on a 390px screen.
 *
 * `min-h-11` is DESIGN.md §9's 44px. The old chip was `min-h-8` — 32px — with a comment saying
 * a 24px chip is a miss, which was right about the direction and stopped short of the number.
 */
export function Chip({
  children,
  selected = false,
  onClick,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-11 press rounded-full border px-3 text-sm transition-colors duration-fast ease-standard ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** The row chips sit in, under the control they fill. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>;
}

/* ------------------------------------------------------------------------------------------
   Errors — below the field, and a summary once there are more than two (Q250)
   ------------------------------------------------------------------------------------------ */

/**
 * The summary above the save button.
 *
 * Q250: *below the field, plus a summary if more than two*. Two is the threshold because up to
 * two errors are both visible without scrolling on a phone, and past that the reader is
 * hunting — which is the failure a summary exists to prevent, not a second copy of the message.
 *
 * Renders nothing at two or fewer, which is what makes it safe to mount unconditionally.
 */
export function ErrorSummary({
  errors,
}: {
  errors: readonly { field: string; message: string }[];
}) {
  if (errors.length <= 2) return null;

  return (
    <div
      role="alert"
      className="rounded-control border border-destructive/40 bg-destructive/5 px-3 py-2"
    >
      <p className="text-sm font-medium text-foreground">
        {errors.length} fields need another look.
      </p>
      <ul className="mt-1 space-y-0.5">
        {errors.map((error) => (
          <li key={error.field} className="text-xs text-muted-foreground">
            <span className="text-foreground">{error.field}</span> — {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------
   Dirty tracking and the sticky save (Q251, Q252)
   ------------------------------------------------------------------------------------------ */

/**
 * Whether anything in a form has been typed into since it was mounted or last reset.
 *
 * Listens for `input` on the form rather than tracking per-field state, which is what keeps
 * every input in this app **uncontrolled**. That is not a style preference: an uncontrolled
 * form is what lets a failed save put back exactly what was typed (`log-form.tsx` relies on it),
 * and lifting every value into React to answer one boolean would trade that for a dirty dot.
 *
 * `reset` is exposed rather than watched for, because React resets a `<form action={fn}>` itself
 * after a successful action and fires no event this could hear.
 */
export function useDirty(form: React.RefObject<HTMLFormElement | null>): {
  dirty: boolean;
  clear: () => void;
} {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const element = form.current;
    if (!element) return;

    const mark = () => setDirty(true);
    // `input` rather than `change`: `change` on a text field does not fire until blur, so a
    // form abandoned mid-word would report itself clean.
    element.addEventListener("input", mark);
    return () => element.removeEventListener("input", mark);
  }, [form]);

  const clear = useCallback(() => setDirty(false), []);
  return { dirty, clear };
}

/**
 * The save, pinned to the bottom of the viewport on a long form (Q251).
 *
 * **Only while the form is dirty and only on a phone.** Q251 asked for a sticky save on long
 * forms and the trap is making it unconditional: a bar that is always there costs 56px of the
 * vertical space D-083 spent a whole feature reclaiming, on every screen, to offer a button
 * that does nothing until something has been typed. Appearing when there is something to save
 * means it is never in the way and never missed.
 *
 * It sits **above the tab bar**, using the same height the toaster does, for the same reason:
 * covering the navigation to offer a save is trading one control for another.
 *
 * `dirty` also drives the indicator Q252 asks for — the dot below is the whole of it, because
 * the bar's presence already says "unsaved" and a second sentence saying so is prose.
 */
export function StickySave({ dirty, children }: { dirty: boolean; children: ReactNode }) {
  if (!dirty) return null;

  return (
    <div
      // `phone-only`, the app's own display switch — Tailwind's `sm:hidden` does not work here
      // (see `globals.css`), and this is the pattern the nav was hand-written to avoid it with.
      className="phone-only fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))] backdrop-blur-md print:hidden"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-highlight"
          // Amber, and this is the one thing in the app that earns it besides staleness: an
          // unsaved form is attention, which is exactly what D-196 reserved the colour for.
        />
        <span className="text-xs text-muted-foreground">Not saved yet</span>
        <span className="ml-auto">{children}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------
   Blur validation (Q249)
   ------------------------------------------------------------------------------------------ */

/**
 * Validate on blur, clear on input.
 *
 * Q249 chose blur over live and over submit, and the reason blur is right here is that every
 * field in the quick log is optional: live validation would flag a half-typed `2:1` as a bad
 * duration on the way to `2:17`, and submit-time validation would mean typing six fields and
 * being told about the second one afterwards.
 *
 * The **clear on input** half is the part that is easy to leave out and is what makes blur
 * bearable: once a field has been flagged, the message goes the moment it is touched again,
 * rather than sitting there contradicting what is now on screen.
 *
 * `rules` is a plain map from field name to a validator returning a message or null. It takes
 * no schema library: the only forms in this app that validate are the two the log uses, the
 * server re-validates everything with zod regardless, and this runs in a client chunk.
 */
export function useBlurValidation(rules: Record<string, (value: string) => string | null>): {
  errors: Record<string, string>;
  handlers: { onBlur: React.FocusEventHandler; onInput: React.FormEventHandler };
  summary: { field: string; message: string }[];
  clear: () => void;
} {
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * The rules, held where the handlers can read them without depending on them.
   *
   * They are a fresh object literal at most call sites, so putting them in the `useCallback`
   * dependency lists would rebuild both handlers on every render — and these are attached to a
   * form, so that is a new listener pair per keystroke.
   *
   * **Written in an effect, not during render.** Assigning to a ref while rendering is what
   * `react-hooks/refs` forbids, and the reason is not stylistic: a render can be thrown away or
   * replayed, and a ref mutated during one is a side effect that escaped it. The effect runs
   * after every commit, and the handlers only read this at event time — which is always after a
   * commit — so nothing can observe the one-render gap.
   */
  const current = useRef(rules);
  useEffect(() => {
    current.current = rules;
  });

  const onBlur = useCallback<React.FocusEventHandler>((event) => {
    const target = event.target as HTMLInputElement;
    const rule = current.current[target.name];
    if (!rule) return;
    const message = rule(target.value);
    setErrors((existing) => {
      if (message === null) {
        if (!(target.name in existing)) return existing;
        const { [target.name]: _removed, ...rest } = existing;
        return rest;
      }
      if (existing[target.name] === message) return existing;
      return { ...existing, [target.name]: message };
    });
  }, []);

  const onInput = useCallback<React.FormEventHandler>((event) => {
    const target = event.target as HTMLInputElement;
    setErrors((existing) => {
      if (!(target.name in existing)) return existing;
      const { [target.name]: _removed, ...rest } = existing;
      return rest;
    });
  }, []);

  const clear = useCallback(() => setErrors({}), []);

  const summary = Object.entries(errors).map(([field, message]) => ({ field, message }));

  return { errors, handlers: { onBlur, onInput }, summary, clear };
}
