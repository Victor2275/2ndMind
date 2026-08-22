import Link from "next/link";

import type { FreshnessReport } from "@/lib/vault/freshness";

/**
 * Vault freshness, as a notification rather than a panel.
 *
 * V1 gave this a full-width section listing all 34 files. Victor's verdict: it should be an
 * alert that something is stale, not a permanent bar — "the full bar itself should be removed
 * in place of a less-invasive notification system".
 *
 * So: silent when everything is fine, a single quiet chip when it is not, and the detail
 * hidden behind a native `<details>` for the moment you actually want it. Reverses the
 * presentation half of the freshness work while keeping the audit itself untouched.
 */
export function FreshnessBadge({ report }: { report: FreshnessReport }) {
  const problems = [...report.stale, ...report.unknown];

  // Nothing to say. The best notification is the one that is not there.
  if (problems.length === 0) return null;

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-highlight/40 bg-highlight/10 px-2.5 py-1 transition-colors hover:border-highlight/70 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="size-1.5 rounded-full bg-highlight" />
        <span className="font-mono text-[0.65rem] text-highlight">
          {problems.length} stale
        </span>
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-3rem))] rounded-lg border border-border bg-popover p-3 shadow-xl">
        <p className="mb-2 text-xs text-muted-foreground">
          Past their freshness window. Treat as suspect rather than current.
        </p>
        <ul className="space-y-1">
          {problems.slice(0, 8).map((row) => (
            <li key={row.path} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 flex-1 truncate font-mono text-[0.65rem] text-foreground">
                {row.path}
              </span>
              <span className="tabular shrink-0 font-mono text-[0.6rem] text-muted-foreground">
                {row.verdict === "unknown" ? "no date" : `${row.ageDays}d`}
              </span>
            </li>
          ))}
        </ul>
        {problems.length > 8 && (
          <p className="mt-2 font-mono text-[0.6rem] text-muted-foreground">
            and {problems.length - 8} more
          </p>
        )}
        <Link
          href="/private/academics"
          className="mt-3 inline-block font-mono text-[0.65rem] text-primary hover:underline"
        >
          {report.checked} files checked
        </Link>
      </div>
    </details>
  );
}
