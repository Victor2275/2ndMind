/**
 * Before/after for every screen — V4 §7.5 (Q29, Q465).
 *
 * Q29 asked for a before/after record per screen and said `.shots/` already exists, so add a
 * compare mode. Q465 asked, separately, whether that should be a **pixel diff against a
 * baseline** and answered *no* — "a pixel baseline for a design in flux is a full-time job".
 *
 * Those two answers together are the whole design of this file, and they are easy to collapse
 * into the wrong thing. This is **recorded, not gated**: it saves a named set of screenshots and
 * builds a page that puts two sets side by side for a human to look at. It computes no
 * difference, it has no threshold, and it cannot fail. A pixel gate over a design being actively
 * redrawn produces a red build on every intentional change, which trains everyone to approve the
 * diff without reading it — worse than no record at all, because it looks like review happened.
 *
 * What it is for: finishing a phase, saving the set, doing the work, and then seeing all
 * twenty-four screens before and after on one page instead of remembering what they looked like.
 * That is what §7.6's review rounds need and what nobody has had so far.
 *
 *   npm run shots                       # writes .shots/*.png
 *   npm run shots:save -- phase-6       # keeps that set as a named baseline
 *   …do the work, npm run shots again…
 *   npm run shots:compare -- phase-6    # .shots/compare.html, baseline vs current
 *
 * Baselines live in `.shots/_baselines/<label>/`, and `.shots/` is gitignored — these are a
 * local review aid, not an artefact anybody else needs.
 */
import fs from "node:fs";
import path from "node:path";

const OUT = process.env.SHOTS_OUT ?? ".shots";
const BASELINES = path.join(OUT, "_baselines");

const [command, label] = process.argv.slice(2);

/** Every screenshot in a directory, by filename. PNGs only — the resume PDFs are not pictures. */
function shotsIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".png"))
    .sort();
}

function save(name) {
  if (!name) {
    console.error("A label is required: npm run shots:save -- <label>");
    process.exitCode = 1;
    return;
  }

  const shots = shotsIn(OUT);
  if (shots.length === 0) {
    console.error(`No screenshots in ${OUT}/. Run \`npm run shots\` first.`);
    process.exitCode = 1;
    return;
  }

  const target = path.join(BASELINES, name);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  for (const shot of shots) fs.copyFileSync(path.join(OUT, shot), path.join(target, shot));

  console.log(`Saved ${shots.length} screenshots as "${name}".`);
}

function compare(name) {
  if (!name) {
    const saved = fs.existsSync(BASELINES) ? fs.readdirSync(BASELINES) : [];
    console.error("A baseline is required: npm run shots:compare -- <label>");
    console.error(saved.length > 0 ? `Saved: ${saved.join(", ")}` : "No baselines saved yet.");
    process.exitCode = 1;
    return;
  }

  const before = path.join(BASELINES, name);
  if (!fs.existsSync(before)) {
    console.error(`No baseline called "${name}" in ${BASELINES}/.`);
    process.exitCode = 1;
    return;
  }

  const baseline = shotsIn(before);
  const current = shotsIn(OUT);
  const all = [...new Set([...baseline, ...current])].sort();

  // Three states, each of which is a different thing to look at: a screen that changed, a screen
  // that is new since the baseline, and a screen that has gone. The third is the one a pixel
  // diff would say nothing about and is usually the most interesting — a route that stopped
  // rendering does not produce a different picture, it produces no picture.
  const rows = all.map((shot) => ({
    shot,
    inBefore: baseline.includes(shot),
    inAfter: current.includes(shot),
  }));

  const added = rows.filter((r) => !r.inBefore).length;
  const removed = rows.filter((r) => !r.inAfter).length;

  const cell = (present, src, side) =>
    present
      ? `<img loading="lazy" src="${src}" alt="${side}">`
      : `<p class="missing">not in ${side}</p>`;

  const html = `<!doctype html>
<meta charset="utf-8">
<title>${name} → current</title>
<style>
  :root { color-scheme: dark; --ink: #f2f2f2; --dim: #9a9a9a; --line: #2a2a2a; --bg: #101010; }
  body { margin: 0; padding: 2rem; background: var(--bg); color: var(--ink);
         font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 1.25rem; margin: 0 0 .25rem; }
  .lede { color: var(--dim); margin: 0 0 2rem; max-width: 60ch; }
  section { border-top: 1px solid var(--line); padding: 1.5rem 0; }
  h2 { font: 600 .8rem/1 ui-monospace, monospace; letter-spacing: .08em;
       text-transform: uppercase; color: var(--dim); margin: 0 0 .75rem; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
  figure { margin: 0; }
  figcaption { font: .7rem/1 ui-monospace, monospace; color: var(--dim); margin-bottom: .4rem; }
  img { width: 100%; height: auto; display: block; border: 1px solid var(--line); border-radius: 6px; }
  .missing { color: var(--dim); font-style: italic; border: 1px dashed var(--line);
             border-radius: 6px; padding: 2rem; text-align: center; margin: 0; }
  @media (max-width: 60rem) { .pair { grid-template-columns: 1fr; } }
</style>

<h1>${name} → current</h1>
<p class="lede">
  ${rows.length} screens. ${added} new since the baseline, ${removed} gone.
  Nothing here is measured — this is the record, not a gate (Q465). Look at it.
</p>

${rows
  .map(
    (r) => `<section>
  <h2>${r.shot.replace(/\.png$/, "")}</h2>
  <div class="pair">
    <figure>
      <figcaption>${name}</figcaption>
      ${cell(r.inBefore, `_baselines/${name}/${r.shot}`, name)}
    </figure>
    <figure>
      <figcaption>current</figcaption>
      ${cell(r.inAfter, r.shot, "current")}
    </figure>
  </div>
</section>`,
  )
  .join("\n")}
`;

  const file = path.join(OUT, "compare.html");
  fs.writeFileSync(file, html, "utf8");
  console.log(`${rows.length} screens (${added} new, ${removed} gone) → ${file}`);
}

if (command === "save") save(label);
else if (command === "compare") compare(label);
else {
  console.error("Usage:");
  console.error("  npm run shots:save -- <label>       keep the current .shots as a baseline");
  console.error("  npm run shots:compare -- <label>    build .shots/compare.html against it");
  process.exitCode = 1;
}
