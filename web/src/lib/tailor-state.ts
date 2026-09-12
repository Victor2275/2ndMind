import type { CoverLetterDraft } from "@/lib/ai/cover-letter";
import type { BulletRef, QuestionAnswer, TailorAdvice } from "@/lib/ai/tailor";

/**
 * The shape the tailoring action returns.
 *
 * A plain module, not the `"use server"` file: those may export only async functions, and
 * exporting a type from one is a build error rather than a lint nit. Third time this rule has
 * come up — see `lib/sprint-goals.ts`.
 */
export type TailorState = {
  ok: boolean;
  message?: string;
  advice?: TailorAdvice;
  /** Set by the posting-question mode instead of `advice`. */
  answer?: QuestionAnswer;
  /** Set by the cover letter mode instead of `advice` or `answer`. */
  letter?: CoverLetterDraft;
  /** Only the bullets the advice refers to, resolved from the vault rather than the model. */
  bullets?: BulletRef[];
};
