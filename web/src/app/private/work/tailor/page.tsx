import { WorkTabs } from "@/components/site/work-tabs";
import { CoverLetterForm } from "@/components/site/cover-letter-form";
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
    <div className="pb-16">
      <PageHeader
        eyebrow="Career"
        title="Tailor"
        lede="Paste a posting for a variant and an order to lead with, an application question for what to build the answer from, or a full cover letter draft. All three are checkable against the same material — nothing is claimed that is not already in the vault."
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

        {/* Its own panel for the same reason as the question tool above — different input
            shape, different output, and it is the one tool here that drafts real prose rather
            than only selecting ids (see lib/ai/cover-letter.ts for what that changes). */}
        <Panel title="Draft a cover letter" collapsible defaultOpen={false}>
          <CoverLetterForm />
        </Panel>

        <Panel
          title={`What all three can choose from · ${bullets.length}`}
          collapsible
          defaultOpen={false}
        >
          {/* Shown so every tool above is checkable: if a bullet is not in this list, nothing
              can cite it or mention it, and the parser rejects any response that tries. */}
          {/* 7.1 text-floor allowlist (Q113): the entry id in front of each bullet. It is a
              citation key, there so the tools above are checkable, and the bullet it labels
              is `text-sm`. */}
          <ul data-tiny-text="citation keys in front of each bullet" className="space-y-1.5">
            {bullets.map((b) => (
              <li key={b.id} className="text-sm text-muted-foreground">
                <span className="font-mono text-[0.62rem] text-foreground">{b.entry}</span> {b.text}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
