/**
 * Reads a lucide icon's geometry from `node_modules`, for the scripts that draw images.
 *
 * `render-icons.mjs` needs it for the launcher shortcut glyphs and `render-og.mjs` for the
 * five-pillar lockup. Two copies of "turn `__iconNode` into SVG" is the kind of duplication that
 * only bites once — the second caller hits an alias the first never did, fixes it locally, and
 * the two drift.
 *
 * lucide-react is already a dependency and is the icon set the app uses everywhere (Q209), so
 * this needs nothing new. It publishes `__iconNode` as raw `[tag, attrs]` pairs, which is all
 * either script wants; hand-copying bezier paths into a build script is how a glyph ends up two
 * versions behind the one rendered in the app.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(
  here,
  "..",
  "..",
  "node_modules",
  "lucide-react",
  "dist",
  "esm",
  "icons",
);

/**
 * The `[tag, attrs]` pairs for one icon, following alias modules.
 *
 * Some names are aliases — `waves.mjs` is `export { default } from './waves-horizontal.mjs'` and
 * deliberately does **not** re-export `__iconNode`. Importing one of those yields a module whose
 * `__iconNode` is `undefined`, which fails as `Cannot read properties of undefined` somewhere
 * downstream rather than where the mistake is. So an alias is followed once, by reading the file.
 */
export async function iconNode(name) {
  const mod = await import(`lucide-react/dist/esm/icons/${name}.mjs`);
  if (mod.__iconNode) return mod.__iconNode;

  const source = await readFile(path.join(iconsDir, `${name}.mjs`), "utf8");
  const alias = source.match(/export \{ default \} from '\.\/([\w-]+)\.mjs'/);
  if (!alias) throw new Error(`lucide icon "${name}" has no __iconNode and is not an alias`);

  const target = await import(`lucide-react/dist/esm/icons/${alias[1]}.mjs`);
  if (!target.__iconNode)
    throw new Error(`lucide alias "${name}" -> "${alias[1]}" has no geometry`);
  return target.__iconNode;
}

/**
 * One icon as an SVG string, on lucide's own 24 grid.
 *
 * `stroke-width` defaults to 1.75, which is the app's value (Q213) rather than lucide's 2 — the
 * heavier default reads wrong against this type.
 */
export async function glyphSvg(name, { size = 24, color = "currentColor", stroke = 1.75 } = {}) {
  const paths = (await iconNode(name))
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .filter(([key]) => key !== "key")
          .map(([key, value]) => `${key}="${value}"`)
          .join(" ")}/>`,
    )
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${color}" stroke-width="${stroke}" ` +
    `stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
  );
}

/** Just the inner paths, for callers that supply their own `<svg>` wrapper and transform. */
export async function glyphPaths(name) {
  return (await iconNode(name))
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .filter(([key]) => key !== "key")
          .map(([key, value]) => `${key}="${value}"`)
          .join(" ")}/>`,
    )
    .join("");
}
