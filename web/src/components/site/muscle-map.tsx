import {
  BACK_BODY,
  BACK_MIRROR,
  BACK_ORDER,
  BACK_OUTLINE,
  BACK_REGIONS,
  BODY_ASPECT,
  BODY_VIEW_BOX,
  FRONT_BODY,
  FRONT_MIRROR,
  FRONT_ORDER,
  FRONT_OUTLINE,
  FRONT_REGIONS,
  type BodyShape,
  type RegionKey,
} from "@/lib/athletics/body-paths";
import { MUSCLES, type Muscle } from "@/lib/athletics/muscles";

/**
 * A front-and-back body map, with the regions an exercise works picked out.
 *
 * ## Why this is drawn here rather than fetched
 *
 * D-222's argument, unchanged through two redraws: a hundred and some images, one per exercise,
 * are a hundred and some chances for the picture to disagree with the `muscles` field beside it,
 * and nothing would ever catch that — a picture is not data, so no test can read it. There is
 * one drawing, and the highlight is computed from the same array the search chips and the record
 * grouping already use, so the diagram cannot say something the catalogue does not. It also
 * costs no request, needs no cache, scales to any size, and themes with the app.
 *
 * ## Where the geometry comes from (D-239)
 *
 * `lib/athletics/body-paths.ts`, ported from **react-native-body-highlighter** under its MIT
 * licence — see that file's header and the repository's `NOTICE`. It replaces the ~250 paths
 * D-226 drew by hand. The argument above did not change; the draughtsmanship did.
 *
 * ## Primary and secondary
 *
 * The prime mover reads `--primary` and the assisting muscles a lighter step of the generated
 * 50–950 ramp, `--primary-300`. Literal hex would need a `no-raw-hex` exemption and would be
 * wrong the moment someone switches theme; the ramp is contrast-solved per theme, so this is
 * correct in all five with no exemption needed.
 *
 * ## Two detail levels
 *
 * `detail="full"` draws every muscle in the resting grey and the worked ones in the accent.
 * `detail="simple"` (the default under 96px) draws the silhouette and **only the worked
 * regions** — around a dozen paths instead of a hundred and sixty. What the picture *says* is
 * identical either way, because what it says is which regions are lit; what goes is the resting
 * anatomy nobody can resolve at 40px, and with it the cost of rendering it once per row of a
 * scrolling catalogue.
 */

/** `worked` regions take the accent colours; everything else stays a resting grey. */
function regionClass(muscle: RegionKey, primary: Set<Muscle>, secondary: Set<Muscle>): string {
  if (primary.has(muscle)) return "fill-primary";
  if (secondary.has(muscle)) return "fill-primary-300";
  return "fill-foreground/45";
}

/** Upstream's paths carry an explicit left and right copy; the five hand-drawn regions are
 *  drawn once and reflected, which is what keeps their two sides identical. */
function Paths({
  shapes,
  className,
  mirror,
}: {
  shapes: readonly BodyShape[];
  className: string;
  mirror: number;
}) {
  return (
    <>
      {shapes.map((shape, index) => (
        <path key={index} d={shape.d} className={className} />
      ))}
      {shapes
        .filter((shape) => shape.mirrored)
        .map((shape, index) => (
          <path
            key={`m${index}`}
            d={shape.d}
            className={className}
            transform={`translate(${mirror} 0) scale(-1 1)`}
          />
        ))}
    </>
  );
}

