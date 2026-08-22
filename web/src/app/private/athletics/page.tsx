import { Suspense } from "react";

import { HevyImportForm } from "@/components/site/hevy-import-form";
import { PageHeader } from "@/components/site/page-shell";
import { SkeletonPanel, SkeletonStats } from "@/components/site/skeleton";
import { WorkoutLogForm } from "@/components/site/workout-log-form";
import {
  ergRecords,
  formatDuration,
  formatSplit,
  strengthRecords,
  type ErgRecord,
  type StrengthRecord,
} from "@/lib/athletics/prs";
import { allEfforts, recentWorkouts, type WorkoutSummary } from "@/lib/athletics/queries";
import { db, isDatabaseConfigured } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" });

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

function ErgTable({ records }: { records: ErgRecord[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card/70">
      <table className="w-full min-w-[30rem] text-left">
        <thead>
          <tr className="border-b border-border">
            {["Piece", "Distance", "Time", "Split /500m", "Date"].map((h) => (
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
          {records.map((record) => (
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
              <td className="tabular px-4 py-2 font-mono text-[0.65rem] text-muted-foreground">
                {DAY.format(record.performedAt)}
              </td>
            </tr>
          ))}
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

async function Records() {

  let efforts: Awaited<ReturnType<typeof allEfforts>> = [];
  let history: WorkoutSummary[] = [];
  let failure: string | null = null;

  try {
    const handle = db();
    [efforts, history] = await Promise.all([allEfforts(handle), recentWorkouts(handle, 15)]);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  const strength = strengthRecords(efforts);
  const erg = ergRecords(efforts);
  const empty = !failure && history.length === 0;

  return (
    <>
      {failure && (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">The database is unreachable.</p>
          <p className="mt-1 text-muted-foreground">{failure}</p>
        </div>
      )}

      {empty && (
        <p className="mt-6 rounded-lg border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
          Nothing logged yet. Import a Hevy export below, or write a session in by hand.
        </p>
      )}

      {strength.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Strength</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {strength.slice(0, 12).map((record) => (
              <StrengthCard key={record.exercise} record={record} />
            ))}
          </div>
        </section>
      )}

      {erg.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Erg</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by split rather than finishing time, so each distance is judged against
            itself.
          </p>
          <ErgTable records={erg} />
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
          <h2 className="text-base font-semibold">Import from Hevy</h2>
          <HevyImportForm />
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-6">
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
        lede="Records are computed from every stored set on each load, never saved — a stored record keeps reading high after a workout is corrected."
      />
      <Suspense
        fallback={
          <>
            <SkeletonStats />
            <div className="mt-8 space-y-4">
              <SkeletonPanel rows={3} />
            </div>
          </>
        }
      >
        <Records />
      </Suspense>
    </main>
  );
}
