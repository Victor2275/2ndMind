/**
 * Splits a project body into the four case-study sections, by heading.
 *
 * The vault carries a fixed skeleton per project (D-073): the problem and its constraint,
 * what was built, what did not work, and what it measured. `dropUnwritten` in `public.ts`
 * has already removed any of those that Victor has not written by the time a body reaches
 * here, so this only ever sees real prose.
 *
 * Two headings mean the same thing under two names, because `solenoid-bit-reader` answered
 * both questions before the skeleton existed and keeping its wording was better than giving
 * it duplicate sections (D-073): `Design decisions` is `Architecture`, and `Results` is
 * `Measured results`.
 *
 * Anything else — `Post-mortem`, a project's own subheadings — is returned with a null role
 * and renders as ordinary prose. This is deliberate: an unrecognised heading must degrade to
 * the old behaviour rather than disappear or be forced into a treatment it does not fit.
 *
 * No `server-only` import: this is pure string work, and it is tested directly.
 */

export type CaseStudyRole = "problem" | "architecture" | "failure" | "results";

export type CaseStudySection = {
  /** Null for the preamble and for headings outside the skeleton. */
  role: CaseStudyRole | null;
  /** Null for the preamble — the text before the first `##`. */
  heading: string | null;
  /** The section's markdown, without its heading line. */
  body: string;
};

const ROLES: Record<string, CaseStudyRole> = {
  "the problem": "problem",
  architecture: "architecture",
  "design decisions": "architecture",
  "what did not work": "failure",
  "measured results": "results",
  results: "results",
};

/**
 * The role decides the *treatment*, never the words. Each section keeps the heading its file
 * wrote — `solenoid-bit-reader` still says "Design decisions" and "Results", because D-073
 * kept that wording deliberately and a renderer quietly retitling an author's section is an
 * editorial act disguised as styling. Consistency across projects comes from the colour, the
 * card and the index, which is enough to make the rhythm read.
 */
export function roleFor(heading: string): CaseStudyRole | null {
  return ROLES[heading.trim().toLowerCase()] ?? null;
}

/**
 * Line-based rather than one multi-line regex, for the reason given in `frontmatter.ts`:
 * vault files are mixed CRLF and LF, and `$` under the `m` flag means end-of-line, so the
 * obvious regex silently matches nothing on half the files.
 */
export function splitCaseStudy(body: string): CaseStudySection[] {
  const lines = body.split(/\r?\n/);
  const sections: CaseStudySection[] = [];
  let current: { heading: string | null; lines: string[] } = { heading: null, lines: [] };

  const flush = () => {
    const text = current.lines.join("\n").trim();
    // The preamble is dropped when empty; a heading is kept even if `dropUnwritten` somehow
    // let an empty one through, because losing a heading silently is worse than an empty box.
    if (current.heading === null && text === "") return;
    sections.push({
      role: current.heading === null ? null : roleFor(current.heading),
      heading: current.heading,
      body: text,
    });
  };

  for (const line of lines) {
    const match = /^##[ \t]+(.+?)[ \t]*$/.exec(line);
    if (match) {
      flush();
      current = { heading: match[1], lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  flush();

  return sections;
}

/**
 * True when the body is worth rendering as a case study at all.
 *
 * One recognised section is enough. A project with only `## The problem` written should still
 * get the treatment — it reads as a deliberate opening rather than as a page that gave up,
 * and that is precisely the state most of the portfolio is in until the write-ups land.
 */
export function isCaseStudy(sections: CaseStudySection[]): boolean {
  return sections.some((s) => s.role !== null);
}
