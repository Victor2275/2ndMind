import { stickyFields, type Category } from "@/lib/log/categories";

/**
 * Values remembered between log entries (V3 §1.6, D-155).
 *
 * Per device and per category, in `localStorage`. Not the database: this is a convenience
 * about how the form opens, not a fact about anything, and round-tripping it through Postgres
 * would put a query in front of a form whose entire purpose is to appear instantly.
 *
 * What is remembered is decided by `sticky: true` in `categories.ts` and nowhere else, and the
 * rule there is worth repeating because it is the safety property: **context, never
 * measurements.** A pre-filled `kind` that is wrong is obvious at a glance. A pre-filled weight
 * that is wrong is a number in the log that reads as measured, and the log's whole value is
 * that its numbers can be trusted.
 *
 * Reads are filtered against the category's current fields rather than trusted, so a field
 * that stops being sticky — or stops existing — cannot resurrect a value into a form that no
 * longer has anywhere to show it.
 *
 * Exposed as a `useSyncExternalStore` source rather than read into state in an effect. That is
 * not ceremony: `localStorage` is unreadable during SSR, so anything read at render time would
 * differ between the server's HTML and the client's first paint. A store with an explicit
 * server snapshot says "empty on the server, real after hydration" in one place, instead of
 * spreading it across an effect and a cascading re-render.
 */

const PREFIX = "2m_sticky_";

const keyFor = (category: Category) => `${PREFIX}${category.key}`;

export type StickySnapshot = {
  /** Bumped on every write, so a form can remount its fields onto the new defaults. */
  version: number;
  values: Record<string, string>;
};

/** One shared instance, so the server snapshot is referentially stable and React is happy. */
const EMPTY: StickySnapshot = { version: 0, values: {} };

const snapshots = new Map<string, StickySnapshot>();
const listeners = new Set<() => void>();
let version = 0;

function storageOrNothing(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function readSticky(
  storage: Storage | undefined,
  category: Category,
): Record<string, string> {
  const allowed = new Set(stickyFields(category).map((f) => f.name));
  if (allowed.size === 0) return {};

  let parsed: unknown;
  try {
    const raw = storage?.getItem(keyFor(category));
    if (!raw) return {};
    parsed = JSON.parse(raw);
  } catch {
    // Blocked site data, a private window, or a value someone hand-edited. A form that opens
    // empty is a small cost; a form that throws is the whole page.
    return {};
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (allowed.has(name) && typeof value === "string" && value !== "") values[name] = value;
  }
  return values;
}

/**
 * Remember what was just submitted.
 *
 * A sticky field left blank is dropped rather than kept, so clearing one actually clears it.
 * Keeping the old value when the field came back empty would make a sticky value impossible
 * to get rid of, which is the kind of small permanence that turns a convenience into a
 * nuisance.
 */
export function writeSticky(
  storage: Storage | undefined,
  category: Category,
  submitted: Record<string, string>,
): void {
  const fields = stickyFields(category);
  if (fields.length === 0) return;

  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = submitted[field.name];
    if (typeof value === "string" && value.trim() !== "") values[field.name] = value.trim();
  }

  try {
    if (Object.keys(values).length === 0) storage?.removeItem(keyFor(category));
    else storage?.setItem(keyFor(category), JSON.stringify(values));
  } catch {
    // Nothing to do, and nothing worth telling him about: the entry itself already saved.
  }

  version += 1;
  snapshots.delete(category.key);
  for (const listener of listeners) listener();
}

/** Everything in a submitted `FormData`, as strings, for `writeSticky`. */
export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") values[name] = value;
  }
  return values;
}

/**
 * A `useSyncExternalStore` source for one category.
 *
 * `getSnapshot` has to return the *same object* until something actually changes, or React
 * re-renders forever. Hence the cache: it is invalidated by `writeSticky` and by nothing else.
 */
export function stickyStore(category: Category) {
  return {
    subscribe(onChange: () => void): () => void {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot(): StickySnapshot {
      const cached = snapshots.get(category.key);
      if (cached && cached.version === version) return cached;

      const fresh: StickySnapshot = { version, values: readSticky(storageOrNothing(), category) };
      snapshots.set(category.key, fresh);
      return fresh;
    },
    getServerSnapshot(): StickySnapshot {
      // No `localStorage` on the server. Returning anything else here is a hydration mismatch.
      return EMPTY;
    },
  };
}

/** Test seam: forget everything cached, so one test cannot see another's values. */
export function resetStickyCache(): void {
  snapshots.clear();
  version += 1;
}
