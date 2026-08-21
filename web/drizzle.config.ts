import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  // Migrations are generated and committed, never pushed straight to the database. The
  // committed SQL is what the PGlite tests run, so the tests exercise the same DDL that
  // production will get.
  strict: true,
  verbose: true,
});
