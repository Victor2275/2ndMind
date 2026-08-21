"use client";

/**
 * Print / save-as-PDF. Deliberately the browser's own print dialog rather than a bundled
 * PDF library: it costs nothing, every browser's "Save as PDF" produces selectable text
 * (so the file survives resume parsers), and Victor said he would export the PDF manually.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-primary/50 px-3.5 py-1.5 font-mono text-xs text-primary transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_20px_-6px_var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      Print / Save as PDF
    </button>
  );
}
