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
 */

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted-foreground/15 ${className}`} />;
}

export function SkeletonStats() {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card/60 px-4 py-3">
          <SkeletonLine className="h-2 w-16" />
          <SkeletonLine className="mt-3 h-5 w-10" />
        </div>
      ))}
    </div>
  );
}

/** A panel with rows in it — matches the shape of a task list or a document. */
export function SkeletonPanel({ rows = 3, title = true }: { rows?: number; title?: boolean }) {
  return (
    <section className="rounded-xl border border-border bg-card/60 p-6">
      {title && <SkeletonLine className="h-3 w-28" />}
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonLine className="size-[18px] shrink-0 rounded-[5px]" />
            <SkeletonLine
              className="h-3 flex-1"
              // Varied widths so it reads as content rather than as a loading bar.
            />
            <SkeletonLine className="h-2 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function SkeletonHeader() {
  return (
    <header className="border-b border-border pb-6">
      <SkeletonLine className="h-2 w-24" />
      <SkeletonLine className="mt-3 h-7 w-40" />
    </header>
  );
}
