import { callModel } from "./gemini";
import { extractJson } from "./goal-drafts";

/**
 * Resume tailoring: paste a job description, get advice about which variant to send and which
 * existing bullets to lead with.
 *
 * **It writes nothing and it invents nothing.** Both properties are enforced here rather than
 * promised in a prompt.
 *
 * The second one is the whole design. An earlier version of this plan said "a test proves it
 * cannot introduce a bullet that is not in the vault" — but that only holds if the model
 * returns *identifiers*. If it returns prose, the check is fuzzy string matching, and a model
 * that helpfully rewrites "Built a rechargeable scale" into "Engineered a precision instrument"
 * passes any similarity threshold loose enough to be useful. That is D-069 walking back in
 * through the one feature that touches a hiring document.
 *
 * So the model is given an enumerated list and may return only ids from it. An id it did not
 * receive fails **the entire response** rather than being dropped: a model inventing one id is
 * evidence about the rest of that response, and silently discarding it would hide exactly the
 * failure this check exists to catch.
 *
 * Free-text rationale is allowed, and is displayed as rationale — never as bullet text.
 */

export type BulletRef = {
  /** `<section>:<slug>#<index>` — stable for as long as the vault entry's bullets keep order. */
  id: string;
  text: string;
  /** Which entry it belongs to, for grouping in the UI. */
  entry: string;
  section: "experience" | "projects";
};

export type TailorAdvice = {
  variant: string;
  /** Why that variant, in the model's words. */
  variantReason: string;
  /** Bullet ids to lead with, best first. */
  emphasise: string[];
  /** Bullet ids that do not earn their place for this posting. */
  deprioritise: string[];
  /** Free text. Displayed as rationale, never as resume content. */
  notes: string;
};

export type TailorResult =
  | { ok: true; advice: TailorAdvice }
  | { ok: false; message: string };

export function bulletId(
  section: BulletRef["section"],
  slug: string,
  index: number,
): string {
  return `${section}:${slug}#${index}`;
}

export function buildTailorPrompt(
  bullets: BulletRef[],
  variants: string[],
  posting: string,
): string {
  return [
    "You are advising Victor on which of his EXISTING resume bullets to lead with for the job",
    "posting below, and which resume variant to send. You are not writing anything.",
    "",
    "Rules, all of them absolute:",
    "- Refer to bullets ONLY by the ids given. Never quote, rewrite, summarise or improve one.",
    "- Never invent an id. Every id you return must appear in the list below, exactly.",
    "- Suggest no new claims, skills, numbers or experience. You are selecting and ordering.",
    "- If the posting is a poor fit, say so in `notes`. Do not stretch to make it fit.",
    "",
    `Resume variants available: ${variants.join(", ")}`,
    "",
    "Bullets:",
    ...bullets.map((b) => `${b.id} | ${b.entry} | ${b.text}`),
    "",
    "Job posting:",
    posting.trim(),
    "",
    "Reply with JSON only, no prose and no code fence:",
    '{"variant":"<one of the variants>","variantReason":"<one sentence>",',
    '"emphasise":["<id>","<id>"],"deprioritise":["<id>"],"notes":"<a few sentences>"}',
  ].join("\n");
}

/**
 * Parses a response and rejects it whole if it names anything it was not given.
 *
 * Deliberately not lenient. Every branch here returns a message rather than a repaired object,
 * because "the model returned something I had to fix" is information Victor should see before
 * putting a document in front of an employer.
 */
export function parseTailorResponse(
  text: string,
  allowedIds: Set<string>,
  allowedVariants: string[],
): TailorResult {
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
  const asStrings = (value: unknown): string[] | null =>
    Array.isArray(value) && value.every((v) => typeof v === "string") ? (value as string[]) : null;

  const emphasise = asStrings(body.emphasise) ?? [];
  const deprioritise = asStrings(body.deprioritise) ?? [];

  if (body.emphasise !== undefined && asStrings(body.emphasise) === null) {
    return { ok: false, message: "The model's `emphasise` was not a list of ids." };
  }

  const unknown = [...emphasise, ...deprioritise].filter((id) => !allowedIds.has(id));
  if (unknown.length > 0) {
    // The whole response, not just the offending entry. A fabricated id is evidence about
    // everything else in the response, and this is a hiring document.
    return {
      ok: false,
      message:
        `The model referred to ${unknown.length} bullet(s) that do not exist ` +
        `(${unknown.slice(0, 3).join(", ")}), so the whole suggestion was discarded. ` +
        `Nothing it said is being shown. Try again.`,
    };
  }

  if (emphasise.length === 0) {
    return { ok: false, message: "The model suggested nothing to emphasise." };
  }

  const variant = typeof body.variant === "string" ? body.variant.trim() : "";
  if (!allowedVariants.includes(variant)) {
    return {
      ok: false,
      message: `The model chose a resume variant that does not exist: "${variant}".`,
    };
  }

  // An id appearing in both lists is contradictory advice. Emphasis wins, because that is the
  // list Victor acts on, and dropping it from both would silently lose a real suggestion.
  const emphasised = new Set(emphasise);

  return {
    ok: true,
    advice: {
      variant,
      variantReason: typeof body.variantReason === "string" ? body.variantReason : "",
      emphasise: [...new Set(emphasise)],
      deprioritise: [...new Set(deprioritise)].filter((id) => !emphasised.has(id)),
      notes: typeof body.notes === "string" ? body.notes : "",
    },
  };
}

export async function tailorResume(
  bullets: BulletRef[],
  variants: string[],
  posting: string,
): Promise<TailorResult> {
  if (posting.trim().length < 80) {
    // Short input produces confident nonsense: with two lines to go on the model pattern-matches
    // on a job title and recommends whatever sounds adjacent.
    return { ok: false, message: "Paste more of the posting — a title alone is not enough to go on." };
  }
  if (bullets.length === 0) {
    return { ok: false, message: "No resume bullets found in the vault to choose from." };
  }

  const result = await callModel(buildTailorPrompt(bullets, variants, posting));
  if (!result.ok) return { ok: false, message: result.text };

  return parseTailorResponse(result.text, new Set(bullets.map((b) => b.id)), variants);
}
