import { WorkTabs } from "@/components/site/work-tabs";
import { PageHeader, Panel } from "@/components/site/page-shell";
import { QuestionForm } from "@/components/site/question-form";
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

  const variantLabels = Object.fromEntries(RESUME_VARIANTS.map((v) => [v, buildResume(v).label]));
  const bullets = await collectBullets();

  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Career"
        title="Tailor"
        lede="Paste a posting for a variant and an order to lead with, or an application question for what to build the answer from. Both select from material that already exists and can never write anything new."
      />

      <WorkTabs />

      <div className="mt-8 space-y-4">
        <Panel title="Tailor a resume">
          <TailorForm variantLabels={variantLabels} />
        </Panel>

        {/* The other half of an application. Separate panel rather than a mode toggle: the
            two take different input and produce different output, and a toggle would hide
            whichever one Victor is not looking at behind a click he has to remember. */}
        <Panel title="Answer a posting question" collapsible defaultOpen={false}>
          <QuestionForm />
        </Panel>

        <Panel
          title={`What both can choose from · ${bullets.length}`}
          collapsible
          defaultOpen={false}
        >
          {/* Shown so the advice is checkable: if a bullet is not in this list, no suggestion
              can mention it, and the parser rejects any response that tries. */}
          <ul className="space-y-1.5">
            {bullets.map((b) => (
              <li key={b.id} className="text-sm text-muted-foreground">
                <span className="font-mono text-[0.62rem] text-foreground">{b.entry}</span> {b.text}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </main>
  );
}
