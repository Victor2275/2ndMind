import { Fragment } from "react";

import { Empty } from "@/components/site/states";
import type { CalendarEvent } from "@/lib/calendar/ics";

/**
 * A day's or a week's events, as a plain agenda.
 *
 * No filtering and no classification. Victor's Google calendar is one general calendar —
 * classes, practice and personal all in it — and a regex guessing which is which would drop
 * a real class the moment one is titled without a course code. Showing everything is the only
 * option that cannot lose an event.
 */

export type AgendaDay = { day: string; events: CalendarEvent[] };

const TIME = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

/** `YYYY-MM-DD` in Victor's timezone, for comparing two instants as the same *local* day. */
const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Los_Angeles",
});

const HEADING = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <li className="flex items-baseline gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30">
      <span className="tabular w-16 shrink-0 font-mono text-[0.65rem] text-muted-foreground">
        {event.allDay ? "all day" : TIME.format(event.start)}
      </span>
      <span className="min-w-0 flex-1 text-sm text-foreground">{event.summary || "Untitled"}</span>
      {event.location && (
        <span className="hidden max-w-[14ch] shrink-0 truncate font-mono text-[0.6rem] text-muted-foreground sm:block">
          {event.location}
        </span>
      )}
    </li>
  );
}

/** One day, headed by its date. Used for the week view. */
export function AgendaDayBlock({ day }: { day: AgendaDay }) {
  // Parsed as UTC noon so the label cannot slip to the previous day when formatted back
  // into Los Angeles time.
  const date = new Date(`${day.day}T12:00:00Z`);

  return (
    <div>
      <h3 className="mb-2 eyebrow text-muted-foreground">{HEADING.format(date)}</h3>
      <ul
        data-tiny-text="agenda row: time and location beside the event; the summary is text-sm"
        className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60"
      >
        {day.events.map((event) => (
          <EventRow key={`${event.uid}-${event.start.toISOString()}`} event={event} />
        ))}
      </ul>
    </div>
  );
}

/**
 * The line that says where you are in the day (V4 §5.4, Q387).
 *
 * A rule and a time, not a highlighted row: "now" is a moment *between* two events, and
 * colouring the next event instead would say something different and often wrong — the next
 * event is not necessarily soon, and at 9pm the "next" event is tomorrow's first.
 *
 * Rendered on the server, in the same pass as the events. This page is `force-dynamic`, so the
 * marker is correct on arrival and drifts only while the tab is left open; the alternative is a
 * client component that ticks, which is a timer on the app's most-opened screen to move a line
 * a few pixels an hour. Reload is the refresh.
 *
 * Colour is not the only signal (rule 10): the word "now" is written on it.
 */
function NowMarker({ at }: { at: Date }) {
  return (
    <li aria-hidden className="flex items-center gap-3 px-4 py-1.5">
      <span className="tabular w-16 shrink-0 font-mono text-[0.65rem] font-semibold text-primary">
        {TIME.format(at)}
      </span>
      <span className="h-px flex-1 bg-primary/50" />
      <span className="shrink-0 eyebrow text-primary">now</span>
    </li>
  );
}

/**
 * Where the marker goes: before the first timed event that has not started yet.
 *
 * All-day events are skipped when looking for that boundary — they have no start to be before
 * or after — and they sort first in the feed, so the marker never lands above them.
 *
 * Returns `events.length` when everything has started, which puts the line at the bottom: the
 * day's events are behind you, which is exactly what an evening agenda should look like. Returns
 * `null` when the marker does not belong on this list at all.
 */
export function nowIndex(events: CalendarEvent[], at: Date | null): number | null {
  if (!at) return null;
  const timed = events.filter((event) => !event.allDay);
  if (timed.length === 0) return null;

  // Not this day's list — Today passes `now` only for today, but nothing stops a future caller
  // handing this a Thursday, and a marker on Thursday is a lie told in a confident colour.
  //
  // Compared in **Los Angeles**, not UTC. A 6pm event on the 21st is the 22nd in UTC, so the
  // obvious `getUTCDate()` comparison suppresses the marker every evening after 5pm — which is
  // when an agenda is most worth reading. `DAY_KEY` is the same timezone every other date in
  // this app is formatted in.
  if (DAY_KEY.format(timed[0].start) !== DAY_KEY.format(at)) return null;

  const index = events.findIndex((event) => !event.allDay && event.start > at);
  return index === -1 ? events.length : index;
}

/**
 * A flat list, for a single day.
 *
 * `firstAction` stamps the marker `scripts/shots.mjs` measures to (V3 §3.2). It is a prop
 * rather than something this component decides, because the same component renders today,
 * each day of the coming week, and the Canvas feed — and only *today* is the answer to "what
 * do I have next". A marker inside the component would attach to whichever call happened to
 * come first in the DOM, which is a fact about layout order rather than about meaning.
 */
export function Agenda({
  events,
  firstAction = false,
  now = null,
}: {
  events: CalendarEvent[];
  firstAction?: boolean;
  /**
   * Draws the "now" line (Q387). Passed only by Today, which is the one caller for which the
   * list is the current day — the week view renders seven of these and six of them are not now.
   */
  now?: Date | null;
}) {
  if (events.length === 0) {
    return (
      // The shared state (§5.1), and `data-first-action` has to survive the empty branch: a
      // gated page that drops the marker fails the sweep by name rather than passing quietly
      // (D-166). It rides the sentence, which is what the sweep measures the top of.
      <Empty>
        <span data-first-action={firstAction || undefined}>Nothing scheduled.</span>
      </Empty>
    );
  }

  const marker = nowIndex(events, now);

  return (
    <ul
      data-first-action={firstAction || undefined}
      data-tiny-text="agenda row: time and location beside the event; the summary is text-sm"
      className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60"
    >
      {events.map((event, index) => (
        <Fragment key={`${event.uid}-${event.start.toISOString()}`}>
          {index === marker && now && <NowMarker at={now} />}
          <EventRow event={event} />
        </Fragment>
      ))}
      {marker === events.length && now && <NowMarker at={now} />}
    </ul>
  );
}
