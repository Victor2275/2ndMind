import "@testing-library/jest-dom/vitest";

/**
 * `window.matchMedia`, which jsdom does not implement at all (V4 §5.2).
 *
 * Not a convenience: it is a gap in the environment rather than a behaviour worth faking per
 * test. jsdom ships no CSSOM media-query evaluation, so `matchMedia` is simply absent, and any
 * component that asks the browser what it prefers throws `window.matchMedia is not a function`
 * before it renders a single element — which reads as *that component is broken* rather than
 * *the test environment has no media queries*.
 *
 * It surfaced when §5.2 mounted the `Toaster` inside the offline shell: `next-themes` resolves
 * `system` by asking for `(prefers-color-scheme: dark)`, and twenty-eight unrelated assertions
 * in `cached-app.test.tsx` failed at once with an error naming none of that.
 *
 * **It answers `false` to everything**, which is the honest default: no media query matches in
 * an environment with no viewport and no OS preference. A test that needs a specific answer —
 * `prefers-reduced-motion`, a width — should stub this for itself and say why, rather than this
 * file guessing on its behalf.
 *
 * `jsdom` is only the `unit` project's environment; the `db` project runs in node and never
 * touches this.
 */
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/**
 * Pointer capture, which jsdom also does not implement (V4 §5.2).
 *
 * The same kind of gap as `matchMedia` above, and worse when it bites: an unimplemented method
 * on `Element` throws *inside an event handler*, so the failure surfaces as an unhandled
 * exception attributed to whichever test happened to be running, naming neither the component
 * nor the method.
 *
 * This app's own gesture code already works around it — `SwipeRow` and the tab-bar sheet both
 * call `setPointerCapture?.()` with optional chaining — but third-party code does not, and
 * sonner's swipe-to-dismiss calls it unguarded. Every real browser implements all three; this
 * is the environment catching up, not a behaviour being faked.
 *
 * Capture is a no-op here rather than modelled. Nothing in this repo asserts on it, and a fake
 * that *pretended* to redirect events would be a second, wrong implementation of a browser
 * behaviour — worse than an honest no-op, because a test could then pass against it.
 */
if (typeof Element !== "undefined" && typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}
