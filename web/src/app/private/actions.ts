"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/dal";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { describeDbError } from "@/lib/db/describe";
import type { ActionState } from "@/lib/sprint-goals";
import {
  createTask,
  deleteTask,
  replaceGoals,
  restoreTask,
  setTaskDone,
} from "@/lib/tasks/queries";

/**
 * Task and goal actions.
 *
 * Every one begins with `requireSession()`. Server Actions are POST endpoints with guessable
 * ids — being reachable only from a page behind `proxy.ts` is not protection, because the
 * action can be invoked directly. The check belongs here, next to the write.
 *
 * These write to Postgres, not the vault (D-036). Ticking a task used to be a git commit and
 * a full redeploy; now it is a row update. The vault keeps prose that is written rarely and
 * read by AI agents.
 */

const describe = (error: unknown) => describeDbError(error, { subject: "The tasks table" });

function requireDatabase(): ActionState | null {
  return isDatabaseConfigured()
    ? null
    : { ok: false, message: "DATABASE_URL is not set, so there is nowhere to save this." };
}

function refresh() {
  revalidatePath("/private");
  revalidatePath("/private/academics");
}

export async function addTask(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireSession();
  const missing = requireDatabase();
  if (missing) return missing;

  const title = String(formData.get("title") ?? "").trim();
  if (title === "") return { ok: false, message: "Write the task first." };

  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  // Noon UTC rather than midnight: a midnight timestamp rendered in a timezone behind UTC
  // shows as the previous day, which would misdate every due date Victor sets.
  const dueAt = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? new Date(`${dueRaw}T12:00:00Z`) : null;

  try {
    await createTask(db(), {
      title,
      source: "manual",
      domain: String(formData.get("domain") ?? "").trim() || null,
      courseCode: String(formData.get("courseCode") ?? "").trim() || null,
      dueAt,
    });
    refresh();
    return { ok: true, message: "Added." };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

/**
 * Capture a note into the inbox. Deliberately one field and no options: a capture box that
 * asks which domain something belongs to is a filing form, and filing is the work being
 * deferred. Triage happens later, on the row this creates.
 */
export async function addInboxNote(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const missing = requireDatabase();
  if (missing) return missing;

  const title = String(formData.get("title") ?? "").trim();
  if (title === "") return { ok: false, message: "Write it down first." };

  try {
    await createTask(db(), { title, source: "inbox", domain: null, courseCode: null, dueAt: null });
    refresh();
    return { ok: true, message: "Captured." };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

export async function toggleTask(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const missing = requireDatabase();
  if (missing) return missing;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Unknown task." };

  try {
    const row = await setTaskDone(db(), id, formData.get("done") === "true");
    if (!row) return { ok: false, message: "That task no longer exists." };
    refresh();
    return { ok: true, message: row.doneAt ? "Done." : "Reopened." };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

/** Soft delete. The row survives, which is what makes `undoTask` possible. */
export async function removeTask(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const missing = requireDatabase();
  if (missing) return missing;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Unknown task." };

  try {
    const row = await deleteTask(db(), id);
    if (!row) return { ok: false, message: "That task no longer exists." };
    refresh();
    // The id travels back in the message so the UI can offer an undo without re-querying.
    return { ok: true, message: `Removed “${row.title}”.`, undoId: row.id };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

export async function undoTask(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const missing = requireDatabase();
  if (missing) return missing;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Nothing to undo." };

  try {
    const row = await restoreTask(db(), id);
    if (!row) return { ok: false, message: "Nothing to undo." };
    refresh();
    return { ok: true, message: "Restored." };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

export async function saveSprintGoals(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const missing = requireDatabase();
  if (missing) return missing;

  const goals = ["engineering", "athletics", "academics"]
    .map((domain) => ({ domain, title: String(formData.get(domain) ?? "").trim() }))
    .filter((g) => g.title !== "");

  try {
    await replaceGoals(db(), goals);
    refresh();
    // No commit, no deploy: goals are tasks now, and this is a row update.
    return { ok: true, message: `Saved ${goals.length} goal(s).` };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}
