import { PageHeader, Panel } from "@/components/site/page-shell";
import { TailorForm } from "@/components/site/tailor-form";
import { requireSession } from "@/lib/auth/dal";
import { buildResume, RESUME_VARIANTS } from "@/lib/resume";

import { collectBullets } from "./actions";

/**
 * Resume tailoring.
 *
 * Its own page rather than a panel on `/private/work`: pasting a full job description needs
 * room, and the answer is a page of reading. Work is a dashboard, this is a tool.
 */

export const dynamic = "force-dynamic";

export const metadata = { title: "Tailor" };

export default async function TailorPage() {
  await requireSession();

  const variantLabels = Object.fromEntries(
    RESUME_VARIANTS.map((v) => [v, buildResume(v).label]),
  );
  const bullets = await collectBullets();

  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Career"
        title="Tailor"
        lede="Paste a posting; get a variant and an order to lead with. It selects from bullets that already exist and can never write a new one."
      />

      <div className="mt-8 space-y-4">
        <Panel title="Posting">
          <TailorForm variantLabels={variantLabels} />
        </Panel>

        <Panel title={`What it can choose from · ${bullets.length}`} collapsible defaultOpen={false}>
          {/* Shown so the advice is checkable: if a bullet is not in this list, no suggestion
              can mention it, and the parser rejects any response that tries. */}
          <ul className="space-y-1.5">
            {bullets.map((b) => (
              <li key={b.id} className="text-sm text-muted-foreground">
                <span className="font-mono text-[0.62rem] text-foreground">{b.entry}</span>{" "}
                {b.text}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </main>
  );
}
