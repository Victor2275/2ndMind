import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  allDays,
  applyPracticeCredit,
  assignRoutines,
  challengeFaults,
  challengeProgress,
  dayFor,
  metersByDay,
  movementSlug,
  parseChallenge,
  parseGoals,
  parseRoutines,
  parseWeeks,
  routineFor,
  type Challenge,
} from "../challenge";

/**
 * Three kinds of test here, and the middle one is the unusual one.
 *
 * The fixture tests pin the parsing rules against small hand-written markdown. The vault tests
 * read Victor's real plan file and assert it still parses — the failure that actually matters,
 * because a reformat silently empties the panel and nothing else would catch it.
 *
 * And `challengeFaults` over the real file is an **arithmetic check on the plan itself**: the
 * day rows must be contiguous, the dates must not skip, and the metres in §4 must add up to the
 * total §1 claims. The plan was written by hand, so that total was wrong until this test said
 * so. It is the reason `challengeFaults` exists rather than the panel simply trusting the file.
 */

const VAULT = path.join(process.cwd(), "..", "context", "02_physical_performance");
const PLAN = "fall_2026_challenge.md";

function readVault(): string {
  return fs.readFileSync(path.join(VAULT, PLAN), "utf8");
}

function vaultChallenge(): Challenge {
  const parsed = parseChallenge(readVault());
  if (!parsed) throw new Error("the vault plan did not parse at all");
  return parsed;
}

const FIXTURE = `
## 1. The Challenge

- **Start**: 2026-09-20
- **End**: 2026-09-22
- **Days**: 3
- **Average target**: 5000 m per day
- **Planned total**: 21000 m
- **Required total**: 15000 m

### Rules

- **Rule 1**: one session a day.
- **Rule 2**: average 5000 m.

## 2. Goals

| Key | Goal | Target | Window | Measured by |
| --- | ---- | ------ | ------ | ----------- |
| hugh | Beat Hugh Jackman's 5k | 5000 m erg under 18:31 | 2026-12-04 | Time trial, erg |

## 4. The Days

### Week 0 · Day Zero

- **Dates**: 2026-09-20 → 2026-09-20
- **Volume**: 5000 m
- **Intent**: Start.

| Day | Date | Session | Type | Meters |
| --- | ---- | ------- | ---- | -----: |
| 0 | 2026-09-20 | **Day Zero** — Boat practice. | water | 5000 |

### Week 1 · First Blood

- **Dates**: 2026-09-21 → 2026-09-22
- **Volume**: 16000 m
- **Intent**: Find the engine.

| Day | Date | Session | Type | Meters |
| --- | ---- | ------- | ---- | -----: |
| 1 | 2026-09-21 | **Rolling Start** — 10k Z2, rate 20, split 2:15-2:25. | base | 10000 |
| 2 | 2026-09-22 | **Armour On** — 5k easy, then Strength A. | strength | 6000 |

## 6. Stretching Routines

### R1 · The Reset — \`the-reset\`

- **Pool**: recovery
- **Minutes**: 15

| Movement | Prescription | Why |
| -------- | ------------ | --- |
| Hamstring flossing | 1 min per side | Hinge, not spine |

### R5 · Catch Position — \`catch-position\`

- **Pool**: base
- **Minutes**: 10

| Movement | Prescription | Why |
| -------- | ------------ | --- |
| Ankle rock against a wall | 15 per side | Depth |
| Deep squat hold | 90 s | The whole position |

### R8 · Armour Check — \`armour-check\`

- **Pool**: strength
- **Minutes**: 10

| Movement | Prescription | Why |
| -------- | ------------ | --- |
| Pallof press | 3 x 10 per side | Keystone |

### R15 · Gunwale — \`gunwale\`

- **Pool**: water
- **Minutes**: 10

| Movement | Prescription | Why |
| -------- | ------------ | --- |
| Open book | 10 per side | Rotation |
`;

