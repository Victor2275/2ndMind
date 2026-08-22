import { Suspense } from "react";

import { BodyweightForm } from "@/components/site/bodyweight-form";
import { BarChart, TrendChart, type ChartSeries } from "@/components/site/chart";
import { HevyImportForm } from "@/components/site/hevy-import-form";
import { Empty, PageHeader, Panel } from "@/components/site/page-shell";
import { RehabChecklist } from "@/components/site/rehab-checklist";
import { SkeletonPanel, SkeletonStats } from "@/components/site/skeleton";
import { GoalCard, SpmPanel, WeekReview } from "@/components/site/training-panels";
import { WorkoutLogForm } from "@/components/site/workout-log-form";
import {
  adjustSeconds,
  goalProgress,
  weightOn,
  type BodyweightReading,
} from "@/lib/athletics/adjusted";
import {
  ergRecords,
  formatDuration,
  formatSplit,
  strengthRecords,
  type ErgRecord,
  type StrengthRecord,
} from "@/lib/athletics/prs";
import {
  parseRehabProtocol,
  parseSpmTargets,
  parseSplitGoal,
  parseVaultBodyweight,
  parseWeeklyPlan,
} from "@/lib/athletics/protocol";
import {
  allEfforts,
  listBodyweight,
  recentWorkouts,
  rehabCompletionsBetween,
  workoutDates,
  type WorkoutSummary,
} from "@/lib/athletics/queries";
import {
  bodyweightSeries,
  chartableDistances,
  chartableLifts,
  e1rmSeries,
  flagSpm,
  isoDay,
  shiftDay,
  splitSeries,
  weeklyVolume,
  weekReview,
  weekStartOf,
} from "@/lib/athletics/trends";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { readVaultFileCached } from "@/lib/vault/write";

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" });

const BENCHMARKS = "context/02_physical_performance/benchmarks_and_logs.md";
const TRAINING = "context/02_physical_performance/training_blocks.md";

/** How far back the streak strip and the volume chart look. */
const REHAB_WINDOW_DAYS = 14;
const VOLUME_WEEKS = 10;

function Unconfigured() {
  return (
    <main className="pb-16">
      <PageHeader eyebrow="Athletics" title="Training" />

      <div className="mt-6 rounded-lg border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">No database connected.</p>
        <p className="mt-2 text-muted-foreground">
          Training data is tabular — thousands of sets, queried across exercises — so it lives
          in Postgres rather than in the markdown vault. Create a free Neon project, then set{" "}
          <code className="font-mono text-xs text-foreground">DATABASE_URL</code> and run{" "}
          <code className="font-mono text-xs text-foreground">npm run db:migrate</code>.
        </p>
        <p className="mt-2 text-muted-foreground">
          Everything else on this site keeps working without it.
        </p>
      </div>
    </main>
  );
}

