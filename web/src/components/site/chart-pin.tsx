"use client";

import { useState } from "react";

/**
 * Tap a chart to pin a value (V4 §5.9, Q235).
 *
 * Q235 rules out tooltips *on touch*, which is the common half of the answer; the other half is
 * that a chart you cannot interrogate at all is a picture. This is the smallest thing that is
 * neither: an overlay that turns a tap into a pinned readout, and keeps it until the next tap
 * or a tap outside.
 *
 * ## Why an overlay rather than an interactive SVG
 *
 * `TrendChart` is a Server Component that renders plain SVG — no charting runtime, no
 * hydration, in the first byte of the response. Making it interactive would make the whole
 * chart a client component and put the series data in a client bundle twice over. Instead the
 * SVG stays where it is, and this layer sits on top carrying **only the strings it displays**:
 * already formatted, no numbers to re-derive, nothing sensitive that the chart is not showing.
 *
 * The index comes from the pointer's x position as a fraction of the width, which matches
 * `TrendChart`'s own even-by-index spacing exactly. No measurement, no resize listener.
 *
 * Nothing sensitive may be hard-coded here; this compiles into `/_next/static/chunks/`.
 */

export type PinPoint = {
  /** The x label — a date, normally. */
  label: string;
  entries: { label: string; color: string; text: string }[];
};

export function ChartPin({ points }: { points: PinPoint[] }) {
  const [pinned, setPinned] = useState<number | null>(null);

  if (points.length === 0) return null;

  const pick = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const fraction = (event.clientX - box.left) / box.width;
    const index = Math.round(fraction * (points.length - 1));
    const clamped = Math.min(Math.max(index, 0), points.length - 1);
    // Tapping the pinned point again clears it: the same gesture puts it up and takes it down,
    // which is the only way to dismiss a readout on a screen with no hover and no Escape key.
    setPinned((current) => (current === clamped ? null : clamped));
  };

  const point = pinned === null ? null : points[pinned];

  return (
    <>
      <div
        // `absolute inset-0` over the chart's own box. `touch-none` so a tap is not also the
        // start of a scroll gesture the browser then claims.
        className="absolute inset-0 touch-none"
        onPointerDown={pick}
        role="presentation"
      />

      {point && (
        <>
          {/* The rule, drawn in the overlay rather than in the SVG so the server render stays
              a static picture. Left-positioned by the same fraction the index came from. */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-5 w-px bg-foreground/30"
            style={{
              left: `${points.length === 1 ? 50 : (pinned! / (points.length - 1)) * 100}%`,
            }}
          />

          <div
            role="status"
            className="pointer-events-none absolute top-0 right-0 rounded-control border border-border bg-card px-2 py-1.5 shadow-[var(--elevation-overlay)]"
          >
            <p className="tabular eyebrow text-muted-foreground">{point.label}</p>
            {point.entries.map((entry) => (
              <p key={entry.label} className="flex items-center gap-1.5 text-xs text-foreground">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.label}</span>
                <span className="tabular">{entry.text}</span>
              </p>
            ))}
          </div>
        </>
      )}
    </>
  );
}
