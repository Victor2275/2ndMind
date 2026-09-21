/**
 * Marking what matched, in a search result (V4 §5.5, Q404).
 *
 * ## Why this is an approximation, and why that is honest
 *
 * `searchEntries` runs `plainto_tsquery('english', …)` against a `tsvector`, so Postgres decides
 * what matched, with stemming: a search for `run` matches an entry saying `running`, and stop
 * words (`the`, `of`, `a`) match nothing at all. Reproducing that here would mean shipping an
 * English stemmer to mark a few words bold.
 *
 * So this marks **word-prefix matches, case-insensitively**: each term in the query matches a
 * word that starts with it. `run` marks `running`, which is the common stemming direction —
 * a searcher types the short form. The reverse (`running` finding `run`) is left unmarked.
 *
 * That asymmetry is the whole reason the count line above the list stays: the page says "4
 * matches" from the database, and the marks say "here is where your words appear". A row with
 * no marks is a row Postgres matched on a stem, not a row shown in error, and the count is
 * what makes that legible rather than alarming.
 *
 * Terms of one character are dropped. Marking every `a` in a sentence is noise that makes the
 * real marks harder to find, and `plainto_tsquery` discards them as stop words anyway.
 */

export type Segment = { text: string; hit: boolean };

/** Regex-escape, because a search for `c++` or `(draft)` must not compile as a pattern. */
function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter((term) => term.length > 1);
}

/**
 * Split `text` into marked and unmarked runs.
 *
 * Always returns at least one segment, so a caller can render the result of this function
 * unconditionally rather than branching on whether anything matched.
 */
export function markTerms(text: string, query: string): Segment[] {
  const list = terms(query);
  if (text === "" || list.length === 0) return [{ text, hit: false }];

  // One alternation rather than a pass per term: overlapping matches from two terms would
  // otherwise produce nested marks, and the longest-first order makes the alternation prefer
  // `bench` over `be` when both are searched.
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${[...list]
      .sort((a, b) => b.length - a.length)
      .map(escape)
      .join("|")})[\\p{L}\\p{N}]*`,
    "giu",
  );

  const segments: Segment[] = [];
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > index) segments.push({ text: text.slice(index, start), hit: false });
    segments.push({ text: match[0], hit: true });
    index = start + match[0].length;
  }
  if (index < text.length) segments.push({ text: text.slice(index), hit: false });

  return segments.length > 0 ? segments : [{ text, hit: false }];
}
