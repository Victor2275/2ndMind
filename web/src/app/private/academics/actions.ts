"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/sprint-goals";
import {
  addChecklistItem,
  removeChecklistItem,
  setChecklistItem,
} from "@/lib/vault/checklist";
import { TRACKER_HEADING } from "@/lib/vault/tracker";
import { readVaultFile, writeVaultFile } from "@/lib/vault/write";

/**
 * Academic tracker writes. `requireSession()` first, as with every other action — a Server
 * Action is a POST endpoint with a guessable id, so the page's own gate is not the boundary.
 */

const SPRINT = "context/04_operations/current_sprint.md";

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Bad credentials")) {
    return "GitHub rejected the token. It may have expired — mint a new fine-grained PAT.";
  }
  if (message.includes("Not Found")) {
    return "GitHub returned 404. The token is probably missing Contents access to this repo.";
  }
  return message;
}

async function commit(
  edit: (content: string) => string,
  message: string,
): Promise<ActionState> {
  const { content } = await readVaultFile(SPRINT);
  const result = await writeVaultFile(SPRINT, edit(content), message);
  revalidatePath("/private/academics");
  revalidatePath("/private");
  return { ok: true, message: `Saved as ${result.commit.slice(0, 7)}.`, url: result.url };
}

export async function addTrackerItem(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const text = String(formData.get("item") ?? "").trim();
  if (text === "") return { ok: false, message: "Write the item first." };

  try {
    return await commit(
      (content) => addChecklistItem(content, TRACKER_HEADING, text),
      `academics: track "${text.slice(0, 60)}"`,
    );
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

export async function toggleTrackerItem(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const text = String(formData.get("item") ?? "").trim();
  const done = formData.get("done") === "true";
  if (text === "") return { ok: false, message: "Nothing selected." };

  try {
    return await commit(
      (content) => setChecklistItem(content, TRACKER_HEADING, text, done),
      `academics: ${done ? "done" : "reopen"} "${text.slice(0, 60)}"`,
    );
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

export async function removeTrackerItem(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const text = String(formData.get("item") ?? "").trim();
  if (text === "") return { ok: false, message: "Nothing selected." };

  try {
    return await commit(
      (content) => removeChecklistItem(content, TRACKER_HEADING, text),
      `academics: drop "${text.slice(0, 60)}"`,
    );
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}
