import { Suspense } from "react";

import { PageHeader, Panel } from "@/components/site/page-shell";
import { SkeletonPanel } from "@/components/site/skeleton";
import { VaultDocument, loadVaultDoc } from "@/components/site/vault-document";

export const dynamic = "force-dynamic";

/**
 * Craft notes. Deliberately separate from Athletics: dragon boat *training* is health data in
 * Postgres, while fabrication and culinary are reference material in the vault. Merging them
 * would put bodyweight and rehab notes one click from a page about bread.
 */
const DOCS = [
  { title: "Fabrication and CAD", path: "context/03_craft_and_creative/fabrication_and_cad.md" },
  { title: "Culinary formulas", path: "context/03_craft_and_creative/culinary_formulas.md" },
];

async function Documents() {
  const docs = await Promise.all(DOCS.map((d) => loadVaultDoc(d.path)));

  return (
      <div className="mt-8 space-y-4">
        {DOCS.map((meta, i) => (
          <Panel
            key={meta.path}
            title={meta.title}
            meta={docs[i].updated ? `updated ${docs[i].updated}` : undefined}
            collapsible
            defaultOpen={false}
          >
            <VaultDocument doc={docs[i]} />
          </Panel>
        ))}
      </div>
  );
}

export default function HobbiesPage() {
  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Craft"
        title="Hobbies"
        lede="Ratios, machine settings, and process notes worth not losing."
      />
      <Suspense
        fallback={
          <div className="mt-8 space-y-4">
            <SkeletonPanel rows={1} />
            <SkeletonPanel rows={1} />
          </div>
        }
      >
        <Documents />
      </Suspense>
    </main>
  );
}
