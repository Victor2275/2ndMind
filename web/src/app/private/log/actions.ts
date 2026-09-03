"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/dal";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { describeDbError } from "@/lib/db/describe";
import { recordBodyweight } from "@/lib/athletics/queries";
import { writableCategoryByKey } from "@/lib/log/categories";
import { readField, readRows, takeBodyweight } from "@/lib/log/form";
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
  // Writable, not merely known: a retired category still has a definition so its history stays
  // readable, and this is the door through which it would otherwise come back (D-159).
  const category = writableCategoryByKey(key);
  if (!category) return { ok: false, message: "Unknown category." };

  const note = String(formData.get("note") ?? "").trim();

  const data: Record<string, unknown> = {};
  for (const field of category.fields) {
    const value = readField(formData, field);
    if (value !== null && value !== false) data[field.name] = value;
  }

  const rows = category.rows ? readRows(formData, category.rows) : [];
  if (category.rows && rows.length > 0) data[category.rows.name] = rows;

  // Lifted out of `data` before the entry is written — it belongs in `bodyweight_entries`.
  const { weight, problem } = takeBodyweight(data);

  // An entry with neither fields nor rows nor a note is a mis-tap, not a log. A weight on its
  // own is a real thing to log, though, so it counts.
  if (Object.keys(data).length === 0 && note === "" && weight === null && problem === null) {
    return { ok: false, message: "Nothing to log — fill in a field or write a note." };
  }

  // Backdating: the form offers a date because logging is not always immediate. Noon local
  // rather than midnight, so the entry cannot land on the previous day once rendered.
  const dayRaw = String(formData.get("occurredOn") ?? "").trim();
  const backdated = /^\d{4}-\d{2}-\d{2}$/.test(dayRaw);
  const occurredAt = backdated ? new Date(`${dayRaw}T19:00:00Z`) : undefined;

  try {
    const handle = db();
    const wrote = Object.keys(data).length > 0 || note !== "";
    if (wrote) await createEntry(handle, { category: key, note, data, occurredAt });

    let weighed = "";
    if (weight !== null) {
      // The day the entry is *for*, so a backdated session's weigh-in is filed with it.
      const day = backdated ? dayRaw : losAngelesDay(new Date());
      await recordBodyweight(handle, { measuredOn: day, weightLbs: weight, note: "" });
      weighed = ` Weight recorded for ${day}.`;
      revalidatePath("/private/athletics");
    }

    revalidatePath("/private/log");
    revalidatePath("/private");
    const saved = wrote ? `Logged to ${category.label}.` : "Weighed in.";
    // The entry saved either way; a rejected weight is reported, not thrown away silently.
    return { ok: true, message: problem ? `${saved} ${problem}` : `${saved}${weighed}` };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

/** Today in Los Angeles, which is the day he was looking at — not the UTC day. */
function losAngelesDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
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
