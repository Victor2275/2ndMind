import { Suspense } from "react";

import { Agenda, AgendaDayBlock } from "@/components/site/agenda";
import { CalendarControls } from "@/components/site/calendar-controls";
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
          <code className="font-mono text-xs">CANVAS_CALENDAR</code> to the private iCal URLs.
          No OAuth involved — but the URL is the credential, so treat it as a secret.
        </p>
      </div>
    );
  }

  const now = new Date();
  const { start } = dayBounds(now, zoneOffsetMinutes(now));
  const weekEnd = new Date(start.getTime() + 7 * 86_400_000);
  const dayEnd = new Date(start.getTime() + 86_400_000);

  const { google, canvas } = await loadCalendars(start, weekEnd);

  const today = google.events.filter((e) => e.start < dayEnd);
  const rest = google.events.filter((e) => e.start >= dayEnd);
  const days = groupByDay(rest);

  return (
    <div className="space-y-4">
      {google.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
          <p className="text-sm font-medium text-foreground">The Google feed failed.</p>
          <p className="mt-1 text-xs text-muted-foreground">{google.error}</p>
        </div>
      )}

      <Panel title="Today" meta={today.length > 0 ? `${today.length} scheduled` : undefined}>
        <Agenda events={today} />
      </Panel>

      <Panel title="Next seven days" collapsible defaultOpen={days.length > 0}>
        {days.length > 0 ? (
          <div className="space-y-5">
            {days.map((day) => (
              <AgendaDayBlock key={day.day} day={day} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing scheduled this week.
          </p>
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
            The feed is connected and valid, but has no entries yet. Canvas publishes nothing
            until courses add assignments, which is expected before term.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {canvas.events.length} entries in the next week. Use{" "}
              <span className="text-foreground">Import Canvas</span> to turn assignments into
              tasks.
            </p>
            <Agenda events={canvas.events} />
          </>
        )}
      </Panel>
    </div>
  );
}

async function Rules() {
  let rules: string | null = null;
  let failure: string | null = null;

  try {
    rules = section((await readVaultFileCached(SPRINT)).content, RULES_HEADING);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  return (
    <Panel title="Operating rules" collapsible defaultOpen={false}>
      {failure ? (
        <p className="text-sm text-muted-foreground">{failure}</p>
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
    <main className="pb-16">
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
        <Suspense fallback={<SkeletonPanel rows={1} />}>
          <Rules />
        </Suspense>
      </div>
    </main>
  );
}
