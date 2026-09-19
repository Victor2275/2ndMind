"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { reachabilityStore } from "@/lib/net/reachability";
import { outboxStore } from "@/lib/sync/status";

/**
 * What the connection and the outbox are doing, always on screen (V4 §4.5, Q375).
 *
 * Q375 asks for "a connection/sync status indicator persistently — one glyph in the header".
 * The app already had a good indicator and it was not persistent: `SyncRunner`'s pill appears
 * when something is wrong and is absent otherwise, so a quiet screen is ambiguous between "no
 * queue, good connection" and "the indicator is broken". A glyph that is always there answers
 * that by existing.
 *
 * ## Two mounts, one component, and why that is not duplication
 *
 * The private app has two shells — a sidebar at `sm` and up, a compact title bar below it — so
 * "the header" is two different places depending on the width. Both render this, and the same
 * unlayered `nav-desktop` / `nav-mobile` switch that keeps the two navigations apart keeps
 * these apart: exactly one is displayed at any width. Sharing the component is what makes the
 * two say the same thing; sharing a *mount point* would mean one of the two shells owning a
 * piece of the other's layout.
 *
 * ## It reads, it does not poll
 *
 * Both values come from stores that something else already maintains — `reachabilityStore` from
 * real request outcomes (`lib/net/reachability.ts`), the outbox summary from `SyncRunner`'s
 * flush (`lib/sync/status.ts`). This component opens no database and makes no request, which is
 * the only honest way to put something on every private screen: an indicator that costs a read
 * per render is a tax on the whole app for a dot.
 *
 * Nothing sensitive may appear in this file — it is a Client Component and compiles into
 * `/_next/static/chunks/`, served without authentication. Counts and states only, never a
 * payload.
 */

type Tone = "idle" | "working" | "attention" | "fault";

const DOT: Record<Tone, string> = {
  idle: "bg-muted-foreground",
  working: "bg-primary",
  attention: "bg-highlight",
  fault: "bg-destructive",
};

const TEXT: Record<Tone, string> = {
  idle: "text-muted-foreground",
  working: "text-muted-foreground",
  attention: "text-highlight",
  fault: "text-destructive",
};

/**
 * @param variant `rail` is the sidebar footer, where the label is hidden by CSS when the
 *                sidebar is collapsed. `bar` is the phone title bar, where the label is never
 *                shown — there is no room, and the tab bar's badge carries the count there.
 */
export function ConnectionGlyph({ variant = "rail" }: { variant?: "rail" | "bar" }) {
  const { state } = useSyncExternalStore(
    reachabilityStore.subscribe,
    reachabilityStore.getSnapshot,
    reachabilityStore.getServerSnapshot,
  );
  const outbox = useSyncExternalStore(
    outboxStore.subscribe,
    outboxStore.getSnapshot,
    outboxStore.getServerSnapshot,
  );

  const { tone, label } = describe(state, outbox);

  // Never prefetched. This points at the screen about the network, and the one state that makes
  // a person look at it is the state where speculative requests are competing with the
  // navigation they are waiting for — the argument Phase N6 made for the tab bar.
  return (
    <Link
      href="/private/sync"
      prefetch={false}
      // `title` as well as the accessible name: on a desktop the collapsed rail shows a dot and
      // nothing else, and hovering is how anyone finds out what a dot means.
      title={label}
      aria-label={`Connection and sync: ${label}`}
      data-tone={tone}
      className={
        variant === "rail"
          ? `flex min-h-10 items-center gap-2 rounded-md px-2 text-xs transition-colors duration-fast hover:bg-accent/60 ${TEXT[tone]}`
          : `flex size-10 shrink-0 items-center justify-center rounded-md transition-colors duration-fast ${TEXT[tone]}`
      }
    >
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${DOT[tone]}`} />
      {variant === "rail" && <span className="nav-label truncate">{label}</span>}
    </Link>
  );
}

/**
 * The sentence, and how loud it is.
 *
 * Order matters and it is not the order of severity. A **failed** op outranks everything,
 * including being offline, because it is the only state that will still be here tomorrow
 * without a person — Phase N7's argument for the pill, applied to the glyph. Below that the
 * connection leads, because a queue on a phone with no signal is not a problem and saying "3
 * waiting" without saying "offline" invites a person to go looking for a fault that is just a
 * tunnel.
 *
 * Exported for its test: this is the whole behaviour of the component, and the rest is a dot.
 */
export function describe(
  state: "healthy" | "degraded" | "unreachable",
  outbox: { urgency: string; pending: number; label: string } | null,
): { tone: Tone; label: string } {
  if (outbox?.urgency === "failed") return { tone: "fault", label: outbox.label };
  if (state === "unreachable") return { tone: "attention", label: "Offline" };
  if (state === "degraded") return { tone: "attention", label: "Poor connection" };
  if (outbox?.urgency === "stale") return { tone: "attention", label: outbox.label };
  if (outbox && outbox.pending > 0) return { tone: "working", label: outbox.label };
  // `null` is "the runner has not reported yet", which is a different thing from an empty
  // outbox and must not be dressed up as one — claiming "up to date" before anything has been
  // read is the exact failure this glyph exists to make impossible.
  if (outbox === null) return { tone: "idle", label: "Checking sync" };
  return { tone: "idle", label: "Up to date" };
}
