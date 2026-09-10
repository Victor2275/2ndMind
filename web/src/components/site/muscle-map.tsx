import { MUSCLES, type Muscle } from "@/lib/athletics/muscles";

/**
 * A front-and-back body map, with the regions an exercise works picked out — redrawn at
 * reference fidelity for V4 Phase 2++ Stage 1, against Victor's reference image
 * (`Muscles-worked-in-the-bench-press-exercise-2.png`).
 *
 * ## Why this is drawn here rather than fetched
 *
 * D-222's argument still stands, unchanged by the redraw: a hundred and some images, one per
 * exercise, are a hundred and some chances for the picture to disagree with the `muscles` field
 * beside it, and nothing would ever catch that — a picture is not data, so no test can read it.
 * There is one drawing, and the highlight is computed from the same array the search chips and
 * the record grouping already use, so the diagram cannot say something the catalogue does not.
 * What changed is fidelity, not the argument for one drawing: roughly 250 original paths now,
 * striated muscle bellies with dark seams between them, in the reference's pose and proportions.
 * Every path is still original work — a trace of the reference would be a derivative of it, the
 * same licensing problem the first drawing avoided.
 *
 * ## Primary and secondary
 *
 * The reference draws the prime mover in red and the assisting muscles in pink. Literal hex
 * would need a `no-raw-hex` exemption and would be wrong the moment someone switches theme, so
 * this reads `--primary` for the prime mover and a lighter step of the generated 50–950 ramp,
 * `--primary-300`, for the assist — correct in all five themes with no exemption needed.
 *
 * ## Mirroring, unchanged
 *
 * One side is drawn and the other is the same `d` under `scale(-1,1)` about the figure's
 * centreline. That is what guarantees the two halves stay identical, which is the first thing
 * the eye checks on a symmetrical figure and the first thing to go wrong when limbs are drawn
 * twice by hand.
 *
 * ## Two detail levels
 *
 * A hundred-plus striation strokes are texture at 300px and noise at 40px — worse than noise,
 * since a phone rendering a scrolling list of them pays for every one. `detail="simple"` (the
 * default under 96px) draws the muscle bellies only; `detail="full"` adds the striation seams.
 * Nothing about which regions light up changes between the two — only whether the fibres show.
 */

/** Half the figure's width, doubled: mirroring about the centre line is `translate(W) scale(-1,1)`. */
const W = 110;

/** A single drawn path. `mirrored` paths are drawn once per side; centred ones span both. */
type Shape = { d: string; mirrored?: boolean };

/** One region: the filled belly (or bellies) and, at full detail, the striation seams over them. */
type Region = { belly: Shape[]; hatch?: Shape[] };

type RegionKey = Exclude<Muscle, "full body" | "core">;

/**
 * A handful of parallel, gently bowed strokes across a bounding box — the striation on a muscle
 * belly. Not literal myology: a generated approximation is what makes ~20 regions affordable to
 * texture by hand without either tracing the reference (a licensing problem) or hand-plotting
 * two hundred individual fibre lines (a maintenance one). `rows` lines, evenly spaced across the
 * box's width, each bowing by `curve` at the midpoint.
 */
function hatch(x: number, y: number, w: number, h: number, rows: number, curve = 1.4): Shape[] {
  const out: Shape[] = [];
  for (let i = 1; i <= rows; i++) {
    const xx = x + (w * i) / (rows + 1);
    out.push({ d: `M${xx} ${y} Q${xx + curve} ${y + h / 2} ${xx} ${y + h}`, mirrored: true });
  }
  return out;
}

/**
 * Where each region lives on each figure, and the order they paint in.
 *
 * A name missing from a figure simply is not drawn there — `chest` has no back view, `hamstrings`
 * has no front one — which is the correct answer rather than a gap. Object key order is paint
 * order, and it is load-bearing where regions abut: `lats` before `chest` because the lat wraps
 * under the pec on a front view, so the pec must be the shape drawn last, or a bench press lights
 * a thin strip instead of a chest. `abductors` before `glutes` on the back for the same reason —
 * the glute covers most of the hip.
 */
