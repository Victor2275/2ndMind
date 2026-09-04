import { describeDbError } from "@/lib/db/describe";
import { openErrors } from "@/lib/errors/queries";
import type { ErrorReport } from "@/lib/db/schema";
import { Suspense } from "react";

import { Agenda } from "@/components/site/agenda";
import { FreshnessBadge } from "@/components/site/freshness-badge";
import { GoalsEditor } from "@/components/site/goals-editor";
import { InboxPanel } from "@/components/site/inbox-panel";
import { ErrorPanel } from "@/components/site/error-panel";
import { Empty, PageHeader, Panel, Stat } from "@/components/site/page-shell";
import { ProposalReview } from "@/components/site/proposal-review";
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
  listInbox,
  listTasks,
  staleDays,
  zoneOffsetMinutes,
} from "@/lib/tasks/queries";
import { isCalendarConfigured, loadGoogle } from "@/lib/calendar/load";
import { loadFreshness } from "@/lib/vault/freshness";
import { readVaultFileCached } from "@/lib/vault/write";
import { generateDailySummary, generateWeeklySummary, MODEL } from "@/lib/ai/gemini";
import { localDay, recentSummaries, recordSummary } from "@/lib/ai/summaries";
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
  inbox: Task[];
  overdue: number;
  failure: string | null;
};

async function load(): Promise<Loaded> {
  const empty: Loaded = {
    due: [],
    goals: [],
    someday: [],
    doneToday: [],
    inbox: [],
    overdue: 0,
    failure: null,
  };

  if (!isDatabaseConfigured()) {
    return { ...empty, failure: "DATABASE_URL is not set, so tasks cannot load." };
  }

  const now = new Date();
  const { start, end } = dayBounds(now, zoneOffsetMinutes(now));

  try {
    const handle = db();
    const [due, goals, backlog, doneToday, inbox] = await Promise.all([
      listDueBy(handle, end),
      currentGoals(handle),
      listTasks(handle, { limit: 50 }),
      listDoneBetween(handle, start, end),
      listInbox(handle),
    ]);

    return {
      due,
      goals,
      // Inbox notes are undated by definition, so without this exclusion every captured
      // thought would appear twice — once here and once in the backlog below it.
      someday: backlog.filter(
        (t) => t.dueAt === null && t.source !== "goal" && t.source !== "inbox",
      ),
      doneToday,
      inbox,
      overdue: due.filter((t) => t.dueAt && t.dueAt < start).length,
      failure: null,
    };
  } catch (error) {
    return { ...empty, failure: describeDbError(error, { subject: "The tasks table" }) };
  }
}

/**
 * Everything that needs the database, behind one Suspense boundary.
 *
 * Neon's free tier suspends after a few minutes idle, so the first query after a break can
 * take seconds. Without this the whole page — header, nav, chrome — waits on that. With it,
 * the shell paints immediately and only this region shows a placeholder.
 */
/**
 * What is currently broken (§2.4, D-165).
 *
 * Its own Suspense boundary and its own query, so a diagnostics panel can never be the reason
 * the dashboard is slow — and, more to the point, can never be the reason it fails to render.
 * An error panel that takes the page down with it is a joke at its own expense.
 */
async function Broken() {
  if (!isDatabaseConfigured()) return null;

  // Only the await is guarded, not the JSX — React renders the element later, so a try/catch
  // around it would catch nothing. The same rule the tasks loader already follows.
  let errors: ErrorReport[];
  try {
    errors = await openErrors(db(), 5);
  } catch {
    // Swallowed deliberately, and it is the one place in the app where that is unambiguously
    // right: this is the error reporter, and there is nowhere to report a failure to report.
    return null;
  }

  return (
    <ErrorPanel
      errors={errors.map((error) => ({
        id: error.id,
        source: error.source,
        name: error.name,
        message: error.message,
        route: error.route,
        agent: error.agent,
        seenCount: error.seenCount,
        lastSeenAt: error.lastSeenAt.toISOString(),
        buildId: error.buildId,
      }))}
    />
  );
}

