"use server";

import { requireSession } from "@/lib/auth/dal";
import { bulletId, tailorResume, type BulletRef } from "@/lib/ai/tailor";
import { buildResume, RESUME_VARIANTS } from "@/lib/resume";
import type { TailorState } from "@/lib/tailor-state";

/**
 * Resume tailoring. Reads the vault, writes nothing.
 *
 * No approval gate, deliberately: the output is advice about which existing bullets to lead
 * with, and advice that changes nothing needs no approval. The guardrail that matters here is
 * a different one — the model may only return ids it was given — and it lives in
 * `lib/ai/tailor.ts`, enforced by a parser rather than promised in a prompt.
 */

/**
 * Every bullet across every variant, de-duplicated.
 *
 * The union rather than one variant's set, because *which variant to send* is one of the
 * questions being asked. Feeding it only the robotics bullets and then asking whether robotics
 * is the right variant is a question with one possible answer.
 */
export async function collectBullets(): Promise<BulletRef[]> {
  const seen = new Map<string, BulletRef>();

  for (const variant of RESUME_VARIANTS) {
    const doc = buildResume(variant);
    const sections = [
      { key: "experience" as const, entries: doc.experience },
      { key: "projects" as const, entries: doc.projects },
    ];

    for (const section of sections) {
      for (const entry of section.entries) {
        entry.bullets.forEach((text, index) => {
          const id = bulletId(section.key, entry.slug, index);
          if (!seen.has(id)) {
            seen.set(id, { id, text, entry: entry.title, section: section.key });
          }
        });
      }
    }
  }

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

    // The bullets travel back with the advice so the UI can render each id as its real text.
    // Resolved here from the vault, never from the model — the model returns ids precisely so
    // that it never supplies the words.
    return {
      ok: true,
      message: `Suggested the ${result.advice.variant} variant.`,
      advice: result.advice,
      bullets: bullets.filter(
        (b) =>
          result.advice.emphasise.includes(b.id) || result.advice.deprioritise.includes(b.id),
      ),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}
