import type { ReactNode } from "react";

import { ConnectionGlyph } from "@/components/site/connection-glyph";

/**
 * Shared page furniture for the private site.
 *
 * V1's private pages were, in Victor's words, cramped and hard to read — "the same feel" as
 * the markdown they were supposed to replace. Three things caused it: every page invented its
 * own spacing, headings were the same weight as body text, and a whole vault document was
 * dumped on screen with no way to put it away. This fixes all three in one place, so the
 * pages stop drifting apart again.
 */

/**
 * ## On a phone this is a title bar, not a header (V4 §4.2, Q132/Q133)
 *
 * Q132 measured it: eyebrow, 3xl title, lede and a 24px rule cost about 110px above the first
 * action on **every** screen, on the device where D-083 spent a whole feature reclaiming
 * vertical space. So below `phone` the eyebrow and the lede are dropped and the title steps
 * down to `xl`, which leaves a single 44px row.
 *
 * What is **not** dropped is `actions`. On several screens the action is the first thing you
 * can do on the page — it carries `data-first-action` and `npm run shots` gates how far down it
 * sits — so demoting it into the body to save a row would move the very thing the saving is
 * for. The row keeps the title on the left and the actions on the right, and both fit because
 * the title is one short word on every private screen.
 *
 * The connection glyph rides here too (§4.5, Q375). On a desktop it is in the sidebar; a phone
 * has no sidebar, and this row is the only persistent piece of chrome at the top of the screen.
 * The `nav-mobile` / `nav-desktop` switch guarantees exactly one of the two is ever displayed.
 *
 * Q134 was explicit that this must **not** stick on scroll, so it does not: it is a header that
 * gets out of the way, which is the whole point of shrinking it.
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
    <header className="border-b border-border pb-3 sm:pb-6">
      {/* `items-center` on a phone, where this is one row of controls; `items-end` above it,
          where a 3xl title and a button should sit on the same baseline. */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:items-end sm:gap-4">
        <div className="min-w-0">
          <p className="phone-hidden eyebrow text-primary">{eyebrow}</p>
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:mt-2 sm:text-3xl">
            {title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* `-mr-2` pulls the 40px tap target back to the page's optical edge: the glyph is a
              dot in a square, so its own padding would otherwise read as a gap. */}
          <span className="nav-mobile -mr-2">
            <ConnectionGlyph variant="bar" />
          </span>
          {actions}
        </div>
      </div>
      {lede && (
        <p className="phone-hidden mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          {lede}
        </p>
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
      {meta && <span className="tabular text-xs text-muted-foreground">{meta}</span>}
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
    // `px-3 sm:px-4` is what lets three of these sit across a 390px screen instead of stacking
    // into ~290px of vertical space for three numbers. The label used to carry a second, tighter
    // tracking below `sm` for the same reason; V4 §1.6 replaced it with the one `eyebrow`
    // value, which is looser (0.12em) but on a face that is narrower than the mono it replaced.
    // Net width is close to unchanged and `npm run shots` gates the overflow either way.
    <div className="rounded-lg border border-border bg-card/60 px-3 py-3 sm:px-4">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className={`tabular mt-1.5 text-xl font-semibold ${valueTone}`}>{value}</p>
      {/* The hint is the first thing to go when the card is one of three on a phone: it is a
          gloss on the number, and the number is already there.

          `phone-hidden` rather than `hidden sm:block`, which is the pattern the nav switch was
          hand-written to avoid (see `globals.css`): a base utility and its own variant both
          setting `display` resolve to the base at every width, so this hint was most likely
          hidden on a desktop too. Five more call sites in the app still spell it the broken
          way; they need a `laptop` equivalent of this utility and belong to §7.4's audit. */}
      {hint && <p className="phone-hidden mt-0.5 text-xs text-muted-foreground">{hint}</p>}
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
