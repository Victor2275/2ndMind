/**
 * Loading placeholders.
 *
 * Every private page is `force-dynamic`, so a navigation cannot be served from a static
 * payload — the browser sits on the *old* page until the server responds. Measured on
 * production, a dynamic route with no database and no API call still costs 335–440ms of
 * Vercel function time, and clicking a link during that window looks like nothing happened.
 *
 * These fill the gap. They are not decoration: without a loading boundary the App Router has
 * nothing to show, and the app feels broken rather than busy.
 *
 * ## Exact shape, not a generic block (V4 §5.1, Q279)
 *
 * A skeleton earns its keep by reserving the space the real thing will take. One that does not
 * is worse than none: the content lands, the page jumps, and the jump happens under a thumb
 * that is already reaching for something. `SkeletonStats` has mirrored the real stats row since
 * V3 for exactly that reason; `SkeletonPanel` did not — it drew a checkbox, a line and a meta
 * column whatever was behind it, so a chart resolved into a 240px panel where three 12px rows
 * had been, and a table resolved into six columns where one had.
 *
 * `shape` is that fix. Each value mirrors one real layout in the app, and a caller says which
 * one it is waiting for. The shapes are few on purpose — five, not one per screen — because a
 * skeleton that is *exactly* right is a second copy of a layout that will drift, and the jump
 * a shape has to prevent is the 200px one, not the 4px one.
 *
 * ## They do not move (Q204)
 *
 * Q204 was a **[FORK]** and it was answered: *static — a shimmer on a screen that resolves in
 * 200ms is worse than nothing*. So the `animate-pulse` that had been here since V3 is gone and
 * nothing here animates.
 *
 * This contradicts the rationale written beside the `shimmer` utility in `globals.css` during
 * §1.8, which argued a static skeleton is indistinguishable from a panel that failed to render.
 * That is a real objection and it is answered by shape rather than by motion: a failed panel is
 * *absent*, and these are a recognisable arrangement of blocks sitting exactly where the
 * content will be. Q204 is Victor's own answer to the question and outranks a component
 * comment. See DECISIONS.md D-259 for the reversal, which is one class.
 */

import type { ReactNode } from "react";

/** One block. The unit everything below is built from. */
export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-muted-foreground/15 ${className}`} />;
}

export function SkeletonStats() {
  return (
    // Grid and spacing mirror the real stats row on `/private` exactly. When they drifted,
    // the page jumped as the tasks resolved — three stacked placeholders collapsing into one
    // row is a ~200px shift under the reader's thumb.
    <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card/60 px-3 py-3 sm:px-4">
          <SkeletonLine className="h-2 w-12" />
          <SkeletonLine className="mt-3 h-5 w-8" />
        </div>
      ))}
    </div>
  );
}

/**
 * What the panel being waited on is shaped like.
 *
 * - `rows` — a list: a control, a label, a value. Tasks, sessions, sets, agenda items.
 * - `text` — prose or a summary. Full-width lines of varying length, no control column.
 * - `table` — a header rule and right-aligned numeric columns. The record board, adjusted splits.
 * - `chart` — a number above a plot area, which is the shape §5.9 gives every chart.
 * - `board` — columns of cards. The pipeline and the planner.
 */
export type SkeletonShape = "rows" | "text" | "table" | "chart" | "board";

/** A panel, shaped like the thing it is standing in for. */
export function SkeletonPanel({
  rows = 3,
  title = true,
  shape = "rows",
}: {
  rows?: number;
  title?: boolean;
  shape?: SkeletonShape;
}) {
  return (
    <section className="rounded-xl border border-border bg-card/60 p-6">
      {title && <SkeletonLine className="h-3 w-28" />}
      <div className={title ? "mt-5" : ""}>{BODY[shape](rows)}</div>
    </section>
  );
}

/**
 * Widths that vary per row, so the block reads as content rather than as a loading bar.
 *
 * Deterministic — indexed, not random. A random width re-rolls on every render and, worse,
 * differs between the server's HTML and the client's first pass, which React reports as a
 * hydration mismatch on a component whose entire job is to be uncontroversial.
 */
const WIDTHS = ["w-[72%]", "w-[54%]", "w-[83%]", "w-[46%]", "w-[66%]", "w-[77%]"];
const widthAt = (i: number) => WIDTHS[i % WIDTHS.length];

const BODY: Record<SkeletonShape, (rows: number) => ReactNode> = {
  rows: (rows) => (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonLine className="size-[18px] shrink-0 rounded-[5px]" />
          <SkeletonLine className={`h-3 ${widthAt(i)}`} />
          <SkeletonLine className="ml-auto h-2 w-10 shrink-0" />
        </div>
      ))}
    </div>
  ),

  text: (rows) => (
    <div className="space-y-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonLine key={i} className={`h-2.5 ${widthAt(i)}`} />
      ))}
    </div>
  ),

  table: (rows) => (
    <div>
      {/* The header rule, which is what makes this read as a table at a glance rather than as
          a list with an odd right margin. */}
      <div className="flex items-center gap-3 border-b border-border pb-2">
        <SkeletonLine className="h-2 w-20" />
        <SkeletonLine className="ml-auto h-2 w-10" />
        <SkeletonLine className="h-2 w-10" />
      </div>
      <div className="mt-3 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonLine className={`h-3 ${widthAt(i)}`} />
            <SkeletonLine className="ml-auto h-3 w-10 shrink-0" />
            <SkeletonLine className="h-3 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  ),

  // The one number above the plot is not an artistic choice — §5.9 puts it above every chart in
  // the app, so a chart skeleton without it reserves the wrong height by about 40px.
  chart: () => (
    <div>
      <SkeletonLine className="h-6 w-24" />
      <SkeletonLine className="mt-1.5 h-2 w-32" />
      <SkeletonLine className="mt-4 aspect-[16/9] w-full rounded-lg" />
    </div>
  ),

  board: (rows) => (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {Array.from({ length: Math.max(2, Math.min(rows, 4)) }, (_, column) => (
        <div key={column} className="space-y-2">
          <SkeletonLine className="h-2 w-16" />
          <SkeletonLine className="h-14 w-full rounded-lg" />
          <SkeletonLine className="h-14 w-full rounded-lg" />
        </div>
      ))}
    </div>
  ),
};

export function SkeletonHeader() {
  return (
    <header className="border-b border-border pb-6">
      <SkeletonLine className="h-2 w-24" />
      <SkeletonLine className="mt-3 h-7 w-40" />
    </header>
  );
}
