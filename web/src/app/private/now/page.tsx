import Link from "next/link";

import { ProjectUpdates } from "@/components/site/project-updates";
import { UpdateComposer } from "@/components/site/update-composer";
import { requireSession } from "@/lib/auth/dal";
import { publicProjects } from "@/lib/vault/public";
import { todayInLosAngeles } from "@/lib/vault/updates";

/**
 * Authoring side of the public `/now` page.
 *
 * `requireSession()` here rather than relying on `proxy.ts`, which is an optimistic cookie
 * check that runs on prefetches and may be served from a CDN. The check belongs next to the
 * data, and the write action repeats it — a Server Action is a POST endpoint that can be
 * invoked without ever loading this page.
 */

export const dynamic = "force-dynamic";

export const metadata = { title: "Now" };

export default async function PrivateNowPage() {
  await requireSession();

  const active = publicProjects().filter((p) => p.status === "active" && !p.draft);
  const needPhotos = active.filter((p) => !p.image);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Now</h1>
        <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">
          Writing here commits to the vault and rebuilds the public{" "}
          <Link href="/now" className="link-wipe text-foreground hover:text-primary">
            /now
          </Link>{" "}
          page. A project appears in this list when its frontmatter says{" "}
          <code className="font-mono text-xs">status: active</code>.
        </p>
      </header>

      <section>
        <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
          New update
        </h2>
        <div className="mt-3">
          <UpdateComposer
            today={todayInLosAngeles()}
            projects={active.map((p) => ({
              slug: p.slug,
              title: p.title,
              updateCount: p.updates.length,
            }))}
          />
        </div>
      </section>

      {/* Prompts, not uploads. `writeVaultFile` is text-only, and committing binaries through
          the Contents API is its own piece of work (V3). This says which files to add and
          where; §7.3's pipeline already serves them once they are in `context/assets/`. */}
      {needPhotos.length > 0 && (
        <section>
          <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
            Photos wanted
          </h2>
          <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">
            These are active and have no image, so they render a generated placeholder. Drop a
            file into <code className="font-mono text-xs">context/assets/</code>, then set{" "}
            <code className="font-mono text-xs">image: /assets/&lt;file&gt;</code> in the
            project&apos;s frontmatter.
          </p>
          <ul className="mt-3 space-y-1.5">
            {needPhotos.map((p) => (
              <li key={p.slug} className="text-sm text-muted-foreground">
                <span className="text-foreground">{p.title}</span>
                <span className="ml-2 font-mono text-xs">
                  context/01_engineering/projects/{p.slug}.md
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
          Published
        </h2>
        {active.every((p) => p.updates.length === 0) ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing written yet.</p>
        ) : (
          <div className="mt-4 space-y-8">
            {active
              .filter((p) => p.updates.length > 0)
              .map((p) => (
                <div key={p.slug}>
                  <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
                  <div className="mt-3 border-l border-border pl-4">
                    {/* Three, not all: this is a check that the last few landed, not an
                        archive. The archive is the project page. */}
                    <ProjectUpdates updates={p.updates} limit={3} />
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