const FRONT: Partial<Record<RegionKey, Region>> = {
  traps: {
    belly: [{ d: "M49 36 C43 38 37 43 32 49 C39 47 45 45 49 45 Z", mirrored: true }],
  },
  "hip flexors": {
    belly: [
      {
        d: "M40 118 C39 121 40 124 43 126 C46 127 48 125 48 122 C47 120 44 118 40 118 Z",
        mirrored: true,
      },
    ],
  },
  lats: {
    belly: [{ d: "M36 62 C35 71 37 80 40 87 L45 85 C43 77 43 69 44 63 Z", mirrored: true }],
  },
  shoulders: {
    // Three heads, drawn as a cap over the joint with the front/lateral bulk that reads from
    // this view. The posterior head is `rear delts`, drawn only on the back.
    belly: [
      {
        d: "M34 44 C26 45 20 52 19 62 C19 66 21 69 24 70 C28 70 30 67 31 62 C32 54 34 48 38 45 Z",
        mirrored: true,
      },
      // Clavicular head, so the cap reads as two heads rather than one ball.
      { d: "M34 44 C30 45 27 47 25 50 C29 49 33 48 37 48 Z", mirrored: true },
    ],
    hatch: hatch(20, 47, 12, 20, 3),
  },
  chest: {
    // Sternal head, wide at the sternum and tapering into the armpit, plus a clavicular head so
    // the top of the chest is not one flat edge, plus a lower extension for depth near the ribs.
    belly: [
      {
        d: "M53 47 C48 46 43 47 40 50 C37 54 36 60 38 65 C41 71 47 73 52 71 C54 70 54 68 54 65 Z",
        mirrored: true,
      },
      { d: "M53 46 C48 45 43 46 40 49 C43 48 48 47 53 48 Z", mirrored: true },
      { d: "M40 65 C39 67 40 69 42 70 C44 71 46 70 47 68 C45 67 42 66 40 65 Z", mirrored: true },
    ],
    hatch: hatch(39, 49, 14, 20, 4),
  },
  abs: {
    // Four segments and the linea alba between them, plus the lower abdomen running into the
    // pelvis — what makes a torso read as abs rather than as a flat panel.
    belly: [
      { d: "M46 74 L54 74 L54 82 L46 82 Z", mirrored: true },
      { d: "M46 84 L54 84 L54 92 L46 92 Z", mirrored: true },
      { d: "M47 94 L54 94 L54 102 L47 102 Z", mirrored: true },
      { d: "M48 104 L54 104 L54 112 C52 114 50 114 49 112 Z", mirrored: true },
    ],
    hatch: hatch(47, 76, 6, 34, 2, 0.6),
  },
  obliques: {
    belly: [{ d: "M43 76 C41 84 42 95 45 104 L47 104 C45 95 44 85 45 76 Z", mirrored: true }],
  },
  biceps: {
    belly: [
      { d: "M22 67 C18 73 16 82 17 91 C18 94 21 95 23 93 C25 89 26 80 27 70 Z", mirrored: true },
      // Brachialis, showing at the outside of the arm below the biceps belly.
      { d: "M27 72 C27 80 26 87 25 92 L28 92 C29 85 30 78 30 71 Z", mirrored: true },
    ],
    hatch: hatch(18, 71, 8, 18, 2),
  },
  forearms: {
    belly: [
      { d: "M17 95 C13 103 12 113 13 122 L18 124 C19 114 21 104 23 96 Z", mirrored: true },
      { d: "M23 97 C21 105 20 114 19 123 L23 124 C25 114 26 104 26 96 Z", mirrored: true },
    ],
    hatch: hatch(13, 99, 11, 20, 2),
  },
  quads: {
    // Vastus lateralis (outer sweep), rectus femoris (down the middle), vastus medialis (the
    // teardrop above the knee).
    belly: [
      {
        d: "M37 124 C34 137 35 154 39 167 C41 171 44 171 45 168 C44 152 44 137 45 124 Z",
        mirrored: true,
      },
      { d: "M46 124 C45 139 45 156 46 169 L52 171 C53 154 53 138 53 124 Z", mirrored: true },
      { d: "M46 167 C47 173 49 177 52 178 L53 169 Z", mirrored: true },
    ],
    hatch: hatch(37, 128, 15, 36, 4),
  },
  adductors: {
    // The innermost thigh strip, medial to the rectus femoris, painted after `quads` so only its
    // inner edge shows — the seam the reference draws between the two.
    belly: [{ d: "M51 126 C50 141 50 156 51 169 L55 169 L55 126 Z", mirrored: true }],
  },
  calves: {
    belly: [
      { d: "M39 180 C37 189 37 198 40 206 L44 204 C44 196 44 188 45 180 Z", mirrored: true },
      // Tibialis anterior, along the shin, which is what a front view actually shows.
      { d: "M46 180 C46 189 46 197 47 205 L50 202 C50 194 50 187 50 180 Z", mirrored: true },
    ],
    hatch: hatch(39, 183, 10, 20, 2),
  },
};

