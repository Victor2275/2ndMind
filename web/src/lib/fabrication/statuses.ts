/**
 * The printer states Victor actually uses (V3 §5.1, D-189).
 *
 * Its own module, with no `server-only`, because both sides need it: the form renders these as
 * options and the action validates against them. Leaving it in `queries.ts` — which is
 * `server-only` — would have made the select impossible to build without duplicating the list,
 * and a duplicated vocabulary is one that drifts.
 *
 * Confirmed on 2026-09-06 rather than invented: the plan explicitly refused to guess a taxonomy,
 * and these four are the distinctions that change what he does next. Ordered by how much each
 * one demands attention.
 *
 * Text rather than a Postgres enum, so adding a fifth is an edit to this array and not a
 * migration.
 */
export const PRINTER_STATUSES = ["printing", "idle", "needs maintenance", "down"] as const;

export type PrinterStatus = (typeof PRINTER_STATUSES)[number];

export function isPrinterStatus(value: string): value is PrinterStatus {
  return (PRINTER_STATUSES as readonly string[]).includes(value);
}
