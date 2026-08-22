import type { CalendarEvent } from "./ics";

/**
 * Turning Canvas calendar entries into tasks.
 *
 * Pure: takes events, returns rows to upsert. The database call lives in the action, so all
 * the interesting decisions here are testable without Postgres.
 */

export type AssignmentTask = {
  title: string;
  externalId: string;
  source: "canvas";
  domain: "academics";
  courseCode: string | null;
  dueAt: Date | null;
  notes: string;
};

/**
 * Canvas titles arrive as `Assignment title [COURSE CODE]`, with the course in trailing
 * brackets. Pulled apart so the code can key the row and the title stays readable.
 *
 * A title with no brackets keeps its whole text and gets a null course, rather than being
 * dropped — an assignment with an odd title is still an assignment.
 */
export function splitCanvasTitle(summary: string): { title: string; courseCode: string | null } {
  const match = summary.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if (!match) return { title: summary.trim(), courseCode: null };

  const title = match[1].trim();
  const code = match[2].trim();
  // A bracketed suffix with nothing before it is not a course code, it is the whole title.
  if (title === "") return { title: summary.trim(), courseCode: null };
  return { title, courseCode: code || null };
}

/**
 * Canvas emits assignment deadlines as all-day events on the due date, and calendar entries
 * (office hours, exam slots) as timed events. Both are worth having, and the distinction is
 * carried by `allDay` rather than guessed at from the title.
 */
export function toAssignmentTasks(events: CalendarEvent[]): AssignmentTask[] {
  const seen = new Set<string>();
  const out: AssignmentTask[] = [];

  for (const event of events) {
    const summary = event.summary.trim();
    if (summary === "") continue;

    const { title, courseCode } = splitCanvasTitle(summary);

    // `uid` already includes the occurrence start for recurring events, so this is stable
    // across syncs — which is what stops a re-read from duplicating every assignment.
    const externalId = `canvas:${event.uid}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    out.push({
      title,
      externalId,
      source: "canvas",
      domain: "academics",
      courseCode,
      dueAt: event.start,
      notes: event.location ? `Location: ${event.location}` : "",
    });
  }

  return out;
}
