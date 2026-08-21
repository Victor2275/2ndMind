import { describe, expect, it } from "vitest";

import { parseEntry, splitSections, VaultParseError } from "../parse";
import { experienceSchema, labSchema, projectSchema } from "../schemas";

const validProject = `---
updated: 2026-08-20
domain: engineering
stability: stable
summary: A test project.
read_when: Testing.
title: Test Project
slug: test-project
tier: 1
status: active
year: 2026
category: software
tags: [web]
stack: [React]
resume_variants: [swe]
public: true
bullets:
  - Did a thing
---

# Test Project

## Architecture

It has one.
`;

describe("parseEntry", () => {
  it("parses a valid project and attaches the body", () => {
    const p = parseEntry(validProject, projectSchema, "test.md");
    expect(p.title).toBe("Test Project");
    expect(p.bullets).toEqual(["Did a thing"]);
    expect(p.body).toContain("## Architecture");
  });

  it("normalises a YAML Date back to an ISO string", () => {
    // gray-matter's js-yaml turns a bare 2026-08-20 into a Date object.
    const p = parseEntry(validProject, projectSchema, "test.md");
    expect(p.updated).toBe("2026-08-20");
    expect(typeof p.updated).toBe("string");
  });

  it("accepts year, year-month, and full dates for experience", () => {
    const make = (start: string, end: string) => `---
updated: 2026-08-20
domain: engineering
stability: stable
summary: A role.
read_when: Testing.
title: Role
slug: role
org: Somewhere
type: other
date_start: ${start}
date_end: ${end}
resume_variants: []
public: true
bullets: []
---
Body.
`;
    expect(parseEntry(make("2022", "2025"), experienceSchema, "a").date_start).toBe("2022");
    expect(parseEntry(make("2026-06", "2026-08"), experienceSchema, "b").date_end).toBe("2026-08");
    expect(parseEntry(make("2026-06-01", "2026-08-31"), experienceSchema, "c").date_start).toBe(
      "2026-06-01",
    );
  });

  it("rejects a missing required field and names it", () => {
    const broken = validProject.replace("status: active\n", "");
    expect(() => parseEntry(broken, projectSchema, "broken.md")).toThrow(VaultParseError);
    try {
      parseEntry(broken, projectSchema, "broken.md");
    } catch (e) {
      expect((e as VaultParseError).issues.join()).toContain("status");
    }
  });

  it("rejects a non-kebab-case slug", () => {
    const broken = validProject.replace("slug: test-project", "slug: Test_Project");
    expect(() => parseEntry(broken, projectSchema, "broken.md")).toThrow(/kebab-case/);
  });

  it("rejects an unknown resume variant", () => {
    const broken = validProject.replace("resume_variants: [swe]", "resume_variants: [devops]");
    expect(() => parseEntry(broken, projectSchema, "broken.md")).toThrow(VaultParseError);
  });

  it("rejects an empty body", () => {
    const broken = validProject.split("---")[1];
    expect(() => parseEntry(`---${broken}---\n\n`, projectSchema, "broken.md")).toThrow(
      /body is empty/,
    );
  });

  it("rejects a malformed link URL", () => {
    const broken = validProject.replace(
      "public: true",
      "public: true\nlinks:\n  github: not-a-url",
    );
    expect(() => parseEntry(broken, projectSchema, "broken.md")).toThrow(VaultParseError);
  });

  it("requires image_count on a lab", () => {
    const broken = validProject.replace("tier: 1", "tier: 1");
    expect(() => parseEntry(broken, labSchema, "broken.md")).toThrow(VaultParseError);
  });
});

describe("splitSections", () => {
  it("keys sections by lowercased heading", () => {
    const s = splitSections("Intro text.\n\n## Architecture\n\nA.\n\n## Post-mortem\n\nB.");
    expect(s.preamble).toBe("Intro text.");
    expect(s.architecture).toBe("A.");
    expect(s["post-mortem"]).toBe("B.");
  });

  it("handles a body with no headings", () => {
    expect(splitSections("Just prose.")).toEqual({ preamble: "Just prose." });
  });
});
