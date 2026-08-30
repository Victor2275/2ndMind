import Image from "next/image";

/**
 * A project's hero image, or a generated stand-in when there is no photograph yet.
 *
 * The placeholder is deliberately not a grey box. It draws a scope-style trace seeded from
 * the project slug, so every project gets a different but stable image in the site's own
 * palette — the grid reads as designed while Victor is still taking photos, and swapping in
 * a real file is a one-line frontmatter change with no component edit.
 */

/** FNV-1a. Small, stable across runs, and good enough to decorrelate short slugs. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const TRACE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)"];

function tracePath(seed: number, width: number, height: number): string {
  // Three sine components with seed-derived frequency, phase, and amplitude. Summing them
  // gives a signal that looks measured rather than decorative, without any randomness at
  // render time — the same slug always draws the same trace.
  const comps = [0, 1, 2].map((i) => {
    const s = (seed >> (i * 7)) & 0x7f;
    return {
      freq: 1 + (s % 4) + i,
      phase: (((s >> 2) % 16) / 16) * Math.PI * 2,
      amp: (height / 5) * (1 - i * 0.28),
    };
  });

  const steps = 64;
  const mid = height / 2;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const y = comps.reduce(
      (acc, c) => acc + Math.sin(t * Math.PI * 2 * c.freq + c.phase) * c.amp,
      0,
    );
    return `${(t * width).toFixed(1)},${(mid - y).toFixed(1)}`;
  });

  return `M ${points.join(" L ")}`;
}

export function ProjectFigure({
  slug,
  title,
  image,
  className,
  priority,
}: {
  slug: string;
  title: string;
  image?: string;
  className?: string;
  priority?: boolean;
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt={title}
        fill
        priority={priority}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
        className={className ?? "object-contain p-2"}
      />
    );
  }

  const seed = hash(slug);
  const color = TRACE_COLORS[seed % TRACE_COLORS.length];
  const w = 320;
  const h = 180;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      role="img"
      aria-label={`${title} — image pending`}
    >
      <defs>
        <pattern id={`grid-${slug}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="var(--border)"
            strokeWidth="0.5"
            opacity="0.6"
          />
        </pattern>
        <linearGradient id={`fade-${slug}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="50%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.15" />
        </linearGradient>
      </defs>

      <rect width={w} height={h} fill="var(--card)" />
      <rect width={w} height={h} fill={`url(#grid-${slug})`} />
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="var(--border)" strokeWidth="1" />
      <path
        d={tracePath(seed, w, h)}
        fill="none"
        stroke={`url(#fade-${slug})`}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y={h - 12}
        fill="var(--muted-foreground)"
        fontSize="9"
        fontFamily="var(--font-mono), monospace"
        letterSpacing="1.2"
      >
        IMAGE PENDING
      </text>
    </svg>
  );
}
