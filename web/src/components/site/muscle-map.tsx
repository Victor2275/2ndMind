import { MUSCLES, type Muscle } from "@/lib/athletics/catalogue";

/**
 * A front-and-back body map, with the regions an exercise works picked out (V4 Phase 2.9, D-222).
 *
 * ## Why this is drawn here rather than fetched
 *
 * Victor's reference was a piece of stock anatomical art — one raster image per exercise, the
 * way Hevy ships them. Two problems with copying that shape, and only the second is about
 * licensing. **A hundred and sixty-four images drift.** Generated or commissioned per exercise,
 * they are a hundred and sixty-four chances for the picture to disagree with the `muscles` field
 * beside it, and nothing would ever catch that — the picture is not data, so no test can read
 * it. Here there is one drawing and the highlight is computed from the same array the search
 * chips and the record grouping already use, so the diagram cannot say something the catalogue
 * does not.
 *
 * The rest follows from that: it is an inline SVG, so it costs no request, works with no signal
 * on the one screen that must (§2.11 folds into this — there is nothing to cache), scales to any
 * size without a second asset, and takes its colours from the theme like everything else.
 *
 * ## The geometry is deliberately stylised
 *
 * Half a dozen shapes per side rather than real myology. It has to read at 96 pixels wide next
 * to an exercise name on a phone, where anatomical detail is noise — the question this answers
 * is "chest and triceps, or chest and shoulders?", which needs regions to be *distinguishable*,
 * not accurate. Every path is original: a trace of the reference would have been a derivative of
 * it, which is the same licensing problem in a different file format.
 *
 * ## Mirroring
 *
 * One side is drawn and the other is the same `d` under `scale(-1,1)`. That is not only less
 * code — it is what guarantees the two halves stay identical, which is the first thing the eye
 * checks on a symmetrical figure and the first thing to go wrong when limbs are drawn twice.
 */

/** Half the figure's width, doubled: mirroring about the centre line is `translate(W) scale(-1,1)`. */
const W = 110;

/** A region's shapes. `mirrored` paths are drawn once per side; centred ones span both. */
type Shape = { d: string; mirrored?: boolean };

/**
 * Where each muscle name lives on each figure.
 *
 * A name missing from a figure simply is not drawn there — `chest` has no back view and
 * `hamstrings` has no front one, which is the correct answer rather than a gap. `full body`
 * is not listed: it is expanded to every region before lookup, so one entry cannot fall out of
 * step with the rest of the list.
 */
/**
 * Order is paint order, and it is load-bearing where regions abut.
 *
 * `lats` is listed before `chest` because on a front view the lat wraps under the pec, so the
 * pec has to be the shape drawn last. Reversed — which is how it was first written — a bench
 * press lights a thin strip rather than a chest, and it looks like a colour bug rather than a
 * z-order one.
 *
 * Regions are built from several shapes each rather than one, because that is what makes the
 * figure read as muscle rather than as a body divided into boxes: the quad is a vastus lateralis
 * and a rectus femoris and a teardrop, the abs are a column of segments, the chest is two pecs
 * with a sternum between them. They share a fill, so a highlight still lights the whole group.
 */
