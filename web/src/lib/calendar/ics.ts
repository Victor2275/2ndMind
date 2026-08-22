import ICAL from "ical.js";

/**
 * iCal feed parsing.
 *
 * Read-only calendar access without OAuth: Google Calendar and Canvas each publish a private
 * iCal URL, which needs no consent screen, no refresh tokens and no rotation story (D-034
 * called this the V2 route, and it is). The URL *is* the credential, so it lives in the
 * environment and never reaches the browser.
 *
 * `ical.js` rather than a hand-rolled parser. Victor's real feed has 182 events, 37 of them
 * recurring with `RRULE:FREQ=WEEKLY;UNTIL=…;BYDAY=MO`, all in `America/Los_Angeles`, plus
 * nested `VALARM` blocks and 50 all-day entries. Expanding recurrences correctly across a DST
 * boundary is not something to reimplement — and getting it wrong shows up as a class that
 * silently stops appearing, which is worse than a crash.
 */

export type CalendarEvent = {
  /** Stable across refreshes: the event UID plus this occurrence's start. */
  uid: string;
  summary: string;
  location: string;
  description: string;
  start: Date;
  end: Date;
  allDay: boolean;
};

/** How far a single recurring rule may be expanded, so a malformed endless rule cannot hang. */
const MAX_OCCURRENCES = 400;

/**
 * Timezones must be registered before `toJSDate()` can convert a floating local time. Without
 * this every class in the feed lands seven hours out, which reads as "the app thinks my 9am
 * lecture is at 2am" rather than as an error.
 */
function registerTimezones(root: ICAL.Component): void {
  for (const vtimezone of root.getAllSubcomponents("vtimezone")) {
    const tzid = vtimezone.getFirstPropertyValue("tzid");
    if (typeof tzid !== "string" || ICAL.TimezoneService.has(tzid)) continue;
    // `register(timezone, name?)` — the component first, not the id. The reverse order
    // type-checks as `any` in plain JS and silently registers nothing.
    ICAL.TimezoneService.register(vtimezone);
  }
}

function text(event: ICAL.Event, key: "summary" | "location" | "description"): string {
  const value = event[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Every occurrence that overlaps [from, to).
 *
 * Overlap rather than containment: a three-hour practice that started before the window still
 * belongs on today's schedule, and testing only the start time would drop it.
 */
export function parseIcs(raw: string, from: Date, to: Date): CalendarEvent[] {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(raw));
  } catch (error) {
    throw new Error(
      `Could not parse the calendar feed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  registerTimezones(root);

  const out: CalendarEvent[] = [];

  for (const vevent of root.getAllSubcomponents("vevent")) {
    let event: ICAL.Event;
    try {
      event = new ICAL.Event(vevent);
    } catch {
      continue; // one malformed event must not lose the rest of the feed
    }

    if (!event.startDate) continue;

    // A modified single occurrence carries RECURRENCE-ID and is emitted by the parent's
    // iterator already; taking it again here would duplicate that day.
    if (vevent.getFirstPropertyValue("recurrence-id") && event.isRecurring()) continue;

    const allDay = event.startDate.isDate;

    if (!event.isRecurring()) {
      const start = event.startDate.toJSDate();
      const end = event.endDate ? event.endDate.toJSDate() : start;
      if (end > from && start < to) {
        out.push({
          uid: String(event.uid ?? ""),
          summary: text(event, "summary"),
          location: text(event, "location"),
          description: text(event, "description"),
          start,
          end,
          allDay,
        });
      }
      continue;
    }

    const durationMs = event.endDate
      ? event.endDate.toJSDate().getTime() - event.startDate.toJSDate().getTime()
      : 0;

    const iterator = event.iterator();
    let next: ICAL.Time | null;
    let seen = 0;

    while ((next = iterator.next()) && seen < MAX_OCCURRENCES) {
      seen += 1;
      const start = next.toJSDate();
      // Occurrences come out in order, so once past the window there is nothing left to find.
      if (start >= to) break;
      const end = new Date(start.getTime() + durationMs);
      if (end <= from) continue;

      out.push({
        // The parent UID repeats for every occurrence, so the start is what makes this row
        // distinguishable — and stable, which is what keeps a re-sync from duplicating.
        uid: `${String(event.uid ?? "")}:${start.toISOString()}`,
        summary: text(event, "summary"),
        location: text(event, "location"),
        description: text(event, "description"),
        start,
        end,
        allDay,
      });
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Fetches a feed with a deadline, for the same reason the GitHub client has one. */
export async function fetchIcs(url: string, timeoutMs = 10_000): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    // Feeds change at most a few times a day; Next caches this so a page load is not a
    // round trip to Google.
    next: { revalidate: 900 },
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`The calendar feed did not respond within ${timeoutMs / 1000}s.`);
    }
    throw error;
  });

  if (!response.ok) {
    throw new Error(
      `The calendar feed returned ${response.status}. If it was regenerated, the old secret URL stops working.`,
    );
  }

  const body = await response.text();
  if (!body.includes("BEGIN:VCALENDAR")) {
    throw new Error("That URL did not return a calendar. Check it is the iCal address.");
  }
  return body;
}

/** True when a feed parsed fine but holds no events at all — which is not an error. */
export function isEmptyCalendar(raw: string): boolean {
  return !raw.includes("BEGIN:VEVENT");
}
