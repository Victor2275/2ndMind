/**
 * Skeleton — hand-reworked at the V4 tokens (§1.10, D-200).
 *
 * This file arrived from the shadcn registry and is no longer upstream's: it is formatted by
 * Prettier like the rest of `src/`, and a future `shadcn add` would overwrite the work below
 * rather than merge with it. Phase 5.1 wants exact-shape skeletons; this is the primitive they are built from.
 *
 * `rounded-md` -> `rounded-control`.
 *
 * ## It does not move, and that reverses §1.10 (V4 §5.1, Q204, D-259)
 *
 * §1.10 changed `animate-pulse` to the `shimmer` utility here, arguing that a static block at
 * low contrast is hard to tell from a panel that failed to render. Q204 is a **[FORK]** and
 * Victor answered it the other way: *static — a shimmer on a screen that resolves in 200ms is
 * worse than nothing*. His answer outranks the component comment, so the motion is gone.
 *
 * The objection §1.10 raised is answered by shape instead of by motion: `components/site/
 * skeleton.tsx` mirrors the real layout, and a failed panel is *absent* rather than grey.
 * `shimmer` stays defined in `globals.css` — it is a primitive, `scale.test.ts` pins it, and
 * the kitchen sink still shows it — it simply has no call site. Reverting is one class.
 */
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="skeleton" className={cn("rounded-control bg-muted", className)} {...props} />
  );
}

export { Skeleton };
