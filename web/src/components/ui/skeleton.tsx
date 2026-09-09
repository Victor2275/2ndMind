/**
 * Skeleton — hand-reworked at the V4 tokens (§1.10, D-200).
 *
 * This file arrived from the shadcn registry and is no longer upstream's: it is formatted by
 * Prettier like the rest of `src/`, and a future `shadcn add` would overwrite the work below
 * rather than merge with it. Phase 5.1 wants exact-shape skeletons; this is the primitive they are built from.
 *
 * `animate-pulse` -> the `shimmer` utility (§1.8). A pulse fades the whole block in and
 *   out, which at low contrast is hard to tell from a panel that failed to render. A
 *   travelling highlight cannot be mistaken for a static element, and it reuses the same
 *   `sweep` keyframe as `card-scan`, so the app has one idea of what a moving highlight is.
 * `rounded-md` -> `rounded-control`.
 */
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("shimmer rounded-control bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
