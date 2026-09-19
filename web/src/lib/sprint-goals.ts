/**
 * Shared shapes for goals and task actions.
 *
 * These live outside `actions.ts` because a `"use server"` module may only export async
 * functions — exporting a constant from there is a build error, not a lint nit. This has
 * caught me twice now (D-013 in spirit), so anything non-async belongs here by default.
 */

/**
 * The three weekly goal slots, keyed by the `domain` stored on a goal task.
 *
 * Goals are rows in the `tasks` table now (D-037), not bullets in markdown, so the key is
 * what the database holds and the label is only ever presentation.
 */
export const GOAL_DOMAINS = [
  { key: "engineering", label: "Engineering / Career" },
  { key: "athletics", label: "Athletics" },
  { key: "academics", label: "Academics" },
] as const;

export type GoalDomain = (typeof GOAL_DOMAINS)[number]["key"];

export type ActionState = {
  ok: boolean;
  message: string;
  /** Set by vault writes, which still produce a commit worth linking to. */
  url?: string;
  /** Set by a soft delete, so the UI can offer undo without another query. */
  undoId?: number;
  /**
   * Set by a writer that put the entry in the outbox rather than on the server (V4 §5.2).
   *
   * `ok: true` and `queued: true` together are the offline success: the entry **is** safe —
   * it is on the phone and the outbox will not discard it (§1.7) — and it is not on the
   * server. Q289 requires those two outcomes to be unmissably different, and they cannot be
   * unless something says which one happened.
   *
   * It is a field rather than something the UI infers from the message because the alternative
   * was a regex over a human sentence: the offline writer happens to say *"It will send when
   * you reconnect"*, and any rewording of that copy would silently relabel a queued save as a
   * completed one. Absent means "on the server", so every existing writer is correct unchanged.
   */
  queued?: boolean;
};
