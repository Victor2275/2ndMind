import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth/dal";
import { callModel } from "@/lib/ai/gemini";

/**
 * The fallback for a sentence the grammar could not read (V3 §4.3, D-186).
 *
 * Only reached when `parseSpoken` returns `null`. That ordering is the design: the grammar is
 * instant, free, works with no signal and is wrong the same way every time; this is none of
 * those things and exists for the phrasings nobody anticipated.
 *
 * **It still cannot save anything.** The answer fills the same form, which is submitted by
 * hand. Every number a model produces here is looked at by a person before it becomes a row —
 * which is the only reason a model is allowed near a training log at all.
 *
 * Session-gated, because it spends Victor's model quota.
 */
export const dynamic = "force-dynamic";

/**
 * The shape the model must answer in, and the shape the client is allowed to receive.
 *
 * Validated rather than trusted: this is a language model being asked for JSON, and the failure
 * mode is not malice but confidence — a string where a number belongs, a set with a weight of
 * `"heavy"`. Anything that does not fit is a refusal rather than a partially-filled form,
 * because a form filled with one wrong number is worse than one that stayed empty.
 */
const answer = z.object({
  kind: z.enum(["lift", "erg", "water", "conditioning"]),
  exercise: z.string().min(1).max(60),
  rpe: z.number().min(1).max(10).nullable(),
  sets: z
    .array(
      z.object({
        weightLbs: z.number().min(0).max(2000).optional(),
        reps: z.number().int().min(1).max(500).optional(),
        distance: z.number().min(0).max(200_000).optional(),
        duration: z
          .string()
          .regex(/^\d{1,3}:[0-5]\d$/)
          .optional(),
        spm: z.number().int().min(10).max(60).optional(),
      }),
    )
    .min(1)
    .max(12),
});

const PROMPT = `You convert a spoken sentence about a training session into JSON.

Answer with JSON only. No prose, no code fence.

Shape:
{"kind":"lift"|"erg"|"water"|"conditioning","exercise":string,"rpe":number|null,"sets":[{"weightLbs"?:number,"reps"?:number,"distance"?:number,"duration"?:"m:ss","spm"?:number}]}

Rules:
- distance is metres. Convert kilometres.
- duration is "m:ss".
- Repeat the set object when a number of sets is stated.
- Never invent a number that was not said. Omit the field instead.
- If the sentence does not describe a training session, answer exactly: null

Sentence: `;

export async function POST(request: Request) {
  await requireSession();

  const parsed = z
    .object({ transcript: z.string().min(1).max(400) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  const result = await callModel(`${PROMPT}${parsed.data.transcript}`);
  if (!result.ok) {
    return NextResponse.json({ error: "model unavailable" }, { status: 503 });
  }

  // Models fence JSON even when told not to, often enough that stripping it is cheaper than
  // being strict about it.
  const text = result.text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  if (text === "null") return NextResponse.json({ entry: null });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ entry: null });
  }

  const checked = answer.safeParse(json);
  // A refusal, not a partial fill. A form carrying one number the model invented is worse than
  // a form that stayed empty, because the empty one gets typed into and the other gets saved.
  if (!checked.success) return NextResponse.json({ entry: null });

  return NextResponse.json({ entry: checked.data });
}