const BACK: Partial<Record<RegionKey, Region>> = {
  traps: {
    // The kite: neck out to the shoulder, in under the shoulder blade, down to a point on the
    // spine. One shape per side, not two — a seam here reads as a hole rather than as anatomy.
    belly: [
      { d: "M55 36 C63 37 70 41 75 47 C68 49 62 53 58 58 C57 66 56 73 55 80 Z", mirrored: true },
    ],
    hatch: hatch(56, 40, 16, 30, 3, 2),
  },
  "rear delts": {
    // The posterior head — the part of the deltoid cap this view actually shows. Drawing it as
    // `shoulders` again, as the previous figure did with an identical path front and back, was
    // the anatomical error this split fixes.
    belly: [
      {
        d: "M34 44 C26 45 20 52 19 62 C19 66 21 69 24 70 C28 70 30 67 31 62 C32 55 34 49 37 46 Z",
        mirrored: true,
      },
    ],
    hatch: hatch(20, 48, 10, 18, 2),
  },
  "rotator cuff": {
    // Infraspinatus/teres minor, the small mass under the scapula's blade that a back view shows
    // and a front view never can.
    belly: [
      { d: "M39 58 C37 61 37 65 39 68 C42 70 45 68 46 64 C46 61 43 58 39 58 Z", mirrored: true },
    ],
  },
  // Inner edges stop short of the spine so `back` and `lower back` have that strip to
  // themselves — two regions fighting over the same pixels is how a diagram lies about which
  // one is lit.
  lats: {
    belly: [
      // The V: wide under the armpit, narrowing to the waist.
      { d: "M37 62 C34 73 35 87 41 98 C44 101 47 100 48 96 C45 86 45 73 46 62 Z", mirrored: true },
      // Teres major, the smaller mass right under the shoulder.
      { d: "M39 58 C37 62 37 66 38 70 L44 68 C44 63 45 60 46 58 Z", mirrored: true },
    ],
    hatch: hatch(37, 65, 10, 30, 3, 2.2),
  },
  back: {
    // Rhomboids and mid-trap, either side of the spine.
    belly: [{ d: "M46 78 C45 84 45 90 47 97 L53 97 L53 78 Z", mirrored: true }],
  },
  "lower back": {
    // The erectors: two columns running into the pelvis.
    belly: [{ d: "M47 98 C47 105 47 112 49 118 L54 118 L54 98 Z", mirrored: true }],
    hatch: hatch(48, 100, 5, 16, 1, 0.4),
  },
  triceps: {
    // Long head and lateral head, with the horseshoe at the elbow.
    belly: [
      { d: "M22 66 C18 72 16 81 17 90 C18 93 21 94 23 92 C25 87 26 78 27 69 Z", mirrored: true },
      { d: "M27 70 C27 79 26 86 25 91 L29 91 C30 84 30 77 30 69 Z", mirrored: true },
    ],
    hatch: hatch(18, 70, 9, 18, 2),
  },
  forearms: {
    belly: [
      { d: "M17 95 C13 103 12 113 13 122 L18 124 C19 114 21 104 23 96 Z", mirrored: true },
      { d: "M23 97 C21 105 20 114 19 123 L23 124 C25 114 26 104 26 96 Z", mirrored: true },
    ],
    hatch: hatch(13, 99, 11, 20, 2),
  },
  abductors: {
    // Glute medius / TFL, the upper-outer hip a back-three-quarter view shows as a distinct
    // mass above and lateral to the glute proper. Painted before `glutes` so the glute's edge
    // sits on top, the way it actually overlaps.
    belly: [
      {
        d: "M33 112 C31 117 32 122 36 125 C39 126 42 124 42 120 C41 116 38 112 33 112 Z",
        mirrored: true,
      },
    ],
  },
  glutes: {
    belly: [{ d: "M39 118 C37 127 38 138 44 144 C48 147 52 145 53 141 L53 118 Z", mirrored: true }],
    hatch: hatch(39, 121, 12, 18, 2, 1.8),
  },
  hamstrings: {
    // Biceps femoris outside, semitendinosus inside, splitting above the knee.
    belly: [
      { d: "M38 148 C36 160 37 174 40 186 L44 185 C43 172 43 159 44 148 Z", mirrored: true },
      { d: "M45 148 C45 161 45 175 46 187 L52 184 C52 170 52 158 52 148 Z", mirrored: true },
    ],
    hatch: hatch(38, 151, 13, 32, 3, 1.6),
  },
  calves: {
    // The two heads of the gastrocnemius, which is the shape the back of a leg is known by.
    belly: [
      { d: "M38 178 C36 188 37 198 41 206 L45 203 C44 194 44 186 45 178 Z", mirrored: true },
      { d: "M46 178 C46 188 46 196 48 204 L51 200 C51 192 51 185 51 178 Z", mirrored: true },
    ],
    hatch: hatch(38, 181, 11, 22, 2, 1.4),
  },
};

