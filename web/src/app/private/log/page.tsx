import { describeDbError } from "@/lib/db/describe";
import { Unavailable } from "@/components/site/states";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { LogConsole, type EntryView } from "@/components/site/log-console";
import { PageHeader } from "@/components/site/page-shell";
import { SkeletonPanel } from "@/components/site/skeleton";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import type { LogEntry } from "@/lib/db/schema";
import { categoryByKey, summarise, TAB_CATEGORIES, UNSORTED_CATEGORY } from "@/lib/log/categories";
import { allChipSets } from "@/lib/log/chips";
import {
  allTags,
  categoriesLoggedBetween,
  entriesBetween,
  listEntries,
  recentForChips,
  searchEntries,
  unsortedEntries,
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
    tags: entry.tags,
  };
}

async function Console({ initialCategory }: { initialCategory?: string }) {
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
  let unsorted: LogEntry[];
  let tags: string[];
  try {
    const handle = db();
    [today, logged, recent, unsorted, tags] = await Promise.all([
      entriesBetween(handle, start, end),
      categoriesLoggedBetween(handle, start, end),
      // Recent values for the one-tap chips (§1.6, D-155). In parallel with the other two,
      // so the form's shortcuts cost no wall-clock time on a page that is already dynamic.
      recentForChips(handle),
      // Captured and not yet filed (D-164). Not limited to today: an unfiled note from last
      // week is exactly the one worth surfacing.
      unsortedEntries(handle),
      // The distinct-tags vocabulary, for `TagInput`'s autocomplete (§3.2).
      allTags(handle),
    ]);
  } catch (error) {
    return (
      <Unavailable
        subject="The log"
        detail={describeDbError(error, { subject: "The log_entries table" })}
        className="mt-6"
      />
    );
  }

  return (
    <LogConsole
      // Unsorted notes are shown in their own pile directly above, so they are kept out of
      // this list rather than rendered twice — on a 360px screen a duplicated row costs the
      // vertical space this whole panel exists to save (D-164). They join it once filed.
      entries={today.filter((e) => e.category !== UNSORTED_CATEGORY).map(toView)}
      unsorted={unsorted.map(toView)}
      loggedToday={logged}
      chips={allChipSets(recent)}
      tagSuggestions={tags}
      initialCategory={initialCategory}
    />
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

/**
 * Everything tagged `#tag`, across all history (V4 Phase 3, §3.4).
 *
 * A separate view from `Console`'s "Today", the same way `Results` is separate from it: a tag
 * browse is a question about the whole log, not about today, and squeezing it into the daily
 * list would either limit it to today (useless — the point of a tag is finding something from
 * weeks ago) or make "Today" secretly mean something else depending on the URL.
 */
async function TagResults({ tag }: { tag: string }) {
  if (!isDatabaseConfigured()) return null;

  let hits: LogEntry[] = [];
  try {
    hits = await listEntries(db(), { tag, limit: 100 });
  } catch {
    return null;
  }

  return (
    <div className="mt-4">
      <p className="mb-3 text-xs text-muted-foreground">
        {hits.length} {hits.length === 1 ? "entry" : "entries"} tagged{" "}
        <span className="text-foreground">#{tag}</span>
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
          Nothing tagged #{tag}.
        </p>
      )}
    </div>
  );
}

/** Every tag in use, as tap targets into `TagResults` (§3.4). Hidden entirely once nothing has
 *  ever been tagged, the same "earns its place by disappearing" rule `Unsorted` follows. */
async function TagBrowser() {
  if (!isDatabaseConfigured()) return null;

  let tags: string[] = [];
  try {
    tags = await allTags(db());
  } catch {
    return null;
  }
  if (tags.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-base font-semibold tracking-tight">Tags</h2>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Link
            key={tag}
            href={`/private/log?tag=${encodeURIComponent(tag)}`}
            className="min-h-8 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            #{tag}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function LogPage({ searchParams }: PageProps<"/private/log">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  // `?tag=` browses every entry with one tag (§3.4) — a link target from `TagBrowser` and from
  // any tag chip elsewhere, not a control this page renders itself.
  const tag = typeof params.tag === "string" ? params.tag.trim() : "";

  /**
   * `?category=training` opens the form on that category (§3.5, D-178).
   *
   * Validated against the tab list rather than trusted: an unknown key would otherwise leave
   * the console with no matching tab and render nothing. Resolved on the server so the right
   * form is in the first paint — the shortcut exists to save taps, and arriving on the wrong
   * category and switching costs one.
   */
  const requested = typeof params.category === "string" ? params.category : "";
  const initialCategory = TAB_CATEGORIES.some((c) => c.key === requested) ? requested : undefined;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Log"
        title={query ? "Search" : tag ? "Tagged" : "Log"}
        lede={
          query || tag
            ? undefined
            : "One tab per kind of thing, each with its own fields. Saves immediately — no commit, no deploy."
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
      ) : tag ? (
        <>
          <Suspense
            fallback={
              <div className="mt-4">
                <SkeletonPanel rows={4} title={false} />
              </div>
            }
          >
            <TagResults tag={tag} />
          </Suspense>
          <Link
            href="/private/log"
            className="mt-4 inline-block font-mono text-xs text-primary hover:underline"
          >
            ← back to logging
          </Link>
        </>
      ) : (
        <>
          {/*
           * The way into training, from the screen the centre button lands on (Victor's call).
           *
           * Training is not a tab here and should not be — Phase 2.7 moved it to sessions, where
           * a set belongs to a workout rather than to an entry's JSON. But the centre button is
           * the one control that is under the thumb from every screen, and after the fold it led
           * to a log with no way to reach the thing most likely to be logged in a gym. A link
           * rather than a tab keeps the two models separate and the route two taps long.
           */}
          <Link
            href="/private/athletics/log"
            className="mt-6 flex min-h-12 items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 transition-colors hover:border-primary hover:bg-primary/10"
          >
            <span className="min-w-0">
              <span className="block text-sm text-primary">Log a training session</span>
              <span className="block text-xs text-muted-foreground">
                Exercises, sets and records — saved on this phone, synced when there is signal.
              </span>
            </span>
            <ArrowRightIcon className="icon-sm shrink-0 text-primary" aria-hidden />
          </Link>

          <div className="mt-6">
            <Suspense fallback={<SkeletonPanel rows={5} />}>
              <Console initialCategory={initialCategory} />
            </Suspense>
          </div>

          <Suspense fallback={null}>
            <TagBrowser />
          </Suspense>
        </>
      )}
    </div>
  );
}
