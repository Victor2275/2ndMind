/**
 * How a spool is described and how urgently it needs replacing (V3 §5.1, D-189).
 *
 * Pure, so the arithmetic that decides what goes at the top of the page is testable without a
 * database — the same split `lib/offline/panels.ts` uses for the cached screens.
 */

export type SpoolLike = {
  material: string;
  brand: string;
  colourName: string;
  colourHex: string | null;
  gramsRemaining: number;
  gramsFull: number;
};

export type Level = "empty" | "low" | "some" | "full";

/**
 * How much is left, as a fraction.
 *
 * Guarded against a `gramsFull` of zero, which is what a spool entered in a hurry looks like —
 * and division by it would produce `Infinity`, sort to the bottom, and quietly hide the very
 * spool most likely to be wrong.
 */
export function fractionLeft(spool: SpoolLike): number {
  if (spool.gramsFull <= 0) return 0;
  return Math.max(0, Math.min(1, spool.gramsRemaining / spool.gramsFull));
}

/**
 * The band a spool falls in.
 *
 * A quarter is the reorder line: filament takes days to arrive and a 250g tail is roughly one
 * substantial print. `empty` is its own band rather than the bottom of `low`, because
 * "you have none of this" and "you are nearly out" prompt different actions — one is a purchase,
 * the other is a plan.
 */
export function levelOf(spool: SpoolLike): Level {
  if (spool.gramsRemaining <= 0) return "empty";
  const fraction = fractionLeft(spool);
  if (fraction <= 0.25) return "low";
  if (fraction <= 0.6) return "some";
  return "full";
}

/** True for anything that should be bought. What the page's count at the top reports. */
export function needsReorder(spool: SpoolLike): boolean {
  const level = levelOf(spool);
  return level === "empty" || level === "low";
}

/**
 * A readable name for one spool.
 *
 * Colour first, because that is how a spool is asked for at a printer — "the black PETG", never
 * "the Prusament that is 40% full". Brand last and only when it is known.
 */
export function describeSpool(spool: SpoolLike): string {
  const parts = [spool.colourName, spool.material].filter((part) => part.trim() !== "");
  const base = parts.length > 0 ? parts.join(" ") : "Unnamed spool";
  return spool.brand.trim() === "" ? base : `${base} · ${spool.brand}`;
}

/**
 * A CSS colour for the swatch, or null to fall back to a label.
 *
 * Validated rather than trusted: this value is interpolated into a style, and an unchecked
 * string there is how a colour field becomes a way to inject CSS. Only `#rgb` and `#rrggbb`
 * pass — everything else renders as text instead, which is also the honest answer for a spool
 * whose hex was never filled in.
 */
export function swatch(hex: string | null): string | null {
  if (!hex) return null;
  const trimmed = hex.trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : null;
}
