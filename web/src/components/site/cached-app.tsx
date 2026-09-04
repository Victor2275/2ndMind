"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { LogForm } from "@/components/site/log-form";
import { OutboxConsole } from "@/components/site/outbox-console";
import { requestSync } from "@/components/site/sync-runner";
import { CATEGORIES, categoryByKey } from "@/lib/log/categories";
import { reportError } from "@/lib/errors/client";
import { approximateAge } from "@/lib/sync/outbox-view";
import { QuickCapture } from "@/components/site/quick-capture";
import { localCaptureWriter, localLogWriter } from "@/lib/offline/write";
import { readCachedView, type CachedView } from "@/lib/offline/read";
import type { CachedTask } from "@/lib/offline/panels";

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
type ViewKey = "today" | "athletics" | "academics" | "log" | "sync";

function viewFor(path: string): ViewKey {
  if (path.startsWith("/private/athletics")) return "athletics";
  if (path.startsWith("/private/academics")) return "academics";
  if (path.startsWith("/private/log")) return "log";
  // §1.7's screen reads only IndexedDB, so it works here unchanged — and this is where it is
  // most likely to be wanted, since the reason to look at it is usually that there is no
  // signal. Without this line the link to it would land on Today.
  if (path.startsWith("/private/sync")) return "sync";
  return "today";
}

const TITLE: Record<ViewKey, string> = {
  today: "Today",
  athletics: "Training",
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
const readKey = (): ViewKey =>
  viewFor(new URLSearchParams(window.location.search).get("from") ?? "");
const serverKey = (): ViewKey => "today";

export function CachedApp() {
  const [view, setView] = useState<CachedView | null>(null);
  const [failed, setFailed] = useState(false);
  const key = useSyncExternalStore(NO_UPDATES, readKey, serverKey);
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

  if (failed) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        This device will not open its local database, so there is nothing stored to show.
      </p>
    );
  }

  if (!view) return <p className="mt-6 text-sm text-muted-foreground">Reading what is here…</p>;

  return (
    <div className="mt-6 space-y-4">
      <AsOf view={view} />

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
          {key === "academics" && <AcademicsView view={view} />}
          {key === "log" && <LogView view={view} />}
          {key === "sync" && <OutboxConsole />}
        </>
      )}

      <Elsewhere current={key} />
    </div>
  );
}

/**
 * How old this is, said before anything else on the page.
 *
 * Above the panels rather than inside each one: it is one number for the whole snapshot, and
 * repeating it per panel would imply the panels could disagree.
 */
function AsOf({ view }: { view: CachedView }) {
  const { freshness } = view;

  const tone =
    freshness.level === "stale"
      ? "border-destructive/40 bg-destructive/5"
      : freshness.level === "aging"
        ? "border-highlight/40 bg-highlight/10"
        : "border-border bg-card/60";

  return (
    <div className={`rounded-lg border px-4 py-3 ${tone}`}>
      <p className="text-sm text-foreground">
        {freshness.level === "never"
          ? "This device has never synced."
          : `As of ${approximateAge(freshness.ageMs ?? 0)} ago.`}
      </p>
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
function LogView({ view }: { view: CachedView }) {
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const definition = categoryByKey(category) ?? CATEGORIES[0];

  // `requestSync` on every write: with no network the runner does nothing and the entry simply
  // waits, and the moment there is one this is what makes it leave without a foreground event.
  const write = useMemo(() => localLogWriter(requestSync), []);

  return (
    <>
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
          {task.overdue && (
            <span className="shrink-0 font-mono text-[0.6rem] tracking-wide text-destructive uppercase">
              overdue
            </span>
          )}
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
function Missing({ what }: { what: string }) {
  return (
    <p className="px-1 text-sm text-muted-foreground">
      {what} need the network, so they are not here.
    </p>
  );
}

function Elsewhere({ current }: { current: ViewKey }) {
  const others = (["today", "athletics", "academics", "log", "sync"] as const).filter(
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
        <Link
          href="/private"
          className="min-h-10 rounded-md border border-primary/50 px-3 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10"
        >
          Try the live app
        </Link>
      </div>
    </div>
  );
}

function pathFor(key: ViewKey): string {
  return key === "today" ? "/private" : `/private/${key}`;
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
