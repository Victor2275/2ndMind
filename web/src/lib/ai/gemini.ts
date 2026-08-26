import { GoogleGenAI } from "@google/genai";
import { unstable_cache } from "next/cache";

/**
 * The AI calls on the site: a summary of the day, a summary of the week, and the goal
 * drafter in `goal-drafts.ts`, which reaches `callModel` here.
 *
 * Two constraints shape everything here, and both come from Victor directly.
 *
 * **Budget.** The site runs at $0/month with a single exception: about $10 of AI credit
 * **per month**. `/private` is the page he opens most, and it is `force-dynamic`, so an
 * uncached call would hit the API on every load — several hundred requests a month to
 * re-summarise a day that has not changed since thirty seconds ago. Each summary is therefore
 * cached on its own tag, so a fresh one costs a tag invalidation rather than a page view.
 *
 * Measured 2026-08-25, from a cold cache: three loads of `/private` with unchanged input cost
 * **zero** calls, and changing the prompt cost exactly **one**. `callModel` logs every real
 * call, which is what makes that checkable rather than assumed.
 *
 * **Failure must be quiet.** No key, exhausted quota and a bad request all return a string
 * rather than throwing. A dashboard that 500s because a nice-to-have panel failed is worse
 * than one that says the panel is unavailable.
 *
 * Note on privacy: this sends vault and log content to Google. Victor approved the site
 * calling a model, but that approval does not extend to everything in the vault — so the
 * caller decides what to pass, and `buildContext` in the page keeps health data out.
 */

/** Long enough that opening the dashboard repeatedly is free; short enough to feel live. */
const SUMMARY_TTL_SECONDS = 60 * 60 * 6;

export const SUMMARY_CACHE_TAG = "ai-summary";

/** The placeholder shipped in `.env.example`, which must never be treated as a real key. */
const PLACEHOLDER_KEY = "your_temp_key_here";

/**
 * Flash, for cost: the budget is ~$10/month and this runs on the page Victor opens most.
 *
 * Was `gemini-2.5-flash` until 2026-08-25, when every call started returning 404 — "no longer
 * available to new users" — and the daily summary had been silently degrading to its fallback
 * string on the dashboard. The error names its own replacement, which is where this value
 * comes from. Worth knowing that a retired model does not fail loudly here: `callModel`
 * catches everything and returns a message, so the panel says "could not be generated" and
 * nothing else does. If the summary is ever blank, check the server log for an ApiError
 * before assuming the key is wrong.
 */
export const MODEL = "gemini-3.6-flash";

export type SummaryResult = {
  text: string;
  /** False when this is a fallback message rather than model output, so the UI can say so. */
  ok: boolean;
};

function unavailable(reason: string): SummaryResult {
  return { text: reason, ok: false };
}

/**
 * The configured key, or null when there is not a usable one.
 *
 * Separate from `callModel` so the caller can short-circuit *before* the cache. A missing key
 * is a configuration state, not a model failure: there is nothing to memoise, no request to
 * make, and going through `unstable_cache` to discover that costs a cache lookup and makes
 * the path untestable outside a Next request context.
 */
function apiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === PLACEHOLDER_KEY) return null;
  return key;
}

const NO_KEY = "Set GEMINI_API_KEY to turn this on. Everything else works without it.";

/**
 * One model call, uncached.
 *
 * Exported so `goal-drafts.ts` can reach it. Deliberately *not* cached there: drafting goals
 * happens on a button press, not a page load, and the caching in this file exists because
 * `/private` is `force-dynamic` and would otherwise re-summarise an unchanged day on every
 * view. A user-initiated draft is a request for a fresh take — serving a memoised one would
 * make pressing the button twice look broken.
 */
export async function callModel(prompt: string): Promise<SummaryResult> {
  const key = apiKey();
  if (!key) return unavailable(NO_KEY);

  // Logged on every real call, deliberately.
  //
  // Everything here is built on the assumption that the cache absorbs repeat views, and that
  // assumption was never observable — a cache that had quietly stopped working would look
  // exactly like one that was working, until the bill arrived. This is the line that makes it
  // checkable: load a page twice, and the second load must print nothing. It also gives a
  // rough running cost, since the prompt length is most of what is paid for.
  console.log(`Gemini call: ${MODEL}, ${prompt.length} chars`);

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });

    const text = response.text?.trim();
    return text ? { text, ok: true } : unavailable("The model returned nothing.");
  } catch (error) {
    // Logged rather than shown: an upstream error message can carry request details.
    console.error("Gemini API error:", error);
    return unavailable("The summary could not be generated just now.");
  }
}

