import { z } from "zod";

import { callModel } from "./gemini";

/**
 * Drafting next week's sprint goals from the week that just happened.
 *
 * This produces a **proposal**, never a write. The model's output reaches Postgres only after
 * Victor approves it item by item — see `lib/proposals/types.ts`. That is the whole constraint
 * of §2.1, and it is why this module returns data rather than calling `replaceGoals` itself.
 *
 * What is sent to Google: tasks, log lines and calendar entries the caller chooses to pass.
 * The caller decides, exactly as `generateDailySummary` does, and health data stays out.
 */

export type GoalDraft = {
  domain: string;
  title: string;
  /** Why the model proposed it, shown alongside as reasoning — never as a claim of fact. */
  why: string;
};

export type DraftResult =
  | { ok: true; goals: GoalDraft[] }
  | { ok: false; message: string };

/**
 * The model's output is untrusted input, so it is parsed rather than cast.
 *
 * A model returning slightly the wrong shape is not an exceptional case, it is a Tuesday, and
 * `as GoalDraft[]` would push a `{}` into the review UI where it renders as an empty row that
 * approves an empty goal.
 */
const draftSchema = z.object({
  goals: z
    .array(
      z.object({
        domain: z.string().min(1),
        title: z.string().min(1),
        why: z.string().default(""),
      }),
    )
    .max(12),
});

/**
 * Pulls the JSON object out of a model response.
 *
 * Models wrap JSON in ```json fences roughly half the time regardless of instructions, and
 * sometimes add a sentence before it. Slicing between the first `{` and the last `}` handles
 * both without a fragile fence regex.
 */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in the response");
  return JSON.parse(text.slice(start, end + 1));
}

/** The context a draft is built from. Each field is already-summarised text from the caller. */
export type GoalContext = {
  /** The domains goals may be proposed for, as `key: label`. */
  domains: { key: string; label: string }[];
  /** What the current goals are, so the model can carry one forward or replace it. */
  currentGoals: string;
  /** What got done, and what did not. */
  weekTasks: string;
  /** Log lines for the week. */
  weekLog: string;
  /** What is already scheduled next week. */
  upcoming: string;
};

export function buildGoalPrompt(context: GoalContext): string {
  return [
    "You are drafting next week's goals for Victor, a mechanical engineering student who",
    "built this system for himself. Propose exactly one goal per domain listed below.",
    "",
    "Rules:",
    "- A goal is one sentence, concrete, and finishable in a week.",
    "- Base it only on the material below. Do not invent progress, deadlines, or events.",
    "- If a current goal was not finished and still matters, carrying it forward is correct.",
    "- If there is nothing to go on for a domain, say so in `why` and keep `title` short.",
    "",
    `Domains: ${context.domains.map((d) => `${d.key} (${d.label})`).join(", ")}`,
    "",
    "Current goals:",
    context.currentGoals.trim() || "(none set)",
    "",
    "Tasks this week:",
    context.weekTasks.trim() || "(none)",
    "",
    "Log this week:",
    context.weekLog.trim() || "(nothing logged)",
    "",
    "Already scheduled next week:",
    context.upcoming.trim() || "(nothing)",
    "",
    "Reply with JSON only, no prose and no code fence:",
    '{"goals":[{"domain":"<key>","title":"<one sentence>","why":"<one short sentence>"}]}',
  ].join("\n");
}

export async function draftSprintGoals(context: GoalContext): Promise<DraftResult> {
  const result = await callModel(buildGoalPrompt(context));
  // `callModel` returns failures as values — no key, quota, a retired model — and each one
  // already carries a message written for a human.
  if (!result.ok) return { ok: false, message: result.text };

  let parsed;
  try {
    parsed = draftSchema.parse(extractJson(result.text));
  } catch {
    // The raw response is not shown: it is model output of unknown shape, and pasting it into
    // the UI is how a prompt-injected string reaches the screen looking like an app message.
    console.error("Goal draft was not usable JSON:", result.text.slice(0, 400));
    return { ok: false, message: "The model did not return goals in a usable shape. Try again." };
  }

  const allowed = new Set(context.domains.map((d) => d.key));
  const goals = parsed.goals
    // A goal for a domain that does not exist cannot be reviewed or applied — it would render
    // as a row with no label and approve into a column nothing reads.
    .filter((g) => allowed.has(g.domain))
    // One per domain. A model asked for one each occasionally returns two for the domain it
    // has most to say about, and the review UI is keyed by domain.
    .filter((g, i, all) => all.findIndex((o) => o.domain === g.domain) === i);

  if (goals.length === 0) {
    return { ok: false, message: "The model proposed nothing for any known domain." };
  }

  return { ok: true, goals };
}
