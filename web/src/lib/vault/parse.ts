import matter from "gray-matter";
import type { ZodType } from "zod";

/**
 * Pure parsing layer: raw markdown string in, validated typed entry out.
 *
 * Deliberately free of filesystem access so it can be tested without fixtures on disk,
 * and so it can be reused later against content fetched from the GitHub Contents API
 * rather than read locally.
 */

export class VaultParseError extends Error {
  constructor(
    readonly source: string,
    readonly issues: string[],
  ) {
    super(`${source}: ${issues.join("; ")}`);
    this.name = "VaultParseError";
  }
}

/** Parse one markdown document and validate its frontmatter against `schema`. */
export function parseEntry<T>(
  raw: string,
  schema: ZodType<T>,
  source: string,
): T & { body: string } {
  const { data, content } = matter(raw);
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new VaultParseError(
      source,
      result.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    );
  }

  const body = content.trim();
  if (!body) throw new VaultParseError(source, ["body is empty"]);

  return { ...result.data, body };
}

/**
 * Split a body into its `## Heading` sections, keyed by lowercased heading.
 * Used by the deep-dive pages, which render Architecture and Post-mortem separately.
 */
export function splitSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = body.split(/^## +(.+)$/m);

  // parts[0] is any preamble before the first heading.
  const preamble = parts[0].trim();
  if (preamble) sections.preamble = preamble;

  for (let i = 1; i < parts.length; i += 2) {
    sections[parts[i].trim().toLowerCase()] = parts[i + 1].trim();
  }
  return sections;
}
