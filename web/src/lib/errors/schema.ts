import { z } from "zod";

import {
  MAX_AGENT,
  MAX_BUILD_ID,
  MAX_MESSAGE,
  MAX_NAME,
  MAX_ROUTE,
  MAX_STACK,
  SOURCES,
  type ErrorReportInput,
} from "./report";

/**
 * The runtime validator for an incoming crash report (V3 §2.4, D-165 — split out in V4 §8.4,
 * D-327).
 *
 * **Import this from the endpoint and from nothing else.** It is the only module in the error
 * path that pulls `zod`, and the whole point of it being its own file is that
 * `lib/errors/report.ts` — which reaches every public page through `ErrorWatch` in the root
 * layout — no longer does. Importing it from anything that runs in the browser puts 64.1KB
 * gzipped back on the portfolio.
 *
 * The schema is an **allowlist** and that is load-bearing, not stylistic. A crash report is the
 * one payload in this app nobody wrote on purpose: it is assembled by machinery out of whatever
 * was in scope when something broke, and on a private page that is a GPA, per-course grades,
 * bodyweight and a phone number. Unknown fields are dropped rather than stored.
 */
export const errorReportSchema = z.object({
  source: z.enum(SOURCES),
  name: z.string().max(MAX_NAME).default(""),
  message: z.string().max(MAX_MESSAGE).default(""),
  stack: z.string().max(MAX_STACK).default(""),
  route: z.string().max(MAX_ROUTE).default(""),
  buildId: z.string().max(MAX_BUILD_ID).default(""),
  agent: z.string().max(MAX_AGENT).default(""),
});

/**
 * Parsing produces exactly `ErrorReportInput`, and these two lines are the check.
 *
 * `ErrorReportInput` is hand-written in `report.ts` so that module stays `zod`-free, which means
 * nothing structurally forces the two to agree. This does: add a field to one and not the
 * other, or let a type diverge, and `npm run typecheck` fails **here**, naming both modules,
 * rather than at some call site months later.
 *
 * It is a *type-level* pin on purpose. The obvious version —
 * `const _: ErrorReportInput = errorReportSchema.parse({ source: "browser" })` — type-checks
 * identically and runs a real parse on every import of this module, for a question that has no
 * runtime component. `Mutual` is two-way: a one-way `extends` would accept a schema that had
 * quietly grown a field.
 */
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _schemaMatchesType: Mutual<z.infer<typeof errorReportSchema>, ErrorReportInput> = true;
void _schemaMatchesType;