const FRONT: Partial<Record<Muscle, Shape[]>> = {
  traps: [{ d: "M49 36 C43 38 37 43 32 49 C39 47 45 45 49 45 Z", mirrored: true }],
  shoulders: [
    // Deltoid: three heads, drawn as a cap over the joint with a seam through it.
    {
      d: "M34 44 C26 45 20 52 19 62 C19 66 21 69 24 70 C28 70 30 67 31 62 C32 54 34 48 38 45 Z",
      mirrored: true,
    },
  ],
  lats: [{ d: "M36 62 C35 71 37 80 40 87 L45 85 C43 77 43 69 44 63 Z", mirrored: true }],
  chest: [
    // Pectoral: wide at the sternum, tapering into the armpit, with the lower border curved.
    {
      d: "M53 47 C48 46 43 47 40 50 C37 54 36 60 38 65 C41 71 47 73 52 71 C54 70 54 68 54 65 Z",
      mirrored: true,
    },
    // The clavicular head, so the top of the chest is not one flat edge.
    { d: "M53 46 C48 45 43 46 40 49 C43 48 48 47 53 48 Z", mirrored: true },
  ],
  core: [
    // Six segments and the linea alba between them, which is what makes a torso read as abs.
    { d: "M46 74 L54 74 L54 82 L46 82 Z", mirrored: true },
    { d: "M46 84 L54 84 L54 92 L46 92 Z", mirrored: true },
    { d: "M47 94 L54 94 L54 102 L47 102 Z", mirrored: true },
    // The obliques, wrapping toward the hip.
    { d: "M43 76 C41 84 42 95 45 104 L47 104 C45 95 44 85 45 76 Z", mirrored: true },
    // The lower abdomen, running into the pelvis.
    { d: "M48 104 L54 104 L54 112 C52 114 50 114 49 112 Z", mirrored: true },
  ],
  biceps: [
    { d: "M22 67 C18 73 16 82 17 91 C18 94 21 95 23 93 C25 89 26 80 27 70 Z", mirrored: true },
    // Brachialis, showing at the outside of the arm below the biceps belly.
    { d: "M27 72 C27 80 26 87 25 92 L28 92 C29 85 30 78 30 71 Z", mirrored: true },
  ],
  forearms: [
    { d: "M17 95 C13 103 12 113 13 122 L18 124 C19 114 21 104 23 96 Z", mirrored: true },
    { d: "M23 97 C21 105 20 114 19 123 L23 124 C25 114 26 104 26 96 Z", mirrored: true },
  ],
  quads: [
    // Vastus lateralis — the outer sweep, widest at the top third.
    {
      d: "M37 124 C34 137 35 154 39 167 C41 171 44 171 45 168 C44 152 44 137 45 124 Z",
      mirrored: true,
    },
    // Rectus femoris — down the middle of the thigh.
    { d: "M46 124 C45 139 45 156 46 169 L52 171 C53 154 53 138 53 124 Z", mirrored: true },
    // Vastus medialis — the teardrop just above the knee.
    { d: "M46 167 C47 173 49 177 52 178 L53 169 Z", mirrored: true },
  ],
  calves: [
    { d: "M39 180 C37 189 37 198 40 206 L44 204 C44 196 44 188 45 180 Z", mirrored: true },
    // Tibialis anterior, along the shin, which is what the front view actually shows.
    { d: "M46 180 C46 189 46 197 47 205 L50 202 C50 194 50 187 50 180 Z", mirrored: true },
  ],
};

const BACK: Partial<Record<Muscle, Shape[]>> = {
  traps: [
    // The kite: neck out to the shoulder, in under the shoulder blade, down to a point on the
    // spine. One shape per side, not two — a seam here reads as a hole rather than as anatomy.
    { d: "M55 36 C63 37 70 41 75 47 C68 49 62 53 58 58 C57 66 56 73 55 80 Z", mirrored: true },
  ],
  shoulders: [
    {
      d: "M34 44 C26 45 20 52 19 62 C19 66 21 69 24 70 C28 70 30 67 31 62 C32 54 34 48 38 45 Z",
      mirrored: true,
    },
  ],
  // Inner edges stop short of the spine so `back` and `lower back` have that strip to
  // themselves — two regions fighting over the same pixels is how a diagram lies about which
  // one is lit.
  lats: [
    // The V: wide under the armpit, narrowing to the waist.
    { d: "M37 62 C34 73 35 87 41 98 C44 101 47 100 48 96 C45 86 45 73 46 62 Z", mirrored: true },
    // Teres major, the smaller mass right under the shoulder.
    { d: "M39 58 C37 62 37 66 38 70 L44 68 C44 63 45 60 46 58 Z", mirrored: true },
  ],
  back: [
    // Rhomboids and mid-trap, either side of the spine.
    { d: "M46 78 C45 84 45 90 47 97 L53 97 L53 78 Z", mirrored: true },
  ],
  "lower back": [
    // The erectors: two columns running into the pelvis.
    { d: "M47 98 C47 105 47 112 49 118 L54 118 L54 98 Z", mirrored: true },
  ],
  triceps: [
    // Long head and lateral head, with the horseshoe at the elbow.
    { d: "M22 66 C18 72 16 81 17 90 C18 93 21 94 23 92 C25 87 26 78 27 69 Z", mirrored: true },
    { d: "M27 70 C27 79 26 86 25 91 L29 91 C30 84 30 77 30 69 Z", mirrored: true },
  ],
  forearms: [
    { d: "M17 95 C13 103 12 113 13 122 L18 124 C19 114 21 104 23 96 Z", mirrored: true },
    { d: "M23 97 C21 105 20 114 19 123 L23 124 C25 114 26 104 26 96 Z", mirrored: true },
  ],
  glutes: [{ d: "M39 118 C37 127 38 138 44 144 C48 147 52 145 53 141 L53 118 Z", mirrored: true }],
  hamstrings: [
    // Biceps femoris outside, semitendinosus inside, splitting above the knee.
    { d: "M38 148 C36 160 37 174 40 186 L44 185 C43 172 43 159 44 148 Z", mirrored: true },
    { d: "M45 148 C45 161 45 175 46 187 L52 184 C52 170 52 158 52 148 Z", mirrored: true },
  ],
  calves: [
    // The two heads of the gastrocnemius, which is the shape the back of a leg is known by.
    { d: "M38 178 C36 188 37 198 41 206 L45 203 C44 194 44 186 45 178 Z", mirrored: true },
    { d: "M46 178 C46 188 46 196 48 204 L51 200 C51 192 51 185 51 178 Z", mirrored: true },
  ],
};

