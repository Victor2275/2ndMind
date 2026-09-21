import type { CalendarEvent } from "@/lib/calendar/ics";

/**
 * The month, as a grid (V4 §5.8, Q422).
 *
 * Q422 asks for an agenda with a month strip **and** a way to switch between the two views.
 * This is the second view and, expanded, the strip: the same component renders a compact row of
 * the current week's dots inside the agenda, and the full six-week grid when the view is
 * switched.
 *
 * ## What a cell says, in order
 *
 * The date, then up to two event titles, then "+n". Two is what fits at 360px without the cell
 * becoming a scrolling box, and the count is what stops a busy Tuesday looking like a quiet one.
 *
 * ## Provenance (Q423)
 *
 * Google and Canvas events are drawn with different marks — a filled dot and a ring — and the
 * legend spells both out. The shape carries it, not the hue: a colour-blind reader and a
 * greyscale screenshot both keep the distinction (rule 10).
 *
 * Everything here is computed from the events it is handed. No fetching, no client state, no
 * timezone maths beyond the one formatter — the day key is `en-CA` in Los Angeles, which is the
 * same key `groupByDay` produces, so a cell and an agenda row can never disagree about which
 * day an evening event belongs to.
 */

export type SourcedDay = {
  /** `YYYY-MM-DD`, Los Angeles. */
  day: string;
  google: CalendarEvent[];
  canvas: CalendarEvent[];
};

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Los_Angeles",
});

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "America/Los_Angeles",
});

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/** The Los Angeles day key for an instant. Exported because the page builds `SourcedDay`s. */
export function dayKey(at: Date): string {
  return DAY_KEY.format(at);
}

/**
 * Six weeks of cells covering `month`, starting on the Sunday on or before the 1st.
 *
 * Six rather than "as many as it takes": a grid that changes height between months moves
 * everything under it, and February in a common year starting on Sunday is the only month that
 * fits in four.
 */
function cells(month: Date): string[] {
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1, 12));
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10),
  );
}

export function MonthGrid({
  days,
  month,
  today,
}: {
  days: SourcedDay[];
  /** Any instant inside the month to draw. */
  month: Date;
  /** `YYYY-MM-DD` for today, so the current cell is marked. */
  today: string;
}) {
  const byDay = new Map(days.map((day) => [day.day, day]));
  const monthNumber = month.getUTCMonth();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{MONTH_LABEL.format(month)}</h3>
        <Legend />
      </div>

      <div className="mt-3 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {WEEKDAYS.map((weekday, index) => (
          <div
            key={`${weekday}-${index}`}
            aria-hidden
            className="bg-card/60 py-1 text-center eyebrow text-muted-foreground"
          >
            {weekday}
          </div>
        ))}

        {cells(month).map((key) => {
          const day = byDay.get(key);
          const events = [...(day?.google ?? []), ...(day?.canvas ?? [])];
          const outside = Number(key.slice(5, 7)) - 1 !== monthNumber;
          const isToday = key === today;

          return (
            <div
              key={key}
              className={`min-h-16 bg-card/60 px-1.5 py-1 ${outside ? "opacity-40" : ""}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`tabular text-[0.65rem] ${
                    isToday
                      ? "rounded-full bg-primary px-1.5 font-semibold text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {Number(key.slice(8, 10))}
                </span>
                <span className="flex items-center gap-0.5">
                  {(day?.google.length ?? 0) > 0 && (
                    <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                  )}
                  {(day?.canvas.length ?? 0) > 0 && (
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full border border-secondary bg-transparent"
                    />
                  )}
                </span>
              </div>

              {events.slice(0, 2).map((event) => (
                <p
                  key={`${event.uid}-${event.start.toISOString()}`}
                  className="mt-0.5 truncate text-[0.6rem] leading-tight text-foreground"
                >
                  {event.summary || "Untitled"}
                </p>
              ))}
              {events.length > 2 && (
                <p className="mt-0.5 text-[0.6rem] text-muted-foreground">+{events.length - 2}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Marks, spelled out. Two shapes and two words, so neither is doing the job alone. */
function Legend() {
  return (
    <p className="flex items-center gap-3 text-[0.65rem] text-muted-foreground">
      <span className="flex items-center gap-1">
        <span aria-hidden className="size-1.5 rounded-full bg-primary" />
        Google
      </span>
      <span className="flex items-center gap-1">
        <span aria-hidden className="size-1.5 rounded-full border border-secondary" />
        Canvas
      </span>
    </p>
  );
}
