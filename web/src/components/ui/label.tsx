/**
 * Label — hand-reworked at the V4 tokens (§1.10, D-200).
 *
 * This file arrived from the shadcn registry and is no longer upstream's: it is formatted by
 * Prettier like the rest of `src/`, and a future `shadcn add` would overwrite the work below
 * rather than merge with it. Nothing imports it yet; the forms pass (§5.2) is what puts it to work.
 *
 * Nothing changed. It is listed here so the absence is on the record rather than looking
 * like an oversight: `Label` sets a face, a size, a weight and a disabled state, and all
 * four were already reading from tokens §1.5 redefines. `text-sm` is 13.33px now instead
 * of 14px because the scale moved underneath it, which is the migration working.
 */
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
