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

/**
 * A group of fields repeated per row — sets (V3, D-159).
 *
 * The quick log used to collect one weight and one reps, which meant three sets of bench
 * press were three entries, or one entry that quietly recorded a third of the work. The
 * Training tab's own form had rows from the start, and this is the same idea in the shape a
 * phone can use: the exercise is typed once, and each set is a row of numbers under it.
 *
 * One entry is therefore **one exercise**, not one session. That is deliberate — the log is
 * written at the rack between sets, not afterwards from memory, and a form that wanted a
 * whole session would be a form nobody finishes.
 */
export type RowGroup = {
  /** Prefix for the form field names: `sets.0.weightLbs`. Also the key in stored `data`. */
  name: string;
  /** Singular, for the row's own label: "Set 1". */
  label: string;
  /** The button under the rows. */
  addLabel: string;
  /** Rows present when the form is opened. */
  initial: number;
  /** Refuses to grow past this, so a stuck finger cannot post a thousand rows. */
  max: number;
  fields: readonly Field[];
  /**
   * The name of a flat field whose value decides which row fields apply (D-162).
   *
   * A bench press has no split and no stroke rate, and offering them is not merely untidy: it
   * is four extra things to read past on a phone, between sets, which is most of the fifteen
   * seconds the whole category is built around. Reported by Victor on 2026-09-05.
   */
  shapeBy?: string;
  /** Row field names to show, per value of the `shapeBy` field. */
  shapes?: Readonly<Record<string, readonly string[]>>;
  /** Which shape applies before that field has a value. */
  defaultShape?: string;
  /** Shown whatever the shape is. */
  always?: readonly string[];
};

/**
 * The row fields that apply right now.
 *
 * `showAll` is the escape hatch: a shape is a good guess and never a rule, and a form that
 * cannot record what actually happened is worse than one with a spare field on it. An
 * unrecognised value falls back to the default shape rather than to nothing, so a category
 * that grows a new `kind` degrades to a usable form instead of an empty one.
 */
export function rowFieldsFor(
  group: RowGroup,
  shape: string | undefined,
  showAll = false,
): readonly Field[] {
  if (showAll || !group.shapes) return group.fields;

  const names = group.shapes[shape ?? ""] ?? group.shapes[group.defaultShape ?? ""];
  if (!names) return group.fields;

  const wanted = new Set([...names, ...(group.always ?? [])]);
  // Filtered from `fields` rather than mapped from `names`, so the order on screen is the
  // declaration order and cannot drift between shapes.
  return group.fields.filter((field) => wanted.has(field.name));
}

export type Category = {
  key: string;
  label: string;
  /** One line under the tab explaining when to use it. */
  hint: string;
  fields: readonly Field[];
  /** Repeated rows, rendered under the flat fields. */
  rows?: RowGroup;
  /**
   * Not offered in the form any more, but still needed to read entries already stored.
   * Retiring a category must never turn its history into unlabelled JSON.
   */
  retired?: true;
  /**
   * Written through the capture box rather than through a tab (D-164).
   *
   * It is a real, writable category — it summarises, it searches, it syncs — it simply has no
   * place in the tab row, because the whole point of a quick note is not choosing a category.
   */
  capture?: true;
};

