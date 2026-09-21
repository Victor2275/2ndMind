import Papa from "papaparse";

/**
 * The internship applications tracker, read from the published Google Sheet.
 *
 * The sheet is maintained by a background script that scans Gmail — it is the source of truth
 * and this app never writes to it. `/private/work` deliberately did not duplicate it, on the
 * grounds that a second tracker is a competing source of truth. Reading it is not duplicating
 * it: there is still one place the data lives, and this is a view.
 *
 * **The URL is a credential.** Google's "publish to web" link grants read access to anyone
 * holding it, so it lives in `JOB_SHEET_CSV_URL` in Vercel and never in the repository — the
 * same treatment `GOOGLE_CALENDAR_KEY` gets, for the same reason.
 *
 * Parsing is separate from fetching so the whole shape can be tested against a real export
 * without a network, and so the archived snapshot in `context/99_archive/` and the live sheet
 * go through identical code. The snapshot is a fixture, never a fallback: silently serving
 * months-old data as though it were current is worse than saying the sheet is unreachable.
 */

export type Application = {
  company: string;
  role: string;
  /** Free text as the sheet writes it: "Pending", "Rejected", "No Application", … */
  status: string;
  /** "High Priority" | "Medium Priority" | "Low Priority", or whatever the sheet says. */
  priority: string;
  location: string;
  focus: string;
  compensation: string;
  duration: string;
  urgency: string;
  link: string;
  notes: string;
  /** ISO `YYYY-MM-DD`, or "" when the sheet's value was not a date. */
  published: string;
  added: string;
};

export type SheetResult = {
  applications: Application[];
  /** Null when the sheet loaded, whether or not it had any rows. */
  error: string | null;
  configured: boolean;
  /** Rows the parser saw but discarded, so a silent drop is visible rather than invisible. */
  skipped: number;
};

export const EMPTY: SheetResult = {
  applications: [],
  error: null,
  configured: false,
  skipped: 0,
};

/**
 * Column lookup by any of several names.
 *
 * The sheet is a human document maintained by hand and by a script. Its headers have already
 * changed once ("Domain / Focus" carries a space either side of the slash) and matching them
 * exactly would turn a cosmetic edit into an outage. Compared lowercased with punctuation and
 * whitespace stripped, so `Deadline / Urgency`, `deadline/urgency` and `Deadline  /  Urgency`
 * are one column.
 */
function normalise(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const COLUMNS: Record<keyof Application, string[]> = {
  company: ["company"],
  role: ["role", "position", "title"],
  status: ["status"],
  priority: ["priority"],
  location: ["location"],
  focus: ["domainfocus", "domain", "focus"],
  compensation: ["compensation", "pay", "rate"],
  duration: ["duration"],
  urgency: ["deadlineurgency", "deadline", "urgency"],
  link: ["applicationlink", "link", "url"],
  notes: ["notesactionitems", "notes"],
  published: ["datepublished", "published"],
  added: ["dateadded", "added"],
};

function pick(row: Record<string, string>, names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
}

/** Passes ISO dates through and blanks anything else, rather than guessing at a format. */
function isoDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function parseJobSheet(csv: string): { applications: Application[]; skipped: number } {
  // Google writes a UTF-8 BOM. Left in place it becomes part of the first header name, so
  // "Date Published" arrives as "﻿Date Published" and every lookup on it misses.
  const cleaned = csv.replace(/^﻿/, "");

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalise,
  });

  let skipped = 0;
  const applications: Application[] = [];

  for (const row of result.data) {
    const company = pick(row, COLUMNS.company);
    const role = pick(row, COLUMNS.role);

    // A row with neither is a spacer, a note, or a trailing artefact of the export. Counted
    // rather than dropped silently, so "179 rows, 40 skipped" is a visible signal that
    // something about the sheet changed.
    if (company === "" && role === "") {
      skipped += 1;
      continue;
    }

    applications.push({
      company,
      role,
      status: pick(row, COLUMNS.status),
      priority: pick(row, COLUMNS.priority),
      location: pick(row, COLUMNS.location),
      focus: pick(row, COLUMNS.focus),
      compensation: pick(row, COLUMNS.compensation),
      duration: pick(row, COLUMNS.duration),
      urgency: pick(row, COLUMNS.urgency),
      link: pick(row, COLUMNS.link),
      notes: pick(row, COLUMNS.notes),
      published: isoDate(pick(row, COLUMNS.published)),
      added: isoDate(pick(row, COLUMNS.added)),
    });
  }

  return { applications, skipped };
}

