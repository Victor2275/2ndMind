import Link from "next/link";

import { PageHeader } from "@/components/site/page-shell";
import { SessionLogger } from "@/components/site/session-logger";

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
    <main className="pb-16">
      <PageHeader eyebrow="Athletics" title="Log a session" />

      {/* The overview is one tap away rather than the default. The tab bar's Train action lands
          here because logging is what you are doing when you reach for the phone at a rack —
          reading the record board is what you do afterwards. */}
      <Link
        href="/private/athletics"
        className="mt-2 inline-block font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        records, trends and the protocol →
      </Link>

      <div className="mt-6">
        <SessionLogger />
      </div>
    </main>
  );
}
