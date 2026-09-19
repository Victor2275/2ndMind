import Link from "next/link";
import { Suspense } from "react";

import { Empty, PageHeader, Panel } from "@/components/site/page-shell";
import { SkeletonPanel } from "@/components/site/skeleton";
import { TrainingTabs } from "@/components/site/training-tabs";
import { SessionHeatmap } from "@/components/site/week-panels";
import { allEfforts, recentWorkouts, type WorkoutSummary } from "@/lib/athletics/queries";
import { isoDay, sessionHeat } from "@/lib/athletics/trends";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { describeDbError } from "@/lib/db/describe";

/**
 * Every session, newest first (V4 Phase 2++ Stage 7).
 *
 * Its own route rather than the tail of the records page, which is what makes the Training
 * area's fourth tab a real destination — and what takes a list that grows without bound off a
 * page whose job is the *summary* of that list.
 *
 * Server-rendered from Postgres, unlike the logger: this is the whole history, not the handful
 * of sessions this device happens to hold, and it is read at a desk rather than at a rack.
 * `/private/athletics/log` still shows "on this device" for the offline case.
 */
export const metadata = {
  title: "Training history",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" });

/** How far back the heatmap looks. Ten weeks fits a phone without scrolling sideways. */
const HEAT_DAYS = 70;

async function History() {
  let sessions: WorkoutSummary[] = [];
  let efforts: Awaited<ReturnType<typeof allEfforts>> = [];
  let failure: string | null = null;

  try {
    const handle = db();
    [sessions, efforts] = await Promise.all([recentWorkouts(handle, 200), allEfforts(handle)]);
  } catch (error) {
    failure = describeDbError(error, { subject: "The athletics tables" });
  }

  if (failure) {
    return (
      <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">The database is unreachable.</p>
        <p className="mt-1 text-muted-foreground">{failure}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <Panel title="Training days" meta={`last ${HEAT_DAYS} days`}>
        <SessionHeatmap days={sessionHeat(efforts, isoDay(new Date()), HEAT_DAYS)} />
      </Panel>

      <Panel title="Sessions" meta={sessions.length > 0 ? `${sessions.length}` : undefined}>
        {sessions.length === 0 ? (
          <Empty>Nothing logged yet. Sessions written at Log land here.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((session) => (
              <li key={session.id} className="flex flex-wrap items-baseline gap-x-3 py-2.5">
                <span className="tabular font-mono text-[0.65rem] text-muted-foreground">
                  {DAY.format(session.performedAt)}
                </span>
                <Link
                  href={`/private/athletics/sessions/${session.clientId}`}
                  className="min-w-0 flex-1 truncate text-sm text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {session.title || "Untitled session"}
                </Link>
                {session.source === "hevy" && (
                  <span className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[0.55rem] text-muted-foreground">
                    hevy
                  </span>
                )}
                <span className="tabular font-mono text-[0.65rem] text-muted-foreground">
                  {session.setCount} sets
                  {session.volumeLbs > 0 &&
                    ` · ${Math.round(session.volumeLbs).toLocaleString()} lb`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default function TrainingHistoryPage() {
  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Training"
        title="History"
        lede="Every session stored, newest first, with the days you trained laid out above them."
      />
      <TrainingTabs />

      {!isDatabaseConfigured() ? (
        <div className="mt-6 rounded-md border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm text-muted-foreground">
          No database connected, so there is no stored history to show.
        </div>
      ) : (
        <Suspense fallback={<div className="mt-6">{<SkeletonPanel rows={4} />}</div>}>
          <History />
        </Suspense>
      )}
    </div>
  );
}
