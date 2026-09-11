import { cn } from "@/lib/utils";

/**
 * Hand-authored system diagrams for the case studies (V4 item 6.7, Q224, Q225).
 *
 * Q224 called this "the highest-value visual work on the public site", and the reason is
 * specific: every other image on a project page is a screenshot or a photograph, which shows what
 * the thing *looked like*. None of them show how it works. An engineer reading a case study is
 * trying to reconstruct the mechanism, and a diagram is the only artefact that hands it over
 * directly.
 *
 * ## Rules these follow
 *
 * **Themed with CSS variables, never hex** (Q225). Every stroke and fill is `var(--primary)`,
 * `var(--border)`, `var(--muted-foreground)` or `var(--card)`, so a diagram is correct in all
 * five themes and in print without a second drawing. This is also what keeps the file past
 * `no-raw-hex.test.ts`.
 *
 * **Hand-authored, not generated** (Q225 again — not Mermaid, not Excalidraw). A layout engine
 * places boxes; it does not know that the interesting part of the solenoid chain is the shrinking
 * time window, or that the interesting part of flood fill is the wavefront. Each of these is
 * drawn around the one thing the case study says is the point.
 *
 * **They scroll rather than shrink.** At a 680-unit viewBox scaled into a 312px phone column,
 * 14px label text renders at about 6px. So the figure keeps its natural size and the container
 * scrolls sideways, which is the standing rule for wide content. Shrinking would produce a
 * picture that is present and unreadable, which is worse than one the reader has to nudge.
 *
 * **No emoji, no placeholder art** (Q217, Q226).
 *
 * Adding one: write a `Diagram` entry keyed by project slug. A project with no entry renders
 * nothing at all — `projects/[slug]/page.tsx` checks before it draws a heading, so an undrawn
 * project shows no empty section (Q331).
 */

/* -------------------------------------------------------------------------------------------
   Primitives. Small, and shared so the four diagrams read as one set rather than four drawings.
   ------------------------------------------------------------------------------------------- */

/** A labelled box. `accent` marks the one or two nodes the case study is actually about. */
function Node({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="8"
        fill="var(--card)"
        stroke={accent ? "var(--primary)" : "var(--border)"}
        strokeWidth={accent ? 1.5 : 1}
      />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 4 : y + h / 2 + 5}
        textAnchor="middle"
        fontSize="14"
        fontWeight="600"
        fill={accent ? "var(--primary)" : "var(--foreground)"}
      >
        {title}
      </text>
      {sub && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 14}
          textAnchor="middle"
          fontSize="11"
          fill="var(--muted-foreground)"
          fontFamily="var(--font-mono)"
        >
          {sub}
        </text>
      )}
    </g>
  );
}

