/**
 * Sheet — hand-reworked at the V4 tokens (§1.10, D-200).
 *
 * This file arrived from the shadcn registry and is no longer upstream's: it is formatted by
 * Prettier like the rest of `src/`, and a future `shadcn add` would overwrite the work below
 * rather than merge with it. Phase 4.3 builds the real bottom sheet on top of it, including the grabber and the drag-to-full behaviour.
 *
 * `bg-black/10` -> `bg-scrim`, a per-theme token added in `build-tokens.mts`. This was a
 *   real bug rather than a tidy-up: a 10% black scrim darkens paper and does nothing
 *   whatsoever over a near-black ground, so on three of the five themes the sheet would
 *   have opened with no dimming at all. Dark themes now deepen toward their own
 *   background, light ones toward their own foreground.
 * The overlay and popup transitions take `--duration-*` and `--ease-*` (Q186).
 *   `ease-in-out` becomes `ease-entrance`: a sheet arriving should settle.
 * A bottom sheet's top corners take `--radius-sheet`, the size at which the radius reads
 *   as a handle rather than as a rounded box.
 */
"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-scrim transition-opacity duration-fast ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  /**
   * `"fullscreen"` is the phone-first one (D-237): the whole viewport on a phone, rising from
   * the bottom, and the ordinary right-hand panel from `sm` up. Every other value keeps its
   * shape at every width.
   *
   * The mobile and desktop halves are written as `max-sm:`/`sm:` inside a **single**
   * `data-[side=fullscreen]:` block rather than as two competing utilities, because two
   * utilities of equal specificity are resolved by the order Tailwind emits them and not by the
   * order they are written — D-219 is what that costs when it goes wrong. Media-query variants
   * cannot collide: only one of them is live at a given width.
   */
  side?: "top" | "right" | "bottom" | "left" | "fullscreen";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-overlay transition duration-medium ease-entrance data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:rounded-t-sheet data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=fullscreen]:inset-0 data-[side=fullscreen]:h-full data-[side=fullscreen]:w-full data-[side=fullscreen]:max-w-none data-[side=fullscreen]:data-ending-style:translate-y-[2.5rem] data-[side=fullscreen]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=fullscreen]:sm:inset-y-0 data-[side=fullscreen]:sm:right-0 data-[side=fullscreen]:sm:left-auto data-[side=fullscreen]:sm:w-3/4 data-[side=fullscreen]:sm:max-w-md data-[side=fullscreen]:sm:border-l data-[side=fullscreen]:sm:data-ending-style:translate-x-[2.5rem] data-[side=fullscreen]:sm:data-ending-style:translate-y-0 data-[side=fullscreen]:sm:data-starting-style:translate-x-[2.5rem] data-[side=fullscreen]:sm:data-starting-style:translate-y-0 data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={<Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-base font-medium text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
