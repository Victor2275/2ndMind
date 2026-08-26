import { Stat } from "@/components/site/page-shell";
import type { Application, Pipeline, SheetResult } from "@/lib/jobs/sheet";
import { toPipeline } from "@/lib/jobs/sheet";

/**
 * The applications pipeline, read from the published sheet.
 *
 * A Server Component: the sheet URL is a credential and the rows are private, so none of this
 * may be shipped to a client bundle. It renders on the server and only the resulting HTML is
 * sent — to a page that already requires a session.
 */

function Row({ application }: { application: Application }) {
  const meta = [application.location, application.compensation, application.duration]
    .filter((value) => value !== "")
    .join(" · ");

  return (
    <li className="border-b border-border/50 py-2.5 last:border-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-medium text-foreground">{application.company}</span>
        {application.status !== "" && (
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
            {application.status}
          </span>
        )}
      </div>
      {/* The role is the long field and wraps; giving it its own line keeps the company
          scannable down the left edge at 390px. */}
      <p className="text-sm text-muted-foreground">
        {application.link !== "" ? (
          <a href={application.link} className="link-wipe hover:text-primary">
            {application.role || "(no role given)"}
          </a>
        ) : (
          application.role || "(no role given)"
        )}
      </p>
      {meta !== "" && <p className="font-mono text-[0.65rem] text-muted-foreground">{meta}</p>}
    </li>
  );
}

function Section({
  title,
  applications,
  limit,
  empty,
}: {
  title: string;
  applications: Application[];
  limit?: number;
  empty: string;
}) {
  const shown = limit ? applications.slice(0, limit) : applications;

  return (
    <section className="mt-6">
      <h3 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
        {applications.length > 0 && ` · ${applications.length}`}
      </h3>
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1">
          {shown.map((a) => (
            <Row key={`${a.company}-${a.role}-${a.added}`} application={a} />
          ))}
        </ul>
      )}
      {limit && applications.length > limit && (
        <p className="mt-2 font-mono text-[0.65rem] text-muted-foreground">
          + {applications.length - limit} more in the sheet
        </p>
      )}
    </section>
  );
}

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

      <Section
        title="Live"
        applications={pipeline.open}
        empty="Nothing outstanding — everything sent has been answered."
      />

      <Section
        title="Next up · high priority, not yet applied"
        applications={pipeline.shortlist}
        limit={8}
        empty="No high-priority postings left unapplied."
      />

      <section className="mt-6">
        <h3 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
          By status
        </h3>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {pipeline.byStatus.map((s) => (
            <li key={s.status} className="font-mono text-xs text-muted-foreground">
              {s.status} <span className="tabular text-foreground">{s.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
