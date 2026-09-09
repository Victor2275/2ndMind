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

export function ProjectUpdates({ updates, limit }: { updates: ProjectUpdate[]; limit?: number }) {
  const shown = limit ? updates.slice(0, limit) : updates;
  if (shown.length === 0) return null;

  return (
    <ol className="space-y-6">
      {shown.map((update) => (
        <li key={`${update.date}-${update.body.slice(0, 24)}`}>
          <time dateTime={update.date} className="eyebrow text-muted-foreground">
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
