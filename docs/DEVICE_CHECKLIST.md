# Device checklist

**V3 §2.5.** The fourth release gate, alongside `npm test`, `npm run typecheck` and
`npm run shots`. Those three run on a laptop and gate on an exit code. This one does not run
anywhere — you run it, on the phone, with your thumb.

## Why this exists at all

Everything in V3 that matters most is invisible to the other three gates:

- **Whether the app installs.** `beforeinstallprompt` is a browser judgement about manifest,
  icons, scope and service worker together. Playwright never fires it.
- **Whether it works with no signal.** The offline suite (§3.7) drives a real worker, but it
  drives it in Chromium on a laptop with a fast disk and no radio. A Samsung dropping to no
  bars mid-write is a different event.
- **Whether the icon is right.** Android caches launcher icons aggressively and will keep
  showing a stale one for days after a deploy.
- **Whether you can reach the thing you need.** `shots` measures how far down the page the
  answer sits in pixels. It cannot measure whether that is under your thumb on a 6.7" screen
  held one-handed on a bus.

Every one of those has already gone wrong once in this project, and none of them produced a
failing test.

**Biometrics are not on this list.** D-158 switched the local lock off, so there is nothing
to check.

---

## Part 1 · Attaching DevTools over USB

Do this whenever something on the phone misbehaves and you cannot tell why. It gives you the
real console, the real Application tab, and the real cache contents — for the app as installed,
not for a tab pretending to be a phone.

### One-time, on the phone

1. **Settings → About phone → Software information**, tap **Build number** seven times.
   Developer options appear.
2. **Settings → Developer options → USB debugging**, on.
3. Plug into the laptop with a **data** cable. Charge-only cables are the single most common
   reason this silently does not work.
4. The phone shows *Allow USB debugging?* — allow, and tick *Always allow from this computer*.

### Each session, on the laptop

1. Open `chrome://inspect/#devices` in Chrome.
2. **Discover USB devices** must be ticked.
3. The phone appears by model, with a list of its open tabs and — this is the part that
   matters — **its installed PWAs and its service workers**, each with an `inspect` link.
4. Click `inspect` next to the installed app, not next to a browser tab. They are different
   contexts with different caches.

### What to look at once you are in

| Question | Where |
|---|---|
| Is the worker running, and which build? | **Application → Service Workers** |
| What is actually cached? | **Application → Cache Storage** |
| What is in the outbox? | **Application → IndexedDB**, or just open `/private/sync` |
| Did anything throw? | **Console** — and it should also be on the dashboard already (D-165) |

**Testing offline: use airplane mode on the phone, not DevTools' Offline checkbox.** The
checkbox lies about installed PWAs in ways that have wasted an afternoon before. Airplane mode
is the thing you are actually trying to survive.

---

## Part 2 · The per-release list

Run this after a deploy you intend to rely on. Ten minutes. Anything that fails goes in
`current_sprint.md` rather than being remembered.

### 1 · Install

- [ ] On a **fresh** profile or after uninstalling, the install offer appears in the tab bar's
      **More** sheet. It is absent when already installed — that absence is correct, not a
      bug (§1.1).
- [ ] Installing puts it on the home screen and it opens **without browser chrome** — no URL
      bar, no tabs. If the URL bar is there, `display` in `app/manifest.ts` or the start URL
      scope is wrong.
- [ ] Signing in works in the installed app. It is a separate cookie jar from the browser tab.

### 2 · The icon

- [ ] The home-screen icon is the current one, not the previous one.
- [ ] **If it is stale:** remove the app from the home screen, uninstall, clear Chrome's site
      data for the origin, reinstall. Android will otherwise keep the cached icon for days.
      This is the fix, not a workaround — there is nothing to change in the code.
- [ ] The icon is legible at launcher size and inside Android's circular mask
      (`maskable-512.png` is the one that gets masked).

### 3 · The offline round trip

The single most important item on this list, because it is the whole point of V3 and the
thing least covered by tests.

- [ ] Open the app on signal. Let it settle.
- [ ] **Airplane mode on.**
- [ ] The app still opens from the home screen. It does not show the browser's offline dinosaur.
- [ ] Log **three** entries in different categories. Each one saves and appears immediately.
- [ ] `/private/sync` lists all three as not sent, and says something honest about why.
- [ ] Navigate around — Today, Train, the log — without a blank screen.
- [ ] **Airplane mode off.** Wait.
- [ ] All three leave the outbox.
- [ ] On the **laptop**, all three are in the log **exactly once**. Duplicates here are the
      failure mode the whole `opId`/`clientId` design exists to prevent, so a duplicate is a
      real bug and not a retry to be shrugged at.

### 4 · The portfolio with no signal

- [ ] Airplane mode on. Open the public site — home, a project page, the resume.
- [ ] It renders. This is §2.2's promise: showing someone your work in a building with no bars.

### 5 · Thumb reach

Hold the phone one-handed, the way you actually hold it.

- [ ] The log button is reachable without shifting your grip.
- [ ] On Today, the first thing you have to do is visible without scrolling.
- [ ] The same on Train, Next and the log.
- [ ] Nothing important sits in the top-left corner, which is the furthest point from a right
      thumb.

`npm run shots` reports the pixel number for each of these (§3.2) and fails above the limit.
This step is the part the number cannot tell you.

### 6 · A quick look at the dashboard

- [ ] No error panel on `/private`. **The panel being absent is the pass condition** — it only
      appears when something broke (D-165).
- [ ] If it is there, read it before doing anything else on this list; a crash from the last
      release explains most other symptoms.

---

## Part 3 · When something fails

| Symptom | First thing to check |
|---|---|
| App opens to the offline page even with signal | Application → Service Workers: is an old worker still controlling the page? |
| Entries never leave the outbox | `/private/sync` says why. Then the dashboard error panel. |
| The same entry twice on the laptop | Not a retry — a real idempotency bug. Capture the two rows before deleting either. |
| Stale content after a deploy | Cache Storage: the cache name carries the build stamp. Two builds present means the new worker has not activated. |
| Icon unchanged | Part 2 §2. Not a code problem. |
| Nothing renders offline at all | Was the app ever opened online since install? Nothing is precached before the worker activates. |

---

## What this does not cover, on purpose

- **Battery and thermals.** Worth knowing and not worth a step nobody will do honestly.
  If the phone gets warm using this app, that is a bug report, not a checkbox.
- **iOS.** There is one device that matters and it runs Android.
- **Other Android browsers.** Samsung Internet is Chromium and mostly behaves; nothing here
  is tested against Firefox and nothing claims to be.
- **Anything a test can check.** If a step on this list could be automated, it belongs in the
  suite instead. This list is deliberately only the things that cannot be.
