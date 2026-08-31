import { describe, expect, it, vi } from "vitest";

import { applyUpdate, watchForUpdate } from "@/lib/pwa/register";

/**
 * A stand-in for `ServiceWorker`: an EventTarget with a settable `state`, which is the one
 * thing the real object does that matters here.
 */
class FakeWorker extends EventTarget {
  state: ServiceWorker["state"] = "installing";
  postMessage = vi.fn();

  transitionTo(state: ServiceWorker["state"]) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

/** A stand-in for `ServiceWorkerRegistration` with the three fields this code reads. */
class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;

  /** Mirrors the browser: set `installing`, then announce it. */
  beginInstall(worker: FakeWorker) {
    this.installing = worker;
    this.dispatchEvent(new Event("updatefound"));
  }
}

const watch = (
  registration: FakeRegistration,
  isControlled: () => boolean,
  onWaiting: (worker: ServiceWorker) => void,
) =>
  watchForUpdate(registration as unknown as ServiceWorkerRegistration, {
    isControlled,
    onWaiting,
  });

describe("watchForUpdate", () => {
  it("announces a worker that finishes installing while the page is open", () => {
    const registration = new FakeRegistration();
    const onWaiting = vi.fn();
    watch(registration, () => true, onWaiting);

    const worker = new FakeWorker();
    registration.beginInstall(worker);
    expect(onWaiting).not.toHaveBeenCalled();

    worker.transitionTo("installed");
    expect(onWaiting).toHaveBeenCalledExactlyOnceWith(worker);
  });

  it("announces a worker that was already waiting when the page loaded", () => {
    // The case an event listener alone can never catch: the worker installed during a previous
    // visit, so `updatefound` fired before this page existed and will not fire again. Only
    // `registration.waiting` says anything, and without this the prompt appears once — if you
    // happen to be looking — and never again.
    const registration = new FakeRegistration();
    const waiting = new FakeWorker();
    waiting.state = "installed";
    registration.waiting = waiting;

    const onWaiting = vi.fn();
    watch(registration, () => true, onWaiting);

    expect(onWaiting).toHaveBeenCalledExactlyOnceWith(waiting);
  });

  it("stays quiet on a first-ever install, when no worker controls the page", () => {
    // Nothing is being replaced here, so a reload prompt would be asking the user to reload
    // into the page they are already looking at.
    const registration = new FakeRegistration();
    const onWaiting = vi.fn();
    watch(registration, () => false, onWaiting);

    const worker = new FakeWorker();
    registration.beginInstall(worker);
    worker.transitionTo("installed");

    expect(onWaiting).not.toHaveBeenCalled();
  });

  it("does not fire for states other than installed", () => {
    const registration = new FakeRegistration();
    const onWaiting = vi.fn();
    watch(registration, () => true, onWaiting);

    const worker = new FakeWorker();
    registration.beginInstall(worker);
    worker.transitionTo("activating");
    worker.transitionTo("redundant");

    expect(onWaiting).not.toHaveBeenCalled();
  });

  it("detaches every listener it attached", () => {
    const registration = new FakeRegistration();
    const onWaiting = vi.fn();
    const stop = watch(registration, () => true, onWaiting);

    const worker = new FakeWorker();
    registration.beginInstall(worker);
    stop();
    worker.transitionTo("installed");

    expect(onWaiting).not.toHaveBeenCalled();

    // And a second update after teardown must not resurrect it.
    registration.beginInstall(new FakeWorker());
    expect(onWaiting).not.toHaveBeenCalled();
  });
});

describe("applyUpdate", () => {
  it("tells the waiting worker to take over, and reloads only once control changes", () => {
    const container = new EventTarget();
    const worker = new FakeWorker();
    const reload = vi.fn();

    applyUpdate(
      worker as unknown as ServiceWorker,
      container as unknown as ServiceWorkerContainer,
      reload,
    );

    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({ type: "SKIP_WAITING" });
    // skipWaiting() is asynchronous. Reloading before control actually changes lands back on
    // the old worker and leaves the new one waiting, which reads as a button that does nothing.
    expect(reload).not.toHaveBeenCalled();

    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("reloads once even if control changes more than once", () => {
    const container = new EventTarget();
    const reload = vi.fn();

    applyUpdate(
      new FakeWorker() as unknown as ServiceWorker,
      container as unknown as ServiceWorkerContainer,
      reload,
    );

    container.dispatchEvent(new Event("controllerchange"));
    container.dispatchEvent(new Event("controllerchange"));

    // The failure this guards against is a reload loop, which on a phone looks like the app
    // refusing to open.
    expect(reload).toHaveBeenCalledOnce();
  });
});
