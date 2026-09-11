import { Prose } from "@/components/site/prose";
import { cn } from "@/lib/utils";
import {
  isCaseStudy,
  sectionId,
  splitCaseStudy,
  type CaseStudyRole,
  type CaseStudySection,
} from "@/lib/vault/case-study";

/**
 * Renders a project body as a case study.
 *
 * The problem this solves: every section of a project write-up was styled identically, so the
 * one number Victor measured and the one thing he abandoned looked exactly like a paragraph
 * about the stack. Those two sections are the reason an engineer keeps reading — measured
 * results are the payload, and "what did not work" is the section almost no student portfolio
 * has at all.
 *
 * Three rules hold this together, and each of them exists because the alternative looks worse:
 *
 * 1. **A section keeps its own heading.** Role decides colour and container, never wording.
 * 2. **The index counts sections that are present**, not the role's position in the skeleton.
 *    Numbering by role would print `01 03 04` on a half-written project, which advertises the
 *    gap — the exact failure `dropUnwritten` exists to prevent (D-073).
 * 3. **One section is a case study.** Most of the portfolio is one or two sections until the
 *    write-ups land, and that state has to look deliberate rather than unfinished.
 *
 * An unrecognised heading (`## Post-mortem`, a project's own subheading) falls through to
 * plain `Prose`, exactly as before this component existed.
 */

/** Container and heading colour per role. The body text stays `Prose`'s in every case. */
const TREATMENT: Record<CaseStudyRole, { shell: string; heading: string; rule: string }> = {
  // The opener carries no container: a card around the first thing you read fights the page
  // title directly above it.
  problem: {
    shell: "",
    heading: "text-foreground",
    rule: "bg-border",
  },
  architecture: {
    shell: "",
    heading: "text-foreground",
    rule: "bg-border",
  },
  // Steel, the secondary accent. Cool rather than alarming — this section is evidence of
  // judgement, and colouring it like a warning would say the opposite.
  failure: {
    shell: "rounded-lg border border-secondary/40 bg-secondary/[0.07] p-5 sm:p-6",
    heading: "text-secondary",
    rule: "bg-secondary/50",
  },
  // Magenta, the primary accent, plus number emphasis inside. This is the loudest thing on
  // the page by design.
  results: {
    shell: "rounded-lg border border-primary/35 bg-primary/[0.06] p-5 sm:p-6",
    heading: "text-primary",
    rule: "bg-primary/60",
  },
};

function SectionHead({
  index,
  heading,
  role,
}: {
  index: string | null;
  heading: string;
  role: CaseStudyRole;
}) {
  const treatment = TREATMENT[role];
  return (
    <div className="flex items-center gap-3">
      {index && (
        <span className="tabular font-mono text-[0.62rem] tracking-[0.16em] text-muted-foreground">
          {index}
        </span>
      )}
      <h2 className={`text-base font-semibold tracking-tight ${treatment.heading}`}>{heading}</h2>
      {/* A rule running to the edge, so the four sections scan as a sequence on a phone
          where only one of them is on screen at a time. */}
      <span className={`h-px flex-1 ${treatment.rule}`} aria-hidden />
    </div>
  );
}

function PlainSection({ section }: { section: CaseStudySection }) {
  // Rebuild the markdown so an unrecognised section renders exactly as it did before.
  const markdown = section.heading ? `## ${section.heading}\n\n${section.body}` : section.body;
  return <Prose>{markdown}</Prose>;
}

/** Takes its body as children, the same shape as `Prose`, so the two are interchangeable. */
export function CaseStudy({ children }: { children: string }) {
  const sections = splitCaseStudy(children);

  // No recognised section at all — an older entry, or one whose headings were renamed. Render
  // it the way the site always has rather than imposing a structure that is not there.
  if (!isCaseStudy(sections)) return <Prose>{children}</Prose>;

  // Indices are computed before rendering rather than by incrementing a counter inside the
  // map: mutating a captured variable during render is what `react-hooks/immutability` exists
  // to stop, and a running counter would also be wrong if this ever rendered out of order.
  //
  // A lone section is not numbered — it does not need to be told it is the first of one.
  const total = sections.filter((s) => s.role !== null).length;
  const indices = new Map<number, string>();
  sections.forEach((section, i) => {
    if (section.role !== null && total > 1) {
      indices.set(i, String(indices.size + 1).padStart(2, "0"));
    }
  });

  return (
    <div className="space-y-8">
      {sections.map((section, i) => {
        if (section.role === null) {
          return <PlainSection key={i} section={section} />;
        }

        return (
          /* `scroll-mt-24` clears the sticky header. Without it, following a TOC link parks the
             heading underneath the header and the reader lands mid-paragraph. */
          <section
            key={i}
            id={sectionId(section.heading ?? "")}
            className={cn("scroll-mt-24", TREATMENT[section.role].shell)}
          >
            <SectionHead
              index={indices.get(i) ?? null}
              heading={section.heading ?? ""}
              role={section.role}
            />
            <div className="mt-3.5">
              <Prose numbers={section.role === "results"}>{section.body}</Prose>
            </div>
          </section>
        );
      })}
    </div>
  );
}
