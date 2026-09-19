"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

import { hasPublicChrome } from "@/lib/chrome";

/**
 * Renders the public header and footer everywhere except the private app (D-149).
 *
 * `header` and `footer` arrive as props rather than being imported here, which keeps
 * `SiteFooter` a Server Component: it reads the vault through `publicProfile()`, and a Client
 * Component cannot. React allows server-rendered elements to be passed through a client
 * boundary as props, so this component decides *whether* to render them without needing to
 * know what they are.
 *
 * A Client Component only because it needs `usePathname`. That runs during server rendering
 * too, so a private page never ships the header and then removes it — there is no flash.
 *
 * Nothing sensitive may appear in this file; it compiles into `/_next/static/chunks/`.
 */
export function PublicChrome({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const show = hasPublicChrome(usePathname());

  return (
    <>
      {/* One skip link per layout (V4 §4.7, Q444). Rendered with the chrome, because the
          private app and `/cached` carry their own — and a second one would mean the first
          `Tab` on a private page offered a choice of two identical links.

          It is the first focusable thing in the document on purpose: a skip link that is not
          first has already been skipped. */}
      {show && (
        <a href="#main" className="skip-link">
          Skip to content
        </a>
      )}
      {show && header}
      <div className="flex flex-1 flex-col">{children}</div>
      {show && footer}
    </>
  );
}
