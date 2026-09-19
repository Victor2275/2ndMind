import Link from "next/link";

import { PageHeader } from "@/components/site/page-shell";
import { SessionEdit } from "@/components/site/session-edit";

/**
 * A session's own page (Q402 follow-up).
 *
 * Same reason `/private/athletics/log` fetches nothing server-side: a session lives in IndexedDB
 * and is written through the outbox only (D-216), never a Server Action, so there is nothing for
 * a server render to contribute here either. `SessionEdit` does the actual reading and writing,
 * client-side, keyed by the `clientId` in the URL — the identity a session carries from the
 * moment it's created, which a numeric Postgres id cannot stand in for until the first sync.
 */
export const metadata = {
  title: "Edit session",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SessionEditPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  return (
    <div className="max-w-2xl pb-16 lg:max-w-4xl">
      <PageHeader
        eyebrow="Training"
        title="Edit session"
        actions={
          <Link
            href="/private/athletics/log"
            className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← back to Log
          </Link>
        }
      />
      <div className="mt-6">
        <SessionEdit clientId={clientId} />
      </div>
    </div>
  );
}
