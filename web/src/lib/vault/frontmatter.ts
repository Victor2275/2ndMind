/**
 * Frontmatter surgery on raw vault markdown.
 *
 * Pure and dependency-free on purpose: it is the part of the write path most likely to be
 * subtly wrong, and it must be testable without a network round trip or a filesystem. It
 * also runs against content fetched from the GitHub API, which is why it takes strings
 * rather than paths.
 *
 * Two regex traps this module must stay clear of. Both fail silently rather than throwing,
 * which is why they are called out here and covered by tests:
 *
 * 1. The vault is CRLF on Windows and LF once git normalises it, so every pattern accepts
 *    both. A bare LF matches nothing against a CRLF file — a mistake already made once in
 *    this codebase, by `stripInternalSections`.
 * 2. Section patterns need the `m` flag for `^##`, which also redefines `$` to mean
 *    end-of-line. A lazy body match terminated by `$` therefore captures the empty string,
 *    and an edit lands in the wrong place while looking plausible. End-of-input is spelled
 *    `(?![\s\S])` for that reason.
 */

export type FrontmatterSplit = {
  frontmatter: string;
  body: string;
  /** The line ending the file actually uses, so edits do not mix the two. */
  eol: "\n" | "\r\n";
};

export function splitFrontmatter(raw: string): FrontmatterSplit | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n)([\s\S]*)$/);
  if (!match) return null;
  const [, frontmatter, eol, body] = match;
  return { frontmatter, body, eol: eol === "\r\n" ? "\r\n" : "\n" };
}

export function joinFrontmatter(parts: FrontmatterSplit): string {
  const { frontmatter, body, eol } = parts;
  return `---${eol}${frontmatter}${eol}---${eol}${body}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sets a scalar field in the frontmatter, adding it if absent.
 *
 * Only the first occurrence at the top level is replaced, and only when it appears at the
 * start of a line — so a `title:` containing the word "updated:" is left alone, and a nested
 * key under a mapping is not mistaken for a top-level one.
 */
export function setFrontmatterField(raw: string, field: string, value: string): string {
  const parts = splitFrontmatter(raw);
  if (!parts) throw new Error("file has no frontmatter");

  const pattern = new RegExp(`^${field}:[ \\t]*.*$`, "m");
  const line = `${field}: ${value}`;

  parts.frontmatter = pattern.test(parts.frontmatter)
    ? parts.frontmatter.replace(pattern, line)
    : `${line}${parts.eol}${parts.frontmatter}`;

  return joinFrontmatter(parts);
}

export function getFrontmatterField(raw: string, field: string): string | null {
  const parts = splitFrontmatter(raw);
  if (!parts) return null;
  const match = parts.frontmatter.match(new RegExp(`^${field}:[ \\t]*(.*)$`, "m"));
  return match ? match[1].trim() : null;
}

/** Every write bumps `updated:` — a non-negotiable from web/context.md. */
export function bumpUpdated(raw: string, today: string = todayISO()): string {
  return setFrontmatterField(raw, "updated", today);
}

/**
 * Replaces the content of a `## Heading` section, leaving the heading and everything after
 * the next same-level heading untouched. This is how the sprint editor rewrites goals
 * without the user ever typing markdown.
 */
export function replaceSection(raw: string, heading: string, content: string): string {
  const parts = splitFrontmatter(raw);
  const target = parts ? parts.body : raw;
  const eol = parts?.eol ?? (target.includes("\r\n") ? "\r\n" : "\n");

  // Escape the heading: section titles contain regex metacharacters like "(" and ".".
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(^##[ \\t]+${escaped}[ \\t]*\\r?\\n)([\\s\\S]*?)(?=\\r?\\n##[ \\t]|(?![\\s\\S]))`,
    "m",
  );

  if (!pattern.test(target)) {
    throw new Error(`no "## ${heading}" section found`);
  }

  const normalised = content.replace(/\r?\n/g, eol).trimEnd();
  const updated = target.replace(pattern, (_m, head: string) => `${head}${normalised}${eol}`);

  if (!parts) return updated;
  return joinFrontmatter({ ...parts, body: updated });
}

/** Appends to the end of a `## Heading` section rather than replacing it. */
export function appendToSection(raw: string, heading: string, content: string): string {
  const parts = splitFrontmatter(raw);
  const target = parts ? parts.body : raw;
  const eol = parts?.eol ?? (target.includes("\r\n") ? "\r\n" : "\n");

  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(^##[ \\t]+${escaped}[ \\t]*\\r?\\n)([\\s\\S]*?)(?=\\r?\\n##[ \\t]|(?![\\s\\S]))`,
    "m",
  );
  const match = target.match(pattern);
  if (!match) throw new Error(`no "## ${heading}" section found`);

  const existing = match[2].trimEnd();
  const addition = content.replace(/\r?\n/g, eol).trimEnd();
  const merged = existing ? `${existing}${eol}${eol}${addition}` : addition;

  const updated = target.replace(pattern, (_m, head: string) => `${head}${merged}${eol}`);
  if (!parts) return updated;
  return joinFrontmatter({ ...parts, body: updated });
}

/**
 * Replaces the value of a `- **Label:** value` bullet, leaving the rest of the file alone.
 *
 * Surgical by design. The sprint file's goals sit alongside a build-status subsection under
 * the same heading, so a section-level replace would take that with it too. Editing exactly
 * one line is both safer and closer to what the UI actually means.
 */
const METACHARS = /[.*+?^${}()|[\]\\]/g;

export function setLabelledBullet(raw: string, label: string, value: string): string {
  const escaped = label.replace(METACHARS, "\\$&");
  const pattern = new RegExp(`^([ \\t]*-[ \\t]+\\*\\*${escaped}:\\*\\*)[ \\t]*.*$`, "m");
  if (!pattern.test(raw)) throw new Error(`no bullet labelled "${label}"`);
  // A function replacement, not a string: `$&` and friends inside user-entered text would
  // otherwise be reinterpreted as backreferences.
  return raw.replace(pattern, (_m, head: string) => `${head} ${value.trim()}`);
}

export function getLabelledBullet(raw: string, label: string): string | null {
  const escaped = label.replace(METACHARS, "\\$&");
  const pattern = new RegExp(`^[ \\t]*-[ \\t]+\\*\\*${escaped}:\\*\\*[ \\t]*(.*)$`, "m");
  const match = raw.match(pattern);
  return match ? match[1].trim() : null;
}