/**
 * The dark body underneath: head, neck, hands, feet, and the outline everything sits on.
 *
 * It is drawn with a waist, a chest that is wider than the hips, and calves that taper into the
 * ankle — the muscle shapes are painted over it, so wherever they do not reach, this is the
 * body's silhouette, and a rectangle there would undo every curve above.
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
        <g key={index}>
          <path d={shape.d} className={className} />
          {shape.mirrored && (
            <path d={shape.d} className={className} transform={`translate(${W} 0) scale(-1 1)`} />
          )}
        </g>
      ))}
    </>
  );
}

function Figure({
  regions,
  worked,
  label,
}: {
  regions: Partial<Record<Muscle, Shape[]>>;
  worked: Set<Muscle>;
  label: string;
}) {
  return (
    <g>
      <title>{label}</title>
      <Paths shapes={SILHOUETTE} className="fill-foreground/25" />
      {(Object.keys(regions) as Muscle[]).map((muscle) => (
        <Paths
          key={muscle}
          shapes={regions[muscle]!}
          // Worked regions take the accent; the rest stay a resting grey, which is what makes
          // the highlight mean something. A diagram where nothing is drawn unless it is worked
          // reads as a body part floating in space.
          className={
            worked.has(muscle)
              ? "fill-primary stroke-primary/40"
              : "fill-foreground/45 stroke-background/40"
          }
          {...{}}
        />
      ))}
    </g>
  );
}

/**
 * @param muscles  Names from `MUSCLES`. Anything else is ignored rather than throwing — the AI-add
 *                 path and hand-typed entries can put whatever they like in this column, and a
 *                 diagram is not the place to discover it.
 * @param size     Rendered width in pixels. The figure is drawn at 2×110 wide by 236 tall.
 */
export function MuscleMap({
  muscles,
  size = 132,
  className = "",
}: {
  muscles: readonly string[];
  size?: number;
  className?: string;
}) {
  const worked = expand(muscles);

  return (
    <svg
      viewBox={`0 0 ${W * 2 + 14} 236`}
      width={size}
      height={(size / (W * 2 + 14)) * 236}
      role="img"
      aria-label={describe(worked)}
      className={`shrink-0 [&_path]:stroke-[0.5] ${className}`}
    >
      <Figure regions={FRONT} worked={worked} label="Front" />
      <g transform={`translate(${W + 14} 0)`}>
        <Figure regions={BACK} worked={worked} label="Back" />
      </g>
    </svg>
  );
}

/** `full body` means every region, resolved once here so no lookup has to special-case it. */
export function expand(muscles: readonly string[]): Set<Muscle> {
  const known = new Set(MUSCLES as readonly string[]);
  if (muscles.includes("full body")) {
    return new Set(MUSCLES.filter((m) => m !== "full body"));
  }
  return new Set(muscles.filter((m): m is Muscle => known.has(m)));
}

/**
 * The alt text, which is the only form of this diagram a screen reader gets.
 *
 * Named regions rather than "muscle diagram": the picture's entire content is which regions are
 * lit, so a label that does not say them is a label that says nothing.
 */
function describe(worked: Set<Muscle>): string {
  if (worked.size === 0) return "Body map, with no muscle group marked";
  const names = MUSCLES.filter((m) => worked.has(m));
  return `Body map, front and back, with ${names.join(", ")} marked`;
}
