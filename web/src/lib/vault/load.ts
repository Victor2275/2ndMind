import "server-only";

import fs from "node:fs";
import path from "node:path";

import { parseEntry } from "./parse";
import {
  experienceSchema,
  labSchema,
  profileSchema,
  projectSchema,
  pursuitSchema,
  resumeConfigSchema,
  type Experience,
  type Lab,
  type Profile,
  type Project,
  type Pursuit,
  type ResumeConfig,
} from "./schemas";

/**
 * Filesystem loaders. Server-only, and used at build time so the public site is fully
 * static. `server-only` makes an accidental client import a build error rather than a
 * runtime surprise that ships vault paths to the browser.
 */

/** The vault lives beside the app, not inside it: <repo>/context, <repo>/web. */
export const VAULT_ROOT = path.join(process.cwd(), "..", "context");
const ENG = path.join(VAULT_ROOT, "01_engineering");

function loadDir<T extends { slug: string }>(
  dir: string,
  schema: Parameters<typeof parseEntry<T>>[1],
): (T & { body: string })[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`vault directory missing: ${dir}`);
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const entry = parseEntry(raw, schema, `${path.basename(dir)}/${f}`);
      if (entry.slug !== f.replace(/\.md$/, "")) {
        throw new Error(`${dir}/${f}: slug "${entry.slug}" does not match filename`);
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

export function loadPursuits(): Pursuit[] {
  const dir = path.join(VAULT_ROOT, "03_craft_and_creative", "pursuits");
  return loadDir(dir, pursuitSchema).sort((a, b) => a.order - b.order);
}

export function loadResumeConfig(): ResumeConfig {
  const file = path.join(ENG, "resume_config.md");
  return parseEntry(
    fs.readFileSync(file, "utf8"),
    resumeConfigSchema,
    "01_engineering/resume_config.md",
  );
}

export function loadProfile(): Profile {
  const file = path.join(VAULT_ROOT, "00_meta", "core_profile.md");
  return parseEntry(fs.readFileSync(file, "utf8"), profileSchema, "00_meta/core_profile.md");
}
