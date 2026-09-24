import { GROOVE_D, GROOVE_WIDTH, LOBE_D, MARK_VIEWBOX } from "@/lib/mark";
import { cn } from "@/lib/utils";

/**
 * The 2ndMind mark, inline (V4 item 6.1, Q32–Q36, D-346).
 *
 * Monochrome and tinted by context: the silhouette is `currentColor` and the folds are holes, so
 * this takes the colour of whatever it sits inside and shows the surface behind it through the
 * grooves. Nothing here decides a colour, which is the point — `text-primary` on the caller is
 * the whole styling API.
 *
 * **No hooks, deliberately.** `useId` would be the obvious way to make the mask id unique, and it
 * would make this a Client Component and unusable from the server-rendered pages that want it.
 * The `id` prop does the same job deterministically, with no hydration surface at all. Two marks
 * in one document must be given different ids — see the test; a duplicate `<mask id>` is silently
 * resolved to the first one, which is invisible until the two are different sizes.
 *
 * The drawing is duplicated from `public/icons/brain.svg` via `lib/mark.ts`, and pinned to it by
 * `lib/__tests__/mark.test.ts`. See that module's header for why that duplication is allowed.
 */
export function Mark({
  className,
  id = "site-mark",
  title,
}: {
  className?: string;
  /** Must be unique within the document. */
  id?: string;
  /** Give this only when the mark is the sole label for something; otherwise it is decorative. */
  title?: string;
}) {
  const maskId = `${id}-folds`;
  const lobeId = `${id}-lobe`;

  return (
    <svg
      viewBox={MARK_VIEWBOX}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <path id={lobeId} d={LOBE_D} />
        {/* userSpaceOnUse rather than the default objectBoundingBox: one groove runs past the
            silhouette on purpose, and the default mask region is only 120% of the box. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <use href={`#${lobeId}`} fill="#fff" />
          <g fill="none" stroke="#000" strokeWidth={GROOVE_WIDTH} strokeLinecap="round">
            {GROOVE_D.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </mask>
      </defs>
      <use href={`#${lobeId}`} fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}
