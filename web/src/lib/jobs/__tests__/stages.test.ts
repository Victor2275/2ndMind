import { describe, expect, it } from "vitest";

import { stageColumns, stageOf, stageTotal, type Application, type Stage } from "@/lib/jobs/sheet";

/**
 * The pipeline's stages (V4 §5.8, Q419).
 *
 * The sheet's `status` is free text written by a Gmail script, so every column on the board is
 * a guess made from a substring. The guesses that matter are the ones where two stages could
 * both claim a row: an offer that was declined is **closed**, and a rejection after an
 * interview is closed rather than interviewing. Getting those backwards puts a dead application
 * in the column Victor reads as live.
 */

const application = (fields: Partial<Application> = {}): Application => ({
  company: "Acme",
  role: "SWE Intern",
  status: "",
  priority: "",
  location: "",
  focus: "",
  compensation: "",
  duration: "",
  urgency: "",
  link: "",
  notes: "",
  published: "",
  added: "2026-09-01",
  ...fields,
});

const stage = (status: string, priority = ""): Stage => stageOf(application({ status, priority }));

describe("which column a row lands in", () => {
  it("treats an unapplied posting as the shortlist", () => {
    expect(stage("")).toBe("shortlist");
    expect(stage("No Application")).toBe("shortlist");
    expect(stage("Not applied")).toBe("shortlist");
  });

  it("treats a sent application with no news as applied", () => {
    expect(stage("Pending")).toBe("applied");
    expect(stage("Submitted 2026-09-04")).toBe("applied");
  });

  it("recognises the several words that mean an interview", () => {
    expect(stage("OA sent")).toBe("interviewing");
    expect(stage("Phone screen booked")).toBe("interviewing");
    expect(stage("Onsite interview")).toBe("interviewing");
    expect(stage("Online assessment due Friday")).toBe("interviewing");
  });

  it("puts a rejection after an interview in closed, not interviewing", () => {
    // The status names both stages. Closed wins, because the question the board answers is
    // what is still live.
    expect(stage("Rejected after onsite interview")).toBe("closed");
  });

  it("puts a declined offer in closed, not offer", () => {
    expect(stage("Offer declined")).toBe("closed");
    expect(stage("Offer")).toBe("offer");
  });
});

describe("the columns", () => {
  const rows = [
    application({ company: "A", status: "", priority: "High Priority" }),
    application({ company: "B", status: "", priority: "Low Priority" }),
    application({ company: "C", status: "Pending", added: "2026-09-10" }),
    application({ company: "D", status: "Pending", added: "2026-09-02" }),
    application({ company: "E", status: "Rejected" }),
  ];

  it("lists only high-priority rows in the shortlist", () => {
    // 173 of 178 rows are postings Victor has not applied to. A column holding all of them is
    // the wall the pipeline view exists to avoid.
    const shortlist = stageColumns(rows).find((column) => column.stage === "shortlist");
    expect(shortlist?.applications.map((a) => a.company)).toEqual(["A"]);
  });

  it("still counts what it does not list", () => {
    // The count above the column is the honest number; the list is the readable one.
    expect(stageTotal(rows, "shortlist")).toBe(2);
  });

  it("orders each column newest first", () => {
    const applied = stageColumns(rows).find((column) => column.stage === "applied");
    expect(applied?.applications.map((a) => a.company)).toEqual(["C", "D"]);
  });

  it("returns every stage, including the empty ones", () => {
    // An empty column is a fact about the pipeline — "no offers yet" — and a board that drops
    // it changes shape every time something moves.
    expect(stageColumns([]).map((column) => column.stage)).toEqual([
      "shortlist",
      "applied",
      "interviewing",
      "offer",
      "closed",
    ]);
  });
});
