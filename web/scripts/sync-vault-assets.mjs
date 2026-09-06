/**
 * Copy vault images into public/ so Next can serve them.
 *
 * The vault is the source of truth and lives outside the app, so its assets are not importable
 * at runtime. Rather than duplicating megabytes of PNGs into git, they are copied on predev and
 * prebuild, and both destinations are gitignored.
 *
 * Two sources, because they are two different kinds of thing:
 *
 *   context/assets/labs/  ->  public/labs/     figures extracted from physics lab reports
 *   context/assets/       ->  public/assets/   project heroes and the profile photograph
 *
 * The second was added 2026-08-25. Top-level files only — `labs/` is handled by its own entry,
 * and recursing would copy it twice under two different URLs.
 *
 * Idempotent: files are skipped when size and mtime already match.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const vault = path.join(here, "..", "..", "context", "assets");
const publicDir = path.join(here, "..", "public");

const IMAGE_ONLY = /\.(png|jpe?g|webp|svg)$/i;
const PDF_ONLY = /\.pdf$/i;

const PAIRS = [
  {
    from: path.join(vault, "labs"),
    to: path.join(publicDir, "labs"),
    label: "public/labs",
    allow: IMAGE_ONLY,
  },
  { from: vault, to: path.join(publicDir, "assets"), label: "public/assets", allow: IMAGE_ONLY },
  // Resume PDFs (V3 §4.4, D-188). Its own pair with its own filter, rather than widening the
  // one above: everything under `context/assets/` becomes a public URL, and the file sitting
  // next to these in the vault is a university transcript. A per-folder allowlist means adding
  // a PDF to the wrong folder serves nothing rather than serving something private.
  {
    from: path.join(vault, "resumes"),
    to: path.join(publicDir, "assets", "resumes"),
    label: "public/assets/resumes",
    allow: PDF_ONLY,
  },
];

if (!fs.existsSync(vault)) {
  console.error(`sync-vault-assets: vault assets not found at ${vault}`);
  process.exit(1);
}

for (const pair of PAIRS) {
  if (!fs.existsSync(pair.from)) {
    console.log(`sync-vault-assets: ${pair.from} does not exist, skipped`);
    continue;
  }

  fs.mkdirSync(pair.to, { recursive: true });

  let copied = 0;
  let skipped = 0;

  for (const entry of fs.readdirSync(pair.from, { withFileTypes: true })) {
    // Directories are never followed. `labs/` is its own pair above, and a nested directory
    // copied here would be served from a second URL that nothing references.
    if (!entry.isFile() || !pair.allow.test(entry.name)) continue;

    const from = path.join(pair.from, entry.name);
    const to = path.join(pair.to, entry.name);
    const src = fs.statSync(from);
    const dst = fs.existsSync(to) ? fs.statSync(to) : null;

    if (dst && dst.size === src.size && dst.mtimeMs >= src.mtimeMs) {
      skipped += 1;
      continue;
    }
    fs.copyFileSync(from, to);
    copied += 1;
  }

  console.log(`sync-vault-assets: ${copied} copied, ${skipped} up to date -> ${pair.label}`);
}
