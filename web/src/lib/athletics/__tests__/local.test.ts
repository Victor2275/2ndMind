import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/athletics/catalogue";
import {
  mergeCatalogue,
  mostRecentSetsByExercise,
  type LocalExercise,
  type LocalSession,
} from "@/lib/athletics/local";

/**
 * Reading the phone (V4 Phase 2++ Stage 5). Pure functions only — `localCatalogue`,
 * `localSessions` and friends need IndexedDB and are exercised end-to-end by
 * `session.test.ts` and the e2e suite instead.
 */

const set = (over: Partial<LocalSession["sets"][number]> = {}) => ({
  clientId: "s1",
  exercise: "Bench Press (Barbell)",
  setIndex: 0,
  setType: "normal",
  weightLbs: 185,
  reps: 5,
  distanceM: null,
  durationS: null,
  spm: null,
  rpe: null,
  completedAt: null,
  notes: "",
  pieceType: null,
  ...over,
});

const session = (over: Partial<LocalSession> = {}): LocalSession => ({
  clientId: "sess1",
  performedAt: new Date("2026-09-08"),
  title: "Push A",
  notes: "",
  exerciseNotes: {},
  sets: [set()],
  ...over,
});

describe("mostRecentSetsByExercise", () => {
  it("takes the newest session's sets for each exercise", () => {
    const sessions = [
      session({
        clientId: "newest",
        performedAt: new Date("2026-09-09"),
        sets: [set({ clientId: "a", weightLbs: 195 })],
      }),
      session({
        clientId: "older",
        performedAt: new Date("2026-09-01"),
        sets: [set({ clientId: "b", weightLbs: 185 })],
      }),
    ];

    const byExercise = mostRecentSetsByExercise(sessions);
    expect(byExercise.get("Bench Press (Barbell)")?.[0].weightLbs).toBe(195);
  });

  it("excludes the named session, so the current draft is not its own ghost", () => {
    const sessions = [
      session({ clientId: "current", sets: [set({ weightLbs: 999 })] }),
      session({
        clientId: "yesterday",
        performedAt: new Date("2026-09-07"),
        sets: [set({ weightLbs: 180 })],
      }),
    ];

    const byExercise = mostRecentSetsByExercise(sessions, "current");
    expect(byExercise.get("Bench Press (Barbell)")?.[0].weightLbs).toBe(180);
  });

  it("keeps different exercises separate", () => {
    const sessions = [
      session({
        sets: [
          set({ exercise: "Bench Press (Barbell)" }),
          set({ exercise: "Row (Barbell)", clientId: "s2" }),
        ],
      }),
    ];
    const byExercise = mostRecentSetsByExercise(sessions);
    expect(byExercise.has("Bench Press (Barbell)")).toBe(true);
    expect(byExercise.has("Row (Barbell)")).toBe(true);
  });

  it("sorts a session's own sets by index", () => {
    const sessions = [
      session({
        sets: [
          set({ clientId: "s2", setIndex: 1, weightLbs: 190 }),
          set({ clientId: "s1", setIndex: 0, weightLbs: 185 }),
        ],
      }),
    ];
    const sets = mostRecentSetsByExercise(sessions).get("Bench Press (Barbell)");
    expect(sets?.map((s) => s.weightLbs)).toEqual([185, 190]);
  });

  it("returns nothing for an exercise never logged", () => {
    expect(mostRecentSetsByExercise([session()]).has("Deadlift (Barbell)")).toBe(false);
  });
});

describe("mergeCatalogue", () => {
  const seeded = CATALOGUE.find((e) => e.name === "Bench Press (Barbell)")!;

  it("uses the bundle's copy when the mirror has no edits", () => {
    const mirrored: LocalExercise[] = [
      {
        ...seeded,
        clientId: "row-1",
        notes: "",
        restSeconds: null,
        archivedAt: null,
        howTo: "a stale bundled description",
        userEditedFields: [],
      },
    ];
    const merged = mergeCatalogue(mirrored);
    const found = merged.find((e) => e.seedKey === seeded.seedKey)!;
    expect(found.howTo).toBe(seeded.howTo);
  });

  it("uses the mirror's copy when a field was user-edited", () => {
    const mirrored: LocalExercise[] = [
      {
        ...seeded,
        clientId: "row-1",
        notes: "",
        restSeconds: 120,
        archivedAt: null,
        howTo: "Victor's own rewritten cue.",
        userEditedFields: ["howTo"],
      },
    ];
    const merged = mergeCatalogue(mirrored);
    const found = merged.find((e) => e.seedKey === seeded.seedKey)!;
    expect(found.howTo).toBe("Victor's own rewritten cue.");
    expect(found.clientId).toBe("row-1");
  });

  it("carries a real clientId even for an unedited seeded row", () => {
    const mirrored: LocalExercise[] = [
      {
        ...seeded,
        clientId: "row-9",
        notes: "",
        restSeconds: null,
        archivedAt: null,
        userEditedFields: [],
      },
    ];
    const merged = mergeCatalogue(mirrored);
    const found = merged.find((e) => e.seedKey === seeded.seedKey)!;
    // Editable immediately, without waiting for a second sync.
    expect(found.clientId).toBe("row-9");
  });

  it("keeps a hand-added exercise the seed does not know, matched by name", () => {
    const mirrored: LocalExercise[] = [
      {
        seedKey: null,
        clientId: "row-manual",
        name: "Victor's Special Curl",
        modality: "lift",
        equipment: "dumbbell",
        primaryMuscles: ["biceps"],
        secondaryMuscles: [],
        aliases: [],
        howTo: "",
        notes: "",
        restSeconds: null,
        archivedAt: null,
        userEditedFields: [],
      },
    ];
    const merged = mergeCatalogue(mirrored);
    expect(merged.some((e) => e.name === "Victor's Special Curl")).toBe(true);
  });
});
