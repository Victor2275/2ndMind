import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadExperience, loadLabs, loadPursuits } from "../load";
import {
  labFigures,
  PROJECT_CARD_KEYS,
  projectCards,
  PUBLIC_EXPERIENCE_KEYS,
  PUBLIC_LAB_KEYS,
  dropUnwritten,
  PUBLIC_PROJECT_KEYS,
  PUBLIC_PURSUIT_KEYS,
  publicExperience,
  publicLabs,
  publicProjects,
  publicPursuits,
  stripInternalSections,
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
      expect(Object.keys(p).sort()).toEqual(PUBLIC_PROJECT_KEYS.filter((k) => k in p).sort());
    }
  });

  it("defaults imageFit to cover, and honours contain where the vault sets it", () => {
    // A square or portrait hero cropped to 16:9 loses its top and bottom. micromouse-simulator
    // is 606x649, which is why the field exists at all.
    const projects = publicProjects();
    const micromouse = projects.find((p) => p.slug === "micromouse-simulator");
    expect(micromouse?.imageFit).toBe("contain");

    for (const p of projects) {
      expect(["cover", "contain"]).toContain(p.imageFit);
    }
    // A project that does not set `image_fit` must come out as "cover", never undefined — the
    // render sites branch on it, and an undefined would take the cover path by accident rather
    // than by decision. five-second-rule is 1920x1080 artwork and deliberately omits the field.
    const fiveSecond = projects.find((p) => p.slug === "five-second-rule");
    expect(fiveSecond?.imageFit).toBe("cover");
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

  it("pursuits", () => {
    const pursuits = publicPursuits();
    expect(pursuits.length).toBeGreaterThan(0);
    for (const p of pursuits) {
      expect(Object.keys(p).sort()).toEqual([...PUBLIC_PURSUIT_KEYS].sort());
      // Bodies say which private file the framing came from. They stay in the repo.
      expect(p).not.toHaveProperty("body");
    }
  });
});

