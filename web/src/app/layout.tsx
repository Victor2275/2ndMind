import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { PublicChrome } from "@/components/site/public-chrome";
import { ThemeProvider } from "@/components/site/theme-provider";
import { ErrorWatch } from "@/components/site/error-watch";
import { ServiceWorker } from "@/components/site/service-worker";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { GROUND } from "@/lib/brand";
import { publicProfile } from "@/lib/vault/public";

import "./globals.css";

/*
 * Fonts are self-hosted from ./fonts rather than fetched by next/font/google.
 * Reason: builds and `next dev` must work with no network — a meaningful chunk
 * of this project is written in a car and on a plane. The files came from the
 * @fontsource packages; re-copy from there if a weight needs adding.
 */

// Display face — headings only, used with restraint.
const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin-wght-normal.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});

// Body face.
const instrument = localFont({
  src: [
    { path: "./fonts/instrument-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/instrument-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

// Utility face — dates, splits, file paths, anything that lines up in a column.
const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://victorgusev.com";
const DESCRIPTION =
  "Robotics and computer vision engineer. B.S. Computer Science and Engineering, UCLA.";

export const metadata: Metadata = {
  // Without metadataBase, Next emits relative OG URLs and link previews break on the
  // platforms recruiters actually paste into.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Victor Gusev",
    template: "%s · Victor Gusev",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Victor Gusev",
    title: "Victor Gusev",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image", title: "Victor Gusev", description: DESCRIPTION },
  robots: { index: true, follow: true },
};

// Tints the Samsung status bar above the installed app. It was #0a161b until 2026-08-30 —
// a leftover from the teal palette D-002 replaced — which put a blue-green bar above a
// magenta app and only ever showed on a phone. See lib/brand.ts.
export const viewport = {
  themeColor: GROUND,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const profile = publicProfile();

  return (
    <html
      lang="en"
      // `next-themes` writes the theme class here on the client, and does it before paint via
      // the script it injects — so the server's markup and the first client render disagree by
      // design. `suppressHydrationWarning` is the documented way to say that is expected; it
      // suppresses the warning for this element's attributes only, not for its subtree.
      suppressHydrationWarning
      className={`${bricolage.variable} ${instrument.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/* No background here on purpose — globals.css paints the ground on <html>
          so body's ::before/::after atmosphere layers can sit above it. */}
      <body className="flex min-h-full flex-col text-foreground">
        <ThemeProvider>
          {/* The header and footer are passed in rather than rendered here, so that
            `PublicChrome` can drop them on /private without `SiteFooter` having to become a
            Client Component — it reads the vault, which a client component cannot (D-149). */}
          <PublicChrome
            header={<SiteHeader name={profile.name} />}
            footer={<SiteFooter profile={profile} />}
          >
            {children}
          </PublicChrome>
          {/* Registers the worker and offers the reload when a new build is waiting. Mounted at
            the root rather than under /private because Chrome only offers to install from a
            page inside the worker's scope, and a first visit lands on the portfolio. */}
          <ServiceWorker />
          {/* In the root layout, not the private one: a broken portfolio page is exactly the
            failure nobody would otherwise mention, because the person who saw it was a
            stranger (D-165). */}
          <ErrorWatch />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
