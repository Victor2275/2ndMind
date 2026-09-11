import { cn } from "@/lib/utils";

/**
 * A project's status, as one badge in two states (V4 item 6.5, Q326).
 *
 * The complaint was exact: `active` rendered as `<Badge variant="default">` and `done` as
 * `<Badge variant="outline">`, and _"`default` and `outline` read as unrelated"_. They did — one
 * was a filled accent pill and the other an empty bordered one, which is the visual language of
 * two different *kinds* of thing rather than two values of one field. In a grid where both appear
 * in the same slot on adjacent cards, that reads as inconsistency rather than as information.
 *
 * Now both are the same shape, the same size and the same weight, and only a dot and a word
 * change. That satisfies rule 10 — **colour never signals alone** (Q72) — twice over: the word is
 * already there, and the dot is filled for active and hollow for done, so the two differ in form
 * as well as in hue.
 *
 * Not a `variant` on the vendored `Badge`: this needs a leading dot, and the `ui/` components are
 * ours but are still the shared vocabulary (D-200). A one-off with a dot belongs here.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: "active" | "done";
  className?: string;
}) {
  const active = status === "active";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 font-mono text-[0.65rem] leading-relaxed",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-transparent text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full border",
          active ? "border-primary bg-primary" : "border-current bg-transparent",
        )}
      />
      {status}
    </span>
  );
}