/**
 * Cached by the exact prompt.
 *
 * Keying on the prompt is what makes this correct as well as cheap: the day's goals and log
 * change, the key changes, and a new summary is fetched. Nothing stale survives an actual
 * change in the input.
 */
const cachedSummary = unstable_cache(
  async (prompt: string) => {
    const result = await callModel(prompt);
    // Throw rather than return, so a failure is not what gets cached.
    //
    // `unstable_cache` stores whatever the function returns, and `callModel` deliberately
    // returns failures as values rather than throwing. Composed naively that means a single
    // 404 or a rate limit pins "the summary could not be generated" to the dashboard for the
    // full six hours, long after the cause has gone. A rejected promise is not stored, so
    // this converts the failure back into one at the cache boundary and the caller turns it
    // into a message again. Only successes occupy the cache.
    if (!result.ok) throw new Error(result.text);
    return result;
  },
  ["ai-daily-summary"],
  { tags: [SUMMARY_CACHE_TAG], revalidate: SUMMARY_TTL_SECONDS },
);

export async function generateDailySummary(
  logs: string,
  sprint: string,
): Promise<SummaryResult> {
  // Nothing to summarise is not a model call. This is the common case before the day starts.
  if (sprint.trim() === "" && logs.trim() === "") {
    return unavailable("Nothing logged yet today.");
  }

  // Nor is a missing key. Checked here rather than inside the cache for the reason on
  // `apiKey()`: there is nothing to cache about a configuration that has not been done.
  if (!apiKey()) return unavailable(NO_KEY);

  const prompt = [
    "You are summarising one day for Victor, who is writing this system for himself.",
    "Say what actually happened and what is still outstanding. Two or three sentences.",
    "Do not invent progress that is not in the input. If the log is empty, say so plainly.",
    "",
    "This week's goals:",
    sprint.trim() || "(none recorded)",
    "",
    "Today's log:",
    logs.trim() || "(nothing logged)",
  ].join("\n");

  try {
    return await cachedSummary(prompt);
  } catch (error) {
    // The message thrown above is the one `unavailable` produced, so it survives the round
    // trip intact and the UI still shows what actually went wrong.
    return unavailable(
      error instanceof Error ? error.message : "The summary could not be generated just now.",
    );
  }
}

/**
 * A week, summarised. The same shape as the day, over a seven-day window.
 *
 * Its own cache entry and its own tag: a day's log changing must not invalidate the week, and
 * invalidating the week must not cost a fresh daily call. They are separate questions asked of
 * separate windows, and sharing a tag would make each one pay for the other's churn.
 *
 * The TTL is longer than the daily one for the obvious reason — a week does not change as
 * often as a day — but the TTL is not what makes this cheap. The cache key is the prompt, so a
 * week whose logs have not changed produces the same key and costs nothing, and a week that
 * *has* changed produces a new key and should cost a call. That is the intended behaviour, not
 * a leak: the alternative is showing a summary that describes a week that no longer exists.
 */
const WEEKLY_TTL_SECONDS = 60 * 60 * 24;

export const WEEKLY_CACHE_TAG = "ai-weekly-summary";

const cachedWeekly = unstable_cache(
  async (prompt: string) => {
    const result = await callModel(prompt);
    if (!result.ok) throw new Error(result.text);
    return result;
  },
  ["ai-weekly-summary"],
  { tags: [WEEKLY_CACHE_TAG], revalidate: WEEKLY_TTL_SECONDS },
);

export async function generateWeeklySummary(
  /** One line per day, newest first, already summarised by the caller. */
  days: string,
  sprint: string,
): Promise<SummaryResult> {
  if (days.trim() === "") {
    return unavailable("Nothing logged this week yet.");
  }
  if (!apiKey()) return unavailable(NO_KEY);

  const prompt = [
    "You are summarising one week for Victor, who is writing this system for himself.",
    "Say what actually happened, what moved, and what did not. Three or four sentences.",
    "Prefer patterns over a list: which days had nothing, what recurred, what stalled.",
    "Do not invent progress that is not in the input. Do not congratulate.",
    "If a stated goal has no matching activity, say so plainly — that is the useful part.",
    "",
    "This week's goals:",
    sprint.trim() || "(none recorded)",
    "",
    "This week's log, newest day first:",
    days.trim(),
  ].join("\n");

  try {
    return await cachedWeekly(prompt);
  } catch (error) {
    // The message thrown above is the one `unavailable` produced, so it survives the round
    // trip intact and the UI still shows what actually went wrong.
    return unavailable(
      error instanceof Error ? error.message : "The summary could not be generated just now.",
    );
  }
}
