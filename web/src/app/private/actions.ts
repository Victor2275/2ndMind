"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/dal";
import { appendToSection, setLabelledBullet, todayISO } from "@/lib/vault/frontmatter";
import { GOAL_LABELS, type ActionState } from "@/lib/sprint-goals";
import { readVaultFile, writeVaultFile } from "@/lib/vault/write";

/**
 * Vault write actions.
 *
 * Every one begins with `requireSession()`. Server Actions are POST endpoints with
 * guessable ids — being reachable only from a page behind `proxy.ts` is not protection,
 * because the action can be invoked directly. The check belongs here, next to the write.
 */

const SPRINT = "context/04_operations/current_sprint.md";
const LOGBOOK = "context/04_operations/logbook_archive.md";

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // The token is the one failure the UI can actually act on, so name it plainly.
  if (message.includes("GITHUB_TOKEN")) return message;
  if (message.includes("Bad credentials")) {
    return "GitHub rejected the token. It may have expired — mint a new fine-grained PAT.";
  }
  if (message.includes("Not Found")) {
    return "GitHub returned 404. The token is probably missing Contents access to this repo.";
  }
  return message;
}

export async function saveSprintGoals(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  try {
    const { content } = await readVaultFile(SPRINT);

    // One read, three surgical line edits, one commit. Doing a separate commit per field
    // would produce three commits for what is one action, and could half-apply.
    let updated = content;
    const changed: string[] = [];
    for (const label of GOAL_LABELS) {
      const value = formData.get(label);
      if (typeof value !== "string") continue;
      updated = setLabelledBullet(updated, label, value);
      changed.push(label);
    }

    if (changed.length === 0) return { ok: false, message: "Nothing to save." };

    const result = await writeVaultFile(
      SPRINT,
      updated,
      `sprint: update goals (${changed.join(", ")})`,
    );

    revalidatePath("/private");
    revalidatePath("/private/sprint");
    return { ok: true, message: `Saved as ${result.commit.slice(0, 7)}.`, url: result.url };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

export async function appendLogbookEntry(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const entry = formData.get("entry");
  if (typeof entry !== "string" || entry.trim().length === 0) {
    return { ok: false, message: "Write something first." };
  }

  try {
    const { content } = await readVaultFile(LOGBOOK);

    // The user types prose; the markdown shape is this function's problem, not theirs.
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
    revalidatePath("/private/logbook");
    return { ok: true, message: `Logged as ${result.commit.slice(0, 7)}.`, url: result.url };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}
