import type { MetadataRoute } from "next";

import { RESUME_VARIANTS } from "@/lib/resume";
import { publicProjects } from "@/lib/vault/public";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.victorgusev.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/projects",
    ...publicProjects().map((p) => `/projects/${p.slug}`),
    ...RESUME_VARIANTS.map((v) => `/resume/${v}`),
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: route === "/" ? 1 : 0.7,
  }));
}
