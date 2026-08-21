import { VaultDocument } from "@/components/site/vault-document";

export const dynamic = "force-dynamic";

/**
 * Craft notes. Deliberately separate from Athletics: dragon boat *training* is health data
 * in Postgres, while the fabrication and culinary files are reference material in the vault.
 * Merging the two would put bodyweight and rehab notes one click from a page about bread.
 */
const DOCS = [
  {
    title: "Fabrication and CAD",
    path: "context/03_craft_and_creative/fabrication_and_cad.md",
  },
  {
    title: "Culinary formulas",
    path: "context/03_craft_and_creative/culinary_formulas.md",
  },
];

export default function HobbiesPage() {
  return (
    <main className="py-10">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-highlight">
        Craft
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Hobbies</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Reference material — ratios, machine settings, and process notes worth not losing.
      </p>

      <div className="mt-8 space-y-6">
        {DOCS.map((doc) => (
          <section key={doc.path} className="rounded-lg border border-border bg-card/70 p-5">
            <h2 className="mb-4 text-lg font-bold tracking-tight">{doc.title}</h2>
            <VaultDocument path={doc.path} />
          </section>
        ))}
      </div>
    </main>
  );
}
