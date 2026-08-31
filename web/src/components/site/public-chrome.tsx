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
      {show && header}
      <div className="flex flex-1 flex-col">{children}</div>
      {show && footer}
    </>
  );
}
