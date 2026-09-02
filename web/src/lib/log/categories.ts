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

export type FieldType = "text" | "number" | "select" | "duration" | "distance" | "bool" | "scale";

/** Every `scale` field is 1–5. Fixed rather than configurable: two scales that ran to
 *  different maximums could not be read on the same chart, which is the only reason to
 *  collect them. */
export const SCALE_MIN = 1;
export const SCALE_MAX = 5;

/**
 * The keypad a phone raises. Explicit rather than derived from `type`, because the right
 * answer differs between fields of the same type: reps wants digits only, weight wants a
 * decimal point, and a duration typed as `2:17` needs the full keyboard because no numeric
 * mode offers a colon. Getting this wrong costs a keyboard switch per field, which is most
 * of the fifteen seconds.
 */
export type Keypad = "text" | "numeric" | "decimal" | "url";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  /** Shown in the input. Concrete examples beat instructions. */
  placeholder?: string;
  options?: readonly string[];
  /** Overrides the keypad this field's type would otherwise get. */
  keypad?: Keypad;
  /** Phone autocapitalisation. Names and companies want `words`; a URL wants `none`. */
  capitalise?: "none" | "words" | "sentences";
  /**
   * Remembered from the last entry in this category and pre-filled next time (V3 §1.6, D-155).
   *
   * Only ever context — which kind of session, which course, where you were. **Never a
   * measurement.** A stale `kind` is obvious at a glance and harmless; a stale weight silently
   * pre-filled is a corrupted record that reads as real, and the log's whole value is that its
   * numbers can be trusted. Measurements come back only through a chip, which has to be
   * tapped and prints what it is about to fill in.
   */
  sticky?: boolean;
  /**
   * Offer this field's recent values as one-tap chips, newest first.
   *
   * The slow part of a training log is typing "Romanian Deadlift" one-handed. A chip turns
   * that into one tap, and `carries` lets the tap bring last time's numbers with it.
   */
  chips?: boolean;
  /**
   * Filled in alongside a chip, from the same entry the chip came from. Shown on the chip
   * itself — a tap that silently sets a weight would be the sticky-measurement mistake with
   * an extra step.
   */
  carries?: readonly string[];
  /** Offer a one-tap paste button, for fields that are almost always pasted. */
  clipboard?: boolean;
  /**
   * `scale` only — the words under 1 and under 5. Ends are anchored and the middle is not,
   * deliberately: a number with a word attached has to be chosen rather than tapped from
   * habit, and anchoring all five costs more width than a 360px screen has.
   */
  anchors?: readonly [string, string];
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
        sticky: true,
      },
      {
        name: "exercise",
        label: "Exercise / piece",
        type: "text",
        placeholder: "Bench Press",
        wide: true,
        capitalise: "words",
        chips: true,
        // The whole point of the chip: "Bench Press · 185 × 5" fills all three.
        carries: ["weightLbs", "reps", "distance", "duration", "spm"],
      },
      { name: "weightLbs", label: "Weight", type: "number", placeholder: "lbs", keypad: "decimal" },
      { name: "reps", label: "Reps", type: "number", placeholder: "5", keypad: "numeric" },
      {
        name: "distance",
        label: "Distance",
        type: "distance",
        placeholder: "500",
        keypad: "decimal",
      },
      // Accepts 2:17 as an erg monitor shows it, not just seconds. `text`, because no numeric
      // keypad on Android offers a colon and the field is unusable without one.
      { name: "duration", label: "Time", type: "duration", placeholder: "m:ss", keypad: "text" },
      { name: "spm", label: "SPM", type: "number", placeholder: "72", keypad: "numeric" },
      { name: "rpe", label: "RPE", type: "number", placeholder: "1-10", keypad: "numeric" },
    ],
  },
  {
    key: "academics",
    label: "Study",
    hint: "After finishing an assignment or a study block.",
    fields: [
      {
        name: "course",
        label: "Course",
        type: "text",
        placeholder: "M51A",
        sticky: true,
        chips: true,
      },
      {
        name: "kind",
        label: "What",
        type: "select",
        options: ["problem set", "midterm", "final", "reading", "project", "lecture"],
        sticky: true,
      },
      { name: "hours", label: "Hours", type: "number", placeholder: "2", keypad: "decimal" },
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
      {
        name: "company",
        label: "Company",
        type: "text",
        placeholder: "Anthropic",
        capitalise: "words",
        // One company is logged several times over a season — submitted, OA, interview — so
        // the chip is usually a repeat rather than a new name.
        chips: true,
        carries: ["role"],
      },
      {
        name: "role",
        label: "Role",
        type: "text",
        placeholder: "Robotics Intern",
        wide: true,
        capitalise: "words",
      },
      {
        name: "action",
        label: "Action",
        type: "select",
        options: ["submitted", "action required", "OA", "interview", "rejected", "offer"],
        sticky: true,
      },
      // The 1+4 rule: one heavily tailored application a day, four quick applies.
      {
        name: "effort",
        label: "Effort",
        type: "select",
        options: ["tailored", "quick apply"],
        sticky: true,
      },
      // Always arrives from the job posting already on the clipboard. Typing it one-handed
      // is the single slowest thing in this form, so it gets a paste button.
      {
        name: "link",
        label: "Link",
        type: "text",
        placeholder: "https://",
        wide: true,
        keypad: "url",
        capitalise: "none",
        clipboard: true,
      },
    ],
  },
  {
    key: "reading",
    label: "Reading",
    hint: "Books, papers, videos — anything worth remembering you read.",
    fields: [
      {
        name: "title",
        label: "Title",
        type: "text",
        placeholder: "Title",
        wide: true,
        capitalise: "words",
        // A book is logged twice — started, then finished — so the chip carries the kind.
        chips: true,
        carries: ["kind"],
      },
      {
        name: "kind",
        label: "Kind",
        type: "select",
        options: ["book", "paper", "video", "article"],
        sticky: true,
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
      {
        name: "who",
        label: "Who",
        type: "text",
        placeholder: "Name",
        wide: true,
        capitalise: "words",
        chips: true,
      },
      {
        name: "where",
        label: "Where",
        type: "text",
        placeholder: "Practice, career fair…",
        sticky: true,
      },
      {
        name: "about",
        label: "About",
        type: "text",
        placeholder: "What you talked about",
        wide: true,
      },
      { name: "followUp", label: "Follow up", type: "bool" },
    ],
  },
  {
    key: "day",
    label: "End of day",
    // V1-V2 carried a note here saying there was deliberately no mood or energy scale, because
    // "a 1-5 filled in from habit rather than reflection is worse than nothing". Victor added
    // them in V3 anyway, for a series he can plot against training load and splits (D-134).
    //
    // The objection was mitigated rather than withdrawn: the ends carry words, so a tap is a
    // choice between "wrecked" and "great" rather than a reflex on a bare number. It is still
    // possible to fill these in on autopilot, and a month of flat 3s is the signal to take them
    // out again — not a bug.
    hint: "How the day went, and how you felt.",
    fields: [
      { name: "mood", label: "Mood", type: "scale", anchors: ["wrecked", "great"] },
      { name: "energy", label: "Energy", type: "scale", anchors: ["empty", "wired"] },
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
    // A bare "4" in a timeline says nothing, and two scales side by side would read as "4 · 2"
    // with no way to tell which was which. The label travels with the number.
    if (field.type === "scale") {
      parts.push(`${field.label.toLowerCase()} ${value}`);
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

/** Fields remembered between entries in a category. */
export function stickyFields(category: Category): readonly Field[] {
  return category.fields.filter((f) => f.sticky === true);
}

/** Fields that offer recent values as chips. */
export function chipFields(category: Category): readonly Field[] {
  return category.fields.filter((f) => f.chips === true);
}

/**
 * The keypad to raise for a field.
 *
 * The default is deliberately `decimal` for numbers rather than `numeric`: a bodyweight or an
 * RPE can carry a decimal point, and a keypad without one turns a 7.5 into a keyboard switch.
 * Fields that are genuinely integer-only say so.
 */
export function keypadFor(field: Field): Keypad {
  if (field.keypad) return field.keypad;
  if (field.type === "number" || field.type === "distance") return "decimal";
  return "text";
}
