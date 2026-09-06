import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import type { Db } from "@/lib/tasks/queries";
import {
  filamentSpools,
  printers,
  type FilamentSpool,
  type NewFilamentSpool,
  type NewPrinter,
  type Printer,
} from "@/lib/db/schema";

/**
 * Filament and printers (V3 §5.1, D-189).
 *
 * The layout is **reorder-first**: the page exists to answer *what am I about to run out of*,
 * so the sort is by how little is left and the low spools are at the top. That is a decision
 * about ordering, not about filtering — an empty spool stays visible, because "I have no black
 * PLA" is the single most useful thing this page can tell you and hiding a zero would remove it.
 */

const aliveSpool = isNull(filamentSpools.deletedAt);
const alivePrinter = isNull(printers.deletedAt);

/**
 * Every spool, emptiest first.
 *
 * Sorted in SQL rather than in the page so the index earns its place, and so a second caller
 * cannot render the same list in a different order — the order *is* the feature here.
 */
export async function listSpools(db: Db): Promise<FilamentSpool[]> {
  return db
    .select()
    .from(filamentSpools)
    .where(aliveSpool)
    .orderBy(asc(filamentSpools.gramsRemaining));
}

export async function addSpool(db: Db, input: NewFilamentSpool): Promise<FilamentSpool> {
  const [row] = await db.insert(filamentSpools).values(input).returning();
  return row;
}

export async function updateSpool(
  db: Db,
  id: number,
  patch: Partial<NewFilamentSpool>,
): Promise<FilamentSpool | null> {
  const [row] = await db
    .update(filamentSpools)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(filamentSpools.id, id), aliveSpool))
    .returning();
  return row ?? null;
}

/** Soft, like every other delete here: a spool used up is history, not an absence. */
export async function removeSpool(db: Db, id: number): Promise<FilamentSpool | null> {
  const [row] = await db
    .update(filamentSpools)
    .set({ deletedAt: new Date() })
    .where(and(eq(filamentSpools.id, id), aliveSpool))
    .returning();
  return row ?? null;
}

export async function listPrinters(db: Db): Promise<Printer[]> {
  return db.select().from(printers).where(alivePrinter).orderBy(asc(printers.name));
}

export async function addPrinter(db: Db, input: NewPrinter): Promise<Printer> {
  const [row] = await db.insert(printers).values(input).returning();
  return row;
}

export async function updatePrinter(
  db: Db,
  id: number,
  patch: Partial<NewPrinter>,
): Promise<Printer | null> {
  const [row] = await db
    .update(printers)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(printers.id, id), alivePrinter))
    .returning();
  return row ?? null;
}

export async function removePrinter(db: Db, id: number): Promise<Printer | null> {
  const [row] = await db
    .update(printers)
    .set({ deletedAt: new Date() })
    .where(and(eq(printers.id, id), alivePrinter))
    .returning();
  return row ?? null;
}
