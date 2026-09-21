import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { PageHeader } from "@/components/site/page-shell";
import { SummaryPanel } from "@/components/site/summary-panel";
import { Empty, Unavailable } from "@/components/site/states";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { describeDbError } from "@/lib/db/describe";
import { localDay, recentSummaries } from "@/lib/ai/summaries";
import type { AiSummary } from "@/lib/db/schema";
import { zoneOffsetMinutes } from "@/lib/tasks/queries";

export const dynamic = "force-dynamic";

/**
 * The summary archive (V4 §5.4, Q390 — answered 2026-09-19: **its own route**).
 *
 * ## Why it is a route and not a panel
 *
 * It was a collapsed panel at the bottom of Today, which is the page the whole of §5.4 is
 * about making shorter. Three places it could have gone instead, and why they lost:
 *
 * - **A tab.** Q258 already records the tab row as having too much in it. A record you read
 *   every few weeks does not earn a permanent seat under the thumb.
 * - **A section at the bottom of `/private/log`.** That puts a wall of read-only prose beneath
 *   the app's most-used write surface — Q130's complaint, arranged vertically.
 * - **Staying on Today.** Fourteen days of model-written paragraphs on the page that answers
 *   "what do I do now" is the definition of the wrong weight.
 *
 * So: a route under the log, reached from the two summary panels on Today, holding both kinds.
 *
 * ## Why both kinds, in one list
 *
 * The daily and weekly summaries describe the same history at two zoom levels and are written
 * by the same model from the same table. Two lists would mean choosing which to show first and
 * would hide the fact that a week's summary sits among the days it covers. One list ordered by
 * the period each describes puts a week directly above the days inside it.
 */

const LABEL = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});

const SHORT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});

/** Parsed at UTC noon so formatting back into Los Angeles cannot slip to the day before. */
function at(periodStart: string): Date {
  return new Date(`${periodStart}T12:00:00Z`);
}

/** "Week of Sep 15 – Sep 21" for a weekly row, the plain date for a daily one. */
function title(row: AiSummary): string {
  const start = at(row.periodStart);
  if (row.kind !== "weekly") return LABEL.format(start);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return `Week of ${SHORT.format(start)} – ${SHORT.format(end)}`;
}

async function Archive() {
  if (!isDatabaseConfigured()) {
    return (
      <Unavailable
        subject="The archive"
        detail="DATABASE_URL is not set, so stored summaries cannot load."
        className="mt-6"
      />
    );
  }

  let rows: AiSummary[];
  try {
    // 90 rows is roughly three months of days plus the weeks inside them. Paging a record
    // nobody reads back further than a term would be machinery for a problem that does not
    // exist yet; when it does, this is where a `?before=` goes.
    rows = await recentSummaries(db(), { limit: 90 });
  } catch (error) {
    return (
      <Unavailable
        subject="The archive"
        detail={describeDbError(error, { subject: "The ai_summaries table" })}
        className="mt-6"
      />
    );
  }

  // Today's daily summary is on Today, in its own panel, being written as the day fills in.
  // Repeating it here would put a half-finished sentence at the top of a record of finished
  // ones. The current week is kept: it is not the same thing as today.
  const today = localDay(new Date(), zoneOffsetMinutes(new Date()));
  const earlier = rows.filter((row) => !(row.kind === "daily" && row.periodStart === today));

  if (earlier.length === 0) {
    return (
      <div className="mt-6">
        <Empty action={{ href: "/private", label: "Open Today" }}>
          Nothing archived yet. A summary is stored the first time one is written on Today — they
          arrive on their own, one a day.
        </Empty>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {earlier.map((row) => (
        <SummaryPanel key={row.id} title={title(row)} model={row.model} text={row.summary} />
      ))}
    </div>
  );
}

export default async function SummaryArchivePage() {
  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Log"
        title="Archive"
        lede="Every summary the app has written, newest first. Daily and weekly, in the order of the days they describe."
      />

      <Archive />

      <Link
        href="/private/log"
        className="mt-6 inline-flex min-h-11 press items-center gap-1.5 text-sm text-primary transition-colors duration-fast ease-standard hover:underline"
      >
        <ArrowLeftIcon aria-hidden className="icon-sm" />
        Back to the log
      </Link>
    </div>
  );
}
