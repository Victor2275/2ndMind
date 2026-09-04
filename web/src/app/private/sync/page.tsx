import { OutboxConsole } from "@/components/site/outbox-console";
import { PageHeader } from "@/components/site/page-shell";

/**
 * Entries that have not reached the server yet (V3 §1.7).
 *
 * A server component that fetches nothing. Everything on this screen lives in IndexedDB, which
 * is the point: the page that explains why something has not been sent must not itself require
 * a connection to render.
 */
export const dynamic = "force-dynamic";

export default function SyncPage() {
  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Sync"
        title="Not sent yet"
        lede="Everything written on this phone is kept here until the server has it. Nothing is ever thrown away — an entry that cannot be sent waits until you retry it."
      />
      <OutboxConsole />
    </main>
  );
}
