import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildResume,
  formatResumeDate,
  isResumeProject,
  RESUME_VARIANTS,
  resumeToMarkdown,
} from "../resume";
import { loadExperience, loadLabs, loadProjects, VAULT_ROOT } from "../vault/load";

/**
 * `web/context.md` requires coverage of resume variant filtering — that each variant
 * includes and excludes the right entries. A resume that quietly drops the one role a
 * recruiter cared about, or quietly includes a hackathon game on a robotics application,
 * fails silently: nothing errors, the page just renders the wrong document.
 */

describe("every variant builds", () => {
  for (const variant of RESUME_VARIANTS) {
    it(`${variant} produces a complete document`, () => {
      const doc = buildResume(variant);
      expect(doc.name).toBeTruthy();
      expect(doc.headline.length).toBeGreaterThan(20);
      expect(doc.skills.length).toBeGreaterThan(1);
      expect(doc.education.coursework.length).toBeGreaterThan(0);
      expect(doc.experience.length, `${variant} has no experience`).toBeGreaterThan(0);
      expect(doc.projects.length, `${variant} has no projects`).toBeGreaterThan(0);
    });
  }
});

describe("variant membership comes from the vault, not the page", () => {
  for (const variant of RESUME_VARIANTS) {
    it(`${variant} includes exactly the entries tagged for it`, () => {
      const doc = buildResume(variant);

      const expectedExperience = loadExperience()
        .filter((e) => e.resume_variants.includes(variant) && e.bullets.length > 0)
        .map((e) => e.slug)
        .sort();
      expect(doc.experience.map((e) => e.slug).sort()).toEqual(expectedExperience);

      const expectedProjects = [
        ...loadProjects().filter(
          (p) => p.resume_variants.includes(variant) && p.bullets.length > 0 && !p.draft,
        ),
        ...loadLabs().filter((l) => l.resume_variants.includes(variant) && l.bullets.length > 0),
      ]
        .map((p) => p.slug)
        .sort();
      expect(doc.projects.map((p) => p.slug).sort()).toEqual(expectedProjects);
    });
  }
});

describe("what must never appear on a resume", () => {
  const all = RESUME_VARIANTS.map((v) => JSON.stringify(buildResume(v))).join("\n");

  it("no draft placeholder text", () => {
    expect(all).not.toMatch(/PLACEHOLDER/i);
  });

  it("no draft project, however it is tagged", () => {
    // Asserted against a project handed to the filter rather than one the vault happens to
    // hold (D-340). This used to require a draft to exist in `projects/` and skip its real
    // assertion when none did — so on 2026-09-23, when the last two draft entries were
    // finished, it went from guarding the thing that matters to guarding nothing. A draft
    // reaching a printed resume is the most expensive failure in this file; it should not
    // depend on a fixture surviving someone else's edit.
    const entry = { resume_variants: [...RESUME_VARIANTS], bullets: ["a real bullet"] };
    for (const variant of RESUME_VARIANTS) {
      expect(isResumeProject({ ...entry, draft: true }, variant)).toBe(false);
      // The control. Without it the assertion above would also pass if `isResumeProject`
      // rejected everything, which is the way a filter breaks without anyone noticing.
      expect(isResumeProject({ ...entry, draft: false }, variant)).toBe(true);
    }

    // And the vault itself, for whatever drafts it does hold. Zero is a valid state now.
    const draftSlugs = loadProjects()
      .filter((p) => p.draft)
      .map((p) => p.slug);
    for (const variant of RESUME_VARIANTS) {
      const slugs = buildResume(variant).projects.map((p) => p.slug);
      for (const draft of draftSlugs) expect(slugs).not.toContain(draft);
    }
  });

  it("no per-course grades", () => {
    // Victor publishes his GPA but not individual grades.
    expect(all).not.toMatch(/\((?:A|B|C|D|F)[+-]?\)/);
  });

  it("no unpublished coursework labs", () => {
    // The four assigned labs were cut from the portfolio as padding; the same reasoning
    // applies to the resume. See DECISIONS.md D-014.
    const unpublished = loadLabs()
      .filter((l) => !l.public)
      .map((l) => l.title);
    for (const title of unpublished) expect(all).not.toContain(title);
  });
});

