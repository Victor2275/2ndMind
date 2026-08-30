import { afterEach, describe, expect, it, vi } from "vitest";

import { buildGoalPrompt, draftSprintGoals, extractJson, type GoalContext } from "../goal-drafts";

vi.mock("../gemini", () => ({ callModel: vi.fn() }));
const { callModel } = await import("../gemini");
const mocked = vi.mocked(callModel);

const context: GoalContext = {
  domains: [
    { key: "engineering", label: "Engineering / Career" },
    { key: "athletics", label: "Athletics" },
  ],
  currentGoals: "engineering: Ship the Working page",
  weekTasks: "Done: wired /now. Open: case study for Proof.",
  weekLog: "Two erg sessions.",
  upcoming: "Flight Thursday.",
};

const replies = (text: string) => mocked.mockResolvedValue({ text, ok: true });

afterEach(() => vi.resetAllMocks());

describe("extractJson", () => {
  it("reads a bare object", () => {
    expect(extractJson('{"goals":[]}')).toEqual({ goals: [] });
  });

  it("reads it out of a code fence", () => {
    // Models fence JSON roughly half the time no matter what the prompt says.
    expect(extractJson('```json\n{"goals":[]}\n```')).toEqual({ goals: [] });
  });

  it("reads it after a sentence of preamble", () => {
    expect(extractJson('Sure! Here you go:\n{"goals":[]}')).toEqual({ goals: [] });
  });

  it("throws when there is no object at all", () => {
    expect(() => extractJson("I cannot help with that.")).toThrow(/no JSON/);
  });
});

describe("buildGoalPrompt", () => {
  it("names the domains it will accept back", () => {
    expect(buildGoalPrompt(context)).toContain("engineering");
    expect(buildGoalPrompt(context)).toContain("athletics");
  });

  it("says explicitly not to invent progress", () => {
    // The vault-wide rule: unknown is a prompt, never a claim. A drafter that invents a
    // finished deliverable would put a fabrication in front of Victor as a suggestion.
    expect(buildGoalPrompt(context)).toMatch(/Do not invent/i);
  });

  it("marks empty sections rather than leaving them blank", () => {
    const empty = buildGoalPrompt({ ...context, weekLog: "", upcoming: "  " });
    expect(empty).toContain("(nothing logged)");
    expect(empty).toContain("(nothing)");
  });
});

describe("draftSprintGoals", () => {
  it("returns parsed goals", async () => {
    replies(
      '{"goals":[{"domain":"engineering","title":"Write the Proof case study","why":"open"}]}',
    );
    const result = await draftSprintGoals(context);
    expect(result).toEqual({
      ok: true,
      goals: [{ domain: "engineering", title: "Write the Proof case study", why: "open" }],
    });
  });

  it("drops a goal for a domain that does not exist", async () => {
    // It would render as a row with no label and approve into a column nothing reads.
    replies(
      '{"goals":[{"domain":"astrology","title":"x","why":""},{"domain":"athletics","title":"Erg thrice","why":""}]}',
    );
    const result = await draftSprintGoals(context);
    expect(result.ok && result.goals.map((g) => g.domain)).toEqual(["athletics"]);
  });

  it("keeps only the first goal per domain", async () => {
    // Asked for one each, a model sometimes returns two for whichever it has most to say
    // about. The review UI is keyed by domain, so a duplicate would collide.
    replies(
      '{"goals":[{"domain":"athletics","title":"First","why":""},{"domain":"athletics","title":"Second","why":""}]}',
    );
    const result = await draftSprintGoals(context);
    expect(result.ok && result.goals.map((g) => g.title)).toEqual(["First"]);
  });

  it("passes a model failure straight through, message intact", async () => {
    // No key, exhausted quota, a retired model. Each already carries a human-readable line.
    mocked.mockResolvedValue({ text: "Set GEMINI_API_KEY to turn this on.", ok: false });
    expect(await draftSprintGoals(context)).toEqual({
      ok: false,
      message: "Set GEMINI_API_KEY to turn this on.",
    });
  });

  it("does not show raw model output when the shape is wrong", async () => {
    // Model output of unknown shape rendered as an app message is how an injected string
    // reaches the screen looking official.
    vi.spyOn(console, "error").mockImplementation(() => {});
    replies('{"goals":[{"domain":"engineering"}]}');
    const result = await draftSprintGoals(context);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).not.toContain("engineering");
  });

  it("fails cleanly on prose instead of JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    replies("I would suggest focusing on rest this week.");
    expect((await draftSprintGoals(context)).ok).toBe(false);
  });

  it("says so when nothing usable came back", async () => {
    replies('{"goals":[]}');
    const result = await draftSprintGoals(context);
    expect(result).toEqual({
      ok: false,
      message: "The model proposed nothing for any known domain.",
    });
  });
});
