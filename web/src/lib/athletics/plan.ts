import "server-only";

import {
  applyOverrides,
  assignRoutines,
  challengeFaults,
  parseChallenge,
  type Challenge,
  type PlanOverride,
  type Routine,
} from "./challenge";
import { listPlanOverrides } from "./queries";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { readVaultFileCached } from "@/lib/vault/write";

/**
 * The challenge, assembled the same way for every screen that reads it (D-276).
 *
 * Four screens now need it — Records, Plan, the Log, and the Today dashboard — and the order of
 * the three steps is load-bearing in a way that four hand-written copies would eventually get
 * wrong:
 *
 * 1. **Parse the vault**, which is the plan as written and is never rewritten by the app.
 * 2. **Merge the overrides**, so a day Victor changed reads the way he intends to do it.
 * 3. **Assign routines from the merged plan**, so changing a Sunday from water to erg also
 *    changes that day's stretching routine. Doing this before the merge would leave the routine
 *    matched to a session that is no longer happening.
 *
 * `faults` is computed on the **original**, not the merged plan. `challengeFaults` checks the
 * day rows against the totals stated in §1 of the vault file, and an override is a deliberate
 * disagreement with them — running it on the merged plan would report every edit Victor makes
 * as a vault bug.
 */
export const PLAN_FILE = "context/02_physical_performance/fall_2026_challenge.md";

/** Rule 4: a boat practice counts as this much toward the 5k-a-day average. */
export const PRACTICE_CREDIT_M = 5000;

export type LoadedPlan = {
  /** The plan as Victor intends to do it — vault plus overrides. Null when the file is gone. */
  challenge: Challenge | null;
  /** The plan as the vault states it, for the faults check and for "revert to this". */
  original: Challenge | null;
  overrides: Map<string, PlanOverride>;
  routines: Map<number, Routine>;
  faults: string[];
  /** Set when the vault could not be read. The database failing is reported separately. */
  vaultFailure: string | null;
};

const EMPTY: LoadedPlan = {
  challenge: null,
  original: null,
  overrides: new Map(),
  routines: new Map(),
  faults: [],
  vaultFailure: null,
};

export async function loadPlan(): Promise<LoadedPlan> {
  let markdown = "";
  try {
    markdown = (await readVaultFileCached(PLAN_FILE)).content;
  } catch (error) {
    return { ...EMPTY, vaultFailure: error instanceof Error ? error.message : String(error) };
  }

  const original = parseChallenge(markdown);
  if (!original) return EMPTY;

  // The database failing must not take the plan down with it — the vault half is the half that
  // says what to do today, and it is readable without Postgres. An unreachable database means
  // no overrides, which is the plan as written: the honest fallback, not a broken screen.
  let overrides = new Map<string, PlanOverride>();
  if (isDatabaseConfigured()) {
    try {
      overrides = await listPlanOverrides(db());
    } catch {
      overrides = new Map();
    }
  }

  const challenge = applyOverrides(original, overrides);

  return {
    challenge,
    original,
    overrides,
    routines: assignRoutines(challenge),
    faults: challengeFaults(original),
    vaultFailure: null,
  };
}
