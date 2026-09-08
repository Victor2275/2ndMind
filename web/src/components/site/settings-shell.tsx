import type { ReactNode } from "react";

/**
 * Furniture for the settings screen (V4 §4.4).
 *
 * Separate from `page-shell.tsx` because settings is a different shape from every other private
 * page: it is a list of controls with labels and explanations, not panels of data. Reusing
 * `Panel` here would mean a card per setting, and eleven cards down a phone screen reads as
 * eleven unrelated things rather than as one list.
 */

/** A titled group of rows. The heading is what makes a list of switches scannable. */
export function SettingsGroup({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {note && <p className="mt-1 max-w-[58ch] text-sm text-muted-foreground">{note}</p>}
      {/* One bordered container with divided rows, rather than a card each. `divide-y` puts the
          line between rows and never above the first or below the last, which is the whole
          reason not to hand each row its own border. */}
      <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/60">
        {children}
      </div>
    </section>
  );
}

/**
 * One setting: a label, an optional explanation, and a control on the right.
 *
 * The control is a slot rather than a variant, because the eleven settings here are genuinely
 * eleven different controls — a switch, a list, a button, a link, a piece of text — and a
 * component that tried to be all of them would be a worse version of each.
 */
export function SettingsRow({
  label,
  note,
  control,
  children,
}: {
  /**
   * Omitted when the control carries its own heading — the theme picker's own "Match the phone"
   * label, for instance. A row that repeats what is directly below it reads as three levels of
   * heading for one setting.
   */
  label?: string;
  note?: string;
  /** Rendered to the right of the label, vertically centred. */
  control?: ReactNode;
  /** Rendered below the label, full width. For controls too big to sit on the right. */
  children?: ReactNode;
}) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      {(label || control) && (
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            {label && <p className="text-sm font-medium text-foreground">{label}</p>}
            {note && (
              <p className="mt-0.5 max-w-[52ch] text-xs leading-relaxed text-muted-foreground">
                {note}
              </p>
            )}
          </div>
          {control && <div className="flex shrink-0 items-center">{control}</div>}
        </div>
      )}
      {children && <div className={label || control ? "mt-3" : ""}>{children}</div>}
    </div>
  );
}

/** A read-only value. Mono, because these are ids, counts and timestamps. */
export function SettingsValue({ children }: { children: ReactNode }) {
  return <span className="tabular font-mono text-xs text-faint-foreground">{children}</span>;
}