/**
 * The dark body underneath: head, neck, hands, feet, and the outline everything sits on.
 *
 * Drawn with a waist, a chest wider than the hips, and calves that taper into the ankle — the
 * muscle shapes are painted over it, so wherever they do not reach, this is the body's
 * silhouette, and a rectangle there would undo every curve above.
 */
const SILHOUETTE: Shape[] = [
  { d: "M55 7 C62 7 68 13 68 21 C68 29 62 35 55 35 C48 35 42 29 42 21 C42 13 48 7 55 7 Z" },
  { d: "M49 30 L61 30 C61 36 62 40 64 42 L46 42 C48 40 49 36 49 30 Z" },
  {
    d: "M33 46 C33 43 38 40 44 40 L66 40 C72 40 77 43 77 46 C77 64 74 84 70 100 C72 112 75 120 76 127 L34 127 C35 120 38 112 40 100 C36 84 33 64 33 46 Z",
  },
  // Arm: deltoid to wrist, thicker at the biceps and narrowing through the forearm.
  {
    d: "M34 44 C25 46 19 54 18 65 C17 78 15 94 13 110 C12 117 12 123 12 128 L20 129 C21 122 22 114 23 106 C25 92 27 78 29 68 C30 57 34 48 39 45 Z",
    mirrored: true,
  },
  { d: "M12 128 C8 132 7 140 11 144 C16 147 22 143 22 137 L21 129 Z", mirrored: true },
  // Leg: hip to ankle, with the knee narrower than the thigh and the calf wider than the shin.
  {
    d: "M34 127 L54 127 C55 145 54 162 52 176 C50 186 48 197 47 206 C46 214 46 219 46 222 L36 222 C36 216 37 208 38 200 C40 186 41 171 40 158 C39 146 37 137 34 127 Z",
    mirrored: true,
  },
  { d: "M37 219 L47 219 L47 226 C43 229 36 228 33 225 C32 222 34 220 37 219 Z", mirrored: true },
];

