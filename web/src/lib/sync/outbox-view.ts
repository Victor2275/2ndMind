import { summarise, type Category } from "@/lib/log/categories";
import { categoryByKey } from "@/lib/log/categories";
import type { Entity } from "@/lib/sync/entities";
import type { OutboxOp } from "@/lib/sync/store";

/**
 * What the outbox looks like to a person (V3 §1.7).
 *
 * Pure: ops in, sentences out. The screen and the badge both read from here, so what the badge
 * counts and what the screen lists can never disagree — which is the failure that makes a
 * status indicator worse than none at all.
 *
 * The governing rule of §1.7 is that **nothing is discarded, ever.** A failed op is held
 * forever, stays visible, and is retried only when asked. That shapes everything here: there
 * is no "dismiss", the badge does not fade after a while, and an op that has been stuck for a
 * week is louder than one stuck for an hour rather than quieter.
 */

/** Past this, a waiting entry stops being "syncing" and starts being a problem. */
export const STALE_MS = 24 * 60 * 60 * 1000;

/** Past this, it is not a problem, it is a thing that is not going to fix itself. */
export const VERY_STALE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How loud to be.
 *
 * - `quiet` — ops in flight, nothing older than a day. The normal state of a phone that has
 *   been in a pocket, and worth no more than a count.
 * - `stale` — something has been waiting more than a day.
 * - `failed` — the server refused it. This never resolves on its own.
 */
export type Urgency = "none" | "quiet" | "stale" | "failed";

export type OutboxSummary = {
  pending: number;
  failed: number;
  /** Age of the oldest op of any state, or null when the outbox is empty. */
  oldestMs: number | null;
  urgency: Urgency;
  /** One line for the badge. Empty when there is nothing to say. */
  label: string;
};

export function summariseOutbox(ops: readonly OutboxOp[], now = Date.now()): OutboxSummary {
  const pending = ops.filter((op) => op.state !== "failed").length;
  const failed = ops.filter((op) => op.state === "failed").length;
  const oldestMs = ops.length === 0 ? null : now - Math.min(...ops.map((op) => op.createdAt));

  // Failure outranks age. A rejected op will still be there in a week, so saying "waiting"
  // about it would be a lie that gets truer-sounding the longer it is wrong.
  const urgency: Urgency =
    ops.length === 0
      ? "none"
      : failed > 0
        ? "failed"
        : (oldestMs ?? 0) >= STALE_MS
          ? "stale"
          : "quiet";

  return { pending, failed, oldestMs, urgency, label: badgeLabel(pending, failed, oldestMs) };
}

function badgeLabel(pending: number, failed: number, oldestMs: number | null): string {
  if (failed > 0) return failed === 1 ? "1 not sent" : `${failed} not sent`;
  if (pending === 0) return "";
  if (oldestMs !== null && oldestMs >= STALE_MS) {
    return `${pending} waiting · ${approximateAge(oldestMs)}`;
  }
  return `${pending} waiting`;
}

/**
 * An age a person reads without arithmetic. Rounded down and deliberately coarse — the
 * difference between 26 and 31 hours changes nothing anyone would do about it.
 */
export function approximateAge(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** What a stuck op is, said plainly. */
export type OpView = {
  opId: string;
  /** "Training log", "Task", "Weigh-in", "Rehab tick". */
  kind: string;
  /** The entry itself, as far as it can be reconstructed from the payload. */
  title: string;
  /** "Created", "Changed", "Deleted". */
  verb: string;
  state: OutboxOp["state"];
  attempts: number;
  ageMs: number;
  /** Why it is stuck, in a sentence, or null while it is simply waiting its turn. */
  problem: string | null;
  /** True when only a person can move it forward. */
  needsYou: boolean;
};

const KIND: Record<Entity, string> = {
  log_entry: "Log entry",
  task: "Task",
  bodyweight: "Weigh-in",
  rehab: "Rehab",
  workout: "Workout",
  workout_set: "Set",
  ai_summary: "Summary",
};

const VERB: Record<OutboxOp["op"], string> = {
  create: "Created",
  update: "Changed",
  delete: "Deleted",
};

export function describeOp(op: OutboxOp, now = Date.now()): OpView {
  return {
    opId: op.opId,
    kind: KIND[op.entity] ?? op.entity,
    title: titleOf(op),
    verb: VERB[op.op] ?? op.op,
    state: op.state,
    attempts: op.attempts,
    ageMs: Math.max(0, now - op.createdAt),
    problem: op.state === "failed" ? explain(op) : null,
    needsYou: op.state === "failed",
  };
}

/**
 * The entry, recognisably.
 *
 * "Log entry · rejected" tells him nothing he can act on; "Bench Press · 185 × 5" tells him
 * which entry to go and look at. Built from the payload rather than from the mirrored row
 * because a failed op may concern a row that was never accepted, so the mirror is the only
 * copy and the payload is the thing the server actually refused.
 */
function titleOf(op: OutboxOp): string {
  const payload = op.payload;

  if (op.entity === "log_entry") {
    const category = typeof payload.category === "string" ? payload.category : "";
    const data = isRecord(payload.data) ? payload.data : {};
    const note = typeof payload.note === "string" ? payload.note : "";
    const line = summarise(category, data, note);
    const label = (categoryByKey(category) as Category | undefined)?.label;
    if (line) return label ? `${label} — ${line}` : line;
    return label ?? "An entry";
  }

  if (op.entity === "task" && typeof payload.title === "string") return payload.title;
  if (op.entity === "bodyweight") return `${payload.weightLbs ?? "?"} lb on ${payload.measuredOn}`;
  if (op.entity === "rehab") return `${payload.slug ?? "?"} on ${payload.completedOn}`;

  // Better an honest blank than a stringified object.
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Why it failed, translated.
 *
 * The raw messages here come from Zod, from Postgres, or from an HTTP status. None of them is
 * addressed to the person holding the phone, and a screen that prints them is a screen that
 * gets ignored — which for §1.7 means an entry silently never arrives.
 */
export function explain(op: OutboxOp): string {
  const status = op.lastError?.status ?? 0;
  const message = op.lastError?.message ?? "";

  if (status === 422 || /invalid|expected|required/i.test(message)) {
    return "The server would not accept this entry's contents. It is usually a field this build sends and the server does not yet understand — the copy on this phone is safe either way.";
  }
  if (status === 401 || status === 403) {
    return "The session had expired when this was sent. Sign in and retry it.";
  }
  if (status === 413) return "This entry is too large to send.";
  if (status >= 500) {
    return "The server had a problem. This one is worth simply retrying.";
  }
  if (status >= 400) {
    return "The server rejected the request itself, not the entry — usually a version skew between this phone and the site. Reloading the app often fixes it.";
  }
  return message || "It did not go through, and the reason did not survive.";
}

/**
 * Failed first, then oldest first.
 *
 * The screen exists to get things unstuck, so what needs a person goes at the top. Within a
 * group, oldest first: the entry that has been missing longest is the one most likely to be
 * missed somewhere else.
 */
export function orderForReview(views: readonly OpView[]): OpView[] {
  return [...views].sort((a, b) => {
    if (a.needsYou !== b.needsYou) return a.needsYou ? -1 : 1;
    return b.ageMs - a.ageMs;
  });
}
