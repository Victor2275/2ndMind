import { Stat } from "@/components/site/page-shell";
import type {
  Challenge,
  ChallengeDay,
  ChallengeGoal,
  ChallengeProgress,
  ChallengeWeek,
} from "@/lib/athletics/challenge";

/**
 * The Fall 2026 challenge, on screen.
 *
 * Three panels, in the order the thesis demands — what you do today, then how the ledger
 * stands, then the four goals it is all for. Everything here is read-only rendering; the one
 * thing you can *act* on is the routine checklist, which is its own component and holds the
 * page's `data-first-action` marker.
 *
 * Every number comes from one of two places and they are never mixed: the *plan* (parsed from
 * the vault) or the *ledger* (summed from logged sets). Where a panel shows both, it says which
 * is which. A card that claimed a session Victor had not logged would make the whole thing
 * worthless as a record, and the Instagram day cards are generated from the ledger side.
 */

/** The nine session types, as a colour and a word. Amber is reserved (D-196) and unused here. */
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

function km(meters: number): string {
  if (meters >= 1000) {
    const value = meters / 1000;
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}k`;
  }
  return `${Math.round(meters)}`;
}

/* ------------------------------------------------------------------------ today */

/**
 * Today's prescription.
 *
 * `day` being null is not an error state — it is every day before 20 September and after
 * 4 December, and it says so rather than rendering an empty card.
 */
export function ChallengeToday({
  day,
  week,
  challenge,
  logged,
}: {
  day: ChallengeDay | null;
  week: ChallengeWeek | null;
  challenge: Challenge;
  /** Metres logged today, credit applied. Null when the database could not be read. */
  logged: number | null;
}) {
  if (!day) {
    return (
      <p className="text-sm text-muted-foreground">
        Outside the challenge window. It runs {challenge.start} to {challenge.end}.
      </p>
    );
  }

  const done = logged !== null && logged >= day.meters;
  const short = logged !== null && logged > 0 && logged < day.meters;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tabular font-mono text-xs text-muted-foreground">
          Day {day.day} of {challenge.days - 1}
        </span>
        {week && <span className="text-xs text-muted-foreground">· {week.name}</span>}
        <span
          className={`rounded border px-1.5 py-0.5 eyebrow ${TYPE_TONE[day.type]}`}
          title="Session type — drives the stretching routine"
        >
          {day.type}
        </span>
      </div>

      <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{day.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{day.detail}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="tabular font-mono text-sm text-foreground">
          {day.meters.toLocaleString()} m planned
        </span>
        {logged !== null && (
          <span
            className={`tabular font-mono text-sm ${done ? "text-primary" : "text-muted-foreground"}`}
          >
            {logged.toLocaleString()} m logged
          </span>
        )}
      </div>

      {/* The plan is a target, not a floor — rule 2 averages across the whole challenge. So a
          short day is reported without a warning colour; only a day with nothing at all in it
          is worth a nudge, and that is what the streak panel is for. */}
      {short && (
        <p className="mt-2 text-xs text-muted-foreground">
          Short of the plan by {(day.meters - logged).toLocaleString()} m. The average is the
          ledger, not the day.
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- the ledger */

export function ChallengeLedger({
  challenge,
  progress,
}: {
  challenge: Challenge;
  progress: ChallengeProgress;
}) {
  const pct = Math.min(100, (progress.loggedM / progress.requiredTotalM) * 100);
  // Where the pace line sits on the same bar. This is what makes the bar say something a
  // number cannot: whether the fill is in front of the marker or behind it.
  const pacePct = Math.min(100, (progress.paceM / progress.requiredTotalM) * 100);
  const ahead = progress.bankM >= 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Streak"
          value={`${progress.streak}`}
          hint={`longest ${progress.longestStreak}`}
          tone={progress.streak > 0 ? "accent" : "default"}
        />
        <Stat
          label="Logged"
          value={km(progress.loggedM)}
          hint={`of ${km(progress.requiredTotalM)} required`}
        />
        <Stat
          label={ahead ? "Ahead by" : "Behind by"}
          value={km(Math.abs(progress.bankM))}
          hint="against 5k a day"
          tone={ahead ? "accent" : "default"}
        />
        <Stat
          label="Needed / day"
          value={progress.neededPerDayM === 0 ? "—" : progress.neededPerDayM.toLocaleString()}
          hint={`over ${progress.daysRemaining} days left`}
        />
      </div>

      <div className="mt-5">
        <div
          className="relative h-3 w-full overflow-hidden rounded-full border border-border bg-card"
          role="img"
          aria-label={`${Math.round(pct)} percent of the required ${progress.requiredTotalM.toLocaleString()} metres logged`}
        >
          <div
            className="h-full rounded-full bg-primary/70 transition-[width] duration-slow"
            style={{ width: `${pct}%` }}
          />
          {/* The pace marker. Deliberately a hairline rather than a second fill: two bars
              stacked read as a comparison of two quantities, and this is one quantity against
              a moving threshold. */}
          <span
            aria-hidden
            className="absolute inset-y-0 w-px bg-foreground/60"
            style={{ left: `${pacePct}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="tabular font-mono text-[0.65rem] text-muted-foreground">
            {progress.loggedM.toLocaleString()} / {progress.requiredTotalM.toLocaleString()} m · day{" "}
            {progress.daysElapsed} of {progress.daysTotal}
          </p>
          <p className="tabular font-mono text-[0.65rem] text-muted-foreground">
            plan to date {progress.plannedToDateM.toLocaleString()} m
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        The line on the bar is where 5,000 m a day would have you. The plan lays down{" "}
        {km(challenge.plannedTotalM)} against a requirement of {km(challenge.requiredTotalM)} — the
        surplus is {km(challenge.plannedTotalM - challenge.requiredTotalM)}, so rule 2 is not what
        will stop this.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------------- the goals */

export function ChallengeGoals({ goals }: { goals: ChallengeGoal[] }) {
  if (goals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No goals found in the vault. They are read from the{" "}
        <span className="text-foreground">Goals</span> table of{" "}
        <code className="font-mono text-xs">fall_2026_challenge.md</code>.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {goals.map((goal) => (
        <li key={goal.key} className="card-scan rounded-lg border border-border bg-card/70 p-4">
          <p className="eyebrow text-muted-foreground">{goal.key}</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">{goal.goal}</h3>
          <p className="tabular mt-2 font-mono text-sm text-primary">{goal.target}</p>
          <p className="tabular mt-2 font-mono text-[0.6rem] text-muted-foreground">
            {goal.window} · {goal.measuredBy}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------- faults */

/**
 * Vault arithmetic that no longer adds up.
 *
 * The plan is hand-written markdown and its totals are hand-set, so an edit that adds a day or
 * changes a distance leaves §1 claiming something §4 no longer supports. Saying so is the whole
 * point: a plan that silently lost a week is worse than one that admits it. Amber, because this
 * is the attention colour and nothing else may use it (D-196).
 */
export function ChallengeFaults({ faults }: { faults: string[] }) {
  if (faults.length === 0) return null;

  return (
    <div className="mt-4 rounded-md border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm">
      <p className="font-medium text-foreground">The plan file does not add up.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        {faults.map((fault) => (
          <li key={fault}>{fault}</li>
        ))}
      </ul>
    </div>
  );
}