async function Tasks() {
  const { due, goals, someday, doneToday, inbox, overdue, failure } = await load();

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

      {/* The task list comes first, before the numbers that describe it.
          Measured at 390px before this change: the first task sat 791px down the page, past
          the fold on any phone. Two of the three stats restate what the panels below already
          say — "Due today" is the length of the very next list, "Done today" is the count in
          "Finished today" — so leading with them meant scrolling past a summary of the answer
          to reach the answer. */}
      <div className="mt-6 space-y-4">
        <Panel title="Due" meta={due.length > 0 ? `${due.length} open` : undefined}>
          <TaskList
            tasks={due.map(toView)}
            emptyMessage="Nothing due. Add something below, or enjoy it."
          />
        </Panel>
      </div>

      {/* Three across, not stacked. At 390px `sm:grid-cols-3` stacked these into ~290px of
          height to show three single digits. */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
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
        {/* One Goals panel, not two. "This week's goals" and "Draft next week" sat as
            siblings and read as two competing lists of goals rather than one list and the
            tool that proposes next week's — Victor's words: "it feels weird". Drafting is
            now nested inside the thing it drafts, and still closed by default: each press
            is a real API call against a ~$10/month budget, and this page opens daily. */}
        <Panel title="Goals">
          <GoalsEditor values={goalValues} />

          <details className="group mt-4 border-t border-border pt-3">
            <summary className="cursor-pointer list-none font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
              <span className="mr-1 inline-block transition-transform group-open:rotate-90">
                &rsaquo;
              </span>
              Draft next week
            </summary>
            <div className="mt-3">
              <ProposalReview />
            </div>
          </details>
        </Panel>

        {/* Somewhere to put a thought without deciding where it goes. Open, because a
            capture box behind a click is a capture box that does not get used. */}
        <Panel title="Inbox" meta={inbox.length > 0 ? `${inbox.length} to triage` : undefined}>
          <InboxPanel items={inbox.map(toView)} staleDays={staleDays(inbox, new Date())} />
        </Panel>

        {/* Closed by default now, regardless of size. Victor's read of this page was that it
            is too dense; a backlog is reference, and reference does not open itself. */}
        <Panel title="Backlog" collapsible defaultOpen={false}>
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

        <Suspense fallback={null}>
          <SummaryArchive />
        </Suspense>
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

  // Kept, not just shown. The cache holds one for a few hours and then the day is gone, and a
  // summary of a day you can no longer reconstruct is the kind worth having later. Fallback
  // text is never stored — "nothing logged yet" would be indistinguishable, months on, from a
  // day when nothing happened.
  if (summary.ok && isDatabaseConfigured()) {
    try {
      await recordSummary(db(), {
        kind: "daily",
        periodStart: localDay(now, zoneOffsetMinutes(now)),
        summary: summary.text,
        model: MODEL,
      });
    } catch (error) {
      // Never fatal. The summary is on screen either way, and losing the archive copy is not
      // a reason to fail the page it sits on.
      console.error("AI summary: could not store today's summary:", error);
    }
  }

  // A failed or empty summary gets a line, not a panel. Measured at 390px: the panel spent
  // ~170px of the top of the page saying "The summary could not be generated just now" —
  // which is the loudest possible way to report the failure of the least urgent thing here.
  // Still shown, because a summary that is silently missing is a key nobody notices is
  // broken; just shown at the weight the message deserves.
  if (!summary.ok) {
    return <p className="px-1 text-xs text-muted-foreground">{summary.text}</p>;
  }

  return (
    <Panel title="Today, summarised" meta={MODEL}>
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {summary.text}
      </div>
    </Panel>
  );
}

/**
 * The week, summarised.
 *
 * Reads the same `log_entries` the daily summary does, over seven days instead of one, and
 * hands the model one line per day rather than one line per entry. That grouping is the whole
 * design: a week of raw entries is a few hundred lines, which costs tokens, buries the shape
 * of the week in detail, and changes its cache key every time any single entry moves. Days
 * are the unit a week is actually made of.
 *
 * Empty days are included explicitly. "Nothing logged" on three days is the most informative
 * thing a weekly summary can say, and dropping those rows would make a week with four active
 * days indistinguishable from a full one.
 *
 * Same privacy rule as the daily summary (D-071): only one-line summaries are sent, never the
 * raw entry data, and health content may reach the model but may never be published.
 */
async function WeeklySummary() {
  const now = new Date();
  const offset = zoneOffsetMinutes(now);
  const today = dayBounds(now, offset);

  let sprint = "";
  try {
    const sprintFile = await readVaultFileCached("context/04_operations/current_sprint.md");
    sprint = section(sprintFile.content, "1. Active Sprint Goals") ?? "";
  } catch (error) {
    console.error("Weekly summary: could not read the sprint file:", error);
  }

  const lines: string[] = [];
  // Hoisted out of the try: the stored row is keyed by the week this describes, so the write
  // below needs the same window the query used, not a second computation of it.
  const weekStart = new Date(today.start.getTime() - 6 * 86_400_000);
  try {
    if (isDatabaseConfigured()) {
      const handle = db();
      const entries = await entriesBetween(handle, weekStart, today.end);

      // One pass, bucketed by local day. Querying seven times would be seven round trips to
      // a database that sleeps on the free tier.
      const byDay = new Map<string, string[]>();
      for (const entry of entries) {
        const key = dayBounds(entry.occurredAt, offset).start.toISOString().slice(0, 10);
        const bucket = byDay.get(key) ?? [];
        bucket.push(summarise(entry.category, entry.data, entry.note));
        byDay.set(key, bucket);
      }

      for (let i = 0; i < 7; i++) {
        const day = new Date(today.start.getTime() - i * 86_400_000);
        const key = day.toISOString().slice(0, 10);
        const label = new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          timeZone: "America/Los_Angeles",
        }).format(day);
        const items = byDay.get(key);
        lines.push(items?.length ? `${label}: ${items.join("; ")}` : `${label}: nothing logged`);
      }
    }
  } catch (error) {
    console.error("Weekly summary: could not read the week's log:", error);
  }

  // Seven "nothing logged" lines are not a week worth paying a model to describe.
  const anything = lines.some((l) => !l.endsWith("nothing logged"));
  const summary = anything
    ? await generateWeeklySummary(lines.join("\n"), sprint)
    : { text: "Nothing logged this week yet.", ok: false };

  if (summary.ok && isDatabaseConfigured()) {
    try {
      await recordSummary(db(), {
        kind: "weekly",
        periodStart: localDay(weekStart, zoneOffsetMinutes(weekStart)),
        summary: summary.text,
        model: MODEL,
      });
    } catch (error) {
      console.error("Weekly summary: could not store this week's summary:", error);
    }
  }

  if (!summary.ok) {
    return <p className="px-1 text-xs text-muted-foreground">{summary.text}</p>;
  }

  return (
    <Panel title="This week, summarised" meta={MODEL}>
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {summary.text}
      </div>
    </Panel>
  );
}

