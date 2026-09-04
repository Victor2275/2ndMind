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
      <h3 className="mb-2 font-mono text-[0.6rem] tracking-[0.14em] text-muted-foreground uppercase">
        {HEADING.format(date)}
      </h3>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60">
        {day.events.map((event) => (
          <EventRow key={`${event.uid}-${event.start.toISOString()}`} event={event} />
        ))}
      </ul>
    </div>
  );
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
}: {
  events: CalendarEvent[];
  firstAction?: boolean;
}) {
  if (events.length === 0) {
    return (
      <p
        data-first-action={firstAction || undefined}
        className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
      >
        Nothing scheduled.
      </p>
    );
  }

  return (
    <ul
      data-first-action={firstAction || undefined}
      className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60"
    >
      {events.map((event) => (
        <EventRow key={`${event.uid}-${event.start.toISOString()}`} event={event} />
      ))}
    </ul>
  );
}
