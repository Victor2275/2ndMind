import { Suspense } from "react";

import { Empty, PageHeader, Panel } from "@/components/site/page-shell";
import { SkeletonPanel } from "@/components/site/skeleton";
import { TrainingTabs } from "@/components/site/training-tabs";
import { allEfforts } from "@/lib/athletics/queries";
import {
  formatDuration,
  formatSplit,
  timeTrialRecords,
  type TimeTrialPreset,
  type TimeTrialRecord,
} from "@/lib/athletics/prs";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { describeDbError } from "@/lib/db/describe";

/**
 * Standard benchmark tests, apart from ordinary training (Q — Time Trials).
 *
 * `ergRecords()` on the main Records page ranks *every* logged erg piece by split, training
 * included — that is right for tracking the vault's split goal, which is trained toward
 * continuously. A time trial answers a narrower question: what did the actual test say, on the
 * day it was actually taken. So this page reads only sets tagged `pieceType: "race"` (the
 * existing vocabulary's word for a benchmark test, per D-230 in `web/DECISIONS.md` — not a new
 * mechanism), tagged from the same "Time trial" toggle the session logger and the session-edit
 * page both carry next to each erg/water set.
 */
export const metadata = {
  title: "Time trials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" });
const MILE_M = 1609.344;

/** The three categories Victor tests against, each keyed to one catalogue exercise. */
const CATEGORIES: { label: string; presets: TimeTrialPreset[] }[] = [
  {
    label: "Erg",
    presets: [
      { exercise: "Row (Erg)", distanceM: 2000, label: "2k" },
      { exercise: "Row (Erg)", distanceM: 5000, label: "5k" },
      { exercise: "Row (Erg)", distanceM: 10000, label: "10k" },
    ],
  },
  {
    label: "Perg",
    presets: [
      { exercise: "Paddle Erg (Erg)", distanceM: 200, label: "200m" },
      { exercise: "Paddle Erg (Erg)", distanceM: 500, label: "500m" },
      { exercise: "Paddle Erg (Erg)", distanceM: 2000, label: "2km" },
    ],
  },
  {
    label: "OC",
    presets: [
      { exercise: "Race Piece (Boat)", distanceM: 150, label: "150m" },
      { exercise: "Race Piece (Boat)", distanceM: 400, label: "400m" },
      { exercise: "Race Piece (Boat)", distanceM: Math.round(MILE_M), label: "1 mile" },
    ],
  },
];

/** Split is a rowing/paddling convention — reading a split off an on-water distance the boat
 *  isn't measured against invents a number nobody asked for. */
function showsSplit(category: string): boolean {
  return category !== "OC";
}

function RecordRow({ record, split }: { record: TimeTrialRecord; split: boolean }) {
  const { preset, best, history } = record;

  return (
    <div className="rounded-lg border border-border bg-card/70 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-foreground">{preset.label}</h3>
        {best ? (
          <span className="tabular font-mono text-[0.65rem] text-muted-foreground">
            {DAY.format(best.performedAt)}
          </span>
        ) : null}
      </div>

      {best ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="tabular font-mono text-lg text-primary">
            {formatDuration(best.durationS)}
          </span>
          {split && (
            <span className="tabular font-mono text-xs text-muted-foreground">
              {formatSplit((best.durationS / preset.distanceM) * 500)} /500m
            </span>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No time trial logged yet.</p>
      )}

      {history.length > 1 && (
        <ul className="mt-3 space-y-1 border-t border-border/60 pt-2">
          {history.slice(0, 5).map((result, i) => (
            <li
              key={i}
              className="tabular flex items-baseline justify-between font-mono text-[0.65rem] text-muted-foreground"
            >
              <span>{DAY.format(result.performedAt)}</span>
              <span>{formatDuration(result.durationS)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function TimeTrials() {
  let efforts: Awaited<ReturnType<typeof allEfforts>> = [];
  let failure: string | null = null;

  try {
    efforts = await allEfforts(db());
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

  const anyTagged = efforts.some((e) => e.pieceType === "race");

  return (
    <div className="mt-6 space-y-6">
      {!anyTagged && (
        <Empty>
          No time trials tagged yet. Mark a piece as a time trial with the toggle next to it on{" "}
          <a
            href="/private/athletics/log"
            className="text-primary underline-offset-4 hover:underline"
          >
            Log
          </a>
          , or on a session&apos;s own edit page.
        </Empty>
      )}

      {CATEGORIES.map((category) => {
        const records = timeTrialRecords(efforts, category.presets);
        return (
          <Panel key={category.label} title={category.label}>
            <div
              data-first-action={category.label === "Erg" ? "" : undefined}
              className="grid gap-3 sm:grid-cols-3"
            >
              {records.map((record) => (
                <RecordRow
                  key={record.preset.label}
                  record={record}
                  split={showsSplit(category.label)}
                />
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

export default function TimeTrialsPage() {
  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Training"
        title="Time Trials"
        lede="Standard benchmark tests, apart from ordinary training — tag a piece as a time trial when logging it, and its best result and history show up here by distance."
      />
      <TrainingTabs />

      {!isDatabaseConfigured() ? (
        <div className="mt-6 rounded-md border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm text-muted-foreground">
          No database connected, so there is no stored history to show.
        </div>
      ) : (
        <Suspense fallback={<div className="mt-6">{<SkeletonPanel rows={3} />}</div>}>
          <TimeTrials />
        </Suspense>
      )}
    </div>
  );
}