function Paths({ shapes, className }: { shapes: Shape[]; className: string }) {
  return (
    <>
      {shapes.map((shape, index) => (
        <path key={index} d={shape.d} className={className} />
      ))}
      {shapes
        .filter((s) => s.mirrored)
        .map((shape, index) => (
          <path
            key={`m${index}`}
            d={shape.d}
            className={className}
            transform={`translate(${W} 0) scale(-1 1)`}
          />
        ))}
    </>
  );
}

/** `worked` regions take the accent colours; everything else stays a resting, striated grey. */
function regionClass(muscle: RegionKey, primary: Set<Muscle>, secondary: Set<Muscle>): string {
  if (primary.has(muscle)) return "fill-primary stroke-primary/50";
  if (secondary.has(muscle)) return "fill-primary-300 stroke-primary-300/50";
  return "fill-foreground/45 stroke-background/40";
}

function Figure({
  regions,
  order,
  primary,
  secondary,
  detail,
  label,
  onRegionTap,
}: {
  regions: Partial<Record<RegionKey, Region>>;
  order: RegionKey[];
  primary: Set<Muscle>;
  secondary: Set<Muscle>;
  detail: "full" | "simple";
  label: string;
  onRegionTap?: (muscle: RegionKey) => void;
}) {
  return (
    <g>
      <title>{label}</title>
      <Paths shapes={SILHOUETTE} className="fill-foreground/25" />
      {order.map((muscle) => {
        const region = regions[muscle];
        if (!region) return null;
        const fill = regionClass(muscle, primary, secondary);
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
            <Paths shapes={region.belly} className={fill} />
            {detail === "full" && region.hatch && (
              <Paths shapes={region.hatch} className="fill-none stroke-background/35" />
            )}
          </g>
        );
      })}
    </g>
  );
}

const FRONT_ORDER = Object.keys(FRONT) as RegionKey[];
const BACK_ORDER = Object.keys(BACK) as RegionKey[];

/**
 * @param muscles   Legacy prop: names from `MUSCLES`, all drawn as the primary colour. Kept so
 *                  Stage 1 ships against the catalogue's existing flat array — see the module
 *                  doc. Ignored where `primary` is given explicitly.
 * @param primary   Prime-mover regions, drawn in `--primary`. Defaults to `muscles`.
 * @param secondary Assisting regions, drawn in a lighter ramp step. Defaults to none — the
 *                  catalogue has no primary/secondary split until Stage 3.
 * @param size      Rendered width in pixels. The figure is drawn at 2×110 wide by 236 tall.
 * @param detail    `"full"` draws striation seams over each belly; `"simple"` draws bellies only.
 *                  Defaults to `"full"` at 96px and above, `"simple"` below — a scrolling list of
 *                  40px glyphs pays for texture nobody can see.
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
  const level = detail ?? (size >= 96 ? "full" : "simple");

  return (
    <svg
      viewBox={`0 0 ${W * 2 + 14} 236`}
      width={size}
      height={(size / (W * 2 + 14)) * 236}
      role="img"
      aria-label={describe(worked)}
      className={`shrink-0 [&_path]:stroke-[0.5] ${className}`}
    >
      <Figure
        regions={FRONT}
        order={FRONT_ORDER}
        primary={primary}
        secondary={secondary}
        detail={level}
        label="Front"
        onRegionTap={onRegionTap}
      />
      <g transform={`translate(${W + 14} 0)`}>
        <Figure
          regions={BACK}
          order={BACK_ORDER}
          primary={primary}
          secondary={secondary}
          detail={level}
          label="Back"
          onRegionTap={onRegionTap}
        />
      </g>
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