/** A horizontal arrow with an optional label above it. */
function Flow({
  x1,
  x2,
  y,
  label,
  dashed = false,
}: {
  x1: number;
  x2: number;
  y: number;
  label?: string;
  dashed?: boolean;
}) {
  return (
    <g>
      <line
        x1={x1}
        y1={y}
        x2={x2 - 7}
        y2={y}
        stroke="var(--muted-foreground)"
        strokeWidth="1.25"
        strokeDasharray={dashed ? "4 3" : undefined}
        markerEnd="url(#dg-arrow)"
      />
      {label && (
        <text
          x={(x1 + x2) / 2}
          y={y - 8}
          textAnchor="middle"
          fontSize="11"
          fill="var(--muted-foreground)"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** A caption under the drawing — the sentence the diagram exists to make. */
function Caption({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text x={x} y={y} fontSize="12" fill="var(--muted-foreground)" fontStyle="italic">
      {children}
    </text>
  );
}

function Defs() {
  return (
    <defs>
      <marker
        id="dg-arrow"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--muted-foreground)" />
      </marker>
    </defs>
  );
}

/* -------------------------------------------------------------------------------------------
   The diagrams.
   ------------------------------------------------------------------------------------------- */

/**
 * Solenoid Bit Reader — the analog signal chain, and the thing that makes it hard.
 *
 * The chain itself is four boxes. What the case study is actually about is underneath: the
 * magnets accelerate under gravity, so each bit window is shorter than the last, and that is
 * drawn to scale rather than described.
 */
function SolenoidDiagram() {
  // Slot spacing shrinks left to right: the falling stack speeds up, so equal *distance*
  // between magnets becomes decreasing *time* between spikes. These widths are the point.
  const windows = [58, 48, 41, 35, 31, 28];
  let cursor = 40;

  return (
    <svg
      viewBox="0 0 680 250"
      width="680"
      height="250"
      role="img"
      aria-labelledby="dg-sol-t"
      aria-describedby="dg-sol-d"
    >
      <title id="dg-sol-t">Solenoid bit reader signal chain</title>
      <desc id="dg-sol-d">
        Magnets fall past a 387-turn coil, inducing a voltage spike. An LM358N op-amp applies 20x
        gain to bring the spike into the ESP32 ADC&apos;s 0 to 3.3 volt window, and the ESP32
        decodes presence or absence of a magnet into bits at 115200 baud. Because the magnets
        accelerate under gravity, each successive bit window is shorter than the last, which is why
        the decoder needs a start bit and a calibration matrix.
      </desc>
      <Defs />

      <Node x={16} y={30} w={116} h={52} title="Falling magnets" sub="N / empty" />
      <Flow x1={132} x2={186} y={56} />
      <Node x={186} y={30} w={116} h={52} title="Coil" sub="387 turns" accent />
      <Flow x1={302} x2={356} y={56} label="~mV" />
      <Node x={356} y={30} w={116} h={52} title="LM358N" sub="×20 gain" accent />
      <Flow x1={472} x2={526} y={56} label="0–3.3 V" />
      <Node x={526} y={30} w={138} h={52} title="ESP32 ADC" sub="115200 baud" />

      {/* The constraint, drawn. Equal magnet spacing, decreasing time per bit. */}
      <text x={16} y={124} fontSize="12" fontWeight="600" fill="var(--foreground)">
        Bit windows, down the drop
      </text>
      <g>
        {windows.map((w, i) => {
          const x = cursor;
          cursor += w + 6;
          return (
            <g key={i}>
              <rect
                x={x}
                y={140}
                width={w}
                height={26}
                rx="3"
                fill="var(--primary)"
                opacity={0.1 + i * 0.03}
                stroke="var(--primary)"
                strokeOpacity="0.45"
              />
              {/* The induced spike: a brief pulse, not a level. */}
              <path
                d={`M ${x + 4} 166 L ${x + w / 2 - 4} 166 L ${x + w / 2} 144 L ${x + w / 2 + 4} 166 L ${x + w - 4} 166`}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.5"
              />
            </g>
          );
        })}
      </g>
      <line
        x1={40}
        y1={178}
        x2={cursor - 6}
        y2={178}
        stroke="var(--border)"
        strokeWidth="1"
        markerEnd="url(#dg-arrow)"
      />
      <text
        x={40}
        y={194}
        fontSize="11"
        fill="var(--muted-foreground)"
        fontFamily="var(--font-mono)"
      >
        t = 0 (start bit)
      </text>
      <text
        x={cursor - 6}
        y={194}
        textAnchor="end"
        fontSize="11"
        fill="var(--muted-foreground)"
        fontFamily="var(--font-mono)"
      >
        faster
      </text>

      <Caption x={16} y={224}>
        Faraday gives a spike, not a level — and gravity shortens every window after the last.
      </Caption>
      <Caption x={16} y={241}>
        Below 40 mm spacing, adjacent spikes merge at the velocities reached near the end.
      </Caption>
    </svg>
  );
}

/**
 * Micromouse — flood fill as a wavefront, which is the one thing a reader needs to see.
 *
 * Numbers on a grid explain the algorithm faster than a paragraph: each cell holds its distance
 * from the goal, the wavefront expands one layer per pass, and the mouse then walks downhill.
 */
function MicromouseDiagram() {
  const cell = 30;
  const origin = { x: 20, y: 44 };
  // An 8x8 slice of the 16x16 competition grid, with the goal at the centre. Manhattan distance
  // stands in for the real flood, which routes around walls — the two walls drawn below show
  // where that matters.
  const goal = { c: 4, r: 3 };

  return (
    <svg
      viewBox="0 0 680 330"
      width="680"
      height="330"
      role="img"
      aria-labelledby="dg-mm-t"
      aria-describedby="dg-mm-d"
    >
      <title id="dg-mm-t">Flood fill wavefront on the maze grid</title>
      <desc id="dg-mm-d">
        Each cell of the maze grid holds its distance from the goal at the centre. The solver
        expands one wavefront layer per pass rather than recursing, so a full solve costs one pass
        per distance layer over the sixteen by sixteen grid, and the mouse then walks downhill from
        any starting cell.
      </desc>
      <Defs />

      <text x={20} y={26} fontSize="14" fontWeight="600" fill="var(--foreground)">
        One wavefront pass per distance layer
      </text>

      {Array.from({ length: 8 }).flatMap((_, r) =>
        Array.from({ length: 8 }).map((_, c) => {
          const d = Math.abs(c - goal.c) + Math.abs(r - goal.r);
          const isGoal = d === 0;
          return (
            <g key={`${r}-${c}`}>
              <rect
                x={origin.x + c * cell}
                y={origin.y + r * cell}
                width={cell}
                height={cell}
                fill={isGoal ? "var(--primary)" : "var(--primary)"}
                fillOpacity={isGoal ? 0.9 : Math.max(0.03, 0.3 - d * 0.03)}
                stroke="var(--border)"
                strokeWidth="0.75"
              />
              <text
                x={origin.x + c * cell + cell / 2}
                y={origin.y + r * cell + cell / 2 + 4}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill={isGoal ? "var(--primary-foreground)" : "var(--muted-foreground)"}
              >
                {d}
              </text>
            </g>
          );
        }),
      )}

      {/* Two walls, to say that the flood routes around obstacles rather than measuring
          straight-line distance. */}
      <line
        x1={origin.x + 2 * cell}
        y1={origin.y + 2 * cell}
        x2={origin.x + 2 * cell}
        y2={origin.y + 5 * cell}
        stroke="var(--foreground)"
        strokeWidth="3"
      />
      <line
        x1={origin.x + 5 * cell}
        y1={origin.y + 1 * cell}
        x2={origin.x + 7 * cell}
        y2={origin.y + 1 * cell}
        stroke="var(--foreground)"
        strokeWidth="3"
      />

      <g transform={`translate(${origin.x + 8 * cell + 34} ${origin.y + 6})`}>
        <text x={0} y={0} fontSize="12" fontWeight="600" fill="var(--foreground)">
          Reading it
        </text>
        <text x={0} y={22} fontSize="12" fill="var(--muted-foreground)">
          Each cell holds its distance
        </text>
        <text x={0} y={38} fontSize="12" fill="var(--muted-foreground)">
          from the goal. The mouse walks
        </text>
        <text x={0} y={54} fontSize="12" fill="var(--muted-foreground)">
          downhill from wherever it is.
        </text>

        <text x={0} y={88} fontSize="12" fontWeight="600" fill="var(--foreground)">
          Why it is fast
        </text>
        <text x={0} y={110} fontSize="12" fill="var(--muted-foreground)">
          One pass per layer — O(n·d),
        </text>
        <text x={0} y={126} fontSize="12" fill="var(--muted-foreground)">
          bounded by the grid, not the maze.
        </text>
        <text x={0} y={150} fontSize="12" fill="var(--muted-foreground)">
          The first version copied the
        </text>
        <text x={0} y={166} fontSize="12" fill="var(--muted-foreground)">
          visited-set per recursive call,
        </text>
        <text x={0} y={182} fontSize="12" fill="var(--muted-foreground)">
          making every step O(n) on its own.
        </text>
        <rect x={-10} y={-16} width={1} height={206} fill="var(--border)" />
      </g>

      <Caption x={20} y={props_y()}>
        A 16×16 competition grid; eight columns shown. Walls make the flood route around them.
      </Caption>
    </svg>
  );
}

/** Keeps the caption's y in one place — the grid height drives it. */
function props_y() {
  return 44 + 8 * 30 + 24;
}

/**
 * Proof — two flows that meet in one database, which is the whole architecture.
 *
 * Drawn as two rows because they are two different journeys: importing a recipe from the open
 * web, and keeping a timer honest across two devices in a kitchen.
 */
function ProofDiagram() {
  return (
    <svg
      viewBox="0 0 680 300"
      width="680"
      height="300"
      role="img"
      aria-labelledby="dg-pr-t"
      aria-describedby="dg-pr-d"
    >
      <title id="dg-pr-t">Proof — import pipeline and cross-device sync</title>
      <desc id="dg-pr-d">
        A recipe URL is scraped with Cheerio, restructured by the Gemini API into typed recipe
        fields, and stored in MongoDB. Separately, timers started on one device are relayed by
        Socket.io through the server so a phone and a tablet in the same kitchen agree, with MongoDB
        as the shared store behind both paths.
      </desc>
      <Defs />

      <text x={16} y={24} fontSize="13" fontWeight="600" fill="var(--foreground)">
        Import — a URL becomes structured data
      </text>
      <Node x={16} y={38} w={104} h={48} title="Recipe URL" />
      <Flow x1={120} x2={168} y={62} />
      <Node x={168} y={38} w={104} h={48} title="Cheerio" sub="scrape" />
      {/* Wider gap than the others: "raw HTML" is the longest label on this row and overlapped
          the next box's edge at a 48-unit span. */}
      <Flow x1={272} x2={338} y={62} label="raw HTML" />
      <Node x={338} y={38} w={116} h={48} title="Gemini API" sub="restructure" accent />
      <Flow x1={454} x2={500} y={62} label="typed" />
      <Node x={500} y={38} w={164} h={48} title="MongoDB" sub="recipes + photos" />

      <text x={16} y={142} fontSize="13" fontWeight="600" fill="var(--foreground)">
        Cooking — two devices, one timer
      </text>
      <Node x={16} y={156} w={130} h={52} title="Phone" sub="hands-free" />
      <Node x={266} y={156} w={148} h={52} title="Socket.io" sub="server relay" accent />
      <Node x={534} y={156} w={130} h={52} title="Tablet" sub="same kitchen" />
      <Flow x1={146} x2={266} y={172} label="start timer" />
      <line
        x1={414}
        y1={192}
        x2={534}
        y2={192}
        stroke="var(--muted-foreground)"
        strokeWidth="1.25"
        markerEnd="url(#dg-arrow)"
      />
      <text x={474} y={184} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
        tick
      </text>

      {/* Both paths land in the same store — drawn, because that is the sentence. */}
      <path
        d="M 340 156 L 340 120 L 582 120 L 582 86"
        fill="none"
        stroke="var(--border)"
        strokeWidth="1.25"
        strokeDasharray="4 3"
      />
      <text x={461} y={114} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
        persisted
      </text>

      <Caption x={16} y={248}>
        A PWA, so the whole of this works from a home-screen icon with the oven already on.
      </Caption>
      <Caption x={16} y={266}>
        99 automated tests across 22 files guard roughly 9,000 lines and 40 components.
      </Caption>
    </svg>
  );
}

/**
 * TaskAble — one document, two audiences.
 *
 * The design idea worth drawing is that the teacher and the student are looking at the same
 * Firestore document from opposite ends, and Gemini sits on the teacher's side turning one
 * instruction into the steps a student actually needs.
 */
function TaskAbleDiagram() {
  return (
    <svg
      viewBox="0 0 680 292"
      width="680"
      height="292"
      role="img"
      aria-labelledby="dg-ta-t"
      aria-describedby="dg-ta-d"
    >
      <title id="dg-ta-t">TaskAble — shared state between teacher and student</title>
      <desc id="dg-ta-d">
        A teacher writes one instruction. The Gemini API breaks it into ordered steps, which are
        written to a Firestore document. The student view reads the same document live and writes
        back progress, points and an emotion log, which the teacher dashboard sees without
        refreshing.
      </desc>
      <Defs />

      {/* Laid out so the read and the write are two separate horizontal lines at different
          heights. The first version ran them diagonally between Firestore and Student, where they
          crossed each other and their own labels — the picture said "these two talk" and hid
          which direction each arrow went, which is the only thing worth saying here. */}
      <Node x={16} y={34} w={150} h={54} title="Teacher" sub="one instruction" />
      <Flow x1={166} x2={222} y={61} />
      <Node x={222} y={34} w={150} h={54} title="Gemini API" sub="break into steps" accent />

      <Node x={222} y={158} w={190} h={60} title="Firestore" sub="one live document" accent />
      <line
        x1={297}
        y1={88}
        x2={297}
        y2={158}
        stroke="var(--muted-foreground)"
        strokeWidth="1.25"
        markerEnd="url(#dg-arrow)"
      />
      <text x={307} y={128} fontSize="11" fill="var(--muted-foreground)">
        ordered steps
      </text>

      <Node x={490} y={158} w={174} h={60} title="Student" sub="one step at a time" />
      {/* Read, then write — above and below, never crossing. */}
      <line
        x1={412}
        y1={176}
        x2={490}
        y2={176}
        stroke="var(--muted-foreground)"
        strokeWidth="1.25"
        markerEnd="url(#dg-arrow)"
      />
      <text x={451} y={168} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
        step
      </text>
      <line
        x1={490}
        y1={202}
        x2={412}
        y2={202}
        stroke="var(--muted-foreground)"
        strokeWidth="1.25"
        strokeDasharray="4 3"
        markerEnd="url(#dg-arrow)"
      />
      <text x={451} y={218} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
        progress
      </text>

      {/* The teacher's dashboard reads the same document, which is the point of the whole thing.
          Routed around the left rather than straight through the Gemini box. */}
      <path
        d="M 222 188 L 91 188 L 91 88"
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth="1.25"
        strokeDasharray="4 3"
        markerEnd="url(#dg-arrow)"
      />
      <text x={101} y={208} fontSize="11" fill="var(--muted-foreground)">
        dashboard reads live
      </text>

      <Caption x={16} y={250}>
        Both ends hold the same document, so the teacher sees a step completed as it happens.
      </Caption>
      <Caption x={16} y={268}>
        Built for children who need one instruction split into the steps it actually contains.
      </Caption>
    </svg>
  );
}

/* ------------------------------------------------------------------------------------------- */

const DIAGRAMS: Record<string, { render: () => React.ReactElement; caption: string }> = {
  "solenoid-bit-reader": {
    render: SolenoidDiagram,
    caption: "The signal chain, and why timing is the hard part",
  },
  "micromouse-simulator": {
    render: MicromouseDiagram,
    caption: "Flood fill, as the mouse sees it",
  },
  proof: { render: ProofDiagram, caption: "Import pipeline, and one timer across two devices" },
  taskable: { render: TaskAbleDiagram, caption: "One Firestore document, read from both ends" },
};

/** True when a project has a diagram, so the caller can skip the heading entirely (Q331). */
export function hasSystemDiagram(slug: string): boolean {
  return Object.hasOwn(DIAGRAMS, slug);
}

export function SystemDiagram({ slug, className }: { slug: string; className?: string }) {
  const entry = DIAGRAMS[slug];
  if (!entry) return null;

  return (
    <figure className={cn("not-prose", className)}>
      {/* Scrolls rather than shrinks — see the note at the top of this file. `tabindex` because a
          scrollable region has to be reachable without a pointer. */}
      <div
        tabIndex={0}
        role="group"
        aria-label={entry.caption}
        className="overflow-x-auto rounded-card border border-border bg-background/40 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <entry.render />
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">{entry.caption}</figcaption>
    </figure>
  );
}
