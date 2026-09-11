"use client";

import { XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Full-size project images, in a native `<dialog>` (V4 item 6.5, Q223 — "yes, native `<dialog>`,
 * no library").
 *
 * The reason this is worth having at all: several project figures are *diagrams* — the solenoid
 * signal chain, the micromouse maze — rendered into a 16:9 card at a few hundred pixels wide,
 * where their labels are unreadable. A reader who wants to see one currently has no way to.
 *
 * ## Why `showModal()` rather than a div with a high z-index
 *
 * `showModal()` gives four things for free that a hand-rolled overlay has to reimplement and
 * usually gets wrong: the focus trap, `Escape` to close, inertness of the page behind it, and the
 * top layer — which sits above every stacking context, so the sticky header cannot paint over it.
 *
 * `autoFocus` is on the close button because `showModal` otherwise focuses the first focusable
 * element, which here is the backdrop-closing wrapper and reads as nothing being focused at all.
 *
 * Nothing sensitive may appear in this file; it compiles into an unauthenticated client chunk.
 */
export function ImageLightbox({
  src,
  alt,
  children,
  className,
}: {
  src: string;
  alt: string;
  /** The thumbnail. Becomes the trigger. */
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    ref.current?.close();
  }, []);

  // `showModal()` is imperative and cannot be expressed as a prop, so opening is an effect keyed
  // on state rather than a call inside the click handler — calling it directly would open the
  // dialog before React had committed the markup it contains.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // `cursor-zoom-in` is the affordance. Without it the figure looks like the same
        // non-interactive image it was, and nobody discovers this.
        className={cn(
          "group/zoom block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className,
        )}
        aria-label={`View ${alt} full size`}
      >
        {children}
      </button>

      <dialog
        ref={ref}
        // `close` fires for Escape and for `close()` alike, so state follows the element rather
        // than trying to predict it — otherwise Escape leaves `open` true and the next click does
        // nothing.
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // Backdrop clicks land on the dialog itself; clicks on the image do not.
          if (event.target === ref.current) close();
        }}
        className="m-auto max-h-[90dvh] max-w-[95vw] bg-transparent p-0 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <div className="relative flex max-h-[90dvh] flex-col overflow-hidden rounded-panel border border-border bg-card">
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
            <p className="truncate text-sm text-muted-foreground">{alt}</p>
            <button
              type="button"
              autoFocus
              onClick={close}
              aria-label="Close"
              className="-mr-1 rounded-control p-2 text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <XIcon className="icon-md" aria-hidden />
            </button>
          </div>
          {/* A plain <img>, not next/image: the source is already an optimised asset and the
              natural size is the point here. `next/image` would re-fit it to a layout box, which
              is the very thing being escaped. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[calc(90dvh-3rem)] w-auto max-w-full object-contain"
          />
        </div>
      </dialog>
    </>
  );
}
