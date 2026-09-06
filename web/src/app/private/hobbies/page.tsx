import { Suspense } from "react";

import { PageHeader, Panel } from "@/components/site/page-shell";
import { SkeletonPanel } from "@/components/site/skeleton";
import { VaultDocument, loadVaultDoc } from "@/components/site/vault-document";
import { FilamentPanel } from "@/components/site/filament-panel";
import { PrinterPanel } from "@/components/site/printer-panel";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { listPrinters, listSpools } from "@/lib/fabrication/queries";

export const dynamic = "force-dynamic";

/**
 * Craft notes. Deliberately separate from Athletics: dragon boat *training* is health data in
 * Postgres, while fabrication and culinary are reference material in the vault. Merging them
 * would put bodyweight and rehab notes one click from a page about bread.
 */
const DOCS = [
  { title: "Fabrication and CAD", path: "context/03_craft_and_creative/fabrication_and_cad.md" },
];

/**
 * Recipes are not in this vault, and a panel saying so beats a panel that has fallen behind.
 *
 * `culinary_formulas.md` was retired to `99_archive/superseded/` on 2026-08-25: Victor keeps
 * recipes in Proof now, so the vault copy had become a second, staler source for the same
 * thing. The public *pursuit* (Precision Baking) is untouched — that is portfolio framing for
 * where Proof came from, not a recipe store, and it is the reason this link is worth showing
 * at all.
 */
const PROOF_URL = "https://proof-cdvj.onrender.com";

/**
 * Filament and printers (§5.1, D-189).
 *
 * Above the reference documents, because this is the part of the page that changes — a spool
 * runs out weekly and a CAD note does not. Reorder-first: the list arrives emptiest-first from
 * SQL, so the thing to buy is the thing at the top.
 */
async function Workshop() {
  if (!isDatabaseConfigured()) {
    return (
      <Panel title="Workshop" meta="no database">
        <p className="text-sm text-muted-foreground">
          Filament and printers live in Postgres. Set <code>DATABASE_URL</code> to use them.
        </p>
      </Panel>
    );
  }

  const handle = db();
  const [spools, machines] = await Promise.all([listSpools(handle), listPrinters(handle)]);

  return (
    <div className="mt-8 space-y-4">
      <Panel title="Filament" meta="emptiest first">
        <FilamentPanel spools={spools} />
      </Panel>
      <Panel title="Printers" meta="workshop">
        <PrinterPanel printers={machines} />
      </Panel>
    </div>
  );
}

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

      <Panel title="Recipes" meta="Proof">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Formulas live in Proof, not in this vault.
        </p>
        <a
          href={PROOF_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-md border border-primary/40 px-3.5 py-1.5 text-sm text-primary transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_20px_-6px_var(--primary)]"
        >
          Open Proof &rarr;
        </a>
      </Panel>
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
            <SkeletonPanel rows={2} />
            <SkeletonPanel rows={1} />
          </div>
        }
      >
        <Workshop />
      </Suspense>

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