describe("parseChallenge", () => {
  it("reads the header block", () => {
    const parsed = parseChallenge(FIXTURE);
    expect(parsed).not.toBeNull();
    expect(parsed?.start).toBe("2026-09-20");
    expect(parsed?.end).toBe("2026-09-22");
    expect(parsed?.days).toBe(3);
    expect(parsed?.averageTargetM).toBe(5000);
    expect(parsed?.requiredTotalM).toBe(15000);
  });

  it("returns null rather than a half-built object when the section is missing", () => {
    expect(parseChallenge("# Nothing here\n")).toBeNull();
  });

  it("returns null when the dates are unreadable", () => {
    expect(parseChallenge("## 1. The Challenge\n\n- **Start**: soon\n")).toBeNull();
  });

  it("keeps the rules in vault order", () => {
    expect(parseChallenge(FIXTURE)?.rules).toHaveLength(2);
    expect(parseChallenge(FIXTURE)?.rules[0]).toMatch(/^Rule 1: one session/);
  });
});

describe("parseWeeks", () => {
  it("reads every week and its days", () => {
    const weeks = parseWeeks(FIXTURE);
    expect(weeks.map((week) => week.index)).toEqual([0, 1]);
    expect(weeks[1].name).toBe("First Blood");
    expect(weeks[1].from).toBe("2026-09-21");
    expect(weeks[1].to).toBe("2026-09-22");
    expect(weeks[1].volumeM).toBe(16000);
    expect(weeks[1].intent).toBe("Find the engine.");
  });

  it("splits a session into its name and its prescription", () => {
    const day = parseWeeks(FIXTURE)[1].days[0];
    expect(day.name).toBe("Rolling Start");
    expect(day.detail).toBe("10k Z2, rate 20, split 2:15-2:25.");
  });

  it("does not split on the hyphens inside a split range", () => {
    // The em dash is the separator precisely so "2:15-2:25" survives intact.
    expect(parseWeeks(FIXTURE)[1].days[0].detail).toContain("2:15-2:25");
  });

  it("drops the header row of every table", () => {
    const days = parseWeeks(FIXTURE).flatMap((week) => week.days);
    expect(days.map((day) => day.day)).toEqual([0, 1, 2]);
  });

  it("ignores a row whose type is not a session type", () => {
    const broken = FIXTURE.replace("| water | 5000 |", "| brunch | 5000 |");
    expect(parseWeeks(broken).flatMap((week) => week.days)).toHaveLength(2);
  });

  it("survives CRLF, which is how the vault is checked out on Windows", () => {
    const crlf = FIXTURE.replace(/\n/g, "\r\n");
    expect(parseWeeks(crlf).flatMap((week) => week.days)).toHaveLength(3);
  });
});

describe("parseGoals", () => {
  it("reads the goal table without absorbing the header", () => {
    const goals = parseGoals(FIXTURE);
    expect(goals).toHaveLength(1);
    expect(goals[0].key).toBe("hugh");
    expect(goals[0].target).toBe("5000 m erg under 18:31");
  });
});

describe("parseRoutines", () => {
  it("reads name, slug, pool and minutes", () => {
    const routines = parseRoutines(FIXTURE);
    expect(routines.map((routine) => routine.slug)).toEqual([
      "the-reset",
      "catch-position",
      "armour-check",
      "gunwale",
    ]);
    expect(routines[0].name).toBe("The Reset");
    expect(routines[0].pool).toBe("recovery");
    expect(routines[0].minutes).toBe(15);
  });

  it("reads the movement table", () => {
    const catchPosition = parseRoutines(FIXTURE)[1];
    expect(catchPosition.movements).toHaveLength(2);
    expect(catchPosition.movements[0].name).toBe("Ankle rock against a wall");
    expect(catchPosition.movements[0].prescription).toBe("15 per side");
    expect(catchPosition.movements[0].slug).toBe("ankle-rock-against-a-wall");
  });

  it("skips a routine whose pool is not one of the six", () => {
    const broken = FIXTURE.replace("- **Pool**: recovery", "- **Pool**: vibes");
    expect(parseRoutines(broken).map((routine) => routine.slug)).not.toContain("the-reset");
  });

  it("suffixes rather than drops a duplicate movement name", () => {
    const doubled = FIXTURE.replace(
      "| Deep squat hold | 90 s | The whole position |",
      "| Ankle rock against a wall | 30 s | Again |",
    );
    const slugs = parseRoutines(doubled)[1].movements.map((movement) => movement.slug);
    expect(slugs).toEqual(["ankle-rock-against-a-wall", "ankle-rock-against-a-wall-2"]);
  });
});

