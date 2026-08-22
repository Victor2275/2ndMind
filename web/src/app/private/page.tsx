import { FreshnessBadge } from "@/components/site/freshness-badge";
import { GoalsEditor } from "@/components/site/goals-editor";
import { Empty, PageHeader, Panel, Stat } from "@/components/site/page-shell";
import { TaskList, type TaskView } from "@/components/site/task-list";
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
import type { Task } from "@/lib/db/schema";

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

export default async function TodayPage() {
  const now = new Date();
  const { start, end } = dayBounds(now, LA_OFFSET_MINUTES);

  let due: Task[] = [];
  let goals: Task[] = [];
  let backlog: Task[] = [];
  let doneToday: Task[] = [];
  let failure: string | null = null;

  if (isDatabaseConfigured()) {
    try {
      const handle = db();
      [due, goals, backlog, doneToday] = await Promise.all([
        listDueBy(handle, end),
        currentGoals(handle),
        listTasks(handle, { limit: 50 }),
        listDoneBetween(handle, start, end),
      ]);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
  } else {
    failure = "DATABASE_URL is not set, so tasks cannot load.";
  }

  // Read from disk, not the API: 34 files, and one API call each would turn a page load
  // into 34 round trips against a rate limit (D-022).
  let freshness: ReturnType<typeof loadFreshness> | null = null;
  try {
    freshness = loadFreshness();
  } catch {
    freshness = null;
  }

  const goalValues = Object.fromEntries(
    GOAL_DOMAINS.map((d) => [d.key, goals.find((g) => g.domain === d.key)?.title ?? ""]),
  );

  // Everything without a date, minus the goals — goals have their own panel.
  const someday = backlog.filter((t) => t.dueAt === null && t.source !== "goal");
  const overdue = due.filter((t) => t.dueAt && t.dueAt < start).length;

  return (
    <main className="pb-16">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "America/Los_Angeles",
        }).format(now)}
        title="Today"
        actions={freshness ? <FreshnessBadge report={freshness} /> : undefined}
      />

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
    </main>
  );
}
