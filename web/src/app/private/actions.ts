"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/dal";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import type { ActionState } from "@/lib/sprint-goals";
import {
  createTask,
  deleteTask,
  replaceGoals,
  restoreTask,
  setTaskDone,
} from "@/lib/tasks/queries";
import { appendToSection, todayISO } from "@/lib/vault/frontmatter";
import { readVaultFile, writeVaultFile } from "@/lib/vault/write";

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

const LOGBOOK = "context/04_operations/logbook_archive.md";

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("DATABASE_URL")) return message;
  if (message.includes("GITHUB_TOKEN")) return message;
  if (message.includes("did not respond within")) return message;
  if (message.includes("Bad credentials")) {
    return "GitHub rejected the token. It may have expired — mint a new fine-grained PAT.";
  }
  if (message.includes("relation") && message.includes("does not exist")) {
    return "The tasks table is missing. Run `npm run db:migrate`.";
  }
  return message;
}

function requireDatabase(): ActionState | null {
  return isDatabaseConfigured()
    ? null
    : { ok: false, message: "DATABASE_URL is not set, so there is nowhere to save this." };
}

function refresh() {
  revalidatePath("/private");
  revalidatePath("/private/academics");
}

export async function addTask(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
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

/**
 * The logbook still writes to the vault, deliberately. It is prose written once a day and
 * read by AI agents for context — exactly what the vault is for — and one commit per day is
 * not the write volume that made D-036 necessary.
 */
export async function appendLogbookEntry(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const entry = String(formData.get("entry") ?? "");
  if (entry.trim() === "") return { ok: false, message: "Write something first." };

  try {
    const { content } = await readVaultFile(LOGBOOK);
    const today = todayISO();
    const bullets = entry
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `- ${line.replace(/^[-*]\s*/, "")}`)
      .join("\n");

    const updated = appendToSection(
      content,
      "1. Past Sprint Summaries",
      `### ${today}\n\n${bullets}`,
    );
    const result = await writeVaultFile(LOGBOOK, updated, `logbook: entry for ${today}`);

    revalidatePath("/private");
    return { ok: true, message: `Logged as ${result.commit.slice(0, 7)}.`, url: result.url };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}
