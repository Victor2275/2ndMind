import { afterEach, describe, expect, it, vi } from "vitest";

import {
  answerQuestion,
  buildQuestionPrompt,
  bulletId,
  buildTailorPrompt,
  parseQuestionResponse,
  parseTailorResponse,
  tailorResume,
  type BulletRef,
} from "../tailor";

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
const VARIANTS = ["robotics", "ml", "swe"];
const POSTING = "x".repeat(200);

const replies = (text: string) => mocked.mockResolvedValue({ text, ok: true });

afterEach(() => vi.resetAllMocks());

describe("bulletId", () => {
  it("is stable and namespaced by section", () => {
    // A project and a role could share a slug; without the section prefix their bullets would
    // collide and advice about one would be applied to the other.
    expect(bulletId("experience", "proof", 0)).not.toBe(bulletId("projects", "proof", 0));
  });
});

describe("buildTailorPrompt", () => {
  it("supplies every bullet with its id", () => {
    const prompt = buildTailorPrompt(BULLETS, VARIANTS, POSTING);
    for (const b of BULLETS) expect(prompt).toContain(b.id);
  });

  it("forbids rewriting and inventing, in the prompt as well as the parser", () => {
    // Belt and braces. The parser is what enforces it; saying so in the prompt is what stops
    // the model wasting a call producing something that will be rejected whole.
    const prompt = buildTailorPrompt(BULLETS, VARIANTS, POSTING);
    expect(prompt).toMatch(/Never invent an id/i);
    expect(prompt).toMatch(/Never quote, rewrite/i);
  });
});

describe("parseTailorResponse", () => {
  const good = JSON.stringify({
    variant: "robotics",
    variantReason: "The posting is robotics-heavy.",
    emphasise: [BULLETS[0].id],
    deprioritise: [BULLETS[1].id],
    notes: "Strong fit.",
  });

  it("accepts a well-formed response", () => {
    const result = parseTailorResponse(good, IDS, VARIANTS);
    expect(result.ok && result.advice.variant).toBe("robotics");
    expect(result.ok && result.advice.emphasise).toEqual([BULLETS[0].id]);
  });

  it("REJECTS THE WHOLE RESPONSE when an id was invented", () => {
    // The test the plan asks for by name. A fabricated id is evidence about everything else in
    // the response, so nothing from it is shown — dropping just the bad id would hide exactly
    // the failure this check exists to catch.
    const forged = JSON.stringify({
      variant: "robotics",
      emphasise: [BULLETS[0].id, "projects:invented-project#0"],
      deprioritise: [],
      notes: "",
    });
    const result = parseTailorResponse(forged, IDS, VARIANTS);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/do not exist/i);
    expect(result.ok === false && result.message).toContain("projects:invented-project#0");
  });

  it("rejects a fabricated id in deprioritise too", () => {
    // The less obvious half: advice to drop a bullet that does not exist is still a fabrication,
    // and a parser that only checked `emphasise` would let it through.
    const forged = JSON.stringify({
      variant: "swe",
      emphasise: [BULLETS[0].id],
      deprioritise: ["experience:not-a-job#4"],
      notes: "",
    });
    expect(parseTailorResponse(forged, IDS, VARIANTS).ok).toBe(false);
  });

  it("rejects a variant that does not exist", () => {
    const bad = JSON.stringify({ variant: "quantum", emphasise: [BULLETS[0].id] });
    const result = parseTailorResponse(bad, IDS, VARIANTS);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/does not exist/i);
  });

  it("rejects prose where ids were required", () => {
    // The failure the id scheme exists to prevent: the model returning improved bullet text.
    const prose = JSON.stringify({
      variant: "robotics",
      emphasise: ["Engineered a precision robotics instrument"],
      notes: "",
    });
    expect(parseTailorResponse(prose, IDS, VARIANTS).ok).toBe(false);
  });

  it("rejects emphasise that is not a list of strings", () => {
    const bad = JSON.stringify({ variant: "swe", emphasise: [{ id: BULLETS[0].id }] });
    expect(parseTailorResponse(bad, IDS, VARIANTS).ok).toBe(false);
  });

  it("rejects a response with nothing to emphasise", () => {
    const empty = JSON.stringify({ variant: "swe", emphasise: [], notes: "No fit." });
    const result = parseTailorResponse(empty, IDS, VARIANTS);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/nothing to emphasise/i);
  });

  it("rejects text that is not JSON at all", () => {
    expect(parseTailorResponse("I'd lead with the robotics work.", IDS, VARIANTS).ok).toBe(false);
  });

  it("reads JSON out of a code fence", () => {
    expect(parseTailorResponse("```json\n" + good + "\n```", IDS, VARIANTS).ok).toBe(true);
  });

  it("de-duplicates a repeated id", () => {
    const dupe = JSON.stringify({
      variant: "swe",
      emphasise: [BULLETS[0].id, BULLETS[0].id],
      deprioritise: [],
    });
    const result = parseTailorResponse(dupe, IDS, VARIANTS);
    expect(result.ok && result.advice.emphasise).toEqual([BULLETS[0].id]);
  });

  it("lets emphasis win when a bullet is in both lists", () => {
    // Contradictory advice. Emphasis is the list Victor acts on; dropping the id from both
    // would silently lose a real suggestion.
    const both = JSON.stringify({
      variant: "swe",
      emphasise: [BULLETS[0].id],
      deprioritise: [BULLETS[0].id],
    });
    const result = parseTailorResponse(both, IDS, VARIANTS);
    expect(result.ok && result.advice.emphasise).toEqual([BULLETS[0].id]);
    expect(result.ok && result.advice.deprioritise).toEqual([]);
  });

  it("keeps free-text rationale, which is allowed", () => {
    const result = parseTailorResponse(good, IDS, VARIANTS);
    expect(result.ok && result.advice.notes).toBe("Strong fit.");
    expect(result.ok && result.advice.variantReason).toBe("The posting is robotics-heavy.");
  });
});

