import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://victorgusev.vercel.app";

/**
 * The public surface is meant to be found. When the private second brain lands it will live
 * under an auth-gated prefix, and that prefix must be disallowed here as well — auth stops
 * access, but robots.txt stops the URLs showing up in results at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
