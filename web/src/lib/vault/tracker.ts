/**
 * The academic tracker's heading, kept out of the `"use server"` module.
 *
 * A `"use server"` file may only export async functions — exporting a constant from one is a
 * build error, which is how `GOAL_LABELS` ended up in `sprint-goals.ts`. Same fix here.
 */
export const TRACKER_HEADING = "3. Academic Tracker (Secondary to Canvas)";
