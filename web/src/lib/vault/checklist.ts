import { joinFrontmatter, splitFrontmatter } from "./frontmatter";

/**
 * Checklist items inside a `## Heading` section of a vault file.
 *
 * Split out of `frontmatter.ts` rather than appended to it: that module is about frontmatter
 * and generic section edits, and this is one specific markdown convention. Same two traps
 * apply and are handled the same way — `\r?\n` everywhere, because vault files are CRLF on
 * Windows; and `(?![\s\S])` rather than `$` for end-of-input, because `$` under the `m` flag
 * means end-of-line and silently matches the empty string.
 */

export type ChecklistItem = { text: string; done: boolean };

const METACHARS = /[.*+?^${}()|[\]\\]/g;

function sectionPattern(heading: string): RegExp {
  const escaped = heading.replace(METACHARS, "\\$&");
  return new RegExp(
    `(^##[ \\t]+${escaped}[ \\t]*\\r?\\n)([\\s\\S]*?)(?=\\r?\\n##[ \\t]|(?![\\s\\S]))`,
    "m",
  );
}

/** `- [ ] text` or `- [x] text`, capturing the box state and the text separately. */
const ITEM = /^([ \t]*)-[ \t]+\[([ \t]|[xX])\][ \t]*(.*)$/;

/** A row left as `- [ ]` with nothing after it: a placeholder, not an item. */
const BLANK = /^[ \t]*-[ \t]+\[[ \t]?\][ \t]*$/;

function sectionBody(raw: string, heading: string): { body: string } | null {
  const parts = splitFrontmatter(raw);
  const target = parts ? parts.body : raw;
  const match = target.match(sectionPattern(heading));
  return match ? { body: match[2] } : null;
}

export function getChecklistItems(raw: string, heading: string): ChecklistItem[] {
  const section = sectionBody(raw, heading);
  if (!section) return [];

  const items: ChecklistItem[] = [];
  for (const line of section.body.split(/\r?\n/)) {
    const match = line.match(ITEM);
    if (!match) continue;
    const text = match[3].trim();
    if (text === "") continue;
    items.push({ text, done: match[2].toLowerCase() === "x" });
  }
  return items;
}

/** Rewrites a section's lines, preserving the file's own line endings. */
function rewriteSection(
  raw: string,
  heading: string,
  transform: (lines: string[]) => string[],
): string {
  const parts = splitFrontmatter(raw);
  const target = parts ? parts.body : raw;
  const eol = parts?.eol ?? (target.includes("\r\n") ? "\r\n" : "\n");

  const pattern = sectionPattern(heading);
  const match = target.match(pattern);
  if (!match) throw new Error(`no "## ${heading}" section found`);

  const lines = transform(match[2].split(/\r?\n/));
  const body = lines.join(eol).replace(/(?:\r?\n)+$/, "");

  // A function replacement, not a string: `$&` inside user-entered text would otherwise be
  // reinterpreted as a backreference.
  const updated = target.replace(pattern, (_m, head: string) => `${head}${body}${eol}`);
  return parts ? joinFrontmatter({ ...parts, body: updated }) : updated;
}

/**
 * Adds an item, reusing the first blank `- [ ]` placeholder if the section has one.
 * The academic tracker ships with two of them; appending below would leave a growing tail
 * of empty checkboxes that nobody tidies up.
 */
export function addChecklistItem(raw: string, heading: string, text: string): string {
  const value = text.trim();
  if (value === "") throw new Error("cannot add an empty checklist item");

  return rewriteSection(raw, heading, (lines) => {
    const blank = lines.findIndex((line) => BLANK.test(line));
    const indent = blank >= 0 ? (lines[blank].match(/^[ \t]*/)?.[0] ?? "") : "";
    const entry = `${indent}- [ ] ${value}`;
    if (blank >= 0) {
      lines[blank] = entry;
      return lines;
    }
    return [...lines, entry];
  });
}

/** Ticks or unticks the first item whose text matches exactly. */
export function setChecklistItem(
  raw: string,
  heading: string,
  text: string,
  done: boolean,
): string {
  const wanted = text.trim();
  let found = false;

  const updated = rewriteSection(raw, heading, (lines) =>
    lines.map((line) => {
      if (found) return line;
      const match = line.match(ITEM);
      if (!match || match[3].trim() !== wanted) return line;
      found = true;
      return `${match[1]}- [${done ? "x" : " "}] ${match[3].trim()}`;
    }),
  );

  if (!found) throw new Error(`no checklist item matching "${wanted}"`);
  return updated;
}

/** Removes the first item whose text matches exactly. */
export function removeChecklistItem(raw: string, heading: string, text: string): string {
  const wanted = text.trim();
  let found = false;

  const updated = rewriteSection(raw, heading, (lines) =>
    lines.filter((line) => {
      if (found) return true;
      const match = line.match(ITEM);
      if (!match || match[3].trim() !== wanted) return true;
      found = true;
      return false;
    }),
  );

  if (!found) throw new Error(`no checklist item matching "${wanted}"`);
  return updated;
}
