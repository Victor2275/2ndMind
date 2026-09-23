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

  /**
   * Whether the full-size image has ever been asked for (V4 §8.11, D-333).
   *
   * **A closed `<dialog>` is `display: none`, and a browser still downloads images inside it.**
   * That is not an optimisation a renderer is allowed to make — the element is in the document,
   * so its `src` is fetched — and it meant every project page pulled its full-size original on
   * load, for a dialog almost nobody opens. Measured on `/projects/five-second-rule`: **773.7KB
   * of raw PNG**, alongside the 39KB WebP thumbnail that was already being displayed. 95% of the
   * page's image bytes were for something not on screen.
   *
   * Mounting the `<img>` only once the dialog has been opened is the whole fix. It stays mounted
   * afterwards — latching rather than tracking `open` — so a second open is instant and the
   * browser cache is not the only thing standing between the reader and a re-download.
   */
  const [everOpened, setEverOpened] = useState(false);

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
        onClick={() => {
          setEverOpened(true);
          setOpen(true);
        }}
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
          {/* A plain <img>, not next/image: the natural size is the point here, and
              `next/image` would re-fit it to a layout box, which is the very thing being
              escaped.

              The note that stood here also claimed "the source is already an optimised asset".
              It was not: these are the original PNGs, and the largest is 792KB on disk. That
              sentence is why nobody looked at what this element cost — see `everOpened` above
              and D-333.

              Rendered only after the first open. `loading="lazy"` is not a substitute: it
              defers images that are off *screen*, and this one is inside a `display: none`
              dialog, which browsers fetch eagerly regardless. */}
          {everOpened && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={src}
              alt={alt}
              className="max-h-[calc(90dvh-3rem)] w-auto max-w-full object-contain"
            />
          )}
        </div>
      </dialog>
    </>
  );
}
