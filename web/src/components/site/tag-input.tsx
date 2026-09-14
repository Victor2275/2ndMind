"use client";

import { useId, useMemo, useState } from "react";

import { MAX_TAG_LENGTH, MAX_TAGS, normalizeTag } from "@/lib/log/tags";

/**
 * Free tags on a form (V4 Phase 3, §3.2).
 *
 * Uncontrolled by design, like every other field in `LogForm`: the committed tags live in
 * React state (there is no DOM value to read them back from), but nothing here talks to a
 * server — it renders one hidden `<input name="tags">` per tag, and `readTags` in
 * `lib/log/tags.ts` reads them back with `formData.getAll("tags")` on submit. That is the same
 * "the form is the source of truth" contract `RowFields` and `FieldInput` already keep; a
 * tag-input that stored its list somewhere React alone could see would not survive the
 * uncontrolled-input recovery path `LogForm` already relies on when a save fails.
 *
 * **Tokens, not a fixed list.** This is the whole point of Phase 3 (§2.3): a category is a
 * closed vocabulary declared in code, a tag is not. The chip visual language matches
 * `ChipRow` in `log-form.tsx` — same pill shape, same muted-until-active colour — because a tag
 * and a chip are both "a small fact you can tap", and using two different shapes for that would
 * teach two vocabularies for one idea.
 */

export function TagInput({
  name = "tags",
  label = "Tags",
  initialTags = [],
  suggestions = [],
}: {
  /** The form field name every hidden input shares. Overridable for a page with two tag inputs. */
  name?: string;
  label?: string;
  /** Already on the entry — shown as chips, removable, resubmitted unless removed. */
  initialTags?: readonly string[];
  /** The distinct-tags vocabulary, for autocomplete. Already sorted by whoever fetched it. */
  suggestions?: readonly string[];
}) {
  const [tags, setTags] = useState<string[]>(() => [...initialTags]);
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const listId = `${inputId}-suggestions`;

  const commit = (raw: string) => {
    const cleaned = normalizeTag(raw);
    if (cleaned === "" || tags.length >= MAX_TAGS) {
      setDraft("");
      return;
    }
    setTags((current) => (current.includes(cleaned) ? current : [...current, cleaned]));
    setDraft("");
  };

  const remove = (tag: string) => {
    setTags((current) => current.filter((t) => t !== tag));
  };

  // Suggestions the draft could still become, minus what is already committed — an autocomplete
  // that keeps offering a tag you have already added is a list that stops meaning anything.
  const matches = useMemo(() => {
    const query = draft.trim().toLowerCase();
    const available = suggestions.filter((s) => !tags.includes(s));
    if (query === "") return available.slice(0, 6);
    return available.filter((s) => s.includes(query)).slice(0, 6);
  }, [draft, suggestions, tags]);

  return (
    <div>
      <label className="eyebrow text-muted-foreground" htmlFor={inputId}>
        {label}
      </label>

      {/* One hidden input per tag — `formData.getAll(name)` on the server, no join/split step
          and no risk of a comma inside a tag being mis-parsed as two. */}
      {tags.map((tag) => (
        <input key={tag} type="hidden" name={name} value={tag} />
      ))}

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => remove(tag)}
            aria-label={`Remove tag ${tag}`}
            // Same pill as `ChipRow`'s recent-value chips in log-form.tsx — a tag is the same
            // kind of small, tappable fact, and using the same shape says so without a caption.
            className="flex min-h-8 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:border-destructive/50 hover:text-destructive"
          >
            {tag}
            <span aria-hidden className="font-mono text-[0.6rem]">
              ×
            </span>
          </button>
        ))}

        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter or comma commits — comma because it is how a tag list is typed anywhere
            // else, and because it lets several tags be typed in one breath without reaching
            // for Enter between each. Backspace on an empty draft pops the last chip, the same
            // shortcut mail clients use for recipient chips.
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit(draft);
            } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
              event.preventDefault();
              setTags((current) => current.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim() !== "") commit(draft);
          }}
          placeholder={tags.length === 0 ? "Add a tag…" : ""}
          maxLength={MAX_TAG_LENGTH}
          list={matches.length > 0 ? listId : undefined}
          aria-label={label}
          disabled={tags.length >= MAX_TAGS}
          className="min-h-8 min-w-24 flex-1 border-none bg-transparent px-1 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {matches.length > 0 && (
        // A native <datalist> rather than a custom popover: it is keyboard- and
        // screen-reader-accessible for free, and this field's whole existence is one form input
        // among many on a page that has to stay usable one-handed — spending a build budget on
        // a custom listbox here would buy nothing this doesn't already have.
        <datalist id={listId}>
          {matches.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      )}

      {tags.length >= MAX_TAGS && (
        <p className="mt-1 font-mono text-[0.6rem] text-muted-foreground">
          {MAX_TAGS} is the most tags on one entry.
        </p>
      )}
    </div>
  );
}
