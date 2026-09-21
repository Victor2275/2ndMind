import { describeDbError } from "@/lib/db/describe";
import { Unavailable } from "@/components/site/states";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader, Panel, Stat } from "@/components/site/page-shell";
import { SkeletonPanel, SkeletonStats } from "@/components/site/skeleton";
import { TaskList, type TaskView } from "@/components/site/task-list";
import { RequirementProgress } from "@/components/site/requirement-progress";
import { VaultDocument, loadVaultDoc } from "@/components/site/vault-document";
import { parseAudit } from "@/lib/academics/requirements";
import { getFrontmatterField } from "@/lib/vault/frontmatter";
import { readVaultFileCached } from "@/lib/vault/write";
import { publicProfile } from "@/lib/vault/public";
import type { Task } from "@/lib/db/schema";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { listTasks } from "@/lib/tasks/queries";

export const dynamic = "force-dynamic";

const toView = (task: Task): TaskView => ({
  id: task.id,
  title: task.title,
  source: task.source,
  domain: task.domain,
  courseCode: task.courseCode,
  dueAt: task.dueAt ? task.dueAt.toISOString() : null,
  done: task.doneAt !== null,
  tags: task.tags,
});

/**
 * Outstanding coursework. The tracker used to be `- [ ]` rows edited inside
 * `current_sprint.md`; it is the same task table as everything else now (D-037), so "what is
 * due" has one answer instead of three.
 */
