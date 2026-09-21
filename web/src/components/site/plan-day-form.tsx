"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";

import { savePlanDayAction } from "@/app/private/athletics/actions";
import { useAnnounce } from "@/components/site/announcer";
import { CONTROL_FULL, Field, StickySave, useDirty } from "@/components/site/field";
import { SaveState } from "@/components/site/states";
import type { ChallengeDay, SessionType } from "@/lib/athletics/challenge";

/**
 * Change one day of the plan (D-276).
 *
 * **Exactly one of these is mounted at a time**, for the day named by `?edit=` in the URL. The
 * plan screen is 76 rows and every one of them is editable; rendering 76 client forms would put
 * a hydration boundary on each, which is the cost the projects grid was restructured to avoid
 * (D-223). A link sets the search param, the server renders this form inside that one row, and
 * the other 75 stay static HTML.
 *
 * **Every input is empty, with the vault's value as its placeholder.** That is the whole
 * mechanism for "leave this alone": an empty field writes null and the parsed plan shows
 * through. Pre-filling them with the plan's text would mean submitting an untouched form wrote
 * a copy of the plan as an override, and the day would be badged as changed when nothing had
 * been. The trade is that editing *part* of a sentence means retyping it, which for a one-line
 * prescription is the cheaper of the two mistakes.
 */

const TYPES: { value: SessionType | ""; label: string }[] = [
  { value: "", label: "Leave as planned" },
  { value: "base", label: "base — steady distance" },
  { value: "long", label: "long — the week's long piece" },
  { value: "quality", label: "quality — intervals" },
  { value: "strength", label: "strength — short erg, then lift" },
  { value: "water", label: "water — boat practice" },
  { value: "recovery", label: "recovery — deliberately easy" },
  { value: "test", label: "test — time trial" },
  { value: "race", label: "race" },
  { value: "epic", label: "epic — the 50k or the 100k" },
];

export function PlanDayForm({ day, note }: { day: ChallengeDay; note: string }) {
  const [state, action, pending] = useActionState(savePlanDayAction, null);
  useAnnounce(state);
  const form = useRef<HTMLFormElement>(null);
  const { dirty } = useDirty(form);

  // What the vault says, which is what the placeholders advertise. On a day that has already
  // been changed, `planned` holds the original and `day` holds the override — so the
  // placeholders keep pointing at the plan rather than at the last thing typed.
  const plan = day.planned ?? day;

  return (
    <form ref={form} action={action} className="mt-4 space-y-4">
      <input type="hidden" name="day" value={day.date} />

      <Field label="Session name" htmlFor="plan-name" optional>
        <input id="plan-name" name="name" className={CONTROL_FULL} placeholder={plan.name} />
      </Field>

      <Field label="What to do" htmlFor="plan-detail" optional>
        <textarea
          id="plan-detail"
          name="detail"
          rows={2}
          className={`${CONTROL_FULL} min-h-20`}
          placeholder={plan.detail}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Session type" htmlFor="plan-type" optional>
          <select id="plan-type" name="type" className={CONTROL_FULL} defaultValue="">
            {TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {/* Said out loud because it is the one non-obvious consequence of this field: the
              stretching routine is chosen by the session type, so changing one changes both. */}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Changes today&apos;s stretching routine too — it is chosen by type.
          </p>
        </Field>

        <Field label="Distance" htmlFor="plan-meters" optional>
          <input
            id="plan-meters"
            name="meters"
            inputMode="numeric"
            className={CONTROL_FULL}
            placeholder={`${plan.meters} m`}
          />
        </Field>
      </div>

      <Field label="Why" htmlFor="plan-note" optional>
        <input
          id="plan-note"
          name="note"
          className={CONTROL_FULL}
          defaultValue={note}
          placeholder="Perg was taken, so this is an erg"
        />
      </Field>

      {state && <SaveState state={state.ok ? "saved" : "failed"} message={state.message} />}

      {/* Two submit buttons, deliberately — the same pattern and the same reason as `LogForm`:
          `StickySave` is phone-only, so a form relying on it alone has no save on a desktop.
          They submit the same form, so there is no second path to keep in step, and they carry
          different accessible names because two identical answers to "what can I do here" is a
          bug for a screen reader and for `getByRole`. */}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 press rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>

        <Link
          href="/private/athletics/plan"
          className="grid min-h-12 press place-items-center rounded-control border border-border px-4 text-sm text-muted-foreground"
        >
          Cancel
        </Link>
      </div>

      <StickySave dirty={dirty}>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 press rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Save
        </button>
      </StickySave>

      <p className="text-xs text-muted-foreground">
        Leave everything empty and save to put this day back to the plan. The vault file is never
        rewritten — changes live beside it.
      </p>
    </form>
  );
}
