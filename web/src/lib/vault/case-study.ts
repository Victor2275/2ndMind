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

/**
 * A stable anchor for a section heading (V4 item 6.6, Q332).
 *
 * The table of contents and the headings it points at are rendered by two different components
 * — one a Client Component that watches scroll, the other server-rendered — so both derive the
 * id from the heading text with this, rather than one of them inventing ids and the other
 * guessing them.
 *
 * Prefixed because a heading like "Results" could collide with an element id elsewhere on the
 * page, and an anchor that jumps to the wrong place is worse than one that does nothing.
 */
export function sectionId(heading: string): string {
  const slug = heading
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `section-${slug || "untitled"}`;
}

/**
 * The first sentence of a section's markdown, for the opening summary block (Q333).
 *
 * Q333 asked the case study to open with problem / approach / result / stack. The first three
 * are prose that already exists further down the page, so this lifts a sentence rather than
 * asking Victor to write each one twice — a summary field that has to be maintained separately
 * from the section it summarises is a summary that goes stale.
 *
 * Deliberately conservative. Markdown emphasis, inline code and links are unwrapped, and a
 * sentence that is implausibly long or short returns `null` so the caller can hide the row
 * (Q331 — "clean if someone views it, including hiding missing information") rather than print
 * a fragment.
 */
export function firstSentence(body: string): string | null {
  const text = body
    // Drop fenced code, block quotes, list markers and headings before looking for prose.
    //
    // A list marker needs whitespace after it. Without that, `**Bold lead-in.** The rest…` —
    // which is how every "Design decisions" section in this vault opens — looks like a bullet
    // and the whole line is dropped. Vault prose is hard-wrapped, so dropping the first physical
    // line of a paragraph leaves the summary starting mid-sentence: the solenoid project's
    // Approach row read "north-up and a 0 as south-up would put half the signal below the
    // readable floor." on the real page before this was fixed.
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:[-*+]\s|\d+\.\s|>|#)/.test(line))
    .join(" ")
    // `[text](href)` -> `text`, then strip emphasis and inline code ticks.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;

  // A full stop followed by a space and a capital, or end of string. Decimal points and
  // abbreviations like "10 mph." inside a sentence survive because the lookahead needs the
  // space *and* the capital.
  const match = /^(.+?[.!?])(?=\s+[A-Z(]|$)/.exec(text);
  const sentence = (match ? match[1] : text).trim();

  if (sentence.length < 20 || sentence.length > 260) return null;
  return sentence;
}
