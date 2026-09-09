import { NextResponse } from "next/server";
import { z } from "zod";

import { callModel } from "@/lib/ai/gemini";
import { MUSCLES } from "@/lib/athletics/catalogue";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { exercises } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/dal";
import { isNull } from "drizzle-orm";

/**
 * "AI ADD" — describe a movement, get a catalogue entry back (V4 Phase 2.3, Q391).
 *
 * ## It proposes; it never saves
 *
 * The same rule D-186 set for voice, and for the same reason: a model that can write to a
 * training log is a model that can quietly invent a personal record. This route returns a
 * **suggestion**. The client shows it, and adding it to the catalogue is a separate action the
 * person takes — `addExercise` in `lib/athletics/session.ts`, which is the only writer.
 *
 * ## Matching first, creating second
 *
 * The most common answer is that the movement is already in the catalogue under a name you did
 * not think of — "incline press" is "Incline Bench Press". A model that only ever creates would
 * fill the catalogue with near-duplicates, and near-duplicates are worse than a missing entry:
 * they split a lift's history in two, so the PR board shows a lower best for both.
 *
 * So the existing names are given to the model and a match is the preferred answer. Fuzzy search
 * already covers typos (`lib/athletics/exercise-search.ts`); this covers *description* — the case
 * where you know what you did and not what it is called.
 *
 * ## Offline
 *
 * It cannot work, and the button says so rather than disappearing (Victor's call). Hiding it
 * would mean the one screen designed to work in a gym basement quietly changes shape depending
 * on the signal, which is a worse surprise than a message.
 *
 * Session-gated, because it spends Victor's model quota.
 */
export const dynamic = "force-dynamic";

/**
 * The shape the model must answer in, and the only shape the client is allowed to receive.
 *
 * Validated rather than trusted. The failure mode with a language model is not malice but
 * confidence — a muscle group it invented, a modality that is not one of the four — and a
 * catalogue entry with a made-up modality would make the session form ask for the wrong fields
 * for the life of that exercise.
 */
const answer = z.object({
  /** An existing catalogue name, when the movement is already there under another name. */
  match: z.string().min(1).max(200).nullable(),
  create: z
    .object({
      name: z.string().min(1).max(200),
      modality: z.enum(["lift", "erg", "water", "conditioning"]),
      muscles: z.array(z.enum(MUSCLES)).max(4),
      equipment: z.string().max(40),
    })
    .nullable(),
});

export type Suggestion = z.infer<typeof answer>;

const request = z.object({ text: z.string().min(2).max(400) });

export async function POST(req: Request) {
  await requireSession();

  const body = request.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Describe the movement first." }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "No catalogue to match against." }, { status: 503 });
  }

  const rows = await db()
    .select({ name: exercises.name })
    .from(exercises)
    .where(isNull(exercises.deletedAt));
  const names = rows.map((row) => row.name);

  const prompt = [
    "You map a description of a gym or rowing movement onto an exercise catalogue.",
    "",
    "Answer with JSON only, matching exactly this shape:",
    '{"match": string|null, "create": {"name": string, "modality": "lift"|"erg"|"water"|"conditioning", "muscles": string[], "equipment": string}|null}',
    "",
    "Rules:",
    "- If the description is one of the catalogue names below, or an obvious alias of one, set `match` to that exact name and `create` to null.",
    "- Only if nothing in the catalogue fits, set `match` to null and propose `create`.",
    `- \`muscles\` must be chosen from: ${MUSCLES.join(", ")}. Use at most four, primary movers only. Use [] for erg, water and conditioning work.`,
    "- `modality` decides which fields get asked for: `lift` means weight and reps; `erg` and `water` mean distance, time and stroke rate.",
    "- `name` is written in Title Case, as a catalogue would.",
    "",
    `Catalogue (${names.length}): ${names.join(", ")}`,
    "",
    `Description: ${body.data.text}`,
  ].join("\n");

  const result = await callModel(prompt);
  if (!result.ok) {
    return NextResponse.json({ error: result.text }, { status: 503 });
  }

  // The model is asked for JSON and sometimes wraps it in a fence, which is not worth a retry.
  const raw = result.text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "");
  const parsed = answer.safeParse(JSON.parse(raw ?? "null"));

  if (!parsed.success) {
    // A partially-filled answer is worse than none: the person would confirm an entry whose
    // modality is wrong, and every future set of that exercise would ask for the wrong fields.
    return NextResponse.json(
      { error: "The model did not answer in a usable shape." },
      { status: 502 },
    );
  }

  // A match the catalogue does not actually contain is a hallucination, and it is the one the
  // model is most likely to produce — it has just been shown a list and asked to pick from it.
  if (parsed.data.match && !names.includes(parsed.data.match)) {
    return NextResponse.json({ match: null, create: parsed.data.create });
  }

  return NextResponse.json(parsed.data);
}
