"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/sprint-goals";
import { parsePlan, PLAN_PATH, renderPlan, TERMS, type Plan } from "@/lib/academics/plan";
import { writeVaultFile } from "@/lib/vault/write";

/**
 * Saving the course plan to the vault (V3 §5.2, D-187).
 *
 * A commit per save, like `/now`'s updates — which is the trade Victor chose when he put this in
 * the vault rather than in Postgres: slower to write, readable in five years, and visible in the
 * repo's history so a plan that changed can be seen to have changed.
 *
 * The whole plan is rewritten each time rather than patched. It is a few hundred bytes, and a
 * diff-based write would need a merge story for a file only one person edits from one screen.
 */

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("GITHUB_TOKEN")) return message;
  if (message.includes("Not Found")) {
    return "The plan file is not on GitHub yet. Saving will create it.";
  }
  return message;
}

export async function savePlan(_prev: ActionState | null, formData: FormData) {
  await requireSession();

  // Rebuilt from the form rather than trusted as JSON: the client sends one field per term and
  // this is the boundary, so what gets written is what this function understood — never a shape
  // the browser chose.
  const plan: Plan = Object.fromEntries(TERMS.map((term) => [term, []]));
  for (const term of TERMS) {
    const raw = String(formData.get(`term:${term}`) ?? "");
    // Each line is one course, exactly as the file stores them, so the textarea and the file are
    // the same format and neither needs translating into the other.
    plan[term] = parsePlan(`## ${term}\n\n${raw}`)[term];
  }

  try {
    await writeVaultFile(PLAN_PATH, renderPlan(plan), "docs(academics): update the course plan");
  } catch (error) {
    return { ok: false as const, message: describe(error) };
  }

  revalidatePath("/private/academics/plan");
  return { ok: true as const, message: "Saved to the vault." };
}
