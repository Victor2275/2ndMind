/**
 * Toaster — hand-reworked at the V4 tokens (§1.10, D-200).
 *
 * This file arrived from the shadcn registry and is no longer upstream's: it is formatted by
 * Prettier like the rest of `src/`, and a future `shadcn add` would overwrite the work below
 * rather than merge with it. D-192 found that this is mounted nowhere and `toast()` is called nowhere, so the app has never shown a toast. Phase 5.2 mounts it; §1.10 only makes sure it is correct at the V4 tokens when it does.
 *
 * The five status icons read `--icon-sm` instead of a bare `size-4` (§1.9).
 * `--border-radius` points at `--radius-card`, so a toast matches a card rather than the
 *   unscaled base radius.
 * A toast is floating chrome over the page, so it takes `--elevation-floating` — the level
 *   between a card and a modal (Q156).
 */
"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="icon-sm" />,
        info: <InfoIcon className="icon-sm" />,
        warning: <TriangleAlertIcon className="icon-sm" />,
        error: <OctagonXIcon className="icon-sm" />,
        loading: <Loader2Icon className="icon-sm animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-card)",
          "--normal-shadow": "var(--elevation-floating)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
