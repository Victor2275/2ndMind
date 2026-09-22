import Link from "next/link";

import { dayFor, isoDay, type ChallengeDay } from "@/lib/athletics/challenge";
import { loadPlan } from "@/lib/athletics/plan";

/**
 * Today's prescribed session, on the screen you open to train (D-276).
 *
 * Victor's ask was "the workouts should be viewable from the Train tab" — the tab that writes,
 * not the record board two tabs over. This is that card: what to do, how far, and the routine
 * that goes with it, above the logger.
 *
 * **Compact on purpose.** This screen is used standing at a rack and the first set input is the
 * thing that matters on it; a full plan panel here would push that off a phone. The whole plan
 * is one tap away and says so.
 *
 * Renders nothing outside the challenge window, and nothing if the plan cannot be read — a
 * missing card on the logging screen is a non-event, and `/private/athletics/plan` is where a
 * parse failure is reported properly. Wrapped in `Suspense` by its caller so the logger never
 * waits for this read.
 */

const TYPE_TONE: Record<ChallengeDay["type"], string> = {
  base: "border-border text-muted-foreground",
  long: "border-primary/50 text-primary",
  quality: "border-primary/50 text-primary",
  strength: "border-border text-muted-foreground",
  water: "border-border text-muted-foreground",
  recovery: "border-border text-muted-foreground",
  test: "border-primary text-primary",
  race: "border-primary text-primary",
  epic: "border-primary text-primary",
};

export async function PlannedToday() {
  const { challenge, routines } = await loadPlan();
  if (!challenge) return null;

  const today = isoDay(new Date());
  const day = dayFor(challenge, today);
  if (!day) return null;

  const routine = routines.get(day.day) ?? null;

  return (
    // 7.1 text-floor allowlist (Q113): the prescription line for today's session, under
    // the session name. Same role as the routine checklist's, and the same reason.
    <section
      data-tiny-text="today's prescription line, under the session name"
      className="mt-6 rounded-lg border border-border bg-card/60 p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="eyebrow text-muted-foreground">Today&apos;s session</span>
        <span className="tabular font-mono text-xs text-muted-foreground">
          day {day.day} of {challenge.days - 1}
        </span>
        {day.planned && <span className="eyebrow text-highlight">changed</span>}

        <span className="ml-auto flex items-center gap-2">
          <span className="tabular font-mono text-xs text-foreground">
            {day.meters.toLocaleString()} m
          </span>
          <span className={`rounded border px-1.5 py-0.5 eyebrow ${TYPE_TONE[day.type]}`}>
            {day.type}
          </span>
        </span>
      </div>

      <p className="mt-2 text-base font-semibold tracking-tight text-foreground">{day.name}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{day.detail}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {routine && (
          <span className="tabular font-mono text-[0.65rem] text-faint-foreground">
            {routine.name} · {routine.minutes} min · no equipment
          </span>
        )}

        <span className="ml-auto flex items-center gap-3">
          <Link
            href={`/private/athletics/plan?edit=${today}#${today}`}
            className="link-wipe text-xs text-muted-foreground"
          >
            Change
          </Link>
          <Link href="/private/athletics/plan" className="link-wipe text-xs text-primary">
            Whole plan
          </Link>
        </span>
      </div>
    </section>
  );
}
