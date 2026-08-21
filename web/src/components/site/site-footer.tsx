import type { PublicProfile } from "@/lib/vault/public";

export function SiteFooter({ profile }: { profile: PublicProfile }) {
  const links = [
    { href: profile.contact.github, label: "GitHub" },
    { href: profile.contact.linkedin, label: "LinkedIn" },
    { href: `mailto:${profile.contact.email}`, label: "Email" },
  ];

  return (
    <footer className="mt-24 border-t border-border/70">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs text-muted-foreground">
          {profile.name} &middot; {profile.schoolShort} {profile.degree}
        </p>
        <div className="flex gap-4">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
