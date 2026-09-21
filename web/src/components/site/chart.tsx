import { ChartPin } from "@/components/site/chart-pin";
import { Empty } from "@/components/site/states";

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

/**
 * ## What V4 §5.9 added, and why each of them is here
 *
 * - **The one number above the chart** (Q230). Every chart in the private app now leads with
 *   the figure it exists to show, and a delta that carries both an arrow and a colour (Q240).
 *   A line answers "what shape"; the number answers "what is it", which is the question asked
 *   first and most often.
 * - **Near-sparklines on a phone, full axes on a desktop** (Q231), done in CSS rather than in
 *   two renders: the axis labels carry `phone-hidden` and the endpoint callout `phone-only`, so
 *   one server-rendered SVG is both charts.
 * - **Horizontal gridlines only, very faint** (Q232) — they were `--border` at full strength,
 *   which on the carbon ground is a line as loud as the series.
 * - **Tap to pin** (Q235), as an overlay that carries only the strings it shows. See
 *   `chart-pin.tsx` for why the SVG stays a Server Component.
 * - **No mount animation**, which is the state this file was already in and is now written
 *   down: a chart that animates on arrival is a chart you cannot read for 400ms.
 */

export type ChartSeries = {
  label: string;
  /** A CSS colour, normally a `var(--…)` from the palette. */
  color: string;
  /** One value per x position; `null` leaves a gap rather than interpolating through it. */
  values: (number | null)[];
  dashed?: boolean;
};

/**
 * The number a chart leads with (Q230, Q240).
 *
 * `direction` is the arrow and `good` decides the colour, because the two are not the same
 * question: a bodyweight that fell is down and may be either, and a split that fell is down and
 * is always good. Where `good` is undefined the delta is muted — an honest "it moved" rather
 * than a judgement the chart is not entitled to make.
 */
export type ChartLead = {
  value: string;
  label: string;
  delta?: { text: string; direction: "up" | "down" | "flat"; good?: boolean };
};

export function ChartHeadline({ lead }: { lead: ChartLead }) {
  const tone =
    lead.delta?.good === undefined
      ? "text-muted-foreground"
      : lead.delta.good
        ? "text-primary"
        : "text-highlight";

  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="tabular text-2xl leading-none font-semibold text-foreground">
        {lead.value}
      </span>
      <span className="eyebrow text-muted-foreground">{lead.label}</span>
      {lead.delta && (
        <span className={`tabular flex items-center gap-0.5 text-xs ${tone}`}>
          {/* Arrow *and* colour, per rule 10 — and the arrow is a character rather than an
              icon so it inherits the number's tabular metrics beside it. */}
          <span aria-hidden>
            {lead.delta.direction === "up" ? "↑" : lead.delta.direction === "down" ? "↓" : "→"}
          </span>
          {lead.delta.text}
        </span>
      )}
    </div>
  );
}

/**
 * A lead built from a series: its last value, and the change from its first.
 *
 * `lowerIsBetter` is what turns a direction into a verdict — splits improve downward, weight
 * moved is better upward. Left undefined, the delta is reported without a colour.
 */
export function leadFromSeries(
  series: ChartSeries,
  format: (value: number) => string,
  options: { label: string; lowerIsBetter?: boolean },
): ChartLead | undefined {
  const values = finite(series.values);
  if (values.length === 0) return undefined;

  const last = values[values.length - 1];
  const first = values[0];
  const change = last - first;
  const direction = Math.abs(change) < 1e-9 ? "flat" : change > 0 ? "up" : "down";

  return {
    value: format(last),
    label: options.label,
    delta:
      values.length < 2
        ? undefined
        : {
            text: direction === "flat" ? "no change" : format(Math.abs(change)),
            direction,
            good:
              options.lowerIsBetter === undefined || direction === "flat"
                ? undefined
                : options.lowerIsBetter
                  ? direction === "down"
                  : direction === "up",
          },
  };
}

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
  /** The one number this chart exists to show (Q230). */
  lead?: ChartLead;
  /** Tap-to-pin (Q235). Off for a chart small enough that the endpoint callout is the answer. */
  pinnable?: boolean;
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
  lead,
  pinnable = true,
}: TrendChartProps) {
  const all = series.flatMap((s) => finite(s.values));
  if (target) all.push(target.value);

  if (all.length === 0 || labels.length === 0) {
    // The shared state (§5.1), replacing one more copy of the dashed box.
    return <Empty>Not enough data to plot yet. Two sessions is the minimum for a line.</Empty>;
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

  /** Only the strings the readout shows — no numbers to re-derive in a client bundle. */
  const points = labels.map((label, index) => ({
    label,
    entries: series
      .map((s) => ({ label: s.label, color: s.color, value: s.values[index] }))
      .filter((entry): entry is { label: string; color: string; value: number } =>
        Number.isFinite(entry.value as number),
      )
      .map((entry) => ({ label: entry.label, color: entry.color, text: format(entry.value) })),
  }));

  return (
    <figure className="m-0">
      {lead && <ChartHeadline lead={lead} />}

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label={caption ?? series.map((s) => s.label).join(", ")}
          preserveAspectRatio="none"
        >
          <title>{caption ?? series.map((s) => s.label).join(", ")}</title>

          {/* Horizontal only, and faint (Q232). They were `--border` at full strength, which on
            the carbon ground draws a line as loud as the series it is behind. */}
          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--border)"
                strokeWidth={1}
                strokeOpacity={0.55}
              />
              {/* The axis is a desktop thing (Q231). `phone-hidden` is the app's own display
                switch and works on SVG text like anything else, so one server-rendered chart
                is a full-axis chart on a laptop and a sparkline on a phone — where the
                endpoint callout under the figure carries the number instead. */}
              <text
                x={PAD.left - 6}
                y={y(value) + 3}
                textAnchor="end"
                className="phone-hidden fill-[var(--color-muted-foreground)] font-mono"
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

        {/* Tap to pin (Q235). Inside the positioned box, over the SVG. */}
        {pinnable && labels.length > 1 && <ChartPin points={points} />}
      </div>

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
  /** The one number (Q230) — for a bar chart of weeks, usually the last complete one. */
  lead?: ChartLead;
};

/** Weekly totals. Bars rather than a line because a week is a bucket, not a measurement. */
export function BarChart({ bars, format, height = 120, lead }: BarChartProps) {
  if (bars.length === 0) {
    return <Empty>Nothing logged in this window.</Empty>;
  }

  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="overflow-x-auto">
      {lead && <ChartHeadline lead={lead} />}
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
