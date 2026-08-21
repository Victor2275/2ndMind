import Link from "next/link";

const NAV = [
  { href: "/", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/labs", label: "Labs" },
];

export function SiteHeader({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="font-mono text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          {name}
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
