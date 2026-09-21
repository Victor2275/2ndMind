import { beforeEach, describe, expect, it } from "vitest";

import { TAB_CATEGORIES, categoryByKey, type Category } from "@/lib/log/categories";
import {
  clearDraft,
  readDraft,
  readLastCategory,
  resetDraftCache,
  saveDraft,
  writeLastCategory,
} from "@/lib/log/drafts";

/**
 * Drafts and the remembered tab (V4 §5.5, Q393, Q394).
 *
 * The property under test is not "it round-trips a string". It is that a draft can never put a
 * number in front of Victor that looks measured when it was not, and that a stored tab key can
 * never select a category that no longer exists — the two ways this feature could quietly
 * damage the log rather than merely fail to help.
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

/** A storage that refuses everything, like a private window with site data blocked. */
const HOSTILE: Storage = {
  length: 0,
  clear() {
    throw new Error("blocked");
  },
  getItem() {
    throw new Error("blocked");
  },
  key() {
    throw new Error("blocked");
  },
  removeItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

// Two live tabs. `athletics` is deliberately **not** used as a valid one: it is retired
// (D-159), and it appears below as the key that must not be restorable.
const training = categoryByKey("weight") as Category;
const note = categoryByKey("reading") as Category;

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  resetDraftCache();
});

describe("a draft", () => {
  it("keeps everything typed, measurements included", () => {
    // The opposite rule to sticky values, deliberately: a draft is an unfinished entry, so
    // dropping its numbers would leave the half that is useless without them.
    saveDraft(storage, training, { exercise: "Bench press", weight: "60", reps: "8" });

    expect(readDraft(storage, training)).toEqual({
      exercise: "Bench press",
      weight: "60",
      reps: "8",
    });
  });

  it("is removed rather than emptied when every field is blank", () => {
    saveDraft(storage, training, { exercise: "Bench press" });
    saveDraft(storage, training, { exercise: "  ", weight: "" });

    // Clearing the form by hand must not leave a ghost to be restored tomorrow.
    expect(readDraft(storage, training)).toEqual({});
  });

  it("never carries the category field across a tab switch", () => {
    saveDraft(storage, training, { category: "wrong", exercise: "Row" });
    expect(readDraft(storage, training).category).toBeUndefined();
  });

  it("is kept per category", () => {
    saveDraft(storage, training, { exercise: "Row" });
    saveDraft(storage, note, { note: "Ask about the taper" });

    expect(readDraft(storage, training)).toEqual({ exercise: "Row" });
    expect(readDraft(storage, note)).toEqual({ note: "Ask about the taper" });
  });

  it("is gone after it is discarded", () => {
    saveDraft(storage, training, { exercise: "Row" });
    clearDraft(storage, training);
    expect(readDraft(storage, training)).toEqual({});
  });

  it("survives a hand-edited or corrupt value", () => {
    storage.setItem("2m_draft_weight", "{not json");
    expect(readDraft(storage, training)).toEqual({});
  });

  it("ignores a stored value that is not an object of strings", () => {
    storage.setItem("2m_draft_weight", JSON.stringify({ reps: 8, sets: ["a"], ok: "yes" }));
    expect(readDraft(storage, training)).toEqual({ ok: "yes" });
  });

  it("does not throw when the browser refuses storage", () => {
    // A private window, or site data blocked. A form that opens empty is a small cost; a form
    // that throws is the whole page.
    expect(() => saveDraft(HOSTILE, training, { exercise: "Row" })).not.toThrow();
    expect(() => clearDraft(HOSTILE, training)).not.toThrow();
    expect(readDraft(HOSTILE, training)).toEqual({});
  });

  it("does nothing at all without a storage", () => {
    expect(readDraft(undefined, training)).toEqual({});
    expect(() => saveDraft(undefined, training, { exercise: "Row" })).not.toThrow();
  });
});

describe("the remembered tab", () => {
  it("comes back", () => {
    writeLastCategory(storage, "weight");
    expect(readLastCategory(storage, TAB_CATEGORIES)).toBe("weight");
  });

  it("is ignored when the category no longer exists", () => {
    // D-159 keeps retired category *definitions* alive so old entries still read. That is not
    // the same as offering the tab, and selecting one would render a form with nothing in it.
    storage.setItem("2m_log_tab", "athletics");
    expect(readLastCategory(storage, TAB_CATEGORIES)).toBeNull();
  });

  it("is null when nothing has been chosen", () => {
    expect(readLastCategory(storage, TAB_CATEGORIES)).toBeNull();
  });

  it("does not throw when the browser refuses storage", () => {
    expect(() => writeLastCategory(HOSTILE, "weight")).not.toThrow();
    expect(readLastCategory(HOSTILE, TAB_CATEGORIES)).toBeNull();
  });
});
