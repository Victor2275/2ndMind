import { Stat } from "@/components/site/page-shell";
import { PipelineBoard } from "@/components/site/pipeline-board";
import type { Pipeline, SheetResult, Stage } from "@/lib/jobs/sheet";
import { STAGES, stageColumns, stageTotal, toPipeline } from "@/lib/jobs/sheet";

/**
 * The applications pipeline, read from the published sheet.
 *
 * A Server Component: the sheet URL is a credential and the rows are private, so none of this
 * may be shipped to a client bundle. It renders on the server and only the resulting HTML is
 * sent — to a page that already requires a session.
 */

export function ApplicationsPanel({ sheet }: { sheet: SheetResult }) {
  // A message, never an error page. This is one panel among several, and Google being slow or
  // the URL being unset must not take out the strategy documents beside it.
  if (sheet.error) {
    return <p className="text-sm text-muted-foreground">{sheet.error}</p>;
  }

  if (sheet.applications.length === 0) {
    return <p className="text-sm text-muted-foreground">The sheet loaded, but it is empty.</p>;
  }

  const pipeline: Pipeline = toPipeline(sheet.applications);
  const columns = stageColumns(sheet.applications);
  // The true count per stage, so a column that lists six of forty can say so.
  const totals = Object.fromEntries(
    STAGES.map((stage) => [stage, stageTotal(sheet.applications, stage)]),
  ) as Record<Stage, number>;

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Postings" value={pipeline.total} />
        <Stat label="Applied" value={pipeline.submitted.length} />
        <Stat
          label="Live"
          value={pipeline.open.length}
          hint={pipeline.open.length === 0 ? "nothing outstanding" : undefined}
        />
      </div>

      {sheet.skipped > 0 && (
        // Surfaced rather than swallowed: rows without a company or role mean the sheet's
        // shape has drifted, and the only symptom otherwise is a total that quietly shrinks.
        <p className="mt-3 font-mono text-[0.65rem] text-muted-foreground">
          {sheet.skipped} row(s) had no company or role and were skipped.
        </p>
      )}

      {/* The board (§5.8, Q419). It replaces three hand-rolled sections — "Live", "Next up"
          and a status tally — which between them said the same thing three times and never
          said where a given application had got to. */}
      <div className="mt-6">
        <PipelineBoard columns={columns} totals={totals} />
      </div>
    </div>
  );
}
