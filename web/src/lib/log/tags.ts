/**
 * Free tags on log entries and tasks (V4 Phase 3, §2.3).
 *
 * A plain module, not part of a `"use server"` action file, for the same reason `form.ts` is
 * one — this is pure and shared by the online action, the offline writer, and the tasks
 * equivalent, and a `"use server"` module may only export async functions (AGENTS.md rule 4).
 *
 * **Shared vocabulary, one normalisation, for both tables.** Tags are not scoped per-table —
 * `#reading` on a note and `#reading` on a task are the same tag, and a single suggestion list
 * (`allTags`, in `queries.ts` for entries and `tasks/queries.ts` for tasks) is more useful than
 * two vocabularies that drift apart by which screen you happened to type on. Caps mirror the
 * wire schema in `sync/protocol.ts` (`PAYLOADS.log_entry.tags`, `PAYLOADS.task.tags`): 20 tags,
 * 40 characters each — generous for a word or two, not a mechanism for storing a sentence.
 */

export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

/**
 * One tag, cleaned up: trimmed, lowercased, internal whitespace collapsed.
 *
 * Lowercased so "Reading" and "reading" are the same tag — the whole point of a free-tag
 * vocabulary is that it converges on a small set you actually reuse, and case is the easiest
 * way for that to silently fail to happen.
 */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
}

/** A list of tags, cleaned, de-duplicated, capped — the shape every write path converges on. */
export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of raw) {
    const cleaned = normalizeTag(tag);
    if (cleaned === "" || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/**
 * Tags out of a form post.
 *
 * `TagInput` (the client component) posts one hidden input per committed tag, all named
 * `tags` — `formData.getAll` reads them back as a list with no join/split step, so a tag that
 * happens to contain a comma is never mis-parsed.
 */
export function readTags(formData: FormData): string[] {
  return normalizeTags(formData.getAll("tags").map((v) => String(v)));
}
