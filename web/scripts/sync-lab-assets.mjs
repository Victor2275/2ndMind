/**
 * Copy lab figures from the vault into public/ so Next can serve them.
 *
 * The vault is the source of truth and lives outside the app, so its assets are not
 * importable at runtime. Rather than duplicating 2 MB of PNGs into git, they are copied
 * on predev/prebuild and public/labs is gitignored.
 *
 * Idempotent: files are skipped when size and mtime already match.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "..", "context", "assets", "labs");
const DEST = path.join(here, "..", "public", "labs");

if (!fs.existsSync(SRC)) {
  console.error(`sync-lab-assets: vault assets not found at ${SRC}`);
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });

let copied = 0;
let skipped = 0;

for (const name of fs.readdirSync(SRC)) {
  if (!/\.(png|jpe?g|webp|svg)$/i.test(name)) continue;

  const from = path.join(SRC, name);
  const to = path.join(DEST, name);
  const src = fs.statSync(from);
  const dst = fs.existsSync(to) ? fs.statSync(to) : null;

  if (dst && dst.size === src.size && dst.mtimeMs >= src.mtimeMs) {
    skipped += 1;
    continue;
  }
  fs.copyFileSync(from, to);
  copied += 1;
}

console.log(`sync-lab-assets: ${copied} copied, ${skipped} up to date -> public/labs`);
