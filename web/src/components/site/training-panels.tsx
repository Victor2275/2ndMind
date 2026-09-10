import { Empty, Stat } from "@/components/site/page-shell";
import type { GoalProgress } from "@/lib/athletics/adjusted";
import { formatSplit } from "@/lib/athletics/prs";
import type { SplitGoal, SpmTarget } from "@/lib/athletics/protocol";
import type { PlanDay, SpmFlag } from "@/lib/athletics/trends";

/**
 * The read-only training views: the goal, the stroke-rate check, and the week's plan against
 * what was actually logged. All Server Components — nothing here needs state, and keeping them
 * out of the client bundle keeps the private pages streaming as HTML.
 */

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});

/**
 * Where the sub-2:00 goal stands.
 *
 * The number that carries this panel is the *required raw split* — what the monitor has to
 * read. "Sub-2:00 weight-adjusted" is not something anyone can pace to; a raw target is.
 */
/**
 * The adjusted split against the goal, as a gauge (V4 Phase 2++ Stage 7, Phase 5.6, Q405–Q414).
 *
 * ## Why a gauge and not another number
 *
 * The four `Stat` boxes below already give the numbers, and they answer *what* precisely and
 * *how close* not at all — 2:04.3 against 2:00.0 is four seconds or a season depending on what
 * you already know. A bar answers "how close" in one glance, which is the only question this
 * card is opened to ask.
 *
 * ## The scale is fixed, and that is the point
 *
 * It runs from ten seconds *above* the target to the target itself, so the bar's motion between
 * sessions is legible rather than rescaled away — a gauge that renormalises to its own data
 * shows the same picture whether you improved by a tenth or by five seconds. Past the target the
 * bar is full and says so in words; a gauge that keeps growing past its own goal has stopped
 * being a gauge.
 *
 * Colour never signals alone: the state is written out beside the bar either way.
 */
const GAUGE_RANGE_S = 10;

