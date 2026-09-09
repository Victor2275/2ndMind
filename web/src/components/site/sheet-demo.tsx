"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * The one interactive island on the kitchen-sink page (V4 §1.11).
 *
 * `Sheet` is the only kept component whose interesting states — the scrim, the entrance
 * transition, the sheet radius — cannot be seen without opening it, and opening it needs a
 * client component. Everything else on that page renders every state statically, which is why
 * the page as a whole is a server component.
 *
 * It exists in `components/site/` rather than inside the route so the route file stays a server
 * component: a `"use client"` directive at the top of `page.tsx` would push the whole gallery,
 * the theme loop and the registry import into the browser bundle.
 *
 * Nothing sensitive may be hard-coded here — this compiles into `/_next/static/chunks/`.
 */
export function SheetDemo({ side = "bottom" }: { side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>Open {side} sheet</SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Sheet</SheetTitle>
          <SheetDescription>
            The scrim behind this is <code>--scrim</code>, which deepens toward the theme&rsquo;s
            background on a dark theme and toward its foreground on a light one. It shipped as{" "}
            <code>bg-black/10</code>, which did nothing at all on a near-black ground.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}
