import type { Application, Stage, StageColumn } from "@/lib/jobs/sheet";

/**
 * The applications pipeline as a board (V4 §5.8, Q419, Q420).
 *
 * ## Read-only, and that is the decision rather than an omission
 *
 * §5.8's brief says "columns with a status control, per 5.7" — the answer of 2026-09-19 that
 * replaced drag-and-drop everywhere in the private app. **This board has no control**, because
 * there is nowhere for it to write: the sheet is maintained by a background script that scans
 * Victor's Gmail, and `lib/jobs/sheet.ts` exists to *read* it. The page's own lede says nothing
 * here writes to the sheet, and that is the property worth keeping — a second writer is how a
 * tracker stops being a source of truth. See D-300.
 *
 * So the board is a view: five stages, derived from a free-text status that a script writes in
 * whatever words the mail used.
 *
 * ## Colour never signals alone (Q420, rule 10)
 *
 * Each column is headed by its name, its count, and a tone. Every card also carries the sheet's
 * own status text, so "Interviewing" is legible as a word in three places before any hue is
 * involved.
 *
 * ## Why it stacks rather than scrolls on a phone
 *
 * A five-column board at 360px is either a horizontal scroll that hides the stage you want or
 * five 60px columns. Stacked, each stage is a section with its own heading — which is what a
 * board *is* on a phone, and Q238's "restructure into cards under 40rem" one screen along.
 */

/** Tone per stage. Doubled by the label beside it, never carrying the meaning on its own. */
const TONE: Record<Stage, { rule: string; text: string }> = {
  shortlist: { rule: "bg-border", text: "text-muted-foreground" },
  applied: { rule: "bg-secondary", text: "text-secondary" },
  interviewing: { rule: "bg-primary", text: "text-primary" },
  offer: { rule: "bg-highlight", text: "text-highlight" },
  closed: { rule: "bg-border", text: "text-faint-foreground" },
};

/** What each column says when it is empty — the state, not an apology. */
const EMPTY: Record<Stage, string> = {
  shortlist: "Nothing high-priority is waiting.",
  applied: "Nothing sent and unanswered.",
  interviewing: "No interviews in flight.",
  offer: "No offers yet.",
  closed: "Nothing closed out.",
};

export function PipelineBoard({
  columns,
  totals,
  limit = 6,
}: {
  columns: StageColumn[];
  /** The true count per stage, including rows a column does not list. */
  totals: Record<Stage, number>;
  limit?: number;
}) {
  return (
    <div className="grid gap-4 laptop:grid-cols-5 laptop:gap-3">
      {columns.map((column) => {
        const total = totals[column.stage];
        const hidden = total - Math.min(column.applications.length, limit);

        return (
          <section key={column.stage} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className={`eyebrow ${TONE[column.stage].text}`}>{column.label}</h3>
              <span className="tabular text-xs text-muted-foreground">{total}</span>
            </div>
            <div className={`mt-1.5 h-px w-full ${TONE[column.stage].rule}`} />

            {column.applications.length === 0 ? (
              <p className="mt-3 text-xs text-faint-foreground">{EMPTY[column.stage]}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {column.applications.slice(0, limit).map((application) => (
                  <Card
                    key={`${application.company}-${application.role}-${application.added}`}
                    application={application}
                  />
                ))}
              </ul>
            )}

            {hidden > 0 && (
              // Said, not hidden. The shortlist column lists high-priority rows only, and 173
              // of 178 postings sit behind this line — a board that silently dropped them would
              // be a different claim about the sheet.
              <p
                data-tiny-text="the count of rows not shown in this column"
                className="mt-2 text-[0.65rem] text-muted-foreground"
              >
                + {hidden} more in the sheet
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Card({ application }: { application: Application }) {
  const meta = [application.location, application.compensation, application.duration]
    .filter((value) => value !== "")
    .join(" · ");

  return (
    <li className="rounded-lg border border-border bg-card/60 px-3 py-2.5">
      <p className="text-sm font-medium text-foreground">{application.company}</p>

      <p className="text-xs text-muted-foreground">
        {application.link !== "" ? (
          <a href={application.link} className="link-wipe hover:text-primary">
            {application.role || "(no role given)"}
          </a>
        ) : (
          application.role || "(no role given)"
        )}
      </p>

      {/* The sheet's own words, not our stage name. "OA sent" and "Phone screen booked" are
          both `interviewing`, and which one it is matters more than the column it landed in. */}
      {application.status !== "" && (
        <p className="mt-1.5 eyebrow text-muted-foreground">{application.status}</p>
      )}

      {/* §7.1 text-floor allowlist (Q113) on the line below: the application's company and
          date under its title, on a board column narrow enough that four fit across a
          laptop. */}
      {meta !== "" && (
        <p
          data-tiny-text="application meta under its title; four columns must fit across"
          className="mt-0.5 font-mono text-[0.65rem] text-faint-foreground"
        >
          {meta}
        </p>
      )}
    </li>
  );
}
