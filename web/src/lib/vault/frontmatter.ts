import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatter } from "micromark-extension-frontmatter";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import type { Heading, ListItem, Nodes, Paragraph, Root, Text, Yaml } from "mdast";

/**
 * Frontmatter and section surgery on raw vault markdown.
 *
 * Structure is found with an mdast parse; the located range is then edited as text. Parsing
 * properly is what fixed the failure this module was built around: `##` inside a fenced code
 * block used to end a section, so replacing the section before it left a dangling fence and a
 * fake heading in the file. A regex cannot see that a line is inside a fence; a parser can.
 *
 * Editing by offset rather than re-printing the tree is deliberate. `mdast` round-tripping
 * normalises whitespace, list markers and emphasis characters, which would rewrite parts of a
 * file nobody asked to touch and make every diff unreadable.
 *
 * Three traps this module must stay clear of. All fail silently rather than throwing:
 *
 * 1. The vault is CRLF on Windows and LF once git normalises it. Every pattern accepts both,
 *    and edits are written back with the line ending the file already uses — a mistake made
 *    once before by `stripInternalSections`.
 * 2. The remaining regexes use the `m` flag for `^`, which also redefines `$` to mean
 *    end-of-line. A lazy body match terminated by `$` captures the empty string, and the edit
 *    lands in the wrong place while looking plausible. End-of-input is `(?![\s\S])`.
 * 3. Replacements are functions, not strings: `$&` inside user-entered text would otherwise be
 *    reinterpreted as a backreference.
 */

export type FrontmatterSplit = {
  frontmatter: string;
  body: string;
  /** The line ending the file actually uses, so edits do not mix the two. */
  eol: "\n" | "\r\n";
};

export function splitFrontmatter(raw: string): FrontmatterSplit | null {
  const tree = fromMarkdown(raw, {
    extensions: [frontmatter()],
    mdastExtensions: [frontmatterFromMarkdown()],
  });

  const yamlNode = tree.children.find((node) => node.type === "yaml") as Yaml | undefined;
  if (!yamlNode || !yamlNode.position) return null;

  const eol = raw.includes("\r\n") ? "\r\n" : "\n";

  const startOffset = yamlNode.position.start.offset ?? 0;
  const endOffset = yamlNode.position.end.offset ?? 0;
  const yamlText = raw.slice(startOffset, endOffset);

  const match = yamlText.match(/^---\r?\n([\s\S]*?)\r?\n---$/);
  if (!match) return null;
  const frontmatterString = match[1];

  const afterYaml = raw.slice(endOffset);
  let body = afterYaml;
  if (body.startsWith("\r\n")) body = body.slice(2);
  else if (body.startsWith("\n")) body = body.slice(1);

  return { frontmatter: frontmatterString, body, eol };
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

  // The empty-frontmatter arm is reachable and does matter: `---\n\n---` splits to an empty
  // string, and prepending `line + eol` to nothing leaves a blank first line. Note the
  // tighter `---\n---` does *not* reach here — `splitFrontmatter` returns null for it and
  // this function throws. That asymmetry is untidy but harmless; no vault file looks that way.
  parts.frontmatter = pattern.test(parts.frontmatter)
    ? parts.frontmatter.replace(pattern, line)
    : parts.frontmatter
      ? `${line}${parts.eol}${parts.frontmatter}`
      : line;

  return joinFrontmatter(parts);
}

export function getFrontmatterField(raw: string, field: string): string | null {
  const parts = splitFrontmatter(raw);
  if (!parts) return null;
  const match = parts.frontmatter.match(new RegExp(`^${field}:[ \\t]*(.*)$`, "m"));
  return match ? match[1].trim() : null;
}

export function bumpUpdated(raw: string, today: string = todayISO()): string {
  return setFrontmatterField(raw, "updated", today);
}

function getTree(raw: string): Root {
  return fromMarkdown(raw, {
    extensions: [frontmatter()],
    mdastExtensions: [frontmatterFromMarkdown()],
  });
}

function findSectionBounds(raw: string, heading: string) {
  const tree = getTree(raw);

  let startIndex = -1;
  let endIndex = -1;

  let found = false;
  let depth = 0;

  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i];
    if (node.type === "heading") {
      const headingNode = node as Heading;
      const text = headingNode.children
        .filter((c) => c.type === "text")
        .map((c) => (c as Text).value)
        .join("");

      if (!found && headingNode.depth === 2 && text.trim() === heading) {
        found = true;
        depth = headingNode.depth;
        startIndex = headingNode.position!.end.offset!;
      } else if (found && headingNode.depth <= depth) {
        endIndex = headingNode.position!.start.offset!;
        break;
      }
    }
  }

  if (!found) {
    throw new Error(`no "## ${heading}" section found`);
  }

  if (endIndex === -1) {
    endIndex = raw.length;
  }

  return { startIndex, endIndex };
}

