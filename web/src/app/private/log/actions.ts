"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/dal";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { describeDbError } from "@/lib/db/describe";
import { recordBodyweight } from "@/lib/athletics/queries";
import { categoryByKey, UNSORTED_CATEGORY, writableCategoryByKey } from "@/lib/log/categories";
import { readField, readRows, takeBodyweight } from "@/lib/log/form";
import { createEntry, deleteEntry, editEntry, fileEntry, restoreEntry } from "@/lib/log/queries";
import { createTask } from "@/lib/tasks/queries";
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

/**
 * The capture box: one line of text, no category (D-164).
 *
 * Deliberately one field and one choice. A capture box that asks which category something
 * belongs to is a filing form, and filing is exactly the work being deferred — the same
 * reasoning `addInboxNote` already records for tasks.
 *
 * The choice it does ask is note-or-task, because they go to different places and only the
 * writer knows which one a sentence is. "That stroke cue worked" is a note; "email the coach"
 * is a task with a checkbox and a due date it may one day need.
 */
export async function captureQuick(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  if (!isDatabaseConfigured()) {
    return { ok: false, message: "DATABASE_URL is not set, so there is nowhere to save this." };
  }

  const text = String(formData.get("text") ?? "").trim();
  if (text === "") return { ok: false, message: "Write it down first." };

  const asTask = String(formData.get("as") ?? "note") === "task";

  try {
    if (asTask) {
      // `source: "inbox"` puts it in the dashboard's triage list, which already exists and
      // already knows what to do with an unfiled task.
      await createTask(db(), {
        title: text,
        source: "inbox",
        domain: null,
        courseCode: null,
        dueAt: null,
      });
      revalidatePath("/private");
      revalidatePath("/private/log");
      return { ok: true, message: "Captured as a task." };
    }

    await createEntry(db(), { category: UNSORTED_CATEGORY, note: text, data: {} });
    revalidatePath("/private/log");
    revalidatePath("/private");
    return { ok: true, message: "Noted." };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

/** Move an unsorted note into a real category. */
export async function fileLogEntry(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  if (!isDatabaseConfigured()) return { ok: false, message: "DATABASE_URL is not set." };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Unknown entry." };

  const category = writableCategoryByKey(String(formData.get("category") ?? ""));
  if (!category || category.capture) return { ok: false, message: "Unknown category." };

  try {
    const row = await fileEntry(db(), id, category.key);
    if (!row) return { ok: false, message: "That note is not waiting to be sorted." };
    revalidatePath("/private/log");
    revalidatePath("/private");
    return { ok: true, message: `Filed under ${category.label}.` };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

/**
 * Edit an entry that has already been saved (Q402, V4 Phase 2).
 *
 * Q402 sat unanswered as "no default" until 2026-09-08, and the answer was yes — you will
 * mistype a weight. Sets inside a session are edited through their own ops
 * (`lib/athletics/session.ts`); this is the general case for everything else in the log.
 *
 * The fields are re-read through `readField`/`readRows` rather than trusted, exactly as a create
 * is: a Server Action is a POST endpoint with a guessable id, and an edit that took `data`
 * straight off the wire would let anything be written into a category's JSON.
 *
 * **The category is not editable and is not read from the form.** `editEntry` takes it from the
 * stored row, which keeps `fileEntry`'s one-way door shut — see the note there.
 */
export async function updateLogEntry(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  if (!isDatabaseConfigured()) return { ok: false, message: "DATABASE_URL is not set." };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Unknown entry." };

  // The category is only used to know which fields to read; it is never written. A retired
  // category is accepted here on purpose — an old training entry has to stay editable even
  // though no new one can be created (Phase 2.7).
  const key = String(formData.get("category") ?? "");
  const category = categoryByKey(key);
  if (!category) return { ok: false, message: "Unknown category." };

  const note = String(formData.get("note") ?? "").trim();

  const data: Record<string, unknown> = {};
  for (const field of category.fields) {
    const value = readField(formData, field);
    if (value !== null && value !== false) data[field.name] = value;
  }
  const rows = category.rows ? readRows(formData, category.rows) : [];
  if (category.rows && rows.length > 0) data[category.rows.name] = rows;

  if (Object.keys(data).length === 0 && note === "") {
    return { ok: false, message: "Nothing left — delete it instead." };
  }

  try {
    const row = await editEntry(db(), id, { note, data });
    if (!row) return { ok: false, message: "That entry is gone." };
    revalidatePath("/private/log");
    revalidatePath("/private");
    return { ok: true, message: "Saved." };
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
