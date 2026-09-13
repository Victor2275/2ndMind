import type { Modality } from "@/lib/athletics/catalogue";
import type { SetInput } from "@/lib/athletics/session";

/**
 * Which set columns a modality asks for, shared between the session logger and the recent-
 * sessions editor so the two cannot drift apart (they used to: `RecentSessions` only ever grew
 * weight/reps inputs, which is why an erg piece's own results were invisible after logging it).
 */
export const FIELDS_FOR: Record<Modality, (keyof SetInput)[]> = {
  lift: ["weightLbs", "reps"],
  erg: ["distanceM", "durationS", "spm"],
  water: ["distanceM", "durationS", "spm"],
  conditioning: ["distanceM", "durationS"],
};

export const COLUMN_LABEL: Partial<Record<keyof SetInput, string>> = {
  weightLbs: "lbs",
  reps: "reps",
  distanceM: "metres",
  durationS: "time (m:ss)",
  spm: "spm",
};