export function replaceSection(raw: string, heading: string, content: string): string {
  const { startIndex, endIndex } = findSectionBounds(raw, heading);
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";

  let start = startIndex;
  while (
    start < raw.length &&
    (raw[start] === "\r" || raw[start] === "\n" || raw[start] === " " || raw[start] === "\t")
  ) {
    if (raw[start] === "\n") {
      start++;
      break;
    }
    start++;
  }

  let end = endIndex;
  if (end < raw.length) {
    while (end > start && (raw[end - 1] === "\r" || raw[end - 1] === "\n")) {
      end--;
    }
  }

  const normalised = content.replace(/\r?\n/g, eol).trimEnd();

  return raw.slice(0, start) + normalised + eol + raw.slice(end);
}

export function appendToSection(raw: string, heading: string, content: string): string {
  const { startIndex, endIndex } = findSectionBounds(raw, heading);
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";

  let start = startIndex;
  while (
    start < raw.length &&
    (raw[start] === "\r" || raw[start] === "\n" || raw[start] === " " || raw[start] === "\t")
  ) {
    if (raw[start] === "\n") {
      start++;
      break;
    }
    start++;
  }

  let end = endIndex;
  if (end < raw.length) {
    while (end > start && (raw[end - 1] === "\r" || raw[end - 1] === "\n")) {
      end--;
    }
  }

  const existing = raw.slice(start, end).trimEnd();
  const addition = content.replace(/\r?\n/g, eol).trimEnd();
  const merged = existing ? `${existing}${eol}${eol}${addition}` : addition;

  return raw.slice(0, start) + merged + eol + raw.slice(end);
}

const METACHARS = /[.*+?^${}()|[\]\\]/g;

function findLabelledBullet(raw: string, label: string): ListItem | null {
  const tree = getTree(raw);

  let targetNode: ListItem | null = null;
  let found = false;

  function walk(node: Nodes) {
    if (found) return;
    if (node.type === "listItem") {
      const paragraph = node.children.find((c): c is Paragraph => c.type === "paragraph");
      if (paragraph) {
        const firstStrong = paragraph.children[0];
        if (firstStrong && firstStrong.type === "strong" && firstStrong.position) {
          // Compared against the source text rather than the node's own children, so the
          // label is matched exactly as written — including its colon, which sits inside the
          // bold in this vault's convention.
          const rawText = raw.slice(
            firstStrong.position.start.offset ?? 0,
            firstStrong.position.end.offset ?? 0,
          );
          if (rawText === `**${label}:**`) {
            found = true;
            targetNode = node;
            return;
          }
        }
      }
    }
    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children as Nodes[]) walk(child);
    }
  }
  walk(tree);

  if (!found || !targetNode) {
    return null;
  }

  return targetNode;
}

export function setLabelledBullet(raw: string, label: string, value: string): string {
  const node = findLabelledBullet(raw, label);
  if (!node) throw new Error(`no bullet labelled "${label}"`);

  const startOffset = node.position!.start.offset!;
  const endOffset = node.position!.end.offset!;

  const text = raw.slice(startOffset, endOffset);
  const escaped = label.replace(METACHARS, "\\$&");
  const pattern = new RegExp(`^([ \\t]*-[ \\t]*\\*\\*${escaped}:\\*\\*)[ \\t]*.*$`, "m");

  const match = text.match(pattern);
  if (!match) throw new Error(`no bullet labelled "${label}"`);

  const head = match[1];
  const replaced = text.replace(pattern, () => `${head} ${value.trim()}`);

  return raw.slice(0, startOffset) + replaced + raw.slice(endOffset);
}

export function getLabelledBullet(raw: string, label: string): string | null {
  const node = findLabelledBullet(raw, label);
  if (!node) return null;

  const startOffset = node.position!.start.offset!;
  const endOffset = node.position!.end.offset!;

  const text = raw.slice(startOffset, endOffset);
  const escaped = label.replace(METACHARS, "\\$&");
  const pattern = new RegExp(`^[ \\t]*-[ \\t]*\\*\\*${escaped}:\\*\\*[ \\t]*(.*)$`, "m");
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}