function Figure({
  outline,
  body,
  regions,
  order,
  mirror,
  primary,
  secondary,
  worked,
  detail,
  label,
  onRegionTap,
}: {
  outline: string;
  body: readonly string[];
  regions: Partial<Record<RegionKey, BodyShape[]>>;
  order: readonly RegionKey[];
  mirror: number;
  primary: Set<Muscle>;
  secondary: Set<Muscle>;
  worked: Set<Muscle>;
  detail: "full" | "simple";
  label: string;
  onRegionTap?: (muscle: RegionKey) => void;
}) {
  return (
    <g>
      <title>{label}</title>
      <path d={outline} className="fill-foreground/25" />
      {detail === "full" &&
        body.map((d, index) => <path key={index} d={d} className="fill-foreground/35" />)}
      {order.map((muscle) => {
        const region = regions[muscle];
        if (!region) return null;
        // At simple detail the resting anatomy is not drawn at all — see the module doc. A
        // region that is not worked contributes nothing to the picture at that size.
        if (detail === "simple" && !worked.has(muscle)) return null;
        return (
          <g
            key={muscle}
            onClick={onRegionTap ? () => onRegionTap(muscle) : undefined}
            role={onRegionTap ? "button" : undefined}
            tabIndex={onRegionTap ? 0 : undefined}
            aria-label={onRegionTap ? muscle : undefined}
            onKeyDown={
              onRegionTap
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRegionTap(muscle);
                    }
                  }
                : undefined
            }
            className={onRegionTap ? "cursor-pointer outline-none" : undefined}
          >
            <Paths
              shapes={region}
              className={regionClass(muscle, primary, secondary)}
              mirror={mirror}
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * @param muscles   Legacy prop: names from `MUSCLES`, all drawn as the primary colour. Kept for
 *                  the callers that still pass the catalogue's flat array. Ignored where
 *                  `primary` is given explicitly.
 * @param primary   Prime-mover regions, drawn in `--primary`. Defaults to `muscles`.
 * @param secondary Assisting regions, drawn in a lighter ramp step. Defaults to none.
 * @param size      Rendered width in pixels.
 * @param detail    `"full"` draws the resting anatomy under the highlight; `"simple"` draws the
 *                  silhouette and the worked regions only. Defaults to `"full"` at 96px and
 *                  above, `"simple"` below — and always `"full"` when `onRegionTap` is given,
 *                  since a region that is not drawn cannot be tapped.
 * @param onRegionTap Called with the region tapped, on either figure. Used to filter the exercise
 *                  browser and, in the edit form, to cycle a region through primary → secondary →
 *                  clear.
 */
export function MuscleMap({
  muscles,
  primary: primaryProp,
  secondary: secondaryProp,
  size = 132,
  detail,
  className = "",
  onRegionTap,
}: {
  muscles?: readonly string[];
  primary?: readonly string[];
  secondary?: readonly string[];
  size?: number;
  detail?: "full" | "simple";
  className?: string;
  onRegionTap?: (muscle: string) => void;
}) {
  const primary = expand(primaryProp ?? muscles ?? []);
  const secondary = expand(secondaryProp ?? []);
  const worked = new Set<Muscle>([...primary, ...secondary]);
  const level = onRegionTap ? "full" : (detail ?? (size >= 96 ? "full" : "simple"));

  const shared = {
    primary,
    secondary,
    worked,
    detail: level,
    onRegionTap,
  } as const;

  return (
    <svg
      viewBox={BODY_VIEW_BOX}
      width={size}
      height={size / BODY_ASPECT}
      role="img"
      aria-label={describe(worked)}
      className={`shrink-0 ${className}`}
    >
      <Figure
        outline={FRONT_OUTLINE}
        body={FRONT_BODY}
        regions={FRONT_REGIONS}
        order={FRONT_ORDER}
        mirror={FRONT_MIRROR}
        label="Front"
        {...shared}
      />
      <Figure
        outline={BACK_OUTLINE}
        body={BACK_BODY}
        regions={BACK_REGIONS}
        order={BACK_ORDER}
        mirror={BACK_MIRROR}
        label="Back"
        {...shared}
      />
    </svg>
  );
}

/**
 * `full body` means every drawable region. `core`, the retired Stage-1 synonym, means `abs` and
 * `obliques` together — resolved once here so no lookup has to special-case either.
 */
export function expand(muscles: readonly string[]): Set<Muscle> {
  const known = new Set(MUSCLES as readonly string[]);
  const out = new Set<Muscle>();
  for (const m of muscles) {
    if (m === "full body") {
      for (const r of MUSCLES) if (r !== "full body" && r !== "core") out.add(r);
    } else if (m === "core") {
      out.add("abs");
      out.add("obliques");
    } else if (known.has(m)) {
      out.add(m as Muscle);
    }
    // Anything else — the AI-add path and hand-typed entries can put whatever they like in this
    // column — is dropped rather than thrown on. A diagram is not the place to discover a typo.
  }
  return out;
}

/**
 * The alt text, which is the only form of this diagram a screen reader gets.
 *
 * Named regions rather than "muscle diagram": the picture's entire content is which regions are
 * lit, so a label that does not say them is a label that says nothing.
 */
function describe(worked: Set<Muscle>): string {
  if (worked.size === 0) return "Body map, with no muscle group marked";
  const names = MUSCLES.filter((m) => m !== "core" && worked.has(m));
  return `Body map, front and back, with ${names.join(", ")} marked`;
}
