"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/sprint-goals";
import { insertUpdate, projectVaultPath, todayInLosAngeles } from "@/lib/vault/updates";
import { readVaultFile, writeVaultFile } from "@/lib/vault/write";

/**
 * Publishing an update to the Working page.
 *
 * This is the first live caller of `writeVaultFile`, dormant since D-036 moved tasks to
 * Postgres and exercised only by its own tests since. Everything it documents about
 * last-write-wins and the 8s deadline becomes reachable here for the first time.
 *
 * A human writes these, not a model, so there is no approval gate — D-080 says nothing
 * AI-driven writes to the vault in V2, and this is Victor typing.
 */

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("GITHUB_TOKEN")) return message;
  if (message.includes("Not Found")) {
    return "That project file is not on GitHub. Commit and push it first.";
  }
  return message;
}

export async function publishUpdate(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const slug = String(formData.get("slug") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (slug === "") return { ok: false, message: "Pick a project." };
  if (body === "") return { ok: false, message: "Write the update first." };

  // The date defaults to today but is editable, because updates get written up on the
  // weekend for something that happened on Wednesday, and misdating them is worse than
  // asking. Anything unparseable falls back rather than throwing at the user.
  const suppliedDate = String(formData.get("date") ?? "").trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(suppliedDate) ? suppliedDate : todayInLosAngeles();

  try {
    const path = projectVaultPath(slug);

    // Read immediately before writing. `writeVaultFile` fetches its own blob SHA for the same
    // reason: a cached read here would make this last-write-*fails* instead of last-write-wins.
    const { content } = await readVaultFile(path);
    const next = insertUpdate(content, date, body);

    const result = await writeVaultFile(path, next, `docs(${slug}): update for ${date}`);

    // The public pages are statically generated, so nothing appears until they are rebuilt.
    // These calls cover the running server; production still needs the Vercel deploy that
    // the commit itself triggers, which is why the UI says "about a minute" rather than
    // implying the update is already live.
    revalidatePath("/now");
    revalidatePath(`/projects/${slug}`);
    revalidatePath("/private/now");

    return {
      ok: true,
      message: "Committed. It appears publicly once Vercel finishes the rebuild, about a minute.",
      url: result.url,
    };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}