/** True when the sheet has been applied to — anything but the tracker's "not yet" state. */
export function isSubmitted(application: Application): boolean {
  const status = application.status.toLowerCase();
  return status !== "" && status !== "no application" && status !== "not applied";
}

/** Still live: applied and not yet closed out. */
export function isOpen(application: Application): boolean {
  const status = application.status.toLowerCase();
  return isSubmitted(application) && !status.includes("reject") && !status.includes("declin");
}

export function isHighPriority(application: Application): boolean {
  return application.priority.toLowerCase().startsWith("high");
}

/* ------------------------------------------------------------------------------------------
   Stages — V4 §5.8 (Q419)
   ------------------------------------------------------------------------------------------ */

/**
 * The pipeline as a board (Q419: *kanban*).
 *
 * The sheet's `status` is free text written by a Gmail script and by hand — "Pending",
 * "OA sent", "Rejected", "No Application", "" — so a board has to *derive* its columns rather
 * than read them. These five are the stages Victor's sheet actually contains, matched by
 * substring and in order of specificity: an offer that was later rejected is closed, and a
 * status naming an interview outranks the generic "applied".
 *
 * **Nothing here writes.** The sheet has exactly one writer, which is the point of D-x's
 * original refusal to duplicate it, so this is a board you read and not a board you drag. See
 * D-300.
 */
export type Stage = "shortlist" | "applied" | "interviewing" | "offer" | "closed";

export type StageColumn = {
  stage: Stage;
  label: string;
  applications: Application[];
};

export function stageOf(application: Application): Stage {
  const status = application.status.toLowerCase();

  if (!isSubmitted(application)) return "shortlist";
  // Closed first: "offer declined" and "rejected after interview" both name an earlier stage
  // and are neither of them still live.
  if (status.includes("reject") || status.includes("declin") || status.includes("closed"))
    return "closed";
  if (status.includes("offer")) return "offer";
  if (
    status.includes("interview") ||
    status.includes("screen") ||
    status.includes("oa") ||
    status.includes("assessment")
  )
    return "interviewing";
  return "applied";
}

const STAGE_LABEL: Record<Stage, string> = {
  shortlist: "Not applied",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  closed: "Closed",
};

export const STAGES: readonly Stage[] = [
  "shortlist",
  "applied",
  "interviewing",
  "offer",
  "closed",
] as const;

/**
 * The board's columns, newest first inside each.
 *
 * The `shortlist` column is **high priority only**. 173 of 178 rows are postings Victor has not
 * applied to, and a column holding all of them is the wall `toPipeline` was written to avoid —
 * the count above it still reports the true total, so nothing is hidden, only unlisted.
 */
export function stageColumns(applications: Application[]): StageColumn[] {
  const recent = (a: Application, b: Application) =>
    (b.added || "0000-00-00").localeCompare(a.added || "0000-00-00");

  return STAGES.map((stage) => {
    const inStage = applications.filter((application) => stageOf(application) === stage);
    return {
      stage,
      label: STAGE_LABEL[stage],
      applications: (stage === "shortlist" ? inStage.filter(isHighPriority) : inStage).sort(recent),
    };
  });
}

/** How many rows are in a stage, including the ones a column does not list. */
export function stageTotal(applications: Application[], stage: Stage): number {
  return applications.filter((application) => stageOf(application) === stage).length;
}

export type Pipeline = {
  total: number;
  submitted: Application[];
  open: Application[];
  /** High priority, not yet applied to. The only part of 170-odd rows that is actionable. */
  shortlist: Application[];
  byStatus: { status: string; count: number }[];
};

/**
 * Reduces the sheet to what a phone screen can use.
 *
 * The export is 178 rows and 173 of them say "No Application" — rendered whole it is a wall,
 * and the five rows that matter are invisible inside it. So the page shows what has been
 * applied to, what is still live, and the high-priority rows that have not been touched.
 */
export function toPipeline(applications: Application[]): Pipeline {
  const counts = new Map<string, number>();
  for (const a of applications) {
    const key = a.status || "(blank)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Newest first by when it was added, and rows with no date sort last rather than first —
  // a blank string would otherwise win a descending comparison and float to the top.
  const recent = (a: Application, b: Application) =>
    (b.added || "0000-00-00").localeCompare(a.added || "0000-00-00");

  return {
    total: applications.length,
    submitted: applications.filter(isSubmitted).sort(recent),
    open: applications.filter(isOpen).sort(recent),
    shortlist: applications.filter((a) => !isSubmitted(a) && isHighPriority(a)).sort(recent),
    byStatus: [...counts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
  };
}
