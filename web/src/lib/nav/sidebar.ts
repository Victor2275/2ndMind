/**
 * Whether the private sidebar is collapsed to icons, and how that survives a reload (V4 §4.1).
 *
 * Q361 asks for a collapsible sidebar, Q362 for the state to persist in `localStorage`. Doing
 * that naively — read storage in an effect, set React state, render — collapses the sidebar
 * *after* the first paint, so every load of every private page shows 208px of labels sliding
 * away. That is the same class of flash `next-themes` exists to avoid, and the fix is the same
 * one: an attribute written on `<html>` by a tiny script before the first paint, with CSS
 * keyed off the attribute.
 *
 * So the division of labour here is:
 *
 * - **`PREPAINT`** runs before paint and sets `data-nav="collapsed"` on `<html>`. It is the
 *   only thing that decides what the first frame looks like.
 * - **CSS** in `globals.css` reads that attribute. All of the collapsing is a stylesheet, which
 *   is why it works with JavaScript still loading.
 * - **`sidebarStore`** exists for the one thing CSS cannot do: tell the toggle button what to
 *   put in `aria-expanded`. It reads the *attribute*, not storage, so there is one source of
 *   truth on the page.
 *
 * `getServerSnapshot` reports expanded, which matches the server-rendered markup; React
 * re-reads after hydration and corrects the button if the attribute says otherwise. That is the
 * sanctioned `useSyncExternalStore` pattern and it is what `private-link.tsx` already does.
 *
 * ## Below the laptop breakpoint, the preference does not apply
 *
 * Between 40rem and 64rem the sidebar is icon-only whatever is stored, because a 208px rail
 * beside a 560px column is not a layout. That rule is pure CSS (`globals.css`) and deliberately
 * does **not** write storage: it is a fact about the viewport, not a choice, and recording it
 * as one would mean resizing a window silently rewrote a preference.
 *
 * Nothing here is sensitive — it compiles into client chunks.
 */

/** Where the preference lives. Changing this orphans it, which is harmless but pointless. */
export const NAV_STORAGE_KEY = "2m:nav-collapsed";

/** The attribute, and the value that means collapsed. CSS matches on exactly this. */
export const NAV_ATTRIBUTE = "data-nav";
export const NAV_COLLAPSED = "collapsed";

/**
 * Runs before first paint, inlined into the private layout.
 *
 * Wrapped in `try` because `localStorage` throws outright in a Safari private window rather
 * than returning null, and an exception here runs before anything else on the page — it would
 * take the whole document with it to save 208 pixels of chrome.
 */
export const PREPAINT = `try{if(localStorage.getItem("${NAV_STORAGE_KEY}")==="1")document.documentElement.setAttribute("${NAV_ATTRIBUTE}","${NAV_COLLAPSED}")}catch(e){}`;

/** What the DOM currently says. The attribute is the source of truth, not storage. */
export function isCollapsed(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute(NAV_ATTRIBUTE) === NAV_COLLAPSED;
}

/** Listeners for the toggle. A `Set` so a component unmounting cannot unsubscribe another. */
const listeners = new Set<() => void>();

/**
 * Collapse or expand, writing both the attribute (what the page looks like now) and storage
 * (what the next load looks like).
 *
 * Storage is written second and inside its own `try`: if it fails the sidebar still collapses,
 * it simply will not remember. The reverse order would let a storage failure leave the page
 * un-collapsed after a click that visibly did nothing.
 */
export function setCollapsed(collapsed: boolean): void {
  const root = document.documentElement;
  if (collapsed) root.setAttribute(NAV_ATTRIBUTE, NAV_COLLAPSED);
  else root.removeAttribute(NAV_ATTRIBUTE);

  try {
    localStorage.setItem(NAV_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // A private window that refuses storage still gets a working sidebar for this session.
  }

  for (const listener of listeners) listener();
}

export const sidebarStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: isCollapsed,
  /** The server renders expanded, so the markup and this agree on the first client render. */
  getServerSnapshot: (): boolean => false,
};

/** Test seam — drops every subscriber so one test cannot notify another's component. */
export function resetSidebarStore(): void {
  listeners.clear();
}
