/**
 * Charts as plain SVG, rendered on the server.
 *
 * `recharts` is in `package.json` and was never used. Reaching for it here would ship a
 * charting runtime plus a client boundary to draw what is, in the end, one `<polyline>` —
 * and it would turn a page that currently streams as HTML into one that renders after
 * hydration. These components are Server Components: no JavaScript reaches the browser, and
 * the chart is in the first byte of the response.
 *
 * Points are spaced evenly by index rather than by date. Training data is naturally
 * per-session — three lifts in a week and then a rest week — and a true time axis spends most
 * of its width on the gaps. The axis labels state the real date range so the compression is
 * visible rather than implied.
 */

export type ChartSeries = {
  label: string;
  /** A CSS colour, normally a `var(--…)` from the palette. */
  color: string;
  /** One value per x position; `null` leaves a gap rather than interpolating through it. */
  values: (number | null)[];
  dashed?: boolean;
};

type TrendChartProps = {
  /** X categories, oldest first. Only the first and last are labelled. */
  labels: string[];
  series: ChartSeries[];
  /** Renders a value for the axis and the endpoint callout. */
  format: (value: number) => string;
  /** True when lower is better — splits. Flips the y axis so "better" is still upward. */
  invert?: boolean;
  /** A horizontal reference line, e.g. the vault's goal split. */
  target?: { value: number; label: string };
  height?: number;
  caption?: string;
};

const PAD = { top: 12, right: 12, bottom: 20, left: 44 };
const WIDTH = 600;

function finite(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v !== null && Number.isFinite(v));
}

export function TrendChart({
  labels,
  series,
  format,
  invert = false,
  target,
  height = 180,
  caption,
}: TrendChartProps) {
  const all = series.flatMap((s) => finite(s.values));
  if (target) all.push(target.value);

  if (all.length === 0 || labels.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Not enough data to plot yet.
      </p>
    );
  }

  let min = Math.min(...all);
  let max = Math.max(...all);

  // A flat series would otherwise divide by zero and collapse onto one edge. Give it a band
  // so the line sits in the middle and reads as "unchanged" rather than as "at the floor".
  if (max - min < 1e-9) {
    const nudge = Math.max(Math.abs(max) * 0.05, 1);
    min -= nudge;
    max += nudge;
  } else {
    const margin = (max - min) * 0.12;
    min -= margin;
    max += margin;
  }

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const x = (i: number) =>
    labels.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (labels.length - 1)) * plotW;

  const y = (value: number) => {
    const t = (value - min) / (max - min);
    // `invert` means low values are good, so low values go to the top.
    return PAD.top + (invert ? t : 1 - t) * plotH;
  };

  const gridValues = [min, min + (max - min) / 2, max];

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={caption ?? series.map((s) => s.label).join(", ")}
        preserveAspectRatio="none"
      >
        <title>{caption ?? series.map((s) => s.label).join(", ")}</title>

        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(value) + 3}
              textAnchor="end"
              className="fill-[var(--color-muted-foreground)] font-mono"
              fontSize={9}
            >
              {format(value)}
            </text>
          </g>
        ))}

        {target && (
          <g>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(target.value)}
              y2={y(target.value)}
              stroke="var(--highlight)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text
              x={WIDTH - PAD.right}
              y={y(target.value) - 4}
              textAnchor="end"
              className="fill-[var(--highlight)] font-mono"
              fontSize={9}
            >
              {target.label}
            </text>
          </g>
        )}

        {series.map((s) => {
          const drawn = s.values
            .map((value, i) => ({ value, i }))
            .filter((p): p is { value: number; i: number } => p.value !== null);
          if (drawn.length === 0) return null;

          const path = drawn.map((p) => `${x(p.i)},${y(p.value)}`).join(" ");
          const last = drawn[drawn.length - 1];

          return (
            <g key={s.label}>
              {drawn.length > 1 && (
                <polyline
                  points={path}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={s.dashed ? "4 3" : undefined}
                />
              )}
              {/* The most recent point is the one being asked about, so it is the one marked. */}
              <circle cx={x(last.i)} cy={y(last.value)} r={3} fill={s.color} />
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex flex-wrap items-center gap-3">
          {series.map((s) => (
            <span
              key={s.label}
              className="flex items-center gap-1.5 font-mono text-[0.6rem] text-muted-foreground"
            >
              <span
                aria-hidden
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
              {(() => {
                const values = finite(s.values);
                return values.length > 0 ? (
                  <span className="tabular text-foreground">
                    {format(values[values.length - 1])}
                  </span>
                ) : null;
              })()}
            </span>
          ))}
        </span>
        <span className="tabular font-mono text-[0.6rem] text-muted-foreground">
          {labels[0]}
          {labels.length > 1 && ` → ${labels[labels.length - 1]}`}
        </span>
      </figcaption>
    </figure>
  );
}

type BarChartProps = {
  bars: { label: string; value: number; sublabel?: string }[];
  format: (value: number) => string;
  height?: number;
};

/** Weekly totals. Bars rather than a line because a week is a bucket, not a measurement. */
export function BarChart({ bars, format, height = 120 }: BarChartProps) {
  if (bars.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Nothing logged in this window.
      </p>
    );
  }

  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="overflow-x-auto">
      <div
        className="flex min-w-[18rem] items-end gap-1.5"
        style={{ height }}
        role="img"
        aria-label={bars.map((b) => `${b.label}: ${format(b.value)}`).join("; ")}
      >
        {bars.map((bar, i) => (
          <div key={bar.label} className="flex min-w-0 flex-1 flex-col justify-end gap-1">
            <span className="tabular truncate text-center font-mono text-[0.55rem] text-muted-foreground">
              {bar.value > 0 ? format(bar.value) : ""}
            </span>
            <div
              className={`w-full rounded-t-sm ${
                // The current week is partial by definition, so it is drawn hollow rather
                // than as a short bar that reads as a drop in training.
                i === bars.length - 1 ? "border border-primary/70 bg-primary/20" : "bg-primary/70"
              }`}
              style={{ height: `${Math.max((bar.value / max) * 100, bar.value > 0 ? 3 : 1)}%` }}
            />
            <span className="truncate text-center font-mono text-[0.5rem] text-muted-foreground">
              {bar.sublabel ?? bar.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
