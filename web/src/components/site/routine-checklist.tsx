import { toggleRehabAction } from "@/app/private/athletics/actions";
import { movementSlug, type Routine } from "@/lib/athletics/challenge";

/**
 * Today's stretching routine, one of fifteen, chosen by what the day asks of the body.
 *
 * **This replaces the rehab checklist** (V4 Phase 5.4+, D-271). The lower-back protocol is not
 * gone — its four movements are distributed across the routines in §6 of the challenge file, so
 * at least one lands nearly every day instead of all four landing in their own box. What was
 * lost by having a separate checklist was that it asked for the same four things after a 25k and
 * after a rest day.
 *
 * **It writes to `rehab_completions` and that is deliberate.** The table is a completion row per
 * slug per day with a tombstone and a sync entity already built, which is exactly what this
 * needs. Repointing a synced table at new slugs costs nothing; migrating to a second table with
 * identical columns would have meant a schema change, a new sync entity, a new offline store and
 * a new apply branch, for no behaviour that differs. Routine slugs are namespaced
 * `routine/movement`, so they cannot collide with the legacy protocol slugs still in the table.
 *
 * A Server Component with one small form per movement: no `"use client"`, no JavaScript, and it
 * works before hydration — the same trade the rehab list made, for the same reason. At five or
 * six items a day, an optimistic client version would add a hydration boundary and a loading
 * state to save perhaps 200 ms on a page that is already streaming.
 */

export type RoutineState = {
  routine: Routine | null;
  /** Slugs already ticked today, as stored — namespaced `routine/movement`. */
  done: Set<string>;
  /** The local day this list is for, posted back so the tick lands on the day shown. */
  day: string;
  /** Ticks per day over the trailing window, oldest first, for the streak strip. */
  history: { day: string; done: number; total: number }[];
};

function Movement({
  routine,
  movement,
  day,
  done,
}: {
  routine: Routine;
  movement: Routine["movements"][number];
  day: string;
  done: boolean;
}) {
  return (
    <li>
      <form action={toggleRehabAction}>
        <input type="hidden" name="day" value={day} />
        <input type="hidden" name="slug" value={movementSlug(routine, movement)} />
        <button
          type="submit"
          aria-pressed={done}
          className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/40 ${
            done ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          <span
            aria-hidden
            className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border font-mono text-[0.6rem] leading-none transition-colors ${
              done ? "border-primary bg-primary/20 text-primary" : "border-border text-transparent"
            }`}
          >
            ✓
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-sm ${done ? "line-through" : ""}`}>{movement.name}</span>
            {movement.prescription && (
              <span className="tabular block font-mono text-[0.6rem] text-muted-foreground">
                {movement.prescription}
              </span>
            )}
          </span>
        </button>
      </form>
    </li>
  );
}

export function RoutineChecklist({
  routine,
  done,
  day,
  history,
  firstAction = true,
}: RoutineState & {
  /**
   * Whether this copy claims the page's `data-first-action` marker.
   *
   * True on `/private/athletics`, where the ticks are the only thing you can do. False on the
   * Today mirror, where the capture box already holds it — two markers on one page makes
   * `npm run shots` measure whichever it finds last, which is how a passing fold gate starts
   * reporting a number about the wrong element (D-190, and the bug the rehab mirror shipped
   * with).
   */
  firstAction?: boolean;
}) {
  // The marker sits on both branches deliberately (V3 §3.2). If it were only on the populated
  // branch, a vault rename that empties this list would make the fold check report "no marker"
  // and the page would go on passing while its one action was gone.
  if (!routine || routine.movements.length === 0) {
    return (
      <p data-first-action={firstAction ? "" : undefined} className="text-sm text-muted-foreground">
        No routine for today. The rotation is read from the{" "}
        <span className="text-foreground">Stretching Routines</span> section of{" "}
        <code className="font-mono text-xs">fall_2026_challenge.md</code> — if that heading was
        renamed, or today is outside the challenge window, this goes quiet rather than guessing.
      </p>
    );
  }

  const ticked = routine.movements.filter((movement) =>
    done.has(movementSlug(routine, movement)),
  ).length;
  const complete = ticked === routine.movements.length;

  return (
    <div data-first-action={firstAction ? "" : undefined}>
      {/* §7.1 text-floor allowlist (Q113): the routine's duration and pool, set opposite its
          name. The name is the heading; this is the shape of the session beside it. */}
      <div
        data-tiny-text="routine duration and pool, opposite the routine name"
        className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
      >
        <p className="text-sm font-semibold text-foreground">{routine.name}</p>
        <p className="tabular font-mono text-[0.65rem] text-muted-foreground">
          {routine.minutes} min · {routine.pool}
        </p>
      </div>

      {/* The 7.1 text-floor allowlist (Q113). Two things under the floor here: the tick
          glyph, which is sized by its 16px box rather than chosen, and the prescription
          under each movement ("15 per side, knee travel"), which is detail you read once
          and then stop reading. The movement name above it is `text-sm`. */}
      <ul
        data-tiny-text="tick glyph sized by its box; prescription is read-once detail"
        className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60"
      >
        {routine.movements.map((movement) => (
          <Movement
            key={movement.slug}
            routine={routine}
            movement={movement}
            day={day}
            done={done.has(movementSlug(routine, movement))}
          />
        ))}
      </ul>

      {/* 7.1 text-floor allowlist (Q113): the progress line and the fortnight strip. The
          checklist above is the screen; this is its footer. */}
      <div
        data-tiny-text="routine progress footer and fortnight strip"
        className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
      >
        <p className="font-mono text-[0.6rem] text-muted-foreground">
          {complete ? (
            <span className="text-primary">Routine done.</span>
          ) : (
            `${ticked} of ${routine.movements.length} done today.`
          )}
        </p>

        {/* A fortnight at a glance. Filled where the whole routine was completed, part-way where
            some of it was — a half-done day should not read the same as a skipped one. Each day
            is measured against *its own* routine's length, because the routines differ in size
            and a shared denominator would make a finished six-item day look incomplete. */}
        <span className="flex items-center gap-1" aria-hidden>
          {history.map((entry) => {
            const ratio = entry.total === 0 ? 0 : entry.done / entry.total;
            return (
              <span
                key={entry.day}
                title={`${entry.day}: ${entry.done}/${entry.total}`}
                className={`h-2.5 w-2.5 rounded-sm ${
                  ratio >= 1 ? "bg-primary" : ratio > 0 ? "bg-primary/40" : "border border-border"
                }`}
              />
            );
          })}
        </span>
      </div>
    </div>
  );
}
