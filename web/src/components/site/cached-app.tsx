"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { LogForm } from "@/components/site/log-form";
import { ExerciseBrowser } from "@/components/site/exercise-browser";
import { ExerciseDetail } from "@/components/site/exercise-detail";
import { SessionLogger } from "@/components/site/session-logger";
import { PrivateTabBar } from "@/components/site/private-tabbar";
import { OutboxConsole } from "@/components/site/outbox-console";
import { requestSync } from "@/components/site/sync-runner";
import { PrivateToaster } from "@/components/site/toasts";
import { CATEGORIES, categoryByKey } from "@/lib/log/categories";
import { reportError } from "@/lib/errors/client";
import { AsOf } from "@/components/site/states";
import { QuickCapture } from "@/components/site/quick-capture";
import { localCaptureWriter, localLogWriter } from "@/lib/offline/write";
import { readCachedView, searchCachedLog, type CachedView } from "@/lib/offline/read";
import { queryFrom } from "@/lib/offline/search";
import { AGING_MS, STALE_MS, type CachedEntry, type CachedTask } from "@/lib/offline/panels";

/**
 * The app with no signal (V3 §2.1).
 *
 * Rendered entirely from IndexedDB, at a **static** route, which is what makes it reachable at
 * all: every page under `/private` is `force-dynamic` and needs the session cookie checked on
 * a server, so with no network there is nothing to render. The service worker precaches this
 * one page and serves it in place of any `/private` navigation that fails.
 *
 * **What is on screen is per-device, not in the bundle.** This file is a Client Component, so
 * its source ships to `/_next/static/chunks/` unauthenticated — labels and layout only. The
 * data arrives from the local mirror at runtime, which exists only on a phone that has already
 * signed in and synced. Someone opening this URL on their own device sees an empty page.
 *
 * **A cached screen must read as cached.** The age of the data is at the top of every view and
 * is never omitted for being small; the tone changes with age, the fact does not.
 */

const PANEL = "rounded-xl border border-border bg-card/60 p-5";
const HEAD = "text-base font-semibold tracking-tight text-foreground";
const META = "font-mono text-[0.65rem] text-muted-foreground";

/** Which of the cached views to show, from the path the navigation was trying to reach. */
type ViewKey =
  "today" | "athletics" | "session" | "exercises" | "exercise" | "academics" | "log" | "sync";

/**
 * The private screens this page has no copy of, and what to call them on screen.
 *
 * Longest prefix first: `/private/work/tailor` has to be recognised before `/private/work`, or
 * a model-backed page that cannot work offline at all would be named after its parent.
 */
const NOT_KEPT: ReadonlyArray<readonly [string, string]> = [
  ["/private/work/tailor", "Tailor"],
  ["/private/calendar", "Calendar"],
  ["/private/work", "Work"],
  ["/private/hobbies", "Hobbies"],
  ["/private/now", "Now"],
];

/**
 * What to render for a path, which is either one of the cached views or an honest refusal.
 *
 * Until 2026-09-05 everything unrecognised fell through to Today. That is the failure mode
 * D-161 already argued against for panels — an unasked-for screen reads as the tap having
 * failed, or worse, as Calendar being empty. Naming the screen costs one line and is the same
 * choice `Missing` makes inside the views (D-174).
 */
type Target = { kind: "view"; key: ViewKey } | { kind: "absent"; name: string };

