import type { Category } from "@/lib/log/categories";

/**
 * Half-typed entries, and the tab you were last on (V4 §5.5, Q393, Q394).
 *
 * Both are `localStorage`, per device, for the same reason sticky values are (D-155): this is
 * how the form *opens*, not a fact about anything, and a query in front of a form whose whole
 * promise is to appear instantly would be the wrong trade. Neither ever syncs.
 *
 * ## Why this is not `sticky.ts` with a wider allowlist
 *
 * Sticky values are deliberately **context, never measurements** — a pre-filled weight is a
 * number that reads as measured, and the log's value is that its numbers can be trusted. A
 * draft is the opposite case and has to keep everything, including the measurements: it is an
 * entry Victor was in the middle of writing when the app was closed, and dropping half its
 * fields would be worse than dropping all of them.
 *
 * What keeps that safe is that a restored draft **says so**, and offers to be discarded in one
 * tap. A sticky value pretends to be a default; a draft announces that it is unfinished.
 *
 * ## The store deliberately does not notify on every keystroke
 *
 * `saveDraft` writes and returns. It does not bump `version`, so nothing re-renders while you
 * type — the fields are uncontrolled and would ignore a new `defaultValue` anyway, and a
 * `useSyncExternalStore` that fires on input would re-render this form on every character.
 * Only `clearDraft` notifies, because that one has to remount the fields onto empty defaults.
 */

const DRAFT_PREFIX = "2m_draft_";
const TAB_KEY = "2m_log_tab";

const keyFor = (category: Category) => `${DRAFT_PREFIX}${category.key}`;

export type DraftSnapshot = {
  /** Bumped by `clearDraft`, so the form can remount. */
  version: number;
  values: Record<string, string>;
};

/** One shared instance, so the server snapshot is referentially stable and React is happy. */
const EMPTY: DraftSnapshot = { version: 0, values: {} };

const snapshots = new Map<string, DraftSnapshot>();
const listeners = new Set<() => void>();
let version = 0;

function storageOrNothing(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

/**
 * Fields that never belong in a draft.
 *
 * `category` is written by a hidden input and would be restored into the wrong form after a
 * tab switch; the tag input's internal name is rebuilt from its own value. Everything else the
 * form serialises is something Victor typed.
 */
const SKIP = new Set(["category", "$ACTION_ID"]);

export function readDraft(
  storage: Storage | undefined,
  category: Category,
): Record<string, string> {
  let parsed: unknown;
  try {
    const raw = storage?.getItem(keyFor(category));
    if (!raw) return {};
    parsed = JSON.parse(raw);
  } catch {
    // Blocked site data, a private window, or a hand-edited value. A form that opens empty is
    // a small cost; a form that throws is the whole page.
    return {};
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!SKIP.has(name) && typeof value === "string" && value !== "") values[name] = value;
  }
  return values;
}

/**
 * Keep what has been typed so far.
 *
 * A draft of nothing is not a draft: if every field came back blank the entry is removed, so
 * clearing a form by hand does not leave a ghost to be restored tomorrow.
 */
export function saveDraft(
  storage: Storage | undefined,
  category: Category,
  values: Record<string, string>,
): void {
  const kept: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    if (!SKIP.has(name) && typeof value === "string" && value.trim() !== "") {
      kept[name] = value;
    }
  }

  try {
    if (Object.keys(kept).length === 0) storage?.removeItem(keyFor(category));
    else storage?.setItem(keyFor(category), JSON.stringify(kept));
  } catch {
    // Quota or a blocked store. Nothing to tell him: the form on screen is unaffected.
  }

  // Deliberately no `version` bump — see the note at the top of this file.
  snapshots.delete(category.key);
}

/** Forget the draft, and tell the form so it can remount onto empty defaults. */
export function clearDraft(storage: Storage | undefined, category: Category): void {
  try {
    storage?.removeItem(keyFor(category));
  } catch {
    // Same as above.
  }

  version += 1;
  snapshots.delete(category.key);
  for (const listener of listeners) listener();
}

/**
 * A `useSyncExternalStore` source for one category's draft.
 *
 * Same shape as `stickyStore`, and for the same reason: `localStorage` cannot be read during
 * SSR, so a value read at render time would differ between the server's HTML and the client's
 * first paint. The server snapshot says "empty", and React re-reads after hydration.
 */
export function draftStore(category: Category) {
  return {
    subscribe(onChange: () => void): () => void {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot(): DraftSnapshot {
      const cached = snapshots.get(category.key);
      if (cached && cached.version === version) return cached;

      const fresh: DraftSnapshot = { version, values: readDraft(storageOrNothing(), category) };
      snapshots.set(category.key, fresh);
      return fresh;
    },
    getServerSnapshot(): DraftSnapshot {
      return EMPTY;
    },
  };
}

/* ------------------------------------------------------------------------------------------
   The last tab — Q393
   ------------------------------------------------------------------------------------------ */

/**
 * The category the log was last left on.
 *
 * Validated against the caller's list rather than trusted: a retired category would otherwise
 * select a tab that no longer exists and render an empty form (D-159 kept those definitions
 * alive precisely so old *entries* still read, which is not the same as offering the tab).
 */
export function readLastCategory(
  storage: Storage | undefined,
  allowed: readonly { key: string }[],
): string | null {
  let value: string | null = null;
  try {
    value = storage?.getItem(TAB_KEY) ?? null;
  } catch {
    return null;
  }
  if (!value) return null;
  return allowed.some((c) => c.key === value) ? value : null;
}

export function writeLastCategory(storage: Storage | undefined, key: string): void {
  try {
    storage?.setItem(TAB_KEY, key);
  } catch {
    // A tab preference is the least important thing in this file.
  }
}

/** Test seam: forget everything cached, so one test cannot see another's values. */
export function resetDraftCache(): void {
  snapshots.clear();
  version += 1;
}
