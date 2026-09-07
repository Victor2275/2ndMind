/**
 * Colour maths for the token system (V4 §1.1).
 *
 * Palettes are authored in **OKLCH** and checked in **sRGB**, and those are not the same space
 * for a reason: OKLCH is perceptually uniform, so "the same colour, one step darker" is a
 * subtraction rather than a guess — which is what makes a light and a dark palette derivable
 * from each other instead of eyeballed. WCAG contrast, however, is defined on sRGB relative
 * luminance and nothing else, so every ratio in this project is computed after converting back.
 *
 * Authoring in one space and grading in the other is the whole point. Picking values by eye in
 * hex is how `#09A1A1` ended up named as an accent it cannot serve — it is 2.94:1 on paper, and
 * nothing about looking at it says so.
 *
 * Pure functions with no imports, so the palette tests and any script can use them.
 */

export type Oklch = {
  /** Perceptual lightness, 0–1. */
  l: number;
  /** Chroma, 0–~0.4 in practice. 0 is a true grey. */
  c: number;
  /** Hue angle in degrees, 0–360. */
  h: number;
};

/** `oklch(0.66 0.15 3)` — the CSS form, for writing into a stylesheet. */
export function formatOklch({ l, c, h }: Oklch): string {
  const round = (n: number, places: number) => Number(n.toFixed(places));
  return `oklch(${round(l, 4)} ${round(c, 4)} ${round(h, 2)})`;
}

/** Parses `oklch(L C H)`. Returns null for anything else, including hex and named colours. */
export function parseOklch(value: string): Oklch | null {
  const match = value.trim().match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/i);
  if (!match) return null;
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}

/**
 * OKLCH -> linear sRGB, via OKLab.
 *
 * The matrices are Björn Ottosson's, unchanged. The cube in the middle is the non-linearity
 * that makes OKLab perceptual; the two matrix multiplications either side of it move between
 * LMS cone response and linear RGB.
 */
function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lc = l_ * l_ * l_;
  const mc = m_ * m_ * m_;
  const sc = s_ * s_ * s_;

  return [
    +4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ];
}

/** Linear sRGB -> gamma-encoded 0–255, clamped. */
function encode(channel: number): number {
  const v = channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

/**
 * Whether this OKLCH triple survives the trip to sRGB unchanged.
 *
 * OKLCH can describe colours sRGB cannot show. Those do not error — they clamp, silently, and a
 * clamped colour is no longer the one the palette says it is: its lightness moves, which moves
 * its contrast, which means a ratio computed from the OKLCH values would be a number about a
 * colour nobody sees. Every palette entry is checked against this.
 */
export function inSrgbGamut(color: Oklch): boolean {
  const EPSILON = 0.0005;
  return oklchToLinearRgb(color).every((ch) => ch >= -EPSILON && ch <= 1 + EPSILON);
}

/** OKLCH -> `#rrggbb`. Out-of-gamut values clamp; use `inSrgbGamut` to find them first. */
export function oklchToHex(color: Oklch): string {
  const [r, g, b] = oklchToLinearRgb(color).map(encode);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** `#rgb` or `#rrggbb` -> 0–255 channels. */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 2.x relative luminance. sRGB only — this is why colours are converted before grading. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two colours, 1–21.
 *
 * Accepts hex or OKLCH strings so a test can pass whatever the stylesheet contained.
 */
export function contrast(a: string, b: string): number {
  const toHex = (value: string) => {
    if (value.startsWith("#")) return value;
    const parsed = parseOklch(value);
    if (!parsed) throw new Error(`contrast(): not a hex or oklch() colour: ${value}`);
    return oklchToHex(parsed);
  };

  const l1 = relativeLuminance(toHex(a));
  const l2 = relativeLuminance(toHex(b));
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The same colour, with chroma reduced until sRGB can actually show it.
 *
 * This is the step whose absence made the first palette pass useless. OKLCH describes colours
 * sRGB cannot reach — teal at chroma 0.1 is outside it for every mid lightness — and asking for
 * one does not fail, it clamps a channel. A clamped colour has moved: `oklch(0.5 0.1 194)`
 * renders as `#007474`, whose red channel was pushed up to 0 from a negative number, so its
 * lightness and therefore its contrast are not the ones the palette asked for.
 *
 * Treating out-of-gamut as *invalid* rather than as *needs mapping* is what made the solver
 * reject every usable teal and return a near-black "accent" at 19:1. Reducing chroma is the
 * standard answer: hue is what the palette means, and lightness is what carries contrast, so
 * saturation is the one of the three that can give way.
 */
export function fitToGamut(color: Oklch): Oklch {
  if (inSrgbGamut(color)) return color;

  let low = 0;
  let high = color.c;
  for (let i = 0; i < 20; i += 1) {
    const c = (low + high) / 2;
    if (inSrgbGamut({ ...color, c })) low = c;
    else high = c;
  }
  return { ...color, c: low };
}

/**
 * The lightness that hits a target contrast against `against`, keeping hue and chroma.
 *
 * A binary search rather than an inversion: relative luminance has no closed form through the
 * OKLab cube, and 24 iterations lands inside a thousandth of an L step, which is finer than the
 * 4 decimal places the values are written with.
 *
 * `direction` says which way to move — "up" for text lighter than its ground, "down" for darker.
 * Returns null when the target cannot be reached in gamut, which is a real answer: it is what
 * says a chosen hue cannot carry text at that chroma, and the fix is less chroma, not more
 * search.
 */
export function lightnessForContrast(
  base: Omit<Oklch, "l">,
  against: string,
  target: number,
  direction: "up" | "down",
): Oklch | null {
  let low = 0;
  let high = 1;
  let best: Oklch | null = null;

  for (let i = 0; i < 24; i += 1) {
    const l = (low + high) / 2;
    // Gamut-mapped *before* measuring, so the ratio describes the colour that will render
    // rather than the one that was asked for.
    const candidate = fitToGamut({ l, c: base.c, h: base.h });
    const ratio = contrast(oklchToHex(candidate), against);

    if (ratio >= target) {
      best = candidate;
      // Having met the target, keep pushing back toward the ground so the result is the
      // *closest* passing colour rather than the most extreme one — an accent that clears 4.5:1
      // by a mile has stopped being the accent.
      if (direction === "up") high = l;
      else low = l;
    } else if (direction === "up") {
      low = l;
    } else {
      high = l;
    }
  }

  return best;
}
