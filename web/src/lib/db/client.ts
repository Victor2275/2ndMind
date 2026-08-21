import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Database handle.
 *
 * Athletics is the only feature that needs Postgres, so the rest of the site must keep
 * working without it. `isDatabaseConfigured()` is deliberately separate from `db()` for the
 * same reason `isAuthConfigured()` is separate from `getSession()`: the page that explains a
 * missing DATABASE_URL must not be the page that crashes on it.
 */

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return typeof url === "string" && url.startsWith("postgres");
}

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Athletics needs a Postgres connection string; see web/.env.example.",
    );
  }
  // Cached across invocations of a warm serverless function. The neon-http driver is
  // stateless HTTP, so there is no pool to exhaust and nothing to tear down.
  cached ??= drizzle(neon(url), { schema });
  return cached;
}

export { schema };
