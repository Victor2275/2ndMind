import { CoursePlanner } from "@/components/site/course-planner";
import { PageHeader } from "@/components/site/page-shell";
import { Unavailable } from "@/components/site/states";
import { emptyPlan, parsePlan, PLAN_PATH } from "@/lib/academics/plan";
import { parseAudit } from "@/lib/academics/requirements";
import { readVaultFileCached } from "@/lib/vault/write";

/**
 * The three-year course planner (V3 §5.2, D-187).
 *
 * **Desktop-only, as specified** — deliberately no mobile work. This is a sit-down activity a
 * few times a year, and its first real use is Winter enrollment. It is reachable from Academics
 * and is not in the phone's tab bar.
 *
 * Both files are read here on the server: the audit for what is required, the plan for what is
 * intended. The plan file may not exist yet, which is the ordinary state before the first save
 * rather than an error.
 */
export const metadata = {
  title: "Course plan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const AUDIT_PATH = "context/01_engineering/degree_audit.md";

async function read(path: string): Promise<string | null> {
  try {
    // A missing plan file is the ordinary state before the first save, not an error — so the
    // page renders an empty grid rather than a failure.
    return (await readVaultFileCached(path)).content;
  } catch {
    return null;
  }
}

export default async function CoursePlanPage() {
  const [auditText, planText] = await Promise.all([read(AUDIT_PATH), read(PLAN_PATH)]);

  const requirements = auditText ? parseAudit(auditText) : [];
  const plan = planText ? parsePlan(planText) : emptyPlan();

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Academics"
        title="Course plan"
        lede="What is left, against the terms left to take it in. The audit says what is required; this says what is intended, and intending something does not make it offered."
      />

      {requirements.length === 0 ? (
        // The shared failure state (§5.1). It renders the command as something to copy rather
        // than as a phrase inside a paragraph, which is exactly what Q292 asked for and what
        // this box was a hand-written copy of.
        <Unavailable
          subject="The degree audit"
          detail="No audit was found. Save a fresh DARS audit and run `python scripts/parse_dars.py` to generate it."
          className="mt-8"
        />
      ) : (
        <CoursePlanner requirements={requirements} initial={plan} />
      )}
    </div>
  );
}
