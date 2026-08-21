import type { MetadataRoute } from "next";

import { publicLabs, publicProjects } from "@/lib/vault/public";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://victorgusev.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/projects",
    "/labs",
    ...publicProjects().map((p) => `/projects/${p.slug}`),
    ...publicLabs().map((l) => `/labs/${l.slug}`),
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: route === "/" ? 1 : 0.7,
  }));
}
