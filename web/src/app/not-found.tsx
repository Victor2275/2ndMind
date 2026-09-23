import Link from "next/link";
import { CompassIcon } from "lucide-react";

import { Mark } from "@/components/site/mark";

/**
 * 404 — designed, minimally (V4 §5.1, Q291).
 *
 * Q291 asked for this to be designed and asked for it to be *minimal*, which are not in tension:
 * the failure mode of a 404 is a page that apologises at length and then gives you nothing to
 * click. So it is the mark, one sentence, and the four places worth going.
 *
 * It sits at the root of `app/`, so it covers the private app too — but the links below are
 * deliberately all public. A 404 is reachable by anyone, and a list of private routes on a page
 * served to strangers is a site map of a second brain. The private app's own way back is the
 * nav, which is still mounted around this on any `/private` URL.
 *
 * **There is no search box**, because there is no search (Q373 defers it to V5). An input that
 * routes nowhere is worse than an honest list of four links.
 */
export default function NotFound() {
  return (
    // `<main id="main">`, and it is not a nested landmark (§4.7). A root `error.tsx` /
    // `not-found.tsx` replaces everything below the root layout — including
    // `app/private/layout.tsx` and the one `<main>` `ContentWidth` renders — so on every route
    // this element is the only landmark on the page, and the skip link's target.
    <main
      id="main"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-24 text-center"
    >
      {/* A unique `id`: the header renders a mark too, and two `<mask id>`s that agree resolve
          to the first one — invisible until the two are different sizes, which they are. */}
      <Mark id="notfound-mark" className="size-10 text-primary" />

      {/* Mono, because the status code is data — DESIGN.md §2 rule 2. The word beside it is
          not, so it takes the body face; a 404 page that renders "Not found" in mono is the
          decorative-mono habit §1.6 spent a phase removing. */}
      <p className="mt-6 flex items-baseline gap-2">
        <span className="tabular font-mono text-sm text-faint-foreground">404</span>
        <span className="eyebrow text-primary">Not found</span>
      </p>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        There is nothing at this address.
      </h1>
      <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
        Either the page moved, or the link was wrong when it was written. Nothing is broken — the
        rest of the site is where it was.
      </p>

      <nav
        aria-label="Somewhere to go instead"
        className="mt-8 flex flex-wrap justify-center gap-2"
      >
        {DESTINATIONS.map((to) => (
          <Link
            key={to.href}
            href={to.href}
            // `min-h-11` is DESIGN.md §9's 44px floor, which §7.1 turns into a gate. A row of
            // links on a phone is exactly where a 32px target gets missed.
            className="inline-flex min-h-11 press items-center gap-1.5 rounded-control border border-border px-3 text-sm text-foreground transition-colors duration-fast ease-standard hover:border-primary/50 hover:text-primary"
          >
            {to.label}
          </Link>
        ))}
      </nav>

      <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-faint-foreground">
        <CompassIcon aria-hidden className="icon-sm" />
        Every page on this site is listed in the sitemap.
      </p>
    </main>
  );
}

/** Public only, and on purpose — see the note above. */
const DESTINATIONS = [
  { href: "/", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/resume", label: "Resume" },
];