describe("assignRoutines", () => {
  it("gives every day a routine from its own pool", () => {
    const challenge = parseChallenge(FIXTURE)!;
    const assigned = assignRoutines(challenge);
    expect(assigned.get(0)?.slug).toBe("gunwale");
    expect(assigned.get(1)?.slug).toBe("catch-position");
    expect(assigned.get(2)?.slug).toBe("armour-check");
  });

  it("is deterministic across calls", () => {
    const challenge = vaultChallenge();
    const a = assignRoutines(challenge);
    const b = assignRoutines(challenge);
    for (const [day, routine] of a) expect(b.get(day)?.slug).toBe(routine.slug);
  });

  it("rotates within a pool rather than repeating one routine", () => {
    const challenge = vaultChallenge();
    const assigned = assignRoutines(challenge);
    const baseDays = allDays(challenge).filter((day) => day.type === "base");
    const used = new Set(baseDays.map((day) => assigned.get(day.day)?.slug));
    expect(used.size).toBe(3);
  });

  it("never repeats a routine on consecutive days", () => {
    // A property of the plan's own day ordering, not of the assignment — which is exactly why
    // it is asserted here: a week rewritten in the vault can break it, and this is what says so.
    const challenge = vaultChallenge();
    const assigned = assignRoutines(challenge);
    const days = allDays(challenge);
    for (let i = 1; i < days.length; i += 1) {
      const previous = assigned.get(days[i - 1].day)?.slug;
      const current = assigned.get(days[i].day)?.slug;
      expect(`${days[i].date} ${current}`).not.toBe(`${days[i].date} ${previous}`);
    }
  });

  it("pins the first fortnight, so reordering §6 fails loudly", () => {
    const challenge = vaultChallenge();
    const assigned = assignRoutines(challenge);
    const first = allDays(challenge)
      .slice(0, 14)
      .map((day) => assigned.get(day.day)?.slug);

    expect(first).toEqual([
      "gunwale",
      "catch-position",
      "armour-check",
      "rotation-primer",
      "fast-twitch",
      "hinge-prep",
      "lat-and-lock",
      "seat-saver",
      "catch-position",
      "press-and-pull",
      "rotation-primer",
      "race-face",
      "armour-check",
      "gunwale",
    ]);
  });
});

describe("movementSlug", () => {
  it("namespaces by routine so the same movement in two routines is two rows", () => {
    const routines = parseRoutines(FIXTURE);
    const reset = routines[0];
    expect(movementSlug(reset, reset.movements[0])).toBe("the-reset/hamstring-flossing");
  });

  it("never collides with a legacy rehab-protocol slug, which carries no slash", () => {
    const challenge = vaultChallenge();
    for (const routine of challenge.routines) {
      for (const movement of routine.movements) {
        expect(movementSlug(routine, movement)).toContain("/");
      }
    }
  });
});

describe("metersByDay", () => {
  it("sums distance per day and ignores sets that carry none", () => {
    const byDay = metersByDay([
      { performedAt: new Date("2026-09-21T17:00:00Z"), distanceM: 5000 },
      { performedAt: new Date("2026-09-21T18:00:00Z"), distanceM: 2000 },
      { performedAt: new Date("2026-09-21T18:05:00Z"), distanceM: null },
      { performedAt: new Date("2026-09-22T17:00:00Z"), distanceM: 3000 },
    ]);
    expect(byDay.get("2026-09-21")).toBe(7000);
    expect(byDay.get("2026-09-22")).toBe(3000);
  });

  it("keys on the local day, not the UTC one", () => {
    // 8pm in Los Angeles on the 21st is already the 22nd in UTC. Keying on UTC would file half
    // of every evening's training on the wrong day and break the streak every other night.
    const evening = new Date("2026-09-22T03:00:00Z");
    const byDay = metersByDay([{ performedAt: evening, distanceM: 6000 }]);
    expect(byDay.get(evening.toLocaleDateString("en-CA"))).toBe(6000);
    expect([...byDay.keys()]).toHaveLength(1);
  });

  it("returns an empty map rather than throwing on no efforts", () => {
    expect(metersByDay([]).size).toBe(0);
  });
});

