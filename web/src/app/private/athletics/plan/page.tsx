import Link from "next/link";
import { Suspense } from "react";

import { ChallengeFaults } from "@/components/site/challenge-panels";
import { PageHeader, Panel } from "@/components/site/page-shell";
import { PlanDayForm } from "@/components/site/plan-day-form";
import { SkeletonPanel } from "@/components/site/skeleton";
import { Unavailable } from "@/components/site/states";
import { TrainingTabs } from "@/components/site/training-tabs";
import { revertPlanDayAction } from "@/app/private/athletics/actions";
import type { ChallengeDay, ChallengeWeek, Routine } from "@/lib/athletics/challenge";
import { isoDay } from "@/lib/athletics/challenge";
import { loadPlan, PLAN_FILE } from "@/lib/athletics/plan";

/**
 * The whole plan, and the one screen where it can be changed (D-276).
 *
 * ## Why this is not a calendar
 *
 * Seventy-six days in a month grid gives every day the same box, and these days are not the
 * same size: a 3k float and the 100k both get a square, and the block structure — which is the
 * thing that explains *why* a Tuesday is short — disappears entirely. Weeks as sections, days
 * as rows, is what the plan actually is.
 *
 * ## The edit path
 *
 * Every row carries a **Change** link that sets `?edit=<date>`, and the server renders one
 * `PlanDayForm` inside that row. One client component on the page rather than 76, and the URL
 * carries the state so the back button works and a link to a specific day can be shared with
 * itself. See `plan-day-form.tsx` for why the inputs are empty with the plan as placeholder.
 *
 * A changed day shows what it was, struck through, with a revert that is a plain form post —
 * no confirmation dialog, which is this app's standing rule for anything undoable (D-263), and
 * reverting *is* the undo.
 */

export const metadata = {
  title: "Plan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

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

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

function weekdayOf(iso: string): string {
  return WEEKDAY.format(new Date(`${iso}T00:00:00.000Z`));
}

function DayRow({
  day,
  routine,
  today,
  editing,
  note,
}: {
  day: ChallengeDay;
  routine: Routine | null;
  today: string;
  editing: boolean;
  note: string;
}) {
  const isToday = day.date === today;
  const past = day.date < today;
  const changed = day.planned !== undefined;

  return (
    <li
      id={day.date}
      className={`scroll-mt-24 border-t border-border first:border-t-0 ${
        isToday ? "bg-primary/5" : ""
      }`}
    >
      <div className={`px-4 py-3 ${past && !isToday ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="tabular w-12 shrink-0 font-mono text-xs text-muted-foreground">
            {weekdayOf(day.date)}
          </span>
          <span className="tabular font-mono text-xs text-muted-foreground">{day.date}</span>
          <span className="tabular font-mono text-[0.65rem] text-faint-foreground">
            day {day.day}
          </span>
          {isToday && <span className="eyebrow text-primary">today</span>}
          {changed && <span className="eyebrow text-highlight">changed</span>}

          <span className="ml-auto flex items-center gap-2">
            <span className="tabular font-mono text-xs text-foreground">
              {day.meters.toLocaleString()} m
            </span>
            <span className={`rounded border px-1.5 py-0.5 eyebrow ${TYPE_TONE[day.type]}`}>
              {day.type}
            </span>
          </span>
        </div>

        <p className="mt-1.5 text-sm font-medium text-foreground">{day.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{day.detail}</p>

        {routine && (
          <p className="tabular mt-1.5 font-mono text-[0.65rem] text-faint-foreground">
            {routine.name} · {routine.minutes} min
          </p>
        )}

        {day.planned && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="line-through">
              {day.planned.name} — {day.planned.meters.toLocaleString()} m · {day.planned.type}
            </span>
            {note !== "" && <span className="ml-2 text-foreground">{note}</span>}
          </p>
        )}

        {!editing && (
          <div className="mt-2 flex items-center gap-3">
            <Link
              href={`/private/athletics/plan?edit=${day.date}#${day.date}`}
              className="press rounded-control border border-border px-2.5 py-1 text-xs text-muted-foreground"
            >
              Change
            </Link>

            {changed && (
              // No confirmation dialog anywhere in this app (D-263); a revert is itself the
              // undo, and the vault row it restores has not gone anywhere.
              <form action={revertPlanDayAction}>
                <input type="hidden" name="day" value={day.date} />
                <button
                  type="submit"
                  className="press rounded-control px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Back to plan
                </button>
              </form>
            )}
          </div>
        )}

        {editing && <PlanDayForm day={day} note={note} />}
      </div>
    </li>
  );
}

