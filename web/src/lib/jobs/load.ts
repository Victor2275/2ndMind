import "server-only";

import { unstable_cache } from "next/cache";

import { EMPTY, parseJobSheet, type SheetResult } from "./sheet";

/**
 * Fetching the published sheet.
 *
 * Split from `sheet.ts` so the parser stays importable by tests without pulling in
 * `server-only` or the cache, and so the archived export and the live sheet exercise identical
 * parsing code.
 */

/**
 * Turns whatever Google URL Victor has to hand into one that answers with CSV.
 *
 * This exists because the obvious thing to paste is the link in the browser's address bar,
 * and that link does not work: `/edit#gid=0` serves an HTML application, not data, and behind
 * a login at that. Rejecting it with "use Publish to web instead" is correct and useless —
 * the sheet id and the tab id are both right there in the URL, so the CSV endpoint is
 * derivable. Three shapes are accepted:
 *
 *   .../edit#gid=123           -> .../export?format=csv&gid=123   (needs link-sharing)
 *   .../d/e/<id>/pub?...       -> left alone, already CSV if output=csv (needs publishing)
 *   .../export?format=csv...   -> left alone
 *
 * What it cannot do is grant access. Whichever form the URL takes, the app fetches it with no
 * Google credentials, so the sheet has to be readable by an anonymous request — either
 * published to the web, or shared as "anyone with the link can view". That is a decision
 * about the document, not about this function, and `fetchSheet` reports it clearly when the
 * answer comes back as a login page.
 */
export function normaliseSheetUrl(raw: string): string {
  const url = raw.trim();

  // Already a CSV endpoint of either kind.
  if (/\/export\?/.test(url) || /[?&]output=csv/.test(url) || /tqx=out:csv/.test(url)) {
    return url;
  }

  // A "publish to web" link that did not specify a format. Ask for CSV explicitly rather than
  // taking Google's default, which is HTML.
  const published = url.match(/^(https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/[^/]+\/pub)/);
  if (published) {
    const gid = url.match(/[?&#]gid=(\d+)/);
    return `${published[1]}?output=csv${gid ? `&gid=${gid[1]}` : ""}`;
  }

  // The ordinary editing link. The tab id lives in the fragment, which is why it is read from
  // the whole string rather than from a parsed query.
  const doc = url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (doc) {
    const gid = url.match(/[?&#]gid=(\d+)/);
    return (
      `https://docs.google.com/spreadsheets/d/${doc[1]}/export?format=csv` +
      (gid ? `&gid=${gid[1]}` : "")
    );
  }

  return url;
}

/**
 * The sheet URL. A credential: it grants read access to whoever holds it, so it lives in
 * Vercel's environment and never in the repo.
 */
export function jobSheetUrl(): string | null {
  const url = process.env.JOB_SHEET_CSV_URL?.trim();
  return url && url.startsWith("http") ? normaliseSheetUrl(url) : null;
}

export function isJobSheetConfigured(): boolean {
  return jobSheetUrl() !== null;
}

/**
 * Ten seconds. `fetch` has no default timeout, so without this a Google outage is not a slow
 * page but a hung one — the failure mode that cost a session on 2026-08-21 and put the 8s
 * deadline into `vault/write.ts`. Slightly longer here because a 179-row CSV is a bigger
 * response than a Contents API call, and a timeout that trips on a working link is worse than
 * none.
 */
const REQUEST_TIMEOUT_MS = 10_000;

const CACHE_TAG = "job-sheet";

/**
 * Fifteen minutes.
 *
 * `/private/work` is `force-dynamic`, so without a cache every visit is a round trip to
 * Google for a sheet a background script updates a few times a day. Short enough that a new
 * application shows up while Victor still remembers adding it.
 */
const TTL_SECONDS = 60 * 15;

async function fetchSheet(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    // Next would otherwise cache this fetch on its own schedule underneath `unstable_cache`,
    // which makes the effective TTL two layers deep and impossible to reason about.
    cache: "no-store",
  });

  if (!response.ok) {
    // Status only. The body of a Google error page is HTML, and the URL is a credential that
    // must not reach a log or a screen.
    throw new Error(`the sheet responded ${response.status}`);
  }

  const text = await response.text();

  // An unpublished or permission-changed sheet answers 200 with a login page rather than 404,
  // so the status is not enough to tell whether this is a CSV.
  if (/^\s*</.test(text)) {
    throw new Error(
      "the sheet answered with a web page rather than CSV, which is what Google returns when " +
        "an anonymous request cannot read it. Either File → Share → Publish to web → CSV, or " +
        "set general access to “Anyone with the link → Viewer”.",
    );
  }

  return text;
}

const cachedSheet = unstable_cache(
  async (url: string) => {
    const csv = await fetchSheet(url);
    const { applications, skipped } = parseJobSheet(csv);
    // Throw rather than return, so a failure is not what gets cached — the same lesson as
    // D-086: `unstable_cache` stores returned values, and a cached error would pin a
    // transient outage to the page for the full TTL.
    if (applications.length === 0) {
      throw new Error("the sheet parsed to no rows at all — has its columns changed?");
    }
    return { applications, skipped };
  },
  ["job-sheet"],
  { tags: [CACHE_TAG], revalidate: TTL_SECONDS },
);

export async function loadJobSheet(): Promise<SheetResult> {
  const url = jobSheetUrl();
  if (!url) {
    return {
      ...EMPTY,
      error:
        "JOB_SHEET_CSV_URL is not set. Paste any Google Sheets link for the applications tab " +
        "into Vercel — the ordinary /edit link is fine, it is converted to a CSV export. The " +
        "sheet must be readable without signing in: either Publish to web, or general access " +
        "set to “Anyone with the link → Viewer”. Everything else works without it.",
    };
  }

  try {
    const { applications, skipped } = await cachedSheet(url);
    return { applications, error: null, configured: true, skipped };
  } catch (error) {
    // Degrades to a message, never an error page: this is one panel on a page that has other
    // things on it, and Google being slow should not take out the rest.
    const detail =
      error instanceof Error
        ? error.name === "TimeoutError"
          ? `Google did not respond within ${REQUEST_TIMEOUT_MS / 1000}s.`
          : error.message
        : "unknown error";
    return {
      ...EMPTY,
      configured: true,
      error: `The applications sheet could not be read: ${detail}`,
    };
  }
}
