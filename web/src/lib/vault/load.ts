import "server-only";

import fs from "node:fs";
import path from "node:path";

import { parseEntry } from "./parse";
import {
  experienceSchema,
  labSchema,
  projectSchema,
  type Experience,
  type Lab,
  type Project,
} from "./schemas";

/**
 * Filesystem loaders. Server-only, and used at build time so the public site is fully
 * static. `server-only` makes an accidental client import a build error rather than a
 * runtime surprise that ships vault paths to the browser.
 */

/** The vault lives beside the app, not inside it: <repo>/context, <repo>/web. */
export const VAULT_ROOT = path.join(process.cwd(), "..", "context");
const ENG = path.join(VAULT_ROOT, "01_engineering");

function loadDir<T>(dir: string, schema: Parameters<typeof parseEntry<T>>[1]): (T & { body: string })[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`vault directory missing: ${dir}`);
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const entry = parseEntry(raw, schema, `${path.basename(dir)}/${f}`);
      const slug = (entry as { slug: string }).slug;
      if (slug !== f.replace(/\.md$/, "")) {
        throw new Error(`${dir}/${f}: slug "${slug}" does not match filename`);
      }
      return entry;
    });
}

export function loadProjects(): Project[] {
  return loadDir(path.join(ENG, "projects"), projectSchema).sort(
    (a, b) => a.tier - b.tier || b.year - a.year || a.title.localeCompare(b.title),
  );
}

export function loadExperience(): Experience[] {
  return loadDir(path.join(ENG, "experience"), experienceSchema).sort((a, b) =>
    b.date_start.localeCompare(a.date_start),
  );
}

export function loadLabs(): Lab[] {
  return loadDir(path.join(ENG, "labs"), labSchema).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}
