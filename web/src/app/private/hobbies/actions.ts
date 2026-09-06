"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/dal";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import {
  addPrinter,
  addSpool,
  removePrinter,
  removeSpool,
  updatePrinter,
  updateSpool,
} from "@/lib/fabrication/queries";
import { isPrinterStatus } from "@/lib/fabrication/statuses";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * Adding and editing filament and printers (V3 §5.1, D-189).
 *
 * **Entered here rather than handed over as a table.** The plan carried §5.1 as blocked on an
 * inventory; Victor's answer was that he wants to add spools on the site, which makes the data
 * entry the feature rather than its precondition.
 *
 * Every field is optional except the one that identifies the row, deliberately. The upload brief
 * this replaces said *a rough number now beats an exact one never* — and a form that refuses a
 * spool because its hex is unknown is exactly how an inventory stops being kept up to date.
 */

const ok = (message: string) => ({ ok: true as const, message });
const no = (message: string) => ({ ok: false as const, message });

function guard() {
  if (!isDatabaseConfigured()) return no("No database configured.");
  return null;
}

/** Grams as typed: blank means zero, and anything absurd is refused rather than stored. */
const grams = z.coerce.number().int().min(0).max(20_000);

const spoolInput = z.object({
  material: z.string().trim().min(1).max(40),
  brand: z.string().trim().max(60).default(""),
  colourName: z.string().trim().max(60).default(""),
  // Empty string becomes null: an unfilled hex is an absence, not a colour, and storing "" would
  // make `swatch()` decide that on every render instead of once here.
  colourHex: z
    .string()
    .trim()
    .max(9)
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  gramsRemaining: grams,
  gramsFull: grams,
  notes: z.string().trim().max(500).default(""),
});

export async function saveSpool(_prev: ActionState | null, formData: FormData) {
  await requireSession();
  const blocked = guard();
  if (blocked) return blocked;

  const parsed = spoolInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return no(parsed.error.issues[0]?.message ?? "That spool did not make sense.");
  }

  const id = Number(formData.get("id") ?? 0);
  try {
    if (id > 0) await updateSpool(db(), id, parsed.data);
    else await addSpool(db(), parsed.data);
  } catch (error) {
    return no(error instanceof Error ? error.message : String(error));
  }

  revalidatePath("/private/hobbies");
  return ok(id > 0 ? "Updated." : "Added.");
}

export async function deleteSpool(_prev: ActionState | null, formData: FormData) {
  await requireSession();
  const blocked = guard();
  if (blocked) return blocked;

  const id = Number(formData.get("id") ?? 0);
  if (!Number.isInteger(id) || id <= 0) return no("Nothing to remove.");

  await removeSpool(db(), id);
  revalidatePath("/private/hobbies");
  return ok("Removed.");
}

const printerInput = z.object({
  name: z.string().trim().min(1).max(60),
  status: z.string().trim(),
  notes: z.string().trim().max(500).default(""),
});

export async function savePrinter(_prev: ActionState | null, formData: FormData) {
  await requireSession();
  const blocked = guard();
  if (blocked) return blocked;

  const parsed = printerInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return no("That printer did not make sense.");
  // Checked here rather than as a database constraint: the vocabulary is Victor's and adding a
  // state should be an edit to one array, not a migration.
  if (!isPrinterStatus(parsed.data.status)) return no("Unknown status.");

  const id = Number(formData.get("id") ?? 0);
  try {
    if (id > 0) await updatePrinter(db(), id, parsed.data);
    else await addPrinter(db(), parsed.data);
  } catch (error) {
    return no(error instanceof Error ? error.message : String(error));
  }

  revalidatePath("/private/hobbies");
  return ok(id > 0 ? "Updated." : "Added.");
}

export async function deletePrinter(_prev: ActionState | null, formData: FormData) {
  await requireSession();
  const blocked = guard();
  if (blocked) return blocked;

  const id = Number(formData.get("id") ?? 0);
  if (!Number.isInteger(id) || id <= 0) return no("Nothing to remove.");

  await removePrinter(db(), id);
  revalidatePath("/private/hobbies");
  return ok("Removed.");
}
