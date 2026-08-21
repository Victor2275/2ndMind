/**
 * Shared shapes for the sprint editor.
 *
 * These live outside `actions.ts` because a `"use server"` module may only export async
 * functions — exporting the label array from there is a build error, not a lint nit.
 */

export const GOAL_LABELS = ["Engineering / Career", "Athletics", "Academics"] as const;

export type GoalLabel = (typeof GOAL_LABELS)[number];

export type ActionState = { ok: boolean; message: string; url?: string };
