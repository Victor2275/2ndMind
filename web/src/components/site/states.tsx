import Link from "next/link";
import {
  AlertTriangleIcon,
  CircleCheckIcon,
  ClockIcon,
  DatabaseIcon,
  FilterIcon,
  InboxIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { approximateAge, exactMoment, gradeAge, type AgeGrade } from "@/lib/ui/staleness";

/**
 * The states a screen is in when it has nothing to show (V4 §5.1).
 *
 * Every private screen has four of these — empty, loading, stale, broken — and before this
 * file each screen invented its own. Six pages carried a hand-written copy of the same
 * red-bordered failure block; ten call sites shared an `Empty` that was a dashed box with one
 * sentence and no way out of it; nothing anywhere said how old what you were reading was
 * unless it happened to be the cached shell.
 *
 * The thesis is *an instrument, not a document*, and an instrument that cannot say "this
 * reading is four hours old" or "this is empty, here is how to fill it" is a document with
 * numbers in it. That is the whole argument for this file existing.
 *
 * **Everything here is a Server Component.** None of it needs the client, and several of these
 * render on pages that are already streaming — a `"use client"` at the top would drag a
 * boundary around a failure message.
 */

/* ------------------------------------------------------------------------------------------
   As of — the one staleness marker (Q241, Q285, Q286)
   ------------------------------------------------------------------------------------------ */

/**
 * How old the thing above this is, always shown, never guessed at.
 *
 * Q285 asked for cached or stale data to be marked *everywhere, always*, and Q286 settled the
 * shape: a badge plus a tabular timestamp, not a dimming and not a line of prose. The two
 * halves say different things on purpose — the badge is the judgement ("four hours old, that
 * is getting on"), the timestamp is the fact ("Sep 19, 2:14 PM"), and a reader deciding whether
 * to trust a number wants the first while one reconciling it against something else wants the
 * second.
 *
 * **Amber only at `stale`.** D-196 spends `--highlight` on attention and nothing else, so a
 * badge that was amber at every age would be the decoration that decision removed — and worse,
 * would teach the eye to skip it by the time it meant something. Fresh and aging are muted.
 *
 * **It is never colour alone** (DESIGN.md §2 rule 1). The stale state gains an icon and the
 * word "stale"; in greyscale it is still distinguishable from the other two.
 */
export function AsOf({
  at,
  now = Date.now(),
  label = "as of",
  aging,
  stale,
  className = "",
}: {
  /** When the data was read. A timestamp, not a duration — the caller should not do the maths. */
  at: Date | number;
  /** Injected so a test can fix the clock, and so one page renders one consistent age. */
  now?: number;
  /** "as of", "last synced", "read". The verb differs; the badge does not. */
  label?: string;
  /** Per-subject thresholds. A vault file marked `stable` is fine for months; an outbox op is not. */
  aging?: number;
  stale?: number;
  className?: string;
}) {
  const ms = Math.max(0, now - (typeof at === "number" ? at : at.getTime()));
  const grade = gradeAge(ms, { aging, stale });

  // "as of 4h ago", but "as of just now" — `approximateAge` returns a phrase rather than a
  // duration below a minute, and "just now ago" is the kind of thing a template produces and a
  // person never writes. The preposition lives in `label`, so only the suffix is conditional.
  const age = approximateAge(ms);
  const said = age === "just now" ? age : `${age} ago`;

  return (
    <span
      // Marked so `npm run shots` can one day assert that every cached surface carries one of
      // these, which is what "everywhere, always" would have to mean as a gate rather than a
      // habit. §7.1 is where that check belongs.
      data-as-of={grade}
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${TONE[grade]}`}
      >
        {grade === "stale" ? (
          <AlertTriangleIcon aria-hidden className="size-3" />
        ) : (
          <ClockIcon aria-hidden className="size-3" />
        )}
        <span>
          {label} {said}
          {grade === "stale" && " · stale"}
        </span>
      </span>
      {/* The fact, in mono because it is a timestamp and DESIGN.md §2 rule 2 says mono is real
          data. Hidden on a phone: the badge already carries the judgement, and 390px does not
          have room for both halves beside a panel title. */}
      <time
        dateTime={new Date(at).toISOString()}
        className="phone-hidden tabular font-mono text-xs text-faint-foreground"
      >
        {exactMoment(at)}
      </time>
    </span>
  );
}

const TONE: Record<AgeGrade, string> = {
  fresh: "border-border text-muted-foreground",
  aging: "border-border text-muted-foreground",
  // The one amber in this file, and the only grade that has earned it (D-196).
  stale: "border-highlight/40 bg-highlight/10 text-highlight",
};

/* ------------------------------------------------------------------------------------------
   Empty — and it names the action that fills it (Q275, Q277)
   ------------------------------------------------------------------------------------------ */

/**
 * Shown when a section has nothing in it.
 *
 * Q275's verdict on the old one — a dashed box with a sentence — was that it is not enough: an
 * empty state should **name the action that fills it and offer it**. That is the same argument
 * as Q130's ("the point of this project is to list my ideas; too much read-only text defeats
 * the point"), one screen down: a box that says "nothing logged yet" and stops is read-only
 * prose occupying the exact spot where the thing you would do belongs.
 *
 * Q277 adds the second axis. *Nothing yet* and *nothing matched* are opposite problems with
 * opposite fixes — one wants a create, the other wants the filter cleared — and a shared
 * sentence serves neither. `reason` picks the icon, and the caller supplies the action.
 *
 * **The ten existing call sites keep working unchanged.** `children` is still the sentence and
 * everything else is optional, so a page that has not been through §5.4–5.9 yet renders what it
 * always did, minus the dashes. Adding the action is a per-screen edit, not a flag day.
 */
export function Empty({
  children,
  reason = "none",
  action,
  className = "",
}: {
  children: ReactNode;
  /** `none` — nothing has been created. `filtered` — things exist, none match. */
  reason?: "none" | "filtered";
  /** The way out. A link, because an empty state is usually elsewhere's job to fill. */
  action?: { href: string; label: string };
  className?: string;
}) {
  const Icon = reason === "filtered" ? FilterIcon : InboxIcon;

  return (
    <div
      className={`flex flex-col items-center rounded-lg border border-border bg-card/40 px-4 py-6 text-center ${className}`}
    >
      {/* Not an illustration (Q276 said no). An icon at `--icon-lg`, faint, so the box reads as
          a state rather than as a row that failed to render. */}
      <Icon aria-hidden className="icon-lg text-faint-foreground" />
      <p className="mt-2 max-w-[44ch] text-sm text-muted-foreground">{children}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-3 inline-flex min-h-11 press items-center gap-1.5 rounded-control border border-primary/50 px-3 text-sm text-primary transition-colors duration-fast ease-standard hover:border-primary hover:bg-primary/10"
        >
          <PlusIcon aria-hidden className="icon-sm" />
          {action.label}
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------
   Unavailable — the designed failure, including "the database is behind this build" (Q292)
   ------------------------------------------------------------------------------------------ */

/**
 * A panel or a page that could not load, said in a way that names the fix.
 *
 * Six screens carried their own copy of this: a `border-destructive/40` box, a bold line, and
 * `describeDbError`'s sentence in `text-xs`. The copy was good — D-156 made sure of that — and
 * the design was a red rectangle that looked identical whether the database was asleep, behind
 * a migration, or genuinely gone.
 *
 * Q292 asks for the migration case specifically to be designed, and it is the one worth
 * separating because it is the only one with **a command that fixes it**. `describeDbError`
 * already writes that command into its sentence; this renders it as a thing you can copy rather
 * than a phrase inside a paragraph, and takes the failure out of destructive red — a schema
 * that is behind is not a crash, it is a step not yet run, and colouring it the same as a crash
 * is how the crash stops being alarming.
 *
 * The caller passes `describeDbError`'s output verbatim. Detection is on the message rather than
 * on a second error inspection, because by the time a page has a string it has already thrown
 * the object away — and re-deriving it here would be the fifth copy of the logic D-156 exists
 * to have exactly one of.
 */
export function Unavailable({
  subject,
  detail,
  className = "",
}: {
  /** What did not load: "The log", "Athletics". A sentence stem, capitalised. */
  subject: string;
  /** `describeDbError`'s output. */
  detail: string;
  className?: string;
}) {
  const behind = isSchemaBehind(detail);
  const command = commandIn(detail);

  return (
    <div
      role="status"
      data-unavailable={behind ? "schema" : "error"}
      className={`rounded-lg border px-4 py-3 ${
        behind ? "border-highlight/40 bg-highlight/5" : "border-destructive/40 bg-destructive/5"
      } ${className}`}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        {behind ? (
          <DatabaseIcon aria-hidden className="icon-sm text-highlight" />
        ) : (
          <AlertTriangleIcon aria-hidden className="icon-sm text-destructive" />
        )}
        {behind ? "The database is behind this build." : `${subject} is unavailable.`}
      </p>

      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {command ? detail.replace(`\`${command}\``, "") : detail}
      </p>

      {/* The fix, as a thing rather than as words in a sentence. Mono because it is a path you
          type, which is what DESIGN.md §2 rule 2 reserves mono for. */}
      {command && (
        <code className="mt-2 inline-block rounded-control border border-border bg-card px-2 py-1 font-mono text-xs text-foreground select-all">
          {command}
        </code>
      )}
    </div>
  );
}

