import { describe, expect, it } from "vitest";

import { loadExperience, loadLabs, loadProjects } from "../load";
import type { ResumeVariant } from "../schemas";

/**
 * Integration tests against the real vault at ../context. These are the tests that catch
 * a hand-edited entry file breaking the site, which is the failure mode that actually
 * matters here — the vault is edited far more often than this code is.
 */

const VARIANTS: ResumeVariant[] = ["robotics", "ml", "swe"];

describe("the real vault loads", () => {
  it("parses every project", () => {
    const projects = loadProjects();
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.map((p) => p.slug)).toContain("proof");
  });

  it("parses every role", () => {
    const experience = loadExperience();
    expect(experience.map((e) => e.slug)).toContain("dimaag");
  });

  it("parses every lab", () => {
    // Four coursework labs, all public: false. The solenoid bit reader was promoted to a
    // project (see DECISIONS.md D-014) because it is a self-directed build, not an
    // assigned experiment. The other four stay in the vault as academic record.
    const labs = loadLabs();
    expect(labs.length).toBe(4);
    expect(labs.every((l) => !l.public)).toBe(true);
  });

  it("keeps the solenoid bit reader as a project", () => {
    const project = loadProjects().find((p) => p.slug === "solenoid-bit-reader");
    expect(project, "solenoid was promoted to projects/ and must still parse").toBeTruthy();
    expect(project?.figure_count).toBeGreaterThan(1);
    expect(project?.resume_variants).toContain("robotics");
  });
});

describe("draft entries", () => {
  it("never carry resume variants", () => {
    // Drafts render on the site so layout can be reviewed, but a resume bullet reading
    // PLACEHOLDER reaches a recruiter exactly once. See DECISIONS.md D-014.
    for (const p of loadProjects().filter((p) => p.draft)) {
      expect(p.resume_variants, `${p.slug} is a draft with resume variants`).toEqual([]);
    }
  });

  it("are the only projects allowed to say PLACEHOLDER", () => {
    for (const p of loadProjects().filter((p) => !p.draft)) {
      const text = [p.summary, ...p.bullets, p.body].join(" ");
      expect(text, `${p.slug} contains placeholder text but is not marked draft`).not.toMatch(
        /PLACEHOLDER/i,
      );
    }
  });
});

describe("vault invariants", () => {
  it("has unique slugs within each collection", () => {
    for (const load of [loadProjects, loadExperience, loadLabs]) {
      const slugs = load().map((e) => e.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("sorts projects by tier, then newest first", () => {
    const projects = loadProjects();
    for (let i = 1; i < projects.length; i++) {
      const prev = projects[i - 1];
      const cur = projects[i];
      expect(prev.tier <= cur.tier).toBe(true);
      if (prev.tier === cur.tier) expect(prev.year >= cur.year).toBe(true);
    }
  });

  it("sorts experience newest first", () => {
    const experience = loadExperience();
    for (let i = 1; i < experience.length; i++) {
      expect(
        experience[i - 1].date_start.localeCompare(experience[i].date_start),
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it("never ends a role before it starts", () => {
    for (const e of loadExperience()) {
      expect(e.date_end.localeCompare(e.date_start)).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives every entry tagged for a resume at least one bullet", () => {
    // An entry on a CV with no bullets renders as a bare heading. Catch it here.
    const all = [...loadProjects(), ...loadExperience(), ...loadLabs()];
    const offenders = all
      .filter((e) => e.resume_variants.length > 0 && e.bullets.length === 0)
      .map((e) => e.slug);
    expect(offenders).toEqual([]);
  });

  it("produces a non-empty resume for each variant", () => {
    const all = [...loadProjects(), ...loadExperience(), ...loadLabs()];
    for (const v of VARIANTS) {
      const hits = all.filter((e) => e.resume_variants.includes(v));
      expect(hits.length, `variant "${v}" has no entries`).toBeGreaterThan(0);
    }
  });

  it("records collaborators on every lab, since they are group work", () => {
    for (const lab of loadLabs()) {
      expect(lab.collaborators.length, `${lab.slug} has no collaborators`).toBeGreaterThan(0);
    }
  });

  it("keeps the Dimaag confidentiality boundary machine-readable", () => {
    const dimaag = loadExperience().find((e) => e.slug === "dimaag");
    expect(dimaag?.confidential_scope).toBeTruthy();
  });
});