function viewFor(path: string): Target {
  // Longest prefix first: the session logger lives under the athletics path and has to be
  // recognised before it, or logging offline would land on the read-only overview — the one
  // screen in this app that most needs to work with no signal.
  if (path.startsWith("/private/athletics/log")) return { kind: "view", key: "session" };
  /**
   * The exercise browser and one exercise's page, offline (V4 Phase 2++ Stage 8).
   *
   * They read the bundled catalogue merged with the mirror and write through the outbox — the
   * same two things the logger does — so there is nothing an offline variant would do
   * differently, and the live components are mounted unchanged. Without these two lines the
   * whole area fell through to `athletics`, and "offline throughout" was true of the data layer
   * and false of the screen: `npm run e2e` reached the detail page with no signal and got the
   * record board.
   *
   * Detail before list, longest prefix first, for the same reason `log` comes before
   * `athletics`.
   */
  if (path.startsWith("/private/athletics/exercises/")) return { kind: "view", key: "exercise" };
  if (path.startsWith("/private/athletics/exercises")) return { kind: "view", key: "exercises" };
  if (path.startsWith("/private/athletics")) return { kind: "view", key: "athletics" };
  if (path.startsWith("/private/academics")) return { kind: "view", key: "academics" };
  if (path.startsWith("/private/log")) return { kind: "view", key: "log" };
  // §1.7's screen reads only IndexedDB, so it works here unchanged — and this is where it is
  // most likely to be wanted, since the reason to look at it is usually that there is no
  // signal. Without this line the link to it would land on Today.
  if (path.startsWith("/private/sync")) return { kind: "view", key: "sync" };

  for (const [prefix, name] of NOT_KEPT) {
    if (path.startsWith(prefix)) return { kind: "absent", name };
  }

  // `/private` itself, and the launch with no `from` at all — the app's start_url is
  // `/private`, so this is the ordinary way in. Anything else under `/private` is a route
  // added since this list was written, and saying so beats silently showing Today.
  if (path === "" || path === "/private" || !path.startsWith("/private/")) {
    return { kind: "view", key: "today" };
  }
  return { kind: "absent", name: "That screen" };
}

const TITLE: Record<ViewKey, string> = {
  today: "Today",
  session: "Log a session",
  athletics: "Training",
  exercises: "Exercises",
  exercise: "Exercise",
  academics: "Academics",
  log: "The log",
  sync: "Not sent",
};

/**
 * Which view to render, read from the URL.
 *
 * The URL is external state, so it is subscribed to rather than copied into `useState` in an
 * effect. `subscribe` does nothing because this page never navigates within itself — the view
 * links are plain `<a>` elements, so a change of view is a fresh document.
 *
 * Read from `location` rather than `useSearchParams`: the page is reached by the service
 * worker rewriting the URL of a failed navigation, not by a router push, so there is no
 * Next.js navigation state to read from. `getServerSnapshot` answers "today" so the server
 * render and the first client render agree — a mismatch here would make React throw the whole
 * page away and rebuild it.
 */
const NO_UPDATES = () => () => {};

/**
 * The path the failed navigation was aimed at, not the view derived from it.
 *
 * The raw path is what is subscribed to because two things need it: which view to render, and
 * which tab to light in the bottom bar. Deriving both from one string keeps them from ever
 * disagreeing about where the user thinks they are.
 */
const readPath = (): string => new URLSearchParams(window.location.search).get("from") ?? "";
const serverPath = (): string => "/private";

