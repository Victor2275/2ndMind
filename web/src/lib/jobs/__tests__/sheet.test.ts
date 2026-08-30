import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isHighPriority, isOpen, isSubmitted, parseJobSheet, toPipeline } from "../sheet";

/**
 * Parsed against Victor's real export, not a hand-written fixture.
 *
 * The snapshot in `context/99_archive/` is 179 rows of the actual tracker, which is the only
 * way to find out that 173 of them say "No Application" — the fact that decides what the page
 * can usefully show. A fixture I invented would have had a tidy spread of statuses and would
 * have proved nothing about the sheet.
 *
 * It is a fixture, never a fallback: nothing at runtime reads this file. Serving a months-old
 * snapshot as though it were current is worse than saying the sheet is unreachable.
 */

const SNAPSHOT = path.join(
  process.cwd(),
  "..",
  "context",
  "99_archive",
  "Internship Applications Tracker - All Postings.csv",
);

const real = fs.readFileSync(SNAPSHOT, "utf8");

describe("parsing the real export", () => {
  it("reads every row", () => {
    const { applications, skipped } = parseJobSheet(real);
    expect(applications).toHaveLength(179);
    expect(skipped).toBe(0);
  });

  it("reads the first row correctly, field by field", () => {
    const { applications } = parseJobSheet(real);
    expect(applications[0]).toMatchObject({
      company: "Atoms",
      role: "Software Engineer Intern (Physical AI & Robotics)",
      location: "San Francisco, CA",
      status: "Pending",
      priority: "High Priority",
      compensation: "$70/hr",
      published: "2026-08-01",
      added: "2026-08-13",
    });
  });

  it("keeps a quoted comma inside its field", () => {
    // "San Francisco, CA" is one value. A naive split on commas shifts every later column,
    // and the symptom is a status column full of state abbreviations.
    const { applications } = parseJobSheet(real);
    expect(applications.every((a) => !a.status.includes(","))).toBe(true);
  });

  it("finds the statuses that actually exist", () => {
    const { applications } = parseJobSheet(real);
    const statuses = new Set(applications.map((a) => a.status));
    expect(statuses).toEqual(new Set(["No Application", "Pending", "Rejected"]));
  });
});

describe("header tolerance", () => {
  it("matches columns regardless of spacing, case and punctuation", () => {
    // The sheet is edited by hand. "Domain / Focus" has spaces around the slash; a header
    // renamed to "Domain/Focus" must not silently blank the column.
    const csv = [
      "COMPANY , role,Domain/Focus,Application  Link",
      "Acme,Intern,Robotics,https://example.com",
    ].join("\n");
    const { applications } = parseJobSheet(csv);
    expect(applications[0]).toMatchObject({
      company: "Acme",
      role: "Intern",
      focus: "Robotics",
      link: "https://example.com",
    });
  });

  it("survives a UTF-8 BOM", () => {
    // Google writes one. Left in place it becomes part of the first header name, so every
    // lookup on that column misses and the company is blank on every row.
    const { applications } = parseJobSheet("﻿Company,Role\nAcme,Intern");
    expect(applications[0].company).toBe("Acme");
  });

  it("leaves a missing column blank rather than throwing", () => {
    const { applications } = parseJobSheet("Company,Role\nAcme,Intern");
    expect(applications[0].compensation).toBe("");
    expect(applications[0].status).toBe("");
  });

  it("blanks a date it cannot read rather than guessing the format", () => {
    // "08/13/2026" is ambiguous between US and everywhere else. Guessing wrong misdates a row
    // by up to eleven months and nothing would look wrong.
    const { applications } = parseJobSheet("Company,Date Added\nAcme,08/13/2026");
    expect(applications[0].added).toBe("");
  });

  it("counts a row that has content but no company or role as skipped", () => {
    // Wholly blank lines never reach this code — papaparse's `skipEmptyLines: "greedy"` drops
    // them first. What this catches is a real row that lost its identifying columns: a stray
    // note, or a header repeated mid-file. Counted rather than dropped silently, so
    // "179 rows, 40 skipped" is a visible signal that something about the sheet changed.
    const { applications, skipped } = parseJobSheet(
      "Company,Role,Notes\nAcme,Intern,\n,,see the other tab\n,,ignore this row",
    );
    expect(applications).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it("returns nothing for an empty file rather than throwing", () => {
    expect(parseJobSheet("").applications).toEqual([]);
  });
});

describe("status predicates", () => {
  const of = (status: string, priority = "") =>
    parseJobSheet(`Company,Status,Priority\nAcme,${status},${priority}`).applications[0];

  it("treats the tracker's not-yet states as not submitted", () => {
    expect(isSubmitted(of("No Application"))).toBe(false);
    expect(isSubmitted(of("no application"))).toBe(false);
    expect(isSubmitted(of(""))).toBe(false);
  });

  it("treats anything else as submitted", () => {
    expect(isSubmitted(of("Pending"))).toBe(true);
    expect(isSubmitted(of("Rejected"))).toBe(true);
    expect(isSubmitted(of("Interview"))).toBe(true);
  });

  it("counts a rejection as submitted but not open", () => {
    // Both are true and they are different questions: "how many did I send" and "how many are
    // still live". Conflating them would report a closed pipeline as an active one.
    expect(isSubmitted(of("Rejected"))).toBe(true);
    expect(isOpen(of("Rejected"))).toBe(false);
    expect(isOpen(of("Pending"))).toBe(true);
  });

  it("reads priority case-insensitively", () => {
    expect(isHighPriority(of("Pending", "High Priority"))).toBe(true);
    expect(isHighPriority(of("Pending", "high priority"))).toBe(true);
    expect(isHighPriority(of("Pending", "Low Priority"))).toBe(false);
  });
});

describe("the pipeline view", () => {
  const pipeline = toPipeline(parseJobSheet(real).applications);

  it("reduces 179 rows to something a phone can show", () => {
    // The point of the whole reduction: 173 of these say "No Application", so rendered whole
    // the six rows that matter are invisible inside a wall.
    expect(pipeline.total).toBe(179);
    expect(pipeline.submitted).toHaveLength(6);
    expect(pipeline.open).toHaveLength(3);
    expect(pipeline.shortlist.length).toBeLessThan(pipeline.total);
  });

  it("counts every row exactly once by status", () => {
    expect(pipeline.byStatus.reduce((n, s) => n + s.count, 0)).toBe(179);
  });

  it("puts the commonest status first", () => {
    expect(pipeline.byStatus[0]).toEqual({ status: "No Application", count: 173 });
  });

  it("shortlists only high-priority rows that have not been applied to", () => {
    expect(pipeline.shortlist.every((a) => !isSubmitted(a) && isHighPriority(a))).toBe(true);
  });

  it("sorts newest first and does not float undated rows to the top", () => {
    // A blank date wins a descending string comparison, so undated rows would otherwise sit
    // above everything real.
    const dated = pipeline.shortlist.filter((a) => a.added !== "");
    expect(dated.map((a) => a.added)).toEqual([...dated.map((a) => a.added)].sort().reverse());
    const firstUndated = pipeline.shortlist.findIndex((a) => a.added === "");
    if (firstUndated !== -1) {
      expect(pipeline.shortlist.slice(firstUndated).every((a) => a.added === "")).toBe(true);
    }
  });
});
