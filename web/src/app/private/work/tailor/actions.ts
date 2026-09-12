"use server";

import { requireSession } from "@/lib/auth/dal";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import { answerQuestion, bulletId, tailorResume, type BulletRef } from "@/lib/ai/tailor";
import { RESUME_VARIANTS } from "@/lib/resume";
import { publicExperience, publicProjects, publicPursuits } from "@/lib/vault/public";
import { readVaultFileCached } from "@/lib/vault/write";
import type { TailorState } from "@/lib/tailor-state";

const COVER_LETTER_TEMPLATE_PATH = "context/04_operations/cover_letter_template.md";

/**
 * Resume tailoring. Reads the vault, writes nothing.
 *
 * No approval gate, deliberately: the output is advice about which existing bullets to lead
 * with, and advice that changes nothing needs no approval. The guardrail that matters here is
 * a different one — the model may only return ids it was given — and it lives in
 * `lib/ai/tailor.ts`, enforced by a parser rather than promised in a prompt.
 */

/**
 * Every bullet in the vault, whether or not it is on a resume.
 *
 * This deliberately does **not** read `resume_variants`. That field decides what gets printed;
 * this library decides what the model is allowed to talk about, and they are different
 * questions. MathCounts and Lifeguard are the case that forced the distinction — Victor wants
 * them reachable when a posting asks about mentoring or responsibility, and off the printed
 * page entirely. Building the library from `buildResume()` made those mutually exclusive.
 *
 * Pursuits are here for the same reason: CAD, SolidWorks and 3D printing live only in
 * `pursuits/fabrication.md` and are on no variant, so a posting asking for mechanical design
 * could not be answered with the one thing that answers it.
 *
 * Widening the library does not loosen the guardrail. What the model may *say* is still
 * bounded by the ids it is handed, and an id it was not handed fails the whole response.
 */
export async function collectBullets(): Promise<BulletRef[]> {
  const seen = new Map<string, BulletRef>();

  const add = (section: BulletRef["section"], slug: string, entry: string, bullets: string[]) => {
    bullets.forEach((text, index) => {
      const id = bulletId(section, slug, index);
      if (!seen.has(id)) seen.set(id, { id, text, entry, section });
    });
  };

  for (const e of publicExperience()) add("experience", e.slug, `${e.title} · ${e.org}`, e.bullets);
  for (const p of publicProjects()) add("projects", p.slug, p.title, p.bullets);
  for (const p of publicPursuits()) add("projects", `pursuit-${p.slug}`, p.title, p.bullets);

  return [...seen.values()];
}

export async function suggestTailoring(
  _prev: TailorState | null,
  formData: FormData,
): Promise<TailorState> {
  await requireSession();

  const posting = String(formData.get("posting") ?? "").trim();
  if (posting === "") {
    return { ok: false, message: "Paste the job posting first." };
  }

  try {
    const bullets = await collectBullets();
    const result = await tailorResume(bullets, RESUME_VARIANTS, posting);
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, advice: result.advice, bullets };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * The other half of an application: the free-text questions a posting asks directly.
 *
 * "Why do you want to work here", "describe a time you led something", "tell us about a
 * project you are proud of" — these are answered from the same material as a resume, and
 * getting them wrong in the opposite direction is easy. So the same guardrail applies: the
 * model points at bullets Victor already has and says how to use them. It does not draft
 * the answer, because an answer it drafted would be its writing submitted under his name.
 */
export async function answerPostingQuestion(
  _prev: TailorState | null,
  formData: FormData,
): Promise<TailorState> {
  await requireSession();

  const question = String(formData.get("question") ?? "").trim();
  if (question === "") {
    return { ok: false, message: "Paste the question first." };
  }

  try {
    const bullets = await collectBullets();
    const result = await answerQuestion(bullets, question);
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, answer: result.answer, bullets };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Drafts a real cover letter from `cover_letter_template.md`, citing only bullets that
 * actually exist. See `lib/ai/cover-letter.ts` for the guardrail: unlike the two actions
 * above, this one lets the model write real prose, so the check is on each paragraph's
 * citations rather than on the model returning ids and nothing else.
 */
export async function generateCoverLetterAction(
  _prev: TailorState | null,
  formData: FormData,
): Promise<TailorState> {
  await requireSession();

  const posting = String(formData.get("posting") ?? "").trim();
  if (posting === "") {
    return { ok: false, message: "Paste the job posting first." };
  }

  try {
    const [bullets, template] = await Promise.all([
      collectBullets(),
      readVaultFileCached(COVER_LETTER_TEMPLATE_PATH).then((f) => f.content),
    ]);
    const result = await generateCoverLetter(bullets, template, posting);
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, letter: result.draft, bullets };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
