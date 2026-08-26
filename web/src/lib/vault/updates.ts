/**
 * Dated updates inside a project's own markdown file.
 *
 * The Working page needs "what happened on this recently", and the choice was between a
 * Postgres table and the project file. The file wins: `/now` and `/projects` then read the
 * same source, so a project cannot be finished on one page and in progress on the other, and
 * the public site stays statically generated. The cost is that publishing an update is a
 * commit plus a rebuild — about a minute. For something written weekly that is the right
 * trade; for ticking off a task it was not, which is what D-036 decided the other way.
 *
 * The convention:
 *
 *     ## Updates
 *
 *     ### 2026-08-25
 *
 *     Prose about what happened.
 *
 * `###` under a single `## Updates` heading rather than a flat list, because an update is a
 * paragraph or three, not a bullet — and because `stripInternalSections` splits on `##`, so
 * the whole section stays together no matter how many entries it holds.
 */

export type ProjectUpdate = {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** Markdown, as authored. */
  body: string;
};

const UPDATES_HEADING = /^##[ \t]+Updates[ \t]*$/i;
const ENTRY_HEADING = /^###[ \t]+(\d{4}-\d{2}-\d{2})[ \t]*$/;

/**
 * Where a project's markdown lives, as a repo-relative path for the Contents API.
 *
 * The slug is checked here as well as by `assertVaultPath`, because the two catch different
 * things: this rejects a slug that is not a slug, that one rejects a path that escapes the
 * vault. The slug arrives from a form field, so it is not to be trusted into a path at all.
 */
export function projectVaultPath(slug: string): string {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`not a project slug: "${slug}"`);
  }
  return `context/01_engineering/projects/${slug}.md`;
}

/** Today in Victor's timezone. `en-CA` is the locale that formats as `YYYY-MM-DD`. */
export function todayInLosAngeles(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Splits a project body into the rest of the document and its updates, newest first.
 *
 * The section is removed from the returned body rather than left in place. Both callers want
 * updates as data — `/now` shows only the latest, the project page renders them as dated
 * entries — and leaving the raw markdown in the body too would publish every update twice.
 */
export function splitUpdates(body: string): { body: string; updates: ProjectUpdate[] } {
  const lines = body.split(/\r?\n/);
  const eol = body.includes("\r\n") ? "\r\n" : "\n";

  const kept: string[] = [];
  const updates: ProjectUpdate[] = [];

  let inSection = false;
  let current: ProjectUpdate | null = null;
  const flush = () => {
    if (current && current.body.trim() !== "") updates.push(current);
    current = null;
  };

  for (const line of lines) {
    if (UPDATES_HEADING.test(line)) {
      inSection = true;
      continue;
    }

    // Any other `##` ends the section — updates are not allowed to swallow the rest of the
    // file just because someone forgot a blank line.
    if (inSection && /^##[ \t]+/.test(line) && !/^###/.test(line)) {
      flush();
      inSection = false;
    }

    if (!inSection) {
      kept.push(line);
      continue;
    }

    const entry = ENTRY_HEADING.exec(line);
    if (entry) {
      flush();
      current = { date: entry[1], body: "" };
      continue;
    }

    // Text before the first `###`, or under a `###` that is not a date, is dropped rather
    // than attributed to a date it does not have. Inventing one would misdate the entry.
    if (current) current.body += (current.body === "" ? "" : eol) + line;
  }
  flush();

  // Newest first, and stable within a date so two entries written the same day keep the order
  // they were authored in. ISO dates sort correctly as strings, which is why the format is
  // pinned rather than free text.
  const sorted = [...updates]
    .map((u, i) => ({ u, i }))
    .sort((a, b) => (a.u.date === b.u.date ? a.i - b.i : b.u.date.localeCompare(a.u.date)))
    .map(({ u }) => ({ date: u.date, body: u.body.trim() }));

  return { body: kept.join(eol).trimEnd(), updates: sorted };
}

/**
 * Inserts an update into a project file, returning the new file contents.
 *
 * Prepends within `## Updates`, creating the section at the end of the file if it is absent.
 * Appending at the end instead would put the newest entry furthest from the heading, and
 * whoever opens the file to write the next one reads top-down.
 *
 * Same-day entries are kept, not merged: two things can happen on one day, and silently
 * concatenating them would lose the boundary between them.
 */
export function insertUpdate(file: string, date: string, body: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`an update needs an ISO date, got "${date}"`);
  }
  const text = body.trim();
  if (text === "") throw new Error("an update needs something written in it");

  const eol = file.includes("\r\n") ? "\r\n" : "\n";
  const entry = [`### ${date}`, "", text].join(eol);
  const lines = file.split(/\r?\n/);

  const at = lines.findIndex((l) => UPDATES_HEADING.test(l));
  if (at === -1) {
    return [file.trimEnd(), "", "## Updates", "", entry, ""].join(eol);
  }

  lines.splice(at + 1, 0, "", entry);
  return lines.join(eol);
}
