/**
 * What can be logged, and with which fields.
 *
 * Data, not markup: the forms, the validation, the summary lines and the search index are all
 * generated from this. Adding a field means editing one array, which is what D-039 promised —
 * Victor edits the fields, and that has to be cheap.
 *
 * Fields come from vocabulary already in the vault so a logged erg piece and the PR table
 * describe the same quantities: SPM and drag factor because the vault sets stroke-rate targets
 * per race distance, course codes because the tracker already keys on them.
 *
 * The design constraint that outranks completeness: a log you cannot finish in fifteen seconds,
 * one-handed, is a log that will not be written. Every field here is optional.
 */

export type FieldType = "text" | "number" | "select" | "duration" | "distance" | "bool";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  /** Shown in the input. Concrete examples beat instructions. */
  placeholder?: string;
  options?: readonly string[];
  /** Narrow fields sit side by side on a phone; wide ones take the row. */
  wide?: boolean;
};

export type Category = {
  key: string;
  label: string;
  /** One line under the tab explaining when to use it. */
  hint: string;
  fields: readonly Field[];
};

export const CATEGORIES: readonly Category[] = [
  {
    key: "athletics",
    label: "Training",
    hint: "Logged at the gym or off the water, before you forget the numbers.",
    fields: [
      {
        name: "kind",
        label: "Kind",
        type: "select",
        options: ["lift", "erg", "water", "conditioning"],
      },
      { name: "exercise", label: "Exercise / piece", type: "text", placeholder: "Bench Press", wide: true },
      { name: "weightLbs", label: "Weight", type: "number", placeholder: "lbs" },
      { name: "reps", label: "Reps", type: "number", placeholder: "5" },
      { name: "distance", label: "Distance", type: "distance", placeholder: "500" },
      // Accepts 2:17 as an erg monitor shows it, not just seconds.
      { name: "duration", label: "Time", type: "duration", placeholder: "m:ss" },
      { name: "spm", label: "SPM", type: "number", placeholder: "72" },
      { name: "rpe", label: "RPE", type: "number", placeholder: "1-10" },
    ],
  },
  {
    key: "academics",
    label: "Study",
    hint: "After finishing an assignment or a study block.",
    fields: [
      { name: "course", label: "Course", type: "text", placeholder: "M51A" },
      {
        name: "kind",
        label: "What",
        type: "select",
        options: ["problem set", "midterm", "final", "reading", "project", "lecture"],
      },
      { name: "hours", label: "Hours", type: "number", placeholder: "2" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["started", "submitted", "graded"],
      },
      // Private, always. Per-course grades never reach the public build.
      { name: "grade", label: "Grade", type: "text", placeholder: "A-" },
    ],
  },
  {
    key: "work",
    label: "Applications",
    hint: "After submitting one, or clearing an action-required item.",
    fields: [
      { name: "company", label: "Company", type: "text", placeholder: "Anthropic" },
      { name: "role", label: "Role", type: "text", placeholder: "Robotics Intern", wide: true },
      {
        name: "action",
        label: "Action",
        type: "select",
        options: ["submitted", "action required", "OA", "interview", "rejected", "offer"],
      },
      // The 1+4 rule: one heavily tailored application a day, four quick applies.
      { name: "effort", label: "Effort", type: "select", options: ["tailored", "quick apply"] },
      { name: "link", label: "Link", type: "text", placeholder: "https://", wide: true },
    ],
  },
  {
    key: "reading",
    label: "Reading",
    hint: "Books, papers, videos — anything worth remembering you read.",
    fields: [
      { name: "title", label: "Title", type: "text", placeholder: "Title", wide: true },
      {
        name: "kind",
        label: "Kind",
        type: "select",
        options: ["book", "paper", "video", "article"],
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["started", "finished", "abandoned"],
      },
      // The only field that still matters in six months.
      { name: "takeaway", label: "Takeaway", type: "text", placeholder: "One line", wide: true },
    ],
  },
  {
    key: "people",
    label: "People",
    hint: "Who you met and what you talked about.",
    fields: [
      { name: "who", label: "Who", type: "text", placeholder: "Name", wide: true },
      { name: "where", label: "Where", type: "text", placeholder: "Practice, career fair…" },
      { name: "about", label: "About", type: "text", placeholder: "What you talked about", wide: true },
      { name: "followUp", label: "Follow up", type: "bool" },
    ],
  },
  {
    key: "day",
    label: "End of day",
    // Deliberately no mood or energy scale: Victor put that in V3, and a 1-5 filled in from
    // habit rather than reflection is worse than nothing.
    hint: "How the day went. One box, no scales.",
    fields: [
      { name: "carryOver", label: "Carrying over to tomorrow", type: "text", wide: true },
    ],
  },
] as const;

export function categoryByKey(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

/**
 * A one-line summary of an entry, for the timeline. Built from whichever fields are present,
 * in declaration order, so it reads the way the form was filled in.
 */
export function summarise(category: string, data: Record<string, unknown>, note: string): string {
  const definition = categoryByKey(category);
  if (!definition) return note;

  const parts: string[] = [];
  for (const field of definition.fields) {
    const value = data[field.name];
    if (value === undefined || value === null || value === "" || value === false) continue;
    if (field.type === "bool") {
      parts.push(field.label.toLowerCase());
      continue;
    }
    parts.push(String(value));
  }

  const head = parts.join(" · ");
  if (head && note) return `${head} — ${note}`;
  return head || note;
}

/**
 * Everything searchable about an entry, flattened. Stored alongside the row so search does
 * not have to reach into JSON at query time.
 */
export function searchTextFor(
  category: string,
  data: Record<string, unknown>,
  note: string,
): string {
  const definition = categoryByKey(category);
  const label = definition?.label ?? category;
  const values = Object.values(data)
    .filter((v) => v !== null && v !== undefined && v !== "" && v !== false)
    .map((v) => String(v));
  return [label, category, ...values, note].join(" ").trim();
}