export function CachedApp() {
  const [view, setView] = useState<CachedView | null>(null);
  const [failed, setFailed] = useState(false);
  const path = useSyncExternalStore(NO_UPDATES, readPath, serverPath);
  const target = viewFor(path);
  const key = target.kind === "view" ? target.key : null;
  const capture = useMemo(() => localCaptureWriter(requestSync), []);

  useEffect(() => {
    // Defined inside the effect and cancelled on unmount: this is a subscription to an
    // external system — IndexedDB — not state derived from props, so the read happens in a
    // callback rather than synchronously in the effect body.
    let cancelled = false;

    void (async () => {
      try {
        const snapshot = await readCachedView();
        if (!cancelled) setView(snapshot);
      } catch (error) {
        // Private browsing, or a blocked upgrade. Say so rather than rendering empty panels,
        // which would read as "you have nothing" — and report it, because a phone that cannot
        // open its own store offline is the failure nobody would ever mention (D-165).
        void reportError(error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The bar renders on every branch below, including the failure and loading ones. It is the
  // app's navigation, and a screen that cannot show its content is exactly when a way off it
  // matters most. `path` rather than the live pathname, because the live one is `/cached`
  // everywhere here and no tab would ever light up (D-174).
  const bar = (
    <>
      <PrivateTabBar path={path || "/private"} offline />
      {/* Its own `Toaster` (§5.2): this shell renders *outside* `app/private/layout.tsx`, which
          is the whole point of `/cached` being a static route, so the one mounted there is not
          in this tree. Without this, an undo offered on the offline shell would have nowhere to
          appear — and offline is where a mis-tap is least recoverable, because the undo would
          have to travel through the outbox too. */}
      <PrivateToaster />
    </>
  );

  if (failed) {
    return (
      <>
        <p className="mt-6 text-sm text-muted-foreground">
          This device will not open its local database, so there is nothing stored to show.
        </p>
        {bar}
      </>
    );
  }

  if (target.kind === "absent") {
    return (
      <div className="mt-6 space-y-4">
        <div className={PANEL}>
          <p className="text-sm text-foreground">
            {target.name} needs a signal — it is not kept on this phone.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Today, Training, Academics, the log and anything not yet sent are stored here. The rest
            is read from the server each time, so there is nothing to show you offline.
          </p>
        </div>

        {/* Still offered, because the reason to be on a screen with no signal is usually that
            something needs writing down before it is lost (D-164). */}
        <QuickCapture write={capture} />

        <Elsewhere current={null} />
        {bar}
      </div>
    );
  }

  if (!view)
    return (
      <>
        <p className="mt-6 text-sm text-muted-foreground">Reading what is here…</p>
        {bar}
      </>
    );

  return (
    <div className="mt-6 space-y-4">
      <SnapshotAge view={view} />

      {/* The same capture box as the live page, writing into the outbox. It is above
          everything and on every view, because the thing most likely to be needed with no
          signal is somewhere to put a thought before it is lost (D-164). */}
      <QuickCapture write={capture} />

      {view.empty && key !== "sync" ? (
        <div className={PANEL}>
          <p className="text-sm text-foreground">Nothing has been synced to this device yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The app copies your tasks, log and training down the first time it runs with a
            connection. Open it once with signal and this page will have something to show.
          </p>
        </div>
      ) : (
        <>
          {key === "today" && <TodayView view={view} />}
          {key === "athletics" && <AthleticsView view={view} />}
          {/* The same component the live route mounts, not a cut-down copy. It reads IndexedDB
              and writes the outbox either way, so there is nothing for an offline variant to do
              differently — which is the point of `lib/athletics/session.ts` having one path. */}
          {key === "session" && <SessionLogger />}
          {/* Same argument as the logger above: the live components, mounted unchanged. */}
          {key === "exercises" && <ExerciseBrowser />}
          {key === "exercise" && <ExerciseDetail slug={slugFrom(path)} />}
          {key === "academics" && <AcademicsView view={view} />}
          {key === "log" && <LogView view={view} query={queryFrom(path)} />}
          {key === "sync" && <OutboxConsole />}
        </>
      )}

      <Elsewhere current={key} />
      {bar}
    </div>
  );
}

/**
 * The exercise a detail path names, decoded.
 *
 * `seedKey ?? name`, URL-encoded by `exerciseHref` — so a movement typed by hand, whose name is
 * the only identity it has, round-trips through the URL intact including its spaces.
 */
function slugFrom(path: string): string {
  const tail = path.split("/private/athletics/exercises/")[1] ?? "";
  return decodeURIComponent(tail.split("?")[0] ?? "");
}

/**
 * How old this is, said before anything else on the page.
 *
 * Above the panels rather than inside each one: it is one number for the whole snapshot, and
 * repeating it per panel would imply the panels could disagree.
 *
 * **The age itself is the shared `AsOf` badge** (§5.1, Q285/Q286), given this surface's own
 * thresholds. It was a bare sentence — *"As of 4h ago."* — with the grade carried only by the
 * panel's border colour, which is colour signalling alone (DESIGN.md §2 rule 1) and is the one
 * screen in the app where the reader may be looking at it in daylight on a plane.
 *
 * The thresholds stay `panels.ts`'s 6h/48h rather than the outbox's 24h, and that difference is
 * the reason `AsOf` takes them as arguments: this is judging a whole mirror of a database,
 * which is fine for a morning and worrying after two days, not one queued write.
 *
 * Renamed from `AsOf` so the local panel and the shared badge are not two things under one
 * name. The paragraph below the badge is what makes this a panel rather than a marker, and it
 * is the part worth keeping local: it is offline-specific copy, not a general staleness idea.
 */
function SnapshotAge({ view }: { view: CachedView }) {
  const { freshness } = view;

  const tone =
    freshness.level === "stale"
      ? "border-destructive/40 bg-destructive/5"
      : freshness.level === "aging"
        ? "border-highlight/40 bg-highlight/10"
        : "border-border bg-card/60";

  return (
    <div className={`rounded-lg border px-4 py-3 ${tone}`}>
      {freshness.level === "never" || freshness.lastSyncAt === null ? (
        <p className="text-sm text-foreground">This device has never synced.</p>
      ) : (
        <AsOf
          at={freshness.lastSyncAt}
          // `lastSyncAt + ageMs` is exactly the instant `freshnessOf` measured against, so the
          // badge and the `level` that tints the panel around it cannot disagree. Calling
          // `Date.now()` here instead would measure against a *different* instant on every
          // render, which is what `react-hooks/purity` is pointing at.
          now={freshness.lastSyncAt + (freshness.ageMs ?? 0)}
          aging={AGING_MS}
          stale={STALE_MS}
          className="text-sm"
        />
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        {freshness.level === "stale"
          ? "That is old enough that things have almost certainly changed. Treat it as a record of what was, not of what is."
          : "Read from this phone, not from the server. Anything changed on the laptop since then is not here."}
      </p>
    </div>
  );
}

function TodayView({ view }: { view: CachedView }) {
  return (
    <>
      <StoredSummary summary={view.summary} />

      <section className={PANEL}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={HEAD}>Due</h2>
          <span className={META}>{view.due.length > 0 ? `${view.due.length} open` : "clear"}</span>
        </div>
        <TaskList tasks={view.due} empty="Nothing due by tonight." />
      </section>

      <section className={PANEL}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={HEAD}>Logged today</h2>
          <span className={META}>{view.loggedToday.length}</span>
        </div>
        {view.loggedToday.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing logged today yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {view.loggedToday.map((entry) => (
              <li key={entry.id} className="text-sm text-foreground">
                {entry.line}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Missing what="Your calendar and the day's summary" />
    </>
  );
}

function AthleticsView({ view }: { view: CachedView }) {
  return (
    <>
      <section className={PANEL}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={HEAD}>Last weighed</h2>
          <span className={META}>{view.weight?.measuredOn ?? "—"}</span>
        </div>
        <p className="mt-4 text-2xl font-semibold text-foreground tabular-nums">
          {view.weight ? `${view.weight.weightLbs} lb` : "—"}
        </p>
      </section>

      <section className={PANEL}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={HEAD}>Recent sets</h2>
          <span className={META}>{view.recentSets.length}</span>
        </div>
        {view.recentSets.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No training on this device yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {view.recentSets.map((set, index) => (
              <li
                key={`${set.exercise}-${set.performedAt}-${index}`}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-foreground">{set.exercise}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {describeSet(set)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {view.rehabToday.length > 0 && (
        <section className={PANEL}>
          <h2 className={HEAD}>Rehab, ticked today</h2>
          <p className="mt-4 text-sm text-muted-foreground">{view.rehabToday.join(" · ")}</p>
        </section>
      )}

      {/* Records are derived on read from the whole history (D-025), and only part of that
          history is mirrored. A PR board computed from a partial mirror would show a number
          that is wrong in the one direction that matters — too low — and look authoritative. */}
      <Missing what="Records, charts and the adjusted-split table" />
    </>
  );
}

function AcademicsView({ view }: { view: CachedView }) {
  return (
    <>
      {view.byCourse.length === 0 ? (
        <section className={PANEL}>
          <h2 className={HEAD}>Coursework</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            No open work with a course on it is stored here.
          </p>
        </section>
      ) : (
        view.byCourse.map((group) => (
          <section key={group.course} className={PANEL}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className={HEAD}>{group.course}</h2>
              <span className={META}>{group.tasks.length}</span>
            </div>
            <TaskList tasks={group.tasks} empty="" />
          </section>
        ))
      )}

      <Missing what="Your degree audit, course notes and grades" />
    </>
  );
}

/**
 * The log, writable with no signal (V3 §2.2).
 *
 * The same `LogForm` the live app uses — same fields, same set shapes, same chips, same
 * restore-what-you-typed when a save fails — handed a writer that puts the entry into the
 * outbox instead of posting a Server Action. §1.2 built the store and §1.3 built the flush, so
 * an entry written here is sent by exactly the path `roundtrip.test.ts` already covers.
 *
 * The chips come from the local mirror, which is why this is not a lesser form: they are built
 * from past entries, and past entries are already on the phone.
 */
function LogView({ view, query }: { view: CachedView; query: string }) {
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const definition = categoryByKey(category) ?? CATEGORIES[0];

  const [results, setResults] = useState<CachedEntry[] | null>(null);

  useEffect(() => {
    // No term, nothing to look up. Returning early rather than clearing the state: a
    // synchronous `setState` in an effect is a cascading render, and there is nothing to clear
    // anyway — `shown` below derives the empty case instead of storing it.
    if (query === "") return;
    let cancelled = false;
    void (async () => {
      try {
        const found = await searchCachedLog(query);
        if (!cancelled) setResults(found);
      } catch (error) {
        void reportError(error);
        if (!cancelled) setResults([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Derived, not stored. This screen never navigates within itself — every search is a fresh
  // document — so `query` is fixed for the life of the component and there is no stale-result
  // case to clear.
  const shown = query === "" ? null : results;

  // `requestSync` on every write: with no network the runner does nothing and the entry simply
  // waits, and the moment there is one this is what makes it leave without a foreground event.
  const write = useMemo(() => localLogWriter(requestSync), []);

  return (
    <>
      {/* The same plain GET form the live page carries, aimed at the same URL (§2.3, D-183).
          Online it reaches the server; offline the worker answers `/private/log?q=…` with this
          screen, which reads the term back out of the path it was handed. One box, one URL, one
          habit — the only thing that changes with signal is who answers. */}
      <section className={PANEL}>
        <form method="get" action="/private/log" className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search what is on this phone"
            aria-label="Search the log on this phone"
            className="min-h-10 w-full rounded-md border border-border bg-card/60 px-3 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none"
          />
        </form>

        {shown !== null && (
          <div className="mt-4">
            <p className={META}>
              {shown.length === 0
                ? `Nothing on this phone matches "${query}".`
                : `${shown.length} match${shown.length === 1 ? "" : "es"} for "${query}"`}
            </p>
            {shown.length > 0 && (
              <ul className="mt-2 space-y-2">
                {shown.map((entry) => (
                  <li key={entry.id} className="flex items-baseline gap-3">
                    <span className={`${META} shrink-0`}>{entry.occurredAt.slice(0, 10)}</span>
                    <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[0.55rem] text-muted-foreground">
                      {categoryByKey(entry.category)?.label ?? entry.category}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-foreground">{entry.line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className={PANEL}>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((each) => (
            <button
              key={each.key}
              type="button"
              onClick={() => setCategory(each.key)}
              className={`min-h-10 rounded-md border px-3 text-sm transition-colors ${
                each.key === category
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {each.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{definition.hint}</p>

        <div className="mt-5">
          <LogForm
            // Remounts on a category change, so the previous category's values cannot be
            // submitted by accident — same reason the live form keys itself this way.
            key={definition.key}
            category={definition}
            chips={view.chips[definition.key]}
            write={write}
          />
        </div>
      </section>

      <section className={PANEL}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={HEAD}>Logged today</h2>
          <span className={META}>{view.loggedToday.length}</span>
        </div>
        {view.loggedToday.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing logged today yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {view.loggedToday.map((entry) => (
              <li key={entry.id} className="text-sm text-foreground">
                {entry.line}
              </li>
            ))}
          </ul>
        )}
        {/* An entry written on this page will not appear above until the next read, because
            the list is a snapshot taken once — deliberately, so the panels cannot disagree
            with the "as of" line. Saying so beats a list that looks like it lost something. */}
        <p className="mt-4 text-xs text-muted-foreground">
          Saved entries appear here after a reload. Nothing is lost in the meantime — check{" "}
          <a
            href={`/cached?from=${encodeURIComponent("/private/sync")}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Not sent
          </a>{" "}
          to see what is waiting.
        </p>
      </section>
    </>
  );
}

function TaskList({ tasks, empty }: { tasks: CachedTask[]; empty: string }) {
  if (tasks.length === 0) {
    return empty ? <p className="mt-4 text-sm text-muted-foreground">{empty}</p> : null;
  }

  return (
    <ul className="mt-4 space-y-2">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-foreground">{task.title}</span>
          {task.overdue && <span className="shrink-0 eyebrow text-destructive">overdue</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * What this screen cannot show, named rather than left blank.
 *
 * An empty panel reads as "nothing on today". Saying the data is not on the phone is both true
 * and the difference between a screen that is trusted and one that is quietly wrong.
 */
/**
 * The last summary the model wrote, offline (V3 §3.6).
 *
 * D-124 persisted these so a summary would outlive the call that produced it, and this is the
 * screen that most needed it — the daily summary is the one thing on Today that cannot be
 * recomputed without a network, so without this it was simply absent with no explanation.
 *
 * **Shown whatever its age, and always with the day it describes.** Victor's call, and it is
 * the rule this whole screen already follows: the age is a label, not a filter. A summary of
 * Tuesday marked as Tuesday is useful; the same text unlabelled would be a lie, and hiding it
 * would be pretending the phone knows less than it does.
 */
function StoredSummary({ summary }: { summary: CachedView["summary"] }) {
  if (!summary) return null;

  return (
    <section className={PANEL}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={HEAD}>The last summary</h2>
        <span className={META}>{summary.periodStart}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{summary.summary}</p>
    </section>
  );
}

function Missing({ what }: { what: string }) {
  return (
    <p className="px-1 text-sm text-muted-foreground">
      {what} need the network, so they are not here.
    </p>
  );
}

function Elsewhere({ current }: { current: ViewKey | null }) {
  const others = (["today", "session", "athletics", "academics", "log", "sync"] as const).filter(
    (key) => key !== current,
  );

  return (
    <div className="border-t border-border pt-4">
      <p className={META}>Also stored on this phone</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {others.map((key) => (
          <a
            key={key}
            href={`/cached?from=${encodeURIComponent(pathFor(key))}`}
            className="min-h-10 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            {TITLE[key]}
          </a>
        ))}
        {/* A plain anchor, like every other link on this page. It was a <Link> until
            2026-09-05, which meant the one control whose entire purpose is "see if the server
            is back" tried to reach the server *through the router* — a client transition that
            fails with no signal and looks like a dead button. A document navigation either
            loads the live app or is answered by the worker with this same shell (D-175). */}
        <a
          href="/private"
          className="min-h-10 rounded-md border border-primary/50 px-3 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10"
        >
          Try the live app
        </a>
      </div>
    </div>
  );
}

function pathFor(key: ViewKey): string {
  if (key === "today") return "/private";
  // The one view whose key is not its path. It could have been called `athletics/log`, but the
  // key is also a React branch and a title lookup, and a slash in it reads as a typo.
  if (key === "session") return "/private/athletics/log";
  return `/private/${key}`;
}

/** "185 × 5" for a lift, "2000m 7:12" for a piece — never a multiplication of the two. */
function describeSet(set: {
  weightLbs: number | null;
  reps: number | null;
  distanceM: number | null;
  durationS: number | null;
}): string {
  if (set.weightLbs !== null && set.reps !== null) return `${set.weightLbs} × ${set.reps}`;
  const parts: string[] = [];
  if (set.distanceM !== null) parts.push(`${set.distanceM}m`);
  if (set.durationS !== null) parts.push(clock(set.durationS));
  if (set.weightLbs !== null) parts.push(`${set.weightLbs} lb`);
  if (set.reps !== null) parts.push(`${set.reps}r`);
  return parts.join(" ") || "—";
}

function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export { viewFor, describeSet, TITLE };
