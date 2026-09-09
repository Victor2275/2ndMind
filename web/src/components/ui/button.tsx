/**
 * Button — hand-reworked at the V4 tokens (§1.10, D-200).
 *
 * This file arrived from the shadcn registry and is no longer upstream's: it is formatted by
 * Prettier like the rest of `src/`, and a future `shadcn add` would overwrite the work below
 * rather than merge with it. It is one of the two components that was already in use (D-192), so every change here is visible in the app today.
 *
 * `rounded-lg` -> `rounded-control`: radius now scales with the size of the thing (Q152).
 * `transition-all` -> the properties that actually change, at `--duration-fast` and
 *   `--ease-standard`. `transition-all` animates layout properties too, which is what makes
 *   a button feel gluey when its width changes with its label.
 * The 1px `active` nudge becomes the `press` utility: a 0.97 scale inside 150ms with no
 *   delay. DESIGN.md §9 calls the missing pressed state the biggest gap in the app on a
 *   phone, and a 1px translate is not visible on one.
 * The default icon size reads `--icon-sm` rather than a bare `size-4` (§1.9).
 *
 * NOT changed, deliberately: the heights. `default` is 32px and DESIGN.md §9 wants a 44px
 * minimum tap target. Raising them moves every button in the app and belongs to the forms
 * pass (§5.2), where the 48px targets are scoped. §7.1 is what turns the gate on.
 */
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center press rounded-control border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none transition-[color,background-color,border-color,box-shadow] duration-fast ease-standard select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--icon-sm)",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-control px-2 text-xs in-data-[slot=button-group]:rounded-control has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-control px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-control has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-control in-data-[slot=button-group]:rounded-control [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-control in-data-[slot=button-group]:rounded-control",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
