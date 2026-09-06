import { summarise } from "@/lib/log/categories";
import type { CachedEntry } from "@/lib/offline/panels";

/**
 * Searching the log with no network (V3 §2.3).
 *
 * The server searches Postgres full text: `to_tsvector('english', search_text) @@
 * plainto_tsquery(...)`, over a column denormalised on write precisely so search never has to
 * reach into JSON. That same column is mirrored to the phone by the ordinary pull, so the
 * offline search reads **exactly the text the online search reads**. Nothing new is stored and
 * nothing new is synced for this feature.
 *
 * ## Where it differs from Postgres, and why that is stated rather than hidden
 *
 * Postgres stems: `run` matches `running`, and so does `ran`. Reproducing that offline means
 * shipping an English stemmer into a bundle served to a phone. Victor's call was to match **word
 * beginnings with every term required** instead:
 *
 * - `run` finds `running` — the common case, which is typing less than the whole word.
 * - `ran` does **not** find `running`. That is the honest limit, and it is one people already
 *   expect from most search boxes.
 * - `erg piec` finds an entry containing both `erg` and `pieces`, in any order and not adjacent.
 *
 * No stopword list, deliberately. Postgres drops `the` and `a`; dropping them here would mean
 * maintaining a second copy of somebody else's word list and still not matching. Requiring every
 * term is at least a rule that can be stated in one sentence.
 */

/**
 * The comparable words in a string.
 *
 * Split on anything that is not a letter or a digit, so punctuation never has to be typed and
 * `2:17` is two searchable tokens rather than one unsearchable one. Digits are kept because half
 * this log is numbers — a weight, a split, a course code.
 */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

/**
 * Whether one entry's text satisfies the query.
 *
 * Every term must be the beginning of some word. An empty query matches nothing rather than
 * everything — the same answer `searchEntries` gives the server, and the one that cannot show a
 * person their entire log because they cleared the box.
 */
export function matches(searchText: string, query: string): boolean {
  const wanted = words(query);
  if (wanted.length === 0) return false;

  const have = words(searchText);
  return wanted.every((term) => have.some((word) => word.startsWith(term)));
}

/**
 * The log entries on this phone that match, newest first.
 *
 * Ordered and capped like the server's query — `occurredAt` descending, fifty — so a result
 * list looks the same offline as on, and a query that returns a screenful online does not
 * return a thousand rows here. Ranking by relevance was not chosen: the online search does not
 * do it, and two orderings for one box is worse than one imperfect one.
 */
export function searchLocalEntries(
  records: readonly { row: Record<string, unknown> }[],
  query: string,
  limit = 50,
): CachedEntry[] {
  if (words(query).length === 0) return [];

  return records
    .map((record) => record.row)
    .filter((row) => matches(String(row.searchText ?? ""), query))
    .map((row) => ({
      id: String(row.clientId ?? row.id ?? ""),
      category: String(row.category ?? ""),
      occurredAt: String(row.occurredAt ?? ""),
      line: summarise(
        String(row.category ?? ""),
        typeof row.data === "object" && row.data !== null
          ? (row.data as Record<string, unknown>)
          : {},
        typeof row.note === "string" ? row.note : "",
      ),
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}

/**
 * The `q` a failed navigation was carrying.
 *
 * The service worker hands the shell the whole path it could not reach, query string and all,
 * as `?from=/private/log%3Fq%3Derg`. So the search term arrives already — it just has to be
 * unpacked from one level down. Parsed with `URL` against a throwaway origin rather than by
 * hand, because a search term can legitimately contain `?`, `&` and `#`.
 */
export function queryFrom(from: string): string {
  try {
    return new URL(from, "http://x").searchParams.get("q")?.trim() ?? "";
  } catch {
    return "";
  }
}
