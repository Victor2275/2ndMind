import Link from "next/link";

import { ExerciseBrowser } from "@/components/site/exercise-browser";
import { PageHeader } from "@/components/site/page-shell";

/**
 * The exercise browser (V4 Phase 2++ Stage 4).
 *
 * `force-dynamic` like every other private route, for the session cookie — but there is nothing
 * for the server to fetch. The catalogue lives in IndexedDB and the client bundle, same reason
 * `/private/athletics/log` fetches nothing: see `ExerciseBrowser`'s doc.
 *
 * Reached from the Athletics page rather than added as a tenth item in `PrivateNav` — C-11 in
 * the V4 plan has been asking for *fewer* top-level entries since 2026-09-06, and this is a
 * sub-page of Athletics the way `/log` already is.
 */
export const metadata = {
  title: "Exercises",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ExercisesPage() {
  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Athletics"
        title="Exercises"
        lede="Every movement in the catalogue — seeded or your own, all of it editable. Tap one for its full history, its estimated 1RM, and how to do it."
      />

      <Link
        href="/private/athletics"
        className="mt-2 inline-block font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        ← records, trends and the protocol
      </Link>

      <div className="mt-6">
        <ExerciseBrowser />
      </div>
    </main>
  );
}