describe("applyPracticeCredit", () => {
  const challenge = parseChallenge(FIXTURE)!;

  it("raises a logged water day to the practice credit", () => {
    const credited = applyPracticeCredit(challenge, new Map([["2026-09-20", 0.5]]), 5000);
    expect(credited.get("2026-09-20")).toBe(5000);
  });

  it("never invents a day that was not logged at all", () => {
    const credited = applyPracticeCredit(challenge, new Map(), 5000);
    expect(credited.has("2026-09-20")).toBe(false);
  });

  it("leaves a water day that already beat the credit alone", () => {
    const credited = applyPracticeCredit(challenge, new Map([["2026-09-20", 9000]]), 5000);
    expect(credited.get("2026-09-20")).toBe(9000);
  });

  it("does not credit a day that is not a practice", () => {
    const credited = applyPracticeCredit(challenge, new Map([["2026-09-21", 1000]]), 5000);
    expect(credited.get("2026-09-21")).toBe(1000);
  });

  it("does not mutate the map it was given", () => {
    const logged = new Map([["2026-09-20", 100]]);
    applyPracticeCredit(challenge, logged, 5000);
    expect(logged.get("2026-09-20")).toBe(100);
  });

  it("credits race day, which is a day of marshalling around 500 m of racing", () => {
    const vault = vaultChallenge();
    const credited = applyPracticeCredit(vault, new Map([["2026-11-07", 500]]), 5000);
    expect(credited.get("2026-11-07")).toBe(5000);
  });
});

describe("challengeProgress", () => {
  const challenge = parseChallenge(FIXTURE)!;

  it("counts only days inside the window", () => {
    const logged = new Map([
      ["2026-09-19", 9000],
      ["2026-09-20", 5000],
      ["2026-09-21", 6000],
    ]);
    const progress = challengeProgress(challenge, logged, new Date("2026-09-21T18:00:00Z"));
    expect(progress.daysElapsed).toBe(2);
    expect(progress.loggedM).toBe(11000);
  });

  it("reports the bank against the pace line", () => {
    const logged = new Map([
      ["2026-09-20", 5000],
      ["2026-09-21", 9000],
    ]);
    const progress = challengeProgress(challenge, logged, new Date("2026-09-21T18:00:00Z"));
    expect(progress.paceM).toBe(10000);
    expect(progress.bankM).toBe(4000);
  });

  it("says what each remaining day still needs", () => {
    const logged = new Map([["2026-09-20", 3000]]);
    const progress = challengeProgress(challenge, logged, new Date("2026-09-20T18:00:00Z"));
    expect(progress.daysRemaining).toBe(2);
    expect(progress.neededPerDayM).toBe(6000);
  });

  it("reports zero still needed once the total is met", () => {
    const logged = new Map([["2026-09-20", 20000]]);
    const progress = challengeProgress(challenge, logged, new Date("2026-09-20T18:00:00Z"));
    expect(progress.neededPerDayM).toBe(0);
  });

  it("does not break the streak before today has been logged", () => {
    const logged = new Map([
      ["2026-09-20", 5000],
      ["2026-09-21", 5000],
    ]);
    const progress = challengeProgress(challenge, logged, new Date("2026-09-22T09:00:00Z"));
    expect(progress.streak).toBe(2);
  });

  it("counts today once it is logged", () => {
    const logged = new Map([
      ["2026-09-20", 5000],
      ["2026-09-21", 5000],
      ["2026-09-22", 5000],
    ]);
    const progress = challengeProgress(challenge, logged, new Date("2026-09-22T21:00:00Z"));
    expect(progress.streak).toBe(3);
  });

  it("breaks the streak on a genuinely missed day", () => {
    const logged = new Map([
      ["2026-09-20", 5000],
      ["2026-09-22", 5000],
    ]);
    const progress = challengeProgress(challenge, logged, new Date("2026-09-22T21:00:00Z"));
    expect(progress.streak).toBe(1);
    expect(progress.longestStreak).toBe(1);
  });

  it("reports today as null before the challenge starts", () => {
    const progress = challengeProgress(challenge, new Map(), new Date("2026-09-01T12:00:00Z"));
    expect(progress.today).toBeNull();
    expect(progress.daysElapsed).toBe(0);
  });

  it("clamps after the challenge ends rather than running past it", () => {
    const progress = challengeProgress(challenge, new Map(), new Date("2027-01-01T12:00:00Z"));
    expect(progress.today).toBeNull();
    expect(progress.daysElapsed).toBe(3);
    expect(progress.daysRemaining).toBe(0);
  });
});

