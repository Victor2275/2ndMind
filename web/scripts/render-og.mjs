/**
 * Renders the Open Graph cards — the image a recruiter sees when victorgusev.com is pasted into
 * LinkedIn, Slack, or an application form (V4 item 6.3, Q43–Q45, D-218).
 *
 * ## Why this is not `next/og`
 *
 * Q43 asked for `next/og`, and that was the right default until the fonts were checked. Satori,
 * which `next/og` renders through, reads TTF, OTF and WOFF — **not WOFF2** — and every face this
 * site owns is WOFF2 and nothing else: `@fontsource` was stripped from `node_modules` once the
 * files were copied into `src/app/fonts/`, and the budget forbids fetching anything at build
 * time. The fallback `next/og` would silently use is Geist, which appears nowhere else on this
 * site. That is a poor trade on the one asset whose entire job is to look like Victor's.
 *
 * Chromium reads WOFF2 natively, is already a dev dependency, and already renders the icons two
 * files over. So the cards are rendered the same way the icons are: by a script that is run by
 * hand, with its output committed. The trade that buys is real — the images can go stale — and
 * `src/lib/__tests__/og.test.ts` is what makes that loud: the script writes a manifest of what it
 * drew, and the test compares it against the vault's own loader.
 *
 * Run: node scripts/render-og.mjs
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { glyphSvg } from "./lib/lucide.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const projectsDir = path.join(root, "..", "context", "01_engineering", "projects");
const fontsDir = path.join(root, "src", "app", "fonts");
const outDir = path.join(root, "public", "og");

/* Colours. Same arrangement as `render-icons.mjs`: node cannot import the registry, so these are
   literals and `src/lib/__tests__/brand.test.ts` pins them to it. */
const GROUND = "#0e0e0e";
const ACCENT = "#00aeb6";
const FOREGROUND = "#f6f6f6";
/** `--muted-foreground` for carbon. Pinned with the rest. */
const MUTED = "#b7b7b7";

/** Open Graph's canonical size. Every platform that crops, crops from this. */
const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Frontmatter, narrowly.
 *
 * Deliberately not a YAML parser: the six fields read here are scalars and one flow sequence,
 * and pulling in a parser for that is a dependency to keep current for no gain. Anything more
 * structured than this belongs in the app's typed loader — which is exactly what the drift test
 * checks this against, so a field that outgrows this parser fails loudly rather than silently
 * rendering an empty card.
 */
function frontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!kv) continue;
    const [, key, raw] = kv;
    const value = raw.trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      fields[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      fields[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  return fields;
}

/**
 * The five pillars, as the lockup C15 sent here.
 *
 * Q31 wants all five — 3D printing, baking, robotics, dragon boat, CS — and Q32/Q33 want one
 * representational object at 16px. Those cannot both be the mark, so §8 resolved it: the mark is
 * the brain, and the five pillars live where there is room. This is that room.
 *
 * `waves` stands in for dragon boat. Q215 sanctions three custom icons — dragon boat, filament
 * spool, erg — drawn to lucide's grid, but that is a Phase 5 item and this does not wait on it.
 */
const PILLARS = [
  ["layers", "3D printing"],
  ["croissant", "Baking"],
  ["bot", "Robotics"],
  ["waves", "Dragon boat"],
  ["terminal", "Computer science"],
];

/** `@font-face` blocks pointing straight at the WOFF2 files, which Chromium reads natively. */
async function fontFaces() {
  const load = async (file) =>
    `data:font/woff2;base64,${(await readFile(path.join(fontsDir, file))).toString("base64")}`;

  return `
    @font-face {
      font-family: "Bricolage";
      src: url("${await load("bricolage-grotesque-latin-wght-normal.woff2")}") format("woff2");
      font-weight: 200 800;
    }
    @font-face {
      font-family: "Instrument";
      src: url("${await load("instrument-sans-latin-400-normal.woff2")}") format("woff2");
      font-weight: 400;
    }
    @font-face {
      font-family: "Instrument";
      src: url("${await load("instrument-sans-latin-600-normal.woff2")}") format("woff2");
      font-weight: 600;
    }
    @font-face {
      font-family: "PlexMono";
      src: url("${await load("ibm-plex-mono-latin-500-normal.woff2")}") format("woff2");
      font-weight: 500;
    }`;
}

/**
 * The shared shell.
 *
 * Flat colour, no ambient gradient and no grain: every platform re-encodes these as JPEG at some
 * quality it chooses, and a subtle gradient is exactly what that turns into visible banding. The
 * one gesture is a hairline rule in the accent along the top edge, which survives any encoder.
 */
function shell(css, faces, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${faces}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${WIDTH}px; height: ${HEIGHT}px; background: ${GROUND}; color: ${FOREGROUND};
      font-family: Instrument, system-ui, sans-serif;
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 72px 80px; position: relative; overflow: hidden;
    }
    body::before {
      content: ""; position: absolute; inset: 0 0 auto 0; height: 6px; background: ${ACCENT};
    }
    .mark { width: 56px; height: 56px; color: ${ACCENT}; }
    .row { display: flex; align-items: center; gap: 20px; }
    .wordmark {
      font-family: Bricolage, sans-serif; font-weight: 600; font-size: 30px;
      letter-spacing: -0.02em;
    }
    .title {
      font-family: Bricolage, sans-serif; font-weight: 600; letter-spacing: -0.03em;
      line-height: 1.03;
    }
    .summary { color: ${MUTED}; font-size: 27px; line-height: 1.4; max-width: 21ch; }
    .foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; }
    .mono {
      font-family: PlexMono, monospace; font-weight: 500; font-size: 19px; color: ${MUTED};
      letter-spacing: 0.02em;
    }
    .chips { display: flex; gap: 10px; flex-wrap: wrap; }
    .chip {
      font-family: PlexMono, monospace; font-weight: 500; font-size: 18px; color: ${ACCENT};
      border: 1px solid ${ACCENT}55; border-radius: 999px; padding: 7px 16px;
    }
    .pillars { display: flex; gap: 26px; align-items: center; }
    ${css}
  </style></head><body>${body}</body></html>`;
}

/** The site-wide card (Q44: generic everywhere except a project page). */
async function sitePage(faces, mark, profile) {
  const pillars = (
    await Promise.all(PILLARS.map(([icon]) => glyphSvg(icon, { size: 34, color: MUTED })))
  ).join("");

  return shell(
    `.title { font-size: 92px; }
     .summary { font-size: 30px; max-width: 30ch; margin-top: 22px; }`,
    faces,
    // The mark stands alone here, with no wordmark beside it. The card's own title is
    // "Victor Gusev", so a lockup would either repeat it or — as the first draft did — put
    // "2ndMind" as the first thing a recruiter reads on a card for victorgusev.com. The
    // project cards keep the lockup, because there the title is the project's.
    `<div class="row">${mark}</div>
     <div>
       <div class="title">${profile.name}</div>
       <div class="summary">${profile.positioning}</div>
     </div>
     <div class="foot">
       <div class="pillars">${pillars}</div>
       <div class="mono">victorgusev.com</div>
     </div>`,
  );
}

/** A project card (Q44: per-page for projects). */
function projectPage(faces, mark, project) {
  // The title carries the card, so it is sized against its own length rather than set once and
  // left to wrap into the summary. Three steps is enough — the longest real title is 44
  // characters and the shortest is 5.
  const size = project.title.length > 34 ? 62 : project.title.length > 20 ? 74 : 88;
  const chips = (project.stack ?? [])
    .slice(0, 3)
    .map((s) => `<span class="chip">${escapeHtml(s)}</span>`)
    .join("");

  return shell(
    `.title { font-size: ${size}px; max-width: 15ch; }
     .summary { font-size: 26px; max-width: 34ch; margin-top: 20px; }`,
    faces,
    `<div class="row">${mark}<span class="wordmark">Victor Gusev</span></div>
     <div>
       <div class="title">${escapeHtml(project.title)}</div>
       <div class="summary">${escapeHtml(project.summary ?? "")}</div>
     </div>
     <div class="foot">
       <div class="chips">${chips}</div>
       <div class="mono">victorgusev.com</div>
     </div>`,
  );
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/* ------------------------------------------------------------------------------------------ */

const faces = await fontFaces();

// The mark, inline, at the accent colour — same drawing as everything else.
const brain = await readFile(path.join(root, "public", "icons", "brain.svg"), "utf8");
const mark = `<svg class="mark" viewBox="0 0 512 512">${brain.slice(
  brain.indexOf("<defs>"),
  brain.lastIndexOf("</svg>"),
)}</svg>`;

// The positioning line is the one string here that is a claim about Victor rather than a fact
// from the vault. It is duplicated in `lib/profile-copy.ts`, which the About hero also reads, and
// the drift test pins the two together.
const { POSITIONING } = await import(
  pathToFileURL(path.join(root, "src", "lib", "profile-copy.ts")).href
);

const files = (await readdir(projectsDir)).filter((f) => f.endsWith(".md"));
const projects = [];
for (const file of files) {
  const fields = frontmatter(await readFile(path.join(projectsDir, file), "utf8"));
  if (!fields?.slug) continue;
  // The same filter the site uses — `publicProjects()` keys on `public`, nothing else.
  // Filtering on `draft` here was wrong and cost two cards: Q339 says a draft is not
  // *marked* on the public site, not that it is unpublished, and both drafts carry
  // `public: true`. A published page whose OG image 404s is exactly the miss this
  // renderer exists to prevent.
  if (fields.public !== "true") continue;
  projects.push(fields);
}
projects.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const manifest = [];

try {
  const view = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  await view.setContent(
    await sitePage(faces, mark, { name: "Victor Gusev", positioning: POSITIONING }),
  );
  await view.evaluate(() => document.fonts.ready);
  await writeFile(path.join(outDir, "site.png"), await view.screenshot());
  manifest.push({ file: "site.png", slug: null, title: "Victor Gusev" });
  console.log(`  ${"site.png".padEnd(34)} ${WIDTH}x${HEIGHT}`);

  for (const project of projects) {
    await view.setContent(projectPage(faces, mark, project));
    await view.evaluate(() => document.fonts.ready);
    const file = `project-${project.slug}.png`;
    await writeFile(path.join(outDir, file), await view.screenshot());
    manifest.push({ file, slug: project.slug, title: project.title });
    console.log(`  ${file.padEnd(34)} ${WIDTH}x${HEIGHT}`);
  }
} finally {
  await browser.close();
}

// What was drawn, so a test can compare it against what the site actually publishes. Without
// this the cards go stale the first time a project is renamed and nothing says so.
await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`\nog cards written to public/og/ (${manifest.length} files)`);
