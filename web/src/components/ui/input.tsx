/**
 * Input — hand-reworked at the V4 tokens (§1.10, D-200).
 *
 * This file arrived from the shadcn registry and is no longer upstream's: it is formatted by
 * Prettier like the rest of `src/`, and a future `shadcn add` would overwrite the work below
 * rather than merge with it. Nothing imports it yet; the forms pass (§5.2) is what puts it to work.
 *
 * `rounded-lg` -> `rounded-control` (Q152).
 * The colour transition gains the `--duration-fast` / `--ease-standard` tokens rather
 *   than Tailwind's default 150ms `ease` — the same number, said in the vocabulary, so
 *   changing the feel is one edit in `build-scale.mts`.
 *
 * `text-base md:text-sm` is kept exactly as it is. It looks like a stray override and is
 * not: 16px is the threshold below which iOS Safari zooms the viewport on focus, so the
 * field is deliberately full size on a phone and steps down on a pointer device. §1.5
 * anchors `--text-base` at exactly 1rem partly for this.
 */
import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-control border border-input bg-transparent px-2.5 py-1 text-base transition-colors duration-fast ease-standard outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