describe("the vault plan", () => {
  it("parses", () => {
    const challenge = vaultChallenge();
    expect(challenge.start).toBe("2026-09-20");
    expect(challenge.end).toBe("2026-12-04");
    expect(challenge.days).toBe(76);
  });

  it("has a row for all 76 days, contiguous and correctly dated", () => {
    const days = allDays(vaultChallenge());
    expect(days).toHaveLength(76);
    expect(days[0].date).toBe("2026-09-20");
    expect(days[75].date).toBe("2026-12-04");
  });

  it("adds up — the day rows total what §1 claims", () => {
    expect(challengeFaults(vaultChallenge())).toEqual([]);
  });

  it("clears the 5k-a-day requirement with room to spare", () => {
    const challenge = vaultChallenge();
    const planned = allDays(challenge).reduce((sum, day) => sum + day.meters, 0);
    expect(planned).toBeGreaterThan(challenge.requiredTotalM);
  });

  it("carries all four goals", () => {
    expect(vaultChallenge().goals.map((goal) => goal.key)).toEqual([
      "hugh",
      "perg500",
      "perg50k",
      "erg100k",
    ]);
  });

  it("carries fifteen routines, every one with movements", () => {
    const routines = vaultChallenge().routines;
    expect(routines).toHaveLength(15);
    for (const routine of routines) expect(routine.movements.length).toBeGreaterThan(3);
  });

  it("puts the two epics on the days the goals name", () => {
    const challenge = vaultChallenge();
    expect(dayFor(challenge, "2026-10-18")?.type).toBe("epic");
    expect(dayFor(challenge, "2026-11-22")?.type).toBe("epic");
  });

  it("marks race day", () => {
    expect(dayFor(vaultChallenge(), "2026-11-07")?.type).toBe("race");
  });

  it("schedules five time trials — four 5k tests plus the perg 500", () => {
    const tests = allDays(vaultChallenge()).filter((day) => day.type === "test");
    expect(tests.map((day) => day.date)).toEqual([
      "2026-09-24",
      "2026-10-08",
      "2026-11-12",
      "2026-12-01",
      "2026-12-04",
    ]);
  });

  it("puts a 5k test in each of the four blocks that carry one", () => {
    // The `hugh` goal is judged on a trajectory, not one morning. Losing one of these to a
    // rewrite would leave the last day as the only evidence, which is the thing to avoid.
    const fiveKs = allDays(vaultChallenge()).filter(
      (day) => day.type === "test" && /5k|HUGH/i.test(day.name),
    );
    expect(fiveKs.map((day) => day.date)).toEqual([
      "2026-09-24",
      "2026-10-08",
      "2026-11-12",
      "2026-12-04",
    ]);
  });

  it("keeps intensity to roughly 15% of days", () => {
    const days = allDays(vaultChallenge());
    const hard = days.filter(
      (day) => day.type === "quality" || day.type === "test" || day.type === "race",
    );
    expect(hard.length / days.length).toBeLessThan(0.2);
  });

  it("gives every day a routine", () => {
    const challenge = vaultChallenge();
    for (const day of allDays(challenge)) {
      expect(routineFor(challenge, day)).not.toBeNull();
    }
  });

  it("has no day without boat practice on a weekend outside the two stated exceptions", () => {
    // Rule 4 credits practice with 5,000 m; a weekend that quietly stopped being a `water` day
    // would silently drop 5k from the plan's total and nobody would notice in the prose.
    const challenge = vaultChallenge();
    const exceptions = new Set([
      "2026-09-26",
      "2026-09-27",
      "2026-10-18",
      "2026-11-07",
      "2026-11-08",
      "2026-11-22",
      "2026-11-28",
      "2026-11-29",
    ]);

    for (const day of allDays(challenge)) {
      const weekday = new Date(`${day.date}T00:00:00.000Z`).getUTCDay();
      if (weekday !== 0 && weekday !== 6) continue;
      if (exceptions.has(day.date)) continue;
      expect(`${day.date}:${day.type}`).toMatch(/:(water|long)$/);
    }
  });
});
