import { ExternalLink } from "@/components/site/external-link";
import { ThemeToggle } from "@/components/site/theme-toggle";
import type { PublicProfile } from "@/lib/vault/public";

/**
 * The public footer (V4 item 6.9, Q297–Q299, Q304, Q320).
 *
 * It used to be a name line and three links. Q297 asked for the theme toggle and a "last
 * updated"; Q298 for the build date; Q299 for a link to the site's own repository; Q320 for one
 * line naming 2ndMind, on the grounds that the reader is looking at it.
 *
 * ## Two things that had nowhere else to go
 *
 * The **phone number** moved here from the About hero. Q311 keeps it public and Q310 asked the
 * hero's contact row to be reduced; those two only reconcile if the number lands somewhere, and
 * the footer is where a contact detail belongs. Dropping it from the hero without adding it here
 * would have taken it off the public site entirely, which Q311 forbids.
 *
 * The **build date** is evaluated when this module is first rendered. Every public route is
 * statically generated, so for them that is build time, which is what Q298 asked for. It is
 * deliberately a date and not a timestamp: the useful question is "is this current this week",
 * and a time to the second on a portfolio reads as a status page.
 */

/**
 * The deployed commit, same derivation as the settings screen.
 *
 * Vercel sets `VERCEL_GIT_COMMIT_SHA`; a local `next dev` sets nothing, and "local" is more
 * honest than the alternatives — a build with no commit is not version zero, it is a build whose
 * version is not a commit.
 */
function deployedCommit(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : "local";
}

const BUILT = new Date();

/**
 * The repository this site is built from (Q299).
 *
 * It used to be reached through a sentence explaining that the site is a knowledge vault that
 * publishes itself. That sentence went on 2026-09-23 (D-343) along with the rest of the copy
 * describing the site's own plumbing to people who came to read about the work. The link stays,
 * as a link, because "Source" on an engineer's portfolio is a destination rather than an
 * explanation.
 */
const REPO = "https://github.com/Victor2275/2ndMind";

export function SiteFooter({ profile }: { profile: PublicProfile }) {
  const links = [
    { href: profile.contact.github, label: "GitHub", external: true },
    { href: profile.contact.linkedin, label: "LinkedIn", external: true },
    { href: `mailto:${profile.contact.email}`, label: "Email", external: false },
    {
      href: `tel:${profile.contact.phone.replace(/[^\d+]/g, "")}`,
      label: profile.contact.phone,
      external: false,
    },
    { href: REPO, label: "Source", external: true },
  ];

  return (
    <footer className="mt-24 border-t border-border/60 print:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {profile.name} &middot; {profile.schoolShort} {profile.degree}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {links.map((l) =>
              l.external ? (
                <ExternalLink
                  key={l.label}
                  href={l.href}
                  className="link-wipe text-xs text-muted-foreground transition-colors duration-fast hover:text-primary"
                >
                  {l.label}
                </ExternalLink>
              ) : (
                <a
                  key={l.label}
                  href={l.href}
                  className="link-wipe text-xs text-muted-foreground transition-colors duration-fast hover:text-primary"
                >
                  {l.label}
                </a>
              ),
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/40 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-4">
            <span className="tabular font-mono">
              <span className="sr-only">Last built </span>
              {BUILT.toISOString().slice(0, 10)}
              <span aria-hidden> · </span>
              {deployedCommit()}
            </span>
            <ThemeToggle className="-mr-2" />
          </div>
        </div>
      </div>
    </footer>
  );
}
