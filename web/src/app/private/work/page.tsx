import { Suspense } from "react";

import { ApplicationsPanel } from "@/components/site/applications-panel";
import { WorkTabs } from "@/components/site/work-tabs";
import { PageHeader, Panel } from "@/components/site/page-shell";
import { SkeletonPanel } from "@/components/site/skeleton";
import { VaultDocument, loadVaultDoc } from "@/components/site/vault-document";
import { loadJobSheet } from "@/lib/jobs/load";

export const dynamic = "force-dynamic";

/**
 * Career operations: strategy and targets, read from the vault.
 *
 * Reads the applications sheet; never writes to it. The background script that scans Gmail
 * remains the only thing that maintains it, so there is still exactly one source of truth —
 * this is a view of it, not a second tracker. That distinction is why the page's original
 * refusal to show applications at all no longer applies: it was written when nothing here
 * could read the sheet, and the risk it guarded against was a competing writer.
 */
async function Documents() {
  // Both at once. Awaiting them in sequence was half the cost of this page.
  // All three at once. Awaiting them in sequence was half the cost of this page, and the
  // sheet is a third network call — the slowest of them, and on someone else's servers.
  const [pipeline, targets, sheet] = await Promise.all([
    loadVaultDoc("context/04_operations/internship_pipeline.md"),
    loadVaultDoc("context/01_engineering/career_targets.md"),
    loadJobSheet(),
  ]);

  return (
    <div className="mt-8 space-y-4">
      {/* First: it is the only panel here that changes daily. The vault documents below are
          strategy, read occasionally. */}
      <Panel title="Applications" collapsible defaultOpen>
        <ApplicationsPanel sheet={sheet} />
      </Panel>

      <Panel
        title="Pipeline"
        meta={pipeline.updated ? `updated ${pipeline.updated}` : undefined}
        collapsible
        defaultOpen
      >
        <VaultDocument doc={pipeline} />
      </Panel>

      {/* Reference rather than routine: closed by default so the page opens scannable. */}
      <Panel
        title="Targets"
        meta={targets.updated ? `updated ${targets.updated}` : undefined}
        collapsible
        defaultOpen={false}
      >
        <VaultDocument doc={targets} />
      </Panel>
    </div>
  );
}

export default function WorkPage() {
  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Career"
        title="Work"
        lede="Applications, read live from the sheet the mail script maintains, plus the strategy behind them. Nothing here writes to the sheet."
      />

      <WorkTabs />

      <Suspense
        fallback={
          <div className="mt-8 space-y-4">
            <SkeletonPanel rows={5} />
            <SkeletonPanel rows={1} />
          </div>
        }
      >
        <Documents />
      </Suspense>
    </main>
  );
}
