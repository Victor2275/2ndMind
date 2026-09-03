import { describeDbError } from "@/lib/db/describe";
import Link from "next/link";
import { Suspense } from "react";

import { LogConsole, type EntryView } from "@/components/site/log-console";
import { PageHeader } from "@/components/site/page-shell";
import { SkeletonPanel } from "@/components/site/skeleton";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import type { LogEntry } from "@/lib/db/schema";
import { categoryByKey, summarise } from "@/lib/log/categories";
import { allChipSets } from "@/lib/log/chips";
import {
  categoriesLoggedBetween,
  entriesBetween,
  recentForChips,
  searchEntries,
} from "@/lib/log/queries";
import { dayBounds, zoneOffsetMinutes } from "@/lib/tasks/queries";

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});

function toView(entry: LogEntry): EntryView {
  return {
    id: entry.id,
    category: entry.category,
    occurredAt: entry.occurredAt.toISOString(),
    note: entry.note,
    data: entry.data,
  };
}

async function Console() {
  if (!isDatabaseConfigured()) {
    return (
      <div className="mt-6 rounded-lg border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">No database connected.</p>
        <p className="mt-2 text-muted-foreground">
          Log entries live in Postgres so a save is immediate. Set{" "}
          <code className="font-mono text-xs">DATABASE_URL</code> and run{" "}
          <code className="font-mono text-xs">npm run db:migrate</code>.
        </p>
      </div>
    );
  }

  const now = new Date();
  const { start, end } = dayBounds(now, zoneOffsetMinutes(now));

  // Only the awaits are guarded, not the JSX. React renders the element later, so a
  // try/catch around it would catch nothing — the lint rule is right about this.
  let today: LogEntry[];
  let logged: string[];
  let recent: { category: string; data: Record<string, unknown> }[];
  try {
    const handle = db();
    [today, logged, recent] = await Promise.all([
      entriesBetween(handle, start, end),
      categoriesLoggedBetween(handle, start, end),
      // Recent values for the one-tap chips (§1.6, D-155). In parallel with the other two,
      // so the form's shortcuts cost no wall-clock time on a page that is already dynamic.
      recentForChips(handle),
    ]);
  } catch (error) {
    return (
      <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
        <p className="text-sm font-medium text-foreground">The log is unavailable.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {describeDbError(error, { subject: "The log_entries table" })}
        </p>
      </div>
    );
  }

  return (
    <LogConsole entries={today.map(toView)} loggedToday={logged} chips={allChipSets(recent)} />
  );
}

async function Results({ query }: { query: string }) {
  if (!isDatabaseConfigured()) return null;

  let hits: LogEntry[] = [];
  try {
    hits = await searchEntries(db(), query);
  } catch {
    return null;
  }

  return (
    <div className="mt-4">
      <p className="mb-3 text-xs text-muted-foreground">
        {hits.length} {hits.length === 1 ? "match" : "matches"} for{" "}
        <span className="text-foreground">{query}</span>
      </p>

      {hits.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60">
          {hits.map((entry) => (
            <li key={entry.id} className="flex items-baseline gap-3 px-4 py-2.5">
              <span className="tabular shrink-0 font-mono text-[0.6rem] text-muted-foreground">
                {DAY.format(entry.occurredAt)}
              </span>
              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[0.55rem] text-muted-foreground">
                {categoryByKey(entry.category)?.label ?? entry.category}
              </span>
              <span className="min-w-0 flex-1 text-sm text-foreground">
                {summarise(entry.category, entry.data, entry.note)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing matches.
        </p>
      )}
    </div>
  );
}

export default async function LogPage({ searchParams }: PageProps<"/private/log">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Log"
        title={query ? "Search" : "Log"}
        lede={
          query
            ? undefined
            : "Six categories, each with its own fields. Saves immediately — no commit, no deploy."
        }
        actions={
          // A plain GET form: search survives a reload and a shared link, and needs no
          // client state at all.
          <form method="get" className="flex items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search everything"
              className="w-40 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-sm text-foreground transition-colors focus:w-56 focus:border-primary/60 focus:outline-none sm:w-48"
            />
          </form>
        }
      />

      {query ? (
        <>
          <Suspense
            fallback={
              <div className="mt-4">
                <SkeletonPanel rows={4} title={false} />
              </div>
            }
          >
            <Results query={query} />
          </Suspense>
          <Link
            href="/private/log"
            className="mt-4 inline-block font-mono text-xs text-primary hover:underline"
          >
            ← back to logging
          </Link>
        </>
      ) : (
        <div className="mt-8">
          <Suspense fallback={<SkeletonPanel rows={5} />}>
            <Console />
          </Suspense>
        </div>
      )}
    </main>
  );
}