function SplitGauge({
  bestAdjustedS,
  targetAdjustedS,
  met,
}: {
  bestAdjustedS: number | null;
  targetAdjustedS: number;
  met: boolean;
}) {
  if (bestAdjustedS === null) {
    return (
      <p className="rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
        No piece at this distance logged yet, so there is nothing to measure against the goal.
      </p>
    );
  }

  const gap = bestAdjustedS - targetAdjustedS;
  // Full at the target, empty ten seconds off it, clamped at both ends.
  const filled = Math.max(0, Math.min(1, 1 - gap / GAUGE_RANGE_S));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="tabular font-mono text-2xl text-foreground">
          {formatSplit(bestAdjustedS)}
        </span>
        <span className="tabular font-mono text-xs text-muted-foreground">
          goal {formatSplit(targetAdjustedS)}
        </span>
      </div>

      <div
        role="meter"
        aria-valuenow={Math.round(filled * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Best adjusted split against the goal, ${Math.round(filled * 100)} per cent of the way`}
        className="mt-2 h-2.5 w-full overflow-hidden rounded-pill bg-foreground/10"
      >
        <div
          className={`h-full rounded-pill transition-[width] duration-medium ${
            met ? "bg-success" : "bg-primary"
          }`}
          style={{ width: `${filled * 100}%` }}
        />
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        {met ? (
          <span className="text-success">Goal met at this bodyweight.</span>
        ) : (
          <>
            <span className="tabular font-mono text-foreground">{gap.toFixed(1)}s</span> per 500m to
            find. The bar fills over the last {GAUGE_RANGE_S} seconds.
          </>
        )}
      </p>
    </div>
  );
}

export function GoalCard({
  goal,
  progress,
  weightSource,
}: {
  goal: SplitGoal;
  progress: GoalProgress | null;
  weightSource: "logged" | "vault";
}) {
  if (!progress) {
    return (
      <Empty>
        Record a bodyweight below and this becomes the raw split to chase on the monitor.
      </Empty>
    );
  }

  const met = progress.gapS !== null && progress.gapS <= 0;

  return (
    <div>
      <SplitGauge
        bestAdjustedS={progress.bestAdjustedS}
        targetAdjustedS={progress.targetAdjustedS}
        met={met}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Target (adjusted)"
          value={formatSplit(progress.targetAdjustedS)}
          hint={goal.milestone ? `by ${goal.milestone}` : undefined}
        />
        <Stat
          label="Raw split needed"
          value={formatSplit(progress.requiredRawS)}
          tone="accent"
          hint={`at ${progress.bodyweightLbs} lb`}
        />
        <Stat
          label="Best adjusted"
          value={progress.bestAdjustedS === null ? "—" : formatSplit(progress.bestAdjustedS)}
          hint={
            progress.bestRawS === null
              ? `no ${goal.distanceM}m piece logged`
              : `${formatSplit(progress.bestRawS)} raw`
          }
        />
        <Stat
          label="To find"
          value={progress.gapS === null ? "—" : met ? "met" : `${progress.gapS.toFixed(1)}s`}
          tone={progress.gapS === null ? "default" : met ? "accent" : "warn"}
          hint="per 500m"
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Concept2&rsquo;s adjustment multiplies an erg time by{" "}
        <span className="tabular font-mono text-foreground">{progress.factor.toFixed(4)}</span> at{" "}
        {progress.bodyweightLbs} lb
        {weightSource === "vault" && " — taken from the vault, because no reading is logged yet"}.
        It discounts lighter athletes, so{" "}
        <span className="text-foreground">putting on mass makes this target harder</span>, not
        easier. Both lines are charted below for that reason.
      </p>
    </div>
  );
}

/**
 * Stroke rates against the vault's per-distance targets.
 *
 * "Over" is shown as a flag, not a win. Rating above the 2 k band means a short stroke, which
 * is the exact weakness the vault records — "maximum length/reach".
 */
export function SpmPanel({
  flags,
  targets,
  limit = 12,
}: {
  flags: SpmFlag[];
  targets: SpmTarget[];
  limit?: number;
}) {
  if (targets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No SPM targets found in the vault. They are read from the{" "}
        <span className="text-foreground">SPM (Stroke Per Minute) Targets</span> heading of{" "}
        <code className="font-mono text-xs">benchmarks_and_logs.md</code>.
      </p>
    );
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {targets.map((target) => (
          <li
            key={target.label}
            className="tabular rounded-md border border-border bg-card/60 px-2.5 py-1.5 font-mono text-[0.65rem] text-muted-foreground"
          >
            <span className="text-foreground">{target.distanceM}m</span> {target.minSpm}–
            {target.maxSpm} spm
            {target.intent && <span className="ml-1.5 opacity-70">{target.intent}</span>}
          </li>
        ))}
      </ul>

      {flags.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No piece has a stroke rate recorded yet. The SPM field on the manual log is what feeds
          this — an erg piece without one is stored, just not checked.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60">
          {flags.slice(0, limit).map((flag, i) => (
            <li
              key={`${flag.performedAt.toISOString()}-${flag.exercise}-${i}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
            >
              <span className="tabular w-14 shrink-0 font-mono text-[0.65rem] text-muted-foreground">
                {DAY.format(flag.performedAt)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {flag.exercise}
              </span>
              <span className="tabular font-mono text-[0.65rem] text-muted-foreground">
                {Math.round(flag.distanceM)}m
              </span>
              <span
                className={`tabular font-mono text-sm ${
                  flag.status === "in range" ? "text-primary" : "text-highlight"
                }`}
              >
                {flag.spm} spm
              </span>
              <span className="tabular font-mono text-[0.6rem] text-muted-foreground">
                {flag.status === "in range"
                  ? `in ${flag.target.minSpm}–${flag.target.maxSpm}`
                  : `${flag.status} · ${flag.target.label}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * This week's programme against what was logged.
 *
 * It reports whether a day has a session, never which planned item was done — nothing in the
 * data links a logged workout to a line of the programme, and inferring it from the title
 * would quietly mark a rest-day walk as "Team Land Practice, complete".
 */
export function WeekReview({ days, planFound }: { days: PlanDay[]; planFound: boolean }) {
  if (!planFound) {
    return (
      <p className="text-sm text-muted-foreground">
        No weekly layout found in the vault. It is read from the{" "}
        <span className="text-foreground">Weekly Layout</span> heading of{" "}
        <code className="font-mono text-xs">training_blocks.md</code>.
      </p>
    );
  }

  const missed = days.filter((day) => day.missed).length;

  return (
    <div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60">
        {days.map((day) => (
          <li
            key={day.day}
            className={`flex gap-3 px-4 py-2.5 ${day.isFuture ? "opacity-55" : ""} ${
              day.isToday ? "bg-accent/30" : ""
            }`}
          >
            <span
              aria-hidden
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                day.logged > 0 ? "bg-primary" : day.missed ? "bg-highlight" : "border border-border"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-foreground">{day.name}</span>
                {day.isToday && <span className="eyebrow text-primary">today</span>}
                <span className="tabular font-mono text-[0.6rem] text-muted-foreground">
                  {day.logged > 0
                    ? `${day.logged} logged`
                    : day.isFuture
                      ? "planned"
                      : day.missed
                        ? "nothing logged"
                        : "rest"}
                </span>
              </p>
              {day.planned.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">{day.planned.join(" · ")}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        {missed === 0
          ? "Nothing missed so far this week."
          : `${missed} day${missed === 1 ? "" : "s"} this week with a session planned and nothing logged.`}{" "}
        A day counts as done when any session is logged against it — the programme is not matched
        line by line, because nothing in the data supports that.
      </p>
    </div>
  );
}
