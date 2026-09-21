import { markTerms } from "@/lib/log/highlight";

/**
 * A line with the searched words marked (V4 §5.5, Q404).
 *
 * `<mark>` rather than a styled `<span>`: it is the element that means "this is here because
 * you looked for it", so a screen reader and a browser's own find-in-page both understand the
 * result the way it is meant. The styling is ours — the default yellow is not in any theme, and
 * a result list is not a highlighter pen.
 *
 * Not a colour-only signal: the marked run is also `font-medium` and keeps the foreground text
 * colour, so the mark is legible when the ground is not.
 */
export function Marked({ text, query }: { text: string; query: string }) {
  const segments = markTerms(text, query);

  return (
    <>
      {segments.map((segment, index) =>
        segment.hit ? (
          <mark
            key={index}
            className="rounded-[3px] bg-primary/20 px-0.5 font-medium text-foreground"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