describe("health and training data never becomes public", () => {
  /**
   * The pursuits entries summarise files holding bodyweight, calorie and protein targets,
   * and a lower-back rehab protocol. Victor said he is comfortable storing health data in
   * the cloud; that is not the same as publishing it on a portfolio read by recruiters.
   * These assertions are the line between the two.
   */
  const serialized = JSON.stringify(publicPursuits());

  it("publishes no bodyweight, nutrition, or rehab detail", () => {
    for (const term of [
      "215",
      "lbs",
      "protein",
      "Protein",
      "creatine",
      "Creatine",
      "rehab",
      "Pallof",
      "glute",
      "hamstring",
      "psoas",
      "drag factor",
      "Drag Factor",
    ]) {
      expect(serialized, `"${term}" reached public pursuit output`).not.toContain(term);
    }
  });

  it("does not read the private training file to build the public section", () => {
    // Pursuits are their own vault entity precisely so the public path never opens
    // benchmarks_and_logs.md. If that ever changes, this is the test that should fail.
    const pursuitFiles = loadPursuits();
    expect(pursuitFiles.length).toBe(3);
    for (const p of pursuitFiles) {
      expect(p.carryover.length).toBeGreaterThan(20);
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

  it("never publishes a collaborator's name", () => {
    // The labs are group work and the vault records who Victor worked with, but those are
    // private individuals who did not agree to appear on a public portfolio. The names stay
    // in frontmatter for the record and are replaced by a group size on the site.
    const names = loadLabs().flatMap((l) => l.collaborators);
    expect(names.length, "fixture missing: no lab records collaborators").toBeGreaterThan(0);
    for (const name of new Set(names)) {
      expect(serialized, `collaborator name "${name}" reached public output`).not.toContain(name);
    }
  });

  it("strips the internal Notes section out of every body", () => {
    // `## Notes` holds relative links into 99_archive and reminders to self. Bodies render
    // verbatim, so anything left there is published.
    expect(serialized).not.toContain("99_archive");
    expect(serialized).not.toContain("## Notes");
  });
});

describe("stripInternalSections", () => {
  it("removes a Notes section and everything under it", () => {
    const body = "## Abstract\nReal content.\n\n## Notes\nInternal pointer.\n";
    expect(stripInternalSections(body)).toBe("## Abstract\nReal content.");
  });

  it("keeps sections that follow Notes", () => {
    const body = "## Notes\nInternal.\n\n## Results\nPublished.\n";
    // No leading blank line any more: dropUnwritten reassembles the body from blocks, which
    // also tidies the gap the removed Notes section used to leave behind.
    expect(stripInternalSections(body)).toBe("## Results\nPublished.");
  });

  it("leaves a body with no Notes section untouched", () => {
    const body = "## Abstract\nOnly this.";
    expect(stripInternalSections(body)).toBe(body);
  });
});

describe("public projection odds and ends", () => {
  it("honours public: false if it is ever set", () => {
    // Nothing is private today; this asserts the filter is actually wired up so that
    // flipping the flag on an entry works the first time it is needed.
    const allSlugs = loadExperience().map((e) => e.slug);
    const publicSlugs = publicExperience().map((e) => e.slug);
    const privateSlugs = loadExperience()
      .filter((e) => !e.public)
      .map((e) => e.slug);
    expect(publicSlugs).toEqual(allSlugs.filter((s) => !privateSlugs.includes(s)));
  });

  it("never publishes an Updates section as raw body markdown", () => {
    // The projection splits updates out into data. If that ever stops happening, the section
    // renders twice — once as markdown under a heading, once as dated entries on /now.
    for (const p of publicProjects()) {
      expect(p.body).not.toMatch(/^##[ \t]+Updates[ \t]*$/im);
      expect(Array.isArray(p.updates)).toBe(true);
    }
  });

  it("keeps updates off the client grid", () => {
    // Same reason as `body`: the grid is a Client Component, so anything on the card is
    // serialised and shipped whether it is rendered or not.
    for (const card of projectCards()) {
      expect(card).not.toHaveProperty("updates");
    }
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

  it("every project figure exists in web/public", () => {
    // figure_count is hand-entered in frontmatter. This catches a wrong number before it
    // renders as a broken image on the public site. Paths are /public-relative, and the
    // lab assets get there via scripts/sync-lab-assets.mjs on predev/prebuild.
    const pub = path.join(process.cwd(), "public");
    const missing: string[] = [];
    let checked = 0;
    for (const project of publicProjects()) {
      for (const file of project.figures) {
        checked++;
        if (!fs.existsSync(path.join(pub, file))) missing.push(`${project.slug}: ${file}`);
      }
    }
    expect(checked, "no project declares figures — this test would pass vacuously").toBeGreaterThan(
      0,
    );
    expect(missing).toEqual([]);
  });
});

describe("client component payload", () => {
  it("never hands a project body to the client grid", () => {
    // Anything passed to a Client Component is serialised into the RSC payload and shipped,
    // rendered or not. Bodies are large and belong only on the server-rendered deep dives.
    for (const card of projectCards()) {
      expect(card).not.toHaveProperty("body");
      // `image` is optional — absent means the card draws a generated placeholder.
      expect(Object.keys(card).sort()).toEqual(PROJECT_CARD_KEYS.filter((k) => k in card).sort());
    }
  });
});

describe("dropUnwritten", () => {
  const crlf = (lines: string[]) => lines.join("\r\n");

  it("removes a prompt line but keeps the prose beside it", () => {
    const out = dropUnwritten(
      crlf([
        "## The problem",
        "",
        "> **To write:** what made this hard?",
        "",
        "The encoder drifted under load.",
      ]),
    );
    expect(out).toContain("## The problem");
    expect(out).toContain("The encoder drifted under load.");
    expect(out).not.toContain("To write");
  });

  it("removes a heading that has only a prompt under it", () => {
    // The important case. An empty "## Measured results" advertises a gap; a published
    // prompt asking Victor a question is worse still.
    const out = dropUnwritten(crlf(["## Measured results", "", "> **To write:** one number.", ""]));
    expect(out).toBe("");
  });

  it("keeps written sections while dropping unwritten neighbours", () => {
    const out = dropUnwritten(
      crlf([
        "Intro paragraph.",
        "",
        "## Architecture",
        "",
        "An ESP32 reads the coil.",
        "",
        "## What did not work",
        "",
        "> **To write:** which approach was abandoned?",
      ]),
    );
    expect(out).toContain("Intro paragraph.");
    expect(out).toContain("## Architecture");
    expect(out).not.toContain("What did not work");
  });

  it("leaves a body with no prompts unchanged in substance", () => {
    const body = crlf(["## Architecture", "", "Details here."]);
    expect(dropUnwritten(body)).toContain("Details here.");
    expect(dropUnwritten(body)).toContain("## Architecture");
  });

  it("handles LF as well as CRLF", () => {
    const out = dropUnwritten("## Results\n\n> **To write:** a number.\n");
    expect(out).toBe("");
  });
});

describe("no prompt ever reaches a public page", () => {
  it("holds across every real project and experience entry", () => {
    for (const project of publicProjects()) {
      expect(project.body, project.slug).not.toMatch(/To write/i);
    }
    for (const role of publicExperience()) {
      expect(role.body, role.slug).not.toMatch(/To write/i);
    }
  });
});

describe("a prompt runs to the end of its blockquote", () => {
  const crlf = (lines: string[]) => lines.join("\r\n");

  it("drops wrapped prompt lines, not just the first", () => {
    // The bug this pins: TO_WRITE matched only the opening line, so the continuation of the
    // quote was published as if it were Victor's prose.
    const out = dropUnwritten(
      crlf([
        "## What did not work",
        "",
        "> **To write:** what did you try first and abandon, and why? Almost no student",
        "> portfolio has this section, which is exactly why it is convincing to an engineer.",
        "",
      ]),
    );
    expect(out).toBe("");
    expect(out).not.toContain("convincing to an engineer");
  });

  it("ends the prompt at the first line that is not part of the quote", () => {
    const out = dropUnwritten(
      crlf([
        "## Architecture",
        "",
        "> **To write:** the components.",
        "> and how they talk.",
        "",
        "Real prose that Victor wrote.",
      ]),
    );
    expect(out).toContain("## Architecture");
    expect(out).toContain("Real prose that Victor wrote.");
    expect(out).not.toContain("how they talk");
  });
});