/**
 * Both schema sentences `describeDbError` can produce, and no others.
 *
 * Matched on the phrase it writes rather than on a substring like "migrate", which would also
 * catch a route that happens to mention one. If D-156's copy changes, this stops matching and
 * the panel falls back to the generic failure — wrong, but wrong in the safe direction: a real
 * error rendered as a real error.
 */
function isSchemaBehind(detail: string): boolean {
  return detail.includes("is behind this build") || detail.includes("missing a function");
}

/** The backticked command inside D-156's sentence, if there is one. */
function commandIn(detail: string): string | null {
  return /`([^`]+)`/.exec(detail)?.[1] ?? null;
}

/* ------------------------------------------------------------------------------------------
   Queued vs failed, and the difference is unmissable (Q289)
   ------------------------------------------------------------------------------------------ */

/**
 * What happened to a save.
 *
 * Q289: *"Should a failed save look different from a queued save? → yes, and the distinction
 * must be unmissable."* It is the single most consequential piece of state in the app and it
 * was the least marked: both arrived as one line of `font-mono text-xs`, differing only in
 * colour — which DESIGN.md §2 rule 1 forbids on its own, and which on a phone in sunlight is
 * not a difference at all.
 *
 * They are now different in four dimensions at once: icon, word, border weight and ground.
 * That is deliberate over-specification. A queued save resolves itself and costs nothing to
 * miss; a failed one never resolves and costs an entry, so the two errors are not symmetric and
 * the design should not be either.
 *
 * `queued` is explicitly **not** a failure and not amber: an outbox with something in it is the
 * normal state of a phone that has been in a pocket (Q426 says the same about the sync screen).
 */
export function SaveState({
  state,
  message,
  className = "",
}: {
  state: "saved" | "queued" | "failed";
  message: string;
  className?: string;
}) {
  const shape = SAVE_SHAPE[state];

  return (
    <p
      // `role="status"` for saved and queued, `alert` for failed: a failure is the one that
      // should interrupt what a screen reader is saying rather than wait its turn.
      role={state === "failed" ? "alert" : "status"}
      data-save-state={state}
      className={`inline-flex items-center gap-1.5 rounded-control border px-2 py-1 text-xs ${shape.tone} ${className}`}
    >
      <shape.Icon aria-hidden className="size-3.5" />
      <span className="font-medium">{shape.word}</span>
      <span className="text-muted-foreground">{message}</span>
    </p>
  );
}

const SAVE_SHAPE = {
  saved: {
    Icon: CircleCheckIcon,
    word: "Saved",
    tone: "border-transparent text-primary",
  },
  queued: {
    Icon: RefreshCwIcon,
    word: "Waiting",
    tone: "border-border bg-card text-foreground",
  },
  failed: {
    Icon: AlertTriangleIcon,
    word: "Not saved",
    // The only two-pixel border in the app, on the one state where being missed costs an entry.
    tone: "border-2 border-destructive bg-destructive/10 text-destructive",
  },
} as const;
