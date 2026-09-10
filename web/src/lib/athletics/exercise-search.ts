/**
 * Finding a movement in the catalogue (V4 Phase 2.2, Q391).
 *
 * ## Why this is not `lib/offline/search.ts`
 *
 * That one searches the log, and it matches **word beginnings** — `run` finds `running`, `ran`
 * does not. That is the right rule for prose, where you are recalling something you wrote.
 *
 * This searches a closed list of about 164 names you are trying to *reach*, one-handed, mid-set,
 * and the failure that matters is different: you type `bnch` or `inc db press` and the thing you
 * want has to be the first row. So it is **fuzzy** — the query's characters must appear in
 * order, not necessarily adjacent — and, more importantly, it is **ranked**. A fuzzy matcher
 * without ranking is worse than a prefix one, because `press` matching thirty movements in
 * arbitrary order is thirty rows to read instead of a typo you can recover from.
 *
 * Sharing one implementation was considered and rejected: the two want opposite things. Fuzzy
 * matching over a free-text log turns every query into a hundred weak hits.
 *
 * ## It runs on the phone, offline, over the mirrored table
 *
 * That is the whole point of the catalogue being a synced table rather than an API call. There
 * is no network in a gym basement, and this is the one screen that must work there.
 */

export type Searchable = {
  name: string;
  modality?: string;
  equipment?: string;
  /**
   * Other names this movement used to be called (V4 Phase 2++ Stage 3's `renames.ts`) or is
   * also known by. Matched the same way `name` is; the highest-scoring alias, if any beats the
   * name itself, is what `searchExercises` ranks by — see its doc for why.
   */
  aliases?: readonly string[];
};

/** The `(Equipment)` suffix every v2 name carries, stripped for the length bonus only — see its
 *  call site in `score`. Matches "(Barbell)", "(EZ Bar)", "(Bike Erg)" — one or more words. */
const EQUIPMENT_SUFFIX = / \([A-Za-z0-9 ]+\)$/;

/**
 * How well `query` matches `name`, or `null` for no match at all.
 *
 * Higher is better. The number has no meaning beyond ordering, and deliberately so — tuning a
 * score against a rubric nobody can check is how ranking becomes folklore. What the weights
 * encode is one sentence: **matches that start a word beat matches that start anywhere, and
 * runs of adjacent characters beat scattered ones.**
 */
export function score(name: string, query: string): number | null {
  const haystack = name.toLowerCase();
  const needle = query.toLowerCase().replace(/\s+/g, "");
  if (needle.length === 0) return null;

  let total = 0;
  let from = 0;
  let previousIndex = -2;

  for (const character of needle) {
    const index = haystack.indexOf(character, from);
    if (index === -1) return null;

    // Starting a word is the strongest signal: "ibp" should find "Incline Bench Press" rather
    // than whichever name happens to contain those letters in dead centre.
    const startsWord = index === 0 || /[^a-z0-9]/.test(haystack[index - 1]);
    if (startsWord) total += 10;

    // Adjacent to the previous match — "benc" reads as one run rather than four coincidences.
    if (index === previousIndex + 1) total += 6;

    // Everything else counts a little, and earlier counts for more, so a hit near the front of
    // the name outranks the same hit buried at the end.
    total += Math.max(0, 5 - Math.floor(index / 4));

    previousIndex = index;
    from = index + 1;
  }

  /**
   * A short name that matched is more likely to be the one meant: "Dip" over "Dumbbell Incline
   * Press" for the query "dip". Measured against the name with its `(Equipment)` suffix
   * stripped — every v2 name carries one (Stage 3), which pushed almost every name past the
   * 20-character floor and made this bonus fire for nothing. "Dip (Bodyweight)" is 15 real
   * characters of movement name; it should read as short, not as "Dumbbell Incline Press"-long.
   */
  const core = haystack.replace(EQUIPMENT_SUFFIX, "");
  total += Math.max(0, 20 - core.length);

  /**
   * A contiguous run beats a scattered one, by a lot.
   *
   * Without this, `row` ranked "Rope Pushdown" above "Barbell Row" — r, o and w do appear in
   * that order in "Rope Pushdown", and the `r` even starts a word, so every other signal
   * pointed the wrong way. Subsequence matching is what makes typos recoverable, and it is also
   * what makes coincidences score; the fix is not to stop matching them but to rank them below
   * the case where the letters are actually together.
   *
   * Starting a word on top of that is stronger again: `press` should reach "Press" before
   * "Pendlay Row"'s scattered letters, and "Bench Press" before "Leg Press Machine".
   */
  const at = haystack.indexOf(needle);
  if (at !== -1) {
    total += 30;
    if (at === 0 || /[^a-z0-9]/.test(haystack[at - 1])) total += 15;
  }

  // An exact prefix is not a heuristic, it is the answer.
  if (haystack.startsWith(needle)) total += 50;

  return total;
}

/**
 * The catalogue, filtered and ordered for a query.
 *
 * An empty query returns the list unchanged rather than nothing — the opposite of the log
 * search, and for a concrete reason: this is a picker. Opening it should show you what there is,
 * whereas showing someone their entire log because they cleared the box is noise.
 *
 * **Matches an alias as well as the name** (V4 Phase 2++ Stage 4) — typing "barbell curl" still
 * finds "Bicep Curl (Barbell)", because that is what `Row (Erg)` used to be twenty-two different
 * strings of, and a rename should not cost the muscle memory of the old name. The item's own
 * best score wins regardless of which string produced it: an alias match never outranks a
 * genuine name match for the same item, it only rescues an item the name alone would have missed.
 *
 * Ties break on name so the order is stable between keystrokes. A list that reshuffles under
 * your thumb while the score is equal is how you tap the wrong row.
 */
export function searchExercises<T extends Searchable>(items: T[], query: string, limit = 40): T[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return items.slice(0, limit);

  const hits: { item: T; score: number }[] = [];
  for (const item of items) {
    let best = score(item.name, trimmed);
    for (const alias of item.aliases ?? []) {
      const aliasScore = score(alias, trimmed);
      if (aliasScore !== null && (best === null || aliasScore > best)) best = aliasScore;
    }
    if (best !== null) hits.push({ item, score: best });
  }

  hits.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return hits.slice(0, limit).map((hit) => hit.item);
}
