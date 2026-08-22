import type { ReactNode } from "react";

/**
 * Shared page furniture for the private site.
 *
 * V1's private pages were, in Victor's words, cramped and hard to read — "the same feel" as
 * the markdown they were supposed to replace. Three things caused it: every page invented its
 * own spacing, headings were the same weight as body text, and a whole vault document was
 * dumped on screen with no way to put it away. This fixes all three in one place, so the
 * pages stop drifting apart again.
 */

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-border pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-highlight">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {lede && (
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">{lede}</p>
      )}
    </header>
  );
}

/**
 * A titled block. `collapsible` uses native `<details>` — no JavaScript, keyboard accessible
 * for free, and the open state survives without any client component. Reference prose starts
 * closed so a page opens as something you can scan rather than something you must read.
 */
export function Panel({
  title,
  meta,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const heading = (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      {meta && (
        <span className="tabular font-mono text-[0.65rem] text-muted-foreground">{meta}</span>
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <section className="rounded-xl border border-border bg-card/60 p-6">
        {heading}
        <div className="mt-5">{children}</div>
      </section>
    );
  }

  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-border bg-card/60 [&[open]>summary]:border-b [&[open]>summary]:border-border"
    >
      <summary className="cursor-pointer list-none px-6 py-4 transition-colors hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="size-3 shrink-0 fill-none stroke-muted-foreground stroke-2 transition-transform duration-200 group-open:rotate-90"
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
          <div className="min-w-0 flex-1">{heading}</div>
        </div>
      </summary>
      <div className="px-6 py-5">{children}</div>
    </details>
  );
}

/** A single number with a label. The antidote to prose where a figure would do. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "warn";
}) {
  const valueTone =
    tone === "accent" ? "text-primary" : tone === "warn" ? "text-destructive" : "text-foreground";

  return (
    <div className="rounded-lg border border-border bg-card/60 px-4 py-3">
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className={`tabular mt-1.5 text-xl font-semibold ${valueTone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Shown when a section has nothing in it. Says what would put something here. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
