"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/dal";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { describeDbError } from "@/lib/db/describe";
import { categoryByKey } from "@/lib/log/categories";
import { readField } from "@/lib/log/form";
import { createEntry, deleteEntry, restoreEntry } from "@/lib/log/queries";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * Log entry actions. `requireSession()` first, as everywhere — a Server Action is a POST
 * endpoint with a guessable id, so the page's gate is not the boundary.
 *
 * Writes go to Postgres, so a save is immediate and does not commit or deploy (D-036).
 */

const describe = (error: unknown) => describeDbError(error, { subject: "The log_entries table" });

export async function createLogEntry(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  if (!isDatabaseConfigured()) {
    return { ok: false, message: "DATABASE_URL is not set, so there is nowhere to save this." };
  }

  const key = String(formData.get("category") ?? "");
  const category = categoryByKey(key);
  if (!category) return { ok: false, message: "Unknown category." };

  const note = String(formData.get("note") ?? "").trim();

  const data: Record<string, unknown> = {};
  for (const field of category.fields) {
    const value = readField(formData, field);
    if (value !== null && value !== false) data[field.name] = value;
  }

  // An entry with neither fields nor a note is a mis-tap, not a log.
  if (Object.keys(data).length === 0 && note === "") {
    return { ok: false, message: "Nothing to log — fill in a field or write a note." };
  }

  // Backdating: the form offers a date because logging is not always immediate. Noon local
  // rather than midnight, so the entry cannot land on the previous day once rendered.
  const dayRaw = String(formData.get("occurredOn") ?? "").trim();
  const occurredAt = /^\d{4}-\d{2}-\d{2}$/.test(dayRaw)
    ? new Date(`${dayRaw}T19:00:00Z`)
    : undefined;

  try {
    await createEntry(db(), { category: key, note, data, occurredAt });
    revalidatePath("/private/log");
    revalidatePath("/private");
    return { ok: true, message: `Logged to ${category.label}.` };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

export async function removeLogEntry(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  if (!isDatabaseConfigured()) return { ok: false, message: "DATABASE_URL is not set." };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Unknown entry." };

  try {
    const row = await deleteEntry(db(), id);
    if (!row) return { ok: false, message: "That entry no longer exists." };
    revalidatePath("/private/log");
    return { ok: true, message: "Removed.", undoId: row.id };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

export async function undoLogEntry(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  if (!isDatabaseConfigured()) return { ok: false, message: "DATABASE_URL is not set." };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Nothing to undo." };

  try {
    const row = await restoreEntry(db(), id);
    if (!row) return { ok: false, message: "Nothing to undo." };
    revalidatePath("/private/log");
    return { ok: true, message: "Restored." };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}
