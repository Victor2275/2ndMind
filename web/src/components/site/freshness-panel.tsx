import type { FreshnessReport, FreshnessRow } from "@/lib/vault/freshness";

/** A file's own claim about itself, and how much to trust it. */
function Row({ row }: { row: FreshnessRow }) {
  const overdue = row.ageDays !== null ? row.ageDays - row.limitDays : null;

  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
      <span
        aria-hidden
        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
          row.verdict === "stale" ? "bg-destructive" : "bg-highlight"
        }`}
      />
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
        {row.path}
      </span>
      {row.verdict === "unknown" ? (
        <span className="font-mono text-[0.65rem] text-highlight">no date</span>
      ) : (
        <span className="tabular font-mono text-[0.65rem] text-muted-foreground">
          {row.ageDays}d old · {overdue}d over the {row.stability} limit
        </span>
      )}
    </li>
  );
}

export function FreshnessPanel({ report }: { report: FreshnessReport }) {
  const problems = [...report.stale, ...report.unknown];

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Vault freshness</h2>
        <span className="tabular font-mono text-[0.68rem] text-muted-foreground">
          {report.checked} files checked
        </span>
      </div>

      {problems.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
          Every file is inside its freshness window. Volatile files are held to{" "}
          <span className="text-foreground">14 days</span>, stable ones to{" "}
          <span className="text-foreground">180</span>.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            These are past their window. What they say should be treated as suspect rather
            than repeated as current fact.
          </p>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card/70">
            {problems.map((row) => (
              <Row key={row.path} row={row} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
