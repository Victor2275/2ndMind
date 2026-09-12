import { callModel } from "./gemini";
import { extractJson } from "./goal-drafts";
import type { BulletRef } from "./tailor";

/**
 * Cover letter drafting: paste a job posting, get a real draft back — unlike
 * `tailor.ts`, which only ever selects and orders ids.
 *
 * A cover letter has to read as prose, so "the model may only return ids" does not work here
 * the way it does for resume tailoring. The guardrail is adapted rather than dropped: every
 * factual claim in the draft must be tagged with the bullet id(s) it comes from, and any tag
 * naming an id outside the allowlist fails the **entire response** — the same all-or-nothing
 * rule `tailor.ts` uses, because a fabricated citation is evidence about the rest of the
 * letter, not an isolated slip. Untagged connective prose (the greeting, the hook's framing
 * sentence, the closing) is allowed, since it makes no claim about Victor to verify.
 */

export type CoverLetterParagraph = {
  /** Which template section this fills: "greeting" | "hook" | "body" | "closing". */
  section: string;
  text: string;
  /** Bullet ids this paragraph's claims are drawn from. Empty for framing-only paragraphs. */
  citedIds: string[];
};

export type CoverLetterDraft = {
  paragraphs: CoverLetterParagraph[];
};

export type CoverLetterResult =
  { ok: true; draft: CoverLetterDraft } | { ok: false; message: string };

export function buildCoverLetterPrompt(
  bullets: BulletRef[],
  template: string,
  posting: string,
): string {
  return [
    "You are drafting a real cover letter for Victor, following the template below exactly —",
    "same sections, same order. You may write connecting prose freely, but every FACTUAL claim",
    "about something Victor built, did, or contributed to must be backed by one of the bullet",
    "ids given below.",
    "",
    "Rules, all of them absolute:",
    "- Every factual claim traces to a bullet id from the list. Cite it in that paragraph's",
    "  `citedIds`. Do not invent an id, a project, a number, a skill, or an outcome that is not",
    "  in the list.",
    "- The greeting and any purely framing sentence (naming the role or company) need no",
    "  citation — leave `citedIds` empty for a paragraph that makes no claim about Victor.",
    "- Do not quote a bullet verbatim; write it as a real sentence, in Victor's voice, but keep",
    "  every fact it asserts.",
    "- Follow the template's sections in order: greeting, hook, body (one or two paragraphs),",
    "  closing. Use the section names exactly: greeting, hook, body, closing.",
    "- If the posting gives too little to write a real hook, say so honestly in a `body`",
    "  paragraph rather than inventing enthusiasm.",
    "",
    "Template (the shape to follow, not text to copy):",
    template.trim(),
    "",
    "Bullets Victor can be truthfully credited with:",
    ...bullets.map((b) => `${b.id} | ${b.entry} | ${b.text}`),
    "",
    "Job posting:",
    posting.trim(),
    "",
    "Reply with JSON only, no prose and no code fence:",
    '{"paragraphs":[{"section":"greeting","text":"<text>","citedIds":[]},',
    '{"section":"hook","text":"<text>","citedIds":[]},',
    '{"section":"body","text":"<text>","citedIds":["<id>"]},',
    '{"section":"closing","text":"<text>","citedIds":[]}]}',
  ].join("\n");
}

const VALID_SECTIONS = new Set(["greeting", "hook", "body", "closing"]);

/**
 * Parses a response and rejects it whole if a paragraph cites anything it was not given.
 *
 * Same discipline as `parseTailorResponse`: no repair, no silent drop. A letter with one
 * fabricated citation is not a letter with one bad sentence — it is a document whose other
 * sentences just lost their only check.
 */
export function parseCoverLetterResponse(text: string, allowedIds: Set<string>): CoverLetterResult {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch {
    return { ok: false, message: "The model did not return JSON. Try again." };
  }

  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "The model did not return an object." };
  }

  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.paragraphs) || body.paragraphs.length === 0) {
    return { ok: false, message: "The model returned no paragraphs." };
  }

  const paragraphs: CoverLetterParagraph[] = [];
  const allUnknown: string[] = [];

  for (const entry of body.paragraphs) {
    if (typeof entry !== "object" || entry === null) {
      return { ok: false, message: "The model returned a paragraph that was not an object." };
    }
    const p = entry as Record<string, unknown>;
    const section = typeof p.section === "string" ? p.section : "";
    const paragraphText = typeof p.text === "string" ? p.text.trim() : "";
    const citedIds =
      Array.isArray(p.citedIds) && p.citedIds.every((v) => typeof v === "string")
        ? (p.citedIds as string[])
        : null;

    if (!VALID_SECTIONS.has(section)) {
      return { ok: false, message: `The model used an unknown section name: "${section}".` };
    }
    if (paragraphText === "") {
      return { ok: false, message: `The model left the "${section}" section empty.` };
    }
    if (citedIds === null) {
      return { ok: false, message: `The "${section}" section's citedIds was not a list.` };
    }

    allUnknown.push(...citedIds.filter((id) => !allowedIds.has(id)));
    paragraphs.push({ section, text: paragraphText, citedIds: [...new Set(citedIds)] });
  }

  if (allUnknown.length > 0) {
    // The whole letter, not just the offending paragraph. This is a document going out under
    // Victor's name, and a fabricated citation is not a defect that stays put in one sentence.
    return {
      ok: false,
      message:
        `The model cited ${allUnknown.length} thing(s) that do not exist ` +
        `(${allUnknown.slice(0, 3).join(", ")}), so the whole draft was discarded. ` +
        `Nothing it wrote is being shown. Try again.`,
    };
  }

  return { ok: true, draft: { paragraphs } };
}

export async function generateCoverLetter(
  bullets: BulletRef[],
  template: string,
  posting: string,
): Promise<CoverLetterResult> {
  if (posting.trim().length < 80) {
    // Same floor as resume tailoring, for the same reason: a title alone produces confident
    // filler rather than an honest "not enough to go on".
    return {
      ok: false,
      message: "Paste more of the posting — a title alone is not enough to go on.",
    };
  }
  if (bullets.length === 0) {
    return { ok: false, message: "No resume bullets found in the vault to draft from." };
  }
  if (template.trim() === "") {
    return { ok: false, message: "The cover letter template is empty — check the vault file." };
  }

  const result = await callModel(buildCoverLetterPrompt(bullets, template, posting));
  if (!result.ok) return { ok: false, message: result.text };

  return parseCoverLetterResponse(result.text, new Set(bullets.map((b) => b.id)));
}
