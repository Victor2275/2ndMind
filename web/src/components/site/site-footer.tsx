import { PrivateLink } from "@/components/site/private-link";
import type { PublicProfile } from "@/lib/vault/public";

/**
 * The `/private` shortcut lives here rather than in the header nav.
 *
 * The header is already four items and truncates the name at 390px; a fifth would push it over
 * for the one person who can see it. A personal shortcut is also not site navigation — it
 * belongs with the other "about this site" links, not beside Projects and Resume.
 */

export function SiteFooter({ profile }: { profile: PublicProfile }) {
  const links = [
    { href: profile.contact.github, label: "GitHub" },
    { href: profile.contact.linkedin, label: "LinkedIn" },
    { href: `mailto:${profile.contact.email}`, label: "Email" },
  ];

  return (
    <footer className="mt-24 border-t border-border/60 print:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs text-muted-foreground">
          {profile.name} &middot; {profile.schoolShort} {profile.degree}
        </p>
        <div className="flex gap-4">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="link-wipe text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              {l.label}
            </a>
          ))}
          {/* Renders nothing unless this browser has signed in before. It grants nothing —
              see `lib/auth/returning.ts`. */}
          <PrivateLink className="link-wipe text-xs text-primary transition-colors hover:text-foreground" />
        </div>
      </div>
    </footer>
  );
}