/**
 * The summary archive.
 *
 * Storing summaries only matters if they can be read back, and the place to read them is the
 * page that writes them. Closed by default and capped at fourteen days: this is a record, and
 * a record does not open itself on a page Victor already found too dense.
 */
async function SummaryArchive() {
  if (!isDatabaseConfigured()) return null;

  let rows: Awaited<ReturnType<typeof recentSummaries>> = [];
  try {
    rows = await recentSummaries(db(), { kind: "daily", limit: 14 });
  } catch (error) {
    console.error("Summary archive: could not read stored summaries:", error);
    return null;
  }

  // Today's is already on the page above, in its own panel.
  const now = new Date();
  const earlier = rows.filter((r) => r.periodStart !== localDay(now, zoneOffsetMinutes(now)));
  if (earlier.length === 0) return null;

  return (
    <Panel title="Earlier summaries" meta={`${earlier.length}`} collapsible defaultOpen={false}>
      <ol className="space-y-4">
        {earlier.map((row) => (
          <li key={row.id} className="border-l border-border pl-4">
            <p className="tabular font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
              {row.periodStart}
            </p>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {row.summary}
            </p>
          </li>
        ))}
      </ol>
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

      {/* First, and only when there is something. A panel that is always on screen saying
          "0 errors" stops being read within a week, and then the one time it says something
          the eye goes past it (D-165). */}
      <Suspense fallback={null}>
        <Broken />
      </Suspense>

      <Suspense fallback={null}>
        <div className="mt-6">
          <Today />
        </div>
      </Suspense>

      <Suspense
        fallback={
          <>
            <div className="mt-6">
              <SkeletonPanel rows={3} />
            </div>
            <SkeletonStats />
          </>
        }
      >
        <Tasks />
      </Suspense>

      {/* Last, and after the tasks it describes.
          This is a reflection on the day, not an instruction for the next hour — it answers
          "how did today go", where everything above answers "what do I do now". It also
          depends on a network round trip to Google, so putting it last means the slowest
          thing on the page is the thing nobody is waiting for. `fallback={null}`, since a
          skeleton at the very bottom reserves space for something nobody is looking at. */}
      <Suspense fallback={null}>
        <div className="mt-8">
          <AiSummary />
        </div>
      </Suspense>

      {/* Its own boundary, so the week does not wait on the day. They are two independent
          model calls against two independent caches, and one being slow or unavailable must
          not hold the other back. */}
      <Suspense fallback={null}>
        <div className="mt-4">
          <WeeklySummary />
        </div>
      </Suspense>
    </main>
  );
}
