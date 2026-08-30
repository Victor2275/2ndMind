import "server-only";

import { unstable_cache } from "next/cache";

import { fetchIcs, isEmptyCalendar, parseIcs, type CalendarEvent } from "./ics";

/**
 * Calendar feeds, loaded and cached.
 *
 * Two sources, deliberately kept apart: Google is the personal schedule (classes, practice,
 * everything) and Canvas is coursework. They fail independently — a broken Canvas URL must
 * not empty the agenda — so each carries its own error rather than one shared try/catch.
 *
 * Variable names are Victor's own (`GOOGLE_CALENDAR_KEY`, `CANVAS_CALENDAR`) rather than the
 * ones the plan proposed. Renaming his working configuration to match a document would be
 * the wrong way round.
 */

export type FeedResult = {
  events: CalendarEvent[];
  /** Null when the feed loaded, whether or not it had anything in it. */
  error: string | null;
  /** True when the feed is valid but holds no events — Canvas before term, not a fault. */
  empty: boolean;
  configured: boolean;
};

const EMPTY: FeedResult = { events: [], error: null, empty: true, configured: false };

export function googleCalendarUrl(): string | null {
  const url = process.env.GOOGLE_CALENDAR_KEY?.trim();
  return url && url.startsWith("http") ? url : null;
}

export function canvasCalendarUrl(): string | null {
  const url = process.env.CANVAS_CALENDAR?.trim();
  return url && url.startsWith("http") ? url : null;
}

export function isCalendarConfigured(): boolean {
  return googleCalendarUrl() !== null || canvasCalendarUrl() !== null;
}

/**
 * The raw feed body, cached for fifteen minutes.
 *
 * Cached at the *text* level rather than the parsed level because the parse depends on the
 * window, which changes every day — caching parsed output would key on a moving target.
 * Fifteen minutes is well inside how often a calendar actually changes and keeps a page load
 * off the network entirely.
 */
const cachedBody = unstable_cache(async (url: string) => fetchIcs(url), ["ics-feed"], {
  tags: ["calendar"],
  revalidate: 900,
});

async function loadFeed(url: string | null, from: Date, to: Date): Promise<FeedResult> {
  if (!url) return EMPTY;

  try {
    const raw = await cachedBody(url);
    return {
      events: parseIcs(raw, from, to),
      error: null,
      empty: isEmptyCalendar(raw),
      configured: true,
    };
  } catch (error) {
    return {
      events: [],
      error: error instanceof Error ? error.message : String(error),
      empty: false,
      configured: true,
    };
  }
}

export function loadGoogle(from: Date, to: Date): Promise<FeedResult> {
  return loadFeed(googleCalendarUrl(), from, to);
}

export function loadCanvas(from: Date, to: Date): Promise<FeedResult> {
  return loadFeed(canvasCalendarUrl(), from, to);
}

/** Both feeds at once. They are independent, so one failing leaves the other intact. */
export async function loadCalendars(
  from: Date,
  to: Date,
): Promise<{ google: FeedResult; canvas: FeedResult }> {
  const [google, canvas] = await Promise.all([loadGoogle(from, to), loadCanvas(from, to)]);
  return { google, canvas };
}

/** Groups occurrences by local calendar day, for an agenda. */
export function groupByDay(
  events: CalendarEvent[],
  timeZone = "America/Los_Angeles",
): { day: string; events: CalendarEvent[] }[] {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  });

  const days = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    // Formatted in the viewer's zone, not the server's — Vercel runs in UTC, where the day
    // rolls over at 5pm in Los Angeles and an evening event lands on tomorrow.
    const key = formatter.format(event.start);
    const list = days.get(key);
    if (list) list.push(event);
    else days.set(key, [event]);
  }

  return [...days.entries()]
    .map(([day, list]) => ({ day, events: list }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
