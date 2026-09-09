import { inflateSync } from "node:zlib";

/**
 * A minimal PNG reader, for tests that need to assert what an icon actually contains.
 *
 * It exists because the notification badge cannot be judged by looking at it (D-203). The
 * badge is white on transparent, so every viewer renders it as either a white square or an
 * empty one depending on what is behind it — and the bug being guarded against, an opaque
 * tile handed to Android as a stencil, looks exactly the same. The alpha channel is the only
 * place the difference lives, so the test has to read pixels.
 *
 * Deliberately not a dependency. `sharp` and `pngjs` are both real packages that would do
 * this, and both are native or large for a job that is one `zlib.inflate` and one unfiltering
 * loop against images this repo generates itself. `scripts/render-icons.mjs` emits 8-bit RGBA,
 * non-interlaced, every time — so rather than support the format, this asserts that shape up
 * front and refuses anything else. A future icon in some other format fails loudly here
 * instead of being silently misread.
 */

export type Png = {
  width: number;
  height: number;
  /** RGBA, four bytes per pixel, row-major. */
  pixels: Uint8Array;
};

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Paeth, from the PNG spec. The one predictor that is not obvious by inspection. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function decodePng(file: Buffer): Png {
  for (const [index, byte] of SIGNATURE.entries()) {
    if (file[index] !== byte) throw new Error("not a PNG");
  }

  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const bitDepth = file[24];
  const colorType = file[25];
  const interlace = file[28];

  // See the note above: narrow support, loud failure.
  if (bitDepth !== 8) throw new Error(`expected an 8-bit PNG, got ${bitDepth}-bit`);
  if (colorType !== 6) throw new Error(`expected RGBA (colour type 6), got type ${colorType}`);
  if (interlace !== 0) throw new Error("expected a non-interlaced PNG");

  // IDAT is one zlib stream that may be split across any number of chunks, and chromium does
  // split it — concatenating first is not an optimisation, it is required for inflate to work.
  const parts: Buffer[] = [];
  let offset = 8;
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") parts.push(file.subarray(offset + 8, offset + 8 + length));
    if (type === "IEND") break;
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * 4;
  const pixels = new Uint8Array(width * height * 4);

  // Each row is prefixed with a filter byte and is predicted from the row above it, so this
  // must run in order and in place — `pixels` is both the output and the reference.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);

    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;

      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`unknown row filter ${filter} on row ${y}`);

      pixels[y * stride + x] = value & 0xff;
    }
  }

  return { width, height, pixels };
}

/** Every pixel as `[r, g, b, a]`, for tests that want to reason about the image as a whole. */
export function* eachPixel(png: Png): Generator<[number, number, number, number]> {
  for (let i = 0; i < png.pixels.length; i += 4) {
    yield [png.pixels[i], png.pixels[i + 1], png.pixels[i + 2], png.pixels[i + 3]];
  }
}
