/**
 * Card — hand-reworked at the V4 tokens (§1.10, D-200).
 *
 * This file arrived from the shadcn registry and is no longer upstream's: it is formatted by
 * Prettier like the rest of `src/`, and a future `shadcn add` would overwrite the work below
 * rather than merge with it. Nothing imports it yet, which is why the size vocabulary could be renamed without a migration.
 *
 * Size classes are `sm | md | lg`, defaulting to `md`, rather than `default | sm`
 *   (DESIGN.md §5: a card size vocabulary instead of per-instance padding). The app uses
 *   `p-6`, `p-5` and `p-4` today with no rule behind the choice; these are the rule.
 * Padding comes from the eight-value spacing vocabulary (§1.7), not `--spacing(3)`.
 * `ring-1 ring-foreground/10` -> `shadow-raised`. Same result on a dark theme — the token
 *   resolves to a 1px ring off the theme's own border colour — and a real shadow on a light
 *   one, which is the difference DESIGN.md §6 asks for and a fixed ring cannot express.
 * `rounded-xl` -> `rounded-card`.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

function Card({
  className,
  size = "md",
  ...props
}: React.ComponentProps<"div"> & { size?: "sm" | "md" | "lg" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-card bg-card py-(--card-spacing) text-sm text-card-foreground shadow-raised [--card-spacing:var(--spacing-sm)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=lg]:[--card-spacing:var(--spacing-md)] data-[size=sm]:[--card-spacing:var(--spacing-xs)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-card *:[img:last-child]:rounded-b-card",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-card px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-card border-t bg-muted/50 p-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