function StrengthCard({ record }: { record: StrengthRecord }) {
  return (
    <div className="card-scan rounded-lg border border-border bg-card/70 p-4">
      <h3 className="text-sm font-semibold text-foreground">{record.exercise}</h3>

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground">
            Heaviest
          </dt>
          <dd className="tabular mt-1 font-mono text-sm text-primary">
            {record.heaviest
              ? `${record.heaviest.weightLbs} × ${record.heaviest.reps}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground">
            Est. 1RM
          </dt>
          <dd className="tabular mt-1 font-mono text-sm text-foreground">
            {record.bestE1rm ? `${record.bestE1rm.e1rm}` : "—"}
          </dd>
        </div>
      </dl>

      {record.byReps.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {record.byReps.map((best) => (
            <li
              key={best.reps}
              className="tabular rounded border border-border/70 px-1.5 py-0.5 font-mono text-[0.6rem] text-muted-foreground"
            >
              {best.reps}r · {best.weightLbs}
            </li>
          ))}
        </ul>
      )}

      <p className="tabular mt-3 font-mono text-[0.6rem] text-muted-foreground">
        {record.workingSets} working sets · last {DAY.format(record.lastPerformed)}
      </p>
    </div>
  );
}

function ErgTable({
  records,
  readings,
}: {
  records: ErgRecord[];
  readings: BodyweightReading[];
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card/70">
      <table className="w-full min-w-[34rem] text-left">
        <thead>
          <tr className="border-b border-border">
            {["Piece", "Distance", "Time", "Split /500m", "Adjusted", "Date"].map((h) => (
              <th
                key={h}
                className="px-4 py-2 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            // The weight recorded closest to this piece, not the current one — adjusting a
            // piece from last spring by today's bodyweight would rewrite its history.
            const weight = weightOn(readings, isoDay(record.performedAt));
            const adjusted =
              weight === null ? null : adjustSeconds(record.splitPer500S, weight);

            return (
              <tr
                key={`${record.exercise}-${record.distanceM}`}
                className="border-b border-border/60 last:border-0 transition-colors hover:bg-accent/40"
              >
                <td className="px-4 py-2 text-sm text-foreground">{record.exercise}</td>
                <td className="tabular px-4 py-2 font-mono text-xs text-muted-foreground">
                  {record.distanceM}m
                </td>
                <td className="tabular px-4 py-2 font-mono text-xs text-muted-foreground">
                  {formatDuration(record.durationS)}
                </td>
                <td className="tabular px-4 py-2 font-mono text-sm text-primary">
                  {formatSplit(record.splitPer500S)}
                </td>
                <td className="tabular px-4 py-2 font-mono text-sm text-secondary">
                  {adjusted !== null ? formatSplit(adjusted) : "—"}
                </td>
                <td className="tabular px-4 py-2 font-mono text-[0.65rem] text-muted-foreground">
                  {DAY.format(record.performedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function History({ workouts }: { workouts: WorkoutSummary[] }) {
  return (
    <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card/70">
      {workouts.map((workout) => (
        <li key={workout.id} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5">
          <span className="tabular font-mono text-[0.65rem] text-muted-foreground">
            {DAY.format(workout.performedAt)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {workout.title}
          </span>
          {workout.source === "hevy" && (
            <span className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[0.55rem] text-muted-foreground">
              hevy
            </span>
          )}
          <span className="tabular font-mono text-[0.65rem] text-muted-foreground">
            {workout.setCount} sets
            {workout.volumeLbs > 0 &&
              ` · ${Math.round(workout.volumeLbs).toLocaleString()} lb`}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Everything on this page comes from one pass.
 *
 * The vault reads and the database reads are issued together and every derived view is a pure
 * function over the result, so adding a chart costs a loop rather than a round trip. The
 * alternative — a Suspense boundary per section, each with its own query — reads better in a
 * diff and is several times slower on a serverless database.
 */
async function Training() {
  const today = isoDay(new Date());
  const weekStart = weekStartOf(today);
  const historyFrom = shiftDay(today, -(REHAB_WINDOW_DAYS - 1));

  let efforts: Awaited<ReturnType<typeof allEfforts>> = [];
  let history: WorkoutSummary[] = [];
  let readings: BodyweightReading[] = [];
  let rehabDone = new Map<string, Set<string>>();
  let sessionDates: Date[] = [];
  let failure: string | null = null;

  try {
    const handle = db();
    [efforts, history, readings, rehabDone, sessionDates] = await Promise.all([
      allEfforts(handle),
      recentWorkouts(handle, 15),
      listBodyweight(handle),
      rehabCompletionsBetween(handle, historyFrom, today),
      // A fortnight back covers this week plus the previous one, which is all the review needs.
      workoutDates(handle, new Date(`${shiftDay(weekStart, -7)}T00:00:00Z`)),
    ]);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  // Vault reads are separate from the database ones: a GitHub outage must not take the
  // charts down, and a missing table must not blank the protocol.
  let benchmarks = "";
  let training = "";
  let vaultFailure: string | null = null;
  try {
    const [a, b] = await Promise.all([
      readVaultFileCached(BENCHMARKS),
      readVaultFileCached(TRAINING),
    ]);
    benchmarks = a.content;
    training = b.content;
  } catch (error) {
    vaultFailure = error instanceof Error ? error.message : String(error);
  }

  const goal = parseSplitGoal(benchmarks);
  const spmTargets = parseSpmTargets(benchmarks);
  const rehabItems = parseRehabProtocol(benchmarks);
  const plan = parseWeeklyPlan(training);
  const vaultWeight = parseVaultBodyweight(benchmarks);

  const strength = strengthRecords(efforts);
  const erg = ergRecords(efforts);
  const empty = !failure && history.length === 0;

  // The database wins over the vault line, which is hand-maintained and goes stale — but the
  // vault line is better than refusing to compute anything before the first weigh-in.
  const latestWeight = readings.length > 0 ? readings[readings.length - 1].weightLbs : null;
  const weightForGoal = latestWeight ?? vaultWeight;

  const goalDistance = goal?.distanceM ?? 500;
  const bestAtGoalDistance = erg
    .filter((record) => record.distanceM === Math.round(goalDistance / 100) * 100)
    .reduce<number | null>(
      (best, record) => (best === null || record.splitPer500S < best ? record.splitPer500S : best),
      null,
    );

  const progress =
    goal && weightForGoal !== null
      ? goalProgress({
          targetAdjustedS: goal.targetSplitS,
          bodyweightLbs: weightForGoal,
          bestRawS: bestAtGoalDistance,
        })
      : null;

  const weightPoints = bodyweightSeries(readings);
  const volume = weeklyVolume(efforts, VOLUME_WEEKS);
  const lifts = chartableLifts(efforts).slice(0, 4);
  const distances = chartableDistances(efforts).slice(0, 3);
  const spmFlags = flagSpm(efforts, spmTargets);

  const reviewDays = weekReview(plan, sessionDates.map(isoDay), weekStart, today);

  const rehabHistory = Array.from({ length: REHAB_WINDOW_DAYS }, (_, i) => {
    const day = shiftDay(historyFrom, i);
    return { day, count: rehabDone.get(day)?.size ?? 0 };
  });

  return (
    <>
      {failure && (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">The database is unreachable.</p>
          <p className="mt-1 text-muted-foreground">{failure}</p>
        </div>
      )}

      {vaultFailure && (
        <div className="mt-6 rounded-md border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            The vault could not be read, so the goal, targets and protocol are missing.
          </p>
          <p className="mt-1 text-muted-foreground">{vaultFailure}</p>
        </div>
      )}

      {goal && (
        <section className="mt-8">
          <h2 className="text-lg font-bold tracking-tight">
            {goal.weightAdjusted ? "Weight-adjusted" : "Split"} goal
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Read from the vault — {goal.distanceM}m, sub-{formatSplit(goal.targetSplitS)}
            {goal.milestone && `, ${goal.milestone}`}.
          </p>
          <div className="mt-4">
            <GoalCard
              goal={goal}
              progress={progress}
              weightSource={latestWeight !== null ? "logged" : "vault"}
            />
          </div>
        </section>
      )}

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <Panel title="Today's rehab" meta={rehabItems.length > 0 ? "from the vault" : undefined}>
          <RehabChecklist
            items={rehabItems}
            done={rehabDone.get(today) ?? new Set<string>()}
            day={today}
            history={rehabHistory}
          />
        </Panel>

        <Panel title="This week" meta={plan.length > 0 ? "plan vs logged" : undefined}>
          <WeekReview days={reviewDays} planFound={plan.length > 0} />
        </Panel>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">Trends</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-session values, not running maxima — a plateau and a deload should not look the
          same as continued progress.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Bodyweight" meta={latestWeight !== null ? `${latestWeight} lb` : undefined}>
            {weightPoints.length > 0 ? (
              <TrendChart
                labels={weightPoints.map((p) => p.day)}
                series={[
                  {
                    label: "Bodyweight",
                    color: "var(--secondary)",
                    values: weightPoints.map((p) => p.value),
                  },
                ]}
                format={(v) => `${v.toFixed(1)}`}
                caption="Bodyweight in pounds over time"
              />
            ) : (
              <Empty>Record a weigh-in below to start this line.</Empty>
            )}
          </Panel>

          <Panel title="Weekly load" meta={`last ${VOLUME_WEEKS} weeks`}>
            {volume.length > 0 ? (
              <>
                <BarChart
                  bars={volume.map((week) => ({
                    label: week.weekStart,
                    sublabel: week.weekStart.slice(5),
                    value: week.volumeLbs,
                  }))}
                  format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`)}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Pounds moved per week, warmup sets included — they are load the body
                  absorbed, even though they never set a record. The final bar is drawn hollow
                  because the current week is still in progress.
                </p>
              </>
            ) : (
              <Empty>No sets logged yet.</Empty>
            )}
          </Panel>

          {distances.map((distance) => {
            const points = splitSeries(efforts, distance, readings);
            const series: ChartSeries[] = [
              {
                label: "Raw",
                color: "var(--primary)",
                values: points.map((p) => p.value),
              },
            ];
            if (points.some((p) => p.adjusted !== null)) {
              series.push({
                label: "Adjusted",
                color: "var(--secondary)",
                values: points.map((p) => p.adjusted),
                dashed: true,
              });
            }

            return (
              <Panel key={distance} title={`${distance}m split`} meta={`${points.length} days`}>
                <TrendChart
                  labels={points.map((p) => p.day)}
                  series={series}
                  format={formatSplit}
                  invert
                  target={
                    goal && distance === Math.round(goal.distanceM / 100) * 100
                      ? { value: goal.targetSplitS, label: "goal" }
                      : undefined
                  }
                  caption={`Best ${distance} metre split per training day`}
                />
              </Panel>
            );
          })}

          {lifts.map((lift) => {
            const points = e1rmSeries(efforts, lift);
            return (
              <Panel key={lift} title={lift} meta="est. 1RM">
                <TrendChart
                  labels={points.map((p) => p.day)}
                  series={[
                    {
                      label: "Est. 1RM",
                      color: "var(--primary)",
                      values: points.map((p) => p.value),
                    },
                  ]}
                  format={(v) => `${Math.round(v)}`}
                  caption={`Estimated one-rep max for ${lift} per training day`}
                />
              </Panel>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">Stroke rate</h2>
        <div className="mt-4">
          <SpmPanel flags={spmFlags} targets={spmTargets} />
        </div>
      </section>

      {empty && (
        <p className="mt-10 rounded-lg border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
          Nothing logged yet. Import a Hevy export below, or write a session in by hand.
        </p>
      )}

      {strength.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Strength records</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {strength.slice(0, 12).map((record) => (
              <StrengthCard key={record.exercise} record={record} />
            ))}
          </div>
        </section>
      )}

      {erg.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Erg records</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by split rather than finishing time, so each distance is judged against
            itself. The adjusted column uses the bodyweight recorded closest to that piece.
          </p>
          <ErgTable records={erg} readings={readings} />
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Recent sessions</h2>
          <History workouts={history} />
        </section>
      )}

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/60 p-6">
          <h2 className="text-base font-semibold">Weigh in</h2>
          <BodyweightForm />
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-6">
          <h2 className="text-base font-semibold">Import from Hevy</h2>
          <HevyImportForm />
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-6 lg:col-span-2">
          <h2 className="text-base font-semibold">Log by hand</h2>
          <WorkoutLogForm />
        </div>
      </section>
    </>
  );
}

export default function AthleticsPage() {
  if (!isDatabaseConfigured()) return <Unconfigured />;

  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Athletics"
        title="Training"
        lede="Records, trends and the protocol, computed from every stored set on each load. The goal, the stroke-rate targets, the rehab protocol and the weekly split are read from the vault, so editing the markdown changes this page."
      />
      <Suspense
        fallback={
          <>
            <SkeletonStats />
            <div className="mt-8 space-y-4">
              <SkeletonPanel rows={3} />
              <SkeletonPanel rows={3} />
            </div>
          </>
        }
      >
        <Training />
      </Suspense>
    </main>
  );
}
