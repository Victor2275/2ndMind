import { ArrowUpRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A link that leaves the site, and says so (V4 item 6.9, Q304).
 *
 * The glyph is not decoration. On a portfolio the majority of links go to other pages of the
 * portfolio, so the handful that do not are the ones where a reader deserves to know before they
 * click — a GitHub repository, a live demo, a paper. Without a marker they are indistinguishable
 * from internal navigation, and the difference is only discovered by losing your place.
 *
 * `ArrowUpRightIcon` rather than the boxed-arrow convention: the boxed glyph reads as a UI
 * affordance at 12px and this sits inline in running text, where a plain diagonal arrow is
 * quieter and still unambiguous.
 *
 * ## Two things this does that are easy to forget
 *
 * `rel="noreferrer"` accompanies `target="_blank"`. Without `noopener` the opened page gets a
 * handle on this one through `window.opener` — modern browsers imply it for `_blank`, but the
 * attribute is what makes that true rather than assumed.
 *
 * The glyph is `aria-hidden` and the accessible name carries the words instead. A screen reader
 * announcing "arrow up right" after every external link is noise; announcing "opens in a new
 * tab" once, as part of the link text, is the information.
 */
export function ExternalLink({
  href,
  children,
  className,
  showGlyph = true,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Off for links whose surrounding context already makes the destination obvious. */
  showGlyph?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex items-center gap-1", className)}
    >
      {children}
      {showGlyph && (
        <ArrowUpRightIcon aria-hidden className="size-3 shrink-0 opacity-70" strokeWidth={2} />
      )}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