function WeekSection({
  week,
  routines,
  today,
  editing,
  notes,
}: {
  week: ChallengeWeek;
  routines: Map<number, Routine>;
  today: string;
  editing: string | null;
  notes: Map<string, string>;
}) {
  const planned = week.days.reduce((sum, day) => sum + day.meters, 0);
  const live = week.days.some((day) => day.date === today);

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Week {week.index}
          {week.name && <span className="text-muted-foreground"> · {week.name}</span>}
          {live && <span className="ml-2 eyebrow text-primary">this week</span>}
        </h2>
        <span className="tabular font-mono text-xs text-muted-foreground">
          {planned.toLocaleString()} m
        </span>
      </div>

      {week.intent && <p className="mt-1 text-sm text-muted-foreground">{week.intent}</p>}

      <ul className="mt-3 overflow-hidden rounded-lg border border-border bg-card/60">
        {week.days.map((day) => (
          <DayRow
            key={day.date}
            day={day}
            routine={routines.get(day.day) ?? null}
            today={today}
            editing={editing === day.date}
            note={notes.get(day.date) ?? ""}
          />
        ))}
      </ul>
    </section>
  );
}

async function Plan({ editing }: { editing: string | null }) {
  const { challenge, overrides, routines, faults, vaultFailure } = await loadPlan();

  if (vaultFailure) {
    return <Unavailable subject="The plan" detail={vaultFailure} className="mt-6" />;
  }

  if (!challenge) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        No plan found. It is read from{" "}
        <code className="font-mono text-xs text-foreground">{PLAN_FILE}</code> — if the{" "}
        <span className="text-foreground">The Challenge</span> heading was renamed, this goes quiet
        rather than guessing.
      </p>
    );
  }

  const today = isoDay(new Date());
  const notes = new Map(
    [...overrides.values()].map((override) => [override.date, override.note] as const),
  );

  const changed = challenge.weeks
    .flatMap((week) => week.days)
    .filter((day) => day.planned !== undefined).length;

  return (
    <>
      <ChallengeFaults faults={faults} />

      {/* The marker goes on the first Change link, which is genuinely the only thing you can do
          on this screen — every other element is the plan being read back to you. It is on the
          summary line rather than a day row because the rows are inside eleven sections and the
          first one is not reliably the nearest to the top once a week has scrolled past. */}
      <p data-first-action="" className="mt-4 text-sm text-muted-foreground">
        {challenge.weeks.length} weeks, {challenge.days} days.{" "}
        {changed === 0
          ? "Nothing changed from the plan yet."
          : `${changed} day${changed === 1 ? "" : "s"} changed from the plan.`}{" "}
        <Link
          href={`/private/athletics/plan?edit=${today}#${today}`}
          className="link-wipe text-primary"
        >
          Change today
        </Link>
      </p>

      {challenge.weeks.map((week) => (
        <WeekSection
          key={week.index}
          week={week}
          routines={routines}
          today={today}
          editing={editing}
          notes={notes}
        />
      ))}

      <Panel title="How this works">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            The plan is a markdown file in the vault, so editing{" "}
            <code className="font-mono text-xs text-foreground">{PLAN_FILE}</code> changes this
            screen with no deploy.
          </p>
          <p>
            Changing a day here does <strong className="text-foreground">not</strong> rewrite that
            file. It stores a change beside it, so the original stays visible and going back is one
            tap. The stretching routine follows the session type, so swapping a water day for an erg
            swaps the routine too.
          </p>
          <p>
            Boat practice days say only that there is practice. What a practice contains is the
            coach&apos;s call, not something this plan prescribes.
          </p>
        </div>
      </Panel>
    </>
  );
}

export default async function PlanPage({ searchParams }: PageProps<"/private/athletics/plan">) {
  const params = await searchParams;
  const raw = typeof params.edit === "string" ? params.edit : null;
  // Validated here rather than trusted: it reaches `PlanDayForm` as a day key and goes back out
  // as a hidden form value, and the action re-checks it anyway.
  const editing = raw !== null && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Athletics"
        title="Plan"
        lede="Every day of the fall challenge, read from the vault. Change any of them when the day does not survive contact with reality."
      />
      <TrainingTabs />

      <Suspense fallback={<SkeletonPanel shape="rows" />}>
        <Plan editing={editing} />
      </Suspense>
    </div>
  );
}
