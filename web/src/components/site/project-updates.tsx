import { Prose } from "@/components/site/prose";
import type { ProjectUpdate } from "@/lib/vault/updates";

/**
 * Dated updates on a project, newest first.
 *
 * Shared by `/now` and the project page so an update reads identically wherever it appears —
 * the two pages draw from the same `## Updates` section of the same file, and rendering them
 * differently would suggest they were different things.
 */

/**
 * `2026-08-25` → `25 Aug 2026`, in UTC.
 *
 * The `T12:00:00Z` is not decoration. A bare `new Date("2026-08-25")` is parsed as midnight
 * UTC, which renders as the 24th anywhere west of Greenwich — including where this site is
 * built and read. Every date in this codebase that skips it eventually shows the wrong day.
 */
export function formatUpdateDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * `2026-08-25` → `3 weeks ago`, for the `title` attribute only (Q338).
 *
 * Q338 chose absolute dates on the page with the relative form on hover, and the order matters:
 * "3 weeks ago" is the friendlier label and the less useful fact. A reader deciding whether a
 * project is alive wants to know *when*; a reader hovering wants the arithmetic done for them.
 *
 * @param now injectable so the test does not depend on the day it runs.
 */
export function relativeUpdateDate(iso: string, now = new Date()): string {
  const then = new Date(`${iso}T12:00:00Z`).getTime();
  const days = Math.round((now.getTime() - then) / 86_400_000);

  if (days < 0) return "scheduled";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  const years = Math.round(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

export function ProjectUpdates({ updates, limit }: { updates: ProjectUpdate[]; limit?: number }) {
  const shown = limit ? updates.slice(0, limit) : updates;
  if (shown.length === 0) return null;

  return (
    <ol className="space-y-6">
      {shown.map((update) => (
        <li key={`${update.date}-${update.body.slice(0, 24)}`} className="relative">
          {/* Q337 — the updates timeline reads as a different kind of thing from the case-study
              body above it. A node on the rule does that with no extra colour: the case study is
              argument, this is a log, and a dated marker is what a log looks like. */}
          <span
            aria-hidden
            className="absolute top-[0.4rem] -left-[1.4rem] size-1.5 rounded-full bg-primary/60"
          />
          <time
            dateTime={update.date}
            title={relativeUpdateDate(update.date)}
            className="eyebrow text-muted-foreground"
          >
            {formatUpdateDate(update.date)}
          </time>
          <div className="mt-2">
            <Prose>{update.body}</Prose>
          </div>
        </li>
      ))}
    </ol>
  );
}
