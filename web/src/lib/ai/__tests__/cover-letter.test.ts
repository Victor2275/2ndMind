import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCoverLetterPrompt,
  generateCoverLetter,
  parseCoverLetterResponse,
} from "../cover-letter";
import { bulletId, type BulletRef } from "../tailor";

vi.mock("../gemini", () => ({ callModel: vi.fn() }));
const { callModel } = await import("../gemini");
const mocked = vi.mocked(callModel);

const BULLETS: BulletRef[] = [
  {
    id: bulletId("experience", "dimaag-ai", 0),
    text: "Trained PPO policies in Isaac Lab with LiDAR raycasting.",
    entry: "Dimaag.ai",
    section: "experience",
  },
  {
    id: bulletId("projects", "taskable", 0),
    text: "Built an educational web app linking student and teacher views.",
    entry: "TaskAble",
    section: "projects",
  },
];

const IDS = new Set(BULLETS.map((b) => b.id));
const POSTING = "x".repeat(200);
const TEMPLATE = "## Greeting\n\n## Hook\n\n## Body\n\n## Closing";

const replies = (text: string) => mocked.mockResolvedValue({ text, ok: true });

afterEach(() => vi.resetAllMocks());

function letter(overrides?: Partial<Record<string, unknown>>) {
  return JSON.stringify({
    paragraphs: [
      { section: "greeting", text: "Dear Hiring Team,", citedIds: [] },
      { section: "hook", text: "I'm excited to apply for the Robotics Intern role.", citedIds: [] },
      { section: "body", text: "I trained PPO policies at Dimaag.ai.", citedIds: [BULLETS[0].id] },
      { section: "closing", text: "Thank you for your consideration.", citedIds: [] },
    ],
    ...overrides,
  });
}

describe("buildCoverLetterPrompt", () => {
  it("supplies every bullet with its id", () => {
    const prompt = buildCoverLetterPrompt(BULLETS, TEMPLATE, POSTING);
    for (const b of BULLETS) expect(prompt).toContain(b.id);
  });

  it("includes the template and forbids inventing facts", () => {
    const prompt = buildCoverLetterPrompt(BULLETS, TEMPLATE, POSTING);
    expect(prompt).toContain(TEMPLATE);
    expect(prompt).toMatch(/Do not invent an id/i);
  });
});

describe("parseCoverLetterResponse", () => {
  it("accepts a well-formed draft", () => {
    const result = parseCoverLetterResponse(letter(), IDS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.paragraphs).toHaveLength(4);
      expect(result.draft.paragraphs[2].citedIds).toEqual([BULLETS[0].id]);
    }
  });

  it("REJECTS THE WHOLE LETTER when a citation was invented", () => {
    // The cover letter equivalent of the tailor test the plan asks for by name: one fabricated
    // citation is evidence about every other sentence, so nothing from the draft is shown.
    const forged = letter({
      paragraphs: [
        { section: "greeting", text: "Dear Hiring Team,", citedIds: [] },
        { section: "hook", text: "hook", citedIds: [] },
        {
          section: "body",
          text: "I led a team that shipped a rocket.",
          citedIds: ["projects:invented-project#0"],
        },
        { section: "closing", text: "Thank you.", citedIds: [] },
      ],
    });
    const result = parseCoverLetterResponse(forged, IDS);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/do not exist/i);
    expect(result.ok === false && result.message).toContain("projects:invented-project#0");
  });

  it("allows an uncited greeting, hook, or closing", () => {
    // Framing prose makes no claim about Victor, so it needs nothing to cite — only a
    // paragraph that asserts a fact needs a citation.
    const result = parseCoverLetterResponse(letter(), IDS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.paragraphs[0].citedIds).toEqual([]);
      expect(result.draft.paragraphs[1].citedIds).toEqual([]);
    }
  });

  it("rejects an unknown section name", () => {
    const bad = letter({
      paragraphs: [{ section: "signature", text: "x", citedIds: [] }],
    });
    const result = parseCoverLetterResponse(bad, IDS);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/unknown section/i);
  });

  it("rejects an empty paragraph", () => {
    const bad = letter({
      paragraphs: [{ section: "greeting", text: "  ", citedIds: [] }],
    });
    expect(parseCoverLetterResponse(bad, IDS).ok).toBe(false);
  });

  it("rejects citedIds that is not a list of strings", () => {
    const bad = letter({
      paragraphs: [{ section: "body", text: "x", citedIds: [{ id: BULLETS[0].id }] }],
    });
    expect(parseCoverLetterResponse(bad, IDS).ok).toBe(false);
  });

  it("rejects a response with no paragraphs", () => {
    expect(parseCoverLetterResponse(JSON.stringify({ paragraphs: [] }), IDS).ok).toBe(false);
  });

  it("rejects text that is not JSON at all", () => {
    expect(parseCoverLetterResponse("Dear Hiring Team, I am writing to apply...", IDS).ok).toBe(
      false,
    );
  });

  it("reads JSON out of a code fence", () => {
    expect(parseCoverLetterResponse("```json\n" + letter() + "\n```", IDS).ok).toBe(true);
  });

  it("de-duplicates a repeated citation", () => {
    const dupe = letter({
      paragraphs: [{ section: "body", text: "x", citedIds: [BULLETS[0].id, BULLETS[0].id] }],
    });
    const result = parseCoverLetterResponse(dupe, IDS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.paragraphs[0].citedIds).toEqual([BULLETS[0].id]);
  });
});

describe("generateCoverLetter", () => {
  it("refuses a posting too short to reason about", async () => {
    const result = await generateCoverLetter(BULLETS, TEMPLATE, "Robotics Intern");
    expect(result.ok).toBe(false);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("refuses when the vault has no bullets", async () => {
    const result = await generateCoverLetter([], TEMPLATE, POSTING);
    expect(result.ok).toBe(false);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("refuses when the template is empty", async () => {
    const result = await generateCoverLetter(BULLETS, "   ", POSTING);
    expect(result.ok).toBe(false);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("passes a model failure through with its message", async () => {
    mocked.mockResolvedValue({ text: "Set GEMINI_API_KEY to turn this on.", ok: false });
    const result = await generateCoverLetter(BULLETS, TEMPLATE, POSTING);
    expect(result.ok === false && result.message).toBe("Set GEMINI_API_KEY to turn this on.");
  });

  it("returns a draft end to end", async () => {
    replies(letter());
    const result = await generateCoverLetter(BULLETS, TEMPLATE, POSTING);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.paragraphs).toHaveLength(4);
  });
});
