import { Suspense } from "react";

import { Agenda } from "@/components/site/agenda";
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
  zoneOffsetMinutes,
} from "@/lib/tasks/queries";
import { isCalendarConfigured, loadGoogle } from "@/lib/calendar/load";
import { loadFreshness } from "@/lib/vault/freshness";
import { readVaultFileCached } from "@/lib/vault/write";
import { generateDailySummary } from "@/lib/ai/gemini";
import { entriesBetween } from "@/lib/log/queries";
import { summarise } from "@/lib/log/categories";

export const dynamic = "force-dynamic";

/** Pulls one `## Heading` section out of a vault file. `(?![\s\S])` rather than `$`, which
 *  under the `m` flag means end-of-line and would match the empty string. */
function section(content: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(
      `^##[ \\t]+${escaped}[ \\t]*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##[ \\t]|(?![\\s\\S]))`,
      "m",
    ),
  );
  return match ? match[1].trim() : null;
}



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

  const now = new Date();
  const { start, end } = dayBounds(now, zoneOffsetMinutes(now));

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

/**
 * Today's schedule, from the Google feed.
 *
 * Its own Suspense boundary so a slow or broken calendar never delays the tasks — the two
 * have nothing to do with each other and should not share a failure.
 */
async function Today() {
  if (!isCalendarConfigured()) return null;

  const now = new Date();
  const { start } = dayBounds(now, zoneOffsetMinutes(now));
  const end = new Date(start.getTime() + 86_400_000);
  const google = await loadGoogle(start, end);

  if (google.error) {
    return (
      <Panel title="Schedule">
        <p className="text-sm text-destructive">{google.error}</p>
      </Panel>
    );
  }
  // Nothing on today is not worth a panel saying so — the day is simply free.
  if (google.events.length === 0) return null;

  return (
    <Panel title="Schedule" meta={`${google.events.length} today`}>
      <Agenda events={google.events} />
    </Panel>
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

/**
 * The day, summarised.
 *
 * The log it reads is `log_entries` — the six-category table feature 2 introduced — not
 * `logbook_archive.md`. The archive is the *retired* free-text logbook that Victor asked to
 * be reworked or deleted; summarising it would describe a system he stopped using while
 * ignoring everything he has written since.
 *
 * Only today's entries are sent, and only their one-line summaries. That keeps the prompt
 * small, keeps the cache key stable within a day, and means no more of the vault reaches
 * Google than the question actually needs.
 */
async function AiSummary() {
  const now = new Date();
  const { start, end } = dayBounds(now, zoneOffsetMinutes(now));

  let sprint = "";
  let logs = "";

  try {
    const sprintFile = await readVaultFileCached("context/04_operations/current_sprint.md");
    sprint = section(sprintFile.content, "1. Active Sprint Goals") ?? "";
  } catch (error) {
    console.error("AI summary: could not read the sprint file:", error);
  }

  try {
    if (isDatabaseConfigured()) {
      const entries = await entriesBetween(db(), start, end);
      logs = entries
        .map((entry) => `- ${summarise(entry.category, entry.data, entry.note)}`)
        .join("\n");
    }
  } catch (error) {
    console.error("AI summary: could not read today's log:", error);
  }

  const summary = await generateDailySummary(logs, sprint);

  return (
    <Panel title="Today, summarised" meta={summary.ok ? "Gemini 2.5 Flash" : undefined}>
      <div
        className={`whitespace-pre-wrap text-sm leading-relaxed ${
          summary.ok ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {summary.text}
      </div>
    </Panel>
  );
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

      <Suspense fallback={null}>
        <div className="mt-6">
          <Today />
        </div>
      </Suspense>

      <Suspense fallback={<div className="mt-6"><SkeletonPanel rows={3} /></div>}>
        <div className="mt-6">
          <AiSummary />
        </div>
      </Suspense>

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
