/**
 * The update-detection half of the PWA shell, kept out of the component so it can be tested
 * against fakes (V3 §1.1, D-146). Nothing here touches `navigator` — every dependency is
 * passed in, because the whole point is to exercise state transitions that are painful to
 * stage in a real browser.
 */

/** Everything `watchForUpdate` needs from the environment. */
export type UpdateWatchOptions = {
  /**
   * Whether a service worker is already in control of this page. This is the guard that
   * separates "there is a newer version" from "this is the first install": on a first visit
   * a worker installs and there is no previous version to replace, so prompting the user to
   * reload would be asking them to reload into the page they are already looking at.
   */
  isControlled: () => boolean;
  /** Called with the worker sitting in `waiting`, at most once per worker. */
  onWaiting: (worker: ServiceWorker) => void;
};

/**
 * Watches a registration for a worker that has installed and is waiting to take over.
 *
 * Two paths reach the same place and both are needed. A worker can install *while the page is
 * open* — `updatefound`, then `statechange` to `installed`. It can also have installed during
 * a previous visit and still be waiting when this page loads, in which case no event will ever
 * fire and only `registration.waiting` says so. Handling only the event is the common bug: the
 * prompt appears if you happen to be looking, and never again afterwards.
 *
 * @returns a function that detaches every listener it attached.
 */
export function watchForUpdate(
  registration: ServiceWorkerRegistration,
  { isControlled, onWaiting }: UpdateWatchOptions,
): () => void {
  const cleanups: Array<() => void> = [];

  if (registration.waiting && isControlled()) onWaiting(registration.waiting);

  const handleUpdateFound = () => {
    const installing = registration.installing;
    if (!installing) return;

    const handleStateChange = () => {
      if (installing.state === "installed" && isControlled()) onWaiting(installing);
    };

    installing.addEventListener("statechange", handleStateChange);
    cleanups.push(() => installing.removeEventListener("statechange", handleStateChange));
  };

  registration.addEventListener("updatefound", handleUpdateFound);
  cleanups.push(() => registration.removeEventListener("updatefound", handleUpdateFound));

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

/**
 * Hands control to the waiting worker.
 *
 * The reload is driven by `controllerchange` rather than fired straight after `postMessage`,
 * because `skipWaiting()` is asynchronous: reloading immediately can land on the old worker
 * again and leave the new one still waiting, which looks like a reload button that does
 * nothing. `reload` is a parameter so a test can assert it was called exactly once — the
 * failure worth guarding against here is a loop, not a no-op.
 */
export function applyUpdate(
  worker: ServiceWorker,
  container: ServiceWorkerContainer,
  reload: () => void,
): void {
  let reloaded = false;

  container.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    reload();
  });

  worker.postMessage({ type: "SKIP_WAITING" });
}
