import { describeDbError } from "@/lib/db/describe";
import { Empty, Unavailable } from "@/components/site/states";
import { Suspense } from "react";

import { Agenda, AgendaDayBlock } from "@/components/site/agenda";
import { CalendarControls } from "@/components/site/calendar-controls";
import { CalendarView } from "@/components/site/calendar-view";
import { MonthGrid, dayKey, type SourcedDay } from "@/components/site/month-grid";
import type { CalendarEvent } from "@/lib/calendar/ics";
import { PageHeader, Panel } from "@/components/site/page-shell";
import { Prose } from "@/components/site/prose";
import { SkeletonPanel } from "@/components/site/skeleton";
import { groupByDay, isCalendarConfigured, loadCalendars } from "@/lib/calendar/load";
import { dayBounds, zoneOffsetMinutes } from "@/lib/tasks/queries";
import { readVaultFileCached } from "@/lib/vault/write";

export const dynamic = "force-dynamic";

const SPRINT = "context/04_operations/current_sprint.md";
const RULES_HEADING = "2. Operational Rules & Boundaries";

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

async function Schedule() {
  if (!isCalendarConfigured()) {
    return (
      <div className="rounded-lg border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">No calendar feeds connected.</p>
        <p className="mt-2 text-muted-foreground">
          Set <code className="font-mono text-xs">GOOGLE_CALENDAR_KEY</code> and{" "}
          <code className="font-mono text-xs">CANVAS_CALENDAR</code> to the private iCal URLs. No
          OAuth involved — but the URL is the credential, so treat it as a secret.
        </p>
      </div>
    );
  }

  const now = new Date();
  const { start } = dayBounds(now, zoneOffsetMinutes(now));
  const weekEnd = new Date(start.getTime() + 7 * 86_400_000);
  const dayEnd = new Date(start.getTime() + 86_400_000);

  /**
   * The window is the wider of "seven days" and "the rest of this month" (§5.8, Q422).
   *
   * The month grid cannot draw dots for days it was never given, and widening costs nothing:
   * `loadCalendars` fetches and parses the whole `.ics` either way and filters the result by
   * range. A month view built from a seven-day window would be a calendar that claims the rest
   * of the month is free.
   *
   * It starts at the first of the month rather than today, so the grid's earlier rows are real
   * rather than blank.
   */
  const monthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12));
  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 12));
  const from = monthStart < start ? monthStart : start;
  const to = monthEnd > weekEnd ? monthEnd : weekEnd;

  const { google, canvas } = await loadCalendars(from, to);

  // The agenda's own window is unchanged: today, then the next seven days. A month of rows
  // under "Next seven days" would be a different screen.
  const inWeek = google.events.filter((e) => e.start >= start && e.start < weekEnd);
  const today = inWeek.filter((e) => e.start < dayEnd);
  const rest = inWeek.filter((e) => e.start >= dayEnd);
  const days = groupByDay(rest);

  // One row per day the month knows about, split by where it came from (Q423).
  const sourced = new Map<string, SourcedDay>();
  const put = (event: CalendarEvent, source: "google" | "canvas") => {
    const key = dayKey(event.start);
    const day = sourced.get(key) ?? { day: key, google: [], canvas: [] };
    day[source].push(event);
    sourced.set(key, day);
  };
  for (const event of google.events) put(event, "google");
  for (const event of canvas.events) put(event, "canvas");

  // The Canvas panel is a week, like the Google one beside it. The month window above is for
  // the grid, and letting it leak into this list would quietly turn a week into a month.
  const canvasWeek = canvas.events.filter((e) => e.start >= start && e.start < weekEnd);

  const agenda = (
    <div className="space-y-4">
      {google.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
          <p className="text-sm font-medium text-foreground">The Google feed failed.</p>
          <p className="mt-1 text-xs text-muted-foreground">{google.error}</p>
        </div>
      )}

      <Panel title="Today" meta={today.length > 0 ? `${today.length} scheduled` : undefined}>
        {/* The fold check measures to today's agenda and to nothing else on this page (§3.2).
            `now` draws the same marker Today's schedule got in §5.4 — this is the other list
            that is, by construction, the current day. */}
        <Agenda events={today} firstAction now={now} />
      </Panel>

      <Panel title="Next seven days" collapsible defaultOpen={days.length > 0}>
        {days.length > 0 ? (
          <div className="space-y-5">
            {days.map((day) => (
              <AgendaDayBlock key={day.day} day={day} />
            ))}
          </div>
        ) : (
          // The shared state (§5.1), replacing one more copy of the dashed box.
          <Empty>
            Nothing scheduled this week. The feed is connected; the week is simply free.
          </Empty>
        )}
      </Panel>

      <Panel title="Canvas">
        {canvas.error ? (
          <p className="text-sm text-destructive">{canvas.error}</p>
        ) : !canvas.configured ? (
          <p className="text-sm text-muted-foreground">
            <code className="font-mono text-xs">CANVAS_CALENDAR</code> is not set.
          </p>
        ) : canvas.empty ? (
          <p className="text-sm text-muted-foreground">
            The feed is connected and valid, but has no entries yet. Canvas publishes nothing until
            courses add assignments, which is expected before term.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {canvasWeek.length} {canvasWeek.length === 1 ? "entry" : "entries"} in the next week.
              Use <span className="text-foreground">Import Canvas</span> to turn assignments into
              tasks.
            </p>
            {/* Canvas is the other provenance (Q423). It has its own panel, which is the
                clearest possible statement of where these came from — the month grid, where
                the two are necessarily mixed, marks them instead. */}
            <Agenda events={canvasWeek} />
          </>
        )}
      </Panel>
    </div>
  );

  const month = (
    <Panel title="This month">
      <MonthGrid days={[...sourced.values()]} month={monthStart} today={dayKey(now)} />
    </Panel>
  );

  return <CalendarView agenda={agenda} month={month} />;
}

async function Rules() {
  let rules: string | null = null;
  let failure: string | null = null;

  try {
    rules = section((await readVaultFileCached(SPRINT)).content, RULES_HEADING);
  } catch (error) {
    failure = describeDbError(error, { subject: "The tasks table" });
  }

  return (
    <Panel title="Operating rules" collapsible defaultOpen={false}>
      {failure ? (
        <Unavailable subject="Operating rules" detail={failure} />
      ) : rules ? (
        <Prose>{rules}</Prose>
      ) : (
        <p className="text-sm text-muted-foreground">
          The <code className="font-mono text-xs">{RULES_HEADING}</code> section is missing.
        </p>
      )}
    </Panel>
  );
}

export default function CalendarPage() {
  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Time"
        title="Calendar"
        lede="Read from the private iCal feeds Google Calendar and Canvas publish. Everything in the feed is shown — no filtering, so nothing can be quietly dropped."
        actions={<CalendarControls />}
      />

      <div className="mt-8 space-y-4">
        <Suspense fallback={<SkeletonPanel rows={4} />}>
          <Schedule />
        </Suspense>
        <Suspense fallback={<SkeletonPanel rows={3} shape="text" />}>
          <Rules />
        </Suspense>
      </div>
    </div>
  );
}
