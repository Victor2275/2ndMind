/**
 * Turning a Postgres failure into a sentence that says what to do (D-156).
 *
 * Written after a real outage. Migration `0005_sync_columns` was generated in V3 §1.2 and
 * never applied to Neon, so Drizzle built every query with `client_id`, `updated_hlc` and
 * `server_seq` while the database had none of them. Every page touching tasks, the log,
 * workouts, bodyweight or rehab failed at once, and what it showed was the failed SQL and its
 * fifteen column names — a message that names everything except the one thing wrong.
 *
 * Four copies of this function existed by then, in four `actions.ts` files, and every one of
 * them handled a missing *table* and none handled a missing *column*. That is not a
 * coincidence: a missing table is what you hit on a fresh clone and remember to handle; a
 * missing column is what you hit when the database is *behind the code*, which only happens
 * once you have been shipping for a while. One copy, here, so the next case that gets learned
 * gets learned everywhere.
 *
 * Nothing here inspects data — only the shape of the error — so it is safe on any surface.
 */

/** Postgres SQLSTATEs worth translating. */
const UNDEFINED_TABLE = "42P01";
const UNDEFINED_COLUMN = "42703";
const UNDEFINED_FUNCTION = "42883";

/**
 * Every error in the chain, outermost first.
 *
 * Drizzle wraps what the driver threw: its own `message` is the SQL — *"Failed query: select
 * …"* — and the Postgres error, with the SQLSTATE and the sentence that says what is actually
 * wrong, is on `cause`. Reading only the top-level message is why the four hand-written copies
 * of this function never once fired: their "relation does not exist" branch was dead code from
 * the day it was written, and nobody noticed because the fallback still printed *something*.
 */
function chain(error: unknown): unknown[] {
  const seen: unknown[] = [];
  let current = error;
  // Bounded, because a cause cycle would otherwise hang a page that is already failing.
  for (let depth = 0; depth < 8 && current !== null && current !== undefined; depth += 1) {
    seen.push(current);
    if (typeof current !== "object") break;
    const next = (current as { cause?: unknown }).cause;
    if (next === undefined || seen.includes(next)) break;
    current = next;
  }
  return seen;
}

function codeOf(error: unknown): string | null {
  for (const link of chain(error)) {
    if (typeof link !== "object" || link === null) continue;
    const code = (link as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return null;
}

/** The outermost message, which is what a human should be shown. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Every message in the chain, for matching against. */
function allMessages(error: unknown): string {
  return chain(error)
    .map((link) => (link instanceof Error ? link.message : String(link)))
    .join(" | ");
}

export type DescribeOptions = {
  /** What the caller was reading, for the missing-table case: "The tasks table", say. */
  subject?: string;
};

/** The innermost message — the one that names the missing column rather than the whole query. */
function detail(error: unknown): string {
  const links = chain(error);
  const last = links[links.length - 1];
  return last instanceof Error ? last.message : String(last);
}

export function describeDbError(error: unknown, options: DescribeOptions = {}): string {
  const message = messageOf(error);
  const searchable = allMessages(error);
  const code = codeOf(error);

  // Configuration, not schema. Its own message already says what to set.
  if (searchable.includes("DATABASE_URL")) return message;

  const subject = options.subject ?? "That table";

  if (
    code === UNDEFINED_TABLE ||
    (searchable.includes("relation") && searchable.includes("does not exist"))
  ) {
    return `${subject} is missing. Run \`npm run db:migrate\`.`;
  }

  // The one that cost an outage. A column the code expects and the database has not got means
  // the deployed schema is behind this build — which is a different fix from a missing table,
  // and indistinguishable from it in the raw error unless you read the SQL.
  if (
    code === UNDEFINED_COLUMN ||
    (searchable.includes("column") && searchable.includes("does not exist"))
  ) {
    return (
      "The database is behind this build — it is missing a column this code expects. " +
      "Run `npm run db:migrate`, then reload. " +
      `(${detail(error)})`
    );
  }

  // A trigger function that a migration should have created. Same cause, same fix, and worth
  // naming separately because the message otherwise reads as a code bug.
  if (code === UNDEFINED_FUNCTION) {
    return (
      "The database is missing a function this build expects. Run `npm run db:migrate`. " +
      `(${detail(error)})`
    );
  }

  return message;
}
