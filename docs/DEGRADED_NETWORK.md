# Degraded network — why the app freezes on plane wifi

**Reported:** 2026-09-08, from plane wifi. The app freezes when the connection is bad but not
gone. **Status: fixed and verified, 2026-09-08.** N1–N8 shipped; N5's 13-point half is deferred
to **N9**. **Size:** ~45 points.

## 0. What happened, for anyone reading this later

The diagnosis in §1 held exactly. The fix is `src/lib/net/deadline.ts` plus deadlines in the
service worker, and `npm run e2e:degraded` now measures it: a stalled tab tap reaches a usable
screen in **~6.1s** (the 3s RSC deadline, then the 3s navigation deadline), a direct navigation
falls back in **~3.1s**, and a precached public page opens in **~90ms** without touching the
network. Before Phase N every one of those was unbounded.

**N3's open question is closed.** §5 said to verify on a real build that the App Router falls back
to a hard navigation when an RSC fetch fails, rather than trusting it. It does — Next logs
_"Failed to fetch RSC payload … Falling back to browser navigation"_ — so the explicit
`location.href` escape hatch was **not** needed. Decisions: D-204 through D-210 in
`web/DECISIONS.md`.

**Three bugs were found by running it, not by reading it,** and all three passed every unit test
in existence at the time:

1. The slow-save notice, written the obvious way, would have **re-enabled the save button
   mid-POST** — a `setState` inside a `<form>` ends `useFormStatus().pending` for every reader
   (D-207).
2. Landing on the cached shell is a hard navigation, so the app arrived at the fallback screen
   with everything it had learned about the connection thrown away, and **said nothing** (D-208).
3. `online` was being **swallowed by the sync backoff**, so a reconnect did not drain the outbox
   (D-209).

Two corrections to this document's own plan are recorded where they belong: N5's proposed wording
was false in the live app (D-206), and the first degraded harness throttled the page but not the
service worker, which is its own target (D-210).

---

## 1. The one-line cause

**No network call the browser makes has a deadline.** `fetch()` has no default timeout — not in
the spec, not in Chrome — so a request that connects and then stalls waits essentially forever.

The entire offline story is built on `try/catch`. A `catch` only runs when a request is
**rejected**. A stalled request is not rejected, so every fallback in the app is unreachable in
exactly the condition it was written for.

