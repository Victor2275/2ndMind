import { Suspense } from "react";

import { PageHeader, Panel, Stat } from "@/components/site/page-shell";
import { SkeletonPanel, SkeletonStats } from "@/components/site/skeleton";
import { TaskList, type TaskView } from "@/components/site/task-list";
import { VaultDocument, loadVaultDoc } from "@/components/site/vault-document";
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
      failure = error instanceof Error ? error.message : String(error);
    }
  } else {
    failure = "DATABASE_URL is not set, so coursework tasks cannot load.";
  }

  const overdue = academic.filter((t) => t.dueAt !== null && t.dueAt < new Date()).length;

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Open" value={academic.length} />
        <Stat label="Overdue" value={overdue} tone={overdue > 0 ? "warn" : "default"} />
        <Stat label="Graduation" value="Jun 2028" hint="3-year track" />
      </div>

      <div className="mt-8">
        <Panel title="Outstanding">
          {failure ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
              <p className="text-sm font-medium text-foreground">Tasks are unavailable.</p>
              <p className="mt-1 text-xs text-muted-foreground">{failure}</p>
            </div>
          ) : (
            <TaskList
              tasks={academic.map(toView)}
              emptyMessage="Nothing tracked. Add midterms and projects that outlive one week."
            />
          )}
        </Panel>
      </div>
    </>
  );
}

/** Separate boundary: the vault read and the database call should not wait for each other. */
async function Record() {
  const doc = await loadVaultDoc("context/01_engineering/coursework_and_labs.md");
  return (
    <div className="mt-4">
      <Panel
        title="Record"
        meta={doc.updated ? `updated ${doc.updated}` : undefined}
        collapsible
        defaultOpen={false}
      >
        <VaultDocument doc={doc} />
      </Panel>
    </div>
  );
}

export default function AcademicsPage() {
  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Academics"
        title="Coursework"
        lede="Midterms and multi-week projects. Canvas still owns the week-to-week deadlines."
      />

      <Suspense
        fallback={
          <>
            <SkeletonStats />
            <div className="mt-8">
              <SkeletonPanel rows={3} />
            </div>
          </>
        }
      >
        <Outstanding />
      </Suspense>

      <Suspense fallback={<div className="mt-4"><SkeletonPanel rows={1} /></div>}>
        <Record />
      </Suspense>
    </main>
  );
}
