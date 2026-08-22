import { Suspense } from "react";

import { FreshnessBadge } from "@/components/site/freshness-badge";
import { GoalsEditor } from "@/components/site/goals-editor";
import { Empty, PageHeader, Panel, Stat } from "@/components/site/page-shell";
import { SkeletonPanel, SkeletonStats } from "@/components/site/skeleton";
import { TaskList, type TaskView } from "@/components/site/task-list";
import type { Task } from "@/lib/db/schema";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { GOAL_DOMAINS } from "@/lib/sprint-goals";
import {
  currentGoals,
  dayBounds,
  listDoneBetween,
  listDueBy,
  listTasks,
} from "@/lib/tasks/queries";
import { loadFreshness } from "@/lib/vault/freshness";

export const dynamic = "force-dynamic";

/** Los Angeles, UTC-7 in summer, which getTimezoneOffset reports as +420. */
const LA_OFFSET_MINUTES = 420;

function toView(task: Task): TaskView {
  return {
    id: task.id,
    title: task.title,
    source: task.source,
    domain: task.domain,
    courseCode: task.courseCode,
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    done: task.doneAt !== null,
  };
}

type Loaded = {
  due: Task[];
  goals: Task[];
  someday: Task[];
  doneToday: Task[];
  overdue: number;
  failure: string | null;
};

async function load(): Promise<Loaded> {
  const empty: Loaded = { due: [], goals: [], someday: [], doneToday: [], overdue: 0, failure: null };

  if (!isDatabaseConfigured()) {
    return { ...empty, failure: "DATABASE_URL is not set, so tasks cannot load." };
  }

  const { start, end } = dayBounds(new Date(), LA_OFFSET_MINUTES);

  try {
    const handle = db();
    const [due, goals, backlog, doneToday] = await Promise.all([
      listDueBy(handle, end),
      currentGoals(handle),
      listTasks(handle, { limit: 50 }),
      listDoneBetween(handle, start, end),
    ]);

    return {
      due,
      goals,
      someday: backlog.filter((t) => t.dueAt === null && t.source !== "goal"),
      doneToday,
      overdue: due.filter((t) => t.dueAt && t.dueAt < start).length,
      failure: null,
    };
  } catch (error) {
    return { ...empty, failure: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Everything that needs the database, behind one Suspense boundary.
 *
 * Neon's free tier suspends after a few minutes idle, so the first query after a break can
 * take seconds. Without this the whole page — header, nav, chrome — waits on that. With it,
 * the shell paints immediately and only this region shows a placeholder.
 */
async function Tasks() {
  const { due, goals, someday, doneToday, overdue, failure } = await load();

  const goalValues = Object.fromEntries(
    GOAL_DOMAINS.map((d) => [d.key, goals.find((g) => g.domain === d.key)?.title ?? ""]),
  );

  return (
    <>
      {failure && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
          <p className="text-sm font-medium text-foreground">Tasks are unavailable.</p>
          <p className="mt-1 text-xs text-muted-foreground">{failure}</p>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Due today" value={due.length} tone={due.length > 0 ? "accent" : "default"} />
        <Stat
          label="Overdue"
          value={overdue}
          tone={overdue > 0 ? "warn" : "default"}
          hint={overdue === 0 ? "nothing behind" : undefined}
        />
        <Stat label="Done today" value={doneToday.length} />
      </div>

      <div className="mt-8 space-y-4">
        <Panel title="Due" meta={due.length > 0 ? `${due.length} open` : undefined}>
          <TaskList
            tasks={due.map(toView)}
            emptyMessage="Nothing due. Add something below, or enjoy it."
          />
        </Panel>

        <Panel title="This week's goals">
          <GoalsEditor values={goalValues} />
        </Panel>

        <Panel title="Backlog" collapsible defaultOpen={someday.length > 0}>
          {someday.length > 0 ? (
            <TaskList tasks={someday.map(toView)} emptyMessage="" showAdd={false} />
          ) : (
            <Empty>Undated tasks land here. Give one a date and it moves up to Due.</Empty>
          )}
        </Panel>

        {doneToday.length > 0 && (
          <Panel title="Finished today" collapsible defaultOpen={false}>
            <TaskList tasks={doneToday.map(toView)} emptyMessage="" showAdd={false} />
          </Panel>
        )}
      </div>
    </>
  );
}

/** Reads memoised disk data, so this costs nothing after the first request. */
function Freshness() {
  // The call is what can throw (a missing vault directory on a misconfigured deploy), not
  // the render — so only the call is guarded. Wrapping the JSX would catch nothing, since
  // React renders it later.
  let report: ReturnType<typeof loadFreshness>;
  try {
    report = loadFreshness();
  } catch {
    return null;
  }
  return <FreshnessBadge report={report} />;
}

export default function TodayPage() {
  return (
    <main className="pb-16">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "America/Los_Angeles",
        }).format(new Date())}
        title="Today"
        actions={<Freshness />}
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
        <Tasks />
      </Suspense>
    </main>
  );
}
