import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /**
   * The vault lives at <repo>/context, one level above this app. Public pages read it at
   * build time and are static, so they need nothing — but /private is force-dynamic and
   * reads it per request, and by default the file tracer stops at the `web/` boundary and
   * ships none of it. Measured, not assumed: with no config, zero markdown files are traced
   * into /private, so the freshness widget would throw ENOENT in production while working
   * perfectly on a local machine.
   *
   * Widening the root is the whole fix. Next's static analysis of the `readdirSync` in
   * `lib/vault/load.ts` then pulls the tree in on its own — an `outputFileTracingIncludes`
   * entry alongside this turned out to be redundant, and worse, an explicit include *beats*
   * an exclude, so adding one made the archive impossible to leave behind.
   */
  outputFileTracingRoot: path.join(here, ".."),

  /**
   * `99_archive/` is superseded resumes, transcripts, and full lab reports. Nothing reads it
   * at runtime — the freshness walk skips it by name, as CLAUDE.md requires — so tracing it
   * would ship ten files of exactly the documents least worth carrying into a function.
   * Drops the traced set from 44 files to 34.
   */
  outputFileTracingExcludes: {
    "*": ["../context/99_archive/**"],
  },
};

export default nextConfig;
