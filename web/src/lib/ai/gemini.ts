import { GoogleGenAI } from "@google/genai";
import { unstable_cache } from "next/cache";

/**
 * The one AI call on the site: a short summary of the day.
 *
 * Two constraints shape everything here, and both come from Victor directly.
 *
 * **Budget.** The site runs at $0/month with a single exception: about $10 of AI credit,
 * total. `/private` is the page he opens most, and it is `force-dynamic`, so an uncached call
 * would hit the API on every load — several hundred requests a month to re-summarise a day
 * that has not changed since thirty seconds ago. The result is therefore cached for
 * `SUMMARY_TTL_SECONDS` and tagged, so a fresh summary costs a tag invalidation rather than
 * a page view.
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

export type SummaryResult = {
  text: string;
  /** False when this is a fallback message rather than model output, so the UI can say so. */
  ok: boolean;
};

function unavailable(reason: string): SummaryResult {
  return { text: reason, ok: false };
}

async function callModel(prompt: string): Promise<SummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey === PLACEHOLDER_KEY) {
    return unavailable("Set GEMINI_API_KEY to turn this on. Everything else works without it.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
  async (prompt: string) => callModel(prompt),
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

  return cachedSummary(prompt);
}
