/**
 * The text alternative every chart carries — V4 §7.4 (Q450), D-312.
 *
 * `role="img"` with an `aria-label` is what these SVGs had, and for a line it is not an
 * alternative to anything: "Estimated 1RM" tells a screen reader the chart's subject and
 * none of its content. The label is a *title*. This is the content.
 *
 * Three things decided its shape:
 *
 * - **A table, not a sentence.** A chart is tabular data drawn as a shape, so the honest
 *   text form is the table it was drawn from. A generated sentence ("rose from 92kg to
 *   104kg over eight sessions") throws away every point in between and states a trend the
 *   chart may not support.
 * - **Behind a `<details>`, closed.** Q450 asks for the disclosure, and the reason is that
 *   this is the same data twice: open by default it doubles the height of every chart on
 *   Athletics. Native `<details>` means no hydration boundary and no client JavaScript —
 *   these chart components are Server Components and stay that way.
 * - **Not `aria-hidden` on the SVG.** Leaving the `role="img"` label in place gives a
 *   screen-reader user the chart's subject where it sits, and the table right after it.
 *   Hiding the graphic entirely would make the disclosure the only route to the data, and a
 *   closed `<details>` is easy to pass straight over.
 *
 * It is also the answer to `forced-colors` (Q453) for charts, which is why there is no
 * `forced-color-adjust: none` in `globals.css`: when the OS flattens the series colours into
 * one, the legend and this table still say which line was which.
 */

type ChartTableProps = {
  /** The x-axis labels, one per row. */
  labels: string[];
  /** One column per series, already formatted — `null` where that series has no point. */
  columns: { label: string; cells: (string | null)[] }[];
  /** What the rows are, for the row-header column. Usually "Session" or "Week". */
  rowHeader?: string;
};

export function ChartTable({ labels, columns, rowHeader = "Point" }: ChartTableProps) {
  if (labels.length === 0) return null;

  return (
    <details className="group mt-2">
      <summary className="cursor-pointer list-none eyebrow text-muted-foreground transition-colors hover:text-foreground">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90">
          &rsaquo;
        </span>
        Data · {labels.length} {labels.length === 1 ? "point" : "points"}
      </summary>

      {/* The chart is often wider than a phone; so is its table. */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-normal">
                {rowHeader}
              </th>
              {columns.map((column) => (
                <th key={column.label} scope="col" className="py-1 pr-3 font-normal">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, index) => (
              <tr key={`${label}-${index}`} className="border-b border-border/50 last:border-0">
                <th scope="row" className="py-1 pr-3 font-normal text-muted-foreground">
                  {label}
                </th>
                {columns.map((column) => (
                  <td key={column.label} className="tabular py-1 pr-3 text-foreground">
                    {/* An em dash, not an empty cell: a gap in the series is a fact about the
                        data, and a blank cell reads as a rendering fault. */}
                    {column.cells[index] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