describe("tailorResume", () => {
  it("refuses a posting too short to reason about", async () => {
    // Two lines of input produces confident nonsense: the model pattern-matches on the job
    // title and recommends whatever sounds adjacent.
    const result = await tailorResume(BULLETS, VARIANTS, "Robotics Intern");
    expect(result.ok).toBe(false);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("refuses when the vault has no bullets", async () => {
    const result = await tailorResume([], VARIANTS, POSTING);
    expect(result.ok).toBe(false);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("passes a model failure through with its message", async () => {
    mocked.mockResolvedValue({ text: "Set GEMINI_API_KEY to turn this on.", ok: false });
    const result = await tailorResume(BULLETS, VARIANTS, POSTING);
    expect(result.ok === false && result.message).toBe("Set GEMINI_API_KEY to turn this on.");
  });

  it("returns advice end to end", async () => {
    replies(JSON.stringify({ variant: "ml", emphasise: [BULLETS[1].id], notes: "ok" }));
    const result = await tailorResume(BULLETS, VARIANTS, POSTING);
    expect(result.ok && result.advice.variant).toBe("ml");
  });
});

describe("posting questions", () => {
  const QUESTION = "Describe a technical project you are proud of and your role in it.";

  it("hands the model every bullet id it is allowed to name", () => {
    const prompt = buildQuestionPrompt(BULLETS, QUESTION);
    for (const b of BULLETS) expect(prompt).toContain(b.id);
    expect(prompt).toContain(QUESTION);
  });

  it("tells the model not to invent a motivation on Victor's behalf", () => {
    // The failure mode specific to this feature: "why do you want to work here" invites a
    // model to assert a reason he never gave, in the first person, on an application.
    expect(buildQuestionPrompt(BULLETS, QUESTION)).toMatch(/never assert a reason on his behalf/i);
  });

  it("rejects the whole response when it names an id it was not given", () => {
    const result = parseQuestionResponse(
      JSON.stringify({ points: [BULLETS[0].id, "projects:invented#0"], angle: "a", avoid: "b" }),
      IDS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("do not exist");
  });

  it("keeps the vault's own text out of the model's hands", () => {
    // `points` are ids only. Nothing in the parsed answer carries prose the model wrote in
    // place of a bullet — the UI resolves text from the id, exactly as the resume side does.
    const result = parseQuestionResponse(
      JSON.stringify({
        points: [BULLETS[0].id],
        angle: "Lead with the sim-to-real work.",
        avoid: "",
      }),
      IDS,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answer.points).toEqual([BULLETS[0].id]);
      expect(JSON.stringify(result.answer)).not.toContain(BULLETS[0].text);
    }
  });

  it("de-duplicates repeated ids", () => {
    const result = parseQuestionResponse(
      JSON.stringify({ points: [BULLETS[0].id, BULLETS[0].id], angle: "", avoid: "" }),
      IDS,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answer.points).toHaveLength(1);
  });

  it("refuses an empty selection rather than showing an answer built from nothing", () => {
    const result = parseQuestionResponse(JSON.stringify({ points: [], angle: "", avoid: "" }), IDS);
    expect(result.ok).toBe(false);
  });

  it("accepts a short question, unlike a short posting", async () => {
    // "Why do you want to work here?" is a real question and is 30 characters. The posting
    // path rejects anything that short because a posting that short is just a job title.
    replies(JSON.stringify({ points: [BULLETS[0].id], angle: "", avoid: "" }));
    const result = await answerQuestion(BULLETS, "Why do you want to work here?");
    expect(result.ok).toBe(true);
  });

  it("still rejects a question too short to mean anything", async () => {
    const result = await answerQuestion(BULLETS, "why?");
    expect(result.ok).toBe(false);
  });
});