export const CATEGORIES: readonly Category[] = [
  {
    key: "academics",
    label: "Study",
    // Deliberately thin (D-159). It used to ask for what kind of work it was, a status and a
    // grade — three decisions to record having sat down with a problem set, and a grade is a
    // thing that arrives weeks later on a different screen. Course and hours are what get
    // plotted; anything else worth saying goes in the note, which every entry already has.
    hint: "Time on a course. Anything worth saying goes in the note.",
    fields: [
      {
        name: "course",
        label: "Course",
        type: "text",
        placeholder: "M51A",
        sticky: true,
        chips: true,
      },
      { name: "hours", label: "Hours", type: "number", placeholder: "2", keypad: "decimal" },
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
    /**
     * An unstructured capture (D-164).
     *
     * No fields, deliberately. A capture box that asks which category something belongs to is
     * a filing form, and filing is exactly the work being deferred — the same reasoning that
     * shaped `addInboxNote` for tasks. The text lands in the entry's own note, and the entry
     * sits in the unsorted pile until it is filed into a real category.
     */
    key: "note",
    label: "Note",
    hint: "Anything at all, sorted later.",
    capture: true,
    fields: [],
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

/**
 * Categories that are no longer offered, kept so their history stays readable (D-159).
 *
 * `work` came out because applications are tracked in a Google Sheet, and logging them in two
 * places meant neither was complete. Deleting the definition would have been the tempting
 * move and the wrong one: `summarise` and `searchTextFor` are given a category key and a blob
 * of JSON, and with no definition to match they fall back to the bare note — so every
 * application ever logged would silently lose its company, role and status from the timeline
 * and from search. A retired category costs one array entry and keeps the record intact.
 *
 * **`athletics` joined it in V4 Phase 2.7**, and for a different reason: training did not stop
 * being logged, it moved. Sessions are now written at `/private/athletics/log`, where a set
 * belongs to a workout rather than sitting inside a log entry's JSON — which is what lets
 * "Recent sessions" show everything and what let `allEfforts()` drop from two readers to one.
 *
 * The same argument for retiring rather than deleting applies twice over here. `summarise` and
 * `searchTextFor` still need the field definitions to render an old entry, and the sets stored
 * in `data.sets` are real training that has to stay readable in the timeline. What retirement
 * buys is that no *new* entry can be created down the old path — `writableCategoryByKey` will
 * not return it — so the two ways of recording a lift cannot start diverging again.
 */
export const RETIRED_CATEGORIES: readonly Category[] = [
  {
    key: "athletics",
    label: "Training",
    hint: "Retired — training is logged as sessions at /private/athletics/log.",
    retired: true,
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
        // The whole point of the chip: "Bench Press · 185 × 5" fills the name and the first
        // set's numbers. Resolved against the first row of the entry it came from.
        carries: ["weightLbs", "reps", "distance", "duration", "spm"],
      },
      { name: "rpe", label: "RPE", type: "number", placeholder: "1-10", keypad: "numeric" },
      /**
       * The morning weigh-in, logged where you already are rather than in another tab.
       *
       * It is **not** stored on the entry. It writes a `bodyweight_entries` row, which is
       * what the weight chart and the bodyweight-adjusted erg table read — two copies of a
       * number that is the second input to every adjusted split is how they drift apart.
       */
      {
        name: "bodyweightLbs",
        label: "Bodyweight",
        type: "number",
        placeholder: "lbs",
        keypad: "decimal",
      },
    ],
    rows: {
      name: "sets",
      label: "Set",
      addLabel: "add set",
      initial: 1,
      max: 12,
      /**
       * Which numbers a set has depends on what kind of session it is (D-162). `kind` already
       * sits at the top of the form and is already sticky, so it is the thing to key off —
       * one decision he was making anyway, rather than a second control.
       *
       * `lift` is the default because it is the common case and because opening on weight ×
       * reps means the usual entry needs no setup at all.
       */
      shapeBy: "kind",
      defaultShape: "lift",
      always: ["setType"],
      shapes: {
        lift: ["weightLbs", "reps"],
        erg: ["distance", "duration", "spm"],
        water: ["distance", "duration", "spm"],
        // Runs, rucks, bikes, and circuits — 20 burpees, 400m, repeat.
        conditioning: ["duration", "distance", "reps"],
      },
      fields: [
        {
          name: "weightLbs",
          label: "Weight",
          type: "number",
          placeholder: "lbs",
          keypad: "decimal",
        },
        { name: "reps", label: "Reps", type: "number", placeholder: "5", keypad: "numeric" },
        {
          name: "distance",
          label: "Distance",
          type: "distance",
          placeholder: "500",
          keypad: "decimal",
        },
        // Accepts 2:17 as an erg monitor shows it, not just seconds. `text`, because no
        // numeric keypad on Android offers a colon and the field is unusable without one.
        { name: "duration", label: "Time", type: "duration", placeholder: "m:ss", keypad: "text" },
        { name: "spm", label: "SPM", type: "number", placeholder: "72", keypad: "numeric" },
        // Per row, because it is a property of the set and not of the exercise: the first two
        // are warmups and the last is a drop set. `isWorkingSet` in `athletics/prs.ts` reads
        // this to keep warmups off the PR board, so a session-wide value would rank them.
        {
          name: "setType",
          label: "Type",
          type: "select",
          options: ["normal", "warmup", "drop"],
        },
      ],
    },
  },
  {
    key: "work",
    label: "Applications",
    hint: "Retired — applications live in the Google Sheet.",
    retired: true,
    fields: [
      { name: "company", label: "Company", type: "text" },
      { name: "role", label: "Role", type: "text" },
      {
        name: "action",
        label: "Action",
        type: "select",
        options: ["submitted", "action required", "OA", "interview", "rejected", "offer"],
      },
      { name: "effort", label: "Effort", type: "select", options: ["tailored", "quick apply"] },
      { name: "link", label: "Link", type: "text" },
    ],
  },
] as const;

/**
 * Looks up a category for **reading** — live or retired.
 *
 * Writers must not use this on its own. Accepting a retired key from a form post would let
 * the category come back through the one door that is still open, which is a Server Action
 * anyone with the id can post to.
 */
export function categoryByKey(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key) ?? RETIRED_CATEGORIES.find((c) => c.key === key);
}

