import fs from "node:fs";
import path from "node:path";

/**
 * A sandbox for running `sw-template.js`.
 *
 * The service worker is the one file in this app that cannot be imported: it is a plain script
 * meant for a global scope that does not exist in a test process. So it is loaded through
 * `new Function` with its globals replaced by fakes, which is what lets its actual behaviour be
 * tested rather than its source text.
 *
 * This lives here rather than in one of the test files because three of them now need it, and
 * the third was added by Phase N — at which point the two existing copies had already drifted
 * apart in what they faked. One sandbox with the environment described once is the difference
 * between "the worker does this" and "the worker does this under my particular fake".
 */

export const ORIGIN = "https://victorgusev.com";

export const WORKER_SOURCE = fs
  .readFileSync(path.join(process.cwd(), "src/lib/pwa/sw-template.js"), "utf8")
  .replace("__BUILD_ID__", "test");

/**
 * The shape of the events the worker is handed.
 *
 * Deliberately loose. A real `FetchEvent` cannot be constructed outside a worker, and every
 * test here stages only the two or three fields the handler under test reads — so the type
 * describes what a caller may supply rather than pretending to be the DOM interface.
 */
export type WorkerEvent = {
  request?: unknown;
  respondWith?: (response: Promise<Response>) => void;
  waitUntil?: (promise: Promise<unknown>) => void;
};

export type Handler = (event: WorkerEvent) => void;

/**
 * `Request`, resolving relative URLs the way a service worker does.
 *
 * Node's `Request` requires an absolute URL and throws on `new Request("/sitemap.xml")`. A
 * browser resolves that against the document, and a worker against its own scope — so the
 * worker's own code is correct and it is the test environment that is missing a base. Without
 * this shim every `new Request(path)` in the worker throws into a `catch` that was written for
 * network failures, and the tests pass by doing nothing at all, which is the worst way to be
 * green.
 */
export class WorkerRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === "string" ? new URL(input, ORIGIN).toString() : input, init);
  }
}

/** Whatever the worker is given in place of `caches`. */
export type CacheLike = {
  match: (request: unknown, options?: { ignoreVary?: boolean }) => Promise<Response | undefined>;
  put: (request: unknown, response: Response) => Promise<void>;
};

/**
 * Rewrite the worker's deadlines so a stall is provable in milliseconds.
 *
 * The real budgets are seconds, and a test that genuinely waited three of them several times
 * over would be slow enough that someone would eventually make it lie. Faking timers is not an
 * option either: `AbortSignal.timeout` is scheduled by the platform rather than by `setTimeout`
 * in this realm, so `vi.useFakeTimers()` does not move it and the test would pass without ever
 * exercising the deadline.
 *
 * It throws rather than returning the source unchanged if the block stops matching. A silent
 * no-op here would leave every stall test waiting the full three seconds and quietly passing
 * for the wrong reason.
 */
export function shrinkBudgets(source: string, ms: number): string {
  const rewritten = source.replace(
    /const BUDGET = \{[^}]*\};/,
    `const BUDGET = { navigation: ${ms}, rsc: ${ms}, report: ${ms}, asset: ${ms} };`,
  );
  if (rewritten === source) {
    throw new Error("the BUDGET block in sw-template.js no longer matches what the tests rewrite");
  }
  return rewritten;
}

export type LoadOptions = {
  fetch: typeof globalThis.fetch;
  cache: CacheLike;
  /** Shrink every deadline to this many milliseconds. See `shrinkBudgets`. */
  budgetMs?: number;
  /**
   * What `navigator.onLine` reports. `true` by default, which is also what plane wifi reports
   * — the condition Phase N exists for.
   */
  onLine?: boolean;
  /** Cache names `caches.keys()` should return, for the eviction pass in `activate`. */
  cacheNames?: string[];
  /** Records names passed to `caches.delete()`. */
  onDeleteCache?: (name: string) => void;
};

/**
 * Loads the worker and returns the handlers it registered.
 *
 * The keys are the event names: `install`, `activate`, `fetch`, `message`, `push`,
 * `notificationclick`.
 */
export function loadWorker(options: LoadOptions): Map<string, Handler> {
  const handlers = new Map<string, Handler>();

  const self = {
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    location: { origin: ORIGIN },
    navigator: { onLine: options.onLine ?? true },
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
    registration: { showNotification: async () => {} },
    skipWaiting: () => {},
  };

  const caches = {
    open: async () => options.cache,
    keys: async () => options.cacheNames ?? [],
    delete: async (name: string) => {
      options.onDeleteCache?.(name);
      return true;
    },
  };

  const source =
    options.budgetMs === undefined ? WORKER_SOURCE : shrinkBudgets(WORKER_SOURCE, options.budgetMs);

  new Function("self", "caches", "fetch", "Request", source)(
    self,
    caches,
    options.fetch,
    WorkerRequest,
  );

  return handlers;
}

/** The path a fetch was made for, however the worker chose to express it. */
export function pathOf(input: RequestInfo | URL): string {
  const raw =
    typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
  const url = new URL(raw, ORIGIN);
  return url.pathname + url.search;
}

/** A `Cache` fake backed by a map of path to HTML, which is all any of these tests need. */
export function fakeCache(initial: Record<string, string> = {}) {
  const entries = new Map<string, string>(Object.entries(initial));

  const cache: CacheLike & { entries: Map<string, string> } = {
    entries,
    match: async (request) => {
      const key = pathOf(request as RequestInfo);
      if (!entries.has(key)) return undefined;
      return new Response(entries.get(key), { headers: { "content-type": "text/html" } });
    },
    put: async (request, response) => {
      entries.set(pathOf(request as RequestInfo), await response.text());
    },
  };

  return cache;
}
