"use server";

import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";

import { requireSession } from "@/lib/auth/dal";
import { loadCanvas } from "@/lib/calendar/load";
import { toAssignmentTasks } from "@/lib/calendar/sync";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import type { ActionState } from "@/lib/sprint-goals";
import { upsertExternalTask } from "@/lib/tasks/queries";

/**
 * Pulls Canvas assignments into the task table.
 *
 * Manual rather than scheduled: a nightly job needs a paid tier, which Victor ruled out, and
 * a cron on the free plan would be the only part of this that could fail silently at 3am with
 * nobody watching. A button is honest about when the data was last refreshed.
 */

/** A term's worth of lookahead. Assignments further out than this are not actionable yet. */
const LOOKAHEAD_DAYS = 120;
const LOOKBEHIND_DAYS = 7;

export async function syncCanvas(
  _prev: ActionState | null,
): Promise<ActionState> {
  await requireSession();

  if (!isDatabaseConfigured()) {
    return { ok: false, message: "DATABASE_URL is not set, so there is nowhere to sync to." };
  }

  const now = Date.now();
  const from = new Date(now - LOOKBEHIND_DAYS * 86_400_000);
  const to = new Date(now + LOOKAHEAD_DAYS * 86_400_000);

  try {
    // Drop the cached feed body first: pressing Sync must fetch, not re-read a 15-minute-old
    // copy, or the button appears to do nothing.
    updateTag("calendar");

    const canvas = await loadCanvas(from, to);

    if (!canvas.configured) {
      return { ok: false, message: "CANVAS_CALENDAR is not set." };
    }
    if (canvas.error) {
      return { ok: false, message: canvas.error };
    }
    if (canvas.empty) {
      return {
        ok: true,
        message:
          "Canvas has no calendar entries yet — normal before term, or if courses have not published assignments.",
      };
    }

    const tasks = toAssignmentTasks(canvas.events);
    if (tasks.length === 0) {
      return { ok: true, message: "Nothing in the window to import." };
    }

    const handle = db();
    // Sequential on purpose: an upsert per row keeps the conflict target simple, and a term's
    // worth of assignments is tens of rows, not thousands.
    for (const task of tasks) {
      await upsertExternalTask(handle, task);
    }

    revalidatePath("/private");
    revalidatePath("/private/academics");
    revalidatePath("/private/calendar");

    return { ok: true, message: `Synced ${tasks.length} assignment(s) from Canvas.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  }
}

/** Forces both feeds to be re-fetched on the next render. */
export async function refreshCalendars(_prev: ActionState | null): Promise<ActionState> {
  await requireSession();
  try {
    updateTag("calendar");
    revalidatePath("/private/calendar");
    revalidatePath("/private");
    return { ok: true, message: "Feeds refreshed." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