Grep confirms it: the codebase has three timeouts and **all three are server-side** —
[ics.ts:141](../web/src/lib/calendar/ics.ts#L141), [load.ts:99](../web/src/lib/jobs/load.ts#L99),
[write.ts:36](../web/src/lib/vault/write.ts#L36). Those are the app calling GitHub and Google.
Nothing the _phone_ does has one.

## 2. Why offline works and degraded does not

This is the part worth sitting with, because the offline work was done well and that is precisely
what hides the bug.

|                    | Radio off                  | Plane wifi                               |
| ------------------ | -------------------------- | ---------------------------------------- |
| `fetch`            | rejects in milliseconds    | hangs                                    |
| `navigator.onLine` | `false` — conclusive       | **`true`** — the interface is associated |
| SW `catch`         | runs, serves the shell     | never runs                               |
| What you see       | the app, minus the network | a spinner, forever                       |

Every offline path keys on a failure that arrives _fast_. Plane wifi produces a failure that
never arrives at all, and `navigator.onLine` — the one signal the app consults — actively lies,
because the radio really is associated with an access point. `sync-runner.tsx` already says this
in a comment ("hotel wifi with a captive portal reports online") and then the code trusts it
anyway.

**The app has no concept of "reachable". It only has "has an interface".**

## 3. The five places it hangs

| #   | Where                                                        | What happens                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [sw-template.js:382](../web/src/lib/pwa/sw-template.js#L382) | `return await fetch(request)` for a navigation. Stalls → blank screen, no offline fallback.                                                                                                                                              |
| 2   | [sw-template.js:395](../web/src/lib/pwa/sw-template.js#L395) | The retry, gated on `onLine !== false`. On plane wifi that gate passes, so a stall is **retried and the freeze doubles**.                                                                                                                |
| 3   | RSC navigations                                              | **Not intercepted at all.** The handler covers `navigate`, `/_next/static/`, `/icons/`, `/_next/image` — a client `<Link>` transition is none of those.                                                                                  |
| 4   | [engine.ts:205](../web/src/lib/sync/engine.ts#L205)          | `httpPoster` has no deadline. A stalled flush leaves `runningRef` true at [sync-runner.tsx:90](../web/src/components/site/sync-runner.tsx#L90) forever — every later trigger, including "Send now", becomes a silent no-op until reload. |
| 5   | Server actions                                               | POSTs. The SW returns early at [line 370](../web/src/lib/pwa/sw-template.js#L370) (GET only), and no action has a deadline. `useFormStatus().pending` stays true → "Saving…" forever, form disabled.                                     |

**#3 is the one that matches "freezes up" most exactly.** In the installed PWA, tapping a tab is
a `<Link>` → an RSC fetch with the `RSC: 1` header. `request.mode` is not `"navigate"`, so the
service worker ignores it entirely and it goes to the network naked. Because
[private/loading.tsx](../web/src/app/private/loading.tsx) exists, React shows the skeleton the
instant the transition starts — and then nothing ever resolves it. A skeleton that never fills
in, with no way back. That is the freeze.

### 3b. Prefetch makes it worse, not neutral

The tab bar renders up to nine `<Link>`s, each prefetching by default. Vercel serves HTTP/2, so
those streams **share one TCP connection** with the navigation being waited on — and on a lossy
link a single lost packet head-of-line-blocks every stream on that connection.

So the prefetches meant to make navigation instant are, on plane wifi, competing with and
delaying the exact request the user is staring at.

## 4. The principle

> **Reachability is a conclusion the app draws from its own requests, not a state the OS
> reports.** Anything without a deadline is a freeze waiting for the right connection.

Two rules fall out:

1. **Every browser-side `fetch` gets a deadline.** No exceptions; the budget varies, the
   existence of one does not.
2. **A deadline that fires is a routing decision, not an error.** It means "serve from cache
   now" or "queue this and move on" — never a spinner, and never a dead end.

## 5. The plan

Points are difficulty, not schedule — same convention as `V4_PLAN.md`.

### N1 · One deadline helper — 3 pts — DONE

`src/lib/net/deadline.ts`. `fetchWithDeadline(input, init, ms)` over
`AbortSignal.any([AbortSignal.timeout(ms), init.signal])`, with the budgets as named constants
rather than scattered numbers. Starting budgets, to be tuned against a real measurement:
navigation 3s, RSC 3s, sync 10s (a 100-op batch is legitimately slow), error report 5s.

### N2 · The worker races the network — 8 pts — DONE **← highest value**

- Navigations become `Promise.race([fetch, deadline])`. On timeout, serve the cached shell or
  the precached public page **immediately**.
- **Retry only a fast rejection, never a stall.** Right now a stall is the one case that gets
  retried, which is backwards.
- Public pages get stale-while-revalidate: a precached copy beats waiting.
- `report()` at [line 90](../web/src/lib/pwa/sw-template.js#L90) gets a deadline too — its
  `reporting` guard means one stalled POST disables worker error reporting for the worker's
  whole life.

### N3 · Intercept RSC navigations — 5 pts — DONE, and the fallback was verified

Add a branch for same-origin GETs carrying the `RSC` header or `_rsc` param, raced against the
same deadline. On timeout, **let it reject**: the App Router falls back to a hard navigation
when an RSC fetch fails, which then hits the navigate branch and lands on the cached shell.
That turns an infinite skeleton into a 3-second one followed by a working screen.

_Verify the fallback on a real installed build rather than trusting it_ — it is framework
behaviour, not a documented API, and the whole fix rests on it. If it does not hold, the
fallback is an explicit `location.href` from a router error boundary.

### N4 · Sync cannot wedge — 3 pts — DONE

Give `httpPoster` the deadline. `flush` already classifies a network rejection as `transient`,
so backoff, the badge and the retry screen all start working with no further change. Add a
belt-and-braces timeout around the whole run so `runningRef` can never stay true.

### N5 · Writes stop depending on the network — 3 pts DONE, 13 deferred to N9

Server actions are framework-owned POSTs; you cannot hand one an `AbortSignal`, so there is no
way to time one out from outside.

- **Now (3):** a watchdog in the form. If `pending` is still true after ~6s, say so honestly —
  "still trying; this is saved on the device either way" — instead of a disabled button.
- **Later (13):** route every write through the outbox, so the online and offline write paths
  become one path. Ops already carry idempotency keys and the outbox already dedupes, so the
  machinery exists; this is plumbing, not new architecture. **This is the real fix** — it makes
  a bad connection incapable of affecting whether a log entry survives.

### N6 · Stop prefetching into a stalled pipe — 3 pts — DONE

`prefetch={false}` on the tab bar's links once the connection is known degraded. See §3b.

### N7 · A reachability signal the app owns — 5 pts — DONE

Derive `healthy | degraded | unreachable` from actual request outcomes — a fired deadline is
evidence, a fast success is evidence, `navigator.onLine === false` is conclusive but
`=== true` proves nothing. Use `navigator.connection.rtt`/`effectiveType` as a hint where it
exists (Chrome Android; absent on iOS Safari), never as the truth.

Then **say it once, quietly**: "Connection is poor — everything is being saved on the device."
This is the part that makes it _seamless_ rather than merely non-frozen. The app is genuinely
fine in this state; it just needs to say so instead of looking broken.

### N8 · A test that reproduces it — 5 pts — DONE

`scripts/e2e-offline.mjs` already drives an offline run. Add a **degraded** profile via CDP
`Network.emulateNetworkConditions` (high latency, packet loss) and assert every screen reaches
a usable state within a bound. Without this the bug returns the next time someone adds a fetch.

### N9 · Every write goes through the outbox — 13 pts — **not started**

The half of N5 that was deferred, promoted to an item of its own so it stops being a footnote.

Server actions are framework-owned POSTs with no `AbortSignal`, so a write in the live app cannot
be timed out and, more importantly, **has no local copy**. Only the cached shell writes through
the outbox. That asymmetry is why N5 ships a smaller sentence than this document originally
proposed: the app cannot honestly promise an entry is safe on the device, because in the live app
it is not (D-206).

Routing every write through the outbox makes the online and offline write paths one path. Ops
already carry idempotency keys and the outbox already dedupes, so this is plumbing rather than new
architecture — and it is the change that makes a bad connection **incapable** of affecting whether
an entry survives. When it lands, `slow-save.tsx`'s wording should grow back into the sentence
this document first wrote.

Deferred deliberately on 2026-09-08: it touches every form in the app, and V4 Phase 2 is about to
rebuild one of them.

## 6. Ordering

**N2 + N3 + N4 is 16 points and removes the freeze.** Everything after that is turning "not
frozen" into "seamless".

My recommendation is that this jumps ahead of the rest of V4. A screen that hangs is worse than
a screen that is not yet beautiful, and V4 phases 5–7 are all screens this would hang.

## 7. What not to do

- **Do not shorten timeouts to "fix" it.** A 1s budget on a slow-but-working connection turns
  working into broken. The fix is falling back well, not failing sooner.
- **Do not cache private responses** to dodge the round trip. That call was made deliberately
  (§2.1) and the threat model has not changed; the shell reads IndexedDB instead.
- **Do not trust `navigator.onLine === true`.** It is the signal that fails in this exact case.
  `false` remains conclusive and is still worth checking.
- **Do not make `/cached` dynamic.** It is the destination every one of these fixes routes to.
- **Do not retry a stall.** Retrying something that never answered doubles the wait and changes
  nothing.