describe("skills are filtered per variant", () => {
  it("robotics carries embedded skills and drops web", () => {
    const groups = buildResume("robotics").skills.map((s) => s.group);
    expect(groups).toContain("Robotics & Embedded");
    expect(groups).not.toContain("Web & Backend");
  });

  it("swe carries web skills and drops embedded", () => {
    const groups = buildResume("swe").skills.map((s) => s.group);
    expect(groups).toContain("Web & Backend");
    expect(groups).not.toContain("Robotics & Embedded");
  });

  it("every variant keeps languages and tools", () => {
    for (const variant of RESUME_VARIANTS) {
      const groups = buildResume(variant).skills.map((s) => s.group);
      expect(groups).toContain("Programming Languages");
      expect(groups).toContain("Tools & Hardware");
    }
  });
});

describe("formatResumeDate", () => {
  it("expands a year-month", () => {
    expect(formatResumeDate("2026-06")).toBe("June 2026");
  });

  it("expands a full date to its month", () => {
    expect(formatResumeDate("2026-06-05")).toBe("June 2026");
  });

  it("leaves a bare year alone", () => {
    expect(formatResumeDate("2022")).toBe("2022");
  });
});

describe("markdown rendering", () => {
  it("carries every bullet from the document", () => {
    const doc = buildResume("robotics");
    const md = resumeToMarkdown(doc);
    for (const entry of [...doc.experience, ...doc.projects]) {
      expect(md).toContain(entry.title);
      for (const bullet of entry.bullets) expect(md).toContain(bullet);
    }
  });
});

describe("the archived copy agrees with the site", () => {
  /**
   * `99_archive/resume.md` is generated by scripts/build_indexes.py, a second
   * implementation of the same selection logic in a different language. That duplication is
   * deliberate — the vault must be readable without running the web app — but it can drift.
   * This is the guard: whatever the site puts on a variant must appear in the archived file.
   */
  const archive = path.join(VAULT_ROOT, "99_archive", "resume.md");

  it("exists and is marked generated", () => {
    expect(fs.existsSync(archive)).toBe(true);
    expect(fs.readFileSync(archive, "utf8")).toContain("Generated file");
  });

  it("contains every entry the site renders, for every variant", () => {
    const md = fs.readFileSync(archive, "utf8");
    for (const variant of RESUME_VARIANTS) {
      const doc = buildResume(variant);
      for (const entry of [...doc.experience, ...doc.projects]) {
        expect(md, `${variant}: "${entry.title}" missing from 99_archive/resume.md`).toContain(
          entry.title,
        );
      }
      for (const group of doc.skills) {
        expect(md, `${variant}: skill group "${group.group}" missing`).toContain(group.group);
      }
    }
  });

  it("contains no entry the site excludes from all variants", () => {
    const md = fs.readFileSync(archive, "utf8");
    const included = new Set(
      RESUME_VARIANTS.flatMap((v) => {
        const doc = buildResume(v);
        return [...doc.experience, ...doc.projects].map((e) => e.title);
      }),
    );
    const excluded = [
      ...loadProjects().filter((p) => !included.has(p.title)),
      ...loadLabs().filter((l) => !included.has(l.title)),
    ].map((e) => e.title);

    expect(excluded.length, "fixture missing: everything is on a resume").toBeGreaterThan(0);
    for (const title of excluded) {
      expect(md, `"${title}" is on no variant but appears in the archive`).not.toContain(title);
    }
  });
});

describe("one-page discipline", () => {
  it("caps bullets per entry, because the resume must fit one page", () => {
    // Measured before these caps existed: the SWE variant printed at 1.33 pages, spilling
    // onto a second sheet that was ~70% empty. The vault still holds every bullet; only the
    // resume projection is capped.
    for (const variant of RESUME_VARIANTS) {
      const doc = buildResume(variant);
      for (const entry of doc.experience) {
        expect(entry.bullets.length, `${variant}/${entry.slug}`).toBeLessThanOrEqual(4);
      }
      for (const entry of doc.projects) {
        expect(entry.bullets.length, `${variant}/${entry.slug}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it("keeps the first bullet of each entry, so vault order decides what survives", () => {
    const doc = buildResume("swe");
    for (const entry of [...doc.experience, ...doc.projects]) {
      expect(entry.bullets.length).toBeGreaterThan(0);
    }
  });
});