async function Outstanding() {
  let academic: Task[] = [];
  let failure: string | null = null;

  if (isDatabaseConfigured()) {
    try {
      const all = await listTasks(db(), { limit: 200 });
      academic = all.filter((t) => t.domain === "academics" || t.courseCode !== null);
    } catch (error) {
      failure = describeDbError(error, { subject: "The tasks table" });
    }
  } else {
    failure = "DATABASE_URL is not set, so coursework tasks cannot load.";
  }

  const overdue = academic.filter((t) => t.dueAt !== null && t.dueAt < new Date()).length;

  /**
   * The GPA, through `publicProfile` rather than `loadProfile`.
   *
   * Rule 1 of the V4 plan — and `public.test.ts` enforces it for **every** file under
   * `src/app`, private routes included: a page imports the projection, never the loader. That
   * is not bureaucracy here, it is the reason the allowlist can be trusted at all; an exception
   * for "but this route is behind a passkey" is how the next exception gets made.
   *
   * It is also the right shape semantically. The GPA is published — it is on the resume and on
   * the public site — so it is exactly what the projection is for, and this page reads the same
   * field the resume does rather than a second copy.
   *
   * A missing or malformed value renders an em dash rather than `NaN`.
   */
  let gpa = "—";
  let graduation = "";
  try {
    const profile = publicProfile();
    gpa = Number.isFinite(profile.gpa) ? profile.gpa.toFixed(2) : "—";
    graduation = profile.graduation ? `grad ${profile.graduation}` : "";
  } catch {
    // The vault is unreadable, which the panels above already say. One message is enough.
  }

  return (
    <>
      {/* The list before the numbers that describe it, and three across rather than stacked
          (V3 §3.1). This is D-132's fix, applied to the page it was never applied to: two of
          these three stats restate the list below — "Open" is its length, "Overdue" is a
          subset of it — so leading with them meant scrolling past a summary of the answer to
          reach the answer. `sm:grid-cols-3` also stacked them below 640px, spending roughly
          290px of a phone screen on three single digits.
          Measured at 390px: the first task moved from 541px to the number in the sweep. */}
      <div className="mt-6">
        <Panel title="Outstanding">
          {failure ? (
            <Unavailable subject="Tasks" detail={failure} />
          ) : (
            <TaskList
              firstAction
              tasks={academic.map(toView)}
              emptyMessage="Nothing tracked. Add midterms and projects that outlive one week."
            />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Open" value={academic.length} />
        <Stat label="Overdue" value={overdue} tone={overdue > 0 ? "warn" : "default"} />
        {/* Q418 — the GPA belongs here. It is on the resume and on the public site already;
            withholding it from the private page that is *about* academics was an oversight, not
            a privacy decision. From the profile frontmatter, which is where the resume reads it,
            so there is one number rather than two that can drift.

            Graduation moved into the hint: it is a date three years out, which is context for
            the number beside it rather than a number that changes. */}
        <Stat label="GPA" value={gpa} hint={graduation} />
      </div>
    </>
  );
}

/**
 * What is left to graduate, from the DARS audit.
 *
 * Victor asked for the Record panel to read like DARS rather than like a course list, and
 * the thing DARS answers that a course list cannot is "what is still outstanding, and what
 * satisfies it". That question is now the panel, and the transcript-shaped history moved
 * below it into Coursework.
 *
 * The file is derived by `scripts/parse_dars.py`, never read from the saved audit: the audit
 * page carries a student ID, a high school, and every grade ever received, none of which
 * this page needs. Re-run the script when a new audit is saved.
 */
const AUDIT_PATH = "context/01_engineering/degree_audit.md";

async function Degree() {
  const doc = await loadVaultDoc(AUDIT_PATH);

  /**
   * Structure, not prose (§5.7, Q415).
   *
   * The same parser the planner uses (D-187), so the two screens cannot disagree about what is
   * outstanding. The totals come from the audit's frontmatter rather than from the parse: DARS
   * counts 35 requirements including the ones it has already met, and this file only lists the
   * open ones in full.
   */
  const requirements = parseAudit(doc.body);

  // The frontmatter, which `loadVaultDoc` strips out of `body`. `readVaultFileCached` is
  // memoised per request, so reading the same file twice costs one read.
  let frontmatter = "";
  try {
    frontmatter = (await readVaultFileCached(AUDIT_PATH)).content;
  } catch {
    // `doc.error` already covers this; the meter simply does not render.
  }
  const total = number(frontmatter, "requirements_total");
  const unfulfilled = number(frontmatter, "requirements_unfulfilled");

  return (
    // `mt-6` at `laptop`: this is the top of the second column there, so it aligns with the
    // first panel of the left column rather than hanging 8 units below it.
    <div className="mt-8 laptop:mt-6">
      <Panel
        title="Outstanding requirements"
        meta={doc.updated ? `audit ${doc.updated}` : undefined}
        collapsible
        defaultOpen
      >
        {doc.error ? (
          <Unavailable
            subject="The degree audit"
            detail="The audit file could not be read. Save a fresh DARS audit and run python scripts/parse_dars.py."
          />
        ) : (
          <RequirementProgress
            requirements={requirements}
            total={total}
            unfulfilled={unfulfilled}
          />
        )}
      </Panel>
    </div>
  );
}

/** Separate boundary: the vault read and the database call should not wait for each other. */
async function Record() {
  const doc = await loadVaultDoc("context/01_engineering/coursework_and_labs.md");
  return (
    <div className="mt-4">
      <Panel
        title="Coursework record"
        meta={doc.updated ? `updated ${doc.updated}` : undefined}
        collapsible
        defaultOpen={false}
      >
        <VaultDocument doc={doc} />
      </Panel>
    </div>
  );
}

/** One frontmatter field as a number, or null. */
function number(markdown: string, field: string): number | null {
  const raw = getFrontmatterField(markdown, field);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export default function AcademicsPage() {
  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Academics"
        title="Coursework"
        lede="What is left to graduate, and the work in front of it. Canvas still owns the week-to-week deadlines."
        actions={
          // The planner is desktop-only by design (§5.2), so this is the only way to it — and a
          // page nothing links to is a page nobody opens.
          <Link
            href="/private/academics/plan"
            className="nav-desktop min-h-10 rounded-md border border-primary/50 px-3 py-1.5 font-mono text-xs text-primary transition-colors hover:bg-primary/10"
          >
            Three-year plan
          </Link>
        }
      />

      {/* Two columns on a laptop (V4 §4.6, Q150), split by tense rather than by size.
          Left is the work in front of you — the tasks, and the numbers that describe them.
          Right is where you stand — the audit and the coursework record, both of which are
          vault documents you consult rather than act on.

          Even columns here, unlike Today's 1fr + 22rem: both sides are substantial, and a
          degree audit squeezed into a 22rem rail is the "wall of read-only text" Q130
          complains about, only narrower. Source order is preserved when they stack, so a
          phone still gets tasks → audit → record. */}
      <div className="grid gap-8 laptop:grid-cols-2 laptop:gap-6">
        <div className="min-w-0">
          <Suspense
            fallback={
              <>
                {/* Same order as the real thing, or the list jumps when it arrives. */}
                <div className="mt-6">
                  <SkeletonPanel rows={3} />
                </div>
                <SkeletonStats />
              </>
            }
          >
            <Outstanding />
          </Suspense>
        </div>

        <div className="min-w-0">
          <Suspense
            fallback={
              <div className="mt-8 laptop:mt-6">
                {/* The audit is a requirements structure, not a list of controls. */}
                <SkeletonPanel rows={4} shape="table" />
              </div>
            }
          >
            <Degree />
          </Suspense>

          <Suspense
            fallback={
              <div className="mt-4">
                {/* The academic record is prose plus a GPA line. */}
                <SkeletonPanel rows={2} shape="text" />
              </div>
            }
          >
            <Record />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
