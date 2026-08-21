import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadExperience } from "../load";
import {
  labFigures,
  PROJECT_CARD_KEYS,
  projectCards,
  PUBLIC_EXPERIENCE_KEYS,
  PUBLIC_LAB_KEYS,
  PUBLIC_PROJECT_KEYS,
  publicExperience,
  publicLabs,
  publicProjects,
} from "../public";
import { VAULT_ROOT } from "../load";

/**
 * Security tests. These are not formalities.
 *
 * The public site is statically generated, so anything a public page reads is baked into
 * a world-readable bundle. These tests are the guard that a field added to the vault does
 * not silently reach it.
 */

describe("public projections expose exactly the allowlisted fields", () => {
  it("projects", () => {
    for (const p of publicProjects()) {
      expect(Object.keys(p).sort()).toEqual(
        PUBLIC_PROJECT_KEYS.filter((k) => k in p).sort(),
      );
    }
  });

  it("experience", () => {
    for (const e of publicExperience()) {
      expect(Object.keys(e).sort()).toEqual([...PUBLIC_EXPERIENCE_KEYS].sort());
    }
  });

  it("labs", () => {
    for (const l of publicLabs()) {
      expect(Object.keys(l).sort()).toEqual([...PUBLIC_LAB_KEYS].sort());
    }
  });
});

describe("private data never reaches a public projection", () => {
  const serialized = JSON.stringify({
    projects: publicProjects(),
    experience: publicExperience(),
    labs: publicLabs(),
  });

  it("drops the internal routing and housekeeping fields", () => {
    for (const key of [
      "resume_variants",
      "confidential_scope",
      "read_when",
      "stability",
      "updated",
      "report",
    ]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
  });

  it("does not carry the Dimaag confidentiality note into public output", () => {
    const dimaag = loadExperience().find((e) => e.slug === "dimaag");
    const scope = dimaag?.confidential_scope;
    expect(scope, "fixture missing: dimaag has no confidential_scope").toBeTruthy();
    // Match on a distinctive fragment; the full string is wrapped across lines in YAML.
    expect(serialized).not.toContain("remain confidential");
    expect(serialized).not.toContain("deliberately not recorded");
  });

  it("does not leak per-course grades or transcripts", () => {
    // Victor publishes his GPA but not per-course grades (question 18).
    expect(serialized).not.toContain("transcript");
    expect(serialized).not.toContain("Transcript");
    // A grade line in coursework looks like "(A-)" or "(B+)"; none should appear.
    expect(serialized).not.toMatch(/\((?:A|B|C|D|F)[+-]?\)/);
  });

  it("honours public: false if it is ever set", () => {
    // Nothing is private today; this asserts the filter is actually wired up so that
    // flipping the flag on an entry works the first time it is needed.
    const allSlugs = loadExperience().map((e) => e.slug);
    const publicSlugs = publicExperience().map((e) => e.slug);
    const privateSlugs = loadExperience().filter((e) => !e.public).map((e) => e.slug);
    expect(publicSlugs).toEqual(allSlugs.filter((s) => !privateSlugs.includes(s)));
  });
});

describe("public pages never import a private loader", () => {
  it("no file under src/app imports load.ts directly", () => {
    // Public routes must go through public.ts, which applies the allowlist.
    const appDir = path.join(process.cwd(), "src", "app");
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          if (/from ["'].*vault\/load["']/.test(src)) {
            offenders.push(path.relative(process.cwd(), full));
          }
        }
      }
    };
    walk(appDir);
    expect(offenders).toEqual([]);
  });

  it("the vault root resolves outside the web app", () => {
    expect(fs.existsSync(VAULT_ROOT)).toBe(true);
    expect(VAULT_ROOT).not.toContain(path.join("web", "context"));
  });
});

describe("lab figures", () => {
  it("derives the full figure set from the hero image and count", () => {
    expect(labFigures("solenoid_lab_image1.png", 3)).toEqual([
      "solenoid_lab_image1.png",
      "solenoid_lab_image2.png",
      "solenoid_lab_image3.png",
    ]);
  });

  it("falls back to the hero image when the name has no index", () => {
    expect(labFigures("cover.png", 5)).toEqual(["cover.png"]);
  });

  it("every derived figure exists in the vault assets directory", () => {
    // image_count is hand-entered in frontmatter; this catches a wrong number before it
    // renders as a broken image on the public site.
    const assets = path.join(VAULT_ROOT, "assets", "labs");
    const missing: string[] = [];
    for (const lab of publicLabs()) {
      for (const file of lab.figures) {
        if (!fs.existsSync(path.join(assets, file))) missing.push(`${lab.slug}: ${file}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("client component payload", () => {
  it("never hands a project body to the client grid", () => {
    // Anything passed to a Client Component is serialised into the RSC payload and shipped,
    // rendered or not. Bodies are large and belong only on the server-rendered deep dives.
    for (const card of projectCards()) {
      expect(card).not.toHaveProperty("body");
      expect(Object.keys(card).sort()).toEqual([...PROJECT_CARD_KEYS].sort());
    }
  });
});