/** Looks up a category that may still be written to. */
export function writableCategoryByKey(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

/**
 * The categories that get a tab.
 *
 * `note` is excluded because it is written through the capture box above the tabs. Adding it
 * to the row would put a sixth tab on a phone for the one thing that is meant to need no
 * choosing at all.
 */
export const TAB_CATEGORIES = CATEGORIES.filter((c) => c.capture !== true);

/** Entries here have not been filed into a real category yet. */
export const UNSORTED_CATEGORY = "note";

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

  const sets = summariseRows(definition, data);
  if (sets) parts.push(sets);

  const head = parts.join(" · ");
  if (head && note) return `${head} — ${note}`;
  return head || note;
}

/** Rows as they are read aloud: `185 × 5, 185 × 5, 175 × 5`, or `2000m 7:12 @ 24`. */
function summariseRows(definition: Category, data: Record<string, unknown>): string {
  const group = definition.rows;
  if (!group) return "";

  const lines: string[] = [];
  for (const row of rowsIn(group, data)) {
    const weight = row.weightLbs;
    const reps = row.reps;

    // A set reads as a multiplication and an erg piece does not. Same rule as the chip face,
    // and the same bug avoided: "2000m × 7:12" is not a multiplication of anything.
    const parts: string[] = [];
    if (typeof weight === "number" && typeof reps === "number") {
      parts.push(`${weight} × ${reps}`);
    } else if (typeof weight === "number") parts.push(String(weight));
    else if (typeof reps === "number") parts.push(`${reps}r`);

    for (const field of group.fields) {
      if (field.name === "weightLbs" || field.name === "reps") continue;
      const value = row[field.name];
      if (value === undefined || value === null || value === "" || value === false) continue;
      // "normal" is the default and saying so on every set would triple the line's length.
      if (field.name === "setType" && value === "normal") continue;
      parts.push(field.name === "distance" ? `${value}m` : String(value));
    }

    if (parts.length > 0) lines.push(parts.join(" "));
  }

  return lines.join(", ");
}

/** The rows stored on an entry, defensively — `data` is JSON from a column, not a type. */
export function rowsIn(
  group: RowGroup | undefined,
  data: Record<string, unknown>,
): Record<string, unknown>[] {
  if (!group) return [];
  const raw = data[group.name];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null && !Array.isArray(row),
  );
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

  // Flat values only at the top level: `String({...})` on a row array yields "[object Object]",
  // which would be indexed as searchable text and match nothing anyone would ever type.
  const values = Object.values(data)
    .filter((v) => v !== null && v !== undefined && v !== "" && v !== false)
    .filter((v) => typeof v !== "object")
    .map((v) => String(v));

  const rows = rowsIn(definition?.rows, data).flatMap((row) =>
    Object.values(row)
      .filter((v) => v !== null && v !== undefined && v !== "" && v !== false)
      .map((v) => String(v)),
  );

  return [label, category, ...values, ...rows, note].join(" ").trim();
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
