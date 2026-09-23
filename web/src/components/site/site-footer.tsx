import { ExternalLink } from "@/components/site/external-link";
import type { PublicProfile } from "@/lib/vault/public";

/**
 * The public footer (V4 item 6.9, Q297–Q299, Q304, Q311).
 *
 * A name line and five links, which is close to where it started. Q297's theme toggle, Q298's
 * build date and Q320's line naming 2ndMind were all removed on 2026-09-23 (D-343, D-345): the
 * footer of a portfolio is not a status page, and none of the three told a reader anything
 * about the work. Q299's repository link survives as plain "Source".
 *
 * The **phone number** lives here rather than in the About hero. Q311 keeps it public and Q310
 * asked the hero's contact row to be reduced; those two only reconcile if the number lands
 * somewhere, and the footer is where a contact detail belongs. Dropping it from the hero
 * without adding it here would have taken it off the public site entirely, which Q311 forbids.
 */

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
      </div>
    </footer>
  );
}
