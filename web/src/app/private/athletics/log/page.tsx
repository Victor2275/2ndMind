import { PageHeader } from "@/components/site/page-shell";
import { RecentSessions } from "@/components/site/recent-sessions";
import { SessionLogger } from "@/components/site/session-logger";
import { TrainingTabs } from "@/components/site/training-tabs";

/**
 * Logging a session (V4 Phase 2.5).
 *
 * ## Why this page fetches nothing
 *
 * Every other private route reads Postgres on the server and hands the result down. This one
 * reads **IndexedDB in the browser**, because a session is written to the outbox rather than
 * through a Server Action (`lib/athletics/session.ts`) — so there is nothing for a server render
 * to contribute, and asking for one would make the screen depend on a network it is specifically
 * meant to work without.
 *
 * That is also what lets the cached shell mount the same component and get the same screen. The
 * old quick-log path needed two implementations kept in step; this one has none to drift.
 *
 * It is still `force-dynamic` and still inside the private layout, so it is behind the session
 * cookie like everything else here. The route being reachable is not the same as its data being
 * public — there is no data on it.
 */
export const metadata = {
  title: "Log training",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function LogSessionPage() {
  return (
    // Capped rather than filling the layout's 64rem. This is a form, and a 976-pixel-wide row of
    // two inputs on a laptop reads as a mistake — Victor's report was that sessions were missing
    // on a computer, and arriving to a stretched version of the phone screen is only half a fix.
    //
    // The cap lifts at `lg` (V4 Phase 2++ Stage 5), which is the same breakpoint the set list
    // becomes a table at: a table of six columns wants more than 42rem, and squeezing it into
    // the phone's width would have made the table worse than the cards it replaced.
    <div className="max-w-2xl pb-16 lg:max-w-4xl">
      <PageHeader eyebrow="Training" title="Log a session" />
      <TrainingTabs />

      <div className="mt-6">
        <SessionLogger />
      </div>

      {/* Q402. Correcting a set is a per-set op, so fixing a typo in set three does not resend
          the session — see `SYNC_DESIGN.md` §4a and `recent-sessions.tsx`. */}
      <section className="mt-10">
        {/* "This device", not "this phone". The screen reads from local storage wherever it is
            opened, and on a laptop the old wording described somewhere else. */}
        <h2 className="text-lg font-bold tracking-tight">On this device</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          The last few sessions, as this browser has them. Numbers are editable in place; a delete
          is a tombstone, so it syncs rather than merely disappearing here.
        </p>
        <RecentSessions />
      </section>
    </div>
  );
}
